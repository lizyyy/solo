from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app

client = TestClient(app)


def create_test_item(submitted_by="客服测试员", index=0):
    response = client.post(
        "/api/lost-items/submit",
        json={
            "item_type": f"物品_{index}",
            "description": f"测试物品描述_{index}",
            "lost_location": f"测试地点_{index}",
            "lost_time": datetime.now().isoformat(),
            "bus_route": f"线路_{index}",
            "bus_number": f"车号_{index}",
            "contact_name": f"失主_{index}",
            "contact_phone": f"1380000000{index}",
            "submitted_by": submitted_by
        }
    )
    assert response.status_code == 200
    return response.json()["id"]


def test_submit_lost_item():
    response = client.post(
        "/api/lost-items/submit",
        json={
            "item_type": "钱包",
            "description": "黑色皮质钱包，内有身份证和银行卡",
            "lost_location": "1号线天安门西站",
            "lost_time": "2024-01-15T08:30:00",
            "bus_route": "1号线",
            "bus_number": "京A12345",
            "contact_name": "张三",
            "contact_phone": "13800138000",
            "submitted_by": "客服小王"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["item_type"] == "钱包"
    assert data["is_duplicate"] is False


def test_duplicate_submit():
    payload = {
        "item_type": "手机",
        "description": "iPhone 15 Pro，蓝色",
        "lost_location": "2号线西单站",
        "lost_time": "2024-01-16T14:20:00",
        "bus_route": "2号线",
        "bus_number": "京B67890",
        "contact_name": "李四",
        "contact_phone": "13900139000",
        "submitted_by": "客服小李"
    }

    response1 = client.post("/api/lost-items/submit", json=payload)
    assert response1.status_code == 200
    assert response1.json()["is_duplicate"] is False

    response2 = client.post("/api/lost-items/submit", json=payload)
    assert response2.status_code == 200
    assert response2.json()["is_duplicate"] is True
    assert response1.json()["id"] == response2.json()["id"]


def test_update_conclusion():
    item_id = create_test_item("客服修改", 1)

    response = client.put(
        f"/api/lost-items/{item_id}/conclusion",
        json={
            "status": "completed",
            "match_result": {"status": "matched", "matching_score": 85},
            "final_report": {"found": True, "returned": True, "returned_to": "张三"},
            "change_reason": "物品已找到并归还失主",
            "changed_by": "客服主管"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"


def test_get_audit_logs():
    item_id = create_test_item("客服审计", 2)

    client.put(
        f"/api/lost-items/{item_id}/conclusion",
        json={
            "status": "completed",
            "change_reason": "物品已找到",
            "changed_by": "客服小王"
        }
    )

    response = client.get(f"/api/lost-items/{item_id}/audit-logs")
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) >= 1
    assert logs[0]["field_changed"] == "status"
    assert logs[0]["change_reason"] == "物品已找到"


def test_traceability():
    item_id = create_test_item("客服追溯", 3)

    client.put(
        f"/api/lost-items/{item_id}/conclusion",
        json={
            "status": "completed",
            "final_report": {"found": True},
            "change_reason": "失物已认领",
            "changed_by": "客服小李"
        }
    )

    response = client.get(f"/api/lost-items/{item_id}/trace")
    assert response.status_code == 200
    data = response.json()
    assert data["lost_item_id"] == item_id
    assert "original_input" in data
    assert "processing_history" in data
    assert len(data["processing_history"]) >= 2
    assert len(data["audit_trail"]) >= 1


def test_batch_submit():
    response = client.post(
        "/api/lost-items/batch-submit",
        json={
            "items": [
                {
                    "item_type": "钥匙",
                    "description": "一串家门钥匙，有蓝色钥匙扣",
                    "lost_location": "3号线北京站",
                    "lost_time": "2024-01-17T09:00:00",
                    "bus_route": "3号线",
                    "bus_number": "京C11111",
                    "contact_name": "王五",
                    "contact_phone": "13700137000",
                    "submitted_by": "客服小张"
                },
                {
                    "item_type": "书包",
                    "description": "黑色双肩包，内有课本",
                    "lost_location": "4号线海淀黄庄站",
                    "lost_time": "2024-01-17T17:30:00",
                    "bus_route": "4号线",
                    "bus_number": "京D22222",
                    "contact_name": "赵六",
                    "contact_phone": "13600136000",
                    "submitted_by": "客服小张"
                }
            ],
            "submitted_by": "客服小张"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] + data["duplicate_count"] == 2
    assert len(data["results"]) == 2


def test_list_and_get_lost_items():
    item_id = create_test_item("客服查询", 4)

    response = client.get("/api/lost-items/")
    assert response.status_code == 200
    assert len(response.json()) >= 1

    response = client.get(f"/api/lost-items/{item_id}")
    assert response.status_code == 200
    assert response.json()["id"] == item_id


if __name__ == "__main__":
    print("运行API测试...")
    
    print("\n1. 测试提交失物记录...")
    test_submit_lost_item()
    print("✓ 提交失物记录测试通过")
    
    print("\n2. 测试重复提交识别...")
    test_duplicate_submit()
    print("✓ 重复提交识别测试通过")
    
    print("\n3. 测试修改结论...")
    test_update_conclusion()
    print("✓ 修改结论测试通过")
    
    print("\n4. 测试审计日志...")
    test_get_audit_logs()
    print("✓ 审计日志测试通过")
    
    print("\n5. 测试数据追溯...")
    test_traceability()
    print("✓ 数据追溯测试通过")
    
    print("\n6. 测试批量提交...")
    test_batch_submit()
    print("✓ 批量提交测试通过")
    
    print("\n7. 测试查询列表和详情...")
    test_list_and_get_lost_items()
    print("✓ 查询列表和详情测试通过")
    
    print("\n" + "="*50)
    print("所有测试通过！")
    print("="*50)
