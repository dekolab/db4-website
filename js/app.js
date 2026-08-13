/*
 * Tab routing between the seven views: #/story (default), #/data, #/methods,
 * #/limitations, #/taxonomy, #/team, #/contact.
 * The middle four are the codebook documents: they share one topbar tab, which
 * is a disclosure button opening a menu of the four.
 * In-page anchors (e.g. #overview, or a document page's table of contents) are
 * left alone so the story dots keep working.
 */
var App = (function () {
  "use strict";

  var VIEWS = ["story", "data", "methods", "limitations", "taxonomy", "team", "contact"];
  /* the views that sit under the Codebook tab */
  var DOCS = ["methods", "limitations", "taxonomy", "team"];
  /* the codebook used to be a single page; keep shared links working */
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

    /* the Codebook tab stays lit for any of the three documents under it */
    var btn = document.getElementById("codebook-btn");
    if (btn) {
      if (DOCS.indexOf(name) !== -1) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    }

    if (name === "story" && restoreScroll) window.scrollTo(0, storyScroll);
    else window.scrollTo(0, 0);
  }

  function route() {
    var v = viewFromHash();
    if (v) show(v, true);
    else if (!current) show("story", false);
    /* a non-view hash (in-page anchor) leaves the current view alone */
  }

  /* Codebook menu: a disclosure button, not a role="menu" — the items are
     ordinary links, so Tab walks them and Escape closes. */
  function initMenu() {
    var btn = document.getElementById("codebook-btn");
    var menu = document.getElementById("codebook-menu");
    if (!btn || !menu) return;

    function setOpen(open) {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(menu.hidden);
    });

    /* picking a document closes the menu; routing is left to the hash change */
    menu.addEventListener("click", function () { setOpen(false); });

    document.addEventListener("click", function (e) {
      if (!menu.hidden && !menu.contains(e.target)) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { setOpen(false); btn.focus(); }
    });

    /* a link elsewhere on the page can also land on a document */
    window.addEventListener("hashchange", function () { setOpen(false); });
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", function () {
    route();
    initMenu();
  });

  return { show: show };
})();
