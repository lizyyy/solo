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
    get_schedule_detail,
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
    assert withdrawn["status"] == "pending"
    assert logs[0]["action"] == "withdraw"
    assert logs[0]["before_state"]["status"] == "confirmed"
    assert logs[0]["after_state"]["status"] == "pending"
    assert logs[1]["action"] == "confirm"

def test_withdraw_restores_pending_and_allows_reconfirm():
    conn = memory_conn()
    imported = import_schedules(conn, CSV_TEXT)["imported"]
    schedule_id = imported[1]["id"]

    stats_before = summary(conn)
    confirmed = confirm_schedule(conn, schedule_id, operator="小乔", remark="第一轮确认")
    stats_confirmed = summary(conn)
    assert confirmed["status"] == "confirmed"
    assert stats_confirmed["confirmed"] == stats_before["confirmed"] + 1
    assert stats_confirmed["pending"] == stats_before["pending"] - 1

    withdrawn = withdraw_schedule(conn, schedule_id, operator="接班同事", remark="再看一眼")
    stats_withdrawn = summary(conn)
    assert withdrawn["status"] == "pending"
    assert withdrawn["confirmed_by"] == ""
    assert withdrawn["confirmed_at"] is None
    assert stats_withdrawn["pending"] == stats_before["pending"]
    assert stats_withdrawn["confirmed"] == stats_before["confirmed"]

    reconfirmed = confirm_schedule(conn, schedule_id, operator="小乔", remark="第二轮确认")
    stats_reconfirmed = summary(conn)
    assert reconfirmed["status"] == "confirmed"
    assert stats_reconfirmed["confirmed"] == stats_before["confirmed"] + 1

    logs = list_logs(conn)
    assert len([l for l in logs if l["action"] == "confirm"]) == 2
    assert len([l for l in logs if l["action"] == "withdraw"]) == 1


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


def test_schedule_detail_returns_linked_medical_records_and_source():
    conn = memory_conn()
    imported = import_schedules(conn, CSV_TEXT, "测试导入.csv")
    schedule_id = imported["imported"][2]["id"]

    add_medical_record(
        conn,
        MedicalRecordInput(
            pet_name="黄黄",
            visit_date="2026-06-03",
            diagnosis="皮肤检查",
            treatment="训练强度正常",
            veterinarian="小温",
            source_row="medical:1",
        ),
    )

    detail = get_schedule_detail(conn, schedule_id)
    assert detail["schedule"]["id"] == schedule_id
    assert detail["source"]["label"] == "测试导入.csv"
    assert detail["source"]["source_type"] == "csv"
    assert len(detail["medical_records"]) >= 1
    mr = detail["medical_records"][0]
    assert mr["pet_name"] == "黄黄"
    assert mr["diagnosis"] == "皮肤检查"
    assert "source_label" in mr
    assert "imported_at" in mr


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
    assert "pending" in csv_text
    assert "confirmed" in csv_text or "anomaly" in csv_text


def test_csv_export_includes_all_statuses():
    conn = memory_conn()
    imported = import_schedules(conn, CSV_TEXT, "all-status.csv")["imported"]
    confirm_schedule(conn, imported[0]["id"], "小乔", "样例确认")
    withdraw_schedule(conn, imported[0]["id"], "小乔", "样例撤回")
    csv_text = export_detail_csv(conn)

    assert "schedule_id" in csv_text
    assert "pet_name" in csv_text
    assert "anomaly" in csv_text
    assert "pending" in csv_text
    lines = csv_text.strip().splitlines()
    assert len(lines) == 5


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

    withdraw = client.post(f"/schedules/{normal_id}/withdraw", json={"operator": "小乔", "remark": "API撤回"})
    assert withdraw.status_code == 200
    assert withdraw.json()["status"] == "pending"

    detail = client.get(f"/schedules/{normal_id}").json()
    assert detail["schedule"]["id"] == normal_id
    assert "source" in detail
    assert "medical_records" in detail

    reconfirm = client.post(f"/schedules/{normal_id}/confirm", json={"operator": "小乔", "remark": "再确认"})
    assert reconfirm.status_code == 200
    assert reconfirm.json()["status"] == "confirmed"

    csv_resp = client.get("/exports/schedules.csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    body = csv_resp.text
    assert "schedule_id" in body
    assert "pet_name" in body
