/*
 * Gentle auto-snap for the story view.
 *
 * When scrolling comes to rest NEAR a story beat (a scene's reading
 * position, a chapter head, the callout, the hero or closing), the view
 * eases the remaining distance so beats always land composed. Proximity
 * only — stop between beats and nothing moves; any input cancels the glide.
 * Disabled under prefers-reduced-motion.
 *
 * Every anchor is computed against the *visible* strip, not the viewport:
 * the fixed topbar always covers the first TOPBAR pixels, and on mobile the
 * pinned stage covers the top 56% on top of that. A beat taller than its
 * strip cannot be centred without pushing its kicker and headline up behind
 * one of them, so those land top-aligned instead.
 */
var Snap = (function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches) return {};

  var mobile = window.matchMedia("(max-width: 900px)");
  var TOPBAR = 55;          /* --topbar: 3.4rem, the fixed header */
  var STAGE_VH = 0.56;      /* mobile pinned stage height, see styles.css */
  var HEAD_GAP = 14;        /* breathing room above a top-aligned beat */
  var IDLE_MS = 170;
  var DURATION = 520;

  var anchors = [];
  var idleTimer = null;
  var animating = false;
  var animId = 0;

  function docTop(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  /* the first pixel of viewport nothing is covering: below the topbar, and
     below the pinned stage too while it is stacked above the flow on mobile */
  function stripTop(underStage) {
    return underStage && mobile.matches
      ? window.innerHeight * STAGE_VH
      : TOPBAR;
  }

  /* Centre an element in that strip — unless it is too tall to fit, in which
     case centring would hide its opening lines under the stage or the topbar.
     Those align to the top of the strip so the heading always reads. */
  function centreIn(el, top) {
    var strip = window.innerHeight - top;
    var h = el.offsetHeight;
    if (h + HEAD_GAP > strip) return docTop(el) - top + HEAD_GAP;
    return docTop(el) + h / 2 - (top + strip / 2);
  }

  function collect() {
    anchors = [];
    var vh = window.innerHeight;

    anchors.push(0); /* hero */

    /* the .scene box is a 100vh flex container, so measure the text block it
       centres — that is what the stage can actually cover */
    document.querySelectorAll(".chapter.pinned .flow .scene").forEach(function (scene) {
      anchors.push(centreIn(scene.querySelector(".scene-text") || scene, stripTop(true)));
    });

    document.querySelectorAll(".chapter.full").forEach(function (section) {
      anchors.push(docTop(section) - TOPBAR);
    });

    document.querySelectorAll(".callout-card").forEach(function (card) {
      anchors.push(centreIn(card, stripTop(false)));
    });

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
