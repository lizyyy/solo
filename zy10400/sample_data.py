import requests
import json

BASE_URL = "http://localhost:8000"


def print_response(step, response):
    print(f"\n{'='*60}")
    print(f"步骤: {step}")
    print(f"状态码: {response.status_code}")
    try:
        data = response.json()
        print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return data
    except:
        print(f"响应: {response.text}")
        return None


def create_sample_data():
    print("开始创建样例数据...")

    tools = [
        {"name": "browser_navigate", "server_name": "integrated_browser", "description": "浏览器导航工具", "status": "active"},
        {"name": "browser_click", "server_name": "integrated_browser", "description": "浏览器点击工具", "status": "active"},
        {"name": "search_web", "server_name": "search_engine", "description": "网络搜索工具", "status": "active"},
    ]

    created_tools = []
    for tool in tools:
        response = requests.post(f"{BASE_URL}/tools/", json=tool)
        data = print_response(f"创建工具 {tool['name']}", response)
        if data and 'id' in data:
            created_tools.append(data)

    permissions = [
        {"tool_id": 1, "permission_scope": "http://example.com/*", "description": "允许访问example.com域名", "approved_by": "admin"},
        {"tool_id": 1, "permission_scope": "http://localhost:*", "description": "允许访问本地服务", "approved_by": "admin"},
        {"tool_id": 2, "permission_scope": "http://example.com/*", "description": "允许点击example.com上的元素", "approved_by": "admin"},
        {"tool_id": 3, "permission_scope": "search:query", "description": "允许执行搜索查询", "approved_by": "admin"},
    ]

    for perm in permissions:
        response = requests.post(f"{BASE_URL}/permissions/", json=perm)
        print_response(f"创建权限 {perm['permission_scope']}", response)

    batch = {
        "batch_number": "BATCH-2024-001",
        "submitter": "plugin_manager",
        "description": "2024年第一季度MCP工具调用审批"
    }
    response = requests.post(f"{BASE_URL}/batches/", json=batch)
    batch_data = print_response("创建审批批次", response)
    batch_id = batch_data.get('id') if batch_data else None

    calls = [
        {"tool_id": 1, "batch_id": batch_id, "caller": "user1", "call_scope": "http://example.com/page1", "call_parameters": '{"url": "http://example.com/page1"}'},
        {"tool_id": 1, "batch_id": batch_id, "caller": "user2", "call_scope": "http://example.com/page2", "call_parameters": '{"url": "http://example.com/page2"}'},
        {"tool_id": 1, "batch_id": batch_id, "caller": "user3", "call_scope": "http://unauthorized-site.com", "call_parameters": '{"url": "http://unauthorized-site.com"}'},
        {"tool_id": 2, "batch_id": batch_id, "caller": "user1", "call_scope": "http://example.com/button", "call_parameters": '{"selector": "#submit"}'},
        {"tool_id": 3, "batch_id": batch_id, "caller": "user2", "call_scope": "search:query", "call_parameters": '{"query": "python fastapi"}'},
        {"tool_id": 3, "batch_id": batch_id, "caller": "user3", "call_scope": "search:admin_api", "call_parameters": '{"query": "admin credentials"}'},
    ]

    for call in calls:
        response = requests.post(f"{BASE_URL}/calls/", json=call)
        print_response(f"记录调用 {call['call_scope']}", response)

    print("\n" + "="*60)
    print("样例数据创建完成!")
    print("="*60)


def test_idempotency():
    print("\n\n测试幂等性 - 重复提交同一审批批次...")

    batch = {
        "batch_number": "BATCH-2024-001",
        "submitter": "plugin_manager",
        "description": "重复提交的批次"
    }
    response = requests.post(f"{BASE_URL}/batches/", json=batch)
    print_response("重复提交同一批次", response)

    print("\n测试幂等性 - 重复推进审批状态...")

    update = {
        "status": "approved",
        "approved_by": "admin"
    }
    response = requests.put(f"{BASE_URL}/batches/1/status", json=update)
    print_response("第一次推进审批状态", response)

    response = requests.put(f"{BASE_URL}/batches/1/status", json=update)
    print_response("第二次推进审批状态(应失败)", response)


def test_audit_workflow():
    print("\n\n测试审计工作流...")

    response = requests.get(f"{BASE_URL}/audit/comparison")
    print_response("权限比对分析", response)

    response = requests.post(f"{BASE_URL}/audit/generate-anomalies")
    print_response("生成异常记录", response)

    response = requests.post(f"{BASE_URL}/audit/summary", params={"generated_by": "audit_bot"})
    summary_data = print_response("生成审计摘要", response)
    summary_id = summary_data.get('id') if summary_data else None

    if summary_id:
        response = requests.post(f"{BASE_URL}/audit/export/{summary_id}")
        print_response("导出审计报告", response)

    return summary_id


def test_anomaly_resolution():
    print("\n\n测试异常处理流程...")

    response = requests.get(f"{BASE_URL}/anomalies/", params={"status": "open"})
    anomalies_data = print_response("查询待处理异常", response)

    if anomalies_data and len(anomalies_data) > 0:
        anomaly_id = anomalies_data[0]['id']

        update = {
            "status": "reviewing",
            "resolution": "正在核查此权限越界问题"
        }
        response = requests.put(f"{BASE_URL}/anomalies/{anomaly_id}/status", json=update)
        print_response(f"更新异常 {anomaly_id} 状态为审核中", response)

        fix = {
            "declared_permission": "http://example.com/*,http://unauthorized-site.com/*",
            "resolution": "已补充声明unauthorized-site.com访问权限，此异常已解决",
            "resolved_by": "security_admin"
        }
        response = requests.put(f"{BASE_URL}/anomalies/{anomaly_id}/manual-fix", json=fix)
        print_response(f"人工修复异常 {anomaly_id}", response)


if __name__ == "__main__":
    try:
        create_sample_data()
        test_idempotency()
        test_audit_workflow()
        test_anomaly_resolution()

        print("\n" + "="*60)
        print("所有测试完成!")
        print(f"API文档地址: {BASE_URL}/docs")
        print("="*60)
    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到服务器，请先启动服务:")
        print("  uvicorn app.main:app --reload")
