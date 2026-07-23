"""Browser smoke test for the ConstructX page.

Type-checking proves the source compiles; it does not prove the page runs. This
loads the real site in Chromium and asserts on what actually happens: console
errors, failed requests, CSP violations, whether the hero scene builds, whether
the render loop parks when it should, and whether the page survives with
JavaScript disabled.

Run with the site already served:

    PORT=8200 python3 app.py &
    python3 tests/browser_smoke.py            # defaults to 127.0.0.1:8200
"""

from __future__ import annotations

import os
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sys.exit("Playwright is required: pip install playwright && playwright install chromium")

BASE = os.environ.get("CONSTRUCTX_URL", "http://127.0.0.1:8200")

failures: list[str] = []
notes: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{f' — {detail}' if detail else ''}")
    if not ok:
        failures.append(f"{label}{f': {detail}' if detail else ''}")


def collect(page):
    """Attach listeners that record anything the browser complains about."""
    errors: list[str] = []
    failed: list[str] = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on(
        "requestfailed",
        lambda r: failed.append(f"{r.url} — {r.failure}"),
    )
    page.on(
        "response",
        lambda r: failed.append(f"{r.url} — HTTP {r.status}") if r.status >= 400 else None,
    )
    return errors, failed


def main() -> int:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])

        # ------------------------------------------------ desktop, JS enabled
        print("\n== Desktop, scripting on ==")
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors, failed = collect(page)
        page.goto(BASE, wait_until="networkidle", timeout=30000)

        check("page title", "ConstructX" in page.title(), page.title())
        check("no console errors", not errors, "; ".join(errors[:3]))
        check("no failed requests", not failed, "; ".join(failed[:3]))

        check(
            "boot.js swapped no-js for js",
            page.evaluate("document.documentElement.classList.contains('js')"),
        )
        check(
            "web fonts promoted to all media",
            page.evaluate("document.getElementById('webfonts')?.media") == "all",
        )
        check("main landmark present", page.locator("main#main").count() == 1)
        check("exactly one h1", page.locator("h1").count() == 1)

        # Reveal animations must actually resolve, not leave content invisible.
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1200)
        hidden = page.evaluate(
            "Array.from(document.querySelectorAll('.reveal'))"
            ".filter(el => getComputedStyle(el).opacity === '0').length"
        )
        check("all reveals resolved", hidden == 0, f"{hidden} still at opacity 0")

        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(2500)

        # --------------------------------------------------------- hero 3D
        three_loaded = page.evaluate("typeof window.THREE !== 'undefined'")
        scene_loaded = page.evaluate("typeof window.ConstructXHeroScene === 'function'")
        canvas = page.locator("#hero3d canvas").count()
        check("Three.js lazy-loaded on desktop", three_loaded)
        check("hero-scene.js lazy-loaded", scene_loaded)
        check("WebGL canvas mounted", canvas == 1, f"{canvas} canvases")
        check(
            "hero marked interactive",
            page.evaluate("document.getElementById('heroMedia').classList.contains('is-interactive')"),
        )
        check(
            "rotate controls exposed",
            page.evaluate("document.getElementById('heroControls').classList.contains('is-available')"),
        )

        # Rotation must respond to the buttons.
        before = page.evaluate("document.querySelector('#hero3d canvas').toDataURL().length")
        page.click("#heroSpinRight")
        page.wait_for_timeout(900)
        after = page.evaluate("document.querySelector('#hero3d canvas').toDataURL().length")
        check("spin button changes the render", before != after)

        # --------------------------------------------------- form behaviour
        page.click("a[href='#contact']")
        page.wait_for_timeout(800)
        page.click("#ctaSend")
        page.wait_for_timeout(400)
        check(
            "empty submit flags invalid fields",
            page.locator("#cName[aria-invalid='true']").count() == 1,
        )
        check("error text rendered", (page.text_content("#errName") or "").strip() != "")

        page.fill("#cName", "Owen")
        page.fill("#cEmail", "owen@example.com")
        page.wait_for_timeout(200)
        check(
            "typing clears the error",
            page.locator("#cName[aria-invalid='true']").count() == 0,
        )

        page.fill("#cNotes", "Browser smoke test submission.")
        page.click("#ctaSend")
        page.wait_for_selector(".form-status.ok", timeout=10000)
        check("valid submit succeeds", page.locator(".form-status.ok").count() == 1)

        # ------------------------------------------------- keyboard + a11y
        page.goto(BASE, wait_until="load")
        page.wait_for_timeout(500)
        page.keyboard.press("Tab")
        check(
            "first tab reaches skip link",
            page.evaluate("document.activeElement?.classList.contains('skip')"),
        )

        markers = page.locator("#mapCanvas button.marker")
        check("map markers are buttons", markers.count() == 7, f"{markers.count()} found")
        markers.nth(3).focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
        check(
            "marker keyboard-selectable",
            page.locator("#mapCanvas button.marker[aria-current='true']").count() == 1,
        )

        page.close()

        # ----------------------------------------------- render loop parks
        print("\n== Render loop lifecycle ==")
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(BASE, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)
        page.evaluate("""
          window.__frames = 0;
          const raf = window.requestAnimationFrame;
          window.requestAnimationFrame = (cb) => { window.__frames++; return raf(cb); };
        """)
        page.wait_for_timeout(1000)
        onscreen = page.evaluate("window.__frames")
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1200)
        page.evaluate("window.__frames = 0")
        page.wait_for_timeout(1500)
        offscreen = page.evaluate("window.__frames")
        check(
            "loop stops when hero is off screen",
            offscreen == 0,
            f"{offscreen} frames while scrolled away (was {onscreen} on screen)",
        )
        page.close()

        # ------------------------------------------------- mobile: no WebGL
        print("\n== Mobile (390px) ==")
        page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        errors, failed = collect(page)
        page.goto(BASE, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2500)
        check("no console errors", not errors, "; ".join(errors[:3]))
        check(
            "Three.js NOT downloaded on mobile",
            page.evaluate("typeof window.THREE === 'undefined'"),
        )
        check(
            "hero-scene NOT downloaded on mobile",
            page.evaluate("typeof window.ConstructXHeroScene === 'undefined'"),
        )
        check("hero still shows the photo", page.locator("#heroImg").is_visible())
        check("no horizontal overflow", page.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth + 1"
        ), f"scrollWidth={page.evaluate('document.documentElement.scrollWidth')}")

        page.click("#menuBtn")
        page.wait_for_timeout(400)
        check("menu opens", page.locator("#mobileMenu.open").is_visible())
        check(
            "focus moves into the menu",
            page.evaluate("document.getElementById('mobileMenu').contains(document.activeElement)"),
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        check("Escape closes the menu", page.locator("#mobileMenu.open").count() == 0)
        page.close()

        # ------------------------------------------------- scripting off
        print("\n== Scripting disabled ==")
        context = browser.new_context(java_script_enabled=False, viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(BASE, wait_until="load", timeout=20000)
        check("headline visible", page.locator("h1").is_visible())
        invisible = page.evaluate_handle  # not usable without JS; check via bounding boxes
        boxes_ok = all(
            page.locator(sel).first.bounding_box() is not None
            for sel in ("h1", ".hero-sub", "#work h3", ".f-media img")
        )
        check("hero, copy, and portfolio all render", boxes_ok)
        context.close()

        # -------------------------------------------------- reduced motion
        print("\n== Reduced motion ==")
        context = browser.new_context(
            reduced_motion="reduce", viewport={"width": 1440, "height": 900}
        )
        page = context.new_page()
        page.goto(BASE, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2500)
        check(
            "Three.js NOT downloaded under reduced motion",
            page.evaluate("typeof window.THREE === 'undefined'"),
        )
        check("content still visible", page.locator("h1").is_visible())
        context.close()

        browser.close()

    print("\n" + "=" * 60)
    if failures:
        print(f"{len(failures)} FAILURE(S):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("All browser checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
