# Regenerates js/data.js from the finalised dataset. Run from inside
# Analysis-Reference/:
#   python3 generate_data.py
#
# Standard library only (no pandas). Ties in "top N" lists break by order of
# first appearance in the CSV, which reproduces the notebook's value_counts
# ordering used for the reference visualizations.
import ast
import csv
import json
import re
from collections import Counter, OrderedDict

with open("../Finalise-Codebook/final-data.csv", newline="", encoding="utf-8") as f:
    raw_rows = list(csv.DictReader(f))

# Colour-slot order: same positions as the previous six-cluster list so each
# cluster keeps its colour across the redesign (Administrative/Unclear Ground
# is a subcluster in the new taxonomy, not a cluster).
CLUSTER_ORDER = [
    "Subversive Ideological And Political Content",
    "Obscene / Immoral Publications",
    "General/Unidentified",
    "Religious Doctrinal Deviance",
    "Race, Religion & Royalty (3R Issues)",
]

# KDN justification grounds: gazette (Malay) term -> English display label,
# ordered by frequency. Counts are validated against script.md below.
KDN_ORDER = [
    ("Kemoralan", "Morality"),
    ("Ketenteraman Awam", "Public order"),
    ("Menggemparkan Fikiran Orang Ramai", "Public alarm"),
    ("Kepentingan Awam", "Public interest"),
    ("Keselamatan", "Security"),
    ("Kepentingan Negara", "National interest"),
    ("Berlawanan Dengan Undang- Undang", "Contrary to law"),
]

# The five revocation orders gazetted in July 2026 (script.md). The CSV has no
# revocation column, so the flag is injected here by exact title match.
# TODO(data): exact revocation gazette dates are not in script.md; "2026-07"
# carries the month stated there.
REVOKED = {
    "Islam Without Extremes : A Muslim Case For Liberty": "2026-07",
    "Komrad Asi (Rejimen 10) Dalam Denyut Nihilisme Sejarah": "2026-07",
    "Sigandi": "2026-07",
    "Memoir Shamsiah Fakeh Dari Awas Ke Rejimen Ke-10": "2026-07",
    "Mao Zedong: China Dalam Dunia Abad Ke-20": "2026-07",
}


def s(v):
    return "" if v is None else str(v).strip()


def parse_langs(raw):
    raw = s(raw)
    if not raw or raw == "n/a":
        return []
    try:
        v = ast.literal_eval(raw)
        return [str(x) for x in v] if isinstance(v, list) else [str(v)]
    except (ValueError, SyntaxError):
        pass
    # A cell holding several list literals back to back ('["a"] ["b"]') is not
    # valid Python. Falling through to [raw] made it a phantom language that
    # inflated Other by one and lost the real mentions, so parse each literal.
    parts = re.findall(r"\[[^\[\]]*\]", raw)
    if parts:
        out = []
        for p in parts:
            try:
                v = ast.literal_eval(p)
            except (ValueError, SyntaxError):
                continue
            out.extend(str(x) for x in (v if isinstance(v, list) else [v]))
        if out:
            return out
    return [raw]


def split_sub(raw):
    return [p.strip() for p in s(raw).split(",") if p.strip()]


def top(counter_pairs, n=None):
    """(value, first-appearance-index) pairs -> [[name, count], ...] sorted by
    count desc, ties by first appearance (matches pandas value_counts)."""
    counts = Counter()
    first = {}
    for i, v in enumerate(counter_pairs):
        if v not in first:
            first[v] = i
        counts[v] += 1
    ordered = sorted(counts.items(), key=lambda kv: (-kv[1], first[kv[0]]))
    if n is not None:
        ordered = ordered[:n]
    return [[k, v] for k, v in ordered]


recs = []
for r in raw_rows:
    origin = s(r["Publication Origin"]) or "Unclear"  # 5 blank cells; the
    # published origin figures (1,477 / 669 / 1,067) fold blanks into Unclear.
    recs.append({
        "title": s(r["Publication Title"]),
        "year": int(r["Year"]),
        "type": s(r["Publication Type"]),
        "origin": origin,
        "langs": parse_langs(r["Language"]),
        "cluster": s(r["Cluster"]),
        "subs": split_sub(r["Subcluster"]),
        "publisher": s(r["Publisher"]),
        "author": s(r["Author/Translator"]),
        "printer": s(r["Printer"]),
        "kdn": s(r["Justification"]),
        "gazette": s(r["Gazette Number"]),
        "notes": s(r["Notes"]),
    })

years = [r["year"] for r in recs]
data = OrderedDict()
data["meta"] = {
    "total": len(recs),
    "yearMin": min(years),
    "yearMax": max(years),
    "clusters": len(set(r["cluster"] for r in recs)),
    "publishers": len(set(r["publisher"] for r in recs if r["publisher"])),
    "gazettes": len(set(r["gazette"] for r in recs if r["gazette"])),
    "kdnCoverage": sum(1 for r in recs if r["kdn"]),
    "kdnPre1984": sum(1 for r in recs if r["kdn"] and r["year"] < 1984),
    "revoked": len(REVOKED),
}

data["typeCounts"] = top([r["type"] for r in recs])
data["originCounts"] = top([r["origin"] for r in recs])

y0, y1 = min(years), max(years)
per_year = Counter(years)
data["perYear"] = [[y, per_year.get(y, 0)] for y in range(y0, y1 + 1)]

decades = sorted(set(y // 10 * 10 for y in years))
dec_names = ["%ds" % d for d in decades]
dc = {(d, c): 0 for d in decades for c in CLUSTER_ORDER}
for r in recs:
    dc[(r["year"] // 10 * 10, r["cluster"])] += 1
data["decadeClusters"] = {
    "decades": dec_names,
    "clusters": CLUSTER_ORDER,
    "values": [[dc[(d, c)] for c in CLUSTER_ORDER] for d in decades],
}
dec_totals = [sum(dc[(d, c)] for c in CLUSTER_ORDER) for d in decades]
data["decadeMix"] = {
    "decades": dec_names,
    "clusters": CLUSTER_ORDER,
    "totals": dec_totals,
    "values": [
        [round(dc[(d, c)] / t * 100, 1) if t else 0.0 for c in CLUSTER_ORDER]
        for d, t in zip(decades, dec_totals)
    ],
}

data["clusterCounts"] = top([r["cluster"] for r in recs])

sub_mentions = [sv for r in recs for sv in r["subs"]]
data["subclusterAll"] = top(sub_mentions)
data["subclusterTop"] = data["subclusterAll"][:15]

# Language mentions (a record can carry several). "Unknown" = blank / n/a
# cells; languageTop keeps named languages for the origin x language matrix.
lang_mentions = [lv for r in recs for lv in r["langs"]]
unknown_langs = sum(1 for r in recs if not r["langs"])
lang_counts = top(lang_mentions)
data["languageTop"] = [kv for kv in lang_counts if not kv[0].startswith('["')][:9]

# Chart-only grouping (script.md): top three named languages, Unknown, and
# everything else folded into Other. The full breakdown stays in rows.
top3 = data["languageTop"][:3]
top3_names = set(k for k, _ in top3)
other = sum(v for k, v in lang_counts if k not in top3_names)
data["languageGrouped"] = top3 + [["Unknown", unknown_langs], ["Other", other]]

top5 = [k for k, _ in data["languageTop"][:5]]
origins = ["Foreign", "Local", "Unclear"]
ol = {(o, l): 0 for o in origins for l in top5}
for r in recs:
    for lv in r["langs"]:
        if lv in top5 and r["origin"] in origins:
            ol[(r["origin"], lv)] += 1
data["originLang"] = {
    "rows": origins,
    "cols": top5,
    "values": [[ol[(o, l)] for l in top5] for o in origins],
}

data["publisherTop"] = top(
    [r["publisher"] for r in recs if r["publisher"] and r["publisher"].lower() != "n/a"], 15)

# Names tie at the bottom of both top-10 lists; the reference visualizations
# (12_top_10_authors.png, 09_top_10_printers.png) are authoritative for which
# names display and in what order, so pin their ordering and verify counts.
AUTHOR_TOP_ORDER = [
    "Wei Wei", "Ustaz Ashaari Muhammad", "Marcus Van Heller", "Lenin",
    "Anonymous", "Kazuo Koike", "Kenneth E. Hagin", "Kassim Ahmad",
    "Hsia Fei", "Ustaz Haji Ashaari Muhammad",
]
PRINTER_TOP_ORDER = [
    "Yayasan Perkhabaran Injil", "Yakin, Genting Besar 85 Surabaya, Indonesia",
    "United States Of America", "Vinlin Press Sdn. Bhd.",
    "New Tide Printing Factory", "Malaya Publishing & Printing Co.",
    "Vinlin Press Sdn Bhd", "Emperor Printing Co.Ltd.",
    "Ming Yi Printing Co. Ltd.", "Percetakan Mansor & Ali",
]
author_counts = Counter(
    r["author"] for r in recs
    if r["author"] and r["author"].lower() not in ("n/a", "unknown"))
printer_counts = Counter(
    r["printer"] for r in recs
    if r["printer"] and r["printer"].lower() not in ("n/a", "unknown"))
data["authorTop"] = [[name, author_counts[name]] for name in AUTHOR_TOP_ORDER]
data["printerTop"] = [[name, printer_counts[name]] for name in PRINTER_TOP_ORDER]
assert [c for _, c in data["authorTop"]] == [21, 18, 16, 10, 9, 9, 9, 8, 8, 7]
assert [c for _, c in data["printerTop"]] == [35, 17, 15, 11, 10, 9, 9, 9, 7, 7]
assert sum(c for _, c in data["authorTop"]) == 115  # script.md: top ten = 115

ocx = {(c, o): 0 for c in CLUSTER_ORDER for o in origins}
for r in recs:
    ocx[(r["cluster"], r["origin"])] += 1
data["originCluster"] = {
    "rows": CLUSTER_ORDER,
    "cols": origins,
    "values": [[ocx[(c, o)] for o in origins] for c in CLUSTER_ORDER],
}

# --- KDN justifications ---
kdn_ms = [ms for ms, _ in KDN_ORDER]
kdn_counts = Counter(r["kdn"] for r in recs if r["kdn"])
assert set(kdn_counts) == set(kdn_ms), sorted(kdn_counts)
data["kdnCounts"] = [[en, kdn_counts[ms], ms] for ms, en in KDN_ORDER]

kd = {(d, ms): 0 for d in decades for ms in kdn_ms}
for r in recs:
    if r["kdn"]:
        kd[(r["year"] // 10 * 10, r["kdn"])] += 1
data["kdnByDecade"] = {
    "decades": dec_names,
    "justifications": [en for _, en in KDN_ORDER],
    "values": [[kd[(d, ms)] for ms in kdn_ms] for d in decades],
}

kc = {(ms, c): 0 for ms in kdn_ms for c in CLUSTER_ORDER}
for r in recs:
    if r["kdn"]:
        kc[(r["kdn"], r["cluster"])] += 1
data["kdnVsCluster"] = {
    "rows": [en for _, en in KDN_ORDER],
    "cols": CLUSTER_ORDER,
    "values": [[kc[(ms, c)] for c in CLUSTER_ORDER] for ms, _ in KDN_ORDER],
}

data["revoked"] = [
    {"title": r["title"], "year": r["year"], "cluster": r["cluster"],
     "subcluster": ", ".join(r["subs"]), "revokedDate": REVOKED[r["title"]]}
    for r in recs if r["title"] in REVOKED
]
assert len(data["revoked"]) == len(REVOKED), [r["title"] for r in data["revoked"]]


def note_cat(note):
    if not note:
        return "No note"
    n = note.lower()
    has_llm = "llm" in n
    has_kw = "keyword" in n
    wrong = "wrong" in n or "don't" in n or "dont" in n or "no match" in n
    correct = "correct" in n
    if has_llm and has_kw and wrong and correct:
        return "LLM wrong / Keywords correct"
    if has_llm and has_kw and wrong:
        return "Both LLM & Keywords wrong"
    if "further confirmation" in n or "needs more information" in n:
        return "Needs more info / confirmation"
    if "cannot find" in n or "cannot determine" in n:
        return "Insufficient info"
    return "Other note"


ncat = Counter(note_cat(r["notes"]) for r in recs)
flagged = {k: v for k, v in ncat.items() if k != "No note"}
data["notes"] = {
    "flagged": sum(flagged.values()),
    "total": len(recs),
    "pct": round(sum(flagged.values()) / len(recs) * 100, 1),
    "breakdown": sorted(flagged.items(), key=lambda kv: -kv[1]),
}

# Row tuple: existing nine positions, then appended kdnJustification (gazette
# term), printer, revokedDate — table.js indexes depend on this order.
data["rows"] = [
    [r["title"], r["year"], r["type"], r["origin"], ", ".join(r["langs"]),
     r["cluster"], ", ".join(r["subs"]), r["publisher"], r["author"],
     r["kdn"], r["printer"], REVOKED.get(r["title"], "")]
    for r in recs
]

with open("../js/data.js", "w", encoding="utf-8") as f:
    f.write("/* Generated from Finalise-Codebook/final-data.csv — do not edit by hand. */\n")
    f.write("var PPPA = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

# --- sanity report against script.md ---
print("rows:", len(data["rows"]))
print("meta:", data["meta"])
print("decades:", list(zip(dec_names, dec_totals)))
print("clusterCounts:", data["clusterCounts"])
print("subclusterAll:", data["subclusterAll"])
print("languageGrouped:", data["languageGrouped"])
print("kdnCounts:", data["kdnCounts"])
print("authorTop:", data["authorTop"])
print("printerTop:", data["printerTop"])
print("revoked:", [(r["title"], r["revokedDate"]) for r in data["revoked"]])
print("1951 per-year:", per_year.get(1951))
