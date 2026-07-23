"""ConstructX web server.

A dependency-free HTTP server (standard library only) that serves the static
site and exposes one private endpoint for project enquiries.

Design notes
------------
* Static assets under ``/assets/`` are content-versioned by filename, so they
  get a long ``Cache-Control``; HTML is always revalidated so edits ship
  immediately.
* Text responses are gzipped when the client advertises support.
* ``POST /api/enquiries`` is rate limited per client and protected by a
  honeypot, because an unauthenticated endpoint that appends to disk is
  otherwise an open invitation.
* Enquiry writes take a process-wide lock: the server is threaded, and two
  concurrent appends to a JSON Lines file can interleave mid-line.
"""

from __future__ import annotations

import gzip
import json
import os
import re
import smtplib
import ssl
import threading
import time
from collections import deque
from datetime import datetime, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PORT = 8000
DEFAULT_HOST = "127.0.0.1"

MAX_ENQUIRY_BYTES = 12_000
MAX_NOTES_CHARS = 1_200
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$")

# Rate limit: this many enquiries per client per window.
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW_SECONDS = 15 * 60

# Compress text above this size only; below it, gzip costs more than it saves.
GZIP_MIN_BYTES = 1_024
GZIP_TYPES = frozenset(
    {
        "text/html",
        "text/css",
        "text/plain",
        "text/markdown",
        "application/javascript",
        "text/javascript",
        "application/json",
        "image/svg+xml",
        "application/manifest+json",
    }
)

# Everything the page loads is same-origin except Google Fonts. Three.js is
# vendored under /assets/vendor/, so scripts never leave this origin.
CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "upgrade-insecure-requests",
    ]
)

SECURITY_HEADERS = {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Frame-Options": "DENY",
}

ACK_MESSAGE = (
    "Enquiry received. ConstructX will review the project details and follow up "
    "with next steps within one business day."
)


class RateLimiter:
    """Sliding-window rate limiter keyed by client identity."""

    def __init__(self, max_events: int, window_seconds: float) -> None:
        self._max = max_events
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        cutoff = now - self._window
        with self._lock:
            bucket = self._hits.setdefault(key, deque())
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self._max:
                return False
            bucket.append(now)
            # Opportunistic cleanup so a long-running process does not keep a
            # dictionary entry for every IP that ever touched the form.
            if len(self._hits) > 4_096:
                for stale in [k for k, v in self._hits.items() if not v]:
                    del self._hits[stale]
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


enquiry_limiter = RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS)
_write_lock = threading.Lock()


class ConstructXRequestHandler(SimpleHTTPRequestHandler):
    """Serve the ConstructX site with sane caching, compression, and headers."""

    server_version = "ConstructX"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    # ---------------------------------------------------------------- routing

    def translate_path(self, path: str) -> str:
        translated = Path(super().translate_path(path))
        if translated.is_dir():
            # No directory listings: resolve to an index file or fall through
            # to a 404.
            return str(translated / "index.html")
        return str(translated)

    def list_directory(self, path):  # pragma: no cover - defensive
        self.send_error_page(HTTPStatus.NOT_FOUND)
        return None

    # ---------------------------------------------------------------- headers

    def cache_control_for(self, path: str) -> str:
        if path.startswith("/assets/"):
            return "public, max-age=31536000, immutable"
        if path.startswith("/api/"):
            return "no-store"
        return "no-cache"

    def end_headers(self) -> None:
        path = urlparse(self.path).path
        for header, value in SECURITY_HEADERS.items():
            self.send_header(header, value)
        self.send_header("Cache-Control", self.cache_control_for(path))
        super().end_headers()

    def wants_gzip(self) -> bool:
        return "gzip" in self.headers.get("Accept-Encoding", "").lower()

    # ------------------------------------------------------------- responding

    def send_bytes(
        self,
        status: int,
        body: bytes,
        content_type: str,
        *,
        compress: bool = True,
    ) -> None:
        extra: list[tuple[str, str]] = []
        base_type = content_type.split(";", 1)[0].strip()
        if (
            compress
            and self.wants_gzip()
            and len(body) >= GZIP_MIN_BYTES
            and base_type in GZIP_TYPES
        ):
            body = gzip.compress(body, 6)
            extra.append(("Content-Encoding", "gzip"))
            extra.append(("Vary", "Accept-Encoding"))

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for header, value in extra:
            self.send_header(header, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_bytes(status, body, "application/json; charset=utf-8")

    def send_error_page(self, status: HTTPStatus) -> None:
        """Serve the branded 404 page when it exists, else a plain message."""
        custom = PROJECT_ROOT / "404.html"
        if status == HTTPStatus.NOT_FOUND and custom.is_file():
            self.send_bytes(status, custom.read_bytes(), "text/html; charset=utf-8")
            return
        message = f"{status.value} {status.phrase}\n".encode("utf-8")
        self.send_bytes(status, message, "text/plain; charset=utf-8", compress=False)

    # ------------------------------------------------------------------ verbs

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True, "service": "ConstructX"})
            return
        if path.startswith("/api/"):
            self.send_json(404, {"ok": False, "error": "Unknown endpoint"})
            return
        self.serve_static()

    def do_HEAD(self) -> None:
        self.do_GET()

    def serve_static(self) -> None:
        """Serve a file, compressing text responses and 404-ing cleanly."""
        target = Path(self.translate_path(self.path))
        if not target.is_file():
            self.send_error_page(HTTPStatus.NOT_FOUND)
            return

        content_type = self.guess_type(str(target))
        base_type = content_type.split(";", 1)[0].strip()
        if base_type in GZIP_TYPES:
            if "charset=" not in content_type:
                content_type = f"{content_type}; charset=utf-8"
            self.send_bytes(200, target.read_bytes(), content_type)
            return

        # Binary (images, fonts): stream instead of buffering the whole file.
        stat = target.stat()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(stat.st_size))
        self.send_header("Last-Modified", self.date_time_string(int(stat.st_mtime)))
        self.end_headers()
        if self.command != "HEAD":
            with target.open("rb") as handle:
                self.copyfile(handle, self.wfile)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/enquiries":
            self.send_json(404, {"ok": False, "error": "Unknown endpoint"})
            return

        if not enquiry_limiter.allow(self.client_key()):
            self.send_json(
                429,
                {
                    "ok": False,
                    "error": "Too many enquiries from this connection. Try again "
                    "later, or email the team directly.",
                },
            )
            return

        payload = self.read_json_body()
        if payload is None:
            return

        entry, errors = validate_enquiry(payload)
        if errors:
            self.send_json(400, {"ok": False, "errors": errors})
            return

        if is_spam(payload):
            # Accept silently: bots get no signal about what tripped.
            self.send_json(201, {"ok": True, "emailSent": False, "message": ACK_MESSAGE})
            return

        save_enquiry(entry)
        email_sent = send_enquiry_email(entry)
        self.send_json(201, {"ok": True, "emailSent": email_sent, "message": ACK_MESSAGE})

    def read_json_body(self) -> dict | None:
        """Read and parse the request body, replying with an error on failure."""
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"ok": False, "error": "Invalid request length"})
            return None

        if length <= 0:
            self.send_json(400, {"ok": False, "error": "Request body is required"})
            return None
        if length > MAX_ENQUIRY_BYTES:
            self.send_json(413, {"ok": False, "error": "Enquiry is too large"})
            return None

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"ok": False, "error": "Invalid JSON"})
            return None

        if not isinstance(payload, dict):
            self.send_json(400, {"ok": False, "error": "Invalid enquiry payload"})
            return None
        return payload

    # ------------------------------------------------------------------- misc

    def client_key(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.client_address[0] if self.client_address else "unknown"

    def log_message(self, fmt: str, *args) -> None:
        if os.environ.get("CONSTRUCTX_QUIET"):
            return
        super().log_message(fmt, *args)


# ------------------------------------------------------------------ validation


def clean_text(value: object, max_length: int) -> str:
    """Collapse whitespace and truncate.

    Collapsing also strips newlines, which is what keeps user input out of the
    email headers built in :func:`send_enquiry_email`.
    """
    if value is None:
        return ""
    return " ".join(str(value).strip().split())[:max_length]


def normalize_optional_int(value: object, minimum: int, maximum: int) -> int | None:
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return max(minimum, min(maximum, parsed))


def is_spam(payload: dict) -> bool:
    """Detect obvious bot submissions.

    ``company`` is a honeypot: it is visually hidden and out of the tab order,
    so a human never fills it in. ``elapsedMs`` is how long the form was on
    screen; a submission under two seconds was not typed by a person.
    """
    if clean_text(payload.get("company"), 200):
        return True
    elapsed = normalize_optional_int(payload.get("elapsedMs"), 0, 10**9)
    return elapsed is not None and elapsed < 2_000


def validate_enquiry(payload: dict) -> tuple[dict, dict]:
    """Validate and normalize a website enquiry."""
    name = clean_text(payload.get("name"), 120)
    email = clean_text(payload.get("email"), 160).lower()
    project_type = clean_text(payload.get("projectType"), 120)
    project_stage = clean_text(payload.get("projectStage"), 120)
    notes = clean_text(payload.get("notes"), MAX_NOTES_CHARS)
    source = clean_text(payload.get("source"), 80) or "website"
    approx_sqft = normalize_optional_int(payload.get("approxSqft"), 0, 200_000)

    errors: dict[str, str] = {}
    if len(name) < 2:
        errors["name"] = "Enter the name we should use when we reply."
    if not EMAIL_RE.match(email):
        errors["email"] = "Enter an email address we can reach you at."
    if not project_type:
        errors["projectType"] = "Choose the kind of project you're planning."

    entry = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "name": name,
        "email": email,
        "project_type": project_type,
        "project_stage": project_stage,
        "approx_sqft": approx_sqft,
        "notes": notes,
        "source": source,
    }
    return entry, errors


# --------------------------------------------------------------------- storage


def get_data_dir() -> Path:
    configured = os.environ.get("CONSTRUCTX_DATA_DIR")
    return Path(configured).expanduser() if configured else PROJECT_ROOT / "data"


def save_enquiry(entry: dict) -> None:
    """Append a private enquiry record as JSON Lines, one writer at a time."""
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    target = data_dir / "enquiries.jsonl"
    line = json.dumps(entry, ensure_ascii=False) + "\n"
    with _write_lock:
        with target.open("a", encoding="utf-8") as handle:
            handle.write(line)
            handle.flush()
            os.fsync(handle.fileno())
    try:
        target.chmod(0o600)
    except OSError:  # pragma: no cover - platform dependent
        pass


# ----------------------------------------------------------------------- email


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def format_enquiry_email(entry: dict) -> str:
    scope = (
        f"{entry.get('approx_sqft'):,} sq ft"
        if isinstance(entry.get("approx_sqft"), int)
        else "Not provided"
    )
    return "\n".join(
        [
            "New ConstructX website enquiry",
            "",
            f"Name: {entry.get('name', '')}",
            f"Email: {entry.get('email', '')}",
            f"Project type: {entry.get('project_type', '')}",
            f"Project stage: {entry.get('project_stage') or 'Not provided'}",
            f"Approx. scope: {scope}",
            f"Source: {entry.get('source', 'website')}",
            f"Submitted: {entry.get('created_at', '')}",
            "",
            "Notes:",
            entry.get("notes") or "No notes provided.",
        ]
    )


def send_enquiry_email(entry: dict) -> bool:
    """Email an enquiry to the ConstructX team when SMTP is configured."""
    recipient = os.environ.get("CONSTRUCTX_TEAM_EMAIL")
    smtp_host = os.environ.get("SMTP_HOST")
    if not recipient or not smtp_host:
        return False

    sender = (
        os.environ.get("SMTP_FROM_EMAIL")
        or os.environ.get("SMTP_USERNAME")
        or recipient
    )
    try:
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    except ValueError:
        smtp_port = 587

    message = EmailMessage()
    message["Subject"] = f"New ConstructX enquiry: {entry.get('project_type', 'Project')}"
    message["From"] = sender
    message["To"] = recipient
    reply_to = entry.get("email", "")
    if EMAIL_RE.match(reply_to or ""):
        message["Reply-To"] = reply_to
    message.set_content(format_enquiry_email(entry))

    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    use_ssl = env_flag("SMTP_USE_SSL", False)
    use_tls = env_flag("SMTP_USE_TLS", True)
    context = ssl.create_default_context()

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15, context=context) as smtp:
                if username and password:
                    smtp.login(username, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
                if use_tls:
                    smtp.starttls(context=context)
                if username and password:
                    smtp.login(username, password)
                smtp.send_message(message)
    except Exception as exc:  # pragma: no cover - depends on deployment SMTP
        # Log the failure class, never the enquiry contents.
        print(f"Could not email ConstructX enquiry: {type(exc).__name__}")
        return False
    return True


# ------------------------------------------------------------------- lifecycle


def get_port() -> int:
    value = os.environ.get("PORT")
    if not value:
        return DEFAULT_PORT
    try:
        return int(value)
    except ValueError:
        return DEFAULT_PORT


def get_host() -> str:
    """Bind locally by default; set HOST=0.0.0.0 to expose the dev server."""
    return os.environ.get("HOST", DEFAULT_HOST)


def build_server(host: str | None = None, port: int | None = None) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(
        (host or get_host(), port if port is not None else get_port()),
        ConstructXRequestHandler,
    )
    server.daemon_threads = True
    return server


def main() -> None:
    server = build_server()
    host, port = server.server_address[:2]
    print(f"ConstructX is running at http://127.0.0.1:{port}")
    if host not in {"127.0.0.1", "localhost"}:
        print(f"Bound to {host}:{port} — reachable from other machines on this network.")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping ConstructX.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
