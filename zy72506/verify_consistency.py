import os, sys, json, hashlib, shutil, subprocess
import urllib.request, urllib.error
import pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
from src import storage, engine
from src.models import VerificationStatus, ConflictType

API_BASE = "http://127.0.0.1:5001/api/v1"
TARGET_BATCH = "batch_ce7d1157"
TARGET_SAMPLES = ["S003", "S006", "S007", "S008", "S009", "S010"]

def api_get(path):
    try:
        with urllib.request.urlopen(API_BASE + "/" + path, timeout=3) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"__error__": str(e)}

def api_available():
    return "__error__" not in api_get("health")

def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()

def step(title):
    print()
    print("=" * 70)
    print("  " + title)
    print("=" * 70)

def check(label, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    prefix = "[OK]" if cond else "[XX]"
    print("  " + prefix + " [" + status + "] " + label)
    if detail and not cond:
        print("         " + detail)
    return cond

def main():
    os.chdir(BASE)
    storage.init_db()
    all_pass = True

    expected_status = {
        "S003": VerificationStatus.COMPLETED,
        "S006": VerificationStatus.COMPLETED,
        "S007": VerificationStatus.COMPLETED,
        "S008": VerificationStatus.AI_PM_REVIEWED,
        "S009": VerificationStatus.PENDING_AI_PM_REVIEW,
        "S010": VerificationStatus.PENDING_AI_PM_REVIEW,
    }
    step("0. DB status check")
    for sid in TARGET_SAMPLES:
        rec = storage.list_verification_records(batch_id=TARGET_BATCH, sample_id=sid)[0]
        ok = check(sid + " status = " + expected_status[sid].value, rec.status == expected_status[sid])
        all_pass &= ok

    step("1. DB layer: history + explanation")
    for sid in TARGET_SAMPLES:
        rec = storage.list_verification_records(batch_id=TARGET_BATCH, sample_id=sid)[0]
        ex = engine.get_processing_explanation(rec.id)
        view = engine.get_record_for_review(rec.id)
        all_pass &= check(sid + " history >= 2", len(rec.status_history) >= 2, "实际=" + str(len(rec.status_history)))
        last_hist = rec.status_history[-1]["new_status"] if rec.status_history else None
        all_pass &= check(sid + " last hist = current", last_hist == rec.status.value)
        all_pass &= check(sid + " decisions >= 1", len(ex["decisions"]) >= 1)
        if expected_status[sid] == VerificationStatus.COMPLETED:
            has_pass = any("运营复核通过" in d for d in ex["decisions"])
            all_pass &= check(sid + " has op pass", has_pass)
            has_reject = any("运营复核驳回" in d for d in ex["decisions"])
            all_pass &= check(sid + " no wrong reject", not has_reject)
        if sid == "S008":
            all_pass &= check("S008 blocked at step3", "第三步" in (view["blocked_step"] or ""))
        if sid in ("S009", "S010"):
            bs = view["blocked_step"] or ""
            all_pass &= check(sid + " blocked at step2", "第二步" in bs and "第一步" not in bs)

    step("2. Export layer")
    subprocess.run(["python3", "cli.py", "export", "-b", TARGET_BATCH, "-o", "output/final.xlsx"], cwd=BASE, capture_output=True, check=True)
    final_path = os.path.join(BASE, "output", "final.xlsx")
    detail_path = os.path.join(BASE, "output", "校验明细.xlsx")
    shutil.copy2(final_path, detail_path)
    final_md5 = md5(final_path)
    detail_md5 = md5(detail_path)
    all_pass &= check("MD5 match", final_md5 == detail_md5)

    for xlsx_name in ("final.xlsx", "校验明细.xlsx"):
        df = pd.read_excel(os.path.join(BASE, "output", xlsx_name))
        for sid in TARGET_SAMPLES:
            row = df[df["样本编号"] == sid]
            if len(row) == 0:
                all_pass &= check(xlsx_name + " contains " + sid, False)
                continue
            r = row.iloc[0]
            rec = storage.list_verification_records(batch_id=TARGET_BATCH, sample_id=sid)[0]
            v = engine.get_record_for_review(rec.id)
            all_pass &= check(xlsx_name + " " + sid + " status = DB", str(r["当前状态"]) == v["status_display"])
            blocked_str = str(r["卡在哪一步"])
            all_pass &= check(xlsx_name + " " + sid + " not step1", "第一步：模型输出导入" not in blocked_str)

    step("3. REST API layer")
    has_api = api_available()
    if not has_api:
        print("  [--] API not running, skip")
    else:
        batch_records = api_get("batches/" + TARGET_BATCH + "/records")
        all_pass &= check("API returns data", "__error__" not in batch_records and "data" in batch_records)
        api_map = {r["sample_id"]: r for r in batch_records.get("data", [])}
        for sid in TARGET_SAMPLES:
            if sid not in api_map:
                all_pass &= check("API has " + sid, False)
                continue
            a = api_map[sid]
            rec = storage.list_verification_records(batch_id=TARGET_BATCH, sample_id=sid)[0]
            v = engine.get_record_for_review(rec.id)
            all_pass &= check("API " + sid + " status = DB", a["status_display"] == v["status_display"])
            all_pass &= check("API " + sid + " blocked = DB", a["blocked_step"] == v["blocked_step"])

            all_pass &= check("API " + sid + " not step1", "第一步：模型输出导入" not in (a["blocked_step"] or ""))
            single = api_get("records/" + str(a["record_id"]))
            all_pass &= check("API /records/{id} available", "__error__" not in single)
            if "__error__" not in single and "processing_explanation" in single:
                dec = single["processing_explanation"]["decisions"]
                all_pass &= check("API " + sid + " decisions >= 1", len(dec) >= 1)

    step("Summary")
    result = "ALL PASS" if all_pass else "SOME FAILURES"
    print("  Result: " + result)
    print("  Batch: " + TARGET_BATCH)
    print("  Samples: " + ", ".join(TARGET_SAMPLES))
    print("  API: " + ("running" if has_api else "not running"))
    print("  Export MD5: " + final_md5)
    return 0 if all_pass else 1

if __name__ == "__main__":
    sys.exit(main())

