"""Train unigram/bigram/trigram models on a Gujarati corpus and export web/model.js.
Usage: python build_model.py
"""
import json
import pickle
import re
import unicodedata
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "data" / "gujarati_corpus.txt"
OUT = ROOT / "web" / "model.js"
TOP = 5       # suggestions kept per context
MIN_WORD = 2  # drop words seen only once (keeps model.js small)
END = "</s>"
END_P = 0.5       # a context 'ends the sentence' if P(end | context) >= 50%
MIN_SUPPORT = 3   # ...and it was seen at least this many times


def tokenize(line):
    # keep only Gujarati characters (U+0A80-U+0AFF) and whitespace
    line = unicodedata.normalize("NFC", line)
    return re.sub(r"[^\u0A80-\u0AFF\s]", " ", line).split()


uni, bi, tri = Counter(), defaultdict(Counter), defaultdict(Counter)

with open(SRC, encoding="utf-8") as f:
    for line in f:
        words = tokenize(line)
        if not words:
            continue
        uni.update(words)
        t = ["<s>"] + words + [END]  # <s> = sentence start, </s> = sentence end
        for a, b in zip(t, t[1:]):
            bi[a][b] += 1
        for a, b, c in zip(t, t[1:], t[2:]):
            tri[a + " " + b][c] += 1


def top(d):
    return {k: dict(v.most_common(TOP)) for k, v in d.items()}


def end_contexts(d):
    """Contexts after which the sentence usually ends (true probabilities, before pruning)."""
    out = {}
    for k, c in d.items():
        n = sum(c.values())
        if n >= MIN_SUPPORT and c[END] / n >= END_P:
            out[k] = round(c[END] / n, 2)
    return out


model = {
    "endBi": end_contexts(bi),
    "endTri": end_contexts(tri),
    "unigram": {w: c for w, c in uni.most_common() if c >= MIN_WORD},
    "bigram": top(bi),
    "trigram": {k: v for k, v in top(tri).items() if max(v.values()) >= 2},
}

with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.MODEL = " + json.dumps(model, ensure_ascii=False) + ";")

# Same three pickle files as the sample repo (for Python-side use / report demo)
for name, data in (("unigram", model["unigram"]), ("bigram", model["bigram"]), ("trigram", model["trigram"])):
    with open(ROOT / f"final_{name}.pkl", "wb") as f:
        pickle.dump(data, f)

print(f"Words: {sum(uni.values())} | Vocabulary: {len(uni)} | "
      f"Bigram contexts: {len(bi)} | Trigram contexts: {len(tri)}")
print(f"Saved {OUT} and final_unigram.pkl, final_bigram.pkl, final_trigram.pkl")