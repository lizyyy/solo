import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from main import app
from storage import storage

client = TestClient(app)


def clear_storage():
    storage._materials.clear()
    storage._batch_index.clear()


def test_health_check():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_submit_normal_material():
    clear_storage()
    payload = {
        "batch_no": "BATCH001",
        "patient_name": "张三",
        "phone": "13812345678",
        "age": 65,
        "gender": "男",
        "diagnosis": "高血压",
        "drugs": ["硝苯地平", "阿司匹林"],
        "follow_up_type": "post_purchase",
        "pharmacy_name": "阳光大药房",
        "clerk_id": "CLERK001",
        "clerk_name": "李药师",
        "remark": "首次购药"
    }
    resp = client.post("/api/materials/submit", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_duplicate"] is False
    assert data["category"] == "normal"
    assert data["phone_masked"] == "138****5678"
    assert data["follow_up_type"] == "post_purchase"
    assert data["status"] == "processed"


def test_submit_pending_supplement_material():
    clear_storage()
    payload = {
        "batch_no": "BATCH002",
        "patient_name": "李四",
        "phone": "13987654321",
        "age": 70,
        "gender": "女",
        "diagnosis": "",
        "drugs": ["二甲双胍"],
        "follow_up_type": "return_visit",
        "pharmacy_name": "康美药店",
        "clerk_id": "CLERK002",
        "clerk_name": "王药师"
    }
    resp = client.post("/api/materials/submit", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] == "pending_supplement"
    assert "缺少必填字段" in data["category_result"]["reason"]


def test_submit_contraindication_blocked():
    clear_storage()
    payload = {
        "batch_no": "BATCH003",
        "patient_name": "王五",
        "phone": "13755556666",
        "age": 72,
        "gender": "男",
        "diagnosis": "冠心病",
        "drugs": ["硝酸甘油", "西地那非"],
        "follow_up_type": "contraindication_block",
        "pharmacy_name": "仁爱药房",
        "clerk_id": "CLERK003",
        "clerk_name": "赵药师"
    }
    resp = client.post("/api/materials/submit", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] == "blocked"
    assert "配伍禁忌" in data["category_result"]["reason"]


def test_duplicate_submission():
    clear_storage()
    payload = {
        "batch_no": "BATCH004",
        "patient_name": "赵六",
        "phone": "13611112222",
        "age": 58,
        "gender": "女",
        "diagnosis": "糖尿病",
        "drugs": ["二甲双胍"],
        "follow_up_type": "post_purchase",
        "pharmacy_name": "健康药店",
        "clerk_id": "CLERK001",
        "clerk_name": "李药师"
    }
    resp1 = client.post("/api/materials/submit", json=payload)
    assert resp1.json()["is_duplicate"] is False

    resp2 = client.post("/api/materials/submit", json=payload)
    assert resp2.json()["is_duplicate"] is True
    assert resp2.json()["material_id"] == resp1.json()["material_id"]


def test_modify_category():
    clear_storage()
    payload = {
        "batch_no": "BATCH005",
        "patient_name": "钱七",
        "phone": "13533334444",
        "age": 60,
        "gender": "男",
        "diagnosis": "高血脂",
        "drugs": ["阿托伐他汀"],
        "follow_up_type": "post_purchase",
        "pharmacy_name": "益寿堂",
        "clerk_id": "CLERK004",
        "clerk_name": "孙药师"
    }
    submit_resp = client.post("/api/materials/submit", json=payload)
    material_id = submit_resp.json()["material_id"]

    modify_payload = {
        "new_category": "pending_supplement",
        "new_reason": "需要补充近期血糖检测报告",
        "suggested_action": "联系患者补充血糖报告",
        "modification_reason": "发现患者糖尿病史未记录完整",
        "operator_id": "MANAGER001",
        "operator_name": "张经理"
    }
    resp = client.put(f"/api/materials/{material_id}/category", json=modify_payload)
    assert resp.status_code == 200
    assert "log_id" in resp.json()


def test_modification_history():
    clear_storage()
    payload = {
        "batch_no": "BATCH006",
        "patient_name": "孙八",
        "phone": "13466667777",
        "age": 68,
        "gender": "女",
        "diagnosis": "高血压",
        "drugs": ["缬沙坦"],
        "follow_up_type": "return_visit",
        "pharmacy_name": "同仁堂",
        "clerk_id": "CLERK005",
        "clerk_name": "周药师"
    }
    submit_resp = client.post("/api/materials/submit", json=payload)
    material_id = submit_resp.json()["material_id"]

    modify_payload = {
        "new_category": "blocked",
        "new_reason": "患者血压波动过大，需要重新评估",
        "new_follow_up_type": "contraindication_block",
        "suggested_action": "立即联系主治医师",
        "modification_reason": "收到医生反馈",
        "operator_id": "DOCTOR001",
        "operator_name": "陈医生"
    }
    client.put(f"/api/materials/{material_id}/category", json=modify_payload)

    history_resp = client.get(f"/api/materials/{material_id}/modifications")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert history["modification_count"] == 1
    log = history["modifications"][0]
    assert log["old_category"] == "normal"
    assert log["new_category"] == "blocked"
    assert log["modified_by"] == "陈医生(ID:DOCTOR001)"


def test_material_detail_with_trail():
    clear_storage()
    payload = {
        "batch_no": "BATCH007",
        "patient_name": "周九",
        "phone": "13388889999",
        "age": 55,
        "gender": "男",
        "diagnosis": "高血压合并糖尿病",
        "drugs": ["氨氯地平", "二甲双胍"],
        "follow_up_type": "post_purchase",
        "pharmacy_name": "华康大药房",
        "clerk_id": "CLERK006",
        "clerk_name": "吴药师"
    }
    submit_resp = client.post("/api/materials/submit", json=payload)
    material_id = submit_resp.json()["material_id"]

    detail_resp = client.get(f"/api/materials/{material_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert "field_trail" in detail
    assert detail["field_trail"]["diagnosis"] == "高血压合并糖尿病"
    assert detail["field_trail"]["drugs"] == ["氨氯地平", "二甲双胍"]


def test_query_materials():
    clear_storage()
    for i in range(5):
        payload = {
            "batch_no": f"BATCH_Q{i}",
            "patient_name": f"患者{i}",
            "phone": f"1380000000{i}",
            "age": 60 + i,
            "gender": "男" if i % 2 == 0 else "女",
            "diagnosis": "高血压",
            "drugs": ["硝苯地平"],
            "follow_up_type": "post_purchase",
            "pharmacy_name": "测试药店",
            "clerk_id": "CLERK_TEST",
            "clerk_name": "测试药师"
        }
        client.post("/api/materials/submit", json=payload)

    query_payload = {
        "page": 1,
        "page_size": 3
    }
    resp = client.post("/api/materials/query", json=query_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 3
    assert data["page"] == 1


def test_phone_masked_in_response():
    clear_storage()
    payload = {
        "batch_no": "BATCH_MASK",
        "patient_name": "测试用户",
        "phone": "13999998888",
        "age": 50,
        "gender": "男",
        "diagnosis": "高血压",
        "drugs": ["卡托普利"],
        "follow_up_type": "return_visit",
        "pharmacy_name": "测试药房",
        "clerk_id": "CLERK001",
        "clerk_name": "测试药师"
    }
    resp = client.post("/api/materials/submit", json=payload)
    data = resp.json()
    assert data["phone_masked"] == "139****8888"
    assert "phone" not in data or data.get("phone") == data["phone_masked"]


def test_invalid_phone():
    clear_storage()
    payload = {
        "batch_no": "BATCH_INVALID",
        "patient_name": "测试用户",
        "phone": "12345",
        "age": 50,
        "gender": "男",
        "diagnosis": "高血压",
        "drugs": ["卡托普利"],
        "follow_up_type": "return_visit",
        "pharmacy_name": "测试药房",
        "clerk_id": "CLERK001",
        "clerk_name": "测试药师"
    }
    resp = client.post("/api/materials/submit", json=payload)
    assert resp.status_code == 422


def test_export_excel():
    clear_storage()
    payload = {
        "batch_no": "BATCH_EXPORT",
        "patient_name": "导出测试",
        "phone": "13777776666",
        "age": 62,
        "gender": "女",
        "diagnosis": "高血压",
        "drugs": ["苯磺酸氨氯地平"],
        "follow_up_type": "post_purchase",
        "pharmacy_name": "出口药店",
        "clerk_id": "CLERK007",
        "clerk_name": "郑药师"
    }
    client.post("/api/materials/submit", json=payload)

    resp = client.get("/api/materials/export/excel")
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert ".xlsx" in resp.headers["content-disposition"]


def test_summary_stats():
    clear_storage()
    for i in range(3):
        payload = {
            "batch_no": f"BATCH_S{i}",
            "patient_name": f"统计患者{i}",
            "phone": f"1360000000{i}",
            "age": 55 + i,
            "gender": "男",
            "diagnosis": "高血压",
            "drugs": ["缬沙坦"],
            "follow_up_type": "post_purchase",
            "pharmacy_name": "统计药店",
            "clerk_id": "CLERK_STAT",
            "clerk_name": "统计药师"
        }
        client.post("/api/materials/submit", json=payload)

    resp = client.get("/api/stats/summary")
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["total"] == 3
