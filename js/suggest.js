/*
 * "Suggest an edit": turns the form under the data table into a pre-filled
 * GitHub issue, opened in a new tab. No backend, no network calls from here.
 *
 * Records reach the form two ways, and both can be in play at once:
 *   - ticked in the data table, which calls setSelection() with row references
 *   - typed into the title field, for a publication the directory is missing
 *
 * The target template (.github/ISSUE_TEMPLATE/directory_change_request.yml) is a
 * YAML *issue form*, not a Markdown template, so the whole body cannot be passed
 * as &body=. Each field is prefilled by its own query param, keyed on the field's
 * `id` in the YAML. Notes on that:
 *   - `template=` must name the file, otherwise the params are ignored.
 *   - `title=` is reserved for the issue title, which is why the template's
 *     publication field is `publication_title` rather than `title`.
 *   - dropdown params must match an option's text exactly.
 *   - `checkboxes` cannot be prefilled; the submitter ticks those on GitHub.
 *   - `labels=` is honoured only for users with triage rights, so the template's
 *     own `labels:` list is what actually sticks for a visitor.
 */
var Suggest = (function () {
  "use strict";

  var REPO = "dekolab/db4-website";
  var TEMPLATE = "directory_change_request.yml";
  var MAX_MATCHES = 25;   /* datalist options offered while typing */
  var MAX_FIELD = 220;    /* per-record cap inside the quoted block */
  var MAX_URL = 7000;     /* stay clear of the ~8 KB URL ceiling */

  var els = {};
  var selected = [];  /* row references handed over by the data table */
  var matched = null; /* the row a typed title resolves to, if any */

  /* Row shape, mirroring js/table.js:
   * [title, year, type, origin, languages, cluster, subcluster,
   *  publisher, author, kdnJustification, printer, revokedDate] */
  var FIELDS = [
    ["Publication Title", 0],
    ["Year", 1],
    ["Publication Type", 2],
    ["Publication Origin", 3],
    ["Language", 4],
    ["Cluster", 5],
    ["Subcluster", 6],
    ["Publisher", 7],
    ["Author/Translator", 8],
    ["Printer", 10],
    ["KDN justification", 9],
    ["Revoked", 11]
  ];

  function findRow(title) {
    var t = title.trim().toLowerCase();
    if (!t || typeof PPPA === "undefined") return null;
    /* a row ticked in the table wins over a by-title match: 79 titles in the
     * dataset are shared by more than one record */
    for (var s = 0; s < selected.length; s++) {
      if (String(selected[s][0]).toLowerCase() === t) return selected[s];
    }
    for (var i = 0; i < PPPA.rows.length; i++) {
      if (String(PPPA.rows[i][0]).toLowerCase() === t) return PPPA.rows[i];
    }
    return null;
  }

  /* short, human label that tells two same-titled records apart */
  function describe(row) {
    var bits = [row[1] == null ? "year unknown" : String(row[1])];
    if (row[7]) bits.push(row[7]);
    else if (row[8]) bits.push(row[8]);
    return bits.join(" · ");
  }

  function clip(v) {
    v = String(v);
    return v.length > MAX_FIELD ? v.slice(0, MAX_FIELD) + "…" : v;
  }

  function quoteFull(row) {
    var lines = [];
    FIELDS.forEach(function (f) {
      var v = row[f[1]];
      if (v == null || v === "") return;
      lines.push(f[0] + ": " + clip(v));
    });
    return lines.join("\n");
  }

  /* The records as they stand today, so a reviewer sees what is being changed.
   * Three levels of detail — buildUrl() steps down through them if the URL runs
   * long, since a whole page of records will not fit in a query string. */
  function currentBlock(rows, newTitle, mode) {
    var parts = [];
    rows.forEach(function (row, i) {
      var n = rows.length > 1 ? (i + 1) + ". " : "";
      if (mode === "full") {
        var body = quoteFull(row);
        parts.push(rows.length > 1 ? n + body.split("\n").join("\n   ") : body);
      } else if (mode === "brief") {
        parts.push(n + row[0] + " — " + describe(row));
      } else {
        parts.push(n + row[0]);
      }
    });
    if (newTitle) parts.push("Not currently in the directory: " + newTitle);
    return parts.join(mode === "full" ? "\n\n" : "\n");
  }

  function suggestions(q) {
    var t = q.trim().toLowerCase();
    if (t.length < 3 || typeof PPPA === "undefined") return [];
    var hits = [];
    for (var i = 0; i < PPPA.rows.length && hits.length < MAX_MATCHES; i++) {
      var title = String(PPPA.rows[i][0]);
      if (title.toLowerCase().indexOf(t) !== -1) hits.push(title);
    }
    return hits;
  }

  function refreshMatches() {
    var list = suggestions(els.title.value);
    els.datalist.textContent = "";
    list.forEach(function (title) {
      var opt = document.createElement("option");
      opt.value = title;
      els.datalist.appendChild(opt);
    });

    matched = findRow(els.title.value);
    if (matched) {
      els.match.textContent = "Matched an existing record: " + describe(matched) +
        " — its current values will be quoted in the issue.";
      els.match.hidden = false;
    } else {
      els.match.textContent = "";
      els.match.hidden = true;
    }
  }

  /* ---- selection, driven by the table ---- */

  function renderChips() {
    var n = selected.length;
    els.selection.hidden = n === 0;
    els.count.textContent = n === 0 ? "" : "(" + n + ")";
    els.chips.textContent = "";

    selected.forEach(function (row) {
      var li = document.createElement("li");
      li.className = "sg-chip";

      var name = document.createElement("span");
      name.className = "sg-chip-name";
      name.textContent = row[0];
      var meta = document.createElement("span");
      meta.className = "sg-chip-meta";
      meta.textContent = describe(row);

      var drop = document.createElement("button");
      drop.type = "button";
      drop.className = "sg-chip-drop";
      drop.setAttribute("aria-label", "Remove “" + row[0] + "” from the selection");
      drop.textContent = "×";
      drop.addEventListener("click", function () {
        if (window.DataTable) DataTable.deselect(row);
        else { selected.splice(selected.indexOf(row), 1); renderChips(); }
      });

      li.appendChild(name);
      li.appendChild(meta);
      li.appendChild(drop);
      els.chips.appendChild(li);
    });

    /* the title field is only required when nothing is ticked in the table */
    els.titleReq.hidden = n > 0;
    els.titleOpt.hidden = n === 0;
    if (n > 0) setError(els.title, els.titleErr, null);
  }

  /* Called by the data table whenever the ticked set changes. */
  function setSelection(rows, reveal) {
    selected = rows || [];
    if (!els.form) return; /* table rendered before the form was wired up */
    renderChips();
    refreshMatches();
    if (reveal && els.card) {
      els.card.scrollIntoView({ behavior: "smooth", block: "start" });
      els.change.focus({ preventScroll: true });
    }
  }

  /* ---- validation ---- */

  function setError(input, errEl, message) {
    if (message) {
      errEl.textContent = message;
      errEl.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", errEl.id);
    } else {
      errEl.textContent = "";
      errEl.hidden = true;
      input.removeAttribute("aria-invalid");
      input.setAttribute("aria-describedby", input.id + "-hint");
    }
  }

  function validate() {
    var ok = true;
    if (!selected.length && !els.title.value.trim()) {
      setError(els.title, els.titleErr,
        "Tick a record in the table above, or give the publication title here.");
      ok = false;
    } else {
      setError(els.title, els.titleErr, null);
    }
    if (!els.change.value.trim()) {
      setError(els.change, els.changeErr, "Please describe the change you are suggesting.");
      ok = false;
    } else {
      setError(els.change, els.changeErr, null);
    }
    return ok;
  }

  /* ---- the issue URL ---- */

  function issueTitle(rows, newTitle) {
    var total = rows.length + (newTitle ? 1 : 0);
    var first = rows.length ? rows[0][0] : newTitle;
    if (total === 1) return "[Directory]: " + first;
    return "[Directory]: " + total + " records — " + first + " and " + (total - 1) + " more";
  }

  function urlFor(mode) {
    var typed = els.title.value.trim();
    var rows = selected.slice();
    var newTitle = "";

    if (typed) {
      var row = findRow(typed);
      if (row) { if (rows.indexOf(row) === -1) rows.push(row); }
      else newTitle = typed;
    }

    var names = rows.map(function (r) { return r[0]; });
    if (newTitle) names.push(newTitle);

    var params = {
      template: TEMPLATE,
      labels: "data",
      title: issueTitle(rows, newTitle),
      /* an existing record means a correction; otherwise it reads as an addition */
      change_type: rows.length ? "Correct an existing entry" : "Add a missing entry",
      publication_title: names.length > 1
        ? names.length + " records: " + clip(names.join("; "))
        : (names[0] || ""),
      current: currentBlock(rows, newTitle, mode) ||
        "Not currently in the directory (no match found).",
      proposed: els.change.value.trim(),
      evidence: els.source.value.trim() ||
        "No source cited — submitted as an unsourced observation via the website's suggest-an-edit form.",
      reasoning: rows.length > 1
        ? "Suggested through the suggest-an-edit form on the website; " + rows.length +
          " records were selected together, so the change above applies to all of them."
        : "Suggested through the suggest-an-edit form on the website."
    };
    if (els.contact.value.trim()) params.contact = els.contact.value.trim();

    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
    return "https://github.com/" + REPO + "/issues/new?" + qs;
  }

  /* full field-by-field quotes if they fit, then one line each, then bare titles */
  function buildUrl() {
    var modes = ["full", "brief", "titles"];
    var url;
    for (var i = 0; i < modes.length; i++) {
      url = urlFor(modes[i]);
      if (url.length <= MAX_URL) return url;
    }
    return url;
  }

  function onSubmit(e) {
    e.preventDefault();
    els.formErr.hidden = true;

    if (!validate()) {
      (els.title.hasAttribute("aria-invalid") ? els.title : els.change).focus();
      return;
    }

    var url = buildUrl();
    if (url.length > MAX_URL) {
      els.formErr.textContent = "That is too much to pass through a link — GitHub caps how long a " +
        "pre-filled URL can be. Please file this in smaller batches, or shorten the change text.";
      els.formErr.hidden = false;
      return;
    }

    var win = window.open(url, "_blank", "noopener");
    if (!win) {
      els.formErr.textContent = "The new tab was blocked by your browser. Allow pop-ups for this " +
        "site, or use the Contact tab to send the correction by email.";
      els.formErr.hidden = false;
    }
  }

  function init() {
    els.form = document.getElementById("suggest-form");
    if (!els.form) return;

    els.card = document.getElementById("suggest");
    els.title = document.getElementById("sg-title");
    els.change = document.getElementById("sg-change");
    els.source = document.getElementById("sg-source");
    els.contact = document.getElementById("sg-contact");
    els.datalist = document.getElementById("sg-title-matches");
    els.match = document.getElementById("sg-title-match");
    els.titleErr = document.getElementById("sg-title-err");
    els.changeErr = document.getElementById("sg-change-err");
    els.formErr = document.getElementById("sg-form-err");
    els.selection = document.getElementById("sg-selection");
    els.chips = document.getElementById("sg-chips");
    els.count = document.getElementById("sg-count");
    els.clear = document.getElementById("sg-clear");
    els.titleReq = document.getElementById("sg-title-req");
    els.titleOpt = document.getElementById("sg-title-opt");

    els.match.hidden = true;
    els.form.addEventListener("submit", onSubmit);
    els.title.addEventListener("input", function () {
      refreshMatches();
      if (els.title.value.trim()) setError(els.title, els.titleErr, null);
    });
    els.change.addEventListener("input", function () {
      if (els.change.value.trim()) setError(els.change, els.changeErr, null);
    });
    els.clear.addEventListener("click", function () {
      if (window.DataTable) DataTable.clearSelection();
      else setSelection([], false);
    });

    /* "suggest an edit" links from elsewhere (e.g. the contact card) */
    document.querySelectorAll('[data-goto="suggest"]').forEach(function (a) {
      a.addEventListener("click", function () {
        window.setTimeout(function () {
          if (els.card) els.card.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      });
    });

    renderChips();
  }

  document.addEventListener("DOMContentLoaded", init);
  return { setSelection: setSelection, buildUrl: buildUrl };
})();
