/*
 * Light/dark theme: defaults to the system preference, a topbar toggle
 * overrides it (persisted in localStorage). The <head> snippet sets
 * html[data-theme] before first paint; this module keeps the button and
 * the charts in sync via a "themechange" event.
 */
var Theme = (function () {
  "use strict";

  var media = window.matchMedia("(prefers-color-scheme: dark)");

  function stored() {
    try { return localStorage.getItem("theme"); } catch (e) { return null; }
  }

  function apply(name, persist) {
    document.documentElement.dataset.theme = name;
    if (persist) {
      try { localStorage.setItem("theme", name); } catch (e) { /* private mode */ }
    }
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.textContent = name === "dark" ? "☀" : "☾";
      btn.setAttribute("aria-label", name === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
    window.dispatchEvent(new Event("themechange"));
  }

  media.addEventListener("change", function (e) {
    if (!stored()) apply(e.matches ? "dark" : "light", false);
  });

  document.addEventListener("DOMContentLoaded", function () {
    apply(document.documentElement.dataset.theme || (media.matches ? "dark" : "light"), false);
    document.getElementById("theme-toggle").addEventListener("click", function () {
      apply(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
    });
  });

  return { apply: apply };
})();
