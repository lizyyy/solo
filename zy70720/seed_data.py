import requests
import json

BASE_URL = "http://localhost:8000"


def print_response(title, response):
    print(f"\n=== {title} ===")
    print(f"Status: {response.status_code}")
    if response.status_code < 400:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))


def seed_data():
    print("开始造数...")
    
    incident_id = "INC-2024-001"
    incident = {
        "id": incident_id,
        "title": "数据库连接异常导致服务响应缓慢",
        "description": "从上午10:30开始，多个用户报告API服务响应缓慢或超时。"
    }
    response = requests.post(f"{BASE_URL}/api/incidents", json=incident)
    print_response("创建事故", response)
    
    statuses = ["identified", "monitoring", "resolved"]
    for status in statuses:
        response = requests.post(
            f"{BASE_URL}/api/incidents/{incident_id}/status",
            json={"status": status}
        )
        print_response(f"更新状态至 {status}", response)
    
    announcements = [
        {
            "incident_id": incident_id,
            "service_status": "服务部分不可用",
            "content": "正在调查数据库连接问题，已发现连接池耗尽。",
            "created_by": "运维团队"
        },
        {
            "incident_id": incident_id,
            "service_status": "正在恢复",
            "content": "已重启数据库实例，正在观察连接恢复情况。",
            "created_by": "DBA团队"
        },
        {
            "incident_id": incident_id,
            "service_status": "服务已恢复",
            "content": "数据库连接已恢复正常，所有服务正在恢复。",
            "created_by": "运维团队"
        }
    ]
    
    announcement_ids = []
    for ann in announcements:
        response = requests.post(f"{BASE_URL}/api/announcements", json=ann)
        print_response(f"创建公告 v{announcements.index(ann)+1}", response)
        announcement_ids.append(response.json()["id"])
    
    subscribers = [
        {"incident_id": incident_id, "name": "产品团队", "email": "product@example.com"},
        {"incident_id": incident_id, "name": "客服团队", "email": "support@example.com"},
        {"incident_id": incident_id, "name": "商务团队", "email": "business@example.com"}
    ]
    
    subscriber_ids = []
    for sub in subscribers:
        response = requests.post(f"{BASE_URL}/api/subscribers", json=sub)
        print_response(f"添加订阅方: {sub['name']}", response)
        subscriber_ids.append(response.json()["id"])
    
    confirmations = [
        {"announcement_idx": 0, "subscriber_idx": 0, "notes": "已同步至产品周报"},
        {"announcement_idx": 0, "subscriber_idx": 1, "notes": "正在通知受影响用户"},
        {"announcement_idx": 1, "subscriber_idx": 0, "notes": "已更新内部文档"},
        {"announcement_idx": 1, "subscriber_idx": 1, "notes": "用户通知中"},
        {"announcement_idx": 2, "subscriber_idx": 0, "notes": "产品团队确认"},
        {"announcement_idx": 2, "subscriber_idx": 1, "notes": "客服团队确认"},
        {"announcement_idx": 2, "subscriber_idx": 2, "notes": "商务团队确认"},
    ]
    
    for conf in confirmations:
        response = requests.post(
            f"{BASE_URL}/api/confirmations",
            json={
                "incident_id": incident_id,
                "announcement_id": announcement_ids[conf["announcement_idx"]],
                "subscriber_id": subscriber_ids[conf["subscriber_idx"]],
                "notes": conf["notes"]
            }
        )
        print_response(f"确认回执: {conf['notes'][:20]}", response)
    
    correction_logs = [
        {
            "incident_id": incident_id,
            "original_input": "用户报告数量统计错误，初报100+实际为47",
            "processed_by": "数据团队",
            "conclusion": "已修正影响用户数量统计，实际受影响用户为47人",
            "correction_type": "数据修正"
        },
        {
            "incident_id": incident_id,
            "original_input": "误报为网络问题，实际为数据库连接池耗尽",
            "processed_by": "运维团队",
            "conclusion": "根因确认：数据库max_connections配置过低，导致连接耗尽",
            "correction_type": "根因修正"
        }
    ]
    
    for log in correction_logs:
        response = requests.post(f"{BASE_URL}/api/correction-logs", json=log)
        print_response(f"人工修正: {log['correction_type']}", response)
    
    response = requests.put(
        f"{BASE_URL}/api/incidents/{incident_id}",
        json={
            "review_summary": "本次事故持续约2小时，根因为数据库max_connections配置不足。"
                            "已将连接池配置从100调整至500，并添加连接池监控告警。"
        }
    )
    print_response("添加复盘摘要", response)
    
    response = requests.get(f"{BASE_URL}/api/incidents/{incident_id}/export")
    print_response("导出完整数据", response)
    
    print("\n=== 造数完成 ===")
    print(f"事故编号: {incident_id}")
    print(f"公告数量: {len(announcements)}")
    print(f"订阅方数量: {len(subscribers)}")
    print(f"确认回执数量: {len(confirmations)}")


if __name__ == "__main__":
    seed_data()
