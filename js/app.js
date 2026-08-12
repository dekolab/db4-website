/*
 * Tab routing between the four views: #/story (default), #/data, #/methods,
 * #/contact.
 * In-page anchors (e.g. #overview, or the research methods table of contents)
 * are left alone so the story dots keep working.
 */
var App = (function () {
  "use strict";

  var VIEWS = ["story", "data", "methods", "contact"];
  /* the methods page replaced the old codebook tab; keep shared links working */
  var ALIASES = { codebook: "methods" };
  var storyScroll = 0;
  var current = null;

  function viewFromHash() {
    var h = location.hash;
    if (h.indexOf("#/") === 0) {
      var name = h.slice(2);
      if (ALIASES[name]) name = ALIASES[name];
      if (VIEWS.indexOf(name) !== -1) return name;
    }
    return null;
  }

  function show(name, restoreScroll) {
    if (name === current) return;
    if (current === "story") storyScroll = window.scrollY;
    current = name;

    VIEWS.forEach(function (v) {
      document.getElementById("view-" + v).hidden = v !== name;
    });
    document.body.dataset.view = name;

    document.querySelectorAll(".tabs a").forEach(function (a) {
      if (a.dataset.tab === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    if (name === "story" && restoreScroll) window.scrollTo(0, storyScroll);
    else window.scrollTo(0, 0);
  }

  function route() {
    var v = viewFromHash();
    if (v) show(v, true);
    else if (!current) show("story", false);
    /* a non-view hash (in-page anchor) leaves the current view alone */
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", route);

  return { show: show };
})();
