# Final-data swap — change report

**Date:** 13 August 2026
**Inputs:** `Finalise-Codebook/final-data.csv` (3,212 rows) and `Finalise-Codebook/storytelling.md` (Frames 1–17)
**Files changed:** `js/data.js` (regenerated), `Analysis-Reference/generate_data.py` (repointed), `js/charts.js` (two hardcoded value blocks), `index.html` (story-view prose + `<head>` meta description; later, the Frame 14 beat), `styles.css` and `js/motion.js` (Frame 14 beat only — cluster colour tokens, specimen-card styles, two selector-list additions)
**Files untouched, as required:** Data tab, the three Codebook documents, Contact tab, `js/table.js`, `js/suggest.js`, `js/theme.js`, `js/app.js`, `js/story.js`, `js/snap.js`, `js/rain3d.js`, `js/geo.js`

---

## 1. How the data was regenerated

The existing generator `Analysis-Reference/generate_data.py` was repointed from
`sample-data.csv` to `../Finalise-Codebook/final-data.csv` and rerun — no transform logic
changed. All of its built-in assertions passed against the final CSV, including:

- the pinned author top-10 counts `[21, 18, 16, 10, 9, 9, 9, 8, 8, 7]` (sum 115);
- the pinned printer top-10 counts (Yayasan Perkhabaran Injil 35, …);
- the KDN justification set (exactly the seven known Malay strings);
- **all five July 2026 revocation titles matched by exact string** — the generator raises
  if any fails to match, so this cannot fail silently.

A structural diff of old vs new `js/data.js` confirmed: identical key names, key order,
array shapes, inner-dict key order, and 12-column row order. Every difference is a data
value. The only length change is `rows` 3,213 → 3,212.

### What actually changed in the underlying rows

- The blank-titled 1951 record (Kemoralan / Communism-Socialism / Foreign, no language)
  was dropped — this accounts for most single-unit deltas below.
- A handful of records carry corrections in the final CSV, e.g. *Awake* (1998 → 1952, its
  Kemoralan justification removed), *The Koran…* (Ketenteraman Awam removed), *Penthouse*
  (1986 → 1974), *Gigolo* (1997 → 1993), two 1952 records moved to 1950/1951. These
  produce the −4 in KDN coverage and the 9 → 5 drop in pre-1984 justifications.
- One incidental effect: the final CSV's row order differs, so the three-way count tie at
  the bottom of `languageTop` (Arabic / JAWI / Japanese, 3 each) lands in a different
  order under the same first-appearance tie-break rule. No chart reads `languageTop`, so
  nothing visible changes.

## 2. Reconciliation table, as verified against final-data.csv

| Figure | storytelling.md / old site | final-data.csv (used) | Verified |
|---|---|---|---|
| Total records | 3,213 | **3,212** | ✔ |
| 1951 (pull-quote) | 445 | **444** | ✔ |
| 1950s | 787 | **786** | ✔ |
| Subversive ideological & political | 974 | **973** | ✔ |
| Communism/Socialism subcluster | 850 | **849** | ✔ |
| Printed documents | 3,148 | **3,147** | ✔ |
| Foreign origin | 1,477 | **1,476** | ✔ |
| KDN justifications available | 1,590 | **1,586** | ✔ |
| KDN records pre-1984 | 9 | **5** | ✔ |
| Morality | 895 | **893** | ✔ |
| Public order | 654 | **652** | ✔ |
| Morality × religious doctrinal | 16 | **15** | ✔ (in `kdnVsCluster`; not quoted in prose) |
| Public order × religious doctrinal | 565 | **564** | ✔ |
| Distinct publishers | 1,734 | **1,733** | ✔ (in `meta`; not quoted in prose) |
| Flagged notes | 296 | **295** | ✔ (in `notes`; not quoted in prose) |
| Subversive in the 1950s | 660 | **659** | ✔ (follows from the dropped row) |
| Unknown language | 263 | **262** | ✔ (the dropped row had a blank language cell) |

Confirmed unchanged (spot-checked in the regenerated aggregates): decade counts
1960s–2020s (247 / 408 / 358 / 715 / 399 / 229 / 70), Local 669, Unclear 1,067, Obscene
1,252, Religious 684, 3R 22, General 281, Erotic 1,097, Other 573, Pornography 155,
Al-Arqam 95, Revolutionary 78, LGBT 41, Ethnic 15, Syiah 10, Ahmadiyyah 6, Terrorism 5,
Insults to religion 4, Royalty 3, gazettes 524, the author/printer/publisher podiums,
morality → obscene 820 (701 erotic / 119 pornography / 37 LGBT), public order → Al-Arqam
90 / Syiah 7 / Ahmadiyyah 6, communism × security 1 vs public order 12, and the KDN
per-decade peaks (morality 383, public order 282 in the 1990s; public order 123 in the
2010s).

### Recomputed percentages (denominator 3,212, not copied from storytelling.md)

Two displayed percentages changed by a rounding step: **1990s share 22.2% → 22.3%**
(715 ÷ 3,212) and **erotic/immoral 34.1% → 34.2%** (1,097 ÷ 3,212); communism/socialism
moves 26.5% → **26.4%** (849 ÷ 3,212). All others round to the same string as before
(24.5%, 39.0%, 30.3%, 21.3%, 8.7%, 0.7%, 90.6%, 17.8%, 4.8%, 60.6%, 83.8%, 95.9%, 97.4%,
46%, 20.8%, 33.2%, 98%).

## 3. Every figure changed in the site

**`js/data.js`** — regenerated wholesale; all deltas above.

**`js/charts.js`** (the only two places `init()` passed literals):
- `pictograph(#c-types)` and `mapOrigin(#c-map)` now read from `PPPA.typeCounts` /
  `PPPA.originCounts` / `PPPA.meta.total` and compute their percentage strings, so they
  cannot drift again. Verified the computed output reproduces the old formatting exactly
  (`98%`, `46%`, `20.8%`, `33.2%`) with the new counts (3,147 / 57 / 8; 1,476 / 669 /
  1,067). The rendering functions themselves are byte-identical.

**`index.html` story view** (scene → what changed):
- `<head>` meta description: 3,213 → 3,212
- `hook` standfirst: 3,213 → 3,212
- `per-year` head: 3,213 → 3,212; 787 → 786; 22.2% → 22.3% · per-year aria: 445 → 444 ·
  decade aria: 787 → 786 · cumulative aria: 3,213 → 3,212 · pull-quote: 445 → 444
- `languages` scene + chart aria: unknown 263 → 262
- `types-origin` scene + pictograph aria: 3,148 of 3,213 → 3,147 of 3,212
- `origin-map` scene + map aria: 1,477 → 1,476
- `clusters-time` scene: rewritten to carry Frame 12's cluster totals (1,252 / 39.0%,
  973 / 30.3%, 684 / 21.3%, 22 / 0.7%, 281 / 8.7%) before the decade shift; 660 of 787
  (83.9%) → 659 of 786 (83.8%) · stack aria: 787 → 786, 660 → 659
- `clusters-lines` scene: 850 → 849, 26.5% → 26.4%, 34.1% → 34.2%; second paragraph now
  carries Frame 12's close (top three clusters 90.6%; taxonomy ≠ KDN justification ≠
  policy intent) · lines aria: 660 → 659
- `kdn` scene + chips + figcaption + chart aria: 1,590 of 3,213 → 1,586 of 3,212; nine →
  five pre-1984; morality 895 → 893; public order 654 → 652
- `decade-mix` scene: 660 of 787 → 659 of 786 (existing angle kept; heatmap aria's
  rounded shares are unchanged by the data)
- `subclusters` head: 34.1% → 34.2%, 850 → 849, 26.5% → 26.4%, 1,947 → 1,946, pornography
  share 4.8% added · bar aria: 850 → 849 · foot: rewritten per Frame 13 — explains the
  573 (17.8%) under the chart's "Other" label and the 281 (8.7%) under
  "administrative/unclear ground" separately (replacing the combined 854 / 26.6%
  framing), then the descending remainder
- `crosswalk` scene + aria: 895 → 893; 565 of 654 → 564 of 652; heatmap population
  1,590 → 1,586
- `revocations`: no changes needed (five titles, banned-years 2017 / 2026 × 4 verified
  against the regenerated rows)
- `reform` card 2: 787 → 786
- `closing` standfirst: 3,213 → 3,212 · colophon: n = 3,213 → 3,212

**Label-mismatch handling (as instructed, data labels not renamed):** storytelling.md's
"Other religious doctrinal teachings" is worded in the subclusters foot as *"labelled
'Other' in the chart — religious doctrinal publications not classified under the more
specific Al-Arqam, Syiah or Ahmadiyyah subclusters"*, and its "Multiple grounds" as *"the
281 records under 'administrative/unclear ground', the only subcluster within general or
unidentified"* — so the prose reads correctly against the chart labels.

## 4. Questions for you

1. **Malformed language cell** — *Kita Mesti Menang! Penjajahan British Di Hong Kong*
   has `Language = ["Chinese"] ["English"]` (two concatenated JSON arrays) in
   final-data.csv. As before, the build keeps the cell unparsed: it is excluded from the
   named-language counts, lands in the chart's "Other" bucket, and displays verbatim in
   the Data tab. Parsing it properly would count it once under Chinese (→ 1,159) and once
   under English (→ 948). **Fix the CSV cell to `["Chinese", "English"]`, or keep as-is?**
   (One nuance: the old build routed it to "Other", not "Unknown" — unknown is 262 purely
   because the dropped 1951 row had a blank language cell.)

2. **Frame 14 — resolved.** Added as a new beat (`#examples`, "Six records, up close")
   between `subclusters` and `crosswalk`: six specimen cards drawn from the dataset, each
   keyed to its cluster colour (matching the chart theme slots exactly, light and dark),
   showing the gazette fields verbatim — with the Data tab's dash convention for blanks —
   plus one data-derived note per card (75 of 95 Al-Arqam bans in 1994 alone; one of 23
   public-alarm justifications ever; both Zunar titles gazetted in 2010 on public-order
   grounds; *Mao Zedong* banned and revoked within 2026). The last card's
   morality-vs-ethnic-incitement mismatch hands off to the crosswalk beat. The new scene
   and dot are auto-discovered by `story.js`/`snap.js`; `motion.js` gained the
   `.specimen-grid` container in its two selector lists so the cards stagger and dissolve
   like the site's other card groups (and inherit the reduced-motion path). Every numeric
   claim in the cards was verified against `final-data.csv`.

   **Covers (added after review of `asset/img/covers/`).** Of the six example records,
   exactly one — *Kahwin Cara Arqam* — has a traced cover in `_source_log.csv`; the other
   five are `PLACEHOLDER`. **No placeholder image is used anywhere on the site.** Where no
   cover exists the card shows a CSS-drawn empty plate reading "no cover found" — same
   message as the generated placeholder, but weightless, theme-aware and honestly framed
   rather than standing in for a jacket. The beat's opening paragraph now names this:
   "Five of the six have no traceable cover, which is the ordinary case."

   A decorative **cover shelf** sits between the head and the cards: 12 real covers,
   chronological 1952 → 2025, bottom-aligned on a hairline like books on a shelf, spanning
   the clusters (Stalin, Mao, *The Satanic Verses*, *Arqam Militan*, *Kahwin Cara Arqam*,
   *The Qur'an*, *Heartstopper*, *My Shadow Is Purple*). All 148 real covers were reviewed
   on a contact sheet first; the selection deliberately excludes the erotica and
   pornography jackets that make up much of the traced set. The images are decorative
   (`aria-hidden`, empty `alt`), lazy-loaded, and carry intrinsic `width`/`height` so
   nothing shifts; the caption beneath is real content and states the coverage honestly —
   cover images exist for only **158 of 3,212** records. The shelf clips rather than
   scrolls, so no content is trapped out of a keyboard's reach.

   Total added page weight: 13 images, ~486 KB, all lazy.

3. **Frame 16 covers (the revocations beat).** None of the five revoked titles had a
   traced cover — all five were `placeholder` in `_source_log.csv`. A fuzzy and keyword
   sweep across the 148 real covers confirmed no near match under a variant title, so I
   queried Open Library directly for each of the five:

   | Title | Result |
   |---|---|
   | *Islam Without Extremes: A Muslim Case for Liberty* | **cover found** (Mustafa Akyol, 2011, cover id 10305304) |
   | *Memoir Shamsiah Fakeh Dari Awas Ke Rejimen Ke-10* | record exists, **no cover image** |
   | *Komrad Asi (Rejimen 10) Dalam Denyut Nihilisme Sejarah* | no record |
   | *Mao Zedong: China Dalam Dunia Abad Ke-20* | no record |
   | *Sigandi* | no record |

   The Akyol cover was fetched (320×500, 29 KB), **visually verified as the correct book**
   before use, saved as
   `asset/img/covers/2017_Islam_Without_Extremes_A_Muslim_Case_For_Liberty.jpg` following
   the existing naming convention, and its `_source_log.csv` row updated from
   `placeholder` to `open_library` with the new path. Real covers: 148 → **149**.

   Why the original run missed it is worth noting for the next sourcing pass: the dataset
   title carries a spaced colon — `Islam Without Extremes : A Muslim Case For Liberty` —
   which likely defeated the match. Other placeholders may be recoverable with light title
   normalisation.

   All five revoke cards now carry a plate at list scale (2.5 rem, 2:3) — the traced cover
   on the first, empty plates on the other four — so the one cover sits in a consistent
   frame rather than making a single card lopsided. The mobile breakpoint was updated too:
   its single-column rule had no `plate` area, which would have auto-placed the plate and
   stretched it to full card width.

## 4b. Placeholder covers removed

`asset/img/covers/` held **101 MB across 3,157 files**, of which 3,009 were generated
`PLACEHOLDER` jackets the site never referenced. On request, all 3,009 were deleted
(88.6 MB reclaimed); the directory is now **149 files / 6.3 MB** — 148 real covers plus
`_source_log.csv`.

Verified before deleting: the delete set matched `*PLACEHOLDER*.jpg` exactly, no
real-cover filename contains that token, and nothing in `index.html`, `styles.css` or
`js/` referenced a placeholder. Verified after: all 148 real covers intact, all 15 images
referenced by `index.html` resolve, manifest untouched.

The 3,009-vs-3,026 gap between files and manifest rows is 17 duplicate titles that
sanitise to the same filename — not a shortfall.

`_source_log.csv` now logs 3,025 placeholder rows with their old `file` paths (one row
moved to `open_library` when the *Islam Without Extremes* cover was traced — see §4). That
is deliberate — it remains an accurate record of the sourcing run, and the `source`
column is the authoritative signal. **Any future cover lookup must test
`source != 'placeholder'` before trusting the `file` column**, since those paths no
longer resolve. Note also that the placeholders will return if the cover-sourcing script
is rerun; a `*PLACEHOLDER*` line in `.gitignore` would guard against that, but I have not
added one.

## 4c. Research Team page

Added as a fourth entry in the Codebook dropdown (`#/team`, "Research Team") — the group
now reads Research Methods · Research Limitations · Taxonomy Definitions · Research Team.
It is a masthead-style credit list rather than a document, so it carries no table of
contents; it uses the narrow page width the Contact tab uses.

Credits as supplied: Organisation — Initiative to Promote Tolerance and Prevent Violence
(INITIATE.MY); Researchers — Aizat Shamsuddin, Irdina Sofrina; Data science — Khairie
Iswandy; Project management — Zulaikha Zainal Efendi.

**Two things to check.** The brief spelled the organisation "INTIATE.MY"; I used
**INITIATE.MY**, which is what the other 17 occurrences across the site use — correct me
if the brief was right. And the expert-reviewer placeholder is two dashed "To be
announced" slots plus a line saying reviewers are still being confirmed. **I did not
invent reviewer names** — placeholder names for real people in a credited research role
would be indistinguishable from a real credit once published. The slots make the gap
visible instead, and the note ties the role to the description already in Research
Limitations. Replacing them is a one-line edit each.

## 4d. Codebook prev / next navigation

The four prose cross-reference footers at the end of the codebook documents were replaced
with a prev/next pager running **Methods → Limitations → Taxonomy → Team**. Research
Methods shows only "Next"; Research Team shows only "Previous"; both pin their own grid
column so a lone link still sits on its correct side. Verified by walking the chain
programmatically — every page's prev and next resolve to the right neighbour, and the two
endpoints correctly have none. The now-unused `.doc-foot` rule was removed from
`styles.css`.

Note this drops the inline links to the Data and Contact tabs that those footers carried;
both remain one click away in the topbar.

## 4e. Contact tab rewritten

Refocused on the repository, contributing, and the Data tab's tools, with the email kept
as the last block rather than the first.

- **Repository card** (top): `github.com/dekolab/db4-website`, taken from the git remote.
- **Three ways to contribute**: correct/add a record via the suggest-an-edit form (which
  pre-fills the `directory_change_request.yml` issue form — described accurately from
  `js/suggest.js`, including that nothing is sent from the page itself), report a bug or
  request a feature via a deep link to `feature_request.yml`, and work with the data
  directly by cloning. The source-citation requirement comes from the issue template's own
  wording.
- **Tools in the Data tab**: search across title/publisher/printer/author, cluster and
  origin filters, revoked-only, column sorting, and row selection — each verified against
  the actual controls in `index.html` and `js/table.js`.
- Dropped the old two-column "About the data" / "Known limitations" blocks, which
  duplicated the codebook documents and carried the stale 3,213 / 1,590 / nine figures.
  The figures that remain (3,212 and 1,586) are correct against `final-data.csv`.
- `.contact-grid` is now unused and was removed from `styles.css`, including its
  responsive rule. The GitHub icon uses `fa-solid fa-code-branch`, not a brand icon — no
  `fa-brands` glyph appears anywhere else on the site, so I did not assume the kit ships
  that family.

**Pre-existing defect, now fixed:** the email link displayed `programme@initiate.my` but
its `mailto:` targeted `m.khairie11@gmail.com`, so clicking it mailed a different address
than the one shown. Confirmed and corrected — the link now targets
`programme@initiate.my`, matching its visible text, with the existing subject line kept.
That address no longer appears anywhere in the repository.

## 4f. CSV download in the Data tab

A **Download** button sits at the right of the table controls. It exports **exactly what
the table is showing** — current search, filters and sort order, same columns, same header
names. The label answers the question the button raises: "Download all 3,212 (CSV)" with
no filters, "Download these 95 (CSV)" once you filter, and it disables when nothing
matches. Filenames record the scope and date:
`pppa-gazetted-publications-all-2026-08-13.csv` or `…-filtered-….csv`.

Decisions that matter for whoever opens the file:

- **RFC 4180 quoting.** 974 fields in the dataset contain a comma and 75 contain a double
  quote — without correct quoting the export would be silently corrupt.
- **UTF-8 BOM**, so Excel reads the Chinese and Malay titles correctly rather than as
  mojibake.
- **Raw values, not screen values.** Blank fields export as empty rather than the table's
  em dash, and a revoked row carries `2026-07` rather than the badge text "Revoked Jul
  2026" — the file is data, not a picture of the page.
- **No formula-injection mangling.** Seven fields begin with `-` (e.g. `-Sama-`); none
  begin with `=`, `+` or `@`. Prefixing values to defuse spreadsheet formulas would corrupt
  real titles, so the export quotes correctly and leaves values intact.

Verified by running the real `table.js` against the real dataset in a DOM shim and parsing
the output back with a CSV parser — 18 checks, all passing: BOM, CRLF, header + 3,212
rows, 12 fields per row, exact round-trip of a title containing double quotes, one
containing a comma and one in Chinese, no em dashes, correct revoked value, correct
filtered row count and filename, correct label text in both states, and the disabled state
exporting nothing.

Also surfaced in two places: the Data tab lede, and the tools list on the Contact tab.
While editing that lede I corrected its stale "3,213" to **3,212**.

## 4g. Design review — chart and section revisions

All five review items addressed. Two needed a decision first (see below).

**1. Blue arrow.** The origin map carried three thin arrows, a separate "Foreign"
chip and a floating "arrives from outside" label — four elements for one idea. Replaced
with a single broad block arrow entering past the frame edge, carrying both lines of the
label on the arrow itself. Its text fill is `th.surface` (white on light, near-black on
dark), so the label keeps contrast against the blue in both themes.

**2. KDN justifications: line chart → 100% stacked bar by decade.** As lines, five of the
seven grounds sat flat on zero and the morality/public-order split was unreadable.
`stacked()` gained three optional flags — `normalize`, `colorOf` (non-cluster series) and
`barMax` — with defaults that reproduce the previous behaviour exactly; the absolute
cluster chart that shares the function was re-rendered and is unchanged.

**3. Enforcement-focus grid.** New `severity` ramp (green = a small share of the decade,
red = dominant), the 2020s column asterisked in its header with a footnote inside the
chart, and the caption split into three discrete notes. The ramp's lightness falls
steadily from green to red so the grid still reads as a value ramp in greyscale — worth
keeping in mind, since red-green is the one pairing ~8% of men cannot separate by hue.
Cell ink is now chosen from each cell's own luminance rather than a fixed threshold, which
a mid-ramp amber would have failed.

**4. Bans over time: line → bars.** New `timeBars()` draws one bar per year across the
77-year span, with a single snapping overlay for hover (bars are ~1px apart, so per-bar
hit targets would not work). The From/To sliders now show the year each one sits on;
the markup carries the full range as a static fallback for when the 3D module never loads.

**5. Print/ink section — kept, reframed.** The old copy stated the 98% and then apologised
for it. It now leads with what the number *limits*: the PPPA is a print statute, so film,
broadcast and online material never entered this record, and every other chart in the
story is therefore a chart about print. A quiet decade here may be a decade when the
censoring moved somewhere the Act could not follow.

**Two calls that were yours, not mine.** The review named "Banned by theme and reason" but
the story has two per-decade line charts; converting the cluster one instead would have
duplicated the item 3 grid, which is already cluster share normalised to 100%. And item 5
was explicitly flagged for discussion. Both were confirmed before implementing.

**Note on item 4.** The review mentions exponential growth. Bars now carry the *per-year*
view, which shows waves rather than growth — the Cumulative view is the one that shows
growth, and it remains an area chart. Say the word if the intent was to change that one.

New CSS: `figcaption.fig-notes` (multi-part captions, one note per line) and
`.rain-slider-val`. The notes grid needs `width: 100%` because the pinned stage centres
its flex children, and needs exactly two children per note — a stray `<strong>` became a
third grid item and broke the layout until it was wrapped.

## 5. Known-stale text in do-not-touch zones

These still carry old-snapshot figures and were left alone per the constraints — worth a
follow-up pass once you approve wording:

- ~~Data tab lede~~ — fixed to 3,212, see §4f
- **Research Limitations doc** (the only remaining stale figures on the site): "263 records
  have an unknown language" (now 262), "1,067
  records have an unclear origin" (still true), "1,590 of the 3,213 publications … nine
  publications pre-date 1984" (now 1,586 of 3,212, five pre-1984)
- ~~Contact tab~~ — fixed in the rewrite, see §4e

## 6. Verification performed

- Regenerated `data.js` diffed against the old: identical schema (keys, order, shapes,
  12-column rows); every difference is a data value.
- `PPPA.rows.length == PPPA.meta.total == 3,212`; exactly 5 rows flagged `2026-07`;
  `notes` 295/3,212.
- Story view grepped for every old figure in the reconciliation table (3,213, 787, 974,
  850, 3,148, 1,477, 1,590, 895, 654, 445, 263, 660, 565, 22.2%, 34.1%, 26.5%, 1,947,
  83.9%, "nine pre-date") — zero matches remain.
- Every numeric claim in every chart `aria-label` cross-checked programmatically against
  the regenerated aggregates (including the ones that did **not** change: decade-mix
  shares, KDN per-decade peaks, podium counts, crosswalk cells).
- All recomputed percentages verified against their exact quotients.
- `node --check` passes on `js/charts.js` and `js/data.js`; HTML tag balance verified.
- The `pictograph`/`mapOrigin` value computation was executed in Node against the new
  aggregates and reproduces the old percentage formatting exactly.
- **Not verified here:** a visual render (no working headless browser in this sandbox).
  Rendering logic, chart types, colours and scales are untouched and the data shapes are
  identical, so only bar heights / line points / labels can move — but please eyeball the
  story once, including reduced-motion and both themes, before publishing.

---

# External review — narrative reorder, chart swaps, sourcing gaps

**Date:** 21 August 2026
**Branch:** `review/external-feedback`
**Files changed:** `index.html`, `styles.css`, `js/charts.js`, `js/story.js`,
`Analysis-Reference/Codebook DB4 Draft 6.2.26.md`; `js/geo.js` and `js/snap.js` deleted
**Not touched:** `js/data.js` and `Analysis-Reference/generate_data.py` — no figure in the
dataset changed, and the one new chart derives its series in the browser from `PPPA.rows`

## 7. What the reorder did

The story opened with a general description of the project and five beats of statute before
any data. New order:

| Part | Beats |
| --- | --- |
| — | Hero — new headline, source line, methodology link |
| 1 · What the record shows | **#findings** (the old closing coda, lifted) |
| 2 · Time | Bans over time |
| 3 · Language, type & origin | Languages, **languages per decade (new)**, types, origin |
| 4 · The people | Authors, printers, publishers + **profile cards** |
| 5 · What was banned | Clusters over time, **two themes (merged)**, KDN grounds, decade mix, six records, crosswalk |
| 6 · The law | The law, its origins, its powers, the balance — *was Part 1* |
| 7 · Now, and next | Why this database, revocations, reform |
| — | Coda — shortened, closes on the revocations |

The coda's two paragraphs moved verbatim into `#findings`, so nothing new is asserted there;
the closing was rewritten around the sentences it kept. Dot rail re-sequenced; every kicker
renumbered; every in-page anchor re-checked (none dangling).

## 8. Charts

**Origin map → column chart.** The dataset records origin as local / foreign / unclear and
nothing finer. The map had no country to place the 1,476 foreign records in and nowhere at
all for the 1,067 unclear ones, which sat in a box beside the coastline. Now three columns
via the existing `columns()`, unclear muted because it marks missing information.
`columns()` gained two optional flags — `subLabel` (a second line under the category, here
the share) and `barMax` (mirroring `stacked()`) — both defaulting to the previous behaviour.
`mapOrigin()` and `js/geo.js` were removed with it; nothing else consumed the projected
coastlines, and both are one `git checkout` away if a country field ever lands.

**KDN grounds.** Already a 100% stacked column — PR #9 converted it from lines — but the
heading, `aria-label` and caption were never updated and still described a line chart with
absolute peaks (383, 282, 123) the normalised chart does not plot. A screen-reader user was
being handed a different chart from the one on screen. All three now describe the actual
composition, recomputed from `PPPA.kdnByDecade`.

**Languages per decade (new).** Built on `stacked()`, the same primitive as "Bans per decade,
stacked by cluster", as a second viz layer and scene in the languages chapter. Series derived
in `charts.js` from `PPPA.rows` and folded into the same five groups the languages column
chart uses; the derived totals reproduce `PPPA.languageGrouped` exactly (1,158 / 947 / 765 /
262 / 150), so the two charts cannot drift apart. Counted by language *mention*, so a decade's
column can out-total that decade's bans — stated in the caption.

**Six records vs twelve covers.** The heading was right: six specimen cards, and a separate
decorative shelf of twelve traced covers. The shelf's explanatory note simply sat *below* its
images. Note moved above the row and reworded to say what it is; a lede now labels the grid.

## 9. Where this deviates from the review

- **"Replace the heatmap under 'What reasons did the Ministry itself give?'"** — that section
  has never drawn a heatmap, on any branch. On `main` it was a line chart; here it is the
  100% stacked column the review asked for. The nearest heatmap, "Cluster share within each
  decade", answers a different question and is already share-normalised, so converting it
  would duplicate the stacked chart two beats earlier. Relabelled the KDN chart instead.
- **"Languages by year"** — bucketed by decade. The chart it is modelled on is per-decade, and
  77 year-columns of a five-series stack is not legible at the width of a pinned stage. One
  line change in `charts.js` if you want years on the axis.
- **Merging the two theme sections** — merged rather than differentiated. Both stated the same
  three figures (1,097 / 849 / 60.6%) a screen apart. The subcluster chapter took the "Two
  themes" heading and both sets of copy; the pinned scene it borrowed the heading from keeps
  its trajectory chart and now describes the trajectories it was already drawing.

## 10. TODOs left, and why

| Where | Marker | Why it is not filled in |
| --- | --- | --- |
| `#people` | 3 × `data-todo="profile"` cards | Biographical claims about named people on a public-interest site. Counts and the Ashaari-Muhammad duplicate-entry note are generated; only the `<p class="who-bio">` text is missing. Remove `data-todo` from the card when it lands. |
| Research Methods | `TODO(sourcing)` + `.source-todo` block | `epq.kdn.gov.my/e-pq/index.php?mod=public` no longer resolves. No replacement path guessed. Needs a working URL or an archived capture. |
| `Codebook DB4 Draft 6.2.26.md` line 8 | `TODO(sourcing)` | Same URL, annotated in place. |
| Contact | `.licence-todo` block | Two separate decisions: a named licence for INITIATE.MY's own work (CC BY 4.0 offered as a candidate, not a choice), and the copyright status of the underlying KDN records. No legal conclusion asserted. Interim line asks people to check before republishing. |
| `#revocations` | `TODO(sourcing)` comment | Whether KDN publishes revocation orders anywhere trackable. The dataset question *was* answerable from the repo and is now stated in the copy: the source has no revocation field, the five July 2026 orders were added by hand, so earlier revocations would be invisible. |

The two visible TODO blocks render as dashed accent boxes, and the profile placeholders as
dashed italic panels. They are meant to be uncomfortable to leave in place. None should reach
production.

## 11. Verification performed

- `node --check` passes on all ten JS files; `index.html` tag balance verified by parser
  (zero unclosed, zero mismatched); `styles.css` braces balanced.
- Every in-page anchor resolves to an existing `id`; every `#/route` is known to `app.js`;
  the 17 chart mount ids in the HTML match the 17 `getElementById` calls in `charts.js`
  exactly.
- **Every numeric claim added or moved was recomputed from `js/data.js` and checked against
  the copy** — 33 assertions, all passing: the origin split and its percentages, all ten
  language-per-decade cells quoted in the new scene, the 262 unknowns, both crosswalk worked
  examples (title, year, ground and subcluster), the KDN coverage figures, the author counts,
  the cover/specimen counts, and 3,212 − 158 = 3,054.
- One claim was **caught and corrected** this way: the first draft of the headline said "the
  reason changed three times", which only holds if you count the 2020s swing back to political
  material — an unfinished decade of 70 records. Three named eras are two transitions. The
  headline now carries no count; the `#findings` pull-quote keeps "3 different categories",
  which is exactly right however the runs are counted.
- Rendered in headless Chrome and inspected: `#findings`, languages, languages-per-decade,
  origin, clusters, subclusters + glossary, KDN, six records, crosswalk, the law, revocations,
  reform, closing, Contact and Research Methods — in **both themes**. One layout bug found and
  fixed this way (the glossary was trapped inside the 46rem `.full-foot` and orphaned
  Ahmadiyyah onto its own row).
- **Not verified here:** real mobile Safari/Chrome. See §12 on the removed auto-snap.

## 12. The auto-snap, removed

The review offered two options — remove the auto-sticky behaviour, or offset it so it never
covers a section's subtitle. This branch first did the second, then removed it outright at
your call. `js/snap.js` is deleted, along with its `<script>` tag; two comments in
`js/story.js` and `styles.css` that referenced it were updated.

Recording the diagnosis, since the file is gone: `snap.js` centred each beat in the **whole
viewport**, but on mobile (≤900px) the pinned stage is sticky over the top 56% with an opaque
background and `z-index: 10`. Centring a scene taller than the remaining strip slid its kicker
and heading up *underneath* the stage, so the section arrived with its title already hidden.
Commit `a8938ee` carries the offset fix if the behaviour is ever wanted back — it computed
anchors against the visible strip and top-aligned any beat too tall to fit.

Nothing else drove the page's scroll position. The only remaining programmatic scroll is the
dot rail in `js/story.js`, which centres `.scene` targets — and the dot rail is desktop-only
(`.dots { display: none }` under 900px), where the stage sits beside the text rather than over
it. So there is no path back to the same defect.

**What changes for a reader:** scrolling now comes to rest wherever it is left. Beats no
longer glide into composition on their own, and a reader stopping between two beats stays
between them. Worth an end-to-end scroll in both themes to confirm the section rhythm still
reads without it — that judgement is yours, and reverting is one `git revert` away.

**Still not verified here:** real mobile Safari/Chrome. Please eyeball the reordered story
once on a phone before publishing.
