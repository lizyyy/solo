#!/usr/bin/env python3
import json, os, sys, csv, subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
SCENARIOS = ['normal', 'wrong_caliber', 'supplement']
all_pass = True
fail_list = []

def check(name, cond, detail=""):
    global all_pass
    ico = "\u2705" if cond else "\u274c"
    msg = f"{ico} {name}"
    if detail:
        msg += f" \u2014 {detail}"
    print(msg)
    if not cond:
        all_pass = False
        fail_list.append(name)

def run_batch(scenario):
    r = subprocess.run([sys.executable, 'main.py', '--mode', 'batch', '--scenario', scenario],
                       capture_output=True, text=True, cwd=BASE)
    check(f"[{scenario}] batch exit=0", r.returncode == 0,
          f"stderr={r.stderr[:120]}" if r.returncode else "")
    return r.returncode == 0

def validate_json_report(scenario):
    path = os.path.join(BASE, 'reports', f'report_{scenario}.json')
    check(f"[{scenario}] JSON exists", os.path.exists(path))
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        d = json.load(f)
    ti = d.get('trace_index', {})
    check(f"[{scenario}] trace_index is dict", isinstance(ti, dict),
          f"type={type(ti).__name__}")
    if isinstance(ti, dict) and ti:
        sv = list(ti.values())[0]
        check(f"[{scenario}] trace_entry has record", 'record' in sv)
        check(f"[{scenario}] trace_entry has batch_id", 'batch_id' in sv)
        check(f"[{scenario}] trace_entry has batch_info", 'batch_info' in sv)
        check(f"[{scenario}] record has user_id", 'user_id' in sv.get('record', {}))
        check(f"[{scenario}] batch_info has batch_type", 'batch_type' in (sv.get('batch_info') or {}))
    s4 = d.get('raw_steps', {}).get('step4_export', {})
    check(f"[{scenario}] step4 exists", s4 != {})
    check(f"[{scenario}] step4 completed", s4.get('status') == 'completed')
    eh = d.get('export_history', [])
    check(f"[{scenario}] export_history >= 1", len(eh) >= 1)
    rh = d.get('run_history', [])
    check(f"[{scenario}] run_history >= 1", len(rh) >= 1)
    return d

def validate_csv_export(scenario):
    path = os.path.join(BASE, 'exports', f'export_{scenario}.csv')
    check(f"[{scenario}] CSV exists", os.path.exists(path))
    if not os.path.exists(path):
        return None, None
    with open(path, newline='') as f:
        rows = list(csv.DictReader(f))
    check(f"[{scenario}] CSV has rows", len(rows) > 0)
    h = rows[0].keys() if rows else []
    check(f"[{scenario}] CSV has _trace_id", '_trace_id' in h)
    check(f"[{scenario}] CSV has _batch_id", '_batch_id' in h)
    check(f"[{scenario}] CSV has _row_idx", '_row_idx' in h)
    nan_rows = [i for i, r in enumerate(rows) if r.get('_row_idx', '').strip().lower() in ('nan', '')]
    check(f"[{scenario}] _row_idx no NaN/blank", len(nan_rows) == 0,
          f"NaN at rows={nan_rows[:5]}" if nan_rows else "")
    for i, r in enumerate(rows):
        if '_row_idx' in r:
            try:
                int(r['_row_idx'])
            except (ValueError, TypeError):
                check(f"[{scenario}] row {i} _row_idx not int", False, f"val={r['_row_idx']}")
                break
    return rows, path

def validate_html(scenario):
    path = os.path.join(BASE, 'reports', f'report_{scenario}.html')
    check(f"[{scenario}] HTML exists", os.path.exists(path))
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    nan_count = content.count('NaN')
    check(f"[{scenario}] HTML no NaN", nan_count == 0, f"count={nan_count}")

def validate_readme_filename():
    readme_path = os.path.join(BASE, 'README.md')
    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()
    check("[README] no bad glob export_wrong_caliber_*", 'export_wrong_caliber_*' not in content)
    check("[README] has correct export_wrong_caliber.csv", 'export_wrong_caliber.csv' in content)
    for sc in SCENARIOS:
        fname = f'export_{sc}.csv'
        check(f"[README] exports/{fname} exists on disk",
              os.path.exists(os.path.join(BASE, 'exports', fname)))

def cross_validate_supplement_trace():
    json_path = os.path.join(BASE, 'reports', 'report_supplement.json')
    csv_path = os.path.join(BASE, 'exports', 'export_supplement.csv')
    if not os.path.exists(json_path) or not os.path.exists(csv_path):
        check("[x-validate] supplement files exist", False)
        return
    with open(json_path, 'r', encoding='utf-8') as f:
        d = json.load(f)
    ti = d.get('trace_index', {})
    if not isinstance(ti, dict) or not ti:
        check("[x-validate] trace_index non-empty dict", False)
        return
    with open(csv_path, newline='') as f:
        rows = list(csv.DictReader(f))
    supp_bids = set()
    for b in d.get('batches', []):
        if b.get('batch_type') == 'supplement':
            supp_bids.add(b['batch_id'])
    check("[x-validate] supplement batch exists", len(supp_bids) > 0)
    supp_rows = [r for r in rows if r.get('_batch_id', '') in supp_bids]
    check("[x-validate] CSV has supplement rows", len(supp_rows) > 0,
          f"count={len(supp_rows)}")
    if not supp_rows:
        return
    sr = supp_rows[0]
    tid = sr.get('_trace_id', '')
    check("[x-validate] supp row has trace_id", tid.startswith('rec_'), f"tid={tid[:16]}")
    check("[x-validate] supp row _row_idx is int",
          sr.get('_row_idx', '').isdigit(), f"val={sr.get('_row_idx')}")
    check("[x-validate] trace_id in trace_index", tid in ti, f"tid={tid[:16]}")
    if tid in ti:
        traced = ti[tid]
        c_uid, c_iid = sr.get('user_id'), sr.get('item_id')
        j_uid = str(traced.get('record', {}).get('user_id', ''))
        j_iid = str(traced.get('record', {}).get('item_id', ''))
        check("[x-validate] user_id match", c_uid == j_uid, f"csv={c_uid} json={j_uid}")
        check("[x-validate] item_id match", c_iid == j_iid, f"csv={c_iid} json={j_iid}")
        j_bid = traced.get('batch_id', '')
        c_bid = sr.get('_batch_id', '')
        check("[x-validate] batch_id match", c_bid == j_bid)
        j_ri = str(traced.get('row_idx', ''))
        c_ri = sr.get('_row_idx', '')
        check("[x-validate] _row_idx match", c_ri == j_ri, f"json={j_ri} csv={c_ri}")
        bi = traced.get('batch_info') or {}
        check("[x-validate] batch_info type=supplement", bi.get('batch_type') == 'supplement')
        check("[x-validate] batch_info has parent_batch_id",
              len(bi.get('parent_batch_id', '')) > 0)
        print(f"    cross-check confirmed: trace={tid[:16]}... uid={c_uid} iid={c_iid} row_idx={c_ri} bid={c_bid[:16]}...")

def cross_validate_structure():
    structures = {}
    for sc in SCENARIOS:
        p = os.path.join(BASE, 'reports', f'report_{sc}.json')
        if not os.path.exists(p):
            continue
        with open(p, 'r', encoding='utf-8') as f:
            d = json.load(f)
        ti = d.get('trace_index', {})
        if isinstance(ti, dict) and ti:
            structures[sc] = set(list(ti.values())[0].keys())
        else:
            structures[sc] = None
    ref = structures.get('wrong_caliber') or structures.get('normal')
    if ref is None:
        check("[structure] no reference", False)
        return
    for sc in SCENARIOS:
        s = structures.get(sc)
        check(f"[{sc}] trace_index structure matches ref", s == ref,
              f"diff={s.symmetric_difference(ref) if s else 'None'}" if s else "empty")

def main():
    print("=" * 70)
    print("  Full Chain Validation - 3 scenarios")
    print("=" * 70)
    print("\n### Step 1: Run 3 scenarios ###")
    for sc in SCENARIOS:
        run_batch(sc)
    print("\n### Step 2: Validate JSON reports ###")
    for sc in SCENARIOS:
        validate_json_report(sc)
    print("\n### Step 3: Validate CSV exports ###")
    for sc in SCENARIOS:
        validate_csv_export(sc)
    print("\n### Step 4: Validate HTML no NaN ###")
    for sc in SCENARIOS:
        validate_html(sc)
    print("\n### Step 5: README filename consistency ###")
    validate_readme_filename()
    print("\n### Step 6: trace_index structure consistency ###")
    cross_validate_structure()
    print("\n### Step 7: Supplement cross-validation ###")
    cross_validate_supplement_trace()
    print("\n" + "=" * 70)
    if all_pass:
        print("ALL PASSED")
    else:
        print(f"FAILED: {len(fail_list)} items")
        for f in fail_list:
            print(f"  - {f}")
    print("=" * 70)
    sys.exit(0 if all_pass else 1)

if __name__ == '__main__':
    main()
