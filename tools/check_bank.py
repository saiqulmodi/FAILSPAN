"""Question bank checker (owner rules, 28-Nov-2026). Read-only: it never writes to the project.

    python tools/check_bank.py                      # check the shipped bank (data/q/*.json, data/levels.json)
    python tools/check_bank.py --incoming new.json  # also check a file of new questions against the bank and archive

Rules checked:
  a) rule 7: across the whole bank at most MAX_SIMILAR live questions per similar group (see similar_key) and never
     two in a group with identical numbers;
  b) rule 9: every class has at least MIN_PER_CLASS live questions;
  c) every live question has OPTIONS options and an answer index that points at one of them;
  d) no file under the archive folder is referenced by the game code (CODE_FILES). The service worker's guard that
     keeps the archive OUT of the cache names the folder itself ("/data/archive/"), and that is allowed.
Exit code 0 when every rule passes, 1 when one is broken (each problem is listed with its group, class and row).

Reusable by the other games: everything game-specific is a setting below or a command-line option.
"""
import argparse
import glob
import json
import os
import re
import sys
from collections import defaultdict

# ---------------- settings (override on the command line) ----------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the game folder
DATA_DIR = "data"                     # relative to ROOT
LEVELS_FILE = "levels.json"           # in DATA_DIR: {"levels": [{LEVEL_KEY: ..., NAME_KEY: ...}, ...]} in class order
QUESTION_DIR = "q"                    # in DATA_DIR: <level>.json = {"s": [subjects], "q": [row or null, ...]}
LEVEL_KEY, NAME_KEY = "l", "name"
ROW_SUBJECT, ROW_QUESTION, ROW_OPTIONS, ROW_ANSWER = 0, 1, 2, 3     # a row: [subject index, question, options, answer, ...]
ARCHIVE_DIR = "data/archive"          # relative to ROOT; removed questions, never shipped
CODE_FILES = ["sw.js", "index.html", "js/*.js"]                      # relative to ROOT
MAX_SIMILAR = 2
MIN_PER_CLASS = 100
OPTIONS = 4
SHOW = 30                             # problems listed per rule (the counts always cover all of them)


# ---------------- the one definition of "similar" ----------------
# Shared by FAILSPAN, BridgeWorks and EcosSynthetica. It is exactly the rule of the script behind commit 76b4714:
# two questions are SIMILAR when their English text is the same once every number is replaced by '#' (case, extra
# spaces and trailing ? . : ! ignored; superscript/subscript digits count as digits; a number may be negative,
# have a decimal point or thousands commas, or be a fraction like 3/4; ½ ¼ ¾ ⅓ ⅔ ⅛ are numbers too).
# Their NUMBERS are the numbers in the text, in order; two similar questions with the same numbers are a repeat.
_SUP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉", "01234567890123456789")
_NUM = re.compile(r"[-−]?\d+(?:[.,]\d+)*(?:\s*/\s*\d+)?|[½¼¾⅓⅔⅛]")


def similar_key(text):
    """(shape, numbers): questions with the same shape are similar; the same shape and numbers is a repeat."""
    t = text.translate(_SUP).lower()
    nums = tuple(n.replace("−", "-").replace(" ", "") for n in _NUM.findall(t))
    shape = re.sub(r"\s+", " ", _NUM.sub("#", t)).strip().rstrip("?.:!").strip()
    return shape, nums


# ---------------- loading ----------------
def load_bank(data_dir):
    """The live questions in class order: dicts with cls (name), level, row, q, o, a, shape, nums."""
    with open(os.path.join(data_dir, LEVELS_FILE), encoding="utf-8") as f:
        levels = json.load(f)["levels"]
    classes, qs = [], []
    for lv in levels:
        level, name = lv[LEVEL_KEY], lv.get(NAME_KEY, str(lv[LEVEL_KEY]))
        with open(os.path.join(data_dir, QUESTION_DIR, f"{level}.json"), encoding="utf-8") as f:
            rows = json.load(f)["q"]
        live = 0
        for i, row in enumerate(rows):
            if not row:
                continue
            live += 1
            shape, nums = similar_key(str(row[ROW_QUESTION]))
            qs.append(dict(cls=name, level=level, row=i, q=row[ROW_QUESTION], o=row[ROW_OPTIONS] if len(row) > ROW_OPTIONS else None,
                           a=row[ROW_ANSWER] if len(row) > ROW_ANSWER else None, shape=shape, nums=nums))
        classes.append((name, live))
    return classes, qs


def load_archive(archive_dir):
    """Archived questions: dicts with cls, row, q, eligible_after (from every .json file in the archive folder)."""
    out = []
    for path in sorted(glob.glob(os.path.join(archive_dir, "*.json"))):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        for x in d.get("questions", []):
            text = x.get("question") or (x.get("original_row") or [None, ""])[ROW_QUESTION]
            out.append(dict(cls=x.get("cls", "?"), row=x.get("row", "?"), q=text, eligible_after=x.get("eligible_after", d.get("eligible_after")),
                            file=os.path.basename(path)))
    return out


def where(q):
    return f"{q['cls']} row {q['row']}"


# ---------------- the rules ----------------
def check_similar(qs, max_similar):
    """Rule 7. Returns (problems, groups over the limit, groups with a repeat, questions the cleanup would remove)."""
    groups = defaultdict(list)
    for q in qs:
        groups[q["shape"]].append(q)
    problems, over, repeats, remove = [], 0, 0, 0
    for shape, g in groups.items():
        if len(g) < 2:
            continue
        distinct = len({q["nums"] for q in g})
        if len(g) > max_similar:
            over += 1
            problems.append(f"{len(g)} similar questions (max {max_similar}): {', '.join(where(q) for q in g[:8])}"
                            f"{' ...' if len(g) > 8 else ''}  | {shape[:90]}")
        seen = {}
        for q in g:
            if q["nums"] in seen:
                problems.append(f"identical numbers {q['nums'] or '(none)'}: {where(seen[q['nums']])} and {where(q)}  | {shape[:90]}")
            seen.setdefault(q["nums"], q)
        if distinct < len(g):
            repeats += 1
        remove += len(g) - min(max_similar, distinct)        # kept: up to max_similar, never two with the same numbers
    return problems, over, repeats, remove


def check_sizes(classes, min_per_class):
    """Rule 9."""
    return [f"{name}: {n} live questions (min {min_per_class})" for name, n in classes if n < min_per_class]


def check_rows(qs, options):
    """Every live question: OPTIONS options and an answer index that points at one of them."""
    out = []
    for q in qs:
        o, a = q["o"], q["a"]
        if not isinstance(o, list) or len(o) != options:
            out.append(f"{where(q)}: {len(o) if isinstance(o, list) else 'no'} options (needs {options})  | {str(q['q'])[:70]}")
        elif not isinstance(a, int) or isinstance(a, bool) or not 0 <= a < len(o):
            out.append(f"{where(q)}: answer index {a!r} is not 0-{len(o) - 1}  | {str(q['q'])[:70]}")
    return out


def check_archive_refs(root, archive_dir, code_files):
    """No game file references a file under the archive folder (the folder name alone, as an exclusion, is allowed)."""
    rel = os.path.relpath(archive_dir, root).replace(os.sep, "/").strip("/")
    pattern = re.compile(re.escape(rel) + r"/[^\s\"'`)\]]+")
    out = []
    for spec in code_files:
        for path in sorted(glob.glob(os.path.join(root, spec))):
            with open(path, encoding="utf-8", errors="replace") as f:
                for n, line in enumerate(f, 1):
                    for m in pattern.finditer(line):
                        out.append(f"{os.path.relpath(path, root)} line {n}: {m.group(0)}")
    return out


def check_incoming(path, qs, archive, max_similar):
    """New questions against the live bank and the archive: repeats (same numbers) and near-duplicates (similar)."""
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    rows = d["q"] if isinstance(d, dict) else d
    texts = [r if isinstance(r, str) else r.get("question") or r.get("q") if isinstance(r, dict) else r[ROW_QUESTION] for r in rows if r]
    live, arch = defaultdict(list), defaultdict(list)
    for q in qs:
        live[q["shape"]].append(q)
    for x in archive:
        arch[similar_key(str(x["q"]))[0]].append(x)
    problems, notes, added = [], [], defaultdict(list)
    for k, text in enumerate(texts):
        shape, nums = similar_key(str(text))
        tag = f"incoming #{k + 1}"
        for q in live[shape] + added[shape]:
            (problems if q["nums"] == nums else notes).append(
                f"{tag} {'repeats (identical numbers)' if q['nums'] == nums else 'is similar to'} {q.get('where') or where(q)}  | {str(text)[:70]}")
        for x in arch[shape]:
            same = similar_key(str(x["q"]))[1] == nums
            (problems if same else notes).append(f"{tag} {'repeats' if same else 'is similar to'} archived {x['cls']} row {x['row']} "
                                                 f"(eligible after {x['eligible_after']})  | {str(text)[:70]}")
        if len(live[shape]) + len(added[shape]) + 1 > max_similar:
            problems.append(f"{tag} would make {len(live[shape]) + len(added[shape]) + 1} similar questions (max {max_similar})  | {str(text)[:70]}")
        added[shape].append(dict(nums=nums, where=tag))
    return problems, notes, len(texts)


# ---------------- report ----------------
def main(argv=None):
    ap = argparse.ArgumentParser(description="Check a question bank against the owner's bank rules.")
    ap.add_argument("--root", default=ROOT, help="game folder (default: this game)")
    ap.add_argument("--data", default=None, help=f"data folder (default: ROOT/{DATA_DIR})")
    ap.add_argument("--archive", default=None, help=f"archive folder (default: ROOT/{ARCHIVE_DIR})")
    ap.add_argument("--max-similar", type=int, default=MAX_SIMILAR)
    ap.add_argument("--min-per-class", type=int, default=MIN_PER_CLASS)
    ap.add_argument("--options", type=int, default=OPTIONS)
    ap.add_argument("--incoming", default=None, help="a file of new questions to check against the bank and the archive")
    a = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")      # questions hold ⁻ ² √ and Bengali
    data =a.data or os.path.join(a.root, DATA_DIR)
    archive_dir = a.archive or os.path.join(a.root, ARCHIVE_DIR)
    classes, qs = load_bank(data)
    print(f"Bank: {data}\n  {len(qs):,} live questions in {len(classes)} classes: " + ", ".join(f"{c} {n:,}" for c, n in classes))
    sim, over, repeats, remove = check_similar(qs, a.max_similar)
    results = [
        (f"a) rule 7: at most {a.max_similar} similar per group, never two with identical numbers", sim,
         f"{over} groups over the limit, {repeats} groups with identical numbers, {remove:,} questions a cleanup would remove"),
        (f"b) rule 9: at least {a.min_per_class} live questions per class", check_sizes(classes, a.min_per_class), ""),
        (f"c) {a.options} options and a valid answer index", check_rows(qs, a.options), ""),
        (f"d) archive ({os.path.relpath(archive_dir, a.root)}) not referenced by {', '.join(CODE_FILES)}",
         check_archive_refs(a.root, archive_dir, CODE_FILES), ""),
    ]
    if a.incoming:
        problems, notes, n = check_incoming(a.incoming, qs, load_archive(archive_dir), a.max_similar)
        results.append((f"e) incoming {os.path.basename(a.incoming)} ({n} questions): no repeats, no group over {a.max_similar}", problems,
                        f"{len(notes)} near-duplicates (similar, other numbers)" + "".join("\n      ~ " + x for x in notes[:SHOW])))
    failed = 0
    for title, problems, extra in results:
        print(f"{'FAIL' if problems else 'PASS'}  {title}: {len(problems)} problem{'s' * (len(problems) != 1)}" + (f"; {extra}" if extra else ""))
        for p in problems[:SHOW]:
            print("      - " + p)
        if len(problems) > SHOW:
            print(f"      ... and {len(problems) - SHOW} more")
        failed += bool(problems)
    print("ALL BANK RULES PASS" if not failed else f"{failed} RULE(S) BROKEN")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
