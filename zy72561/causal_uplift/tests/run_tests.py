import json, os, subprocess, tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.path.join(BASE, "main.py")


def sh(*args):
    env = os.environ.copy()
    env["PYTHONPATH"] = BASE
    r = subprocess.run(
        ["python3", MAIN] + list(args),
        capture_output=True, text=True, cwd=BASE, env=env)
    return r


def jload(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def check(ok, msg=""):
    if not ok:
        raise AssertionError(msg)


def scenario_1_confirm_and_accept(td):
    sf = os.path.join(td, "s1.json")
    r3 = "S1-阿越真实确认：v1历史遗留，以YAML补录v2和0.675"
    r2 = "S1-林川真实接受：SLA降级属实，接受默认分0.5"

    r = sh("import", "--reset", "--state", sf)
    check(r.returncode == 0, r.stderr)

    d = json.loads(sh("review", "list", "--state", sf).stdout)
    check(d["pending_items"]["experiment_platform"][0]["sample_id"] == "SAMPLE-003")
    check(d["pending_items"]["recommend_lead"][0]["sample_id"] == "SAMPLE-002")
    check(d["pending_items"]["experiment_platform"][0]["conflict_count"] == 3)

    d3 = json.loads(sh("review", "decide", "--state", sf,
        "--role", "experiment_platform", "--sample-id", "SAMPLE-003",
        "--decision", "confirm", "--reason", r3).stdout)["decision"]
    check(d3["after_status"] == "CONFIRMED")
    check(d3["actor"] == "阿越")
    check(d3["reason"] == r3)

    d2 = json.loads(sh("review", "decide", "--state", sf,
        "--role", "recommend_lead", "--sample-id", "SAMPLE-002",
        "--decision", "accept_default", "--reason", r2).stdout)["decision"]
    check(d2["after_status"] == "REVIEW_COMPLETED")
    check(d2["actor"] == "林川")
    check(d2["reason"] == r2)

    check(sh("refresh", "--state", sf).returncode == 0)
    txt = sh("report", "--state", sf).stdout
    check(r3 in txt, "report lacks s3 reason")
    check(r2 in txt, "report lacks s2 reason")
    check("final_status  : CONFIRMED" in txt)
    check("final_status  : REVIEW_COMPLETED" in txt)

    rep = jload(os.path.join(BASE, "reports", "final_report.json"))
    h3 = [x for x in rep["review_history"] if x["sample_id"] == "SAMPLE-003"]
    h2 = [x for x in rep["review_history"] if x["sample_id"] == "SAMPLE-002"]
    check(len(h3) == 1 and h3[0]["reason"] == r3)
    check(len(h2) == 2 and h2[-1]["reason"] == r2)
    check(rep["summaries"]["SAMPLE-003"]["review_history_refs"] == [h3[0]["timestamp"]])
    check(r3 in rep["summaries"]["SAMPLE-003"]["summary_text"])
    check(r2 in rep["summaries"]["SAMPLE-002"]["summary_text"])
    print("[PASS] s1: confirm(S3) + accept_default(S2)")


def scenario_2_override(td):
    sf = os.path.join(td, "s2.json")
    r = "S2-林川真实覆盖：高潜用户 0.5->0.720"
    sh("import", "--reset", "--state", sf)
    d = json.loads(sh("review", "decide", "--state", sf,
        "--role", "recommend_lead", "--sample-id", "SAMPLE-002",
        "--decision", "override", "--final-score", "0.720",
        "--reason", r).stdout)["decision"]
    check(d["field_changes"]["new_score"] == 0.720 and d["reason"] == r)
    sh("refresh", "--state", sf)
    sh("report", "--state", sf)
    rep = jload(os.path.join(BASE, "reports", "final_report.json"))
    check(rep["records"]["SAMPLE-002"]["uplift_score"] == 0.720)
    check(rep["records"]["SAMPLE-002"]["default_score_applied"] is False)
    check(r in rep["summaries"]["SAMPLE-002"]["summary_text"])
    print("[PASS] s2: override(S2) 0.5 -> 0.720")


def scenario_3_reject(td):
    sf = os.path.join(td, "s3.json")
    r = "S3-阿越真实驳回：补录未过业务评审，回滚0.641"
    sh("import", "--reset", "--state", sf)
    d = json.loads(sh("review", "decide", "--state", sf,
        "--role", "experiment_platform", "--sample-id", "SAMPLE-003",
        "--decision", "reject", "--rollback-score", "0.641",
        "--reason", r).stdout)["decision"]
    check(d["after_status"] == "REJECTED" and d["reason"] == r)
    check(d["field_changes"]["rollback_uplift_score"] == 0.641)
    sh("refresh", "--state", sf)
    sh("report", "--state", sf)
    rep = jload(os.path.join(BASE, "reports", "final_report.json"))
    check(rep["records"]["SAMPLE-003"]["status"] == "REJECTED")
    check(rep["records"]["SAMPLE-003"]["uplift_score"] == 0.641)
    check(r in rep["summaries"]["SAMPLE-003"]["summary_text"])
    print("[PASS] s3: reject(S3) 0.675 -> 0.641")


def scenario_4_mat_wrong(td):
    sf = os.path.join(td, "s4.json")
    r = "S4-MAT-WRONG-001：阿越核对证据后驳回"
    mp = os.path.join(BASE, "data", "material_wrong_caliber.yaml")
    d = json.loads(sh("run-material", "--reset", "--state", sf,
                       "--material", mp).stdout)
    check("STOPPED_AT_PENDING_REVIEW" in d["current_state"])
    check(len(d["conflicts_for_target"]) == 1)
    c = d["conflicts_for_target"][0]
    check(c["sample_id"] == "SAMPLE-003")
    check(c["final_status"] == "YAML_SUPPLEMENT_OLD_CALIBER")
    check(any(x["candidate_table_value"] == "v1" for x in c["conflicts"]))
    check(any(x["yaml_value"] == "v2" for x in c["conflicts"]))
    check(any(x["candidate_table_value"] == 0.641 for x in c["conflicts"]))
    check(any(x["yaml_value"] == 0.675 for x in c["conflicts"]))

    d2 = json.loads(sh("review", "list", "--state", sf).stdout)
    check(any(p["sample_id"] == "SAMPLE-003"
              for p in d2["pending_items"]["experiment_platform"]))

    d3 = json.loads(sh("review", "decide", "--state", sf,
        "--role", "experiment_platform", "--sample-id", "SAMPLE-003",
        "--decision", "reject", "--rollback-score", "0.641",
        "--reason", r).stdout)["decision"]
    check(d3["after_status"] == "REJECTED" and d3["reason"] == r)

    sh("refresh", "--state", sf)
    txt = sh("report", "--state", sf).stdout
    check(r in txt and "final_status  : REJECTED" in txt)
    check("uplift_score  : 0.641" in txt)
    print("[PASS] s4: MAT-WRONG-001 evidence -> reject -> report")


def main():
    with tempfile.TemporaryDirectory() as td:
        scenario_1_confirm_and_accept(td)
        scenario_2_override(td)
        scenario_3_reject(td)
        scenario_4_mat_wrong(td)
    print("\n=== ALL TESTS PASSED ===")


if __name__ == "__main__":
    main()
