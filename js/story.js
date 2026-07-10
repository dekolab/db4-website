/*
 * Scroll-driven crossfade for the PPPA story.
 *
 * Each .scene carries a data-scene id. An IntersectionObserver watches for
 * the scene whose content crosses the middle band of the viewport and
 * activates the matching .viz layer inside ITS OWN pinned stage (the page
 * has several stages now — left-pinned, right-pinned — each holding one or
 * two crossfading layers). CSS handles the opacity dissolve, or an instant
 * swap under prefers-reduced-motion.
 */
(function () {
  "use strict";

  var vizLayers = document.querySelectorAll(".viz");
  var scenes = document.querySelectorAll("[data-scene]");
  var dots = document.querySelectorAll(".dots a");
  var progressBar = document.getElementById("progress-bar");
  var railFill = document.getElementById("rail-fill");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var vizById = {};
  vizLayers.forEach(function (layer) {
    vizById[layer.dataset.viz] = layer;
  });

  var dotById = {};
  dots.forEach(function (dot) {
    dotById[dot.dataset.dot] = dot;
  });

  var activeDot = null;

  function activate(sceneId) {
    /* Crossfade within the scene's own stage; scenes without a viz layer
       (hero, full-width moments, the callout, closing) only move the dot. */
    var layer = vizById[sceneId];
    if (layer && !layer.classList.contains("is-active")) {
      var stage = layer.closest(".stage");
      stage.querySelectorAll(".viz.is-active").forEach(function (v) {
        v.classList.remove("is-active");
      });
      layer.classList.add("is-active");
    }

    var dot = dotById[sceneId];
    if (dot && dot !== activeDot) {
      if (activeDot) activeDot.classList.remove("is-active");
      dot.classList.add("is-active");
      activeDot = dot;
    }
  }

  /* A scene is "current" while it intersects the band around the viewport's
     vertical midpoint. */
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

  /* Every stage starts with its first layer visible so no stage is ever empty. */
  activate("hook");
  document.querySelectorAll(".stage").forEach(function (stage) {
    var first = stage.querySelector(".viz");
    if (first) first.classList.add("is-active");
  });

  /* Reading progress: slim top bar + the vertical rail behind the dots. */
  var ticking = false;

  function updateProgress() {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var fraction = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressBar.style.transform = "scaleX(" + fraction + ")";
    if (railFill) railFill.style.transform = "scaleY(" + fraction + ")";
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

  /* Dot navigation. */
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
        /* scenes read centred (matching the auto-snap anchors); chapters
           and full scenes align to their top */
        block: target.classList.contains("scene") ? "center" : "start"
      });
    });
  });
})();
