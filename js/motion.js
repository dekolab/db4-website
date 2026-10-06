/*
 * Entrance reveals, scroll-linked dissolves, and stage parallax.
 *
 * Three layers, all transform/opacity only:
 * - .reveal children (kickers, headlines, paragraphs) stagger in once when
 *   they first enter the viewport.
 * - Dissolve containers (scene text, full-width heads, figures, the pinned
 *   stages) fade with distance from the viewport's vertical centre — content
 *   melts in as it approaches and melts away as it leaves, so the reader
 *   sees beats dissolving into one another rather than blocks scrolling by.
 * - Pinned stages get a gentle parallax on their inner wrapper.
 *
 * prefers-reduced-motion disables all three; CSS also zeroes the transitions.
 */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- staggered one-shot reveals ---------- */

  var SCOPES = ".hero-inner, .scene-text, .full-head, .full-foot, .callout-card, .closing .hero-inner, .law-duel, .trio-row, .revoke-list, .reform-grid, .specimen-grid";

  document.querySelectorAll(SCOPES).forEach(function (scope) {
    scope.querySelectorAll(".reveal").forEach(function (el, i) {
      el.style.setProperty("--i", Math.min(i, 6));
    });
  });

  if (reduced.matches || !("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-in");
    });
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );

  document.querySelectorAll(".reveal").forEach(function (el) {
    io.observe(el);
  });

  /* ---------- scroll-linked dissolves ---------- */

  /* hold: how far from centre (0..1 of half-viewport) an element stays fully
     opaque; range: how much further until fully transparent. */
  function targetsFor(selector, opts) {
    return Array.prototype.map.call(document.querySelectorAll(selector), function (el) {
      return {
        el: el,
        hold: opts.hold,
        range: opts.range,
        translate: opts.translate !== false,
        y: 0 /* last translate we applied — subtracted before measuring */
      };
    });
  }

  var dissolves = []
    /* .closing .hero-inner is absent for the same reason as .reform-grid: the
       source note is the last thing on the page and the reader stops there, so
       a centre-distance dissolve would leave it permanently half-faded. */
    .concat(targetsFor(".hero .hero-inner", { hold: 0.55, range: 0.4 }))
    .concat(targetsFor(".scene-text", { hold: 0.42, range: 0.4 }))
    .concat(targetsFor(".full-head, .full-foot, .chapter.full > .pull-quote", { hold: 0.5, range: 0.42 }))
    /* .reform-grid is deliberately absent: it is the last block on the page,
       so there is no scroll left below it to carry it back towards centre —
       a dissolve there just leaves the recommendations faded where the reader
       stops. It still gets its one-shot .reveal entrance. */
    .concat(targetsFor(".wide-fig, .duo-row > figure, .trio-row > figure, .callout-card, .revoke-list, .specimen-grid, .cover-shelf", { hold: 0.55, range: 0.42 }))
    /* the sticky stage sits at centre while pinned; fade only at chapter
       edges, opacity-only so stickiness is never disturbed */
    .concat(targetsFor(".chapter.pinned .stage", { hold: 0.72, range: 0.32, translate: false }));

  var stages = Array.prototype.map.call(
    document.querySelectorAll(".chapter.pinned"),
    function (ch) {
      return { ch: ch, inner: ch.querySelector(".stage-inner") };
    }
  ).filter(function (s) { return s.inner; });

  var ticking = false;

  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    var half = vh / 2;

    dissolves.forEach(function (t) {
      var r = t.el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < -300 || r.top > vh + 300) return;
      /* measure the element's resting position: subtract our own translate,
         otherwise the shift feeds back into the next measurement */
      var d = ((r.top + r.bottom) / 2 - t.y) / half - 1; /* -1 top … +1 bottom */
      var a = Math.abs(d);
      /* An element taller than the viewport can never sit with its centre at
         the viewport's centre while the reader is on its far end, so measuring
         from the centre alone would dissolve it while it is still being read.
         Widen the hold by however much it overflows the viewport, in the same
         half-viewport units as d — a shorter element adds nothing. */
      var hold = t.hold + Math.max(0, (r.height - vh) / vh);
      var out = Math.max(0, Math.min(1, (a - hold) / t.range));
      t.el.style.opacity = (1 - out).toFixed(3);
      if (t.translate) {
        t.y = (d > 0 ? 1 : -1) * out * 26;
        t.el.style.transform = out ? "translateY(" + t.y.toFixed(1) + "px)" : "";
        if (!out) t.y = 0;
      }
    });

    stages.forEach(function (s) {
      var r = s.ch.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var span = r.height - vh;
      var p = span > 60 ? Math.min(1, Math.max(0, -r.top / span)) : 0.5;
      var y = (p - 0.5) * 26;
      s.inner.style.transform = "translateY(" + y.toFixed(1) + "px)";
    });
  }

  function queue() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(frame);
    }
  }

  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue, { passive: true });
  frame();
})();
