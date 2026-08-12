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

`_source_log.csv` still logs all 3,026 placeholder rows with their old `file` paths. That
is deliberate — it remains an accurate record of the sourcing run, and the `source`
column is the authoritative signal. **Any future cover lookup must test
`source != 'placeholder'` before trusting the `file` column**, since those paths no
longer resolve. Note also that the placeholders will return if the cover-sourcing script
is rerun; a `*PLACEHOLDER*` line in `.gitignore` would guard against that, but I have not
added one.

## 5. Known-stale text in do-not-touch zones

These still carry old-snapshot figures and were left alone per the constraints — worth a
follow-up pass once you approve wording:

- **Data tab lede:** "All 3,213 records behind the story"
- **Contact tab:** "3,213 publications", "1,067 of 3,213", "1,590 of 3,213 records, just
  nine of them pre-dating 1984"
- **Research Limitations doc:** "263 records have an unknown language", "1,067 records
  have an unclear origin" (still true), "1,590 of the 3,213 publications … nine
  publications pre-date 1984"

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
