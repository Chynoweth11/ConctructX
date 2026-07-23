"""Tests for the ConstructX server.

Run with:

    python -m unittest discover -s tests -v
"""

from __future__ import annotations

import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.client import HTTPConnection
from pathlib import Path
from typing import NamedTuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import app as server  # noqa: E402


class Response(NamedTuple):
    """A fully-read HTTP response, so the underlying socket is already closed."""

    status: int
    headers: dict
    body: bytes

    def header(self, name: str) -> str | None:
        for key, value in self.headers.items():
            if key.lower() == name.lower():
                return value
        return None

    def json(self) -> dict:
        return json.loads(self.body)


class CleanTextTests(unittest.TestCase):
    def test_collapses_whitespace(self):
        self.assertEqual(server.clean_text("  a   b \n c ", 100), "a b c")

    def test_strips_newlines_to_block_header_injection(self):
        hostile = "victim@example.com\nBcc: attacker@evil.test"
        cleaned = server.clean_text(hostile, 200)
        self.assertNotIn("\n", cleaned)
        self.assertNotIn("\r", cleaned)

    def test_truncates(self):
        self.assertEqual(server.clean_text("x" * 500, 10), "x" * 10)

    def test_handles_none(self):
        self.assertEqual(server.clean_text(None, 10), "")


class ValidationTests(unittest.TestCase):
    def valid_payload(self, **overrides):
        payload = {
            "name": "Owen",
            "email": "owen@example.com",
            "projectType": "Residential",
            "projectStage": "Planning / budgeting",
            "approxSqft": 6000,
            "notes": "Mountain residence, early planning.",
        }
        payload.update(overrides)
        return payload

    def test_accepts_a_complete_enquiry(self):
        entry, errors = server.validate_enquiry(self.valid_payload())
        self.assertEqual(errors, {})
        self.assertEqual(entry["name"], "Owen")
        self.assertEqual(entry["approx_sqft"], 6000)
        self.assertEqual(entry["source"], "website")

    def test_rejects_missing_name(self):
        _, errors = server.validate_enquiry(self.valid_payload(name=" "))
        self.assertIn("name", errors)

    def test_rejects_malformed_email(self):
        for bad in ["nope", "a@b", "a@b.", "@example.com", "a b@example.com"]:
            with self.subTest(email=bad):
                _, errors = server.validate_enquiry(self.valid_payload(email=bad))
                self.assertIn("email", errors)

    def test_rejects_missing_project_type(self):
        _, errors = server.validate_enquiry(self.valid_payload(projectType=""))
        self.assertIn("projectType", errors)

    def test_lowercases_email(self):
        entry, _ = server.validate_enquiry(self.valid_payload(email="Owen@Example.COM"))
        self.assertEqual(entry["email"], "owen@example.com")

    def test_clamps_absurd_square_footage(self):
        entry, _ = server.validate_enquiry(self.valid_payload(approxSqft=10**9))
        self.assertEqual(entry["approx_sqft"], 200_000)

    def test_truncates_long_notes_instead_of_failing(self):
        entry, errors = server.validate_enquiry(self.valid_payload(notes="n" * 5000))
        self.assertEqual(errors, {})
        self.assertEqual(len(entry["notes"]), server.MAX_NOTES_CHARS)


class SpamTests(unittest.TestCase):
    def test_filled_honeypot_is_spam(self):
        self.assertTrue(server.is_spam({"company": "Acme SEO"}))

    def test_instant_submission_is_spam(self):
        self.assertTrue(server.is_spam({"elapsedMs": 120}))

    def test_ordinary_submission_is_not_spam(self):
        self.assertFalse(server.is_spam({"company": "", "elapsedMs": 45_000}))

    def test_missing_timing_is_not_spam(self):
        self.assertFalse(server.is_spam({}))


class RateLimiterTests(unittest.TestCase):
    def test_allows_up_to_the_limit(self):
        limiter = server.RateLimiter(3, 60)
        self.assertTrue(all(limiter.allow("1.2.3.4", now=t) for t in (0, 1, 2)))

    def test_blocks_past_the_limit(self):
        limiter = server.RateLimiter(3, 60)
        for t in (0, 1, 2):
            limiter.allow("1.2.3.4", now=t)
        self.assertFalse(limiter.allow("1.2.3.4", now=3))

    def test_window_slides(self):
        limiter = server.RateLimiter(2, 60)
        limiter.allow("1.2.3.4", now=0)
        limiter.allow("1.2.3.4", now=1)
        self.assertFalse(limiter.allow("1.2.3.4", now=10))
        self.assertTrue(limiter.allow("1.2.3.4", now=120))

    def test_clients_are_isolated(self):
        limiter = server.RateLimiter(1, 60)
        self.assertTrue(limiter.allow("a", now=0))
        self.assertFalse(limiter.allow("a", now=1))
        self.assertTrue(limiter.allow("b", now=1))

    def test_is_thread_safe(self):
        limiter = server.RateLimiter(50, 60)
        granted: list[bool] = []
        lock = threading.Lock()

        def hammer():
            for _ in range(20):
                ok = limiter.allow("shared")
                with lock:
                    granted.append(ok)

        threads = [threading.Thread(target=hammer) for _ in range(10)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(sum(granted), 50)


class StorageTests(unittest.TestCase):
    def test_writes_one_json_line_per_enquiry(self):
        with tempfile.TemporaryDirectory() as tmp:
            server.os.environ["CONSTRUCTX_DATA_DIR"] = tmp
            try:
                for i in range(3):
                    server.save_enquiry({"name": f"person-{i}"})
                lines = (Path(tmp) / "enquiries.jsonl").read_text().splitlines()
            finally:
                del server.os.environ["CONSTRUCTX_DATA_DIR"]

        self.assertEqual(len(lines), 3)
        self.assertEqual(json.loads(lines[1])["name"], "person-1")

    def test_concurrent_writes_do_not_interleave(self):
        with tempfile.TemporaryDirectory() as tmp:
            server.os.environ["CONSTRUCTX_DATA_DIR"] = tmp
            try:
                def write(i: int):
                    server.save_enquiry({"name": "x" * 500, "i": i})

                threads = [threading.Thread(target=write, args=(i,)) for i in range(24)]
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join()
                lines = (Path(tmp) / "enquiries.jsonl").read_text().splitlines()
            finally:
                del server.os.environ["CONSTRUCTX_DATA_DIR"]

        self.assertEqual(len(lines), 24)
        # Every line must parse: a torn write would raise here.
        indexes = sorted(json.loads(line)["i"] for line in lines)
        self.assertEqual(indexes, list(range(24)))


class EmailFormattingTests(unittest.TestCase):
    def test_includes_the_key_fields(self):
        body = server.format_enquiry_email(
            {
                "name": "Owen",
                "email": "owen@example.com",
                "project_type": "Residential",
                "approx_sqft": 6000,
                "notes": "Notes here.",
            }
        )
        self.assertIn("Owen", body)
        self.assertIn("6,000 sq ft", body)
        self.assertIn("Notes here.", body)

    def test_handles_missing_scope(self):
        body = server.format_enquiry_email({"name": "Owen", "approx_sqft": None})
        self.assertIn("Not provided", body)


class HttpTests(unittest.TestCase):
    """End-to-end checks against a real server instance on a random port."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        server.os.environ["CONSTRUCTX_DATA_DIR"] = cls.tmp.name
        server.os.environ["CONSTRUCTX_QUIET"] = "1"
        cls.server = server.build_server("127.0.0.1", 0)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls.tmp.cleanup()
        server.os.environ.pop("CONSTRUCTX_DATA_DIR", None)
        server.os.environ.pop("CONSTRUCTX_QUIET", None)

    def setUp(self):
        server.enquiry_limiter.reset()

    def url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.port}{path}"

    def send(self, request: urllib.request.Request) -> Response:
        """Perform a request and drain it, so no socket is left open."""
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return Response(response.status, dict(response.headers), response.read())
        except urllib.error.HTTPError as error:
            with error:
                return Response(error.code, dict(error.headers), error.read())

    def get(self, path: str, headers: dict | None = None) -> Response:
        return self.send(urllib.request.Request(self.url(path), headers=headers or {}))

    def post(self, path: str, payload: dict, headers: dict | None = None) -> Response:
        base = {"Content-Type": "application/json"}
        base.update(headers or {})
        request = urllib.request.Request(
            self.url(path), data=json.dumps(payload).encode("utf-8"), headers=base
        )
        return self.send(request)

    # -- static ------------------------------------------------------------

    def test_serves_the_home_page(self):
        response = self.get("/")
        self.assertEqual(response.status, 200)
        self.assertIn("text/html", response.header("Content-Type"))

    def test_sends_security_headers(self):
        response = self.get("/")
        for header in server.SECURITY_HEADERS:
            with self.subTest(header=header):
                self.assertIsNotNone(response.header(header))
        self.assertIn("script-src 'self'", response.header("Content-Security-Policy"))

    def test_assets_are_cached_hard_and_html_is_not(self):
        asset = self.get("/assets/css/styles.css")
        self.assertIn("immutable", asset.header("Cache-Control"))
        page = self.get("/")
        self.assertEqual(page.header("Cache-Control"), "no-cache")

    def test_compresses_text_when_asked(self):
        response = self.get("/assets/css/styles.css", {"Accept-Encoding": "gzip"})
        self.assertEqual(response.header("Content-Encoding"), "gzip")
        self.assertEqual(response.header("Vary"), "Accept-Encoding")

    def test_skips_compression_when_not_offered(self):
        response = self.get("/assets/css/styles.css", {"Accept-Encoding": "identity"})
        self.assertIsNone(response.header("Content-Encoding"))

    def test_serves_a_404_page_for_unknown_paths(self):
        response = self.get("/does-not-exist")
        self.assertEqual(response.status, 404)

    def test_refuses_directory_listings(self):
        response = self.get("/assets/images/")
        self.assertEqual(response.status, 404)

    def test_blocks_path_traversal(self):
        connection = HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request("GET", "/../../etc/passwd")
        response = connection.getresponse()
        body = response.read()
        connection.close()
        self.assertNotIn(b"root:", body)

    def test_health_endpoint(self):
        response = self.get("/api/health")
        self.assertEqual(response.status, 200)
        self.assertTrue(response.json()["ok"])

    # -- enquiries ---------------------------------------------------------

    def valid_enquiry(self, **overrides):
        payload = {
            "name": "Owen",
            "email": "owen@example.com",
            "projectType": "Residential",
            "projectStage": "Planning / budgeting",
            "approxSqft": 6000,
            "notes": "Mountain residence.",
            "company": "",
            "elapsedMs": 30_000,
        }
        payload.update(overrides)
        return payload

    def test_accepts_a_valid_enquiry(self):
        response = self.post(
            "/api/enquiries", self.valid_enquiry(), {"X-Forwarded-For": "10.0.0.1"}
        )
        self.assertEqual(response.status, 201)
        self.assertTrue(response.json()["ok"])

    def test_rejects_an_invalid_enquiry(self):
        response = self.post(
            "/api/enquiries",
            self.valid_enquiry(email="nope"),
            {"X-Forwarded-For": "10.0.0.2"},
        )
        self.assertEqual(response.status, 400)
        self.assertIn("email", response.json()["errors"])

    def test_rejects_oversized_bodies(self):
        response = self.post(
            "/api/enquiries",
            self.valid_enquiry(notes="x" * 50_000),
            {"X-Forwarded-For": "10.0.0.3"},
        )
        self.assertEqual(response.status, 413)

    def test_swallows_honeypot_submissions_without_storing_them(self):
        before = self.stored_count()
        response = self.post(
            "/api/enquiries",
            self.valid_enquiry(company="Acme SEO"),
            {"X-Forwarded-For": "10.0.0.4"},
        )
        self.assertEqual(response.status, 201)
        self.assertEqual(self.stored_count(), before)

    def test_rate_limits_repeated_submissions(self):
        headers = {"X-Forwarded-For": "10.0.0.99"}
        statuses = [
            self.post("/api/enquiries", self.valid_enquiry(), headers).status
            for _ in range(server.RATE_LIMIT_MAX + 2)
        ]
        self.assertEqual(statuses[: server.RATE_LIMIT_MAX], [201] * server.RATE_LIMIT_MAX)
        self.assertEqual(statuses[server.RATE_LIMIT_MAX :], [429, 429])

    def test_unknown_api_routes_return_json_404(self):
        response = self.post("/api/nope", {}, {"X-Forwarded-For": "10.0.0.5"})
        self.assertEqual(response.status, 404)
        self.assertFalse(response.json()["ok"])

    def stored_count(self) -> int:
        path = Path(self.tmp.name) / "enquiries.jsonl"
        if not path.is_file():
            return 0
        return len(path.read_text().splitlines())


if __name__ == "__main__":
    unittest.main()
