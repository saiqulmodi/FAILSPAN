"""Checks tools/check_bank.py (the bank rules): python tests/bank.test.py

- the real bank passes;
- the bank from before the cleanup (parent of commit 76b4714, from git history) gives the numbers reported then:
  612 groups over the limit and 1,493 questions removed;
- small fixture banks break each rule (and pass once fixed);
- the incoming-file mode catches a near-duplicate and a repeat.
Everything temporary goes to a temp folder that is deleted at the end; the project is never written to.
"""
import contextlib, io, json, os, shutil, subprocess, sys, tarfile, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True                      # leave no __pycache__ in tools/
sys.path.insert(0, os.path.join(HERE, "tools"))
import check_bank as C  # noqa: E402

fails = 0
def check(cond, msg):
    global fails
    if not cond: fails += 1
    print(("ok  " if cond else "FAIL"), msg)

def run(*argv):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = C.main(list(argv))
    return code, out.getvalue()

TMP = tempfile.mkdtemp(prefix="bankcheck-")
try:
    # ---- the real bank
    code, out = run("--root", HERE)
    check(code == 0 and "ALL BANK RULES PASS" in out, "real bank: every bank rule passes (exit 0)")

    # ---- the bank from before the cleanup, taken from git history
    pre = os.path.join(TMP, "pre")
    tar = subprocess.run(["git", "-C", HERE, "archive", "76b4714^", "data/q", "data/levels.json"], capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(tar)) as t: t.extractall(pre, filter="data")
    _, qs = C.load_bank(os.path.join(pre, "data"))
    _, over, repeats, remove = C.check_similar(qs, 2)
    check(len(qs) == 17570, f"before the cleanup: 17,570 live questions (got {len(qs):,})")
    check(over == 612 and remove == 1493, f"before the cleanup: 612 groups over the limit and 1,493 questions removed, as in 76b4714 (got {over}, {remove:,})")
    code, out = run("--root", HERE, "--data", os.path.join(pre, "data"))
    check(code == 1 and "FAIL  a) rule 7" in out and "Class 11 row 0" in out, "before the cleanup: the checker fails rule 7 and names group, class and row")

    # ---- small fixture banks: one rule broken at a time, then fixed
    WORDS = "alpha beta gamma delta omega sigma theta kappa lambda zeta".split()
    def name(k): return " ".join(WORDS[(k // 10 ** j) % 10] for j in range(5))        # unique wording (class included), no digits
    def bank(tag, classes, extra_rows=None, sw="const isArchive = u => u.includes('/data/archive/');"):
        root = os.path.join(TMP, tag); os.makedirs(os.path.join(root, "data", "q"))
        levels = []
        for lv, n in classes:
            rows = [[0, f"What does the {name(lv * 1000 + k)} beam carry", ["a", "b", "c", "d"], 1, ""] for k in range(n)]
            rows += (extra_rows or {}).get(lv, [])
            json.dump({"s": ["bridge"], "q": rows}, open(os.path.join(root, "data", "q", f"{lv}.json"), "w", encoding="utf-8"))
            levels.append({"l": lv, "name": f"Class {lv}", "n": len(rows)})
        json.dump({"levels": levels}, open(os.path.join(root, "data", "levels.json"), "w", encoding="utf-8"))
        open(os.path.join(root, "sw.js"), "w", encoding="utf-8").write(sw)
        open(os.path.join(root, "index.html"), "w", encoding="utf-8").write("<script src='js/game.js'></script>")
        os.makedirs(os.path.join(root, "js")); open(os.path.join(root, "js", "game.js"), "w", encoding="utf-8").write("fetch('data/q/8.json')")
        return root
    Q = lambda text, a=0, o=None: [0, text, o if o is not None else ["w", "x", "y", "z"], a, ""]
    def case(label, root, rule):
        code, out = run("--root", root)
        return code, out, f"FAIL  {rule}" in out
    code, out = run("--root", bank("ok", [(8, 100), (9, 100)]))
    check(code == 0, "fixture: a clean bank passes")

    three = {8: [Q("A beam of 2 m carries 5 kN"), Q("A beam of 3 m carries 5 kN"), Q("A beam of 4 m carries 6 kN")]}
    code, out, hit = case("3 similar", bank("sim3", [(8, 100), (9, 100)], three), "a) rule 7")
    check(code == 1 and hit and "3 similar questions" in out and "Class 8 row 100" in out, "fixture: 3 similar questions fail rule 7 (group, class, row)")
    code, _, _ = case("2 similar", bank("sim2", [(8, 100), (9, 100)], {8: three[8][:2]}), "a) rule 7")
    check(code == 0, "fixture: ...2 similar questions with different numbers pass")
    cross = {8: [Q("A beam of 2 m carries 5 kN")], 9: [Q("A beam of 3 m carries 5 kN"), Q("A beam of 9 m carries 1 kN")]}
    code, out, hit = case("cross", bank("cross", [(8, 100), (9, 100)], cross), "a) rule 7")
    check(code == 1 and hit and "Class 8 row 100" in out and "Class 9 row 100" in out, "fixture: the limit counts across classes (whole bank)")

    same = {8: [Q("A beam of 2 m carries 5 kN")], 9: [Q("A beam of 2 m carries 5 kN?")]}
    code, out, hit = case("same numbers", bank("same", [(8, 100), (9, 100)], same), "a) rule 7")
    check(code == 1 and hit and "identical numbers ('2', '5')" in out, "fixture: two similar questions with identical numbers fail rule 7")
    code, _, _ = case("fixed", bank("same-fixed", [(8, 100), (9, 100)], {8: same[8], 9: [Q("A beam of 2 m carries 7 kN")]}), "a) rule 7")
    check(code == 0, "fixture: ...with other numbers it passes")

    code, out, hit = case("99", bank("n99", [(8, 100), (9, 99)]), "b) rule 9")
    check(code == 1 and hit and "Class 9: 99 live questions" in out, "fixture: a class with 99 live questions fails rule 9")
    code, _, _ = case("100", bank("n100", [(8, 100), (9, 100)]), "b) rule 9")
    check(code == 0, "fixture: ...with 100 it passes")
    nulls = bank("nulls", [(8, 100), (9, 100)], {9: [None, None]})
    data = json.load(open(os.path.join(nulls, "data", "q", "9.json"), encoding="utf-8")); data["q"][5] = None
    json.dump(data, open(os.path.join(nulls, "data", "q", "9.json"), "w", encoding="utf-8"))
    code, out, hit = case("nulls", nulls, "b) rule 9")
    check(code == 1 and "Class 9: 99 live questions" in out, "fixture: empty rows are not counted as live questions")

    code, out, hit = case("bad index", bank("idx", [(8, 100), (9, 100)], {8: [Q("Which part takes compression", a=4)]}), "c)")
    check(code == 1 and hit and "Class 8 row 100: answer index 4" in out, "fixture: an answer index outside the 4 options fails")
    code, out, hit = case("3 options", bank("opt3", [(8, 100), (9, 100)], {8: [Q("Which part takes compression", o=["w", "x", "y"])]}), "c)")
    check(code == 1 and hit and "3 options" in out, "fixture: a question with 3 options fails")
    code, _, _ = case("good index", bank("idx-ok", [(8, 100), (9, 100)], {8: [Q("Which part takes compression", a=3)]}), "c)")
    check(code == 0, "fixture: ...answer index 3 of 4 passes")

    code, out, hit = case("archive in sw.js", bank("arch", [(8, 100), (9, 100)], sw="const CORE = ['./data/archive/removed-duplicates.json'];"), "d)")
    check(code == 1 and hit and "sw.js line 1: data/archive/removed-duplicates.json" in out, "fixture: an archive file in sw.js fails")
    code, _, _ = case("guard only", bank("arch-ok", [(8, 100), (9, 100)]), "d)")
    check(code == 0, "fixture: ...the guard that keeps the archive out of the cache is allowed")
    code, out = run("--root", HERE)
    check("PASS  d)" in out, "real sw.js, index.html and js/*.js: no archive file referenced")

    # ---- incoming file of new questions (future hub import)
    root = bank("incoming", [(8, 100), (9, 100)], {8: [Q("A beam of 2 m carries 5 kN")]})
    os.makedirs(os.path.join(root, "data", "archive"))
    json.dump({"eligible_after": "2027-05-28", "questions": [{"cls": "Class 9", "row": 7, "question": "A truss of 6 panels spans 30 m"}]},
              open(os.path.join(root, "data", "archive", "removed.json"), "w", encoding="utf-8"))
    inc = os.path.join(TMP, "incoming.json")
    json.dump({"q": ["A beam of 8 m carries 1 kN", "How does a suspension cable hold the deck"]}, open(inc, "w", encoding="utf-8"))
    code, out = run("--root", root, "--incoming", inc)
    check(code == 0 and "1 near-duplicates" in out and "incoming #1 is similar to Class 8 row 100" in out, "incoming: a near-duplicate (other numbers) is reported")
    json.dump({"q": ["A beam of 2 m carries 5 kN.", "A truss of 6 panels spans 30 m", "A truss of 8 panels spans 40 m"]}, open(inc, "w", encoding="utf-8"))
    code, out = run("--root", root, "--incoming", inc)
    check(code == 1 and "incoming #1 repeats (identical numbers) Class 8 row 100" in out, "incoming: a repeat of a live question fails")
    check("incoming #2 repeats archived Class 9 row 7 (eligible after 2027-05-28)" in out, "incoming: a repeat of an archived question fails, with its eligible_after date")
    check("incoming #3 is similar to incoming #2" in out, "incoming: near-duplicates inside the incoming file are reported too")
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print(f"{fails} FAILED" if fails else "all bank checks passed")
sys.exit(1 if fails else 0)
