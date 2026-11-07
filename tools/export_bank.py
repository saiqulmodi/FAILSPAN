"""Quality Q&A bank for FAILSPAN, built from the BridgeWorks question banks.

    python tools/export_bank.py

Same pattern as BridgeWorks (tools/export_web.py there):
- a question lives in one class only (the lowest class it appears in);
- at most CAP questions of one "kind" (same text, other numbers) per class and subject, and no more than
  CAP near-same ones (word overlap >= NEAR) -> look-alikes are left out, the best (first) ones are kept;
- classes 11, 12, NIT (13), IIT (14) and BE (15) keep the most questions (CAP_HIGH), still without repeats.
FAILSPAN's own rows (data/q/<level>.json) stay in place: a left-out question becomes a null row, so saved
progress (bit per row number) still points at the right question. levels.json gets n (questions kept) and
rows (row count, for the progress bits).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRIDGEWORKS = os.path.join(os.path.dirname(HERE), "MODIS_BridgeWorks")
sys.path.insert(0, BRIDGEWORKS)
from game import question_bank  # noqa: E402

DATA = os.path.join(HERE, "data")
CAP = 2                         # classes 1-10 and Expert, same as BridgeWorks
CAP_HIGH = int(os.environ.get("CAP_HIGH", 4))
HIGH = {11, 12, 13, 14, 15}
NEAR = 0.8
_WORDS = re.compile(r"[^\W\d_]+")


def quality(questions):
    rank = {c: i for i, c in enumerate(question_bank.PLAY_ORDER)}
    by_class = sorted(questions, key=lambda q: rank.get(q["class_level"], len(rank) + q["class_level"]))
    count, owner, kept_words, good = {}, {}, {}, set()
    for q in by_class:
        cls, subj = q["class_level"], q["subject"]
        kind = " ".join(_WORDS.findall(q["question"].lower()))
        cap = CAP_HIGH if cls in HIGH else CAP
        if owner.setdefault((subj, kind), cls) != cls:
            continue
        if count.get((cls, subj, kind), 0) >= cap:
            continue
        words = frozenset(_WORDS.findall(q["question"].lower()))
        kept = kept_words.setdefault((cls, subj), [])
        if words and sum(1 for w in kept[-400:] if len(words & w) / len(words | w) >= NEAR) >= cap:
            continue
        count[(cls, subj, kind)] = count.get((cls, subj, kind), 0) + 1
        kept.append(words)
        good.add(id(q))
    return good


def main():
    qs = question_bank.merge(question_bank.load_school_bank(), question_bank.load_academy_bank())
    good = quality(qs)
    owner = {}
    for level in sorted({q["class_level"] for q in qs}):
        for q in qs:
            if q["class_level"] == level:
                owner.setdefault(q["question"].strip().lower(), level)
    lv_path = os.path.join(DATA, "levels.json")
    with open(lv_path, encoding="utf-8") as f:
        lv = json.load(f)
    total = 0
    for info in lv["levels"]:
        level = info["l"]
        path = os.path.join(DATA, "q", f"{level}.json")
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        mine = [q for q in qs if q["class_level"] == level and q["correct_idx"] < 4]
        assert len(mine) == len(d["q"]), (level, len(mine), len(d["q"]))
        rows, counts = [], {}
        for q, row in zip(mine, d["q"]):
            if row is not None:
                assert row[1] == q["question"], (level, row[1][:60], q["question"][:60])
            keep = row is not None and owner[q["question"].strip().lower()] == level and id(q) in good
            rows.append(row if keep else None)
            if keep:
                counts[d["s"][row[0]]] = counts.get(d["s"][row[0]], 0) + 1
        d["q"] = rows
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
        info["n"] = sum(counts.values())
        info["rows"] = len(rows)
        info["subjects"] = {s: counts[s] for s in info["subjects"] if s in counts}
        total += info["n"]
        print(f"class {level}: {info['n']} of {len(rows)} kept")
    with open(lv_path, "w", encoding="utf-8") as f:
        json.dump(lv, f, ensure_ascii=False, separators=(",", ":"))
    print("questions:", total)


if __name__ == "__main__":
    main()
