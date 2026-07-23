"""ConstructX Python web server.

This keeps the site runnable as a Python app without requiring Node, npm, or
third-party Python packages. It serves the organized static website files from
this repository.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
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
        self.send_json(
            201,
            {
                "ok": True,
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
    notes = clean_text(payload.get("notes"), 1200)
    source = clean_text(payload.get("source"), 80) or "website"

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
        "notes": notes,
        "source": source,
    }
    return entry, errors


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
