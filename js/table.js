/*
 * Data tab: searchable, sortable, paginated table over all PPPA.rows.
 * Row shape: [title, year, type, origin, languages, cluster, subcluster,
 *             publisher, author, kdnJustification, printer, revokedDate]
 */
var DataTable = (function () {
  "use strict";

  var COLS = [
    { name: "Title", idx: 0 },
    { name: "Year", idx: 1, num: true },
    { name: "Type", idx: 2 },
    { name: "Origin", idx: 3 },
    { name: "Language", idx: 4 },
    { name: "Cluster", idx: 5 },
    { name: "Subcluster", idx: 6 },
    { name: "Publisher", idx: 7 },
    { name: "Author/Translator", idx: 8 },
    { name: "KDN justification", idx: 9 },
    { name: "Printer", idx: 10 },
    { name: "Revoked", idx: 11, badge: true }
  ];
  var PAGE = 25;

  var state = { q: "", cluster: "", origin: "", revoked: false, sort: 1, dir: 1, page: 0 };
  var filtered = [];
  var els = {};
  /* rows ticked for the suggest-an-edit form, in the order they were picked.
   * Selection survives sorting, filtering and paging — it holds row references,
   * not indices, so a record stays selected while it scrolls out of view. */
  var selected = [];

  function norm(v) {
    return v == null ? "" : String(v).toLowerCase();
  }

  function applyFilters() {
    var q = state.q.trim().toLowerCase();
    filtered = PPPA.rows.filter(function (r) {
      if (state.cluster && r[5] !== state.cluster) return false;
      if (state.origin && r[3] !== state.origin) return false;
      if (state.revoked && !r[11]) return false;
      if (!q) return true;
      return norm(r[0]).indexOf(q) !== -1 ||
             norm(r[7]).indexOf(q) !== -1 ||
             norm(r[8]).indexOf(q) !== -1 ||
             norm(r[6]).indexOf(q) !== -1 ||
             norm(r[10]).indexOf(q) !== -1;
    });

    var col = COLS[state.sort], dir = state.dir;
    filtered.sort(function (a, b) {
      var x = a[col.idx], y = b[col.idx];
      if (col.num) {
        x = x == null ? -Infinity : x;
        y = y == null ? -Infinity : y;
        return (x - y) * dir;
      }
      x = norm(x); y = norm(y);
      /* blanks sink to the bottom regardless of direction */
      if (!x && y) return 1;
      if (x && !y) return -1;
      return x < y ? -dir : x > y ? dir : 0;
    });
  }

  function renderHead() {
    var tr = document.createElement("tr");
    COLS.forEach(function (col, i) {
      var th = document.createElement("th");
      th.scope = "col";
      if (i === state.sort) th.setAttribute("aria-sort", state.dir === 1 ? "ascending" : "descending");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = col.name;
      var arrow = document.createElement("span");
      arrow.className = "sort-arrow";
      arrow.textContent = i === state.sort ? (state.dir === 1 ? "▲" : "▼") : "";
      btn.appendChild(arrow);
      btn.addEventListener("click", function () {
        if (state.sort === i) state.dir = -state.dir;
        else { state.sort = i; state.dir = 1; }
        state.page = 0;
        update();
      });
      th.appendChild(btn);
      tr.appendChild(th);
    });

    /* trailing selection column — not sortable */
    if (window.Suggest) {
      var thAction = document.createElement("th");
      thAction.scope = "col";
      thAction.className = "th-action";
      var all = document.createElement("input");
      all.type = "checkbox";
      all.className = "row-select";
      all.setAttribute("aria-label", "Select every record on this page");
      all.addEventListener("change", function () {
        var wasEmpty = selected.length === 0;
        pageRows().forEach(function (r) { setSelected(r, all.checked); });
        renderBody();
        pushSelection(wasEmpty && selected.length > 0);
      });
      els.selectAll = all;
      var lab = document.createElement("span");
      lab.className = "th-action-label";
      lab.textContent = "Select";
      thAction.appendChild(all);
      thAction.appendChild(lab);
      tr.appendChild(thAction);
    }

    els.thead.textContent = "";
    els.thead.appendChild(tr);
  }

  function pageRows() {
    var start = state.page * PAGE;
    return filtered.slice(start, start + PAGE);
  }

  function setSelected(r, on) {
    var i = selected.indexOf(r);
    if (on && i === -1) selected.push(r);
    else if (!on && i !== -1) selected.splice(i, 1);
  }

  /* hand the current selection to the form; `reveal` scrolls it into view */
  function pushSelection(reveal) {
    if (window.Suggest) Suggest.setSelection(selected.slice(), reveal);
  }

  /* the header box reflects this page: all / some / none */
  function syncSelectAll() {
    if (!els.selectAll) return;
    var rows = pageRows();
    var n = 0;
    rows.forEach(function (r) { if (selected.indexOf(r) !== -1) n++; });
    els.selectAll.checked = n > 0 && n === rows.length;
    els.selectAll.indeterminate = n > 0 && n < rows.length;
  }

  function renderBody() {
    var start = state.page * PAGE;
    var slice = filtered.slice(start, start + PAGE);
    els.tbody.textContent = "";
    slice.forEach(function (r) {
      var tr = document.createElement("tr");
      COLS.forEach(function (col) {
        var td = document.createElement("td");
        var v = r[col.idx];
        if (col.badge && v) {
          /* revokedDate "2026-07" renders as a small badge */
          var badge = document.createElement("span");
          badge.className = "td-revoked";
          badge.textContent = "Revoked Jul 2026";
          td.appendChild(badge);
        } else {
          td.textContent = v == null || v === "" ? "—" : v;
          if (v == null || v === "") td.className = "blank";
        }
        if (col.num) td.classList.add("num");
        tr.appendChild(td);
      });

      if (window.Suggest) {
        var on = selected.indexOf(r) !== -1;
        if (on) tr.classList.add("is-picked");

        var tdAction = document.createElement("td");
        tdAction.className = "td-action";
        var box = document.createElement("input");
        box.type = "checkbox";
        box.className = "row-select";
        box.checked = on;
        box.setAttribute("aria-label", "Select “" + r[0] + "” for a suggested edit");
        box.addEventListener("change", function () { apply(r, tr, box.checked); });
        tdAction.appendChild(box);
        tr.appendChild(tdAction);

        /* clicking anywhere else on the row toggles it too */
        tr.addEventListener("click", function (e) {
          if (e.target.closest(".td-action")) return; /* the box handles itself */
          /* don't hijack a click that was the end of a text selection */
          var sel = window.getSelection();
          if (sel && String(sel).trim()) return;
          box.checked = !box.checked;
          apply(r, tr, box.checked);
        });
      }

      els.tbody.appendChild(tr);
    });

    syncSelectAll();

    var total = filtered.length;
    var pages = Math.max(1, Math.ceil(total / PAGE));
    els.count.textContent = total === 0
      ? "No matching records"
      : "Showing " + (start + 1).toLocaleString() + "–" + Math.min(start + PAGE, total).toLocaleString() +
        " of " + total.toLocaleString() + " records";
    els.pageInfo.textContent = "Page " + (state.page + 1) + " of " + pages;
    els.prev.disabled = state.page === 0;
    els.next.disabled = state.page >= pages - 1;
  }

  /* one row toggled: keep the highlight, the header box and the form in step */
  function apply(r, tr, on) {
    var wasEmpty = selected.length === 0;
    setSelected(r, on);
    tr.classList.toggle("is-picked", on);
    syncSelectAll();
    pushSelection(wasEmpty && selected.length > 0);
  }

  function update() {
    applyFilters();
    var pages = Math.max(1, Math.ceil(filtered.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    renderHead();
    renderBody();
  }

  function fillSelect(sel, values, allLabel) {
    var opt = document.createElement("option");
    opt.value = "";
    opt.textContent = allLabel;
    sel.appendChild(opt);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
  }

  function init() {
    if (typeof PPPA === "undefined") return;
    els.thead = document.querySelector("#data-table thead");
    els.tbody = document.querySelector("#data-table tbody");
    els.count = document.getElementById("table-count");
    els.pageInfo = document.getElementById("table-page");
    els.prev = document.getElementById("table-prev");
    els.next = document.getElementById("table-next");
    var search = document.getElementById("table-search");
    var clusterSel = document.getElementById("table-cluster");
    var originSel = document.getElementById("table-origin");
    var revokedChk = document.getElementById("table-revoked");

    fillSelect(clusterSel, PPPA.clusterCounts.map(function (d) { return d[0]; }), "All clusters");
    fillSelect(originSel, PPPA.originCounts.map(function (d) { return d[0]; }), "All origins");

    search.addEventListener("input", function () {
      state.q = search.value;
      state.page = 0;
      update();
    });
    clusterSel.addEventListener("change", function () {
      state.cluster = clusterSel.value;
      state.page = 0;
      update();
    });
    originSel.addEventListener("change", function () {
      state.origin = originSel.value;
      state.page = 0;
      update();
    });
    revokedChk.addEventListener("change", function () {
      state.revoked = revokedChk.checked;
      state.page = 0;
      update();
    });
    els.prev.addEventListener("click", function () { state.page--; renderBody(); });
    els.next.addEventListener("click", function () { state.page++; renderBody(); });

    update();
  }

  document.addEventListener("DOMContentLoaded", init);

  /* called from the suggest form when a chip is dismissed or the list cleared */
  return {
    deselect: function (r) {
      setSelected(r, false);
      renderBody();
      pushSelection(false);
    },
    clearSelection: function () {
      selected.length = 0;
      renderBody();
      pushSelection(false);
    }
  };
})();
