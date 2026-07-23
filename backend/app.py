"""ConstructX Python web server.

This keeps the site runnable as a Python app without requiring Node, npm, or
third-party Python packages. It serves the organized static website files from
this repository.
"""

from __future__ import annotations

import json
import os
import re
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PORT = 8000
DEFAULT_HOST = "0.0.0.0"
MAX_ENQUIRY_BYTES = 12_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ConstructXRequestHandler(SimpleHTTPRequestHandler):
    """Serve ConstructX static files with an index fallback."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def translate_path(self, path: str) -> str:
        """Serve `/` from index.html while preserving normal static paths."""
        translated = Path(super().translate_path(path))
        if path in {"", "/"}:
            return str(PROJECT_ROOT / "index.html")
        return str(translated)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, status: int, payload: dict) -> None:
        """Return a compact JSON response."""
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        """Serve static files and a lightweight health endpoint."""
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True, "service": "ConstructX"})
            return
        super().do_GET()

    def do_POST(self) -> None:
        """Handle private project enquiries from the website form."""
        path = urlparse(self.path).path
        if path != "/api/enquiries":
            self.send_json(404, {"ok": False, "error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"ok": False, "error": "Invalid request length"})
            return

        if length <= 0:
            self.send_json(400, {"ok": False, "error": "Request body is required"})
            return
        if length > MAX_ENQUIRY_BYTES:
            self.send_json(413, {"ok": False, "error": "Enquiry is too large"})
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"ok": False, "error": "Invalid JSON"})
            return

        entry, errors = validate_enquiry(payload)
        if errors:
            self.send_json(400, {"ok": False, "errors": errors})
            return

        save_enquiry(entry)
        email_sent = send_enquiry_email(entry)
        self.send_json(
            201,
            {
                "ok": True,
                "emailSent": email_sent,
                "message": "Enquiry received. ConstructX will review the project details and follow up with next steps.",
            },
        )


def clean_text(value: object, max_length: int) -> str:
    """Normalize user-submitted text without preserving excess whitespace."""
    if value is None:
        return ""
    return " ".join(str(value).strip().split())[:max_length]


def validate_enquiry(payload: object) -> tuple[dict, dict]:
    """Validate and normalize a website enquiry."""
    if not isinstance(payload, dict):
        return {}, {"form": "Invalid enquiry payload"}

    name = clean_text(payload.get("name"), 120)
    email = clean_text(payload.get("email"), 160).lower()
    project_type = clean_text(payload.get("projectType"), 120)
    project_stage = clean_text(payload.get("projectStage"), 120)
    notes = clean_text(payload.get("notes"), 1200)
    source = clean_text(payload.get("source"), 80) or "website"
    approx_sqft = normalize_optional_int(payload.get("approxSqft"), 0, 200_000)

    errors: dict[str, str] = {}
    if len(name) < 2:
        errors["name"] = "Please enter your name."
    if not EMAIL_RE.match(email):
        errors["email"] = "Please enter a valid email address."
    if not project_type:
        errors["projectType"] = "Please choose a project type."
    if len(notes) > 1200:
        errors["notes"] = "Please keep project notes under 1,200 characters."

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


def normalize_optional_int(value: object, minimum: int, maximum: int) -> int | None:
    """Return an optional integer safely bounded for form metadata."""
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return max(minimum, min(maximum, parsed))


def get_data_dir() -> Path:
    """Return the local private data directory for enquiry storage."""
    configured = os.environ.get("CONSTRUCTX_DATA_DIR")
    return Path(configured).expanduser() if configured else PROJECT_ROOT / "data"


def save_enquiry(entry: dict) -> None:
    """Append a private enquiry record as JSON Lines."""
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    target = data_dir / "enquiries.jsonl"
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def env_flag(name: str, default: bool = False) -> bool:
    """Read a simple boolean environment flag."""
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def format_enquiry_email(entry: dict) -> str:
    """Create a concise internal email body for the ConstructX team."""
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
    message["Reply-To"] = entry.get("email", "")
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
        print(f"Could not email ConstructX enquiry: {exc}")
        return False
    return True


def get_port() -> int:
    """Read PORT from the environment, falling back to 8000."""
    value = os.environ.get("PORT")
    if not value:
        return DEFAULT_PORT
    try:
        return int(value)
    except ValueError:
        return DEFAULT_PORT


def get_host() -> str:
    """Read HOST from the environment, falling back to all interfaces."""
    return os.environ.get("HOST", DEFAULT_HOST)


def main() -> None:
    host = get_host()
    port = get_port()
    server = ThreadingHTTPServer((host, port), ConstructXRequestHandler)
    print(f"ConstructX is running at http://127.0.0.1:{port}")
    if host not in {"127.0.0.1", "localhost"}:
        print(f"Server bound to {host}:{port} for Codespaces/port forwarding.")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping ConstructX.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
