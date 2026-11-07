"""Quality Q&A bank for FAILSPAN, built from the BridgeWorks question banks.

    python tools/export_bank.py

Same pattern as BridgeWorks (tools/export_web.py there):
- a question lives in one class only (the lowest class it appears in);
- at most CAP questions of one "kind" (same text, other numbers) per class and subject, and no more than
  CAP near-same ones (word overlap >= NEAR) -> look-alikes are left out, the best (first) ones are kept;
- classes 11, 12, NIT (13), IIT (14) and BE (15) keep the most questions (CAP_HIGH), still without repeats.
Classes 11 and 12 also get NEET Data Hub questions (Physics, Chemistry, Biology; read-only from
Projects/NEET_Data_Hub), appended after the old rows: nothing already in the game, one per kind, no near-same,
and one opening ("Match List I...") at most 1 in 12 of a subject so look-alikes can stay 10 apart.
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


NEET_DB = os.path.join(os.path.dirname(HERE), "NEET_Data_Hub", "output", "neet_hub.db")
NEET_CLASSES = {11, 12}
NEET_SUBJECT = {"Physics": "physics", "Chemistry": "chemistry", "Biology": "biology"}


def neet_rows(level, subjects, rows, seen, counts):
    """Class 11/12 questions written for the NEET Data Hub (read-only), quality first: nothing already in the
    game, no second question of the same kind (only the numbers changed), no near-same of anything kept."""
    import sqlite3
    db = sqlite3.connect(f"file:{NEET_DB}?mode=ro", uri=True)
    try:
        found = db.execute("select subject, question, option_a, option_b, option_c, option_d, correct_option, explanation "
                           "from questions where class_level = ? and source != 'School MCQ Bank' order by id", (level,)).fetchall()
    finally:
        db.close()
    kept = {}                                 # subject -> word sets of every question kept (the game's and the new ones)
    kinds = set()
    for r in rows:
        if r:
            words = frozenset(_WORDS.findall(r[1].lower()))
            kept.setdefault(subjects[r[0]], []).append(words)
            kinds.add(" ".join(_WORDS.findall(r[1].lower())))
    out = []
    for subj, q, a, b, c, dd, right, expl in found:
        s = NEET_SUBJECT[subj]
        opts = [a, b, c, dd]
        key = q.strip().lower()
        kind = " ".join(_WORDS.findall(q.lower()))
        words = frozenset(_WORDS.findall(q.lower()))
        if key in seen or kind in kinds or right not in "ABCD" or len(set(opts)) < 4 or not all(o and o.strip() for o in opts):
            continue
        if any(len(words & w) / len(words | w) >= NEAR for w in kept.get(s, [])):
            continue
        seen.add(key)
        kinds.add(kind)
        kept.setdefault(s, []).append(words)
        if s not in subjects:
            subjects.append(s)
        out.append([subjects.index(s), q, opts, "ABCD".index(right), expl])
    # one opening (first five words, e.g. "Match List I with List II") at most 1 in 12 of a subject, so the game
    # can always keep look-alike openings 10 questions apart; the first ones written are kept
    head = lambda text: " ".join(re.findall(r"[a-z]+", text.lower())[:5])
    while True:
        total, base = {}, {}
        for r in rows:
            if r:
                total[r[0]] = total.get(r[0], 0) + 1
                base[(r[0], head(r[1]))] = base.get((r[0], head(r[1])), 0) + 1
        for r in out:
            total[r[0]] = total.get(r[0], 0) + 1
        used, trimmed = dict(base), []
        for r in out:
            k = (r[0], head(r[1]))
            if used.get(k, 0) + 1 > total[r[0]] // 12:
                continue
            used[k] = used.get(k, 0) + 1
            trimmed.append(r)
        if len(trimmed) == len(out):
            break
        out = trimmed
    for r in out:
        counts[subjects[r[0]]] = counts.get(subjects[r[0]], 0) + 1
    print(f"  NEET Data Hub, class {level}: {len(out)} of {len(found)} added")
    return out


WRITTEN = None


def written_rows(level, subjects, rows, seen, counts):
    """Questions written fresh for both games (MODIS_BridgeWorks/banks/written), after every older row;
    the shared gate leaves out anything already in the game or near-same to a question kept here."""
    global WRITTEN
    if WRITTEN is None:
        from banks import written
        WRITTEN = written
        WRITTEN.items = written.load()
    kept = {}
    for r in rows:
        if r:
            kept.setdefault((level, subjects[r[0]]), []).append(r[1])
    gate = WRITTEN.Gate(seen, kept)
    out = []
    for w in WRITTEN.items:
        w = dict(w, subject=w["subject"].removesuffix("_x"))     # FAILSPAN has no chapter chips: physics_x is physics
        if w["class_level"] != level or not gate.ok(level, w["subject"], w["question"]):
            continue
        if w["subject"] not in subjects:
            subjects.append(w["subject"])
        seen.add(w["question"].strip().lower())
        out.append([subjects.index(w["subject"]), w["question"], w["options"], w["correct_idx"], w["explanation"]])
        counts[w["subject"]] = counts.get(w["subject"], 0) + 1
    if out:
        print(f"  written for both games, class {level}: {len(out)} added")
    return out


def main():
    qs = question_bank.merge(question_bank.load_school_bank(), question_bank.load_academy_bank())
    good = quality(qs)
    owner = {}
    for level in sorted({q["class_level"] for q in qs}):
        for q in qs:
            if q["class_level"] == level:
                owner.setdefault(q["question"].strip().lower(), level)
    seen = set(owner)                         # every question text already in the game (any class)
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
        d["q"] = d["q"][:len(mine)]           # NEET rows (if any) are rebuilt below, always after these
        assert len(mine) == len(d["q"]), (level, len(mine), len(d["q"]))
        rows, counts = [], {}
        for q, row in zip(mine, d["q"]):
            if row is not None:
                assert row[1] == q["question"], (level, row[1][:60], q["question"][:60])
            keep = row is not None and owner[q["question"].strip().lower()] == level and id(q) in good
            rows.append(row if keep else None)
            if keep:
                counts[d["s"][row[0]]] = counts.get(d["s"][row[0]], 0) + 1
        if level in NEET_CLASSES:
            rows += neet_rows(level, d["s"], rows, seen, counts)
        rows += written_rows(level, d["s"], rows, seen, counts)
        d["q"] = rows
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
        info["n"] = sum(counts.values())
        info["rows"] = len(rows)
        order = list(info["subjects"]) + [s for s in counts if s not in info["subjects"]]   # a new subject gets its own chip
        info["subjects"] = {s: counts[s] for s in order if s in counts}
        total += info["n"]
        print(f"class {level}: {info['n']} of {len(rows)} kept")
    with open(lv_path, "w", encoding="utf-8") as f:
        json.dump(lv, f, ensure_ascii=False, separators=(",", ":"))
    print("questions:", total)


if __name__ == "__main__":
    main()
