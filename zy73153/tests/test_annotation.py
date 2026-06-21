from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import RecordStatus, SensorStatus
from app.store import store


@pytest.fixture
def client() -> TestClient:
    store.annotations.clear()
    store.seen_sample_ids.clear()
    return TestClient(app)


def test_root_page_smoke(client: TestClient) -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    assert "海洋牧场空间标注" in resp.text


def test_info_endpoint_returns_commands(client: TestClient) -> None:
    resp = client.get("/api/info")
    data = resp.json()
    assert data["name"] == "海洋牧场空间标注系统"
    assert any("uvicorn" in cmd for cmd in data["available_commands"])
    assert any("run-main-flow" in ep["path"] for ep in data["endpoints"])


def test_main_flow_contains_late_attachment(client: TestClient) -> None:
    resp = client.get("/api/run-main-flow")
    assert resp.status_code == 200
    data = resp.json()
    statuses = [a["status"] for a in data["annotations"]]
    assert RecordStatus.LATE_ATTACHMENT.value in statuses, "主流程应包含附件晚到的异常分支"

    late = [a for a in data["annotations"] if a["status"] == RecordStatus.LATE_ATTACHMENT.value]
    assert len(late) >= 1
    ann = late[0]
    assert any("附件" in a for a in ann["alerts"])
    assert "等待" in ann["handler_hint"]


def test_main_flow_contains_time_mismatch(client: TestClient) -> None:
    resp = client.get("/api/run-main-flow")
    data = resp.json()
    statuses = [a["status"] for a in data["annotations"]]
    assert RecordStatus.TIME_MISMATCH.value in statuses, "采样时间与实验结果对不上的分支要走通"


def test_main_flow_contains_sensor_drift_with_contact(client: TestClient) -> None:
    resp = client.get("/api/run-main-flow")
    data = resp.json()
    drift = [a for a in data["annotations"] if a["status"] == RecordStatus.SENSOR_DRIFT.value]
    assert len(drift) >= 1
    ann = drift[0]
    alert_text = " ".join(ann["alerts"])
    assert "李工" in alert_text or "传感器运维" in alert_text, "漂移提醒要写清找谁确认"
    assert "/api/sensors/" in alert_text, "漂移提醒要给出先看哪条来源"


def test_calculation_trail_exposes_formula_unit_boundary(client: TestClient) -> None:
    resp = client.get("/api/run-main-flow")
    ann = resp.json()["annotations"][0]
    trail = ann["calculation_trail"]
    assert "final_result" in trail
    assert "final_unit" in trail
    assert len(trail["formula_steps"]) >= 3
    step = trail["formula_steps"][0]
    assert "formula" in step and step["formula"]
    assert "unit" in step and step["unit"]
    assert "description" in step and step["description"]
    assert "boundary_values" in trail and len(trail["boundary_values"]) >= 2
    zone_step = [s for s in trail["formula_steps"] if "分区" in s["description"]][0]
    assert zone_step["boundary_check"] is not None, "边界值要摆在明处"


def test_duplicate_import_prevents_double_and_preserves_remark(client: TestClient) -> None:
    resp1 = client.post("/api/annotations/run/SP-20260615-001")
    assert resp1.status_code == 200
    first_id = resp1.json()["annotation_id"]

    client.patch(
        "/api/lab-results/LB-20260615-001/remark",
        json={"remark": "小宋人工备注：已现场复核水温", "operator_id": "S001"},
    )
    lab_before = client.get("/api/lab-results").json()
    remark_before = [x["remark"] for x in lab_before if x["lab_result_id"] == "LB-20260615-001"][0]
    assert remark_before == "小宋人工备注：已现场复核水温"

    resp2 = client.post("/api/annotations/run/SP-20260615-001")
    assert resp2.status_code == 200
    second_ann = resp2.json()
    assert second_ann["status"] == RecordStatus.DUPLICATE.value
    assert second_ann["annotation_id"] == first_id, "重复导入不应生成新记录"
    assert any("重复导入" in a and "未覆盖" in a for a in second_ann["alerts"])

    lab_after = client.get("/api/lab-results").json()
    remark_after = [x["remark"] for x in lab_after if x["lab_result_id"] == "LB-20260615-001"][0]
    assert remark_after == remark_before, "人工备注不应被重复导入覆盖"

    ann_count = len(client.get("/api/annotations").json())
    resp3 = client.post("/api/annotations/run/SP-20260615-001")
    assert resp3.status_code == 200
    assert len(client.get("/api/annotations").json()) == ann_count, "记录不应翻倍"


def test_pending_records_for_scheduler_view(client: TestClient) -> None:
    client.get("/api/run-main-flow")
    resp = client.get("/api/pending")
    assert resp.status_code == 200
    pending = resp.json()
    assert len(pending) >= 3

    pending_sample_ids = {p["sample_id"] for p in pending}
    assert "SP-20260615-001" not in pending_sample_ids, "已正常完成标注的记录不应进入待处理列表"

    allowed = {
        RecordStatus.LATE_ATTACHMENT.value,
        RecordStatus.TIME_MISMATCH.value,
        RecordStatus.SENSOR_DRIFT.value,
    }
    for p in pending:
        assert p["annotation_id"]
        assert p["sample_id"]
        assert p["status"] in allowed, "只有需人工确认的异常才进入待处理"
        assert p["summary"]
        assert "卡住原因" in p["summary"], "待处理要说明为什么卡住"
        assert p["action_needed"], "排班同事要看到讲明白的待处理动作"
        assert p["contact_person"], "联系人不能空"
        assert p["check_first_source"], "先查来源不能空"

    drift_pending = [p for p in pending if p["status"] == RecordStatus.SENSOR_DRIFT.value]
    assert len(drift_pending) >= 1
    assert "/api/sensors/SN-B2/history" in drift_pending[0]["check_first_source"]
    assert "李工" in drift_pending[0]["contact_person"], "漂移待办联系人要写明李工"


def test_drift_history_endpoint_walks_full_chain(client: TestClient) -> None:
    client.get("/api/run-main-flow")
    pending = client.get("/api/pending").json()
    drift = [p for p in pending if p["status"] == RecordStatus.SENSOR_DRIFT.value][0]

    source = drift["check_first_source"]
    path = source.split("http://127.0.0.1:8000")[-1]
    if not path.startswith("/api/sensors/"):
        path = path  # already a path

    hist_resp = client.get(path)
    assert hist_resp.status_code == 200, f"漂移核对入口不应 404: {path}"
    payload = hist_resp.json()
    assert payload["sensor_id"] == "SN-B2"
    assert payload["status"] in (
        SensorStatus.DRIFT_SUSPECTED.value,
        SensorStatus.DRIFT_CONFIRMED.value,
    )
    assert len(payload["history_readings"]) >= 2, "要给出历史读数作为证据"
    assert any(r["source"] == "实验室复核" for r in payload["history_readings"]), "要含实验室比对值"

    evidence = payload["drift_evidence"]
    assert evidence is not None
    assert evidence["threshold_pct"] >= 0
    assert "偏差率" in evidence["basis"], "判断依据要写明偏差率计算"
    assert evidence["conclusion"], "要给出结论是否漂移"
    assert evidence["days_since_calibration"] > 30, "SN-B2 上次校准距今应较久"

    contact = payload["suggested_contact"]
    assert contact and contact["name"] == "李工", "历史接口要给出建议联系人李工"
    assert payload["suggested_first_check_source"].endswith("/history")


def test_sensor_history_endpoint_404_for_unknown(client: TestClient) -> None:
    resp = client.get("/api/sensors/SN-NOT-EXIST/history")
    assert resp.status_code == 404


def test_sensor_status_seeded_correctly() -> None:
    assert store.sensors["SN-B2"].status in (SensorStatus.DRIFT_SUSPECTED, SensorStatus.DRIFT_CONFIRMED)
    assert store.lab_results["LB-20260615-003"].attachment_arrived is False
