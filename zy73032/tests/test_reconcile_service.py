from __future__ import annotations

from fastapi.testclient import TestClient

from pet_training_reconcile.api import app
from pet_training_reconcile.database import connect, init_db
from pet_training_reconcile.service import (
    MedicalRecordInput,
    add_medical_record,
    bind_alias,
    confirm_schedule,
    export_detail_csv,
    import_schedules,
    list_anomalies,
    list_logs,
    summary,
    withdraw_schedule,
)


CSV_TEXT = """pet_name,course_name,course_date,duration_min,trainer
小黄,基础服从课,2026-06-01,60,阿岑
阿黑,社交课,2026-06-02,45,阿岑
黄黄,基础服从课,2026-06-03,60,阿岑
黑妞,唤回课,2026-06-04,30,阿岑
"""


def memory_conn():
    conn = connect(":memory:")
    init_db(conn)
    return conn


def test_import_isolates_unknown_alias_from_normal_summary():
    conn = memory_conn()
    result = import_schedules(conn, CSV_TEXT)

    assert len(result["imported"]) == 4
    assert result["anomalies"][0]["pet_name"] == "黑妞"
    assert summary(conn) == {
        "total_normal_schedules": 3,
        "pending": 3,
        "confirmed": 0,
        "withdrawn": 0,
        "anomalies": 1,
    }


def test_confirm_withdraw_and_logs_keep_before_after_state():
    conn = memory_conn()
    imported = import_schedules(conn, CSV_TEXT)["imported"]
    schedule_id = imported[0]["id"]

    confirmed = confirm_schedule(conn, schedule_id, operator="小乔", remark="正常记录样例")
    withdrawn = withdraw_schedule(conn, schedule_id, operator="接班同事", remark="公示前撤回复核")
    logs = list_logs(conn)

    assert confirmed["status"] == "confirmed"
    assert withdrawn["status"] == "withdrawn"
    assert logs[0]["action"] == "withdraw"
    assert logs[0]["before_state"]["status"] == "confirmed"
    assert logs[0]["after_state"]["status"] == "withdrawn"
    assert logs[1]["action"] == "confirm"


def test_medical_record_links_to_schedule_and_unknown_alias_has_impact():
    conn = memory_conn()
    import_schedules(conn, CSV_TEXT)

    linked = add_medical_record(
        conn,
        MedicalRecordInput(
            pet_name="黄黄",
            visit_date="2026-06-03",
            diagnosis="皮肤检查",
            treatment="训练强度正常",
            veterinarian="小温",
        ),
    )
    unknown = add_medical_record(
        conn,
        MedicalRecordInput(
            pet_name="黑妞",
            visit_date="2026-06-04",
            diagnosis="疫苗接种",
            treatment="需确认是否与阿黑同宠",
            veterinarian="小温",
        ),
    )

    anomalies = list_anomalies(conn)
    assert linked["status"] == "linked"
    assert unknown["status"] == "needs_review"
    assert any(item["kind"] == "medical_record" and item["record"]["pet_name"] == "黑妞" for item in anomalies)


def test_bind_alias_moves_conflict_back_to_pending_and_exports_csv_detail():
    conn = memory_conn()
    import_schedules(conn, CSV_TEXT)
    before = summary(conn)

    bind_alias(conn, "黑妞", "阿黑")
    after = summary(conn)
    csv_text = export_detail_csv(conn)

    assert before["anomalies"] == 1
    assert after["anomalies"] == 0
    assert "黑妞" in csv_text
    assert "source_label" in csv_text
    assert "anomaly_reason" in csv_text


def test_api_smoke_uses_same_sqlite_flow():
    client = TestClient(app)
    response = client.post("/imports/schedules", json={"csv_text": CSV_TEXT, "label": "api.csv"})
    assert response.status_code == 200
    assert response.json()["anomalies"][0]["pet_name"] == "黑妞"

    schedules = client.get("/schedules").json()["items"]
    normal_id = next(item["id"] for item in schedules if item["pet_name"] == "小黄")
    confirm = client.post(f"/schedules/{normal_id}/confirm", json={"operator": "小乔", "remark": "API确认"})
    assert confirm.status_code == 200
    assert confirm.json()["status"] == "confirmed"

