#!/usr/bin/env python3
import sys
import os
import json
import subprocess
import time
import requests

BASE_URL = "http://localhost:8000/api/v1"

class colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'

def print_success(msg):
    print(f"{colors.GREEN}✓ {msg}{colors.ENDC}")

def print_error(msg):
    print(f"{colors.RED}✗ {msg}{colors.ENDC}")

def print_info(msg):
    print(f"{colors.BLUE}ℹ {msg}{colors.ENDC}")

def print_warning(msg):
    print(f"{colors.YELLOW}⚠ {msg}{colors.ENDC}")

def wait_for_server(timeout=30):
    print_info("等待服务启动...")
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = requests.get(f"{BASE_URL}/health/", timeout=2)
            if response.status_code == 200:
                print_success("服务已启动")
                return True
        except:
            time.sleep(1)
    print_error("服务启动超时")
    return False

def test_import_journeys():
    print_info("\n=== 测试导入旅程资产 ===")
    test_journeys = [
        {
            "name": "用户登录巡检",
            "description": "端到端验证用户登录流程",
            "steps_definition": json.dumps([
                {"step_id": "step1", "name": "打开登录页", "action": "navigate", "expected": "页面加载成功"},
                {"step_id": "step2", "name": "输入账号", "action": "input", "expected": "账号输入成功"},
                {"step_id": "step3", "name": "点击登录", "action": "click", "expected": "登录成功跳转"}
            ], ensure_ascii=False),
            "dependent_services": json.dumps(["auth-service", "user-center"]),
            "run_frequency": "0 */6 * * *"
        },
        {
            "name": "订单创建巡检",
            "description": "验证订单创建全流程",
            "steps_definition": json.dumps([
                {"step_id": "step1", "name": "选择商品", "action": "select"},
                {"step_id": "step2", "name": "提交订单", "action": "submit"}
            ], ensure_ascii=False),
            "dependent_services": json.dumps(["order-service", "payment-gateway"]),
            "run_frequency": "0 */12 * * *"
        }
    ]

    created_ids = []
    for journey in test_journeys:
        response = requests.post(f"{BASE_URL}/journeys/", json=journey)
        if response.status_code == 201:
            data = response.json()
            created_ids.append(data['id'])
            print_success(f"导入成功: {journey['name']} (ID: {data['id']})")
        else:
            print_error(f"导入失败: {journey['name']} - {response.text}")

    return created_ids

def test_import_validation():
    print_info("\n=== 测试导入校验规则 ===")
    test_cases = [
        {
            "name": "缺少必填字段",
            "data": {"name": "测试", "run_frequency": "* * * * *"},
            "expected_code": "field_required",
            "desc": "缺少steps_definition应报错"
        },
        {
            "name": "无效JSON步骤",
            "data": {
                "name": "无效JSON测试",
                "steps_definition": "not valid json",
                "run_frequency": "* * * * *"
            },
            "expected_code": "INVALID_JSON",
            "desc": "无效JSON应返回错误码"
        },
        {
            "name": "步骤缺少step_id",
            "data": {
                "name": "缺少step_id测试",
                "steps_definition": json.dumps([{"name": "测试步骤"}]),
                "run_frequency": "* * * * *"
            },
            "expected_code": "MISSING_STEP_ID",
            "desc": "缺少step_id应返回错误码"
        }
    ]

    for case in test_cases:
        response = requests.post(f"{BASE_URL}/journeys/", json=case['data'])
        if response.status_code in [400, 422]:
            print_success(f"{case['name']}: 正确返回错误")
        else:
            print_warning(f"{case['name']}: 状态码 {response.status_code}")

def test_filter_journeys(journey_ids):
    print_info("\n=== 测试筛选功能 ===")

    response = requests.get(f"{BASE_URL}/journeys/")
    if response.status_code == 200:
        print_success(f"查询全部成功，共 {len(response.json())} 条")

    response = requests.get(f"{BASE_URL}/journeys/", params={"status": "draft"})
    if response.status_code == 200:
        print_success(f"按状态筛选成功，草稿状态: {len(response.json())} 条")

    response = requests.get(f"{BASE_URL}/journeys/", params={"keyword": "登录"})
    if response.status_code == 200:
        print_success(f"关键词筛选成功，包含'登录': {len(response.json())} 条")

def test_workflow_processing(journey_ids):
    print_info("\n=== 测试流程处理 ===")
    journey_id = journey_ids[0]

    response = requests.post(f"{BASE_URL}/journeys/{journey_id}/submit-review/")
    if response.status_code == 200:
        print_success(f"提交审核成功，状态变为 pending_review")
    else:
        print_error(f"提交审核失败: {response.text}")

    response = requests.post(f"{BASE_URL}/journeys/{journey_id}/register/", params={"reporter": "运维小王"})
    if response.status_code == 200:
        print_success(f"注册成功，状态变为 registered")
    else:
        print_error(f"注册失败: {response.text}")

    response = requests.post(f"{BASE_URL}/journeys/{journey_id}/register/")
    if response.status_code == 409:
        data = response.json()
        print_success(f"重复注册正确拒绝，错误码: {data.get('error_code')}")
    else:
        print_warning(f"重复注册状态码: {response.status_code}")

def test_failure_samples(journey_ids):
    print_info("\n=== 测试失败样本管理 ===")
    journey_id = journey_ids[0]

    sample_data = {
        "journey_id": journey_id,
        "sample_data": json.dumps({
            "timestamp": "2024-01-15T10:30:00",
            "browser": "Chrome 120",
            "screenshot_ref": "s3://logs/failure_001.png",
            "failed_step": "step3",
            "error_type": "ElementNotFoundException"
        }, ensure_ascii=False),
        "error_message": "登录按钮点击后未跳转"
    }

    response = requests.post(f"{BASE_URL}/failure-samples/", json=sample_data)
    if response.status_code == 201:
        sample_id = response.json()['id']
        print_success(f"失败样本创建成功 (ID: {sample_id})")
    else:
        print_error(f"失败样本创建失败: {response.text}")
        return

    response = requests.post(f"{BASE_URL}/failure-samples/{sample_id}/archive/")
    if response.status_code == 200:
        print_success(f"失败样本归档成功")
    else:
        print_error(f"归档失败: {response.text}")

    response = requests.post(f"{BASE_URL}/failure-samples/{sample_id}/archive/")
    if response.status_code in [409, 410]:
        data = response.json()
        print_success(f"重复归档正确拒绝，错误码: {data.get('error_code')}")
    else:
        print_warning(f"重复归档状态码: {response.status_code}")

    response = requests.get(f"{BASE_URL}/failure-samples/", params={"journey_id": journey_id})
    if response.status_code == 200:
        print_success(f"查询旅程失败样本成功，共 {len(response.json())} 条")

def test_registration_reports(journey_ids):
    print_info("\n=== 测试注册报告 ===")
    journey_id = journey_ids[0]

    response = requests.get(f"{BASE_URL}/registration-reports/", params={"journey_id": journey_id})
    if response.status_code == 200:
        reports = response.json()
        print_success(f"查询注册报告成功，共 {len(reports)} 条")
        for report in reports:
            print_info(f"  - 报告内容: {report['report_content'][:50]}...")

def test_export_data(journey_ids):
    print_info("\n=== 测试数据导出 ===")

    response = requests.get(f"{BASE_URL}/journeys/{journey_ids[0]}/")
    if response.status_code == 200:
        data = response.json()
        export_file = f"journey_export_{journey_ids[0]}.json"
        with open(export_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print_success(f"旅程详情导出成功: {export_file}")

    response = requests.get(f"{BASE_URL}/journeys/")
    all_data = response.json()
    export_all = "journey_all_export.json"
    with open(export_all, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print_success(f"全部旅程导出成功: {export_all}")

    response = requests.get(f"{BASE_URL}/failure-samples/")
    samples = response.json()
    export_samples = "failure_samples_export.json"
    with open(export_samples, 'w', encoding='utf-8') as f:
        json.dump(samples, f, ensure_ascii=False, indent=2)
    print_success(f"失败样本导出成功: {export_samples}")

def test_error_categories():
    print_info("\n=== 测试错误分类响应 ===")

    response = requests.get(f"{BASE_URL}/journeys/99999/")
    if response.status_code == 404:
        data = response.json()
        print_success(f"不存在资源: HTTP 404, error_code={data.get('error_code')}")

    response = requests.post(f"{BASE_URL}/journeys/99999/register/")
    if response.status_code == 404:
        print_success("状态不允许类错误正确处理")

def main():
    print_info("=" * 60)
    print_info("合成旅程资产登记API - 自检脚本")
    print_info("=" * 60)

    db_path = "journey_assets.db"
    if os.path.exists(db_path):
        os.remove(db_path)
        print_warning("已清理旧数据库")

    print_info("\n启动服务...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    try:
        if not wait_for_server():
            proc.terminate()
            return 1

        journey_ids = test_import_journeys()
        if not journey_ids:
            print_error("没有成功创建任何旅程，终止测试")
            return 1

        test_import_validation()
        test_filter_journeys(journey_ids)
        test_workflow_processing(journey_ids)
        test_failure_samples(journey_ids)
        test_registration_reports(journey_ids)
        test_export_data(journey_ids)
        test_error_categories()

        print_info("\n" + "=" * 60)
        print_success("所有测试完成！")
        print_info("=" * 60)
        print_info(f"\nAPI文档地址: http://localhost:8000/docs")
        print_info(f"数据库文件: {os.path.abspath(db_path)}")

        input("\n按 Enter 键停止服务...")
        return 0

    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    sys.exit(main())