"use strict";
(() => {
    const THREE_SRC = "assets/vendor/three.min.js";
    const SCENE_SRC = "assets/js/hero-scene.js";
    const mount = document.getElementById("hero3d");
    const media = document.getElementById("heroMedia");
    if (!mount || !media)
        return;
    const els = {
        mount,
        media,
        controls: document.getElementById("heroControls"),
        spinLeft: document.getElementById("heroSpinLeft"),
        spinRight: document.getElementById("heroSpinRight"),
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function assessDevice() {
        if (reduceMotion)
            return null;
        if (window.matchMedia("(max-width: 680px)").matches)
            return null;
        const connection = navigator.connection;
        if (connection?.saveData)
            return null;
        if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType))
            return null;
        let canvas;
        try {
            canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl2") ||
                canvas.getContext("webgl") ||
                canvas.getContext("experimental-webgl");
            if (!gl)
                return null;
        }
        catch {
            return null;
        }
        const memory = navigator.deviceMemory ?? 8;
        const cores = navigator.hardwareConcurrency ?? 8;
        const modest = memory <= 4 || cores <= 4;
        return {
            pixelRatio: Math.min(window.devicePixelRatio || 1, modest ? 1 : 2),
            shadowMapSize: modest ? 1024 : 2048,
            shadows: true,
        };
    }
    let started = false;
    const scriptCache = new Map();
    function loadScript(src) {
        const cached = scriptCache.get(src);
        if (cached)
            return cached;
        const pending = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.addEventListener("load", () => resolve(), { once: true });
            script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), {
                once: true,
            });
            document.head.append(script);
        });
        scriptCache.set(src, pending);
        return pending;
    }
    async function loadDependencies() {
        await Promise.all([
            window.THREE ? Promise.resolve() : loadScript(THREE_SRC),
            window.ConstructXHeroScene ? Promise.resolve() : loadScript(SCENE_SRC),
        ]);
        const T = window.THREE;
        const build = window.ConstructXHeroScene;
        if (!T)
            throw new Error("Three.js loaded but exposed no global");
        if (!build)
            throw new Error("Hero scene loaded but exposed no builder");
        return { T, build };
    }
    function start() {
        if (started)
            return;
        started = true;
        const quality = assessDevice();
        if (!quality)
            return;
        loadDependencies()
            .then(({ T, build }) => buildHero(els, T, build, quality))
            .catch((error) => {
            console.warn("ConstructX hero fell back to the still image.", error);
        });
    }
    if (typeof window.IntersectionObserver === "function") {
        const gate = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                gate.disconnect();
                start();
            }
        }, { rootMargin: "200px" });
        gate.observe(media);
    }
    else {
        window.addEventListener("load", start, { once: true });
    }
    function buildHero(el, T, build, quality) {
        const { mount, media, controls, spinLeft, spinRight } = el;
        let width = mount.clientWidth || 1200;
        let height = mount.clientHeight || 760;
        const renderer = new T.WebGLRenderer({
            antialias: quality.pixelRatio <= 1.5,
            alpha: true,
            powerPreference: "high-performance",
        });
        renderer.setPixelRatio(quality.pixelRatio);
        renderer.setSize(width, height, false);
        renderer.shadowMap.enabled = quality.shadows;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.physicallyCorrectLights = true;
        if (T.SRGBColorSpace)
            renderer.outputColorSpace = T.SRGBColorSpace;
        else if (T.sRGBEncoding)
            renderer.outputEncoding = T.sRGBEncoding;
        if (T.ACESFilmicToneMapping)
            renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.96;
        mount.append(renderer.domElement);
        const scene = new T.Scene();
        const residence = new T.Group();
        residence.position.set(0.18, -0.04, 0.2);
        residence.scale.set(0.9, 0.9, 0.9);
        scene.add(residence);
        build(T, renderer, scene, residence);
        scene.add(new T.HemisphereLight(0xc5d2ee, 0x2b211a, 0.42));
        const sun = new T.DirectionalLight(0xffbf82, 1.82);
        sun.position.set(7.5, 7.4, 7.8);
        sun.castShadow = quality.shadows;
        sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 62;
        sun.shadow.camera.left = -11;
        sun.shadow.camera.right = 11;
        sun.shadow.camera.top = 11;
        sun.shadow.camera.bottom = -11;
        sun.shadow.bias = -0.00035;
        scene.add(sun);
        const fill = new T.DirectionalLight(0x9eb7e6, 0.48);
        fill.position.set(-6, 3.8, -5);
        scene.add(fill);
        const interiorBoost = new T.PointLight(0xffb76d, 1.65, 10, 2);
        interiorBoost.position.set(0.4, 2.1, 2.15);
        residence.add(interiorBoost);
        const camera = new T.PerspectiveCamera(31, width / height, 0.1, 250);
        camera.position.set(5.85, 2.65, 8.85);
        camera.lookAt(new T.Vector3(0, 2.05, 0.98));
        let targetRotation = -0.24;
        let rotation = targetRotation;
        let dragging = false;
        let pointerX = 0;
        let interacted = false;
        residence.rotation.y = rotation;
        media.classList.add("is-interactive");
        controls?.classList.add("is-available");
        const nudge = (radians) => {
            interacted = true;
            targetRotation += radians;
            requestFrame();
        };
        const onPointerDown = (event) => {
            dragging = true;
            interacted = true;
            pointerX = event.clientX;
            media.classList.add("dragging");
            mount.setPointerCapture?.(event.pointerId);
            if (event.cancelable && event.pointerType !== "touch")
                event.preventDefault();
            requestFrame();
        };
        const onPointerMove = (event) => {
            if (!dragging)
                return;
            targetRotation += (event.clientX - pointerX) * 0.009;
            pointerX = event.clientX;
            requestFrame();
        };
        const onPointerUp = (event) => {
            if (!dragging)
                return;
            dragging = false;
            media.classList.remove("dragging");
            mount.releasePointerCapture?.(event.pointerId);
        };
        mount.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        spinLeft?.addEventListener("click", () => nudge(-0.6));
        spinRight?.addEventListener("click", () => nudge(0.6));
        controls?.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft") {
                nudge(-0.3);
                event.preventDefault();
            }
            else if (event.key === "ArrowRight") {
                nudge(0.3);
                event.preventDefault();
            }
        });
        let frame = 0;
        let onScreen = true;
        let pageVisible = !document.hidden;
        const settled = () => !dragging && interacted && Math.abs(targetRotation - rotation) < 0.0002;
        function renderOnce() {
            rotation += (targetRotation - rotation) * 0.075;
            residence.rotation.y = rotation;
            renderer.render(scene, camera);
        }
        function tick() {
            frame = 0;
            if (!onScreen || !pageVisible)
                return;
            if (!dragging && !interacted)
                targetRotation += 0.0018;
            renderOnce();
            if (!settled())
                requestFrame();
        }
        function requestFrame() {
            if (frame || !onScreen || !pageVisible)
                return;
            frame = requestAnimationFrame(tick);
        }
        function setActive(active) {
            onScreen = active;
            if (active)
                requestFrame();
            else if (frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
        }
        const visibility = new IntersectionObserver((entries) => setActive(entries.some((entry) => entry.isIntersecting)), { threshold: 0.01 });
        visibility.observe(media);
        const onVisibilityChange = () => {
            pageVisible = !document.hidden;
            if (pageVisible)
                requestFrame();
            else if (frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        let resizeTimer = 0;
        const applySize = () => {
            const w = mount.clientWidth || width;
            const h = mount.clientHeight || height;
            if (w === width && h === height)
                return;
            width = w;
            height = h;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
            requestFrame();
        };
        const onResize = () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(applySize, 150);
        };
        if (typeof window.ResizeObserver === "function") {
            new ResizeObserver(onResize).observe(mount);
        }
        else {
            window.addEventListener("resize", onResize, { passive: true });
        }
        const dispose = () => {
            if (frame)
                cancelAnimationFrame(frame);
            visibility.disconnect();
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
            scene.traverse((node) => {
                node.geometry?.dispose?.();
                const material = node.material;
                if (Array.isArray(material))
                    material.forEach((m) => m.dispose?.());
                else
                    material?.dispose?.();
            });
            renderer.dispose();
        };
        window.addEventListener("pagehide", dispose, { once: true });
        requestFrame();
    }
})();
//# sourceMappingURL=hero-3d.js.map