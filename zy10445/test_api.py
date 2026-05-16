import sys
import json
import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8001"


def pprint_json(data, title=None):
    if title:
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
    print(json.dumps(data, indent=2, ensure_ascii=False))
    print()


def generate_idempotency_key(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def create_sample_data():
    print("\n🚀 创建样例数据...\n")

    repos = [
        {"name": "frontend-webapp", "owner": "dev-team", "description": "前端主应用"},
        {"name": "backend-api", "owner": "backend-team", "description": "后端API服务"},
        {"name": "mobile-app", "owner": "mobile-team", "description": "移动端应用"},
    ]

    created_repos = []
    for repo in repos:
        try:
            response = requests.post(f"{BASE_URL}/repositories/", json=repo)
            if response.status_code == 200:
                created_repo = response.json()
                created_repos.append(created_repo)
                pprint_json(created_repo, f"✓ 创建仓库: {repo['name']}")
            else:
                print(f"⚠ 仓库已存在或错误: {repo['name']}")
        except Exception as e:
            print(f"✗ 创建仓库失败: {e}")

    if not created_repos:
        response = requests.get(f"{BASE_URL}/repositories/")
        created_repos = response.json()
        print(f"\n使用已存在的 {len(created_repos)} 个仓库")

    for repo in created_repos:
        branch_rules = [
            {
                "repository_id": repo["id"],
                "branch_pattern": "main",
                "require_pull_request": True,
                "require_code_owner_review": True,
                "required_approving_review_count": 2,
                "dismiss_stale_reviews": True,
                "require_status_checks": True,
            },
            {
                "repository_id": repo["id"],
                "branch_pattern": "release/*",
                "require_pull_request": True,
                "require_code_owner_review": False,
                "required_approving_review_count": 1,
                "dismiss_stale_reviews": True,
                "require_status_checks": True,
            },
        ]
        for rule in branch_rules:
            try:
                requests.post(f"{BASE_URL}/branch-rules/", json=rule)
                print(f"✓ 为仓库 {repo['name']} 创建分支规则: {rule['branch_pattern']}")
            except Exception as e:
                print(f"✗ 创建分支规则失败: {e}")

    return created_repos


def create_exception_requests(repos):
    print("\n📋 创建例外申请...\n")

    requests_data = [
        {
            "repository_id": repos[0]["id"],
            "branch_pattern": "main",
            "requester": "alice@example.com",
            "reason": "紧急线上bug修复，需要直接推送",
            "requested_duration_minutes": 30,
        },
        {
            "repository_id": repos[1]["id"],
            "branch_pattern": "main",
            "requester": "bob@example.com",
            "reason": "生产环境热修复，时间紧迫",
            "requested_duration_minutes": 60,
        },
        {
            "repository_id": repos[0]["id"],
            "branch_pattern": "release/v1.0",
            "requester": "charlie@example.com",
            "reason": "紧急发布修复",
            "requested_duration_minutes": 15,
        },
    ]

    created_requests = []
    idempotency_keys = []

    for req_data in requests_data:
        idempotency_key = generate_idempotency_key("req")
        idempotency_keys.append(idempotency_key)
        req_data["request_idempotency_key"] = idempotency_key

        response = requests.post(f"{BASE_URL}/exception-requests/", json=req_data)
        result = response.json()
        created_requests.append(result["data"])
        pprint_json(result, f"创建申请 (状态码: {response.status_code})")

    print(f"\n✓ 生成的幂等键: {idempotency_keys}")
    return created_requests, idempotency_keys


def test_idempotency(repos, idempotency_keys):
    print("\n🔍 测试幂等性 - 重复提交同一申请...\n")

    duplicate_req = {
        "repository_id": repos[0]["id"],
        "branch_pattern": "main",
        "requester": "alice@example.com",
        "reason": "紧急线上bug修复，需要直接推送",
        "requested_duration_minutes": 30,
        "request_idempotency_key": idempotency_keys[0],
    }

    response = requests.post(f"{BASE_URL}/exception-requests/", json=duplicate_req)
    result = response.json()
    pprint_json(result, f"重复提交结果 (状态码: {response.status_code})")

    if result["is_new"] == False:
        print("✓ 幂等性验证通过: 重复请求未创建新数据")
    else:
        print("✗ 幂等性验证失败: 重复请求创建了新数据")


def advance_status(requests_list):
    print("\n⚡ 推进状态流程...\n")

    req1 = requests_list[0]
    req2 = requests_list[1]

    print(f"\n--- 审批申请 #{req1['id']} ---")
    response = requests.post(
        f"{BASE_URL}/exception-requests/{req1['id']}/approve",
        json={"actor": "manager@example.com", "comment": "批准紧急修复"},
    )
    pprint_json(response.json(), f"审批结果 (状态码: {response.status_code})")

    print(f"\n--- 启动放开窗口 #{req1['id']} ---")
    response = requests.post(
        f"{BASE_URL}/exception-requests/{req1['id']}/start-window",
        json={"actor": "ops@example.com"},
    )
    pprint_json(response.json(), f"启动窗口结果 (状态码: {response.status_code})")

    print(f"\n--- 拒绝申请 #{req2['id']} ---")
    response = requests.post(
        f"{BASE_URL}/exception-requests/{req2['id']}/reject",
        json={"actor": "manager@example.com", "comment": "不符合紧急修复条件"},
    )
    pprint_json(response.json(), f"拒绝结果 (状态码: {response.status_code})")

    print(f"\n--- 重复审批申请 #{req1['id']} (应该失败) ---")
    response = requests.post(
        f"{BASE_URL}/exception-requests/{req1['id']}/approve",
        json={"actor": "manager@example.com", "comment": "再次审批"},
    )
    if response.status_code == 400:
        print("✓ 状态保护验证通过: 无法重复审批已处理的申请")
        print(f"  错误信息: {response.json()['detail']}")
    else:
        print("✗ 状态保护验证失败")


def test_restore_and_abnormal(repos):
    print("\n🔧 测试恢复和异常场景...\n")

    new_req = {
        "repository_id": repos[2]["id"],
        "branch_pattern": "main",
        "requester": "dave@example.com",
        "reason": "测试恢复流程",
        "requested_duration_minutes": 5,
        "request_idempotency_key": generate_idempotency_key("test-restore"),
    }

    response = requests.post(f"{BASE_URL}/exception-requests/", json=new_req)
    req = response.json()["data"]
    print(f"✓ 创建测试申请 #{req['id']}")

    requests.post(
        f"{BASE_URL}/exception-requests/{req['id']}/approve",
        json={"actor": "manager@example.com"},
    )
    print("✓ 已审批")

    requests.post(
        f"{BASE_URL}/exception-requests/{req['id']}/start-window",
        json={"actor": "ops@example.com"},
    )
    print("✓ 已启动放开窗口")

    print(f"\n--- 恢复分支保护 #{req['id']} ---")
    response = requests.post(
        f"{BASE_URL}/exception-requests/{req['id']}/restore",
        json={
            "restored_by": "ops@example.com",
            "is_manual": True,
            "comment": "修复完成，手动恢复保护",
            "success": True,
        },
    )
    pprint_json(response.json(), f"恢复结果 (状态码: {response.status_code})")

    print(f"\n--- 重复恢复 #{req['id']} (应该失败) ---")
    response = requests.post(
        f"{BASE_URL}/exception-requests/{req['id']}/restore",
        json={
            "restored_by": "ops@example.com",
            "is_manual": False,
            "comment": "再次恢复",
            "success": True,
        },
    )
    if response.status_code == 400:
        print("✓ 恢复校验通过: 无法重复恢复")
        print(f"  错误信息: {response.json()['detail']}")
    else:
        print("✗ 恢复校验失败")


def test_manual_correction(repos):
    print("\n🛠️ 测试人工修正...\n")

    new_req = {
        "repository_id": repos[0]["id"],
        "branch_pattern": "main",
        "requester": "eve@example.com",
        "reason": "测试人工修正",
        "requested_duration_minutes": 10,
        "request_idempotency_key": generate_idempotency_key("test-correction"),
    }

    response = requests.post(f"{BASE_URL}/exception-requests/", json=new_req)
    req = response.json()["data"]
    print(f"✓ 创建测试申请 #{req['id']}, 当前状态: {req['status']}")

    print(f"\n--- 人工修正状态 #{req['id']} ---")
    response = requests.post(
        f"{BASE_URL}/exception-requests/{req['id']}/manual-correction",
        json={
            "actor": "admin@example.com",
            "new_status": "cancelled",
            "reason": "申请被误提交，人工取消",
            "original_input": json.dumps({"user_action": "cancel_request"}),
        },
    )
    result = response.json()
    pprint_json(result, f"修正结果 (状态码: {response.status_code})")
    print(f"✓ 状态已从 pending 修正为: {result['status']}")


def export_report():
    print("\n📊 导出审计报告...\n")

    response = requests.post(f"{BASE_URL}/export/audit-report", json={})
    report = response.json()

    print(f"报告生成时间: {report['report_generated_at']}")
    print(f"总申请数: {report['total_requests']}")
    print("\n异常事件统计:")

    total_abnormal = 0
    for req in report["requests"]:
        if req["abnormal_events_count"] > 0:
            total_abnormal += 1
            print(f"\n  申请 #{req['request_id']} - {req['requester']}")
            print(f"  异常事件数: {req['abnormal_events_count']}")
            for event in req["abnormal_events"]:
                print(f"    - [{event['conclusion']}] {event['action']} by {event['actor']}")
                print(f"      {event['details']}")

    print(f"\n✓ 包含异常事件的申请数: {total_abnormal}")

    with open("audit_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print("✓ 报告已保存到 audit_report.json")


def show_audit_records():
    print("\n📋 查看审计记录...\n")

    response = requests.get(f"{BASE_URL}/audit-records/")
    records = response.json()

    print(f"总审计记录数: {len(records)}")
    print("\n最近10条记录:")
    for r in records[:10]:
        status_icon = "✅" if r["conclusion"] == "normal" else "⚠️" if r["conclusion"] == "needs_review" else "❌"
        print(f"  {status_icon} [{r['timestamp'][:19]}] {r['action']} by {r['actor']}")
        print(f"     结论: {r['conclusion']} - {r['details']}")


def main():
    print("=" * 60)
    print("  分支保护例外API - 完整测试脚本")
    print("=" * 60)

    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"\n✓ API服务状态: {response.json()['status']}")
    except Exception:
        print("\n✗ 无法连接到API服务")
        print("  请先运行: uvicorn main:app --reload")
        sys.exit(1)

    repos = create_sample_data()
    if not repos:
        print("✗ 没有可用的仓库")
        sys.exit(1)

    requests_list, idempotency_keys = create_exception_requests(repos)
    test_idempotency(repos, idempotency_keys)
    advance_status(requests_list)
    test_restore_and_abnormal(repos)
    test_manual_correction(repos)
    show_audit_records()
    export_report()

    print("\n" + "=" * 60)
    print("  ✅ 所有测试完成！")
    print("=" * 60)
    print("\nAPI文档地址:")
    print(f"  Swagger UI: {BASE_URL}/docs")
    print(f"  ReDoc: {BASE_URL}/redoc")
    print("\n主要接口:")
    print("  POST /exception-requests/          - 创建例外申请（幂等）")
    print("  GET  /exception-requests/          - 查询申请列表")
    print("  POST /exception-requests/{id}/approve  - 审批申请")
    print("  POST /exception-requests/{id}/start-window - 启动放开窗口")
    print("  POST /exception-requests/{id}/restore  - 恢复分支保护")
    print("  POST /exception-requests/{id}/manual-correction - 人工修正")
    print("  POST /export/audit-report          - 导出审计报告")


if __name__ == "__main__":
    main()
