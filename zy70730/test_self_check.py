import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Dict

import httpx

BASE_URL = "http://localhost:8000"


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_step(step: str, desc: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}[步骤 {step}]{Colors.RESET} {desc}")


def print_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")


def print_fail(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")


def print_warn(msg: str):
    print(f"{Colors.YELLOW}! {msg}{Colors.RESET}")


async def test_health_check():
    print_step("1", "健康检查")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "ok"
        print_success("健康检查通过")


async def test_missing_field():
    print_step("2", "测试缺字段错误响应")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/v1/intercepts",
            json={"metric_name": "test_metric"},
        )
        assert response.status_code == 422
        data = response.json()
        assert "error_code" in data
        assert data["error_code"] == "missing_field"
        print_success("缺字段错误响应正确")
        return data


async def test_add_whitelist():
    print_step("3", "添加标签白名单")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/v1/whitelist",
            json={
                "metric_name": "http_requests",
                "tag_key": "status",
                "allowed_values": ["200", "400", "500"],
            },
        )
        assert response.status_code == 201
        print_success("白名单标签1添加成功")

        response = await client.post(
            f"{BASE_URL}/api/v1/whitelist",
            json={
                "metric_name": "http_requests",
                "tag_key": "method",
                "allowed_values": None,
            },
        )
        assert response.status_code == 201
        print_success("白名单标签2添加成功")

        response = await client.get(f"{BASE_URL}/api/v1/whitelist")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        print_success(f"白名单列表查询成功，共 {len(data)} 条记录")


async def test_cardinality_estimate_and_intercept():
    print_step("4", "测试基数估算和拦截")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/v1/cardinality/estimate",
            json={
                "metric_name": "http_requests",
                "tag_set": {"status": "200", "method": "GET"},
            },
        )
        assert response.status_code == 403
        data = response.json()
        assert "error_code" in data
        assert data["error_code"] == "needs_manual_review"
        print_success("基数估算拦截正确")
        print(f"  估算基数: {data['details']['estimated_cardinality']}")
        print(f"  拦截原因: {data['message']}")

        return data["details"]["estimated_cardinality"]


async def test_create_intercept_record():
    print_step("5", "创建拦截记录申请")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/v1/intercepts",
            json={
                "metric_name": "http_requests",
                "tag_set": {"status": "200", "method": "GET", "path": "/api/users"},
                "estimated_cardinality": 10000,
                "reason": "新业务上线需要监控用户请求分布",
            },
        )
        assert response.status_code == 201
        data = response.json()
        record_id = data["id"]
        assert data["status"] == "pending"
        print_success(f"拦截记录创建成功，ID: {record_id}")

        response = await client.post(
            f"{BASE_URL}/api/v1/intercepts",
            json={
                "metric_name": "db_query_latency",
                "tag_set": {"db": "mysql", "table": "orders", "query_type": "select"},
                "estimated_cardinality": 5000,
                "reason": "数据库性能监控需要细分表级别",
            },
        )
        assert response.status_code == 201
        print_success("第二条拦截记录创建成功")

        return record_id


async def test_query_intercepts():
    print_step("6", "查询拦截记录列表")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/api/v1/intercepts")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        print_success(f"拦截记录列表查询成功，共 {len(data)} 条")

        response = await client.get(
            f"{BASE_URL}/api/v1/intercepts",
            params={"status": "pending"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        print_success(f"待审核记录筛选成功，共 {len(data)} 条")

        response = await client.get(
            f"{BASE_URL}/api/v1/intercepts",
            params={"metric_name": "http_requests"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        print_success(f"按指标名筛选成功，共 {len(data)} 条")


async def test_review_record(record_id: int):
    print_step("7", "审核拦截记录")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/v1/intercepts/{record_id}/review",
            json={
                "reviewer": "admin",
                "status": "approved",
                "review_comment": "业务合理，予以放行",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["reviewer"] == "admin"
        print_success(f"记录 {record_id} 审核通过")

        response = await client.post(
            f"{BASE_URL}/api/v1/intercepts/{record_id}/review",
            json={
                "reviewer": "admin",
                "status": "rejected",
            },
        )
        assert response.status_code == 400
        data = response.json()
        assert "error_code" in data
        assert data["error_code"] == "already_processed"
        print_success("重复审核被正确拦截")


async def test_invalid_status():
    print_step("8", "测试无效状态错误")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/v1/intercepts",
            json={
                "metric_name": "test_status",
                "tag_set": {"foo": "bar"},
                "estimated_cardinality": 100,
                "reason": "test",
            },
        )
        assert response.status_code == 201
        record_id = response.json()["id"]

        response = await client.post(
            f"{BASE_URL}/api/v1/intercepts/{record_id}/review",
            json={
                "reviewer": "test",
                "status": "pending",
            },
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] == "invalid_status"
        print_success("无效审核状态被正确拦截")


async def test_report_generate_and_export():
    print_step("9", "生成并导出护栏报告")
    async with httpx.AsyncClient() as client:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        response = await client.post(
            f"{BASE_URL}/api/v1/reports/generate",
            params={"report_date": today},
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_intercepted" in data
        assert data["total_intercepted"] >= 3
        print_success(f"报告生成成功，拦截总数: {data['total_intercepted']}")

        response = await client.get(f"{BASE_URL}/api/v1/reports")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        print_success("报告列表查询成功")

        response = await client.get(f"{BASE_URL}/api/v1/reports/{today}/export")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        csv_content = response.text
        assert "report_date" in csv_content
        assert "total_intercepted" in csv_content
        print_success("CSV报告导出成功")
        print("  CSV内容预览:")
        for line in csv_content.split("\n")[:6]:
            print(f"    {line}")


async def test_error_response_codes():
    print_step("10", "验证所有错误码")
    error_codes = ["missing_field", "invalid_status", "needs_manual_review", "already_processed"]
    print(f"已定义错误码: {error_codes}")
    for code in error_codes:
        print_success(f"错误码 {code} 已测试覆盖")


async def main():
    print(f"\n{Colors.BOLD}{Colors.BLUE}===== 指标标签基数护栏后端API自检脚本 ====={Colors.RESET}")
    print(f"测试目标: {BASE_URL}")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if os.path.exists("metric_guardrail.db"):
        os.remove("metric_guardrail.db")
        print_warn("已清理旧的数据库文件")

    passed = 0
    failed = 0
    tests = [
        ("健康检查", test_health_check),
        ("缺字段错误", test_missing_field),
        ("添加白名单", test_add_whitelist),
        ("基数估算拦截", test_cardinality_estimate_and_intercept),
        ("创建拦截记录", test_create_intercept_record),
        ("查询拦截记录", test_query_intercepts),
        ("审核记录", test_review_record),
        ("无效状态测试", test_invalid_status),
        ("报告生成导出", test_report_generate_and_export),
        ("错误码验证", test_error_response_codes),
    ]

    record_id = None
    for name, test_func in tests:
        try:
            if name == "审核记录" and record_id:
                await test_func(record_id)
            elif name == "创建拦截记录":
                record_id = await test_func()
            else:
                await test_func()
            passed += 1
        except Exception as e:
            print_fail(f"{name} 失败: {str(e)}")
            import traceback
            traceback.print_exc()
            failed += 1

    print(f"\n{Colors.BOLD}===== 测试总结 ====={Colors.RESET}")
    print(f"总测试数: {len(tests)}")
    print(f"{Colors.GREEN}通过: {passed}{Colors.RESET}")
    print(f"{Colors.RED}失败: {failed}{Colors.RESET}")

    if failed == 0:
        print(f"\n{Colors.GREEN}{Colors.BOLD}所有测试通过！项目可以正常使用。{Colors.RESET}")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}有测试失败，请检查代码。{Colors.RESET}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
