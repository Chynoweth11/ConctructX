"use strict";
// @ts-nocheck
(function () {
    var T = window.THREE;
    var mount = document.getElementById("hero3d");
    var heroImg = document.getElementById("heroImg");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function fallback() {
        if (heroImg)
            heroImg.style.display = "";
        if (mount)
            mount.style.display = "none";
    }
    var gl = false;
    try {
        var testCanvas = document.createElement("canvas");
        gl = !!(window.WebGLRenderingContext &&
            (testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl")));
    }
    catch (error) {
        gl = false;
    }
    if (!T || !mount || !gl) {
        fallback();
        return;
    }
    function start() {
        try {
            buildHero();
        }
        catch (error) {
            console.warn("ConstructX hero render fell back to the still image.", error);
            fallback();
        }
    }
    if (document.readyState === "complete")
        start();
    else
        window.addEventListener("load", start);
    function buildHero() {
        var width = mount.clientWidth || 1200;
        var height = mount.clientHeight || 760;
        var renderer = new T.WebGLRenderer({
            antialias: true,
            alpha: true,
            premultipliedAlpha: false,
            powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.physicallyCorrectLights = true;
        if (T.SRGBColorSpace)
            renderer.outputColorSpace = T.SRGBColorSpace;
        else if (T.sRGBEncoding)
            renderer.outputEncoding = T.sRGBEncoding;
        if (T.ACESFilmicToneMapping)
            renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.96;
        mount.appendChild(renderer.domElement);
        var scene = new T.Scene();
        var residence = new T.Group();
        residence.position.set(0.46, -0.09, 0.18);
        residence.scale.set(0.78, 0.78, 0.78);
        scene.add(residence);
        var seed = 18;
        function rnd() {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        }
        function cnv(w, h) {
            var canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            return canvas;
        }
        function texture(canvas, repeatX, repeatY, anisotropy) {
            var tex = new T.CanvasTexture(canvas);
            tex.wrapS = tex.wrapT = T.RepeatWrapping;
            tex.repeat.set(repeatX || 1, repeatY || 1);
            tex.anisotropy = anisotropy || 8;
            if (T.SRGBColorSpace)
                tex.colorSpace = T.SRGBColorSpace;
            else if (T.sRGBEncoding)
                tex.encoding = T.sRGBEncoding;
            return tex;
        }
        function stoneCanvas() {
            var c = cnv(512, 512);
            var x = c.getContext("2d");
            x.fillStyle = "#7f786c";
            x.fillRect(0, 0, 512, 512);
            var y = 0;
            var row = 0;
            while (y < 512) {
                var blockH = 22 + Math.floor(rnd() * 18);
                var offset = row % 2 ? -44 : 0;
                for (var bx = offset; bx < 512; bx += 70 + Math.floor(rnd() * 34)) {
                    var blockW = 54 + Math.floor(rnd() * 56);
                    var shade = 100 + Math.floor(rnd() * 72);
                    var warm = Math.floor(rnd() * 24);
                    x.fillStyle =
                        "rgb(" +
                            (shade + warm) +
                            "," +
                            (shade + Math.floor(warm * 0.78)) +
                            "," +
                            (shade - 8) +
                            ")";
                    x.fillRect(bx + 2, y + 2, blockW - 3, blockH - 3);
                    if (rnd() > 0.58) {
                        x.fillStyle = "rgba(255,255,255,.09)";
                        x.fillRect(bx + 4, y + 3, blockW * 0.55, 2);
                    }
                    if (rnd() > 0.68) {
                        x.fillStyle = "rgba(0,0,0,.12)";
                        x.fillRect(bx + blockW - 8, y + 4, 3, blockH - 8);
                    }
                }
                x.strokeStyle = "rgba(40,36,31,.44)";
                x.lineWidth = 2;
                x.beginPath();
                x.moveTo(0, y);
                x.lineTo(512, y);
                x.stroke();
                y += blockH;
                row++;
            }
            for (var i = 0; i < 7000; i++) {
                x.fillStyle = "rgba(255,255,255," + rnd() * 0.055 + ")";
                x.fillRect(rnd() * 512, rnd() * 512, 1, 1);
                x.fillStyle = "rgba(0,0,0," + rnd() * 0.045 + ")";
                x.fillRect(rnd() * 512, rnd() * 512, 1, 1);
            }
            return c;
        }
        function woodCanvas() {
            var c = cnv(512, 512);
            var x = c.getContext("2d");
            var grad = x.createLinearGradient(0, 0, 512, 64);
            grad.addColorStop(0, "#5b351c");
            grad.addColorStop(0.48, "#b36f35");
            grad.addColorStop(1, "#4c2b17");
            x.fillStyle = grad;
            x.fillRect(0, 0, 512, 512);
            for (var px = 0; px < 512; px += 18) {
                x.fillStyle = "rgba(28,15,8,.42)";
                x.fillRect(px, 0, 2, 512);
                x.fillStyle = "rgba(255,210,140,.12)";
                x.fillRect(px + 4, 0, 1, 512);
            }
            for (var j = 0; j < 1400; j++) {
                x.fillStyle = "rgba(255,200,126," + rnd() * 0.08 + ")";
                x.fillRect(rnd() * 512, rnd() * 512, 30 + rnd() * 70, 1);
            }
            return c;
        }
        function tileCanvas() {
            var c = cnv(512, 512);
            var x = c.getContext("2d");
            x.fillStyle = "#a9a39a";
            x.fillRect(0, 0, 512, 512);
            x.strokeStyle = "rgba(58,54,48,.36)";
            x.lineWidth = 3;
            for (var p = 0; p <= 512; p += 64) {
                x.beginPath();
                x.moveTo(p, 0);
                x.lineTo(p, 512);
                x.stroke();
                x.beginPath();
                x.moveTo(0, p);
                x.lineTo(512, p);
                x.stroke();
            }
            for (var k = 0; k < 1000; k++) {
                x.fillStyle = "rgba(255,255,255," + rnd() * 0.04 + ")";
                x.fillRect(rnd() * 512, rnd() * 512, 2, 2);
            }
            return c;
        }
        function roomCanvas() {
            var c = cnv(512, 512);
            var x = c.getContext("2d");
            var wall = x.createLinearGradient(0, 0, 0, 512);
            wall.addColorStop(0, "#f1d7ad");
            wall.addColorStop(0.35, "#c9945e");
            wall.addColorStop(1, "#33251d");
            x.fillStyle = wall;
            x.fillRect(0, 0, 512, 512);
            var sideShade = x.createLinearGradient(0, 0, 512, 0);
            sideShade.addColorStop(0, "rgba(0,0,0,.35)");
            sideShade.addColorStop(0.52, "rgba(255,219,154,.18)");
            sideShade.addColorStop(1, "rgba(0,0,0,.5)");
            x.fillStyle = sideShade;
            x.fillRect(0, 0, 512, 512);
            for (var i = 0; i < 7; i++) {
                var lx = 64 + i * 68 + rnd() * 18;
                var beam = x.createRadialGradient(lx, 58, 4, lx, 58, 120);
                beam.addColorStop(0, "rgba(255,222,154,.75)");
                beam.addColorStop(1, "rgba(255,222,154,0)");
                x.fillStyle = beam;
                x.fillRect(lx - 120, 0, 240, 220);
                x.fillStyle = "rgba(255,231,180,.95)";
                x.beginPath();
                x.arc(lx, 58, 5, 0, Math.PI * 2);
                x.fill();
            }
            x.fillStyle = "rgba(21,18,16,.76)";
            x.fillRect(38, 365, 170, 55);
            x.fillRect(284, 350, 130, 54);
            x.fillRect(312, 306, 64, 46);
            x.fillStyle = "rgba(55,40,30,.72)";
            x.fillRect(210, 382, 58, 30);
            x.fillRect(428, 378, 42, 36);
            x.fillStyle = "rgba(255,244,218,.24)";
            x.fillRect(122, 142, 74, 54);
            x.fillRect(340, 130, 82, 66);
            x.strokeStyle = "rgba(36,30,26,.56)";
            x.lineWidth = 8;
            x.strokeRect(122, 142, 74, 54);
            x.strokeRect(340, 130, 82, 66);
            for (var s = 0; s < 1100; s++) {
                x.fillStyle = "rgba(255,238,200," + rnd() * 0.045 + ")";
                x.fillRect(rnd() * 512, rnd() * 512, 1, 1);
            }
            return c;
        }
        function glassReflectionCanvas() {
            var c = cnv(512, 512);
            var x = c.getContext("2d");
            x.clearRect(0, 0, 512, 512);
            var g = x.createLinearGradient(0, 0, 512, 512);
            g.addColorStop(0, "rgba(255,255,255,.42)");
            g.addColorStop(0.18, "rgba(255,255,255,0)");
            g.addColorStop(0.52, "rgba(180,210,245,.22)");
            g.addColorStop(0.66, "rgba(255,255,255,0)");
            g.addColorStop(1, "rgba(255,255,255,.16)");
            x.fillStyle = g;
            x.fillRect(0, 0, 512, 512);
            for (var i = 0; i < 9; i++) {
                x.strokeStyle = "rgba(255,255,255," + (0.08 + rnd() * 0.12) + ")";
                x.lineWidth = 5 + rnd() * 12;
                x.beginPath();
                x.moveTo(-80 + rnd() * 220, 40 + i * 54);
                x.lineTo(560, -60 + i * 70);
                x.stroke();
            }
            return c;
        }
        function skyCanvas() {
            var c = cnv(1400, 700);
            var x = c.getContext("2d");
            var sky = x.createLinearGradient(0, 0, 0, 700);
            sky.addColorStop(0, "#34445f");
            sky.addColorStop(0.26, "#7f90af");
            sky.addColorStop(0.48, "#d7b7ad");
            sky.addColorStop(0.68, "#d6dbe4");
            sky.addColorStop(1, "#aeb8c6");
            x.fillStyle = sky;
            x.fillRect(0, 0, 1400, 700);
            var sun = x.createRadialGradient(1050, 208, 4, 1050, 208, 360);
            sun.addColorStop(0, "rgba(255,223,172,.96)");
            sun.addColorStop(0.22, "rgba(244,166,118,.42)");
            sun.addColorStop(1, "rgba(244,166,118,0)");
            x.fillStyle = sun;
            x.fillRect(0, 0, 1400, 480);
            for (var i = 0; i < 68; i++) {
                var cx = rnd() * 1400;
                var cy = 70 + rnd() * 220;
                var cloud = x.createRadialGradient(cx, cy, 10, cx, cy, 150 + rnd() * 120);
                cloud.addColorStop(0, "rgba(255,245,236,.17)");
                cloud.addColorStop(1, "rgba(255,245,236,0)");
                x.fillStyle = cloud;
                x.fillRect(cx - 240, cy - 100, 480, 240);
            }
            function ridge(baseY, minH, maxH, color, snowColor, startBias) {
                var pts = [];
                x.beginPath();
                x.moveTo(0, baseY);
                for (var r = 0; r <= 20; r++) {
                    var px = (r / 20) * 1400;
                    var py = baseY - (minH + Math.abs(Math.sin(r * 1.63 + baseY * 0.02)) * (maxH - minH));
                    if (px < startBias)
                        py = baseY - minH * 0.28;
                    pts.push([px, py]);
                    x.lineTo(px, py);
                }
                x.lineTo(1400, baseY);
                x.closePath();
                x.fillStyle = color;
                x.fill();
                x.fillStyle = snowColor;
                pts.forEach(function (p) {
                    if (baseY - p[1] > maxH * 0.58) {
                        x.beginPath();
                        x.moveTo(p[0], p[1]);
                        x.lineTo(p[0] - 24, p[1] + 44);
                        x.lineTo(p[0] + 25, p[1] + 44);
                        x.closePath();
                        x.fill();
                    }
                });
            }
            ridge(420, 70, 170, "rgba(73,86,111,.76)", "rgba(233,239,248,.9)", 420);
            ridge(456, 38, 118, "rgba(35,53,78,.74)", "rgba(221,231,242,.8)", 520);
            x.fillStyle = "rgba(19,35,47,.38)";
            for (var f = 0; f < 260; f++) {
                var tx = 680 + rnd() * 660;
                var ty = 355 + rnd() * 120;
                var th = 10 + rnd() * 34;
                x.beginPath();
                x.moveTo(tx, ty - th);
                x.lineTo(tx - th * 0.28, ty);
                x.lineTo(tx + th * 0.28, ty);
                x.closePath();
                x.fill();
            }
            return c;
        }
        var stoneMap = texture(stoneCanvas(), 3.6, 2.2);
        var stoneMat = new T.MeshStandardMaterial({
            map: stoneMap,
            bumpMap: stoneMap,
            bumpScale: 0.035,
            color: 0x847766,
            roughness: 0.96,
            metalness: 0.015,
        });
        var darkStoneMat = new T.MeshStandardMaterial({
            map: stoneMap.clone(),
            bumpMap: stoneMap.clone(),
            bumpScale: 0.04,
            color: 0x62594a,
            roughness: 0.98,
            metalness: 0.01,
        });
        darkStoneMat.map.repeat.set(3.2, 2.6);
        darkStoneMat.bumpMap.repeat.set(3.2, 2.6);
        var woodMap = texture(woodCanvas(), 4.4, 1);
        var woodMat = new T.MeshStandardMaterial({
            map: woodMap,
            bumpMap: woodMap,
            bumpScale: 0.025,
            color: 0x8f5428,
            roughness: 0.62,
            metalness: 0,
        });
        var roofMat = new T.MeshStandardMaterial({
            color: 0x0d1013,
            roughness: 0.46,
            metalness: 0.46,
            envMapIntensity: 1.05,
        });
        var frameMat = new T.MeshStandardMaterial({
            color: 0x111418,
            roughness: 0.32,
            metalness: 0.58,
            envMapIntensity: 1.1,
        });
        var snowMat = new T.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.92, metalness: 0 });
        var glassMat = new T.MeshPhysicalMaterial({
            map: texture(glassReflectionCanvas(), 1, 1, 4),
            color: 0x5f7486,
            roughness: 0.045,
            metalness: 0.08,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
            transparent: true,
            opacity: 0.46,
            reflectivity: 0.92,
            envMapIntensity: 3.1,
        });
        var railMat = new T.MeshPhysicalMaterial({
            color: 0xc6d9e7,
            roughness: 0.02,
            metalness: 0,
            clearcoat: 1,
            transparent: true,
            opacity: 0.2,
            envMapIntensity: 1.35,
        });
        var warmMat = new T.MeshStandardMaterial({
            color: 0xb87943,
            emissive: 0xffa758,
            emissiveIntensity: 0.35,
            roughness: 0.72,
        });
        var warmSoftMat = new T.MeshBasicMaterial({ color: 0xffbd73, transparent: true, opacity: 0.26 });
        var roomMat = new T.MeshBasicMaterial({
            map: texture(roomCanvas(), 1, 1, 4),
            transparent: true,
            opacity: 0.95,
        });
        var tileMat = new T.MeshStandardMaterial({
            map: texture(tileCanvas(), 3.5, 2.2),
            color: 0xb3afa7,
            roughness: 0.84,
        });
        var pineMat = new T.MeshStandardMaterial({ color: 0x1e332a, roughness: 0.93 });
        var trunkMat = new T.MeshStandardMaterial({ color: 0x5a402c, roughness: 0.9 });
        function mesh(geometry, material, x, y, z, rx, ry, rz, parent) {
            var m = new T.Mesh(geometry, material);
            m.position.set(x || 0, y || 0, z || 0);
            m.rotation.set(rx || 0, ry || 0, rz || 0);
            m.castShadow = true;
            m.receiveShadow = true;
            (parent || residence).add(m);
            return m;
        }
        function box(w, h, d, material, x, y, z, parent) {
            return mesh(new T.BoxGeometry(w, h, d), material, x, y, z, 0, 0, 0, parent);
        }
        function cyl(rt, rb, h, segments, material, x, y, z, parent) {
            return mesh(new T.CylinderGeometry(rt, rb, h, segments || 18), material, x, y, z, 0, 0, 0, parent);
        }
        function addFrontGlass(x, y, z, w, h, cols, rows) {
            var room = mesh(new T.PlaneGeometry(w * 0.97, h * 0.94), roomMat, x, y, z - 0.06, 0, 0, 0);
            room.castShadow = false;
            room.receiveShadow = false;
            var glow = mesh(new T.PlaneGeometry(w * 0.95, h * 0.92), warmSoftMat, x, y, z - 0.025, 0, 0, 0);
            glow.castShadow = false;
            glow.receiveShadow = false;
            box(w, h, 0.045, glassMat, x, y, z);
            box(w + 0.12, 0.055, 0.07, frameMat, x, y + h / 2, z + 0.04);
            box(w + 0.12, 0.055, 0.07, frameMat, x, y - h / 2, z + 0.04);
            box(0.055, h + 0.1, 0.07, frameMat, x - w / 2, y, z + 0.04);
            box(0.055, h + 0.1, 0.07, frameMat, x + w / 2, y, z + 0.04);
            for (var i = 1; i < cols; i++) {
                box(0.035, h + 0.05, 0.075, frameMat, x - w / 2 + (w * i) / cols, y, z + 0.055);
            }
            for (var j = 1; j < rows; j++) {
                box(w + 0.02, 0.032, 0.075, frameMat, x, y - h / 2 + (h * j) / rows, z + 0.055);
            }
        }
        function addSideGlass(x, y, z, d, h, cols, rows) {
            var sideRoom = mesh(new T.PlaneGeometry(d * 0.96, h * 0.94), roomMat, x + 0.06, y, z, 0, Math.PI / 2, 0);
            sideRoom.castShadow = false;
            sideRoom.receiveShadow = false;
            box(0.045, h, d, glassMat, x, y, z);
            box(0.07, 0.055, d + 0.12, frameMat, x - 0.04, y + h / 2, z);
            box(0.07, 0.055, d + 0.12, frameMat, x - 0.04, y - h / 2, z);
            box(0.07, h + 0.1, 0.055, frameMat, x - 0.04, y, z - d / 2);
            box(0.07, h + 0.1, 0.055, frameMat, x - 0.04, y, z + d / 2);
            for (var i = 1; i < cols; i++) {
                box(0.075, h + 0.05, 0.035, frameMat, x - 0.055, y, z - d / 2 + (d * i) / cols);
            }
            for (var j = 1; j < rows; j++) {
                box(0.075, 0.032, d + 0.02, frameMat, x - 0.055, y - h / 2 + (h * j) / rows, z);
            }
        }
        function addRail(x, y, z, w, horizontal) {
            if (horizontal) {
                box(w, 0.44, 0.035, railMat, x, y, z);
                box(w + 0.05, 0.045, 0.05, frameMat, x, y + 0.24, z + 0.02);
                for (var i = 0; i <= 6; i++)
                    box(0.032, 0.5, 0.045, frameMat, x - w / 2 + (w * i) / 6, y, z + 0.03);
            }
            else {
                box(0.035, 0.44, w, railMat, x, y, z);
                box(0.05, 0.045, w + 0.05, frameMat, x + 0.02, y + 0.24, z);
                for (var j = 0; j <= 4; j++)
                    box(0.045, 0.5, 0.032, frameMat, x + 0.03, y, z - w / 2 + (w * j) / 4);
            }
        }
        function addDownlights(y, z, startX, count, gap) {
            for (var i = 0; i < count; i++) {
                var x = startX + i * gap;
                var bulb = mesh(new T.SphereGeometry(0.045, 12, 8), new T.MeshBasicMaterial({ color: 0xffd18d }), x, y, z, 0, 0, 0);
                bulb.castShadow = false;
                var light = new T.PointLight(0xffbd72, 0.35, 2.8, 2);
                light.position.set(x, y - 0.04, z + 0.06);
                residence.add(light);
            }
        }
        // Snow plane and patio. A flat plane avoids the toy-like platform edge.
        var snowPlane = mesh(new T.PlaneGeometry(12.8, 8.6), snowMat, 0, 0.035, 0.65, -Math.PI / 2, 0, 0);
        snowPlane.castShadow = false;
        box(9.4, 0.08, 2.8, tileMat, 0.35, 0.13, 3.15);
        box(4.2, 0.06, 1.8, tileMat, -2.3, 1.55, 2.3);
        box(3.4, 0.06, 1.5, tileMat, -1.2, 2.92, 2.05);
        // Lower residence volume
        box(8.5, 1.25, 3.25, stoneMat, 0, 0.78, 0.22);
        box(8.95, 0.28, 3.75, roofMat, 0, 1.48, 0.2);
        box(8.75, 0.075, 3.55, woodMat, 0, 1.31, 0.2);
        addFrontGlass(-2.85, 0.82, 1.9, 2.0, 0.95, 3, 2);
        addFrontGlass(-0.45, 0.82, 1.92, 2.15, 0.95, 3, 2);
        addFrontGlass(2.1, 0.82, 1.91, 2.2, 0.95, 3, 2);
        addSideGlass(4.28, 0.82, 0.3, 2.35, 0.9, 3, 2);
        addDownlights(1.27, 1.92, -3.65, 9, 0.9);
        // Main second level
        box(7.65, 1.28, 3.05, stoneMat, -0.25, 2.12, 0.04);
        box(8.35, 0.3, 3.62, roofMat, -0.22, 2.85, 0.02);
        box(8.1, 0.075, 3.42, woodMat, -0.22, 2.67, 0.02);
        addFrontGlass(-2.55, 2.14, 1.72, 2.2, 1.0, 3, 2);
        addFrontGlass(0.0, 2.14, 1.73, 2.35, 1.0, 4, 2);
        addFrontGlass(2.45, 2.14, 1.72, 1.75, 1.0, 3, 2);
        addSideGlass(3.63, 2.14, 0.18, 2.15, 0.98, 3, 2);
        addRail(-0.2, 1.78, 2.35, 7.6, true);
        addRail(3.77, 1.78, 1.02, 2.25, false);
        addDownlights(2.66, 1.74, -3.75, 8, 0.95);
        // Upper suite and deep black roofline
        box(4.9, 1.05, 2.45, darkStoneMat, -1.35, 3.35, -0.12);
        box(5.65, 0.3, 3.02, roofMat, -1.35, 4.02, -0.12);
        box(5.42, 0.075, 2.86, woodMat, -1.35, 3.84, -0.12);
        addFrontGlass(-2.2, 3.36, 1.23, 1.75, 0.82, 3, 2);
        addFrontGlass(-0.18, 3.36, 1.24, 1.6, 0.82, 3, 2);
        addSideGlass(1.1, 3.36, -0.04, 1.55, 0.82, 2, 2);
        addRail(-1.25, 3.02, 1.52, 3.95, true);
        addDownlights(3.82, 1.25, -3.65, 6, 0.82);
        // Signature stone chimney, matching the reference image.
        box(0.88, 3.35, 0.88, darkStoneMat, 3.05, 2.95, -0.92);
        box(1.08, 0.22, 1.08, roofMat, 3.05, 4.74, -0.92);
        box(0.72, 0.38, 0.72, frameMat, 3.05, 4.98, -0.92);
        box(0.96, 0.12, 0.96, roofMat, 3.05, 5.23, -0.92);
        // Vertical slat feature from the reference balcony.
        for (var s = 0; s < 16; s++) {
            box(0.035, 1.12, 0.035, woodMat, -3.62 + s * 0.07, 2.08, 1.82);
        }
        // Patio furniture and fire lounge silhouettes.
        var cushionMat = new T.MeshStandardMaterial({ color: 0x3b3530, roughness: 0.82 });
        box(1.25, 0.22, 0.38, cushionMat, -1.85, 0.31, 3.55);
        box(0.28, 0.48, 0.38, cushionMat, -2.35, 0.55, 3.55);
        box(1.1, 0.22, 0.38, cushionMat, 1.2, 0.31, 3.68);
        box(0.24, 0.42, 0.38, cushionMat, 1.72, 0.52, 3.68);
        cyl(0.46, 0.52, 0.16, 32, frameMat, -0.2, 0.26, 3.92);
        var flame = mesh(new T.ConeGeometry(0.16, 0.38, 16), new T.MeshBasicMaterial({ color: 0xff8a3d }), -0.2, 0.56, 3.92, 0, 0, 0);
        flame.castShadow = false;
        var fireLight = new T.PointLight(0xff8a3d, 0.65, 4, 2);
        fireLight.position.set(-0.2, 0.72, 3.92);
        residence.add(fireLight);
        // Path lights in front of the residence.
        for (var l = 0; l < 8; l++) {
            var lx = -4.0 + l * 1.0;
            var lz = 4.35 + Math.sin(l) * 0.08;
            cyl(0.018, 0.018, 0.48, 8, frameMat, lx, 0.38, lz);
            mesh(new T.SphereGeometry(0.07, 12, 8), new T.MeshBasicMaterial({ color: 0xffd19a }), lx, 0.67, lz, 0, 0, 0);
            var pl = new T.PointLight(0xffbf78, 0.18, 1.8, 2);
            pl.position.set(lx, 0.68, lz);
            residence.add(pl);
        }
        function pine(x, z, h, lean) {
            var tree = new T.Group();
            tree.position.set(x, 0, z);
            tree.rotation.z = lean || 0;
            residence.add(tree);
            var trunk = new T.Mesh(new T.CylinderGeometry(0.055 * h, 0.075 * h, 0.45 * h, 7), trunkMat);
            trunk.position.y = 0.22 * h;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            tree.add(trunk);
            for (var i = 0; i < 7; i++) {
                var t = i / 7;
                var radius = h * (0.35 - t * 0.22);
                var coneH = h * (0.42 - t * 0.08);
                var cy = h * (0.34 + i * 0.11);
                var cone = new T.Mesh(new T.ConeGeometry(radius, coneH, 9), pineMat);
                cone.position.y = cy;
                cone.castShadow = true;
                cone.receiveShadow = true;
                tree.add(cone);
                if (i % 2 === 0) {
                    var snow = new T.Mesh(new T.ConeGeometry(radius * 0.72, coneH * 0.28, 9), snowMat);
                    snow.position.y = cy + coneH * 0.16;
                    snow.castShadow = false;
                    tree.add(snow);
                }
            }
        }
        pine(-5.75, 3.65, 0.98, -0.03);
        pine(5.6, 3.45, 0.94, 0.02);
        pine(4.95, -3.5, 0.9, -0.02);
        pine(-4.85, -3.35, 0.86, 0.02);
        // Background world: sky, mountains, soft shadows. These stay stable while the model rotates.
        var skyTex = texture(skyCanvas(), 1, 1, 4);
        scene.background = null;
        scene.fog = new T.Fog(new T.Color(0xb8c1cf), 18, 48);
        try {
            var envTex = skyTex.clone();
            if (T.EquirectangularReflectionMapping)
                envTex.mapping = T.EquirectangularReflectionMapping;
            var pmrem = new T.PMREMGenerator(renderer);
            pmrem.compileEquirectangularShader();
            scene.environment = pmrem.fromEquirectangular(envTex).texture;
        }
        catch (error) {
            scene.environment = skyTex;
        }
        var ground = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshStandardMaterial({ color: 0xf2f6fb, roughness: 0.96, transparent: true, opacity: 0.22 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.065;
        ground.receiveShadow = true;
        scene.add(ground);
        var shadowCanvas = cnv(256, 256);
        var shadowCtx = shadowCanvas.getContext("2d");
        var shadowGrad = shadowCtx.createRadialGradient(128, 128, 12, 128, 128, 126);
        shadowGrad.addColorStop(0, "rgba(10,10,12,.45)");
        shadowGrad.addColorStop(1, "rgba(10,10,12,0)");
        shadowCtx.fillStyle = shadowGrad;
        shadowCtx.fillRect(0, 0, 256, 256);
        var softShadow = new T.Mesh(new T.PlaneGeometry(13.6, 9.4), new T.MeshBasicMaterial({ map: new T.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
        softShadow.rotation.x = -Math.PI / 2;
        softShadow.position.set(0.55, 0.01, 0.82);
        scene.add(softShadow);
        scene.add(new T.HemisphereLight(0xb9c8e8, 0x261d17, 0.34));
        var sun = new T.DirectionalLight(0xffbf82, 1.82);
        sun.position.set(7.5, 7.4, 7.8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 62;
        sun.shadow.camera.left = -11;
        sun.shadow.camera.right = 11;
        sun.shadow.camera.top = 11;
        sun.shadow.camera.bottom = -11;
        sun.shadow.bias = -0.00035;
        scene.add(sun);
        var fill = new T.DirectionalLight(0x8ea7d6, 0.38);
        fill.position.set(-6, 3.8, -5);
        scene.add(fill);
        var interiorBoost = new T.PointLight(0xffb76d, 1.35, 10, 2);
        interiorBoost.position.set(0.4, 2.1, 2.15);
        residence.add(interiorBoost);
        var camera = new T.PerspectiveCamera(28, width / height, 0.1, 250);
        camera.position.set(6.25, 2.82, 9.7);
        camera.lookAt(new T.Vector3(0.18, 2.08, 0.78));
        var targetRotation = -0.33;
        var rotation = targetRotation;
        var dragging = false;
        var pointerX = 0;
        var interacted = false;
        residence.rotation.y = rotation;
        function pointerDown(event) {
            dragging = true;
            interacted = true;
            pointerX = event.clientX;
            mount.style.cursor = "grabbing";
            if (mount.parentElement)
                mount.parentElement.classList.add("dragging");
            if (event.cancelable && event.pointerType !== "touch")
                event.preventDefault();
        }
        function pointerMove(event) {
            if (!dragging)
                return;
            targetRotation += (event.clientX - pointerX) * 0.009;
            pointerX = event.clientX;
        }
        function pointerUp() {
            dragging = false;
            mount.style.cursor = "grab";
            if (mount.parentElement)
                mount.parentElement.classList.remove("dragging");
        }
        mount.addEventListener("pointerdown", pointerDown);
        window.addEventListener("pointermove", pointerMove);
        window.addEventListener("pointerup", pointerUp);
        mount.style.cursor = "grab";
        function loop() {
            requestAnimationFrame(loop);
            if (!dragging && !interacted && !reduce)
                targetRotation += 0.0018;
            rotation += (targetRotation - rotation) * 0.075;
            residence.rotation.y = rotation;
            renderer.render(scene, camera);
        }
        loop();
        window.addEventListener("resize", function () {
            var w = mount.clientWidth || width;
            var h = mount.clientHeight || height;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
    }
})();
