import json
import sys
sys.path.insert(0, '/opt/homebrew/lib/python3.9/site-packages')
import requests
from datetime import datetime

BASE_URL = "http://localhost:8000"


def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"📌 {title}")
    print(f"{'='*60}")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print(response.text)
    return response.json() if response.status_code == 200 else None


def test_successful_flow():
    """
    ✅ 成功流程演示：创建导入包 -> 执行预检 -> 通过 -> 导出
    """
    print("\n" + "🚀"*20)
    print("开始演示：成功流程")
    print("🚀"*20)

    package_data = {
        "tenant_id": "tenant_001",
        "package_name": "用户数据导入包",
        "package_version": "v1.0.0",
        "source_content": "这是一个完整的用户数据源文件内容...",
        "metadata": {"source_system": "CRM", "import_type": "full"},
        "field_mappings": [
            {
                "source_field": "user_id",
                "target_field": "id",
                "mapping_type": "direct"
            },
            {
                "source_field": "user_name",
                "target_field": "name",
                "mapping_type": "direct"
            },
            {
                "source_field": "create_time",
                "target_field": "created_at",
                "mapping_type": "transform",
                "transform_rule": {"format": "ISO8601"}
            }
        ],
        "dependency_resources": [
            {
                "resource_type": "database",
                "resource_name": "主数据库",
                "resource_id": "db_primary_001",
                "required": True
            },
            {
                "resource_type": "api",
                "resource_name": "用户服务API",
                "resource_id": "api_user_001",
                "required": True
            }
        ]
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/packages",
        params={"created_by": "admin@example.com"},
        json=package_data
    )
    result = print_response("1. 创建导入包", response)
    package_id = result["data"]["package_id"] if result else None

    if not package_id:
        print("❌ 创建导入包失败，终止测试")
        return

    response = requests.post(
        f"{BASE_URL}/api/v1/packages/{package_id}/precheck",
        params={"operator": "admin@example.com"}
    )
    result = print_response("2. 执行预检", response)

    response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}")
    print_response("3. 查询导入包详情", response)

    response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}/certificates")
    print_response("4. 查询通过凭证", response)

    response = requests.post(
        f"{BASE_URL}/api/v1/packages/{package_id}/export",
        json={"format": "json", "include_audit_logs": True}
    )
    print_response("5. 导出完整数据（含审计日志）", response)

    response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}/audit-logs")
    print_response("6. 查询审计日志", response)

    print("\n" + "✅"*20)
    print("成功流程演示完成！")
    print("✅"*20)
    return package_id


def test_problem_flow():
    """
    ❌ 问题流程演示：创建有问题的导入包 -> 预检失败 -> 查看错误 -> 撤销
    """
    print("\n" + "⚠️"*20)
    print("开始演示：问题流程")
    print("⚠️"*20)

    package_data = {
        "tenant_id": "tenant_002",
        "package_name": "订单数据导入包（有问题）",
        "package_version": "v1.0.0",
        "source_content": "订单数据源文件...",
        "metadata": {"source_system": "OrderSys"},
        "field_mappings": [
            {
                "source_field": "",
                "target_field": "id",
                "mapping_type": "direct"
            },
            {
                "source_field": "order_amount",
                "target_field": "amount",
                "mapping_type": "transform",
                "transform_rule": {}
            }
        ],
        "dependency_resources": [
            {
                "resource_type": "database",
                "resource_name": "订单数据库",
                "resource_id": "",
                "required": True
            },
            {
                "resource_type": "unknown_type",
                "resource_name": "未知资源",
                "resource_id": "xxx",
                "required": False
            }
        ]
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/packages",
        params={"created_by": "operator@example.com"},
        json=package_data
    )
    result = print_response("1. 创建有问题的导入包", response)
    package_id = result["data"]["package_id"] if result else None

    if not package_id:
        print("❌ 创建导入包失败，终止测试")
        return

    response = requests.post(
        f"{BASE_URL}/api/v1/packages/{package_id}/precheck",
        params={"operator": "operator@example.com"}
    )
    result = print_response("2. 执行预检（预期失败）", response)

    response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}")
    print_response("3. 查看预检错误和修复建议", response)

    response = requests.post(
        f"{BASE_URL}/api/v1/packages/{package_id}/cancel",
        params={
            "operator": "manager@example.com",
            "reason": "数据校验不通过，需要重新整理数据"
        }
    )
    print_response("4. 取消导入包", response)

    response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}/audit-logs")
    print_response("5. 查看审计日志", response)

    print("\n" + "⚠️"*20)
    print("问题流程演示完成！")
    print("⚠️"*20)
    return package_id


def test_duplicate_submit():
    """
    🛡️ 重复提交防重测试
    """
    print("\n" + "🛡️"*20)
    print("开始演示：重复提交防重")
    print("🛡️"*20)

    source_content = "这个内容的hash会被用来防重"

    package_data = {
        "tenant_id": "tenant_003",
        "package_name": "防重测试包",
        "package_version": "v1.0.0",
        "source_content": source_content,
        "field_mappings": [],
        "dependency_resources": []
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/packages",
        params={"created_by": "tester@example.com"},
        json=package_data
    )
    result = print_response("1. 第一次提交", response)
    first_id = result["data"]["package_id"] if result else None

    response = requests.post(
        f"{BASE_URL}/api/v1/packages",
        params={"created_by": "tester@example.com"},
        json=package_data
    )
    result = print_response("2. 第二次提交（相同内容）", response)
    second_id = result["data"]["package_id"] if result else None

    print(f"\n📊 对比结果:")
    print(f"   第一次ID: {first_id}")
    print(f"   第二次ID: {second_id}")
    print(f"   是否相同: {'✅ 是 - 防重生效！' if first_id == second_id else '❌ 否 - 有问题'}")

    print("\n" + "🛡️"*20)
    print("防重测试完成！")
    print("🛡️"*20)


def test_status_advance():
    """
    🔄 状态流转测试
    """
    print("\n" + "🔄"*20)
    print("开始演示：状态流转")
    print("🔄"*20)

    package_data = {
        "tenant_id": "tenant_004",
        "package_name": "状态流转测试包",
        "package_version": "v1.0.0",
        "source_content": "状态流转测试内容",
        "field_mappings": [
            {
                "source_field": "name",
                "target_field": "user_name",
                "mapping_type": "lookup",
                "transform_rule": {"table": "users"}
            }
        ],
        "dependency_resources": [
            {
                "resource_type": "storage",
                "resource_name": "文件存储",
                "resource_id": "",
                "required": False
            }
        ]
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/packages",
        params={"created_by": "admin@example.com"},
        json=package_data
    )
    result = print_response("1. 创建导入包 (CREATED)", response)
    package_id = result["data"]["package_id"] if result else None

    if not package_id:
        return

    response = requests.post(
        f"{BASE_URL}/api/v1/packages/{package_id}/precheck",
        params={"operator": "admin@example.com"}
    )
    result = print_response("2. 执行预检 (应该有警告 → PENDING_REVIEW)", response)

    response = requests.post(
        f"{BASE_URL}/api/v1/packages/{package_id}/status",
        json={
            "target_status": "PASSED",
            "operator": "reviewer@example.com",
            "reason": "审核通过，警告可以忽略",
            "ip_address": "192.168.1.100",
            "user_agent": "Chrome/120.0"
        }
    )
    print_response("3. 审核通过 (PENDING_REVIEW → PASSED)", response)

    response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}/certificates")
    result = print_response("4. 查看新颁发的凭证", response)
    cert_id = None
    if result and result["data"]["items"]:
        cert_id = result["data"]["items"][0]["id"]

    if cert_id:
        response = requests.post(
            f"{BASE_URL}/api/v1/packages/{package_id}/certificates/{cert_id}/revoke",
            json={
                "operator": "security@example.com",
                "reason": "凭证过期，需要重新预检"
            }
        )
        print_response("5. 撤销凭证", response)

    response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}/audit-logs")
    print_response("6. 完整审计日志", response)

    print("\n" + "🔄"*20)
    print("状态流转演示完成！")
    print("🔄"*20)


def main():
    print("\n" + "="*60)
    print("🧪 租户导入预检 API 测试样例")
    print("="*60)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"服务地址: {BASE_URL}")

    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code != 200:
            print("\n❌ 服务未启动，请先运行: uvicorn app.main:app --reload")
            return
    except:
        print("\n❌ 无法连接到服务，请先运行: uvicorn app.main:app --reload")
        return

    print("\n✅ 服务正常，开始执行测试...")

    test_successful_flow()
    test_problem_flow()
    test_duplicate_submit()
    test_status_advance()

    print("\n" + "🎊"*20)
    print("所有测试演示完成！")
    print("🎊"*20)
    print(f"\n📖 访问 API 文档: {BASE_URL}/docs")


if __name__ == "__main__":
    main()
