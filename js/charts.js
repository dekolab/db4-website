/*
 * Interactive SVG charts for the PPPA story. Vanilla JS, no dependencies.
 *
 * Both palettes validated (lightness band, chroma floor, CVD adjacency,
 * contrast) against their own chart surface — dark is a selected set of
 * steps, not an automatic flip of the light one:
 *   light on #ffffff: #2e64ad #c0392b #b3892b #6f5bb5 #3d8a52 #c96b13
 *   dark  on #221d19: #5b8ad0 #cf5f64 #b08d24 #8a77cb #4a9a63 #c0762a
 * Slot 1 is the brand navy (#022c5f, stepped into the mark lightness band);
 * red and gold echo the Malaysian flag. Sequential heatmap ramp: one navy
 * hue; light mode runs light -> dark, dark mode anchors near the surface
 * and brightens with magnitude.
 */
var Charts = (function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  /* The five research clusters keep their slot positions from the earlier
     six-cluster taxonomy so each cluster keeps its colour. */
  var CLUSTER_NAMES = [
    "Subversive Ideological And Political Content",
    "Obscene / Immoral Publications",
    "General/Unidentified",
    "Religious Doctrinal Deviance",
    "Race, Religion & Royalty (3R Issues)"
  ];

  var CLUSTER_SHORT = {
    "Subversive Ideological And Political Content": "Subversive/political",
    "Obscene / Immoral Publications": "Obscene/immoral",
    "General/Unidentified": "General/unidentified",
    "Religious Doctrinal Deviance": "Religious deviance",
    "Race, Religion & Royalty (3R Issues)": "3R issues"
  };

  /* Cluster and subcluster definitions are read out of the Taxonomy tab's
     table rather than duplicated here, so a tooltip can never drift from the
     published codebook. Three dataset keys are spelled differently there. */
  var DEF_ALIAS = {
    "Other": "Others",
    "Royalty": "Insults to royalty",
    "Administrative/Unclear Ground": "Administrative / unclear rationale"
  };

  /* The five names the podiums and the story lean on have no codebook row to
     read from, so their one-line identifications live here and ride the same
     tooltip machinery as the taxonomy terms. */
  var PEOPLE_DEFS = {
    "Wei Wei": "Chinese-language erotic/romance author.",
    "Ustaz Ashaari Muhammad":
      "Founder of Al-Arqam, which is banned by the federal security law and state fatwas.",
    "Marcus Van Heller": "Pen name associated with British erotic novelist John Stevenson.",
    "Yayasan Perkhabaran Injil": "Jakarta-based Christian publisher.",
    "Sam Luen Bookshop": "Publisher of numerous communist/socialist works in the 1950s."
  };

  var defs = null;
  var people = null;

  function defKey(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function taxonomy() {
    if (defs) return defs;
    defs = {};
    var add = function (labelCell) {
      var defCell = labelCell && labelCell.nextElementSibling;
      if (!defCell) return;
      var label = labelCell.textContent.trim().replace(/\s+/g, " ");
      defs[defKey(label)] = {
        label: label,
        def: defCell.textContent.trim().replace(/\s+/g, " ")
      };
    };
    document.querySelectorAll("#view-taxonomy .doc-table tbody tr").forEach(function (tr) {
      add(tr.querySelector("td.doc-tcluster"));
      add(tr.querySelector("td.doc-tsub"));
    });
    return defs;
  }

  function named() {
    if (people) return people;
    people = {};
    Object.keys(PEOPLE_DEFS).forEach(function (label) {
      people[defKey(label)] = { label: label, def: PEOPLE_DEFS[label] };
    });
    return people;
  }

  function definition(name) {
    var key = defKey(DEF_ALIAS[name] || name);
    return taxonomy()[key] || named()[key] || null;
  }

  var THEMES = {
    light: {
      ink: "#221e1c", muted: "#79706a", grid: "#ece5da", axis: "#d9cfc2",
      surface: "#ffffff",
      series: { blue: "#2e64ad", crimson: "#c0392b", green: "#3d8a52", gold: "#b3892b" },
      slots: ["#2e64ad", "#c0392b", "#b3892b", "#6f5bb5", "#3d8a52", "#c96b13"],
      rampFrom: [233, 239, 249], rampTo: [2, 44, 95],
      cellHi: "#ffffff", cellLo: "#221e1c"
    },
    dark: {
      ink: "#e9e1d7", muted: "#9a9088", grid: "#332c26", axis: "#443b33",
      surface: "#221d19",
      series: { blue: "#5b8ad0", crimson: "#cf5f64", green: "#4a9a63", gold: "#b08d24" },
      slots: ["#5b8ad0", "#cf5f64", "#b08d24", "#8a77cb", "#4a9a63", "#c0762a"],
      rampFrom: [38, 38, 42], rampTo: [151, 193, 245],
      cellHi: "#221d19", cellLo: "#e9e1d7"
    }
  };

  function T() {
    return document.documentElement.dataset.theme === "dark" ? THEMES.dark : THEMES.light;
  }

  function clusterColor(name) {
    var i = CLUSTER_NAMES.indexOf(name);
    return i === -1 ? T().series.blue : T().slots[i];
  }

  function seriesColor(key) {
    return T().series[key] || T().series.blue;
  }

  function fmt(n) {
    return Number(n).toLocaleString("en-US");
  }

  /* ---------- svg helpers ---------- */

  function el(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(parent, str, attrs) {
    var t = el("text", attrs, parent);
    t.textContent = str;
    return t;
  }

  /* Clean tick steps whose top tick always covers the data max. */
  function niceTicks(max, count) {
    if (max <= 0) return [0, 1];
    var raw = max / count;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = 10 * mag;
    [1, 2, 2.5, 5, 10].some(function (m) {
      if (raw <= m * mag) { step = m * mag; return true; }
      return false;
    });
    var top = Math.ceil(max / step - 1e-9) * step;
    var ticks = [];
    for (var v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
    return ticks;
  }

  /* Bar with a 4px rounded data-end, square at the baseline. */
  function barRight(x, y, w, h, r) {
    r = Math.min(r, w, h / 2);
    return "M" + x + "," + y +
      "h" + (w - r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r +
      "v" + (h - 2 * r) + "a" + r + "," + r + " 0 0 1 " + (-r) + "," + r +
      "h" + (r - w) + "z";
  }

  function barTop(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    return "M" + x + "," + (y + h) +
      "v" + (r - h) + "a" + r + "," + r + " 0 0 1 " + r + "," + (-r) +
      "h" + (w - 2 * r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r +
      "v" + (h - r) + "z";
  }

  /* ---------- shared tooltip (textContent only) ---------- */

  var tip = null;

  function tooltip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "chart-tip";
      tip.setAttribute("role", "status");
      document.body.appendChild(tip);
    }
    return tip;
  }

  /* `note` is an optional sentence appended under the figures — used where a
     row's subject also carries a definition, so one tooltip serves both. */
  function tipShow(lines, x, y, note) {
    var t = tooltip();
    t.textContent = "";
    t.classList.remove("is-def");
    lines.forEach(function (line) {
      var row = document.createElement("div");
      if (line.swatch) {
        var sw = document.createElement("span");
        sw.className = "tip-key";
        sw.style.background = line.swatch;
        row.appendChild(sw);
      }
      var strong = document.createElement("strong");
      strong.textContent = line.value;
      row.appendChild(strong);
      var label = document.createElement("span");
      label.textContent = " " + line.label;
      row.appendChild(label);
      t.appendChild(row);
    });
    if (note) {
      var body = document.createElement("span");
      body.className = "tip-def tip-note";
      body.textContent = note;
      t.appendChild(body);
    }
    t.style.opacity = "1";
    tipMove(x, y);
  }

  function tipMove(x, y) {
    var t = tooltip();
    var r = t.getBoundingClientRect();
    var px = Math.min(x + 14, window.innerWidth - r.width - 8);
    var py = y - r.height - 12;
    if (py < 8) py = y + 18;
    t.style.transform = "translate(" + Math.max(8, px) + "px," + py + "px)";
  }

  function tipHide() {
    if (tip) tip.style.opacity = "0";
  }

  /* Same tooltip element, prose layout: a term and its codebook definition. */
  function tipShowDef(entry, x, y) {
    var t = tooltip();
    t.textContent = "";
    t.classList.add("is-def");
    var term = document.createElement("strong");
    term.className = "tip-term";
    term.textContent = entry.label;
    t.appendChild(term);
    var body = document.createElement("span");
    body.className = "tip-def";
    body.textContent = entry.def;
    t.appendChild(body);
    t.style.opacity = "1";
    tipMove(x, y);
  }

  /* Attaches the taxonomy definition of `name` to a node. Returns false when
     the name has no entry, so callers can skip drawing the affordance. */
  function definable(node, name) {
    var entry = definition(name);
    if (!entry) return false;
    node.classList.add("has-def");
    node.setAttribute("tabindex", "0");
    node.addEventListener("pointerenter", function (e) { tipShowDef(entry, e.clientX, e.clientY); });
    node.addEventListener("pointermove", function (e) { tipMove(e.clientX, e.clientY); });
    node.addEventListener("pointerleave", tipHide);
    node.addEventListener("focus", function () {
      var r = node.getBoundingClientRect();
      tipShowDef(entry, r.left + r.width / 2, r.top);
    });
    node.addEventListener("blur", tipHide);
    return true;
  }

  /* An SVG axis label is a thin hover target, so a definable one gets a
     transparent rect over its whole gutter row plus a dotted rule under the
     glyphs — the usual "there is a definition here" affordance. */
  function defLabel(svg, node, name, box, th) {
    if (!definition(name)) return;
    var w = 0;
    try { w = node.getComputedTextLength(); } catch (e) { w = 0; }
    if (w) {
      var x2 = Number(node.getAttribute("x"));
      var x1 = node.getAttribute("text-anchor") === "end" ? x2 - w : x2;
      if (node.getAttribute("text-anchor") === "middle") { x1 = x2 - w / 2; x2 = x1 + w; }
      else if (node.getAttribute("text-anchor") !== "end") { x2 = x1 + w; }
      el("line", {
        x1: x1, x2: x2,
        y1: Number(node.getAttribute("y")) + 3.5, y2: Number(node.getAttribute("y")) + 3.5,
        stroke: th.muted, "stroke-width": 1, "stroke-dasharray": "1 2", opacity: 0.75
      }, svg);
    }
    var hit = el("rect", {
      x: box.x, y: box.y, width: box.w, height: box.h, fill: "transparent"
    }, svg);
    definable(hit, name);
  }

  function hoverable(node, lines, note) {
    node.setAttribute("tabindex", "0");
    node.classList.add("hit");
    node.addEventListener("pointerenter", function (e) { tipShow(lines, e.clientX, e.clientY, note); });
    node.addEventListener("pointermove", function (e) { tipMove(e.clientX, e.clientY); });
    node.addEventListener("pointerleave", tipHide);
    node.addEventListener("focus", function () {
      var r = node.getBoundingClientRect();
      tipShow(lines, r.left + r.width / 2, r.top, note);
    });
    node.addEventListener("blur", tipHide);
  }

  /* ---------- responsive, theme-aware mount ---------- */

  var drawFns = [];

  function mount(root, render) {
    if (!root) return;
    var pending = false;
    function draw() {
      pending = false;
      if (root.clientWidth < 40 || root.clientHeight < 40) return;
      root.textContent = "";
      render(root, root.clientWidth, root.clientHeight);
    }
    drawFns.push(draw);
    var ro = new ResizeObserver(function () {
      if (!pending) {
        pending = true;
        requestAnimationFrame(draw);
      }
    });
    ro.observe(root);
    draw();
  }

  function redraw() {
    document.querySelectorAll(".legend-swatch[data-cluster]").forEach(function (sw) {
      sw.style.background = clusterColor(sw.dataset.cluster);
    });
    drawFns.forEach(function (d) { d(); });
  }

  window.addEventListener("themechange", redraw);

  /* ---------- horizontal bars ---------- */

  function barsH(root, opts) {
    mount(root, function (node, W, H) {
      var th = T();
      var items = opts.items;
      var n = items.length;
      var labelW = opts.labelWidth || Math.min(190, W * 0.34);
      var m = { top: 6, right: 52, bottom: 22, left: labelW };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var rowH = plotH / n;
      var barH = Math.min(20, Math.max(9, rowH - 8));
      var ticks = niceTicks(Math.max.apply(null, items.map(function (d) { return d[1]; })), 4);
      var max = ticks[ticks.length - 1];
      var xs = function (v) { return m.left + (v / max) * plotW; };

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      ticks.forEach(function (tk) {
        el("line", { x1: xs(tk), x2: xs(tk), y1: m.top, y2: m.top + plotH, stroke: th.grid, "stroke-width": 1 }, svg);
        text(svg, fmt(tk), { x: xs(tk), y: H - 6, fill: th.muted, "font-size": 11, "text-anchor": "middle", "class": "num" });
      });
      el("line", { x1: m.left, x2: m.left, y1: m.top, y2: m.top + plotH, stroke: th.axis, "stroke-width": 1 }, svg);

      items.forEach(function (d, i) {
        var y = m.top + i * rowH + (rowH - barH) / 2;
        var color = opts.colorOf ? opts.colorOf(d, i, th)
          : opts.byCluster ? clusterColor(d[0]) : seriesColor(opts.color);
        var w = Math.max(1, xs(d[1]) - m.left);
        var bar = el("path", { d: barRight(m.left, y, w, barH, 4), fill: color }, svg);
        /* Truncate labels that would overflow the label gutter; the tooltip
           always carries the full name. */
        var label = opts.shorten ? (CLUSTER_SHORT[d[0]] || d[0]) : d[0];
        var maxChars = Math.max(6, Math.floor((m.left - 12) / 6.4));
        if (label.length > maxChars) label = label.slice(0, maxChars - 1) + "…";
        var lt = text(svg, label, {
          x: m.left - 8, y: y + barH / 2 + 4, fill: th.ink, "font-size": 12, "text-anchor": "end"
        });
        defLabel(svg, lt, d[0], { x: 0, y: m.top + i * rowH, w: m.left - 4, h: rowH }, th);
        text(svg, fmt(d[1]), {
          x: m.left + w + 6, y: y + barH / 2 + 4, fill: th.muted, "font-size": 11.5, "class": "num"
        });
        hoverable(bar, [{ value: fmt(d[1]), label: d[0], swatch: color }]);
        bar.setAttribute("aria-label", d[0] + ": " + fmt(d[1]));
        bar.setAttribute("role", "img");
      });
    });
  }

  /* ---------- vertical columns ---------- */

  function columns(root, opts) {
    mount(root, function (node, W, H) {
      var th = T();
      var items = opts.items;
      var n = items.length;
      var m = { top: 14, right: 10, bottom: opts.subLabel ? 52 : 40, left: 44 };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var slot = plotW / n;
      /* opts.barMax — widen the bars when there are few categories, as
         stacked() does; three 24px columns in a wide card read as sparse */
      var barW = Math.min(opts.barMax || 24, slot * 0.55);
      var ticks = niceTicks(Math.max.apply(null, items.map(function (d) { return d[1]; })), 4);
      var max = ticks[ticks.length - 1];
      var ys = function (v) { return m.top + plotH - (v / max) * plotH; };
      var color = seriesColor(opts.color);

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      ticks.forEach(function (tk) {
        el("line", { x1: m.left, x2: W - m.right, y1: ys(tk), y2: ys(tk), stroke: tk === 0 ? th.axis : th.grid, "stroke-width": 1 }, svg);
        text(svg, fmt(tk), { x: m.left - 7, y: ys(tk) + 4, fill: th.muted, "font-size": 11, "text-anchor": "end", "class": "num" });
      });

      items.forEach(function (d, i) {
        /* item[2] === "incomplete" renders as an outlined, half-tinted column
           (used for the in-progress 2020s decade). */
        var partial = d[2] === "incomplete";
        if (opts.colorOf) color = opts.colorOf(d, i, th);
        var x = m.left + i * slot + (slot - barW) / 2;
        var h = Math.max(1, (d[1] / max) * plotH);
        var bar = el("path", {
          d: barTop(x, ys(d[1]), barW, h, 4), fill: color,
          "fill-opacity": partial ? 0.35 : 1
        }, svg);
        if (partial) {
          bar.setAttribute("stroke", color);
          bar.setAttribute("stroke-dasharray", "4 3");
          bar.setAttribute("stroke-width", 1.5);
        }
        var lx = m.left + i * slot + slot / 2;
        text(svg, partial ? d[0] + "*" : d[0], { x: lx, y: m.top + plotH + 16, fill: th.ink, "font-size": 11.5, "text-anchor": "middle" });
        /* opts.subLabel — a second, quieter line under the category name
           (used for shares, where the count alone hides the proportion) */
        if (opts.subLabel) {
          var sub = opts.subLabel(d, i);
          if (sub) text(svg, sub, { x: lx, y: m.top + plotH + 30, fill: th.muted, "font-size": 10.5, "text-anchor": "middle", "class": "num" });
        }
        if (i < (opts.labelTop || 3) || (partial && opts.labelIncomplete !== false)) {
          text(svg, fmt(d[1]), { x: lx, y: ys(d[1]) - 6, fill: th.muted, "font-size": 11, "text-anchor": "middle", "class": "num" });
        }
        var tipLines = [{ value: fmt(d[1]), label: d[0] + (partial ? " (incomplete decade)" : ""), swatch: color }];
        if (opts.subLabel && opts.tipNoun) {
          var subTip = opts.subLabel(d, i);
          if (subTip) tipLines.push({ value: subTip, label: opts.tipNoun });
        }
        hoverable(bar, tipLines);
        bar.setAttribute("aria-label", d[0] + ": " + fmt(d[1]) + (partial ? " (incomplete)" : ""));
        bar.setAttribute("role", "img");
      });
      if (items.some(function (d) { return d[2] === "incomplete"; })) {
        text(svg, "* decade still in progress", {
          x: W - m.right, y: m.top - 2, fill: th.muted, "font-size": 10.5, "text-anchor": "end"
        });
      }
    });
  }

  /* ---------- line + area with crosshair ---------- */

  function lineArea(root, opts) {
    mount(root, function (node, W, H) {
      var th = T();
      var pts = opts.points;
      var m = { top: 16, right: 18, bottom: 30, left: 46 };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var x0 = pts[0][0], x1 = pts[pts.length - 1][0];
      var ticks = niceTicks(Math.max.apply(null, pts.map(function (d) { return d[1]; })), 4);
      var max = ticks[ticks.length - 1];
      var xs = function (x) { return m.left + ((x - x0) / (x1 - x0)) * plotW; };
      var ys = function (v) { return m.top + plotH - (v / max) * plotH; };
      var color = seriesColor(opts.color);

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      ticks.forEach(function (tk) {
        el("line", { x1: m.left, x2: W - m.right, y1: ys(tk), y2: ys(tk), stroke: tk === 0 ? th.axis : th.grid, "stroke-width": 1 }, svg);
        text(svg, fmt(tk), { x: m.left - 7, y: ys(tk) + 4, fill: th.muted, "font-size": 11, "text-anchor": "end", "class": "num" });
      });
      for (var yr = Math.ceil(x0 / 10) * 10; yr <= x1; yr += 10) {
        text(svg, yr, { x: xs(yr), y: H - 8, fill: th.muted, "font-size": 11, "text-anchor": "middle", "class": "num" });
      }

      var dLine = "", dArea = "M" + xs(x0) + "," + ys(0);
      pts.forEach(function (p, i) {
        dLine += (i ? "L" : "M") + xs(p[0]) + "," + ys(p[1]);
        dArea += "L" + xs(p[0]) + "," + ys(p[1]);
      });
      dArea += "L" + xs(x1) + "," + ys(0) + "z";

      el("path", { d: dArea, fill: color, opacity: 0.1 }, svg);
      el("path", { d: dLine, fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);

      /* direct label on the extreme; flip the label inboard near the right edge */
      var peak = pts.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
      el("circle", { cx: xs(peak[0]), cy: ys(peak[1]), r: 4.5, fill: color, stroke: th.surface, "stroke-width": 2 }, svg);
      var atEdge = xs(peak[0]) > W - 96;
      text(svg, peak[0] + " · " + fmt(peak[1]), {
        x: xs(peak[0]) + (atEdge ? -8 : 8),
        y: ys(peak[1]) + (atEdge && ys(peak[1]) < m.top + 14 ? 16 : 4),
        fill: th.ink, "font-size": 11.5, "font-weight": 600, "class": "num",
        "text-anchor": atEdge ? "end" : "start"
      });

      /* crosshair */
      var hair = el("line", { y1: m.top, y2: m.top + plotH, stroke: th.axis, "stroke-width": 1, opacity: 0 }, svg);
      var dot = el("circle", { r: 4.5, fill: color, stroke: th.surface, "stroke-width": 2, opacity: 0 }, svg);
      var overlay = el("rect", { x: m.left, y: m.top, width: plotW, height: plotH, fill: "transparent" }, svg);

      function snap(clientX) {
        var rect = svg.getBoundingClientRect();
        var gx = clientX - rect.left;
        var year = Math.round(x0 + ((gx - m.left) / plotW) * (x1 - x0));
        year = Math.max(x0, Math.min(x1, year));
        return pts[year - x0];
      }

      overlay.addEventListener("pointermove", function (e) {
        var p = snap(e.clientX);
        hair.setAttribute("x1", xs(p[0]));
        hair.setAttribute("x2", xs(p[0]));
        hair.setAttribute("opacity", 1);
        dot.setAttribute("cx", xs(p[0]));
        dot.setAttribute("cy", ys(p[1]));
        dot.setAttribute("opacity", 1);
        tipShow([{
          value: fmt(p[1]),
          label: (opts.tipLabel || "publications in") + " " + p[0],
          swatch: color
        }], e.clientX, e.clientY);
      });
      overlay.addEventListener("pointerleave", function () {
        hair.setAttribute("opacity", 0);
        dot.setAttribute("opacity", 0);
        tipHide();
      });
    });
  }

  /* ---------- one bar per year across a long span ---------- */

  /* A count per year is a set of discrete events, not a continuous quantity, so
     bars carry it better than a line: the waves read as blocks of enforcement
     rather than as one jagged trace. Bars are ~1px apart at 77 years, so the
     hover uses a single overlay that snaps to the nearest year instead of
     per-bar hit targets. */
  function timeBars(root, opts) {
    mount(root, function (node, W, H) {
      var th = T();
      var pts = opts.points;
      var m = { top: 16, right: 18, bottom: 30, left: 46 };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var x0 = pts[0][0], x1 = pts[pts.length - 1][0];
      var slot = plotW / pts.length;
      var barW = Math.max(1.5, slot - Math.max(1, Math.min(3, slot * 0.28)));
      var ticks = niceTicks(Math.max.apply(null, pts.map(function (d) { return d[1]; })), 4);
      var max = ticks[ticks.length - 1];
      var cx = function (year) { return m.left + (year - x0 + 0.5) * slot; };
      var ys = function (v) { return m.top + plotH - (v / max) * plotH; };
      var color = seriesColor(opts.color);

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      ticks.forEach(function (tk) {
        el("line", { x1: m.left, x2: W - m.right, y1: ys(tk), y2: ys(tk), stroke: tk === 0 ? th.axis : th.grid, "stroke-width": 1 }, svg);
        text(svg, fmt(tk), { x: m.left - 7, y: ys(tk) + 4, fill: th.muted, "font-size": 11, "text-anchor": "end", "class": "num" });
      });
      for (var yr = Math.ceil(x0 / 10) * 10; yr <= x1; yr += 10) {
        text(svg, yr, { x: cx(yr), y: H - 8, fill: th.muted, "font-size": 11, "text-anchor": "middle", "class": "num" });
      }

      pts.forEach(function (p) {
        if (!p[1]) return;
        var h = Math.max(1.5, (p[1] / max) * plotH);
        el("path", {
          d: barTop(cx(p[0]) - barW / 2, ys(p[1]), barW, h, Math.min(1.5, barW / 2)),
          fill: color
        }, svg);
      });

      /* the record's single biggest year, called out where it stands */
      var peak = pts.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
      text(svg, peak[0] + " · " + fmt(peak[1]), {
        x: cx(peak[0]) + 8, y: ys(peak[1]) + 4,
        fill: th.ink, "font-size": 11.5, "font-weight": 600, "class": "num", "text-anchor": "start"
      });

      var hi = el("rect", { fill: th.ink, opacity: 0 }, svg);
      var overlay = el("rect", { x: m.left, y: m.top, width: plotW, height: plotH, fill: "transparent" }, svg);

      overlay.addEventListener("pointermove", function (e) {
        var rect = svg.getBoundingClientRect();
        var scale = plotW / (rect.width - m.left - m.right);
        var year = Math.round(x0 + (((e.clientX - rect.left) * (W / rect.width) - m.left) / slot) - 0.5);
        year = Math.max(x0, Math.min(x1, year));
        var p = pts[year - x0];
        var h = Math.max(1.5, (p[1] / max) * plotH);
        hi.setAttribute("x", cx(p[0]) - barW / 2 - 1);
        hi.setAttribute("y", p[1] ? ys(p[1]) : m.top + plotH - 2);
        hi.setAttribute("width", barW + 2);
        hi.setAttribute("height", p[1] ? h : 2);
        hi.setAttribute("opacity", 0.28);
        tipShow([{ value: fmt(p[1]), label: (opts.tipLabel || "publications in") + " " + p[0], swatch: color }], e.clientX, e.clientY);
      });
      overlay.addEventListener("pointerleave", function () {
        hi.setAttribute("opacity", 0);
        tipHide();
      });
    });
  }

  /* ---------- stacked columns + legend ---------- */

  function legend(container, names, onHover) {
    var box = document.createElement("div");
    box.className = "chart-legend";
    names.forEach(function (name, i) {
      var chip = document.createElement("span");
      chip.className = "legend-chip";
      var sw = document.createElement("span");
      sw.className = "legend-swatch";
      sw.dataset.cluster = name;
      sw.style.background = clusterColor(name);
      chip.appendChild(sw);
      var lbl = document.createElement("span");
      lbl.textContent = CLUSTER_SHORT[name] || name;
      chip.appendChild(lbl);
      definable(chip, name);
      if (onHover) {
        chip.addEventListener("pointerenter", function () { onHover(i); });
        chip.addEventListener("pointerleave", function () { onHover(-1); });
      }
      box.appendChild(chip);
    });
    container.appendChild(box);
    return box;
  }

  /* opts.colorOf  — series colours for non-cluster series (KDN grounds)
     opts.normalize — each column sums to 100%, so composition is the subject
     opts.barMax    — widen the bars when there are few categories
     opts.incompleteLast — asterisk the final category and footnote it */
  function stacked(root, opts) {
    var host = root.parentNode;
    var seriesGroups = [];
    var onHover = function (idx) {
      seriesGroups.forEach(function (nodes, si) {
        nodes.forEach(function (nd) { nd.style.opacity = idx === -1 || idx === si ? 1 : 0.25; });
      });
    };
    var legendHost = host.querySelector(".legend-slot") || host;
    if (opts.colorOf) seriesLegend(legendHost, opts.series, opts.colorOf, onHover);
    else legend(legendHost, opts.series, onHover);

    mount(root, function (node, W, H) {
      var th = T();
      seriesGroups = opts.series.map(function () { return []; });
      /* a normalised column always reaches the top, so the incomplete-decade
         note goes under the axis rather than into the 100% gridline */
      var m = { top: 14, right: 10, bottom: opts.incompleteLast ? 46 : 32, left: 46 };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var n = opts.cats.length;
      var slot = plotW / n;
      var barW = Math.min(opts.barMax || 24, slot * (opts.normalize ? 0.62 : 0.5));
      var totals = opts.matrix.map(function (row) {
        return row.reduce(function (a, b) { return a + b; }, 0);
      });
      var pct = opts.normalize;
      var ticks = pct ? [0, 25, 50, 75, 100] : niceTicks(Math.max.apply(null, totals), 4);
      var max = ticks[ticks.length - 1];

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      ticks.forEach(function (tk) {
        var y = m.top + plotH - (tk / max) * plotH;
        el("line", { x1: m.left, x2: W - m.right, y1: y, y2: y, stroke: tk === 0 ? th.axis : th.grid, "stroke-width": 1 }, svg);
        text(svg, pct ? tk + "%" : fmt(tk), { x: m.left - 7, y: y + 4, fill: th.muted, "font-size": 11, "text-anchor": "end", "class": "num" });
      });

      opts.cats.forEach(function (cat, ci) {
        var x = m.left + ci * slot + (slot - barW) / 2;
        var yCursor = m.top + plotH;
        var partial = opts.incompleteLast && ci === n - 1;
        text(svg, partial ? cat + "*" : cat, { x: m.left + ci * slot + slot / 2, y: m.top + plotH + 18, fill: th.ink, "font-size": 11.5, "text-anchor": "middle", "class": "num" });
        var total = totals[ci];
        opts.matrix[ci].forEach(function (v, si) {
          if (!v) return;
          var color = opts.colorOf ? opts.colorOf(si, th) : clusterColor(opts.series[si]);
          var share = total ? (v / total) * 100 : 0;
          var h = ((pct ? share : v) / max) * plotH;
          var gapped = Math.max(1, h - 2); /* 2px surface gap between segments */
          var y = yCursor - h;
          var seg = el("rect", { x: x, y: y + 1, width: barW, height: gapped, fill: color }, svg);
          var lines = [{ value: fmt(v), label: opts.series[si], swatch: color }];
          if (pct) lines.push({ value: (Math.round(share * 10) / 10) + "%", label: "of the " + cat + " total (" + fmt(total) + ")" });
          else lines.push({ value: fmt(total), label: "total in the " + cat });
          hoverable(seg, lines);
          seg.setAttribute("aria-label", cat + ", " + opts.series[si] + ": " + fmt(v) +
            (pct ? " (" + Math.round(share) + "%)" : ""));
          seg.setAttribute("role", "img");
          seriesGroups[si].push(seg);
          yCursor -= h;
        });
      });

      if (opts.incompleteLast) {
        text(svg, "* " + opts.cats[n - 1] + " is an unfinished decade", {
          x: W - m.right, y: H - 6, fill: th.muted, "font-size": 10.5, "text-anchor": "end"
        });
      }
    });
  }

  /* ---------- heatmap (sequential one-hue ramp, annotated) ---------- */

  function rampColor(t, th) {
    var e = Math.pow(t, 0.82);
    var c = th.rampFrom.map(function (f, i) { return Math.round(f + (th.rampTo[i] - f) * e); });
    return "rgb(" + c.join(",") + ")";
  }

  /* Severity ramp for the enforcement-focus grid: green where a cluster is a
     small share of its decade, red where it dominates. Lightness falls steadily
     from the green end to the red end, so the grid still reads as a value ramp
     in greyscale — and for the ~8% of men with red-green colour blindness, for
     whom hue alone would carry nothing. */
  var SEVERITY = {
    light: [[0, [226, 240, 222]], [0.30, [150, 198, 138]], [0.55, [243, 205, 110]],
            [0.78, [226, 138, 63]], [1, [168, 34, 30]]],
    dark:  [[0, [36, 52, 38]], [0.30, [74, 132, 84]], [0.55, [186, 152, 52]],
            [0.78, [214, 112, 46]], [1, [214, 58, 48]]]
  };

  function severityRgb(t) {
    var st = document.documentElement.dataset.theme === "dark" ? SEVERITY.dark : SEVERITY.light;
    t = Math.max(0, Math.min(1, t));
    for (var i = 1; i < st.length; i++) {
      if (t <= st[i][0]) {
        var a = st[i - 1], b = st[i], k = (t - a[0]) / (b[0] - a[0]);
        return a[1].map(function (c, j) { return Math.round(c + (b[1][j] - c) * k); });
      }
    }
    return st[st.length - 1][1].slice();
  }

  /* ink chosen from the cell's own luminance — a fixed threshold would put
     white text on the mid-ramp ambers */
  function inkOn(rgb) {
    return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 > 0.55
      ? "#1b1714" : "#ffffff";
  }

  function heatmap(root, opts) {
    mount(root, function (node, W, H) {
      var th = T();
      var rows = opts.rows, cols = opts.cols;
      var labelW = opts.labelWidth || Math.min(170, W * 0.3);
      var m = { top: 24, right: 8, bottom: opts.incompleteCol ? 22 : 8, left: labelW };
      var severity = opts.ramp === "severity";
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var cw = plotW / cols.length, ch = plotH / rows.length;
      var max = opts.max || Math.max.apply(null, opts.values.map(function (r) { return Math.max.apply(null, r); }));

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      cols.forEach(function (c, j) {
        /* the unfinished decade is asterisked in its own header */
        var head = c === opts.incompleteCol ? c + "*" : c;
        var ct = text(svg, head, { x: m.left + j * cw + cw / 2, y: 15, fill: th.muted, "font-size": 11.5, "text-anchor": "middle" });
        defLabel(svg, ct, (opts.colTerms || cols)[j],
          { x: m.left + j * cw, y: 0, w: cw, h: m.top }, th);
      });
      rows.forEach(function (r, i) {
        var rt = text(svg, opts.shorten ? (CLUSTER_SHORT[r] || r) : r, {
          x: m.left - 8, y: m.top + i * ch + ch / 2 + 4, fill: th.ink, "font-size": 12, "text-anchor": "end"
        });
        defLabel(svg, rt, (opts.rowTerms || rows)[i],
          { x: 0, y: m.top + i * ch, w: m.left - 4, h: ch }, th);
      });

      rows.forEach(function (r, i) {
        cols.forEach(function (c, j) {
          var v = opts.values[i][j];
          var t = max ? v / max : 0;
          var rgb = severity ? severityRgb(t) : null;
          var cell = el("rect", {
            x: m.left + j * cw + 1, y: m.top + i * ch + 1,
            width: Math.max(1, cw - 2), height: Math.max(1, ch - 2),
            rx: 3, fill: severity ? "rgb(" + rgb.join(",") + ")" : rampColor(t, th)
          }, svg);
          var label = opts.fmt ? opts.fmt(v) : fmt(v);
          if (cw > 34 && ch > 20) {
            text(svg, label, {
              x: m.left + j * cw + cw / 2, y: m.top + i * ch + ch / 2 + 4,
              fill: severity ? inkOn(rgb) : (t > 0.52 ? th.cellHi : th.cellLo),
              "font-size": 11.5, "text-anchor": "middle", "class": "num"
            });
          }
          var rowName = opts.shorten ? (CLUSTER_SHORT[r] || r) : r;
          hoverable(cell, [{
            value: label,
            label: (opts.cellLabel || "publications") + " — " + rowName + " × " + c
          }]);
          cell.setAttribute("aria-label", r + ", " + c + ": " + label);
          cell.setAttribute("role", "img");
        });
      });

      if (opts.incompleteCol) {
        text(svg, "* " + opts.incompleteCol + " is an unfinished decade", {
          x: W - m.right, y: H - 6, fill: th.muted, "font-size": 10.5, "text-anchor": "end"
        });
      }
    });
  }

  /* ---------- multi-series line chart over categories ---------- */

  /* Generic legend for non-cluster series; swatch colours are re-resolved on
     every theme redraw via a registered updater. */
  /* opts.terms — canonical names to look the definition up under, when the
     chips show a shortened label (the cluster trajectories). */
  function seriesLegend(container, series, colorOf, onHover, terms) {
    var box = document.createElement("div");
    box.className = "chart-legend";
    var swatches = [];
    series.forEach(function (name, i) {
      var chip = document.createElement("span");
      chip.className = "legend-chip";
      var sw = document.createElement("span");
      sw.className = "legend-swatch";
      sw.style.background = colorOf(i, T());
      swatches.push(sw);
      chip.appendChild(sw);
      var lbl = document.createElement("span");
      lbl.textContent = name;
      chip.appendChild(lbl);
      definable(chip, terms ? terms[i] : name);
      if (onHover) {
        chip.addEventListener("pointerenter", function () { onHover(i); });
        chip.addEventListener("pointerleave", function () { onHover(-1); });
      }
      box.appendChild(chip);
    });
    drawFns.push(function () {
      swatches.forEach(function (sw, i) { sw.style.background = colorOf(i, T()); });
    });
    container.appendChild(box);
    return box;
  }

  /*
   * opts: cats (x labels), series [{name, short?, values[]}],
   * colorOf(i, theme), incompleteLast (dashes the final segment and stars the
   * final category — the in-progress 2020s), tipNoun.
   */
  function multiLine(root, opts) {
    var host = root.parentNode;
    var seriesPaths = [];
    var legendHost = host.querySelector(".legend-slot");
    if (legendHost && !legendHost.dataset.filled) {
      legendHost.dataset.filled = "1";
      seriesLegend(legendHost,
        opts.series.map(function (s) { return s.short || s.name; }),
        opts.colorOf,
        function (idx) {
          seriesPaths.forEach(function (nodes, si) {
            nodes.forEach(function (nd) { nd.style.opacity = idx === -1 || idx === si ? 1 : 0.18; });
          });
        },
        opts.series.map(function (s) { return s.name; }));
    }

    mount(root, function (node, W, H) {
      var th = T();
      seriesPaths = opts.series.map(function () { return []; });
      var cats = opts.cats;
      var m = { top: 14, right: 16, bottom: 30, left: 44 };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var maxV = 0;
      opts.series.forEach(function (s) {
        s.values.forEach(function (v) { if (v > maxV) maxV = v; });
      });
      var ticks = niceTicks(maxV, 4);
      var max = ticks[ticks.length - 1];
      var xs = function (ci) {
        return m.left + (cats.length === 1 ? plotW / 2 : (ci / (cats.length - 1)) * plotW);
      };
      var ys = function (v) { return m.top + plotH - (v / max) * plotH; };

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      ticks.forEach(function (tk) {
        el("line", { x1: m.left, x2: W - m.right, y1: ys(tk), y2: ys(tk), stroke: tk === 0 ? th.axis : th.grid, "stroke-width": 1 }, svg);
        text(svg, fmt(tk), { x: m.left - 7, y: ys(tk) + 4, fill: th.muted, "font-size": 11, "text-anchor": "end", "class": "num" });
      });
      var catStep = Math.ceil(cats.length / Math.max(3, Math.floor(plotW / 58)));
      cats.forEach(function (c, ci) {
        if (ci % catStep && ci !== cats.length - 1) return;
        var lbl = (opts.incompleteLast && ci === cats.length - 1) ? c + "*" : c;
        text(svg, lbl, { x: xs(ci), y: H - 8, fill: th.ink, "font-size": 11, "text-anchor": "middle", "class": "num" });
      });
      if (opts.incompleteLast) {
        text(svg, "* decade still in progress", {
          x: W - m.right, y: m.top - 2, fill: th.muted, "font-size": 10.5, "text-anchor": "end"
        });
      }

      opts.series.forEach(function (s, si) {
        var color = opts.colorOf(si, th);
        var solid = "", ci;
        var lastFull = opts.incompleteLast ? s.values.length - 2 : s.values.length - 1;
        for (ci = 0; ci <= lastFull; ci++) {
          solid += (ci ? "L" : "M") + xs(ci) + "," + ys(s.values[ci]);
        }
        var path = el("path", { d: solid, fill: "none", stroke: color, "stroke-width": 2.25, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
        seriesPaths[si].push(path);
        if (opts.incompleteLast && s.values.length > 1) {
          var n = s.values.length;
          var dashed = el("path", {
            d: "M" + xs(n - 2) + "," + ys(s.values[n - 2]) + "L" + xs(n - 1) + "," + ys(s.values[n - 1]),
            fill: "none", stroke: color, "stroke-width": 2.25, "stroke-dasharray": "5 4", "stroke-linecap": "round"
          }, svg);
          seriesPaths[si].push(dashed);
        }
      });

      /* hover: snap to the nearest category, list every series at it */
      var hair = el("line", { y1: m.top, y2: m.top + plotH, stroke: th.axis, "stroke-width": 1, opacity: 0 }, svg);
      var overlay = el("rect", { x: m.left, y: m.top, width: plotW, height: plotH, fill: "transparent" }, svg);
      overlay.addEventListener("pointermove", function (e) {
        var rect = svg.getBoundingClientRect();
        var ci = Math.round(((e.clientX - rect.left) - m.left) / plotW * (cats.length - 1));
        ci = Math.max(0, Math.min(cats.length - 1, ci));
        hair.setAttribute("x1", xs(ci));
        hair.setAttribute("x2", xs(ci));
        hair.setAttribute("opacity", 1);
        var lines = opts.series
          .map(function (s, si) {
            return { value: fmt(s.values[ci]), label: s.short || s.name, swatch: opts.colorOf(si, T()), v: s.values[ci] };
          })
          .sort(function (a, b) { return b.v - a.v; })
          .slice(0, 7);
        lines.unshift({ value: cats[ci], label: opts.tipNoun || "" });
        tipShow(lines, e.clientX, e.clientY);
      });
      overlay.addEventListener("pointerleave", function () {
        hair.setAttribute("opacity", 0);
        tipHide();
      });
    });
  }

  /* ---------- the seven grounds, as a mind map ---------- */

  /* The grounds in the official Publication Guidelines, in their source order.
     Drawn as a mind map rather than a chip list because the branching is the
     point: one label — "undesirable" — fans out into seven separately
     arguable grounds.

     The leaves stay HTML .ground-chip elements rather than SVG text. The kit
     renders Font Awesome in svg-with-js mode, so there is no icon webfont to
     set on an SVG <text>; keeping the chips as HTML also keeps them identical
     to the grounds-mini chips that pay this beat off later. They are absolutely
     positioned in the same pixel space as the branches drawn behind them. */
  var GROUNDS = [
    { icon: "fa-ban", label: "Contrary to law" },
    { icon: "fa-heart-crack", label: "Morality" },
    { icon: "fa-users", label: "Public interest" },
    { icon: "fa-flag", label: "National interest" },
    { icon: "fa-shield-halved", label: "Security" },
    { icon: "fa-people-group", label: "Public order" },
    { icon: "fa-bullhorn", label: "Public alarm" }
  ];

  function groundsMindmap(root) {
    mount(root, function (node, W, H) {
      var th = T();
      var accent = seriesColor("blue");
      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      /* two-sided fan needs room for a chip column on each flank; below that
         the map folds down into a single spine */
      var COL = 168;
      var narrow = W < 580;
      root.classList.toggle("is-narrow", narrow);

      function leaf(g, x, y, toLeft) {
        var chip = document.createElement("span");
        chip.className = "ground-chip" + (toLeft ? " is-left" : "");
        var icon = document.createElement("i");
        icon.className = "fa-solid " + g.icon;
        icon.setAttribute("aria-hidden", "true");
        chip.appendChild(icon);
        chip.appendChild(document.createTextNode(g.label));
        chip.style.left = Math.round(x) + "px";
        chip.style.top = Math.round(y) + "px";
        node.appendChild(chip);
        el("circle", { cx: x, cy: y, r: 3, fill: accent }, svg);
      }

      function branch(x0, y0, x1, y1) {
        var k = Math.abs(x1 - x0) * 0.55;
        var dir = x1 > x0 ? 1 : -1;
        el("path", {
          d: "M" + x0 + "," + y0 +
             " C" + (x0 + dir * k) + "," + y0 +
             " " + (x1 - dir * k) + "," + y1 +
             " " + x1 + "," + y1,
          fill: "none", stroke: accent, "stroke-width": 1.4,
          "stroke-linecap": "round", opacity: 0.5
        }, svg);
      }

      function hub(x, y, w, h, align) {
        el("rect", {
          x: x, y: y, width: w, height: h, rx: 10,
          fill: th.surface, stroke: accent, "stroke-width": 1.5
        }, svg);
        var tx = align === "start" ? x + 14 : x + w / 2;
        text(svg, "Undesirable", {
          x: tx, y: y + h / 2 - 3, fill: th.ink, "font-size": 13.5,
          "font-weight": 700, "text-anchor": align || "middle"
        });
        text(svg, "publications", {
          x: tx, y: y + h / 2 + 14, fill: th.ink, "font-size": 13.5,
          "font-weight": 700, "text-anchor": align || "middle"
        });
      }

      if (!narrow) {
        var cx = W / 2, cy = H / 2;
        var hubW = 150, hubH = 56;
        hub(cx - hubW / 2, cy - hubH / 2, hubW, hubH);

        /* leaf columns, pulled in on wide cards so the fan stays compact */
        var rightX = Math.min(W - COL, cx + hubW / 2 + 150);
        var leftX = Math.max(COL, cx - hubW / 2 - 150);
        var pad = 10, avail = H - pad * 2;

        /* clockwise from the top right: 1-4 down the right flank, 5-7 up the
           left, so the source order still reads in sequence */
        GROUNDS.slice(0, 4).forEach(function (g, i) {
          var y = pad + avail * (i + 0.5) / 4;
          branch(cx + hubW / 2, cy - 16 + i * (32 / 3), rightX, y);
          leaf(g, rightX, y, false);
        });
        GROUNDS.slice(4).reverse().forEach(function (g, j) {
          var y = pad + avail * (j + 0.5) / 3;
          branch(cx - hubW / 2, cy - 12 + j * 12, leftX, y);
          leaf(g, leftX, y, true);
        });
        return;
      }

      /* narrow: hub at the top, one spine, seven ticks */
      var hx = 8, hy = 6, hh = 46;
      hub(hx, hy, Math.min(190, W - 16), hh, "start");

      var spineX = 26, leafX = 44;
      var top0 = hy + hh + 16;
      var pitch = (H - top0 - 16) / (GROUNDS.length - 1);
      var lastY = top0 + pitch * (GROUNDS.length - 1);

      el("path", {
        d: "M" + spineX + "," + (hy + hh) + " L" + spineX + "," + lastY,
        fill: "none", stroke: accent, "stroke-width": 1.4,
        "stroke-linecap": "round", opacity: 0.5
      }, svg);

      GROUNDS.forEach(function (g, i) {
        var y = top0 + pitch * i;
        branch(spineX, y - Math.min(14, pitch / 2), leafX, y);
        leaf(g, leafX, y, false);
      });
    });
  }

  /* ---------- pictograph (Font Awesome icons, HTML flow) ---------- */

  /* One icon = opts.per records; the last icon of a row is clipped to the
     remainder. Colours ride the CSS theme variables, so no redraw needed. */
  function pictograph(root, opts) {
    root.classList.add("pict");
    opts.groups.forEach(function (g) {
      var row = document.createElement("div");
      row.className = "pict-row";
      var head = document.createElement("div");
      head.className = "pict-head";
      var name = document.createElement("span");
      name.className = "pict-label";
      name.textContent = g.label;
      var count = document.createElement("span");
      count.className = "pict-count num";
      count.textContent = fmt(g.count) + (g.share ? " · " + g.share : "");
      head.appendChild(name);
      head.appendChild(count);
      var icons = document.createElement("div");
      icons.className = "pict-icons";
      icons.setAttribute("aria-hidden", "true");
      var full = Math.floor(g.count / opts.per);
      var frac = (g.count % opts.per) / opts.per;
      for (var k = 0; k < full; k++) {
        var ic = document.createElement("i");
        ic.className = "fa-solid " + g.icon;
        icons.appendChild(ic);
      }
      if (frac > 0.02) {
        var part = document.createElement("span");
        part.className = "pict-part";
        part.style.clipPath = "inset(0 " + Math.round((1 - frac) * 100) + "% 0 0)";
        var pi = document.createElement("i");
        pi.className = "fa-solid " + g.icon;
        part.appendChild(pi);
        icons.appendChild(part);
      }
      row.appendChild(head);
      row.appendChild(icons);
      hoverable(row, [{ value: fmt(g.count), label: g.label }]);
      root.appendChild(row);
    });
  }

    /* ---------- podium histograms (people behind the publications) ---------- */

  /* HTML rows so the Font Awesome rank icons render; bar colours ride the
     CSS theme variables. Top three read as the podium. */
  function podium(root, opts) {
    root.classList.add("podium");
    var max = opts.items.reduce(function (a, d) { return Math.max(a, d[1]); }, 0);
    var RANK_ICONS = ["fa-trophy", "fa-medal", "fa-award"];
    opts.items.forEach(function (d, i) {
      var row = document.createElement("div");
      row.className = "podium-row" + (i < 3 ? " is-top" + (i + 1) : "");
      var rank = document.createElement("span");
      rank.className = "podium-rank";
      if (i < 3) {
        var ic = document.createElement("i");
        ic.className = "fa-solid " + RANK_ICONS[i];
        ic.setAttribute("aria-hidden", "true");
        rank.appendChild(ic);
      } else {
        rank.textContent = i + 1;
      }
      var entry = definition(d[0]);
      var name = document.createElement("span");
      name.className = "podium-name" + (entry ? " has-def" : "");
      name.textContent = d[0];
      var track = document.createElement("span");
      track.className = "podium-track";
      var bar = document.createElement("span");
      bar.className = "podium-bar";
      bar.style.width = Math.max(2, Math.round(d[1] / max * 100)) + "%";
      track.appendChild(bar);
      var count = document.createElement("span");
      count.className = "podium-count num";
      count.textContent = fmt(d[1]);
      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(count);
      /* One tooltip per row rather than a competing one on the name: the count
         line, then who they are when the name is one we can identify. */
      hoverable(row, [{ value: fmt(d[1]), label: d[0] + " — " + opts.noun }],
                entry ? entry.def : null);
      root.appendChild(row);
    });
  }

  /* ---------- view switches inside one chart card ---------- */

  /* A `.chart-views` button group shows one `[data-view-panel]` at a time
     within its own figure, so two readings of the same records can share a
     card instead of costing a scroll beat. The hidden chart draws nothing
     until it is shown — mount()'s ResizeObserver picks it up then. */
  function chartViews() {
    document.querySelectorAll(".chart-views").forEach(function (group) {
      var fig = group.closest("figure") || group.parentNode;
      var buttons = Array.prototype.slice.call(group.querySelectorAll("button"));
      var panels = Array.prototype.slice.call(fig.querySelectorAll("[data-view-panel]"));
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          buttons.forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          panels.forEach(function (panel) {
            panel.hidden = panel.dataset.viewPanel !== btn.dataset.view;
          });
        });
      });
    });
  }

  /* ---------- build every chart on the page ---------- */

  function init() {
    if (typeof PPPA === "undefined") return;

    chartViews();

    /* --- bans over time: Year / Decade / Cumulative (the 3D book-rain box
       itself lives in js/rain3d.js, a Three.js module) --- */
    var rainBox = document.getElementById("rain-box");
    if (rainBox) {
      var cume = [], run = 0;
      PPPA.perYear.forEach(function (p) { run += p[1]; cume.push([p[0], run]); });
      var lastDecade = PPPA.decadeMix.decades.length - 1;
      var decadeItems = PPPA.decadeMix.decades.map(function (d, i) {
        return i === lastDecade
          ? [d, PPPA.decadeMix.totals[i], "incomplete"]
          : [d, PPPA.decadeMix.totals[i]];
      });
      timeBars(document.getElementById("c-rain-year"), { points: PPPA.perYear, color: "blue" });
      columns(document.getElementById("c-rain-decade"), { items: decadeItems, color: "blue", labelTop: 8 });
      lineArea(document.getElementById("c-rain-cume"), { points: cume, color: "green", tipLabel: "cumulative bans by" });
    }

    /* --- languages over time ---
       Derived here rather than in generate_data.py: the row tuple already
       carries year and languages, and folding them into the same five groups
       the languages column chart uses (top three named + Unknown + Other)
       reproduces PPPA.languageGrouped exactly, so the two charts can never
       disagree. Language is counted by mention — a record listing two
       languages lands in both, so a decade's columns can out-total its bans. */
    var LANG_GROUPS = PPPA.languageGrouped.map(function (d) { return d[0]; });
    var LANG_NAMED = LANG_GROUPS.slice(0, 3);
    var langDecades = PPPA.decadeClusters.decades;
    var langMatrix = langDecades.map(function () {
      return LANG_GROUPS.map(function () { return 0; });
    });
    PPPA.rows.forEach(function (r) {
      var di = langDecades.indexOf(Math.floor(r[1] / 10) * 10 + "s");
      if (di === -1) return;
      var langs = r[4] ? r[4].split(", ").filter(Boolean) : [];
      if (!langs.length) { langMatrix[di][3]++; return; }   /* Unknown */
      langs.forEach(function (l) {
        var i = LANG_NAMED.indexOf(l);
        langMatrix[di][i === -1 ? 4 : i]++;                 /* Other */
      });
    });
    stacked(document.getElementById("c-langtime"), {
      cats: langDecades,
      series: LANG_GROUPS,
      matrix: langMatrix,
      /* named languages take colour slots; Unknown stays muted, as it does in
         the languages column chart, because it is missing data not a language */
      colorOf: function (i, th) {
        return LANG_GROUPS[i] === "Unknown" ? th.muted : th.slots[i > 3 ? 3 : i];
      },
      incompleteLast: true
    });

    /* --- languages: top three + Unknown + Other (chart-only grouping) --- */
    columns(document.getElementById("c-languages"), {
      items: PPPA.languageGrouped,
      labelTop: PPPA.languageGrouped.length,
      colorOf: function (d, i, th) {
        return d[0] === "Unknown" || d[0] === "Other" ? th.muted : th.series.blue;
      }
    });

    /* --- types pictograph + origin map ---
       counts come from the generated aggregates so they can't drift from the
       data; typeCounts/originCounts are sorted by count desc (see data.js) */
    var totalRecs = PPPA.meta.total;
    var pct1 = function (n) { return (Math.round(n / totalRecs * 1000) / 10) + "%"; };
    var printedCount = PPPA.typeCounts[0][1];
    var audioCount = PPPA.typeCounts[1][1];
    pictograph(document.getElementById("c-types"), {
      per: 50,
      groups: [
        { icon: "fa-book", label: "Printed documents", count: printedCount,
          share: Math.round(printedCount / totalRecs * 100) + "%" },
        { icon: "fa-music", label: "Audio & recordings", count: audioCount },
        { icon: "fa-compact-disc", label: "Physical, visual & digital media",
          count: totalRecs - printedCount - audioCount }
      ]
    });
    /* Origin is a three-way split — local, foreign, unclear — and nothing
       finer: the dataset never records a country, so a map had nowhere to put
       a third of the records and no country to put the rest in. Ordered with
       the two recorded categories first and the not-a-category bucket last. */
    var originOf = {};
    PPPA.originCounts.forEach(function (d) { originOf[d[0]] = d[1]; });
    var ORIGIN_SLOT = { Foreign: "blue", Local: "green", Unclear: null };
    columns(document.getElementById("c-origin"), {
      items: ["Foreign", "Local", "Unclear"].map(function (k) { return [k, originOf[k]]; }),
      labelTop: 3,
      barMax: 58,
      subLabel: function (d) { return pct1(d[1]); },
      tipNoun: "of all 3,212 records",
      colorOf: function (d, i, th) {
        var slot = ORIGIN_SLOT[d[0]];
        return slot ? th.series[slot] : th.muted;
      }
    });

    /* --- the people podiums --- */
    podium(document.getElementById("c-authors"), { items: PPPA.authorTop, noun: "bans as author/translator" });
    podium(document.getElementById("c-printers"), { items: PPPA.printerTop, noun: "bans as printer" });
    podium(document.getElementById("c-publishers"), { items: PPPA.publisherTop.slice(0, 10), noun: "bans as publisher" });

    /* --- clusters over time: decade stacks crossfading into lines --- */
    stacked(document.getElementById("c-decades"), {
      cats: PPPA.decadeClusters.decades,
      series: PPPA.decadeClusters.clusters,
      matrix: PPPA.decadeClusters.values
    });
    var clusterByDecade = transpose(PPPA.decadeClusters.values);
    multiLine(document.getElementById("c-clusterlines"), {
      cats: PPPA.decadeClusters.decades,
      series: PPPA.decadeClusters.clusters.map(function (name, i) {
        return { name: name, short: CLUSTER_SHORT[name], values: clusterByDecade[i] };
      }),
      colorOf: function (i, th) { return th.slots[i]; },
      incompleteLast: true,
      tipNoun: "bans by cluster"
    });

    /* --- KDN justifications over time (post-1984 record) --- */
    var kdnFirst = PPPA.kdnByDecade.decades.indexOf("1980s");
    /* Composition, not trajectory: as lines, five of the seven grounds sat flat
       on zero. Normalised to 100% per decade, the mix is the point. */
    stacked(document.getElementById("c-kdnlines"), {
      cats: PPPA.kdnByDecade.decades.slice(kdnFirst),
      series: PPPA.kdnByDecade.justifications,
      matrix: PPPA.kdnByDecade.values.slice(kdnFirst),
      colorOf: function (i, th) { return i < th.slots.length ? th.slots[i] : th.muted; },
      normalize: true,
      barMax: 54,
      incompleteLast: true
    });

    /* --- decade mix heatmap --- */
    heatmap(document.getElementById("c-decademix"), {
      rows: PPPA.decadeMix.clusters, cols: PPPA.decadeMix.decades,
      values: transpose(PPPA.decadeMix.values), shorten: true, labelWidth: 165,
      max: 100, ramp: "severity", incompleteCol: "2020s",
      fmt: function (v) { return Math.round(v) + "%"; },
      cellLabel: "of that decade's titles"
    });

    /* --- all subclusters, new taxonomy --- */
    barsH(document.getElementById("c-suball"), { items: PPPA.subclusterAll, color: "blue", labelWidth: 200 });

    /* --- crosswalk: KDN legal ground x INITIATE content cluster --- */
    var XWALK_COLS = {
      "Subversive Ideological And Political Content": "Subversive",
      "Obscene / Immoral Publications": "Obscene/immoral",
      "General/Unidentified": "General",
      "Religious Doctrinal Deviance": "Religious",
      "Race, Religion & Royalty (3R Issues)": "3R"
    };
    /* Prose mentions of a codebook term carry the same tooltip as the chart
       labels; a term whose entry has gone missing loses its underline rather
       than advertising a definition that will not appear. */
    document.querySelectorAll(".def-term[data-term]").forEach(function (node) {
      if (!definable(node, node.dataset.term)) node.classList.remove("def-term");
    });

    heatmap(document.getElementById("c-crosswalk"), {
      rows: PPPA.kdnVsCluster.rows,
      cols: PPPA.kdnVsCluster.cols.map(function (c) { return XWALK_COLS[c] || c; }),
      colTerms: PPPA.kdnVsCluster.cols,
      values: PPPA.kdnVsCluster.values,
      labelWidth: 118,
      cellLabel: "publications"
    });
  }

  function transpose(mtx) {
    return mtx[0].map(function (_, j) {
      return mtx.map(function (row) { return row[j]; });
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  return { redraw: redraw, CLUSTER_SHORT: CLUSTER_SHORT, theme: T };
})();
