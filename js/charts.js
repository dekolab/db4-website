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

  function tipShow(lines, x, y) {
    var t = tooltip();
    t.textContent = "";
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

  function hoverable(node, lines) {
    node.setAttribute("tabindex", "0");
    node.classList.add("hit");
    node.addEventListener("pointerenter", function (e) { tipShow(lines, e.clientX, e.clientY); });
    node.addEventListener("pointermove", function (e) { tipMove(e.clientX, e.clientY); });
    node.addEventListener("pointerleave", tipHide);
    node.addEventListener("focus", function () {
      var r = node.getBoundingClientRect();
      tipShow(lines, r.left + r.width / 2, r.top);
    });
    node.addEventListener("blur", tipHide);
  }

  /* ---------- responsive, theme-aware mount ---------- */

  var drawFns = [];

  function mount(root, render) {
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
        text(svg, label, {
          x: m.left - 8, y: y + barH / 2 + 4, fill: th.ink, "font-size": 12, "text-anchor": "end"
        });
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
      var m = { top: 14, right: 10, bottom: 40, left: 44 };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var slot = plotW / n;
      var barW = Math.min(24, slot * 0.55);
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
        if (i < (opts.labelTop || 3) || (partial && opts.labelIncomplete !== false)) {
          text(svg, fmt(d[1]), { x: lx, y: ys(d[1]) - 6, fill: th.muted, "font-size": 11, "text-anchor": "middle", "class": "num" });
        }
        var tipLines = [{ value: fmt(d[1]), label: d[0] + (partial ? " (incomplete decade)" : ""), swatch: color }];
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
      if (onHover) {
        chip.addEventListener("pointerenter", function () { onHover(i); });
        chip.addEventListener("pointerleave", function () { onHover(-1); });
      }
      box.appendChild(chip);
    });
    container.appendChild(box);
    return box;
  }

  function stacked(root, opts) {
    var host = root.parentNode;
    var seriesGroups = [];
    legend(host.querySelector(".legend-slot") || host, opts.series, function (idx) {
      seriesGroups.forEach(function (nodes, si) {
        nodes.forEach(function (nd) { nd.style.opacity = idx === -1 || idx === si ? 1 : 0.25; });
      });
    });

    mount(root, function (node, W, H) {
      var th = T();
      seriesGroups = opts.series.map(function () { return []; });
      var m = { top: 14, right: 10, bottom: 32, left: 46 };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var n = opts.cats.length;
      var slot = plotW / n;
      var barW = Math.min(24, slot * 0.5);
      var totals = opts.matrix.map(function (row) {
        return row.reduce(function (a, b) { return a + b; }, 0);
      });
      var ticks = niceTicks(Math.max.apply(null, totals), 4);
      var max = ticks[ticks.length - 1];

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      ticks.forEach(function (tk) {
        var y = m.top + plotH - (tk / max) * plotH;
        el("line", { x1: m.left, x2: W - m.right, y1: y, y2: y, stroke: tk === 0 ? th.axis : th.grid, "stroke-width": 1 }, svg);
        text(svg, fmt(tk), { x: m.left - 7, y: y + 4, fill: th.muted, "font-size": 11, "text-anchor": "end", "class": "num" });
      });

      opts.cats.forEach(function (cat, ci) {
        var x = m.left + ci * slot + (slot - barW) / 2;
        var yCursor = m.top + plotH;
        text(svg, cat, { x: m.left + ci * slot + slot / 2, y: m.top + plotH + 18, fill: th.ink, "font-size": 11.5, "text-anchor": "middle", "class": "num" });
        opts.matrix[ci].forEach(function (v, si) {
          if (!v) return;
          var color = clusterColor(opts.series[si]);
          var h = (v / max) * plotH;
          var gapped = Math.max(1, h - 2); /* 2px surface gap between segments */
          var y = yCursor - h;
          var seg = el("rect", { x: x, y: y + 1, width: barW, height: gapped, fill: color }, svg);
          hoverable(seg, [
            { value: fmt(v), label: opts.series[si], swatch: color },
            { value: fmt(totals[ci]), label: "total in the " + cat }
          ]);
          seg.setAttribute("aria-label", cat + ", " + opts.series[si] + ": " + fmt(v));
          seg.setAttribute("role", "img");
          seriesGroups[si].push(seg);
          yCursor -= h;
        });
      });
    });
  }

  /* ---------- heatmap (sequential one-hue ramp, annotated) ---------- */

  function rampColor(t, th) {
    var e = Math.pow(t, 0.82);
    var c = th.rampFrom.map(function (f, i) { return Math.round(f + (th.rampTo[i] - f) * e); });
    return "rgb(" + c.join(",") + ")";
  }

  function heatmap(root, opts) {
    mount(root, function (node, W, H) {
      var th = T();
      var rows = opts.rows, cols = opts.cols;
      var labelW = opts.labelWidth || Math.min(170, W * 0.3);
      var m = { top: 24, right: 8, bottom: 8, left: labelW };
      var plotW = W - m.left - m.right;
      var plotH = H - m.top - m.bottom;
      var cw = plotW / cols.length, ch = plotH / rows.length;
      var max = opts.max || Math.max.apply(null, opts.values.map(function (r) { return Math.max.apply(null, r); }));

      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H }, node);

      cols.forEach(function (c, j) {
        text(svg, c, { x: m.left + j * cw + cw / 2, y: 15, fill: th.muted, "font-size": 11.5, "text-anchor": "middle" });
      });
      rows.forEach(function (r, i) {
        text(svg, opts.shorten ? (CLUSTER_SHORT[r] || r) : r, {
          x: m.left - 8, y: m.top + i * ch + ch / 2 + 4, fill: th.ink, "font-size": 12, "text-anchor": "end"
        });
      });

      rows.forEach(function (r, i) {
        cols.forEach(function (c, j) {
          var v = opts.values[i][j];
          var t = max ? v / max : 0;
          var cell = el("rect", {
            x: m.left + j * cw + 1, y: m.top + i * ch + 1,
            width: Math.max(1, cw - 2), height: Math.max(1, ch - 2),
            rx: 3, fill: rampColor(t, th)
          }, svg);
          var label = opts.fmt ? opts.fmt(v) : fmt(v);
          if (cw > 34 && ch > 20) {
            text(svg, label, {
              x: m.left + j * cw + cw / 2, y: m.top + i * ch + ch / 2 + 4,
              fill: t > 0.52 ? th.cellHi : th.cellLo, "font-size": 11.5, "text-anchor": "middle", "class": "num"
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
    });
  }

  /* ---------- multi-series line chart over categories ---------- */

  /* Generic legend for non-cluster series; swatch colours are re-resolved on
     every theme redraw via a registered updater. */
  function seriesLegend(container, series, colorOf, onHover) {
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
        });
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

  /* ---------- Malaysia origin map (real coastlines, inline SVG) ---------- */

  /* Geometry comes pre-projected from GEO_MY (js/geo.js) — Natural Earth
     coastlines in this SVG's user space, so the plot box and viewBox here must
     match the frame documented in that file.

     Malaysia is highlighted; the neighbouring land behind it is context only.
     Local sits on the land, Foreign arrives from beyond the frame, and Unclear
     keeps its own labelled box so the unresolved third is never hidden. */
  var mapUid = 0;

  function mapOrigin(root, opts) {
    mount(root, function (node, W, H) {
      var th = T();
      var svg = el("svg", { width: W, height: H, viewBox: "0 0 640 360", preserveAspectRatio: "xMidYMid meet" }, node);
      var box = { x: 8, y: 8, w: 624, h: 260, r: 12 };

      /* the coastlines run to the frame edge, so clip them to the sea panel */
      var clipId = "mapclip-" + (++mapUid);
      var clip = el("clipPath", { id: clipId }, el("defs", {}, svg));
      el("rect", { x: box.x, y: box.y, width: box.w, height: box.h, rx: box.r }, clip);

      var sea = el("g", { "clip-path": "url(#" + clipId + ")" }, svg);
      el("rect", { x: box.x, y: box.y, width: box.w, height: box.h, fill: th.grid, opacity: 0.35 }, sea);

      /* neighbouring land — southern Thailand, Sumatra, Kalimantan, the rest */
      el("path", { d: GEO_MY.ctx, fill: th.axis, "fill-opacity": 0.75 }, sea);

      /* Malaysia */
      var land = {
        fill: seriesColor("green"), "fill-opacity": 0.33,
        stroke: seriesColor("green"), "stroke-width": 1.6,
        "stroke-linejoin": "round"
      };
      [GEO_MY.pen, GEO_MY.bor].forEach(function (d) {
        var p = el("path", { d: d }, sea);
        for (var a in land) p.setAttribute(a, land[a]);
      });

      el("rect", {
        x: box.x, y: box.y, width: box.w, height: box.h, rx: box.r,
        fill: "none", stroke: th.axis, "stroke-width": 1
      }, svg);

      /* place names sit over land, so give them a halo to read against it */
      function label(str, x, y, size, anchor) {
        return text(svg, str, {
          x: x, y: y, fill: th.muted, "font-size": size || 11, "text-anchor": anchor || "middle",
          stroke: th.surface, "stroke-width": 3.5, "stroke-linejoin": "round",
          "paint-order": "stroke"
        });
      }

      label("Peninsular Malaysia", 128, 240);
      label("Sabah & Sarawak", 432, 204);

      function chip(x, y, w, title, value, color, dashed) {
        var g = el("g", {}, svg);
        el("rect", {
          x: x, y: y, width: w, height: 46, rx: 9,
          fill: th.surface, stroke: color, "stroke-width": 1.5,
          "stroke-dasharray": dashed ? "5 4" : "none"
        }, g);
        text(g, title, { x: x + w / 2, y: y + 18, fill: th.muted, "font-size": 11, "text-anchor": "middle" });
        text(g, value, { x: x + w / 2, y: y + 36, fill: th.ink, "font-size": 13.5, "font-weight": 700, "text-anchor": "middle", "class": "num" });
        return g;
      }

      /* Local — leaders out to both halves of the country */
      var localChip = chip(200, 92, 132, "Local", fmt(opts.local) + " · " + opts.localPct, seriesColor("green"));
      el("line", { x1: 200, y1: 115, x2: 186, y2: 128, stroke: seriesColor("green"), "stroke-width": 1.4 }, svg);
      el("line", { x1: 332, y1: 115, x2: 362, y2: 168, stroke: seriesColor("green"), "stroke-width": 1.4 }, svg);
      hoverable(localChip, [{ value: fmt(opts.local), label: "publications of local origin (" + opts.localPct + ")", swatch: seriesColor("green") }]);

      /* Foreign — arrows entering from beyond the frame */
      var foreignChip = chip(436, 18, 168, "Foreign", fmt(opts.foreign) + " · " + opts.foreignPct, seriesColor("blue"));
      hoverable(foreignChip, [{ value: fmt(opts.foreign), label: "publications of foreign origin (" + opts.foreignPct + ")", swatch: seriesColor("blue") }]);
      [[262, 2, 214, 58], [638, 126, 578, 140], [332, 276, 300, 224]].forEach(function (ar) {
        var g = el("g", { stroke: seriesColor("blue"), "stroke-width": 1.6, fill: "none", opacity: 0.85 }, svg);
        el("line", { x1: ar[0], y1: ar[1], x2: ar[2], y2: ar[3] }, g);
        var ang = Math.atan2(ar[3] - ar[1], ar[2] - ar[0]);
        var hx = ar[2], hy = ar[3];
        el("path", {
          d: "M" + (hx - 7 * Math.cos(ang - 0.4)) + "," + (hy - 7 * Math.sin(ang - 0.4)) +
             "L" + hx + "," + hy +
             "L" + (hx - 7 * Math.cos(ang + 0.4)) + "," + (hy - 7 * Math.sin(ang + 0.4))
        }, g);
      });
      label("arrives from outside", 428, 46, 10.5, "end");

      /* Unclear — its own box, outside the map */
      var uy = 288;
      var unGroup = el("g", {}, svg);
      el("rect", {
        x: 8, y: uy, width: 624, height: 62, rx: 10,
        fill: th.surface, stroke: seriesColor("gold"), "stroke-width": 1.5, "stroke-dasharray": "6 4"
      }, unGroup);
      text(unGroup, "Origin unclear — " + fmt(opts.unclear) + " · " + opts.unclearPct, {
        x: 320, y: uy + 26, fill: th.ink, "font-size": 13.5, "font-weight": 700, "text-anchor": "middle", "class": "num"
      });
      text(unGroup, "one in three records has no confirmed origin — it belongs on no map", {
        x: 320, y: uy + 46, fill: th.muted, "font-size": 11, "text-anchor": "middle"
      });
      hoverable(unGroup, [{ value: fmt(opts.unclear), label: "publications of unclear origin (" + opts.unclearPct + ")", swatch: seriesColor("gold") }]);
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
      var name = document.createElement("span");
      name.className = "podium-name";
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
      hoverable(row, [{ value: fmt(d[1]), label: d[0] + " — " + opts.noun }]);
      root.appendChild(row);
    });
  }

  /* ---------- build every chart on the page ---------- */

  function init() {
    if (typeof PPPA === "undefined") return;

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
      lineArea(document.getElementById("c-rain-year"), { points: PPPA.perYear, color: "blue" });
      columns(document.getElementById("c-rain-decade"), { items: decadeItems, color: "blue", labelTop: 8 });
      lineArea(document.getElementById("c-rain-cume"), { points: cume, color: "green", tipLabel: "cumulative bans by" });
    }

    /* --- languages: top three + Unknown + Other (chart-only grouping) --- */
    columns(document.getElementById("c-languages"), {
      items: PPPA.languageGrouped,
      labelTop: PPPA.languageGrouped.length,
      colorOf: function (d, i, th) {
        return d[0] === "Unknown" || d[0] === "Other" ? th.muted : th.series.blue;
      }
    });

    /* --- the seven grounds --- */
    groundsMindmap(document.getElementById("c-grounds"));

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
    var originOf = {};
    PPPA.originCounts.forEach(function (d) { originOf[d[0]] = d[1]; });
    mapOrigin(document.getElementById("c-map"), {
      local: originOf.Local, localPct: pct1(originOf.Local),
      foreign: originOf.Foreign, foreignPct: pct1(originOf.Foreign),
      unclear: originOf.Unclear, unclearPct: pct1(originOf.Unclear)
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
    var kdnByJust = transpose(PPPA.kdnByDecade.values.slice(kdnFirst));
    multiLine(document.getElementById("c-kdnlines"), {
      cats: PPPA.kdnByDecade.decades.slice(kdnFirst),
      series: PPPA.kdnByDecade.justifications.map(function (name, i) {
        return { name: name, values: kdnByJust[i] };
      }),
      colorOf: function (i, th) { return i < th.slots.length ? th.slots[i] : th.muted; },
      incompleteLast: true,
      tipNoun: "stated KDN justifications"
    });

    /* --- decade mix heatmap --- */
    heatmap(document.getElementById("c-decademix"), {
      rows: PPPA.decadeMix.clusters, cols: PPPA.decadeMix.decades,
      values: transpose(PPPA.decadeMix.values), shorten: true, labelWidth: 165,
      max: 100,
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
    heatmap(document.getElementById("c-crosswalk"), {
      rows: PPPA.kdnVsCluster.rows,
      cols: PPPA.kdnVsCluster.cols.map(function (c) { return XWALK_COLS[c] || c; }),
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
