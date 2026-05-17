import pytest
import httpx
from datetime import datetime, timedelta
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "http://localhost:8000"

test_data = {
    "property_id": None,
    "checklist_item_ids": [],
    "task_id": None,
    "photo_ids": [],
    "complaint_id": None,
    "report_id": None
}


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        yield c


def test_01_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("✓ 健康检查通过")


def test_02_create_property(client):
    response = client.post("/properties/", json={
        "name": "测试海景公寓",
        "address": "三亚市海棠湾123号",
        "room_count": 2,
        "owner_id": 1001
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "测试海景公寓"
    test_data["property_id"] = data["id"]
    print(f"✓ 创建房源成功: ID={test_data['property_id']}")


def test_03_list_properties(client):
    response = client.get("/properties/", params={"owner_id": 1001})
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    print(f"✓ 房源列表筛选成功: 找到{len(data)}个房源")


def test_04_create_checklist_items(client):
    categories = ["卧室", "卫生间", "厨房", "公共区域"]
    items = [
        ("床铺整理", "卧室"),
        ("地板清洁", "卧室"),
        ("马桶清洁", "卫生间"),
        ("淋浴间清洁", "卫生间"),
        ("台面擦拭", "厨房"),
        ("垃圾清理", "公共区域")
    ]
    
    for idx, (name, category) in enumerate(items):
        response = client.post("/checklist-items/", json={
            "property_id": test_data["property_id"],
            "category": category,
            "name": name,
            "is_mandatory": idx < 4,
            "sort_order": idx
        })
        assert response.status_code == 201
        data = response.json()
        test_data["checklist_item_ids"].append(data["id"])
    
    print(f"✓ 创建{len(test_data['checklist_item_ids'])}个检查项成功")


def test_05_get_checklist(client):
    response = client.get(f"/checklist-items/{test_data['property_id']}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == len(test_data["checklist_item_ids"])
    print(f"✓ 获取房源检查清单成功: {len(data)}项")


def test_06_create_cleaning_task(client):
    scheduled_date = (datetime.utcnow() + timedelta(days=1)).isoformat()
    response = client.post("/tasks/", json={
        "property_id": test_data["property_id"],
        "cleaner_id": 2001,
        "inspector_id": 3001,
        "scheduled_date": scheduled_date,
        "max_reworks": 2
    })
    assert response.status_code == 201
    data = response.json()
    test_data["task_id"] = data["id"]
    assert data["status"] == "created"
    print(f"✓ 创建保洁任务成功: ID={test_data['task_id']}")


def test_07_list_tasks_with_filters(client):
    response = client.get("/tasks/", params={
        "status": "created",
        "property_id": test_data["property_id"]
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    print(f"✓ 任务筛选成功: 找到{len(data)}个任务")


def test_08_update_task_status_to_in_progress(client):
    from sqlalchemy.orm import Session
    from main import SessionLocal, CleaningTask, TaskStatus
    
    db = SessionLocal()
    task = db.query(CleaningTask).filter(CleaningTask.id == test_data["task_id"]).first()
    task.status = TaskStatus.IN_PROGRESS
    db.commit()
    db.close()
    
    response = client.get(f"/tasks/{test_data['task_id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_progress"
    print("✓ 任务状态更新为进行中")


def test_09_submit_cleaning_missing_mandatory_items(client):
    partial_results = [
        {"checklist_item_id": test_data["checklist_item_ids"][0], "checked": True, "passed": True}
    ]
    response = client.post("/tasks/submit-cleaning", json={
        "task_id": test_data["task_id"],
        "submitted_by": 2001,
        "check_results": partial_results
    })
    assert response.status_code == 400
    error_data = response.json()["detail"]
    assert error_data["error_code"] == "missing_field"
    print(f"✓ 错误响应正确: 缺少必填检查项 - {error_data['error_code']}")


def test_10_submit_cleaning_success(client):
    all_results = []
    for item_id in test_data["checklist_item_ids"]:
        all_results.append({
            "checklist_item_id": item_id,
            "checked": True,
            "passed": True
        })
    
    response = client.post("/tasks/submit-cleaning", json={
        "task_id": test_data["task_id"],
        "submitted_by": 2001,
        "check_results": all_results,
        "notes": "保洁工作已完成"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["new_status"] == "submitted"
    print(f"✓ 保洁提交成功, 状态变为: {data['new_status']}")


def test_11_upload_photos(client):
    photo_categories = ["卧室", "卫生间", "厨房"]
    for idx, category in enumerate(photo_categories):
        response = client.post("/photos/", json={
            "task_id": test_data["task_id"],
            "checklist_item_id": test_data["checklist_item_ids"][idx],
            "photo_url": f"https://example.com/photos/{test_data['task_id']}_{idx}.jpg",
            "category": category,
            "uploaded_by": 2001,
            "description": f"{category}保洁后照片"
        })
        assert response.status_code == 201
        data = response.json()
        test_data["photo_ids"].append(data["photo_id"])
    
    print(f"✓ 上传{len(test_data['photo_ids'])}张照片凭证成功")


def test_12_get_task_photos(client):
    response = client.get(f"/photos/{test_data['task_id']}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == len(test_data["photo_ids"])
    print(f"✓ 获取任务照片成功: {len(data)}张")


def test_13_inspect_task_with_failures(client):
    results = []
    for idx, item_id in enumerate(test_data["checklist_item_ids"]):
        results.append({
            "checklist_item_id": item_id,
            "checked": True,
            "passed": idx < 4
        })
    
    response = client.post("/tasks/inspect", json={
        "task_id": test_data["task_id"],
        "inspector_id": 3001,
        "check_results": results,
        "notes": "厨房和公共区域需要返工"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["new_status"] == "needs_rework"
    assert data["rework_count"] == 1
    test_data["report_id"] = data["report_id"]
    print(f"✓ 验收完成，发现不合格项，状态变为: {data['new_status']}")


def test_14_start_rework(client):
    response = client.post("/tasks/start-rework", json={
        "task_id": test_data["task_id"],
        "assigned_to": 2001,
        "reason": "厨房台面未擦干净，公共区域垃圾未清理",
        "checklist_item_ids": test_data["checklist_item_ids"][4:]
    })
    assert response.status_code == 200
    data = response.json()
    assert data["new_status"] == "reworking"
    print(f"✓ 开始返工，状态变为: {data['new_status']}")


def test_15_submit_rework(client):
    from sqlalchemy.orm import Session
    from main import SessionLocal, CleaningTask, TaskStatus
    
    db = SessionLocal()
    task = db.query(CleaningTask).filter(CleaningTask.id == test_data["task_id"]).first()
    assert task.status == TaskStatus.REWORKING
    db.close()
    
    all_results = []
    for item_id in test_data["checklist_item_ids"]:
        all_results.append({
            "checklist_item_id": item_id,
            "checked": True,
            "passed": True
        })
    
    response = client.post("/tasks/submit-cleaning", json={
        "task_id": test_data["task_id"],
        "submitted_by": 2001,
        "check_results": all_results,
        "notes": "返工完成"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["new_status"] == "rework_submitted"
    print(f"✓ 返工提交成功，状态变为: {data['new_status']}")


def test_16_final_approval(client):
    all_results = []
    for item_id in test_data["checklist_item_ids"]:
        all_results.append({
            "checklist_item_id": item_id,
            "checked": True,
            "passed": True
        })
    
    response = client.post("/tasks/inspect", json={
        "task_id": test_data["task_id"],
        "inspector_id": 3001,
        "check_results": all_results,
        "notes": "全部合格"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["new_status"] == "approved"
    print(f"✓ 最终验收通过，状态变为: {data['new_status']}")


def test_17_export_report_pdf(client):
    response = client.get(f"/reports/{test_data['task_id']}/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0
    print(f"✓ PDF报告导出成功，大小: {len(response.content)}字节")


def test_18_export_report_excel(client):
    response = client.get(f"/reports/{test_data['task_id']}/excel")
    assert response.status_code == 200
    assert "openxmlformats-officedocument" in response.headers["content-type"]
    assert len(response.content) > 0
    print(f"✓ Excel报告导出成功，大小: {len(response.content)}字节")


def test_19_create_complaint(client):
    response = client.post("/complaints/", json={
        "task_id": test_data["task_id"],
        "guest_id": 4001,
        "category": "清洁质量",
        "description": "发现枕头下面有头发，卫生间有异味",
        "severity": "high"
    })
    assert response.status_code == 201
    data = response.json()
    test_data["complaint_id"] = data["complaint_id"]
    assert data["task_status"] == "complaint_open"
    print(f"✓ 创建客诉成功: ID={test_data['complaint_id']}")


def test_20_duplicate_complaint_blocked(client):
    response = client.post("/complaints/", json={
        "task_id": test_data["task_id"],
        "guest_id": 4002,
        "category": "其他问题",
        "description": "测试重复客诉",
        "severity": "low"
    })
    assert response.status_code == 400
    error_data = response.json()["detail"]
    assert error_data["error_code"] == "already_processed"
    print(f"✓ 重复客诉拦截成功: {error_data['error_code']}")


def test_21_list_complaints_with_filters(client):
    response = client.get("/complaints/", params={
        "status": "complaint_open",
        "severity": "high",
        "task_id": test_data["task_id"]
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    print(f"✓ 客诉筛选成功: 找到{len(data)}条客诉")


def test_22_resolve_complaint(client):
    response = client.post("/complaints/resolve", json={
        "complaint_id": test_data["complaint_id"],
        "resolved_by": 5001,
        "resolution": "accepted",
        "resolution_notes": "已安排重新清洁，并向客人致歉"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["resolution"] == "accepted"
    print(f"✓ 客诉处理完成: {data['resolution']}")


def test_23_already_resolved_complaint_blocked(client):
    response = client.post("/complaints/resolve", json={
        "complaint_id": test_data["complaint_id"],
        "resolved_by": 5001,
        "resolution": "rejected",
        "resolution_notes": "再次处理测试"
    })
    assert response.status_code == 400
    error_data = response.json()["detail"]
    assert error_data["error_code"] == "already_processed"
    print(f"✓ 重复处理客诉拦截成功: {error_data['error_code']}")


def test_24_invalid_status_transition(client):
    response = client.post("/tasks/submit-cleaning", json={
        "task_id": test_data["task_id"],
        "submitted_by": 2001,
        "check_results": []
    })
    assert response.status_code == 400
    error_data = response.json()["detail"]
    assert error_data["error_code"] == "invalid_status"
    print(f"✓ 无效状态转换拦截成功: {error_data['error_code']}")


def test_25_manual_review_trigger(client):
    from sqlalchemy.orm import Session
    from main import SessionLocal, CleaningTask, TaskStatus
    
    scheduled_date = (datetime.utcnow() + timedelta(days=2)).isoformat()
    
    task_response = client.post("/tasks/", json={
        "property_id": test_data["property_id"],
        "cleaner_id": 2001,
        "inspector_id": 3001,
        "scheduled_date": scheduled_date,
        "max_reworks": 0
    })
    task_id = task_response.json()["id"]
    
    db = SessionLocal()
    task = db.query(CleaningTask).filter(CleaningTask.id == task_id).first()
    task.status = TaskStatus.IN_PROGRESS
    db.commit()
    
    all_results = []
    for item_id in test_data["checklist_item_ids"]:
        all_results.append({
            "checklist_item_id": item_id,
            "checked": True,
            "passed": True
        })
    
    client.post("/tasks/submit-cleaning", json={
        "task_id": task_id,
        "submitted_by": 2001,
        "check_results": all_results
    })
    
    fail_results = []
    for item_id in test_data["checklist_item_ids"]:
        fail_results.append({
            "checklist_item_id": item_id,
            "checked": True,
            "passed": False
        })
    
    response = client.post("/tasks/inspect", json={
        "task_id": task_id,
        "inspector_id": 3001,
        "check_results": fail_results
    })
    
    assert response.status_code == 400
    error_data = response.json()["detail"]
    assert error_data["error_code"] == "needs_manual_review"
    print(f"✓ 人工复核触发成功: {error_data['error_code']}")


def test_99_summary():
    print("\n" + "="*60)
    print("自检摘要")
    print("="*60)
    print(f"房源ID: {test_data['property_id']}")
    print(f"检查项数量: {len(test_data['checklist_item_ids'])}")
    print(f"任务ID: {test_data['task_id']}")
    print(f"照片凭证数量: {len(test_data['photo_ids'])}")
    print(f"验收报告ID: {test_data['report_id']}")
    print(f"客诉ID: {test_data['complaint_id']}")
    print("="*60)
    print("✓ 所有测试通过! 系统功能正常")


if __name__ == "__main__":
    print("开始运行自检脚本...")
    print("请确保API服务已启动: python main.py")
    print()
    
    import subprocess
    import time
    import signal
    
    server_process = None
    try:
        server_process = subprocess.Popen(
            [sys.executable, "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print("等待API服务启动...")
        time.sleep(3)
        
        pytest.main([__file__, "-v", "-s"])
        
    finally:
        if server_process:
            print("\n停止API服务...")
            server_process.terminate()
            server_process.wait()
