/**
 * ConstructX — interactive hero residence.
 *
 * The scene is an original real-time model (stone, timber, glass, snow, dusk
 * peaks) that the visitor can spin. Everything around that model exists to keep
 * it from costing more than it is worth:
 *
 * * Three.js is fetched only after the hero is confirmed visible and the device
 *   is judged capable — it is never on the critical path.
 * * The render loop stops when the hero scrolls out of view or the tab is
 *   hidden. The previous version ran a shadow-mapped scene at 60fps for the
 *   entire session, including while the visitor read the footer.
 * * Pixel ratio and shadow resolution scale down on weaker hardware.
 * * If anything fails, the still photo underneath is already painted, so the
 *   hero degrades to exactly what a no-WebGL visitor would have seen anyway.
 */

interface HeroQuality {
  pixelRatio: number;
  shadowMapSize: number;
  shadows: boolean;
}

/**
 * Three.js and the geometry module are plain globals loaded on demand, so they
 * are typed loosely here rather than pulled in as typed dependencies. Only this
 * boundary is untyped; everything below it is checked normally.
 *
 * These files compile as classic scripts, not ES modules, so `interface Window`
 * merges into the global `Window` directly — no `declare global` wrapper.
 */
type ThreeModule = any;
type BuildResidence = (
  T: ThreeModule,
  renderer: unknown,
  scene: unknown,
  residence: unknown,
) => void;

interface Window {
  THREE?: ThreeModule;
  ConstructXHeroScene?: BuildResidence;
}

(() => {
  const THREE_SRC = "assets/vendor/three.min.js";
  const SCENE_SRC = "assets/js/hero-scene.js";

  /** The elements the hero drives. Resolved once, then passed explicitly. */
  interface HeroElements {
    mount: HTMLElement;
    media: HTMLElement;
    controls: HTMLElement | null;
    spinLeft: HTMLElement | null;
    spinRight: HTMLElement | null;
  }

  const mount = document.getElementById("hero3d");
  const media = document.getElementById("heroMedia");
  if (!mount || !media) return;

  const els: HeroElements = {
    mount,
    media,
    controls: document.getElementById("heroControls"),
    spinLeft: document.getElementById("heroSpinLeft"),
    spinRight: document.getElementById("heroSpinRight"),
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Decide whether a real-time scene is appropriate on this device. */
  function assessDevice(): HeroQuality | null {
    if (reduceMotion) return null;

    // Small screens get the still: the model is not legible at that size and
    // the battery cost lands on the devices least able to absorb it.
    if (window.matchMedia("(max-width: 680px)").matches) return null;

    const connection = (navigator as any).connection;
    if (connection?.saveData) return null;
    if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return null;

    let canvas: HTMLCanvasElement;
    try {
      canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      if (!gl) return null;
    } catch {
      return null;
    }

    const memory = (navigator as any).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    const modest = memory <= 4 || cores <= 4;

    return {
      pixelRatio: Math.min(window.devicePixelRatio || 1, modest ? 1 : 2),
      shadowMapSize: modest ? 1024 : 2048,
      shadows: true,
    };
  }

  let started = false;

  /** Load a plain script once; repeat calls reuse the in-flight promise. */
  const scriptCache = new Map<string, Promise<void>>();

  function loadScript(src: string): Promise<void> {
    const cached = scriptCache.get(src);
    if (cached) return cached;

    const pending = new Promise<void>((resolve, reject) => {
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

  async function loadDependencies(): Promise<{ T: ThreeModule; build: BuildResidence }> {
    // Both are independent downloads, so fetch them concurrently.
    await Promise.all([
      window.THREE ? Promise.resolve() : loadScript(THREE_SRC),
      window.ConstructXHeroScene ? Promise.resolve() : loadScript(SCENE_SRC),
    ]);

    const T = window.THREE;
    const build = window.ConstructXHeroScene;
    if (!T) throw new Error("Three.js loaded but exposed no global");
    if (!build) throw new Error("Hero scene loaded but exposed no builder");
    return { T, build };
  }

  function start(): void {
    if (started) return;
    started = true;

    const quality = assessDevice();
    if (!quality) return; // Still photo stands on its own.

    loadDependencies()
      .then(({ T, build }) => buildHero(els, T, build, quality))
      .catch((error: unknown) => {
        console.warn("ConstructX hero fell back to the still image.", error);
      });
  }

  // Only pay for Three.js if the hero is actually reached.
  if (typeof window.IntersectionObserver === "function") {
    const gate = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          gate.disconnect();
          start();
        }
      },
      { rootMargin: "200px" },
    );
    gate.observe(media);
  } else {
    window.addEventListener("load", start, { once: true });
  }

  /* ------------------------------------------------------------------ scene */

  function buildHero(
    el: HeroElements,
    T: ThreeModule,
    build: BuildResidence,
    quality: HeroQuality,
  ): void {
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
    if (T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
    else if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
    if (T.ACESFilmicToneMapping) renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    mount.append(renderer.domElement);

    const scene = new T.Scene();
    const residence = new T.Group();
    residence.position.set(0.18, -0.04, 0.2);
    residence.scale.set(0.9, 0.9, 0.9);
    scene.add(residence);

    build(T, renderer, scene, residence);

    /* -------------------------------------------------------- lighting */

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

    /* -------------------------------------------------------- interaction */

    let targetRotation = -0.24;
    let rotation = targetRotation;
    let dragging = false;
    let pointerX = 0;
    let interacted = false;
    residence.rotation.y = rotation;

    media.classList.add("is-interactive");
    controls?.classList.add("is-available");

    const nudge = (radians: number): void => {
      interacted = true;
      targetRotation += radians;
      requestFrame();
    };

    const onPointerDown = (event: PointerEvent): void => {
      dragging = true;
      interacted = true;
      pointerX = event.clientX;
      media.classList.add("dragging");
      mount.setPointerCapture?.(event.pointerId);
      if (event.cancelable && event.pointerType !== "touch") event.preventDefault();
      requestFrame();
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return;
      targetRotation += (event.clientX - pointerX) * 0.009;
      pointerX = event.clientX;
      requestFrame();
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (!dragging) return;
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

    // Arrow keys rotate once either spin button has focus, so the model is
    // reachable without a pointer.
    controls?.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        nudge(-0.3);
        event.preventDefault();
      } else if (event.key === "ArrowRight") {
        nudge(0.3);
        event.preventDefault();
      }
    });

    /* --------------------------------------------------------- render loop */

    let frame = 0;
    let onScreen = false;
    let pageVisible = !document.hidden;

    const settled = (): boolean =>
      !dragging && interacted && Math.abs(targetRotation - rotation) < 0.0002;

    function renderOnce(): void {
      rotation += (targetRotation - rotation) * 0.075;
      residence.rotation.y = rotation;
      renderer.render(scene, camera);
    }

    function tick(): void {
      frame = 0;
      if (!onScreen || !pageVisible) return;

      // Idle auto-spin until the visitor takes over.
      if (!dragging && !interacted) targetRotation += 0.0018;

      renderOnce();

      // Once the model has come to rest under manual control there is nothing
      // left to draw, so stop scheduling frames until something changes.
      if (!settled()) requestFrame();
    }

    function requestFrame(): void {
      if (frame || !onScreen || !pageVisible) return;
      frame = requestAnimationFrame(tick);
    }

    function setActive(active: boolean): void {
      if (active === onScreen) return;
      onScreen = active;
      if (active) requestFrame();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }

    /**
     * Whether any part of the hero is in the viewport.
     *
     * This is measured directly rather than taken from IntersectionObserver
     * alone. IO proved unreliable for re-entry here: scrolling away fired the
     * leaving callback, but scrolling back never fired the returning one, so
     * the loop stayed parked and the hero froze permanently. A bounding-rect
     * read on a rAF-throttled scroll listener is deterministic, and it is one
     * layout read per frame only while scrolling.
     */
    const isOnScreen = (): boolean => {
      const rect = media.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };

    let visibilityScheduled = false;
    const syncVisibility = (): void => {
      if (visibilityScheduled) return;
      visibilityScheduled = true;
      requestAnimationFrame(() => {
        visibilityScheduled = false;
        setActive(isOnScreen());
      });
    };

    window.addEventListener("scroll", syncVisibility, { passive: true });
    window.addEventListener("resize", syncVisibility, { passive: true });

    // IO stays as a supplement: it catches visibility changes that produce no
    // scroll event, such as an ancestor being shown or hidden.
    const visibility = new IntersectionObserver(() => syncVisibility(), {
      threshold: 0.01,
    });
    visibility.observe(media);

    const onVisibilityChange = (): void => {
      pageVisible = !document.hidden;
      if (pageVisible) requestFrame();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    /* -------------------------------------------------------------- resize */

    let resizeTimer = 0;
    const applySize = (): void => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      if (w === width && h === height) return;
      width = w;
      height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      requestFrame();
    };

    const onResize = (): void => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(applySize, 150);
    };

    if (typeof window.ResizeObserver === "function") {
      new ResizeObserver(onResize).observe(mount);
    } else {
      window.addEventListener("resize", onResize, { passive: true });
    }

    /* ------------------------------------------------------------ teardown */

    const dispose = (): void => {
      if (frame) cancelAnimationFrame(frame);
      visibility.disconnect();
      window.removeEventListener("scroll", syncVisibility);
      window.removeEventListener("resize", syncVisibility);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      scene.traverse((node: any) => {
        node.geometry?.dispose?.();
        const material = node.material;
        if (Array.isArray(material)) material.forEach((m: any) => m.dispose?.());
        else material?.dispose?.();
      });
      renderer.dispose();
    };

    window.addEventListener("pagehide", dispose, { once: true });

    setActive(isOnScreen());
  }
})();
