from datetime import datetime, timedelta
import pytest


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data


def test_create_customer_demand(client):
    response = client.post(
        "/customer-demands/",
        json={
            "customer_name": "测试客户",
            "customer_phone": "13800000000",
            "address": "测试地址",
            "service_type": "住家保姆",
            "required_skills": "做饭,打扫",
            "salary_expectation": 6000.0,
            "work_time": "住家",
            "remarks": "测试备注"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["customer_name"] == "测试客户"
    assert "id" in data


def test_list_customer_demands(client):
    for i in range(3):
        client.post(
            "/customer-demands/",
            json={
                "customer_name": f"客户{i}",
                "customer_phone": f"1380000000{i}",
                "address": f"地址{i}"
            }
        )
    
    response = client.get("/customer-demands/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3


def test_get_customer_demand(client):
    create_response = client.post(
        "/customer-demands/",
        json={
            "customer_name": "查询测试客户",
            "customer_phone": "13800000099",
            "address": "查询地址"
        }
    )
    demand_id = create_response.json()["id"]
    
    response = client.get(f"/customer-demands/{demand_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["customer_name"] == "查询测试客户"


def test_update_customer_demand(client):
    create_response = client.post(
        "/customer-demands/",
        json={
            "customer_name": "更新测试客户",
            "customer_phone": "13800000088",
            "address": "原地址"
        }
    )
    demand_id = create_response.json()["id"]
    
    response = client.put(
        f"/customer-demands/{demand_id}",
        json={
            "address": "新地址",
            "salary_expectation": 7000.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["address"] == "新地址"
    assert data["salary_expectation"] == 7000.0


def test_close_customer_demand(client):
    create_response = client.post(
        "/customer-demands/",
        json={
            "customer_name": "关闭测试客户",
            "customer_phone": "13800000077"
        }
    )
    demand_id = create_response.json()["id"]
    
    response = client.post(
        f"/customer-demands/{demand_id}/close",
        json={
            "reason": "客户取消需求",
            "closed_by": "admin"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_closed"] == True
    assert data["closed_reason"] == "客户取消需求"


def test_create_aunt_profile(client):
    response = client.post(
        "/aunt-profiles/",
        json={
            "name": "测试阿姨",
            "phone": "13900000000",
            "id_card": "110101198001010001",
            "age": 44,
            "experience_years": 8,
            "skills": "做饭,打扫",
            "certificates": "健康证",
            "address": "阿姨地址",
            "remarks": "备注"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试阿姨"
    assert "id" in data


def test_list_aunt_profiles(client):
    for i in range(3):
        client.post(
            "/aunt-profiles/",
            json={
                "name": f"阿姨{i}",
                "phone": f"1390000000{i}",
                "id_card": f"11010119800101000{i}"
            }
        )
    
    response = client.get("/aunt-profiles/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3


def test_create_trial_schedule(client, test_data):
    base_date = datetime.now()
    response = client.post(
        "/trial-schedules/",
        json={
            "demand_id": test_data["demand"].id,
            "aunt_id": test_data["aunt"].id,
            "trial_start_time": (base_date + timedelta(days=5)).isoformat(),
            "trial_end_time": (base_date + timedelta(days=7)).isoformat(),
            "trial_address": "测试地址",
            "trial_fee": 300.0,
            "created_by": "admin",
            "remarks": "测试排期"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data


def test_schedule_conflict(client, test_data):
    base_date = datetime.now()
    conflict_start = test_data["schedule1"].trial_start_time + timedelta(hours=1)
    conflict_end = test_data["schedule1"].trial_end_time + timedelta(hours=1)
    
    response = client.post(
        "/trial-schedules/",
        json={
            "demand_id": test_data["demand"].id,
            "aunt_id": test_data["aunt"].id,
            "trial_start_time": conflict_start.isoformat(),
            "trial_end_time": conflict_end.isoformat(),
            "trial_address": "冲突地址",
            "trial_fee": 300.0,
            "created_by": "admin"
        }
    )
    assert response.status_code == 400
    assert "冲突" in response.json()["detail"]


def test_complete_trial_schedule(client, test_data):
    response = client.post(
        f"/trial-schedules/{test_data['schedule1'].id}/complete"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"


def test_cancel_trial_schedule(client, test_data):
    response = client.post(
        f"/trial-schedules/{test_data['schedule1'].id}/cancel",
        json={
            "reason": "客户取消",
            "cancelled_by": "admin"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_cancelled"] == True
    assert data["status"] == "cancelled"


def test_create_deposit(client, test_data):
    response = client.post(
        "/deposits/",
        json={
            "trial_schedule_id": test_data["schedule1"].id,
            "amount": 500.0,
            "payment_method": "微信",
            "transaction_id": "WXTEST001",
            "created_by": "admin",
            "remarks": "测试押金"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data


def test_pay_deposit(client, test_data):
    deposit_response = client.post(
        "/deposits/",
        json={
            "trial_schedule_id": test_data["schedule1"].id,
            "amount": 500.0,
            "created_by": "admin"
        }
    )
    deposit_id = deposit_response.json()["id"]
    
    response = client.post(f"/deposits/{deposit_id}/pay")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paid"


def test_refund_deposit(client, test_data):
    response = client.post(
        f"/deposits/{test_data['deposit'].id}/refund?reason=测试退款&operator=admin"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "refunded"


def test_create_review(client, test_data):
    response = client.post(
        "/reviews/",
        json={
            "trial_schedule_id": test_data["schedule2"].id,
            "reviewer": "测试客户",
            "overall_rating": 5,
            "skill_rating": 5,
            "attitude_rating": 5,
            "punctuality_rating": 4,
            "hygiene_rating": 5,
            "communication_rating": 5,
            "comment": "很好",
            "suggestion": "继续保持"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data


def test_review_cannot_submit_for_unscheduled(client, test_data):
    response = client.post(
        "/reviews/",
        json={
            "trial_schedule_id": test_data["schedule1"].id,
            "reviewer": "测试客户",
            "overall_rating": 5,
            "skill_rating": 5,
            "attitude_rating": 5,
            "punctuality_rating": 5,
            "hygiene_rating": 5,
            "communication_rating": 5
        }
    )
    assert response.status_code == 400
    assert "未完成" in response.json()["detail"]


def test_check_conversion_eligibility(client, test_data):
    response = client.post(
        f"/conversions/check-eligibility?trial_schedule_id={test_data['schedule2'].id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert "eligible" in data
    assert "message" in data


def test_create_conversion(client, test_data):
    response = client.post(
        "/conversions/",
        json={
            "trial_schedule_id": test_data["schedule2"].id,
            "contract_salary": 8000.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data


def test_conversion_decision(client, test_data):
    conversion_response = client.post(
        "/conversions/",
        json={
            "trial_schedule_id": test_data["schedule2"].id
        }
    )
    conversion_id = conversion_response.json()["id"]
    
    response = client.post(
        f"/conversions/{conversion_id}/decision",
        json={
            "status": "converted",
            "decided_by": "经理",
            "conclusion": "同意转正",
            "contract_salary": 8500.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "converted"


def test_withdraw_conversion(client, test_data):
    conversion_response = client.post(
        "/conversions/",
        json={
            "trial_schedule_id": test_data["schedule2"].id
        }
    )
    conversion_id = conversion_response.json()["id"]
    
    response = client.post(
        f"/conversions/{conversion_id}/withdraw",
        json={
            "reason": "客户反悔",
            "withdrawn_by": "admin"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_withdrawn"] == True


def test_manual_correction(client, test_data):
    response = client.post(
        "/manual-correction/",
        json={
            "entity_type": "customer_demand",
            "entity_id": test_data["demand"].id,
            "corrected_data": {
                "salary_expectation": 7500.0,
                "remarks": "人工修正后"
            },
            "corrected_by": "管理员",
            "correction_reason": "客户要求调整薪资"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "人工修正成功"


def test_audit_logs(client, test_data):
    client.post(
        "/manual-correction/",
        json={
            "entity_type": "aunt_profile",
            "entity_id": test_data["aunt"].id,
            "corrected_data": {
                "experience_years": 10
            },
            "corrected_by": "管理员",
            "correction_reason": "经验更新"
        }
    )
    
    response = client.get("/audit-logs/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0


def test_export_trial_schedules(client, test_data):
    response = client.get("/export/trial-schedules/")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"


def test_export_conversions(client, test_data):
    client.post(
        "/conversions/",
        json={
            "trial_schedule_id": test_data["schedule2"].id
        }
    )
    
    response = client.get("/export/conversions/")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
