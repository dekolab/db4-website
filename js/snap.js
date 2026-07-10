/*
 * Gentle auto-snap for the story view.
 *
 * When scrolling comes to rest NEAR a story beat (a scene's reading
 * position, a chapter head, the callout, the hero or closing), the view
 * eases the remaining distance so beats always land composed. Proximity
 * only — stop between beats and nothing moves; any input cancels the glide.
 * Disabled under prefers-reduced-motion.
 */
var Snap = (function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches) return {};

  var mobile = window.matchMedia("(max-width: 900px)");
  var TOPBAR = 55;
  var IDLE_MS = 170;
  var DURATION = 520;

  var anchors = [];
  var idleTimer = null;
  var animating = false;
  var animId = 0;

  function docTop(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  /* centre an element inside the strip of viewport not covered by the
     pinned mobile stage (desktop strip = the whole viewport) */
  function centreIn(el, stripTop) {
    var vh = window.innerHeight;
    return docTop(el) + el.offsetHeight / 2 - (stripTop + (vh - stripTop) / 2);
  }

  function collect() {
    anchors = [];
    var vh = window.innerHeight;

    anchors.push(0); /* hero */

    document.querySelectorAll(".chapter.pinned .flow .scene").forEach(function (scene) {
      var stripTop = mobile.matches ? vh * 0.56 : 0;
      anchors.push(centreIn(scene, stripTop));
    });

    document.querySelectorAll(".chapter.full").forEach(function (section) {
      anchors.push(docTop(section) - TOPBAR);
    });

    var foot = document.getElementById("subclusters");
    if (foot) anchors.push(centreIn(foot, 0));

    var callout = document.querySelector(".callout-card");
    if (callout) anchors.push(centreIn(callout, 0));

    anchors.push(document.documentElement.scrollHeight - vh); /* closing */

    var max = document.documentElement.scrollHeight - vh;
    anchors = anchors
      .map(function (y) { return Math.max(0, Math.min(max, Math.round(y))); })
      .sort(function (a, b) { return a - b; });
  }

  function cancelGlide() {
    animId++;
    animating = false;
  }

  function glideTo(target) {
    var from = window.scrollY;
    var delta = target - from;
    if (Math.abs(delta) < 6) return;
    var id = ++animId;
    var start = null;
    animating = true;

    function ease(t) { /* easeInOutCubic */
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(now) {
      if (id !== animId) return; /* cancelled by user input or a new glide */
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / DURATION);
      window.scrollTo({ top: from + delta * ease(t), behavior: "instant" });
      if (t < 1) requestAnimationFrame(step);
      else animating = false;
    }

    requestAnimationFrame(step);
  }

  var pointerHeld = false;

  function settle() {
    if (animating || pointerHeld) return;
    if (document.body.dataset.view !== "story") return;
    var y = window.scrollY;
    var threshold = Math.min(window.innerHeight * 0.3, 300);
    var best = null, bestDist = Infinity;
    for (var i = 0; i < anchors.length; i++) {
      var dist = Math.abs(anchors[i] - y);
      if (dist < bestDist) { bestDist = dist; best = anchors[i]; }
    }
    if (best !== null && bestDist <= threshold) glideTo(best);
  }

  /* "scrollend" fires once when scrolling (including native smooth and
     momentum) truly finishes — the reliable settle trigger. The idle timer
     is only a fallback for browsers without it, where a long smooth scroll
     could otherwise pause mid-flight and be hijacked. */
  var hasScrollend = "onscrollend" in window;

  if (hasScrollend) {
    window.addEventListener("scrollend", function () {
      if (!animating) settle();
    }, { passive: true });
  } else {
    window.addEventListener("scroll", function () {
      if (animating) return; /* our own glide also fires scroll events */
      clearTimeout(idleTimer);
      idleTimer = setTimeout(settle, IDLE_MS);
    }, { passive: true });
  }

  /* any fresh input takes control back immediately; while a pointer or
     finger is held (scrollbar drag, touch drag) never snap underneath it */
  ["wheel", "keydown"].forEach(function (evt) {
    window.addEventListener(evt, function () {
      cancelGlide();
      clearTimeout(idleTimer);
    }, { passive: true });
  });
  ["pointerdown", "touchstart"].forEach(function (evt) {
    window.addEventListener(evt, function () {
      pointerHeld = true;
      cancelGlide();
      clearTimeout(idleTimer);
    }, { passive: true });
  });
  ["pointerup", "pointercancel", "touchend", "touchcancel"].forEach(function (evt) {
    window.addEventListener(evt, function () {
      pointerHeld = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(settle, IDLE_MS);
    }, { passive: true });
  });

  window.addEventListener("resize", function () {
    cancelGlide();
    collect();
  }, { passive: true });

  /* charts and webfont icons settle layout shortly after load */
  window.addEventListener("load", function () {
    setTimeout(collect, 400);
  });
  collect();

  return { collect: collect };
})();
