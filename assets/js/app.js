"use strict";
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function observeOnce(elements, onEnter, options) {
    if (!elements.length)
        return () => { };
    if (typeof window.IntersectionObserver !== "function") {
        elements.forEach(onEnter);
        return () => { };
    }
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting)
                continue;
            onEnter(entry.target);
            observer.unobserve(entry.target);
        }
    }, options);
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
}
const scrollTasks = [];
let scrollScheduled = false;
function runScrollTasks() {
    scrollScheduled = false;
    const y = window.scrollY;
    for (const task of scrollTasks)
        task(y);
}
function onScrollFrame(task) {
    scrollTasks.push(task);
    task(window.scrollY);
}
function initScrollLoop() {
    window.addEventListener("scroll", () => {
        if (scrollScheduled)
            return;
        scrollScheduled = true;
        requestAnimationFrame(runScrollTasks);
    }, { passive: true });
    window.addEventListener("resize", runScrollTasks, { passive: true });
}
function initHeaderState() {
    const header = document.getElementById("header");
    if (!header)
        return;
    onScrollFrame((y) => {
        header.classList.toggle("solid", y > window.innerHeight * 0.7);
    });
}
function initReadingProgress() {
    const fill = $("#pageProgress span");
    if (!fill)
        return;
    onScrollFrame((y) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (y / max) * 100 : 0;
        fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    });
}
function initBandParallax() {
    const band = $(".band");
    const image = document.getElementById("bandImg");
    if (!band || !image || prefersReducedMotion())
        return;
    let visible = false;
    const observer = new IntersectionObserver((entries) => {
        visible = entries[0]?.isIntersecting ?? false;
    }, { rootMargin: "100px" });
    observer.observe(band);
    onScrollFrame(() => {
        if (!visible)
            return;
        const rect = band.getBoundingClientRect();
        const offset = (rect.top - window.innerHeight / 2) * -0.05;
        image.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    });
}
function initMobileMenu() {
    const button = document.getElementById("menuBtn");
    const menu = document.getElementById("mobileMenu");
    if (!button || !menu)
        return;
    let lastFocused = null;
    const focusables = () => $$("a[href], button:not([disabled])", menu);
    const setOpen = (open) => {
        menu.classList.toggle("open", open);
        menu.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        document.body.classList.toggle("menu-open", open);
        if (open) {
            lastFocused = document.activeElement;
            focusables()[0]?.focus();
        }
        else if (lastFocused) {
            lastFocused.focus();
            lastFocused = null;
        }
    };
    const isOpen = () => menu.classList.contains("open");
    button.addEventListener("click", () => setOpen(!isOpen()));
    $$("a", menu).forEach((link) => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (event) => {
        if (!isOpen())
            return;
        if (event.key === "Escape") {
            setOpen(false);
            return;
        }
        if (event.key !== "Tab")
            return;
        const items = focusables();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last)
            return;
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    });
    window.matchMedia("(min-width: 861px)").addEventListener("change", (event) => {
        if (event.matches && isOpen())
            setOpen(false);
    });
    document.addEventListener("click", (event) => {
        if (!isOpen())
            return;
        const target = event.target;
        if (!menu.contains(target) && !button.contains(target))
            setOpen(false);
    });
}
function initSectionNav() {
    const links = $$(".nav-links a");
    if (!links.length)
        return;
    const setActive = (id) => {
        for (const link of links) {
            const active = link.getAttribute("href") === `#${id}`;
            if (active)
                link.setAttribute("aria-current", "true");
            else
                link.removeAttribute("aria-current");
        }
    };
    const ids = links
        .map((link) => link.getAttribute("href")?.slice(1))
        .filter((id) => Boolean(id));
    if (typeof window.IntersectionObserver === "function") {
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting)
                    setActive(entry.target.id);
            }
        }, { rootMargin: "-40% 0px -55% 0px" });
        ids.forEach((id) => {
            const section = document.getElementById(id);
            if (section)
                observer.observe(section);
        });
    }
    window.addEventListener("hashchange", () => {
        const id = window.location.hash.slice(1);
        if (id)
            setActive(id);
    });
}
function initReveals() {
    observeOnce($$(".reveal"), (el) => el.classList.add("in"), { threshold: 0.16 });
    observeOnce($$(".f-media"), (el) => el.classList.add("in"), { threshold: 0.28 });
}
function initCounters() {
    const format = (value, decimals) => value.toFixed(decimals);
    const animate = (el) => {
        const target = Number.parseFloat(el.dataset.count ?? "0");
        const suffix = el.dataset.suffix ?? "";
        const decimals = target % 1 !== 0 ? 1 : 0;
        if (prefersReducedMotion()) {
            el.textContent = format(target, decimals) + suffix;
            return;
        }
        const duration = 1500;
        let start = null;
        const step = (timestamp) => {
            start ??= timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = format(target * eased, decimals) + suffix;
            if (progress < 1)
                requestAnimationFrame(step);
            else
                el.textContent = format(target, decimals) + suffix;
        };
        requestAnimationFrame(step);
    };
    observeOnce($$("[data-count]"), (el) => animate(el), { threshold: 0.6 });
    observeOnce($$("[data-bar]"), (el) => {
        el.style.width = `${el.getAttribute("data-bar")}%`;
    }, { threshold: 0.5 });
}
function initProcessTimeline() {
    const proc = document.getElementById("proc");
    const fill = document.getElementById("procFill");
    if (!proc)
        return;
    observeOnce([proc], () => {
        if (fill)
            fill.style.width = "100%";
        const steps = $$(".proc-step", proc);
        const stagger = prefersReducedMotion() ? 0 : 230;
        steps.forEach((step, index) => {
            window.setTimeout(() => step.classList.add("on"), index * stagger);
        });
    }, { threshold: 0.4 });
}
const SITES = [
    { x: 34, y: 22, name: "Project Timberline", coord: "Colorado mountain region · exact site private", status: "active", label: "Active · phase 05" },
    { x: 52, y: 34, name: "Project North Star", coord: "Colorado high country · exact site private", status: "done", label: "Delivered · 2024" },
    { x: 68, y: 52, name: "Project Cascade", coord: "Mountain West region · exact site private", status: "done", label: "Delivered · 2025" },
    { x: 44, y: 64, name: "Project Aster", coord: "Southwest Colorado · exact site private", status: "done", label: "Delivered · 2025" },
    { x: 26, y: 48, name: "Project Stonepine", coord: "Colorado resort corridor · exact site private", status: "active", label: "Active · phase 03" },
    { x: 60, y: 20, name: "Project Summit", coord: "Northern Colorado · exact site private", status: "active", label: "Active · phase 04" },
    { x: 78, y: 70, name: "Project Blue River", coord: "Private lake / river region · exact site private", status: "done", label: "Delivered · 2023" },
];
function initProjectMap() {
    const canvas = document.getElementById("mapCanvas");
    const nameEl = document.getElementById("mapName");
    const coordEl = document.getElementById("mapCoord");
    const statusEl = document.getElementById("mapStatus");
    if (!canvas || !nameEl || !coordEl || !statusEl)
        return;
    const markers = [];
    const select = (site, marker) => {
        for (const other of markers)
            other.setAttribute("aria-current", String(other === marker));
        nameEl.textContent = site.name;
        coordEl.textContent = site.coord;
        statusEl.replaceChildren();
        const dot = document.createElement("span");
        dot.className = `d ${site.status}`;
        dot.setAttribute("aria-hidden", "true");
        statusEl.append(dot, ` ${site.label}`);
    };
    SITES.forEach((site) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = `marker ${site.status}`;
        marker.style.left = `${site.x}%`;
        marker.style.top = `${site.y}%`;
        marker.setAttribute("aria-label", `${site.name} — ${site.label}`);
        marker.setAttribute("aria-current", "false");
        const pin = document.createElement("span");
        pin.className = "pin";
        pin.setAttribute("aria-hidden", "true");
        marker.append(pin);
        marker.addEventListener("click", () => select(site, marker));
        marker.addEventListener("focus", () => select(site, marker));
        marker.addEventListener("mouseenter", () => select(site, marker));
        markers.push(marker);
        canvas.append(marker);
    });
}
const TYPE_LABELS = {
    interiors: "Interiors & remodeling",
    residential: "Residential",
    commercial: "Commercial",
    custom: "Custom",
};
const TYPE_FORM_VALUES = {
    interiors: "Interiors/Remodeling",
    residential: "Residential",
    commercial: "Commercial",
    custom: "Custom",
};
const FIT_COPY = {
    interiors: {
        head: "Interior & remodel review",
        body: "Existing conditions, finish goals, phasing, and occupied-space constraints are reviewed before scope is set.",
        next: "Walkthrough consult",
    },
    residential: {
        head: "Residential discovery",
        body: "Custom homes and private residences start with goals, site context, privacy, schedule, and design-intent alignment.",
        next: "Discovery call",
    },
    commercial: {
        head: "Commercial discovery",
        body: "Retail, hospitality, office, and tenant-improvement work starts with operations, phasing, code, and brand requirements.",
        next: "Use-case review",
    },
    custom: {
        head: "Custom scope review",
        body: "Unique projects begin with a confidential conversation around the vision, constraints, standards, and the right delivery path.",
        next: "Private consult",
    },
};
const STAGE_NEXT_STEP = {
    "Planning / budgeting": "Scope discovery",
    "Ready to build": "Pre-construction review",
    "In progress / rescue": "Stabilization review",
};
const fitState = {
    type: "interiors",
    sqft: 6000,
    stage: "Planning / budgeting",
};
function initProjectFit() {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el)
            el.textContent = value;
    };
    const render = () => {
        const copy = FIT_COPY[fitState.type];
        const scope = `${fitState.sqft.toLocaleString()} sq ft`;
        setText("eoRange", copy.head);
        setText("eoPer", copy.body);
        setText("eoBase", TYPE_LABELS[fitState.type]);
        setText("eoFin", scope);
        setText("eoStage", fitState.stage);
        setText("eoDur", STAGE_NEXT_STEP[fitState.stage] ?? copy.next);
        setText("lblType", TYPE_LABELS[fitState.type]);
        setText("lblSqft", scope);
        setText("lblStage", fitState.stage);
    };
    const wireSegment = (id, apply) => {
        const group = document.getElementById(id);
        if (!group)
            return;
        const buttons = $$("button", group);
        for (const button of buttons) {
            button.addEventListener("click", () => {
                for (const other of buttons)
                    other.setAttribute("aria-pressed", String(other === button));
                apply(button);
                render();
            });
        }
    };
    wireSegment("segType", (button) => {
        const type = button.dataset.type;
        if (type && type in TYPE_LABELS)
            fitState.type = type;
    });
    wireSegment("segStage", (button) => {
        fitState.stage = button.dataset.stage ?? button.textContent?.trim() ?? fitState.stage;
    });
    const slider = document.getElementById("sqft");
    if (slider) {
        const update = () => {
            fitState.sqft = Number.parseInt(slider.value, 10);
            slider.setAttribute("aria-valuetext", `${fitState.sqft.toLocaleString()} square feet`);
            render();
        };
        slider.addEventListener("input", update);
        update();
    }
    render();
}
function prefillContact(projectType, note) {
    const type = document.getElementById("cType");
    const notes = document.getElementById("cNotes");
    const name = document.getElementById("cName");
    if (type && projectType)
        type.value = projectType;
    if (notes && note && !notes.value.trim())
        notes.value = note;
    window.setTimeout(() => name?.focus({ preventScroll: true }), 120);
}
function initEnquiryPrefill() {
    const fitCta = document.getElementById("fitCta");
    fitCta?.addEventListener("click", () => {
        prefillContact(TYPE_FORM_VALUES[fitState.type], `Project fit: ${TYPE_LABELS[fitState.type]} · ${fitState.sqft.toLocaleString()} sq ft · ${fitState.stage}.`);
    });
    for (const link of $$("[data-enquiry-note]")) {
        link.addEventListener("click", () => {
            prefillContact(link.getAttribute("data-enquiry-type"), link.getAttribute("data-enquiry-note"));
        });
    }
}
function collectField(inputId, errorId, apiKey, validate) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (!input || !errorEl)
        return null;
    return { input, errorEl, apiKey, validate };
}
function initContactForm() {
    const form = document.getElementById("contactForm");
    const submit = document.getElementById("ctaSend");
    const status = document.getElementById("formStatus");
    if (!form || !submit || !status)
        return;
    const openedAt = Date.now();
    const submitLabel = submit.innerHTML;
    const fields = [
        collectField("cName", "errName", "name", (value) => value.trim() ? "" : "Enter the name we should use when we reply."),
        collectField("cEmail", "errEmail", "email", (_value, input) => input.validity.valid ? "" : "Enter an email address we can reach you at."),
        collectField("cType", "errType", "projectType", (value) => value ? "" : "Choose the kind of project you're planning."),
    ].filter((field) => field !== null);
    const setStatus = (message, kind = "") => {
        status.textContent = message;
        status.className = `form-status ${kind}`.trim();
    };
    const setFieldError = (field, message) => {
        field.errorEl.textContent = message;
        if (message)
            field.input.setAttribute("aria-invalid", "true");
        else
            field.input.removeAttribute("aria-invalid");
    };
    for (const field of fields) {
        field.input.addEventListener("input", () => setFieldError(field, ""));
    }
    const validate = () => {
        let firstInvalid = null;
        for (const field of fields) {
            const message = field.validate(field.input.value, field.input);
            setFieldError(field, message);
            if (message && !firstInvalid)
                firstInvalid = field;
        }
        if (firstInvalid) {
            setStatus("Check the highlighted fields and send again.", "err");
            firstInvalid.input.focus();
            return false;
        }
        return true;
    };
    const applyServerErrors = (errors) => {
        for (const field of fields) {
            const message = errors[field.apiKey];
            if (message)
                setFieldError(field, message);
        }
    };
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!validate())
            return;
        const data = new FormData(form);
        submit.disabled = true;
        submit.innerHTML = '<span class="btn-label">Sending securely…</span>';
        setStatus("Sending…");
        try {
            const response = await fetch(form.action, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.get("name"),
                    email: data.get("email"),
                    projectType: data.get("projectType"),
                    notes: data.get("notes"),
                    company: data.get("company"),
                    approxSqft: fitState.sqft,
                    projectStage: fitState.stage,
                    elapsedMs: Date.now() - openedAt,
                    source: "constructx-site",
                }),
            });
            const payload = (await response.json().catch(() => ({})));
            if (!response.ok) {
                if (payload.errors)
                    applyServerErrors(payload.errors);
                setStatus(payload.error ?? "That didn't send. Check the highlighted fields and try again.", "err");
                submit.innerHTML = submitLabel;
                return;
            }
            setStatus(payload.message ?? "Enquiry received. We'll follow up with the right next step.", "ok");
            submit.innerHTML = '<span class="btn-label">Conversation started ✓</span>';
            form.reset();
            for (const field of fields)
                setFieldError(field, "");
        }
        catch {
            setStatus("The enquiry service isn't reachable from here. Email the team directly and we'll pick it up.", "err");
            submit.innerHTML = submitLabel;
        }
        finally {
            submit.disabled = false;
        }
    });
}
function initFooterYear() {
    const year = document.getElementById("year");
    if (year)
        year.textContent = String(new Date().getFullYear());
}
function main() {
    initScrollLoop();
    initHeaderState();
    initReadingProgress();
    initBandParallax();
    initMobileMenu();
    initSectionNav();
    initReveals();
    initCounters();
    initProcessTimeline();
    initProjectMap();
    initProjectFit();
    initEnquiryPrefill();
    initContactForm();
    initFooterYear();
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
}
else {
    main();
}
//# sourceMappingURL=app.js.map