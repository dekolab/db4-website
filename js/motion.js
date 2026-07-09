/*
 * Entrance reveals and stage parallax for the story view.
 *
 * - Every .reveal element fades/translates in when it enters the viewport,
 *   staggered by its position among the .reveal siblings of its scope
 *   (hero, scene, full-head, duo-row, callout…). One-shot: once revealed,
 *   the observer lets go.
 * - Pinned stages get a gentle parallax: the .stage-inner wrapper drifts a
 *   few pixels across the chapter's scroll span (transform-only).
 * - prefers-reduced-motion disables both; CSS also zeroes the transitions.
 */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- staggered reveals ---------- */

  var SCOPES = ".hero-inner, .scene-text, .full-head, .full-foot, .callout-card, .closing .hero-inner";

  document.querySelectorAll(SCOPES).forEach(function (scope) {
    scope.querySelectorAll(".reveal").forEach(function (el, i) {
      el.style.setProperty("--i", Math.min(i, 6));
    });
  });
  /* Stages and standalone figures reveal as single blocks with a late beat,
     so charts settle in just after their text. */
  document.querySelectorAll(".stage.reveal, .wide-fig.reveal, .duo-row > .reveal").forEach(function (el, i) {
    if (!el.style.getPropertyValue("--i")) el.style.setProperty("--i", 2);
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

  /* ---------- pinned-stage parallax ---------- */

  var stages = Array.prototype.map.call(
    document.querySelectorAll(".chapter.pinned"),
    function (ch) {
      return { ch: ch, inner: ch.querySelector(".stage-inner") };
    }
  ).filter(function (s) { return s.inner; });

  if (!stages.length) return;

  var ticking = false;

  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    stages.forEach(function (s) {
      var r = s.ch.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var span = r.height - vh;
      var p = span > 60 ? Math.min(1, Math.max(0, -r.top / span)) : 0.5;
      var y = (p - 0.5) * 26; /* -13px … 13px across the chapter */
      s.inner.style.transform = "translateY(" + y.toFixed(1) + "px)";
    });
  }

  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(frame);
    }
  }, { passive: true });

  frame();
})();
