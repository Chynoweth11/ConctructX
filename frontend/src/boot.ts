/**
 * Runs synchronously in <head>, before first paint.
 *
 * Two jobs, both of which have to happen before anything renders:
 *
 * 1. Swap `no-js` for `js` on <html>. Every entrance animation and scroll
 *    reveal in the stylesheet is scoped to `.js`, so a browser with scripting
 *    off renders the page fully visible instead of a blank column of
 *    `opacity: 0` sections.
 * 2. Promote the web font stylesheet from `media="print"` to `media="all"`.
 *    Shipping it as print media keeps it off the critical path; flipping it
 *    here starts the fetch without ever blocking first paint.
 *
 * Keep this file small — it is the only render-blocking script on the page.
 */
(() => {
  const root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  const fonts = document.getElementById("webfonts") as HTMLLinkElement | null;
  if (fonts) {
    // Wait a tick so the swap does not contend with the critical stylesheet.
    const promote = () => {
      fonts.media = "all";
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", promote, { once: true });
    } else {
      promote();
    }
  }
})();
