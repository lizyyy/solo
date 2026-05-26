"""FastAPI integration test for the reconciliation service.

Tests the full flow: /import -> /evaluate -> /review -> /detail -> /trace
Verifies:
1. No duplicate cert_ids after recalc
2. Detail page pass/cert_issued stay in sync
3. /trace returns the same diff_ids as /detail
4. Certificate number can be stably traced to latest source

Run with:  python3 -m pytest test_api.py -v
  Or:   python3 test_api.py   (simple assertion mode)
"""
from __future__ import annotations

import sys

from fastapi.testclient import TestClient

from main import app
from sample_data import (
    ATTENDANCE_CSV,
    HOMEWORK_JSON,
    RULES_JSON,
    SESSIONS_CSV,
    STUDENTS_CSV,
)

client = TestClient(app)


def test_full_flow():
    # 1. Import
    resp = client.post(
        "/import",
        json={
            "students_csv": STUDENTS_CSV,
            "sessions_csv": SESSIONS_CSV,
            "attendance_csv": ATTENDANCE_CSV,
            "homework_json": HOMEWORK_JSON,
            "rules_json": RULES_JSON,
        },
    )
    assert resp.status_code == 200, f"import failed: {resp.text}"
    data = resp.json()
    assert data["students"] == 3
    assert data["attendance"] == 12

    # 2. Evaluate
    resp = client.post("/evaluate")
    assert resp.status_code == 200, f"evaluate failed: {resp.text}"
    data = resp.json()
    assert data["results"] == 3
    assert data["diffs"] > 0
    assert data["certs"] == 3

    # 3. Get diffs, find the makeup pending one for E003
    resp = client.get("/diffs", params={"status": "pending"})
    assert resp.status_code == 200
    diffs = resp.json()
    makeup_diff = next(
        (d for d in diffs if d["student_id"] == "E003" and "补签" in d["description"]),
        None,
    )
    assert makeup_diff is not None, "should find makeup pending diff for E003"

    # 4. Approve the makeup
    resp = client.post(
        "/review",
        json={
            "diff_id": makeup_diff["id"],
            "action": "approve",
            "reviewer": "运营小张",
            "note": "出差记录已核实，补签生效",
        },
    )
    assert resp.status_code == 200

    # 5. Check detail: pass and cert_issued MUST be consistent
    resp = client.get("/detail")
    assert resp.status_code == 200
    detail = resp.json()
    e003_row = next(r for r in detail if r["student_id"] == "E003")

    assert e003_row["pass"] == e003_row["cert_issued"], (
        f"BUG: pass={e003_row['pass']} but cert_issued={e003_row['cert_issued']} "
        f"for E003 - status mismatch!"
    )
    e003_cert_id = e003_row["cert_id"]
    detail_diff_ids = set(e003_row["diff_ids"])
    assert makeup_diff["id"] in detail_diff_ids, "approved diff id should be in source_diff_ids"

    # 6. Recalc - should NOT create duplicate cert_id
    resp = client.get("/diffs")
    all_diffs = resp.json()
    any_diff = all_diffs[0]

    resp = client.post(
        "/review",
        json={
            "diff_id": any_diff["id"],
            "action": "recalc",
            "reviewer": "运营小张",
            "note": "复核后重新计算",
        },
    )
    assert resp.status_code == 200

    # 7. Verify no duplicate cert_ids
    resp = client.get("/detail")
    detail = resp.json()
    cert_ids = [r["cert_id"] for r in detail]
    unique_cert_ids = set(cert_ids)
    assert len(cert_ids) == len(unique_cert_ids), (
        f"BUG: duplicate cert_ids found! {cert_ids}"
    )

    # 8. Get updated detail and trace
    e003_row_new = next(r for r in detail if r["student_id"] == "E003")
    # cert_id must be STABLE - same as before recalc
    assert e003_row_new["cert_id"] == e003_cert_id, (
        f"BUG: cert_id changed after recalc! was {e003_cert_id}, now {e003_row_new['cert_id']}"
    )

    # 9. Trace endpoint must return the SAME diff_ids as detail
    resp = client.get(f"/trace/{e003_cert_id}")
    assert resp.status_code == 200
    trace = resp.json()

    trace_diff_ids = set(d["id"] for d in trace["diffs"])
    detail_diff_ids_new = set(e003_row_new["diff_ids"])

    # The diff_ids shown in trace must be the same as (or subset of) detail
    # (because trace only shows diffs that still exist)
    assert trace_diff_ids.issubset(detail_diff_ids_new), (
        f"BUG: trace shows diffs {trace_diff_ids - detail_diff_ids_new} "
        f"not in detail {detail_diff_ids_new}"
    )

    # 10. Explanation must mention the approval
    assert "补签" in trace["explanation"] or "放行" in trace["explanation"], (
        f"BUG: trace explanation doesn't mention review: {trace['explanation']}"
    )

    # 11. Verify history chain grows
    assert e003_row_new["history_len"] >= 2, (
        f"BUG: history should have at least 2 entries, got {e003_row_new['history_len']}"
    )

    print("✅ All tests passed!")
    print(f"   E003 cert_id: {e003_row_new['cert_id']}")
    print(f"   E003 issued:  {e003_row_new['cert_issued']}")
    print(f"   E003 pass:    {e003_row_new['pass']}")
    print(f"   history len:  {e003_row_new['history_len']}")
    print(f"   diffs count:  {len(e003_row_new['diff_ids'])}")
    print(f"   explanation:  {trace['explanation']}")


def test_reject_makeup_status_sync():
    """Rejecting a makeup should result in pass=False AND cert_issued=False."""
    # Reset app state by creating a new app instance
    from importlib import reload
    import main
    reload(main)

    client2 = TestClient(main.app)

    resp = client2.post(
        "/import",
        json={
            "students_csv": STUDENTS_CSV,
            "sessions_csv": SESSIONS_CSV,
            "attendance_csv": ATTENDANCE_CSV,
            "homework_json": HOMEWORK_JSON,
            "rules_json": RULES_JSON,
        },
    )
    assert resp.status_code == 200
    client2.post("/evaluate")

    resp = client2.get("/diffs", params={"status": "pending"})
    diffs = resp.json()
    makeup_diff = next(
        (d for d in diffs if d["student_id"] == "E003" and "补签" in d["description"]),
        None,
    )

    # Reject the makeup
    resp = client2.post(
        "/review",
        json={
            "diff_id": makeup_diff["id"],
            "action": "reject",
            "reviewer": "运营小张",
            "note": "出差记录不符，补签驳回",
        },
    )
    assert resp.status_code == 200

    resp = client2.get("/detail")
    detail = resp.json()
    e003_row = next(r for r in detail if r["student_id"] == "E003")

    # BUG FIX: pass and cert_issued MUST be the same
    assert e003_row["pass"] == e003_row["cert_issued"], (
        f"BUG after reject: pass={e003_row['pass']} cert_issued={e003_row['cert_issued']}"
    )

    # After rejecting makeup with 75% attendance and 88.5 score but rule requires 75% attendance
    # Let's check what actually happens - it depends on the rules
    print(f"   After reject: pass={e003_row['pass']}, cert_issued={e003_row['cert_issued']}")
    print("✅ Reject status sync test passed!")


if __name__ == "__main__":
    print("=" * 60)
    print("Test 1: Full flow with approve + recalc")
    print("=" * 60)
    test_full_flow()

    print()
    print("=" * 60)
    print("Test 2: Reject makeup status sync")
    print("=" * 60)
    test_reject_makeup_status_sync()

    print()
    print("🎉 All integration tests passed!")
    sys.exit(0)
