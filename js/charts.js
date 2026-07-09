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

  var CLUSTER_NAMES = [
    "Subversive ideological and political content",
    "Obscene / immoral publications",
    "General/Unindentified",
    "Religious doctrinal deviance",
    "Race, religion & royalty (3R issues)",
    "Administrative/Unclear Ground"
  ];

  var CLUSTER_SHORT = {
    "Subversive ideological and political content": "Subversive/political",
    "Obscene / immoral publications": "Obscene/immoral",
    "General/Unindentified": "General/unidentified",
    "Religious doctrinal deviance": "Religious deviance",
    "Race, religion & royalty (3R issues)": "3R issues",
    "Administrative/Unclear Ground": "Administrative/unclear"
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
        var color = opts.byCluster ? clusterColor(d[0]) : seriesColor(opts.color);
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
        var x = m.left + i * slot + (slot - barW) / 2;
        var h = Math.max(1, (d[1] / max) * plotH);
        var bar = el("path", { d: barTop(x, ys(d[1]), barW, h, 4), fill: color }, svg);
        var lx = m.left + i * slot + slot / 2;
        text(svg, d[0], { x: lx, y: m.top + plotH + 16, fill: th.ink, "font-size": 11.5, "text-anchor": "middle" });
        if (i < (opts.labelTop || 3)) {
          text(svg, fmt(d[1]), { x: lx, y: ys(d[1]) - 6, fill: th.muted, "font-size": 11, "text-anchor": "middle", "class": "num" });
        }
        hoverable(bar, [{ value: fmt(d[1]), label: d[0], swatch: color }]);
        bar.setAttribute("aria-label", d[0] + ": " + fmt(d[1]));
        bar.setAttribute("role", "img");
      });
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

      /* direct label on the extreme */
      var peak = pts.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
      el("circle", { cx: xs(peak[0]), cy: ys(peak[1]), r: 4.5, fill: color, stroke: th.surface, "stroke-width": 2 }, svg);
      text(svg, peak[0] + " · " + fmt(peak[1]), {
        x: xs(peak[0]) + 8, y: ys(peak[1]) + 4, fill: th.ink, "font-size": 11.5, "font-weight": 600, "class": "num"
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
        tipShow([{ value: fmt(p[1]), label: "publications in " + p[0], swatch: color }], e.clientX, e.clientY);
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

  /* ---------- researcher-notes composite (stat tile + bars) ---------- */

  function noteFlags(root, notes) {
    var stat = document.createElement("div");
    stat.className = "stat-tile";
    var lbl = document.createElement("div");
    lbl.className = "stat-label";
    lbl.textContent = "Records with a researcher note";
    var val = document.createElement("div");
    val.className = "stat-value";
    val.textContent = notes.pct + "%";
    var sub = document.createElement("div");
    sub.className = "stat-sub";
    sub.textContent = fmt(notes.flagged) + " of " + fmt(notes.total) + " records carry a classification-quality flag";
    stat.appendChild(lbl); stat.appendChild(val); stat.appendChild(sub);

    var barsBox = document.createElement("div");
    barsBox.className = "note-bars";

    root.classList.add("note-flags");
    root.appendChild(stat);
    root.appendChild(barsBox);

    barsH(barsBox, { items: notes.breakdown, color: "blue", labelWidth: 140 });
  }

  /* ---------- build every chart on the page ---------- */

  function init() {
    if (typeof PPPA === "undefined") return;

    barsH(document.getElementById("c-type"), { items: PPPA.typeCounts, color: "blue", labelWidth: 128 });
    barsH(document.getElementById("c-origin"), { items: PPPA.originCounts, color: "gold", labelWidth: 128 });

    lineArea(document.getElementById("c-peryear"), { points: PPPA.perYear, color: "blue" });

    stacked(document.getElementById("c-decades"), {
      cats: PPPA.decadeClusters.decades,
      series: PPPA.decadeClusters.clusters,
      matrix: PPPA.decadeClusters.values
    });

    barsH(document.getElementById("c-clusters"), {
      items: PPPA.clusterCounts,
      byCluster: true,
      shorten: true,
      labelWidth: 158
    });

    barsH(document.getElementById("c-subclusters"), { items: PPPA.subclusterTop, color: "blue", labelWidth: 178 });

    columns(document.getElementById("c-languages"), { items: PPPA.languageTop, color: "blue" });

    heatmap(document.getElementById("c-originlang"), {
      rows: PPPA.originLang.rows, cols: PPPA.originLang.cols,
      values: PPPA.originLang.values, labelWidth: 74
    });

    barsH(document.getElementById("c-publishers"), { items: PPPA.publisherTop, color: "blue", labelWidth: 215 });

    heatmap(document.getElementById("c-origincluster"), {
      rows: PPPA.originCluster.rows, cols: PPPA.originCluster.cols,
      values: PPPA.originCluster.values, shorten: true, labelWidth: 165
    });

    heatmap(document.getElementById("c-decademix"), {
      rows: PPPA.decadeMix.clusters, cols: PPPA.decadeMix.decades,
      values: transpose(PPPA.decadeMix.values), shorten: true, labelWidth: 165,
      max: 100,
      fmt: function (v) { return Math.round(v) + "%"; },
      cellLabel: "of that decade's titles"
    });

    noteFlags(document.getElementById("c-notes"), PPPA.notes);
  }

  function transpose(mtx) {
    return mtx[0].map(function (_, j) {
      return mtx.map(function (row) { return row[j]; });
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  return { redraw: redraw, CLUSTER_SHORT: CLUSTER_SHORT };
})();
