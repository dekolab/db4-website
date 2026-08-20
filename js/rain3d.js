/*
 * The book-rain box (bans over time), in 3D. Replaces the old 2D <canvas>
 * particle field with a Three.js scene: pick a year span with the two
 * sliders and one book mesh (asset/mesh/book.fbx) falls for every ~12
 * gazetted publications in it (hard cap 300 instances). All books share a
 * single InstancedMesh; per-instance colours come from Charts.theme() so
 * the pile matches the chart palette in both themes.
 *
 * The scene is navigable — orbit, zoom, pan, arrow keys — and switches
 * between a perspective and an orthographic camera, the latter reading the
 * pile as a flat stack of layers rather than a receding one. A corner axis
 * ticks the pile height in publications so the height is legible as a
 * quantity, not just a mood.
 *
 * The RAF loop runs only while the section is on screen AND something is
 * changing (books falling, or the camera moving). Under prefers-reduced-
 * motion the settled end-state renders immediately and only deliberate
 * navigation redraws. The Year / Decade / Cumulative chart views remain the
 * accessible equivalent and carry the real numbers.
 */
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

(function () {
  "use strict";

  var RAIN_PER_SPRITE = 12;
  var RAIN_CAP = 300;

  /* The heap is the cumulative chart: COLS_X year bins run left to right,
     each stacked to the running total at that point and ROWS books deep. */
  var COLS_X = 16, ROWS = 2;
  var MAX_LEVELS = 22;
  var BW = 1;              /* every book is scaled to this width */
  var GX = 0.14, GZ = 0.2; /* gaps between books */

  var FOV = 33;
  /* Orthographic is the reading view: locked square-on down the z axis, so
     the heap resolves into the cumulative chart it encodes and nothing can
     be tilted into a misleading angle. Perspective is the exploring view —
     a three-quarter start that the reader is then free to move. */
  var ORTHO_AZIM = 0, ORTHO_POLAR = Math.PI / 2;
  var AZIM = -0.30, POLAR = 1.27;
  var UP = new THREE.Vector3(0, 1, 0);
  var LABEL_PAD = 1.6;            /* world-space room for the scale labels */
  var LABEL_PX = 104;             /* ...and how wide the widest one gets */

  function fmt(n) {
    return Number(n).toLocaleString("en-US");
  }

  function init() {
    var box = document.getElementById("rain-box");
    if (!box || typeof PPPA === "undefined") return;

    var fromEl = document.getElementById("rain-from");
    var toEl = document.getElementById("rain-to");
    var readout = document.getElementById("rain-readout");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    var perYear = {};
    PPPA.perYear.forEach(function (p) { perYear[p[0]] = p[1]; });
    var Y0 = PPPA.meta.yearMin, Y1 = PPPA.meta.yearMax;

    /* running total from Y0, so any window's cumulative is one subtraction */
    var CUM = {}, runningTotal = 0;
    for (var cy = Y0; cy <= Y1; cy++) {
      runningTotal += perYear[cy] || 0;
      CUM[cy] = runningTotal;
    }
    function cumeTo(from, year) {
      if (year < from) return 0;
      return CUM[Math.min(year, Y1)] - (from > Y0 ? CUM[from - 1] : 0);
    }

    /* The sliders drive the readout even if the scene never comes up, so
       they are wired before anything that can fail. */
    function clampPair(changed) {
      var f = +fromEl.value, t = +toEl.value;
      if (f > t) {
        if (changed === fromEl) toEl.value = f;
        else fromEl.value = t;
      }
    }
    /* the chosen years are shown as numbers beside each slider; the markup
       carries the full range as a fallback for when this module never loads */
    var fromVal = document.getElementById("rain-from-val");
    var toVal = document.getElementById("rain-to-val");
    function syncSliderLabels() {
      if (fromVal) fromVal.textContent = fromEl.value;
      if (toVal) toVal.textContent = toEl.value;
    }

    fromEl.min = toEl.min = Y0;
    fromEl.max = toEl.max = Y1;
    fromEl.value = Y0;
    toEl.value = Y1;
    syncSliderLabels();
    [fromEl, toEl].forEach(function (input) {
      input.addEventListener("input", function () {
        clampPair(input);
        syncSliderLabels();
        update();
      });
    });

    /* ---------- renderer ---------- */

    var renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) { /* no WebGL: the box stays empty, chart views still work */ }
    if (!renderer) { update(); return; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "rain-canvas";
    box.appendChild(renderer.domElement);

    var labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = "rain-labels";
    box.appendChild(labelRenderer.domElement);

    var scene = new THREE.Scene();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8b8377, 1.1));

    /* A soft fill pinned to the camera, so orbiting round to the key light's
       shadow side doesn't leave the pile too dark to read. */
    var fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    scene.add(fillLight);
    scene.add(fillLight.target);

    var dirLight = new THREE.DirectionalLight(0xffffff, 1.55);
    dirLight.position.set(6, 14, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 14;
    dirLight.shadow.camera.bottom = -12;
    dirLight.shadow.camera.far = 60;
    scene.add(dirLight);

    var floorMat = new THREE.ShadowMaterial({ opacity: 0.16 });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    /* ---------- the key: what one book mesh is worth ----------
       Drawn as a second scissored pass in the corner of the same canvas, so
       the swatch is the actual mesh at an actual angle rather than a picture
       of one. Its label is DOM, pinned to match the viewport rectangle. */

    var KEY_SIZE = 62, KEY_PAD = 12;
    var keyScene = new THREE.Scene();
    var keyCam = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
    keyCam.position.set(1.35, 1.15, 2.0);
    keyCam.lookAt(0, 0, 0);
    keyScene.add(new THREE.HemisphereLight(0xffffff, 0x8b8377, 1.2));
    var keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
    keyLight.position.set(2, 3, 2.5);
    keyScene.add(keyLight);
    var keyMesh = null;

    var keyLabel = document.createElement("p");
    keyLabel.className = "rain-key";
    keyLabel.textContent = "≈ " + fmt(RAIN_PER_SPRITE) + " publications banned";
    keyLabel.style.left = (KEY_PAD + KEY_SIZE + 2) + "px";
    keyLabel.style.bottom = (KEY_PAD + KEY_SIZE / 2 - 10) + "px";
    box.appendChild(keyLabel);

    /* ---------- cameras ---------- */

    var camP = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);
    var camO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    var camera = camO;
    var projection = "orthographic";

    /* The controls only ever drive the perspective camera; the orthographic
       one is placed by hand and never handed over, which is what keeps its
       view locked. `target` is shared — it is just the point both look at. */
    var controls = new OrbitControls(camP, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI * 0.495; /* never dip under the floor */
    controls.minPolarAngle = 0.08;            /* nor tip over the top pole */
    controls.listenToKeyEvents(box);
    controls.enabled = false;                 /* orthographic starts locked */

    /* This is a scroll-driven story, so the scene must never swallow the
       reader's scroll. A plain wheel is stopped before OrbitControls sees it
       and scrolls the page; Ctrl/⌘ + wheel zooms. On touch, vertical swipes
       scroll and horizontal drags orbit. */
    box.addEventListener("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) e.stopPropagation();
    }, { capture: true });

    if (window.matchMedia("(pointer: coarse)").matches) {
      renderer.domElement.style.touchAction = "pan-y";
    }

    var userMoved = false;
    controls.addEventListener("start", function () { userMoved = true; });
    controls.addEventListener("change", requestRender);

    /* ---------- pile geometry & state ---------- */

    var mesh = null;         /* InstancedMesh, built once the geometry is ready */
    var BH = 0.24, BD = 0.7; /* measured from the loaded mesh */
    var layerH, spanX, spanY, spanZ, reach;
    var layout = { cols: COLS_X, levels: 1, heights: [], cells: [], total: 0 };
    var dummy = new THREE.Object3D();

    /* {x,y,z,vy, rx,ry,rz, vrx,vrz, tx,ty,tz, trx,tryaw,trz, settled} */
    var sprites = [];
    var spawnQueue = 0;
    var visible = false;
    var running = false;
    var ready = false;     /* geometry loaded, mesh built */
    var dirty = true;
    var W = 0, H = 0;

    /* Books land at any angle, so one can reach half its longest side past
       its anchor; the footprint carries that slack on every side. Layers sit
       looser than a book is thick so the tumbled ones have room to lean. */
    function measure() {
      layerH = Math.max(BH * 1.2, 0.15);
      reach = Math.max(BW, BD) / 2;
      spanX = COLS_X * (BW + GX) + 2 * reach;
      spanY = MAX_LEVELS * layerH + BH;
      spanZ = ROWS * (BD + GZ) + 2 * reach;
    }
    measure();

    function spanCount() {
      var a = Math.min(+fromEl.value, +toEl.value);
      var b = Math.max(+fromEl.value, +toEl.value);
      var sum = 0;
      for (var y = a; y <= b; y++) sum += perYear[y] || 0;
      return { from: a, to: b, count: sum };
    }

    function targetSprites(count) {
      return Math.min(RAIN_CAP, Math.ceil(count / RAIN_PER_SPRITE));
    }

    /*
     * Lay the books out as the cumulative chart. Each of COLS_X bins covers a
     * slice of the chosen years; its stack rises to the running total at the
     * end of that slice, so the heap's profile is the cumulative curve and
     * the far right edge is the full count. Books stay the unit of area, so
     * the number of levels is whatever spends the ~one-book-per-twelve budget
     * on the area under that curve — solved by trying each level count and
     * keeping the closest fit.
     */
    function buildLayout(span) {
      var total = span.count;
      var want = targetSprites(total);
      var years = span.to - span.from;
      var frac = [];
      for (var j = 0; j < COLS_X; j++) {
        var edge = span.from + Math.round((j + 1) / COLS_X * years);
        frac.push(total > 0 ? cumeTo(span.from, edge) / total : 0);
      }

      var best = null;
      for (var L = 1; L <= MAX_LEVELS; L++) {
        var heights = [], sum = 0;
        for (var k = 0; k < COLS_X; k++) {
          var h = Math.round(frac[k] * L);
          heights.push(h);
          sum += h;
        }
        var n = ROWS * sum;
        if (n > RAIN_CAP) break;
        if (!best || Math.abs(n - want) < Math.abs(best.n - want)) {
          best = { levels: L, heights: heights, n: n };
        }
      }
      if (!best) best = { levels: 1, heights: frac.map(function () { return 0; }), n: 0 };

      /* bottom-up so the pile fills like a pile, not column by column */
      var cells = [];
      for (var lv = 0; lv < best.levels; lv++) {
        for (var c = 0; c < COLS_X; c++) {
          if (best.heights[c] <= lv) continue;
          for (var r = 0; r < ROWS; r++) cells.push({ col: c, row: r, lv: lv });
        }
      }
      return {
        cols: COLS_X, levels: Math.max(1, best.levels),
        heights: best.heights, cells: cells, total: total,
        from: span.from, to: span.to
      };
    }

    /* deterministic jitter so every rebuild lays the same pile */
    function jit(i, salt) {
      var x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
      return x - Math.floor(x);
    }

    /* A dumped heap, not masonry. The cell fixes which part of the curve a
       book belongs to; everything after that is thrown — nearly a whole cell
       of drift both ways, any yaw at all, a lean on both axes, and enough
       height stagger that books overlapping in plan rest across each other
       instead of through. The profile survives the mess because the cell
       counts, not the individual positions, carry the shape. */
    function placeOf(i) {
      var c = layout.cells[i];
      if (!c) return { x: 0, y: BH / 2, z: 0, rx: 0, ry: 0, rz: 0 };
      var innerX = spanX - 2 * reach, innerZ = spanZ - 2 * reach;
      var stepX = innerX / layout.cols, stepZ = innerZ / ROWS;
      return {
        x: (c.col + 0.5) * stepX - innerX / 2 + (jit(i, 1) - 0.5) * stepX * 0.85,
        y: c.lv * layerH + BH / 2 + (jit(i, 11) - 0.5) * layerH * 0.45,
        z: (c.row + 0.5) * stepZ - innerZ / 2 + (jit(i, 2) - 0.5) * stepZ * 0.85,
        rx: (jit(i, 12) - 0.5) * 0.34,
        ry: jit(i, 8) * Math.PI * 2,
        rz: (jit(i, 13) - 0.5) * 0.34
      };
    }

    function filledLayers() {
      return Math.max(1, layout.levels);
    }

    function pileTop() {
      return filledLayers() * layerH;
    }

    function writeMatrices() {
      if (!mesh) return;
      for (var i = 0; i < sprites.length; i++) {
        var s = sprites[i];
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(s.rx, s.ry, s.rz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = sprites.length;
      mesh.instanceMatrix.needsUpdate = true;
    }

    /* ---------- the corner scale axis ---------- */

    var axisGroup = null;
    var axisMat = new THREE.LineBasicMaterial();
    var showLabels = true;

    /* The axis hangs off one of the four upright corners. Index 0 is the
       front-left one the default view looks at; as the reader orbits, it
       hops to whichever corner faces the camera so the ticks stay beside
       the pile instead of behind it. */
    var CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    var axisCorner = 0;

    /* Stood off far enough that a tumbled book on the near edge cannot
       project across the tick line from a three-quarter view. */
    function cornerPos(i) {
      return new THREE.Vector3(
        CORNERS[i][0] * (spanX / 2 + 0.62), 0, CORNERS[i][1] * (spanZ / 2 + 0.38));
    }

    /* Chosen from the view direction alone, so it depends on which way the
       reader is looking and not on how far out they have zoomed. */
    function cornerForDir(dir) {
      var best = 0, bestD = -Infinity;
      for (var i = 0; i < 4; i++) {
        var d = cornerPos(i).dot(dir); /* corners sit at y = 0, so this is azimuthal */
        if (d > bestD) { bestD = d; best = i; }
      }
      return best;
    }

    function viewDir() {
      return new THREE.Vector3()
        .subVectors(camera.position, controls.target).normalize();
    }

    function clearAxis() {
      if (!axisGroup) return;
      axisGroup.traverse(function (o) {
        if (o.isCSS2DObject && o.element && o.element.parentNode) o.element.remove();
        if (o.geometry) o.geometry.dispose();
      });
      scene.remove(axisGroup);
      axisGroup = null;
    }

    /* `out` is the outward x direction, so labels always sit clear of the pile. */
    function label(str, x, y, z, out, isTotal) {
      var div = document.createElement("div");
      div.className = "rain-label" + (isTotal ? " is-total" : "");
      div.textContent = str;
      var obj = new CSS2DObject(div);
      obj.position.set(x, y, z);
      obj.center.set(out > 0 ? 0 : 1, 0.5);
      return obj;
    }

    /* How many height ticks the pile can carry without them colliding, from
       how tall it actually draws at the current framing. */
    function tickBudget(top) {
      var dist = camera.position.distanceTo(controls.target);
      if (!H || dist < 0.01) return 4;
      var worldPerPx = projection === "orthographic"
        ? (camO.top - camO.bottom) / (camO.zoom || 1) / H
        : 2 * dist * Math.tan(FOV * Math.PI / 360) / H;
      return Math.max(1, Math.min(5, Math.round(top / worldPerPx / 44)));
    }

    /* Hangs below its anchor rather than beside it — for the year axis. */
    function footLabel(str, x, y, z) {
      var div = document.createElement("div");
      div.className = "rain-label is-year";
      div.textContent = str;
      var obj = new CSS2DObject(div);
      obj.position.set(x, y, z);
      obj.center.set(0.5, 0);
      return obj;
    }

    /* Two axes, because the heap is now a chart: height ticks reading the
       running total (a stack `k` levels high is k/levels of the way to the
       final count) and year marks along the base the profile is plotted
       against. */
    var axisTotal = 0;
    function buildAxis(total) {
      clearAxis();
      if (!ready) return;
      axisTotal = total;
      axisGroup = new THREE.Group();
      axisGroup.visible = showLabels;

      var base = cornerPos(axisCorner);
      var ax = base.x, az = base.z;
      var out = CORNERS[axisCorner][0]; /* +1 if the axis is on the right */
      var layers = filledLayers();
      var top = pileTop();
      var pts = [new THREE.Vector3(ax, 0, az), new THREE.Vector3(ax, top, az)];
      /* one tick per ~44px of drawn pile, so a short box or a small range
         gets a couple of readable marks instead of a stack of collisions */
      var every = Math.max(1, Math.ceil(layers / tickBudget(top)));

      for (var k = every; k < layers; k += every) {
        var at = Math.round(k / layers * total);
        var y = k * layerH;
        pts.push(new THREE.Vector3(ax, y, az),
                 new THREE.Vector3(ax + out * 0.28, y, az));
        axisGroup.add(label(fmt(at), ax + out * 0.36, y, az, out, false));
      }
      axisGroup.add(label(fmt(total) + " banned",
        ax + out * 0.36, top + layerH * 1.2, az, out, true));

      /* year axis along the near base edge */
      var innerX = spanX - 2 * reach;
      var fz = CORNERS[axisCorner][1] * (spanZ / 2 + 0.38);
      pts.push(new THREE.Vector3(-innerX / 2 - reach, 0, fz),
               new THREE.Vector3(innerX / 2 + reach, 0, fz));
      [0, 0.5, 1].forEach(function (t) {
        var x = (t - 0.5) * innerX;
        var year = Math.round(layout.from + t * (layout.to - layout.from));
        pts.push(new THREE.Vector3(x, 0, fz),
                 new THREE.Vector3(x, -layerH * 0.5, fz));
        axisGroup.add(footLabel(String(year), x, -layerH * 0.7, fz));
      });

      axisGroup.add(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(pts), axisMat));
      scene.add(axisGroup);
      labelRenderer.domElement.style.display = showLabels ? "" : "none";
    }

    /* the floor "line" of the old 2D box, as a footprint frame */
    var frame = null;
    function buildFrame() {
      if (frame) { scene.remove(frame); frame.geometry.dispose(); }
      var fx = spanX / 2 + 0.2, fz = spanZ / 2 + 0.3;
      var pts = [
        new THREE.Vector3(-fx, 0, -fz), new THREE.Vector3(fx, 0, -fz),
        new THREE.Vector3(fx, 0, fz), new THREE.Vector3(-fx, 0, fz)
      ];
      frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), axisMat);
      scene.add(frame);
    }

    /* ---------- camera framing ---------- */

    function aspect() {
      return W / Math.max(1, H);
    }

    /* The box the camera has to hold: the pile, plus `pad` on whichever side
       the axis currently hangs and room above it for the total. */
    function pileBounds(pad) {
      var top = Math.max(pileTop(), layerH * 2);
      var out = CORNERS[axisCorner][0];
      return new THREE.Box3(
        new THREE.Vector3(-spanX / 2 - (out < 0 ? pad : 0.2),
                          -layerH * 1.4, -spanZ / 2 - 0.5),
        new THREE.Vector3(spanX / 2 + (out > 0 ? pad : 0.2),
                          top + layerH * 2.4, spanZ / 2 + 0.5)
      );
    }

    function setAxisCorner(nc) {
      if (!ready || nc === axisCorner) return false;
      axisCorner = nc;
      buildAxis(axisTotal);
      return true;
    }

    /* Exact fit: push the camera back only as far as the furthest-out corner
       of that box requires. A bounding-sphere fit would leave a wide flat
       pile swimming in empty space, especially in a short, wide box. */
    function fitDistance(target, dir, bounds) {
      var fwd = dir.clone().negate();
      var right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      var up = new THREE.Vector3().crossVectors(right, fwd).normalize();
      var tanV = Math.tan(FOV * Math.PI / 360);
      var tanH = tanV * aspect();
      var c = new THREE.Vector3();
      var d = 0;
      for (var i = 0; i < 8; i++) {
        c.set(i & 1 ? bounds.max.x : bounds.min.x,
              i & 2 ? bounds.max.y : bounds.min.y,
              i & 4 ? bounds.max.z : bounds.min.z).sub(target);
        var along = c.dot(fwd);
        d = Math.max(d,
          Math.abs(c.dot(right)) / tanH - along,
          Math.abs(c.dot(up)) / tanV - along);
      }
      return d * 1.04;
    }

    /* Keep the two cameras showing the same thing: an orthographic frustum
       built from the perspective one's distance matches its apparent size. */
    function syncOrthoFrustum() {
      var dist = camO.position.distanceTo(controls.target) || 1;
      var h = 2 * dist * Math.tan(FOV * Math.PI / 360);
      var w = h * aspect();
      camO.left = -w / 2; camO.right = w / 2;
      camO.top = h / 2; camO.bottom = -h / 2;
      camO.updateProjectionMatrix();
    }

    function applyViewport() {
      W = box.clientWidth;
      H = box.clientHeight;
      if (W < 10 || H < 10) return;
      renderer.setSize(W, H);
      labelRenderer.setSize(W, H);
      camP.aspect = aspect();
      camP.updateProjectionMatrix();
      syncOrthoFrustum();
      requestRender();
    }

    /* OrbitControls keeps spin and pan as inertia that it applies on the next
       update(). Setting the camera without draining that first lets it land
       on top of the placement, so the same reset — or the same return from
       the locked view — arrives somewhere slightly different each time. An
       update() with damping off both applies and clears it. */
    function placePerspective(target, pos) {
      var damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.target.copy(target);
      camP.position.copy(pos);
      camP.aspect = aspect();
      camP.updateProjectionMatrix();
      controls.update();
      controls.enableDamping = damping;
    }

    function homeDir() {
      return projection === "orthographic"
        ? new THREE.Vector3().setFromSpherical(
            new THREE.Spherical(1, ORTHO_POLAR, ORTHO_AZIM))
        : new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, POLAR, AZIM));
    }

    function resetView() {
      var dir = homeDir();
      /* settle the axis first — it decides which side the bounds pad */
      setAxisCorner(cornerForDir(dir));
      var bounds = pileBounds(LABEL_PAD);
      var target = bounds.getCenter(new THREE.Vector3());
      var dist = fitDistance(target, dir, bounds);

      /* Labels are DOM, so they stay LABEL_PX wide however far the camera
         sits. In a narrow box that fixed width outgrows the world-space
         margin and the total gets clipped, so widen the margin to whatever
         LABEL_PX works out to at this framing and fit once more. */
      var worldPerPx = 2 * dist * Math.tan(FOV * Math.PI / 360) / Math.max(1, H);
      var need = LABEL_PX * worldPerPx;
      if (need > LABEL_PAD) {
        bounds = pileBounds(need);
        bounds.getCenter(target);
        dist = fitDistance(target, dir, bounds);
      }

      controls.minDistance = spanX * 0.25;
      controls.maxDistance = dist * 4;

      if (projection === "orthographic") {
        /* placed by hand — the controls never touch this camera, so nothing
           can clamp the square-on angle or carry inertia into it */
        controls.target.copy(target);
        camO.position.copy(target).addScaledVector(dir, dist);
        camO.up.set(0, 1, 0);
        camO.lookAt(target);
        camO.zoom = 1;
        syncOrthoFrustum();
      } else {
        placePerspective(target,
          target.clone().addScaledVector(dir, dist));
      }

      /* the tick budget is read off the camera, so it has to be recomputed
         here or a reset keeps whatever count the last orbit happened to leave */
      if (ready) buildAxis(axisTotal);

      userMoved = false;
      requestRender();
    }

    /* Re-frame as the pile grows or shrinks, but never fight a reader who
       has taken hold of the camera. */
    function autoFrame() {
      if (!userMoved) resetView();
    }

    /* Where the reader had left the perspective camera, so switching out to
       read the chart and back does not throw their viewpoint away. */
    var perspView = null;

    function setProjection(name) {
      if (name === projection || !ready) return;

      if (projection === "perspective") {
        perspView = {
          pos: camP.position.clone(),
          target: controls.target.clone(),
          moved: userMoved
        };
      }

      projection = name;
      camera = name === "orthographic" ? camO : camP;
      controls.enabled = name === "perspective";
      box.classList.toggle("is-locked", name === "orthographic");
      if (resetBtn) resetBtn.disabled = name === "orthographic";
      setHint();

      if (name === "perspective" && perspView) {
        placePerspective(perspView.target, perspView.pos);
        userMoved = perspView.moved;
        /* The locked view parks the axis on the front-left corner. Coming
           back lands the camera exactly where the controls already had it,
           so update() reports no change and the per-frame corner sync never
           fires — the axis has to be put back on the orbit's corner here. */
        if (ready) {
          setAxisCorner(cornerForDir(viewDir()));
          buildAxis(axisTotal);
        }
      } else {
        resetView();
      }
      requestRender();
    }

    /* ---------- theme ---------- */

    function applyTheme() {
      var th = Charts.theme();
      axisMat.color.set(th.axis);
      floorMat.opacity =
        document.documentElement.dataset.theme === "dark" ? 0.34 : 0.16;
      if (mesh) {
        var c = new THREE.Color();
        for (var i = 0; i < RAIN_CAP; i++) {
          mesh.setColorAt(i, c.set(th.slots[i % th.slots.length]));
        }
        mesh.instanceColor.needsUpdate = true;
      }
      if (keyMesh) keyMesh.material.color.set(th.slots[0]);
      requestRender();
    }

    /* ---------- animation ---------- */

    function spawnOne() {
      var i = sprites.length;
      var p = placeOf(i);
      sprites.push({
        x: p.x + (jit(i, 3) - 0.5) * 3,
        y: spanY * 1.1 + jit(i, 4) * spanY * 1.6,
        z: p.z + (jit(i, 5) - 0.5) * 1.5,
        vy: -(0.03 + jit(i, 6) * 0.05),
        rx: (jit(i, 7) - 0.5) * 2.4,
        ry: p.ry + (jit(i, 10) - 0.5) * 1.2,
        rz: (jit(i, 14) - 0.5) * 2.0,
        vrx: (jit(i, 9) - 0.5) * 0.14,
        vrz: (jit(i, 15) - 0.5) * 0.11,
        tx: p.x, ty: p.y, tz: p.z,
        trx: p.rx, tryaw: p.ry, trz: p.rz,
        mode: "fall",
        settled: false
      });
    }

    /* Moving the year handles redraws the curve, so books already down have
       somewhere new to be. They glide there instead of falling — gravity only
       makes sense for the ones still arriving. */
    function retarget() {
      for (var i = 0; i < sprites.length; i++) {
        var s = sprites[i], p = placeOf(i);
        var shift = Math.abs(p.x - s.tx) + Math.abs(p.y - s.ty) + Math.abs(p.z - s.tz);
        s.tx = p.x; s.ty = p.y; s.tz = p.z;
        s.trx = p.rx; s.tryaw = p.ry; s.trz = p.rz;
        if (shift > 1e-4 && s.settled) {
          s.settled = false;
          s.mode = "move";
        }
      }
    }

    /* Returns whether another frame is needed. `moved` is tracked separately:
       on the frame the last book lands nothing is left in motion, but its
       resting position still has to reach the instance matrices — otherwise
       it stays drawn one step short of the pile, forever. */
    /* Scissoring the second pass keeps its clear inside the corner square,
       so the key sits on the page background rather than wiping the scene. */
    function drawKey() {
      if (!keyMesh) return;
      renderer.setScissorTest(true);
      renderer.setViewport(KEY_PAD, KEY_PAD, KEY_SIZE, KEY_SIZE);
      renderer.setScissor(KEY_PAD, KEY_PAD, KEY_SIZE, KEY_SIZE);
      renderer.render(keyScene, keyCam);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W, H);
    }

    var moved = false;
    function advance() {
      var active = false;
      moved = false;
      if (spawnQueue > 0) {
        var batch = Math.min(spawnQueue, 5);
        for (var b = 0; b < batch; b++) spawnOne();
        spawnQueue -= batch;
        active = true;
      }
      sprites.forEach(function (s) {
        if (s.settled) return;
        moved = true;
        if (s.mode === "move") {
          s.x += (s.tx - s.x) * 0.16;
          s.y += (s.ty - s.y) * 0.16;
          s.z += (s.tz - s.z) * 0.16;
          s.rx += (s.trx - s.rx) * 0.16;
          s.ry += (s.tryaw - s.ry) * 0.16;
          s.rz += (s.trz - s.rz) * 0.16;
          if (Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) +
              Math.abs(s.tz - s.z) < 0.004) {
            s.x = s.tx; s.y = s.ty; s.z = s.tz;
            s.rx = s.trx; s.ry = s.tryaw; s.rz = s.trz;
            s.settled = true;
          } else {
            active = true;
          }
          return;
        }
        s.vy = Math.max(s.vy - 0.012, -0.34);
        s.y += s.vy;
        s.x += (s.tx - s.x) * 0.08;
        s.z += (s.tz - s.z) * 0.08;
        s.rx += s.vrx;
        s.rz += s.vrz;
        s.ry += (s.tryaw - s.ry) * 0.08;
        if (s.y <= s.ty) {
          s.y = s.ty; s.x = s.tx; s.z = s.tz;
          s.rx = s.trx; s.ry = s.tryaw; s.rz = s.trz;
          s.settled = true;
        } else {
          active = true;
        }
      });
      if (moved) writeMatrices();
      return active;
    }

    function tick() {
      running = false;
      var moving = ready ? advance() : false;
      /* the orthographic camera is placed by hand, so the controls are only
         stepped — damping and all — while perspective is the live one */
      var camChanged = projection === "perspective" ? controls.update() : false;
      if (camChanged && ready) setAxisCorner(cornerForDir(viewDir()));
      if (moved || camChanged || dirty) {
        fillLight.position.copy(camera.position);
        fillLight.target.position.copy(controls.target);
        fillLight.target.updateMatrixWorld();
        renderer.render(scene, camera);
        drawKey();
        if (showLabels) labelRenderer.render(scene, camera);
        dirty = false;
      }
      if (visible && (moving || camChanged)) {
        running = true;
        requestAnimationFrame(tick);
      }
    }

    function wake() {
      if (!running) {
        running = true;
        requestAnimationFrame(tick);
      }
    }

    function requestRender() {
      dirty = true;
      wake();
    }

    function snapRemaining() {
      while (spawnQueue > 0) { spawnOne(); spawnQueue--; }
      sprites.forEach(function (s) {
        s.x = s.tx; s.y = s.ty; s.z = s.tz;
        s.rx = s.trx; s.ry = s.tryaw; s.rz = s.trz;
        s.settled = true;
      });
      writeMatrices();
      requestRender();
    }

    function update() {
      var span = spanCount();
      readout.textContent = span.from + "–" + span.to + " · " + fmt(span.count) +
        " publications banned";
      if (!ready) return; /* re-run once the mesh has loaded */

      layout = buildLayout(span);
      var want = layout.cells.length;
      if (want < sprites.length) sprites.length = want;
      retarget();
      spawnQueue = want - sprites.length;
      writeMatrices();

      /* the curve decides how many books it takes, so state the real rate */
      keyLabel.textContent = "≈ " +
        fmt(want ? Math.round(span.count / want) : RAIN_PER_SPRITE) +
        " publications banned";

      if (reduced.matches) snapRemaining();
      buildAxis(span.count);
      autoFrame();
      requestRender();
    }

    /* ---------- the book mesh ---------- */

    /* Flatten the FBX into one geometry, lie it flat (thinnest dimension up,
       widest along x), scale it to BW wide and centre it on the origin. The
       file also carries a camera and a light; only meshes are collected. */
    function prepGeometry(root) {
      var geos = [];
      root.updateMatrixWorld(true);
      root.traverse(function (o) {
        if (o.isMesh && o.geometry) {
          var g = o.geometry.clone();
          g.applyMatrix4(o.matrixWorld);
          for (var name in g.attributes) {
            if (name !== "position" && name !== "normal") g.deleteAttribute(name);
          }
          g.morphAttributes = {};
          if (g.index) g = g.toNonIndexed();
          geos.push(g);
        }
      });
      if (!geos.length) return null;
      var geo = geos.length === 1
        ? geos[0]
        : BufferGeometryUtils.mergeGeometries(geos, false);
      if (!geo) return null;
      var size = new THREE.Vector3();
      geo.computeBoundingBox();
      geo.boundingBox.getSize(size);
      var min = Math.min(size.x, size.y, size.z);
      if (min === size.x) geo.rotateZ(Math.PI / 2);
      else if (min === size.z) geo.rotateX(Math.PI / 2);
      geo.computeBoundingBox();
      geo.boundingBox.getSize(size);
      if (size.z > size.x) geo.rotateY(Math.PI / 2);
      geo.computeBoundingBox();
      geo.boundingBox.getSize(size);
      geo.scale(BW / size.x, BW / size.x, BW / size.x);
      geo.computeBoundingBox();
      var c = new THREE.Vector3();
      geo.boundingBox.getCenter(c);
      geo.translate(-c.x, -c.y, -c.z);
      geo.boundingBox.getSize(size);
      BH = size.y;
      BD = size.z;
      if (!geo.attributes.normal) geo.computeVertexNormals();
      return geo;
    }

    function buildMesh(geo) {
      var mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
      mesh = new THREE.InstancedMesh(geo, mat, RAIN_CAP);
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);

      keyMesh = new THREE.Mesh(geo,
        new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }));
      keyMesh.rotation.set(0.1, -0.62, 0.05);
      keyScene.add(keyMesh);

      measure();
      buildFrame();
      applyTheme();
      ready = true;
      update();
      resetView();
    }

    new FBXLoader().load(
      "asset/mesh/book.fbx",
      function (root) {
        var geo = prepGeometry(root);
        buildMesh(geo || new THREE.BoxGeometry(BW, 0.24, 0.7));
      },
      undefined,
      function () {
        /* mesh unavailable: plain slabs keep the visual alive */
        buildMesh(new THREE.BoxGeometry(BW, 0.24, 0.7));
      }
    );

    /* ---------- controls & wiring ---------- */

    var hintEl = document.getElementById("rain-hint-text");
    var resetBtn = document.getElementById("rain-reset");

    function setHint() {
      if (!hintEl) return;
      hintEl.textContent = projection === "orthographic"
        ? "Locked square-on so the pile reads as the chart — switch to Perspective to move the camera. Drag the bottom-right corner to resize the box."
        : "Drag to orbit · Ctrl/⌘ + scroll to zoom · right-drag to pan · arrow keys nudge once focused · drag the bottom-right corner to resize the box";
    }

    var projButtons = Array.prototype.slice.call(
      document.querySelectorAll(".rain-proj button"));
    projButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        projButtons.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        setProjection(btn.dataset.proj);
      });
    });

    box.classList.add("is-locked");
    if (resetBtn) resetBtn.disabled = true;
    setHint();

    var labelBtn = document.getElementById("rain-labels");
    if (labelBtn) {
      labelBtn.addEventListener("click", function () {
        showLabels = !showLabels;
        labelBtn.setAttribute("aria-pressed", showLabels ? "true" : "false");
        if (axisGroup) axisGroup.visible = showLabels;
        labelRenderer.domElement.style.display = showLabels ? "" : "none";
        requestRender();
      });
    }

    if (resetBtn) resetBtn.addEventListener("click", resetView);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible = entry.isIntersecting;
        if (visible) requestRender();
      });
    }, { rootMargin: "60px" });
    io.observe(box);

    var pendingSize = false;
    new ResizeObserver(function () {
      if (pendingSize) return;
      pendingSize = true;
      requestAnimationFrame(function () {
        pendingSize = false;
        applyViewport();
        autoFrame();
        if (ready) buildAxis(axisTotal); /* the tick budget follows the size */
      });
    }).observe(box);

    window.addEventListener("themechange", applyTheme);

    applyViewport();
    update();

    /* view toggle: rain box vs the three real charts */
    var views = {
      rain: document.getElementById("rain-view-rain"),
      year: document.getElementById("rain-view-year"),
      decade: document.getElementById("rain-view-decade"),
      cume: document.getElementById("rain-view-cume")
    };
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".rain-views button"));
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        for (var name in views) {
          views[name].hidden = name !== btn.dataset.view;
        }
        if (btn.dataset.view === "rain") {
          applyViewport();
          requestRender();
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
