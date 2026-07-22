"""ConstructX Python web server.

This keeps the site runnable as a Python app without requiring Node, npm, or
third-party Python packages. It serves the organized static website files from
this repository.
"""

from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PORT = 8000
DEFAULT_HOST = "0.0.0.0"


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
