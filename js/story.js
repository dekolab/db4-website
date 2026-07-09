/*
 * Scroll-driven crossfade for the PPPA story.
 *
 * Each .scene carries a data-scene id. An IntersectionObserver watches for
 * the scene whose content crosses the middle band of the viewport and
 * activates the matching .viz layer in the pinned stage; CSS handles the
 * opacity crossfade (or an instant swap under prefers-reduced-motion).
 */
(function () {
  "use strict";

  var vizLayers = document.querySelectorAll(".viz");
  var scenes = document.querySelectorAll("[data-scene]");
  var dots = document.querySelectorAll(".dots a");
  var progressBar = document.getElementById("progress-bar");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var vizById = {};
  vizLayers.forEach(function (layer) {
    vizById[layer.dataset.viz] = layer;
  });

  var dotById = {};
  dots.forEach(function (dot) {
    dotById[dot.dataset.dot] = dot;
  });

  var activeViz = null;
  var activeDot = null;

  function activate(sceneId) {
    // Crossfade the stage: hero/closing have no viz layer, so the current
    // chart simply stays put while those full-width scenes cover the stage.
    var layer = vizById[sceneId];
    if (layer && layer !== activeViz) {
      if (activeViz) activeViz.classList.remove("is-active");
      layer.classList.add("is-active");
      activeViz = layer;
    }

    var dot = dotById[sceneId];
    if (dot && dot !== activeDot) {
      if (activeDot) activeDot.classList.remove("is-active");
      dot.classList.add("is-active");
      activeDot = dot;
    }
  }

  // A scene is "current" while it intersects the horizontal band around the
  // viewport's vertical midpoint. Exactly one scene occupies that band at a
  // time because every scene is at least ~60vh tall.
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          activate(entry.target.dataset.scene);
        }
      });
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
  );

  scenes.forEach(function (scene) {
    observer.observe(scene);
  });

  // Show the first chart before any scene has crossed the midline, so the
  // stage is never empty when the reader enters the story.
  activate("hook");
  if (vizLayers.length) {
    vizLayers[0].classList.add("is-active");
    activeViz = vizLayers[0];
  }

  // Slim reading-progress bar, rAF-throttled, transform-only.
  var ticking = false;

  function updateProgress() {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var fraction = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressBar.style.transform = "scaleX(" + fraction + ")";
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateProgress);
      }
    },
    { passive: true }
  );

  updateProgress();

  // Dot navigation: smooth scroll unless the reader prefers reduced motion
  // (html { scroll-behavior } already handles this, but keyboard-triggered
  // clicks on some browsers bypass it, so be explicit).
  dots.forEach(function (dot) {
    dot.addEventListener("click", function (event) {
      var target = document.querySelector(dot.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      /* A mouse click (detail > 0) leaves focus on the dot, which pins the
         label rail open via :focus-within — release it. Keyboard activation
         (detail 0) keeps focus so tab navigation stays anchored. */
      if (event.detail > 0) dot.blur();
      target.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "start"
      });
    });
  });
})();
