"use strict";
(() => {
    const root = document.documentElement;
    root.classList.remove("no-js");
    root.classList.add("js");
    const fonts = document.getElementById("webfonts");
    if (fonts) {
        const promote = () => {
            fonts.media = "all";
        };
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", promote, { once: true });
        }
        else {
            promote();
        }
    }
})();
//# sourceMappingURL=boot.js.map