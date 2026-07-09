# Regenerates js/data.js from sample_data.csv. Run from inside Analysis-Reference/:
#   python3 generate_data.py
import ast, json, math
import pandas as pd

df = pd.read_csv("sample_data.csv")
df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
df["Year"] = pd.to_numeric(df["Year"], errors="coerce").astype("Int64")

def parse_lang(raw):
    if pd.isna(raw) or raw == "n/a":
        return []
    try:
        v = ast.literal_eval(raw)
        return v if isinstance(v, list) else [str(v)]
    except (ValueError, SyntaxError):
        return [raw]

df["Languages"] = df["Language"].apply(parse_lang)

def split_sub(raw):
    if pd.isna(raw):
        return []
    return [s.strip() for s in str(raw).split(",") if s.strip()]

df["Subclusters"] = df["Subcluster"].apply(split_sub)

CLUSTER_ORDER = [
    "Subversive ideological and political content",
    "Obscene / immoral publications",
    "General/Unindentified",
    "Religious doctrinal deviance",
    "Race, religion & royalty (3R issues)",
    "Administrative/Unclear Ground",
]

data = {}
data["meta"] = {
    "total": int(len(df)),
    "yearMin": int(df["Year"].min()), "yearMax": int(df["Year"].max()),
    "clusters": int(df["Cluster"].nunique()),
    "publishers": int(df["Publisher"].nunique()),
    "gazettes": int(df["Gazette Number"].nunique()),
}

tc = df["Publication Type"].value_counts()
data["typeCounts"] = [[k, int(v)] for k, v in tc.items()]
oc = df["Publication Origin"].value_counts()
data["originCounts"] = [[k, int(v)] for k, v in oc.items()]

yearly = df.groupby("Year").size()
y0, y1 = int(df["Year"].min()), int(df["Year"].max())
data["perYear"] = [[y, int(yearly.get(y, 0))] for y in range(y0, y1 + 1)]

df["Decade"] = (df["Year"] // 10 * 10).astype("Int64")
dc = df.groupby(["Decade", "Cluster"]).size().unstack(fill_value=0)
decades = [f"{int(d)}s" for d in dc.index]
data["decadeClusters"] = {
    "decades": decades,
    "clusters": CLUSTER_ORDER,
    "values": [[int(dc.loc[d, c]) if c in dc.columns else 0 for c in CLUSTER_ORDER] for d in dc.index],
}
dcn = dc.div(dc.sum(axis=1), axis=0) * 100
data["decadeMix"] = {
    "decades": decades,
    "clusters": CLUSTER_ORDER,
    "totals": [int(t) for t in dc.sum(axis=1)],
    "values": [[round(float(dcn.loc[d, c]), 1) if c in dcn.columns else 0.0 for c in CLUSTER_ORDER] for d in dcn.index],
}

cc = df["Cluster"].value_counts()
data["clusterCounts"] = [[k, int(v)] for k, v in cc.items()]

sub = df.explode("Subclusters")
sub = sub[sub["Subclusters"].notna() & (sub["Subclusters"] != "")]
data["subclusterTop"] = [[k, int(v)] for k, v in sub["Subclusters"].value_counts().head(15).items()]

lang = df.explode("Languages")
lang = lang[lang["Languages"].notna() & (lang["Languages"] != "")]
lc = lang["Languages"].value_counts()
data["languageTop"] = [[k, int(v)] for k, v in lc.items() if not str(k).startswith('["')][:9]

top5 = [k for k, _ in data["languageTop"][:5]]
ol = lang.groupby(["Publication Origin", "Languages"]).size().unstack(fill_value=0)
origins = ["Foreign", "Local", "Unclear"]
data["originLang"] = {
    "rows": origins, "cols": top5,
    "values": [[int(ol.loc[o, l]) if l in ol.columns else 0 for l in top5] for o in origins],
}

pub = df.loc[df["Publisher"].notna() & (df["Publisher"] != "n/a"), "Publisher"].value_counts().head(15)
data["publisherTop"] = [[k, int(v)] for k, v in pub.items()]

author_known = df["Author/Translator"].where(df["Author/Translator"].notna() & (df["Author/Translator"] != "n/a"))
data["meta"]["authorKnownPct"] = round(float(author_known.notna().mean()) * 100, 1)

ocx = df.groupby(["Publication Origin", "Cluster"]).size().unstack(fill_value=0)
data["originCluster"] = {
    "rows": CLUSTER_ORDER, "cols": origins,
    "values": [[int(ocx.loc[o, c]) if c in ocx.columns else 0 for o in origins] for c in CLUSTER_ORDER],
}

def cat(note):
    if pd.isna(note) or not str(note).strip():
        return "No note"
    n = str(note).lower()
    has_llm = "llm" in n; has_kw = "keyword" in n
    wrong = "wrong" in n or "don't" in n or "dont" in n or "no match" in n
    correct = "correct" in n
    if has_llm and has_kw and wrong and correct: return "LLM wrong / Keywords correct"
    if has_llm and has_kw and wrong: return "Both LLM & Keywords wrong"
    if "further confirmation" in n or "needs more information" in n: return "Needs more info / confirmation"
    if "cannot find" in n or "cannot determine" in n: return "Insufficient info"
    return "Other note"

ncat = df["Notes"].apply(cat).value_counts()
flagged = {k: int(v) for k, v in ncat.items() if k != "No note"}
data["notes"] = {
    "flagged": int(sum(flagged.values())),
    "total": int(len(df)),
    "pct": round(sum(flagged.values()) / len(df) * 100, 1),
    "breakdown": sorted(flagged.items(), key=lambda kv: -kv[1]),
}

def s(v):
    if pd.isna(v):
        return ""
    return str(v).strip()

rows = []
for _, r in df.iterrows():
    rows.append([
        s(r["Publication Title"]),
        int(r["Year"]) if pd.notna(r["Year"]) else None,
        s(r["Publication Type"]),
        s(r["Publication Origin"]),
        ", ".join(r["Languages"]),
        s(r["Cluster"]),
        s(r["Subcluster"]),
        s(r["Publisher"]),
        s(r["Author/Translator"]),
    ])
data["rows"] = rows

with open("../js/data.js", "w") as f:
    f.write("/* Generated from Analysis-Reference/sample_data.csv — do not edit by hand. */\n")
    f.write("var PPPA = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print("rows:", len(rows))
print("meta:", data["meta"])
print("notes:", data["notes"])
print("languageTop:", data["languageTop"])
