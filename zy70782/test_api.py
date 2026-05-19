#!/usr/bin/env python3
"""
K8s Requests/Limits Checker API 自检脚本
验证导入、筛选、处理和导出功能
"""

import os
import sys
import json
import time
import requests
from pathlib import Path

BASE_URL = "http://localhost:8000"
TEST_DIR = str(Path(__file__).parent / "test_yamls")


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'


def print_success(msg):
    print(f"{Colors.GREEN}✓ PASS:{Colors.ENDC} {msg}")


def print_error(msg):
    print(f"{Colors.RED}✗ FAIL:{Colors.ENDC} {msg}")


def print_info(msg):
    print(f"{Colors.BLUE}ℹ INFO:{Colors.ENDC} {msg}")


def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ WARN:{Colors.ENDC} {msg}")


def wait_for_server(timeout=30):
    """等待服务器启动"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{BASE_URL}/docs", timeout=2)
            if response.status_code == 200:
                return True
        except requests.exceptions.RequestException:
            pass
        time.sleep(1)
    return False


def test_1_import_directory():
    """测试1: 导入YAML目录"""
    print_info("Test 1: 导入YAML目录")

    response = requests.post(
        f"{BASE_URL}/api/directories/import",
        json={"directory_path": TEST_DIR}
    )

    if response.status_code == 200:
        data = response.json()
        print_success(f"目录导入成功，directory_id={data['directory_id']}")
        print_success(f"扫描了 {data['total_files']} 个文件，发现 {data['total_containers']} 个容器")
        return data['directory_id']
    else:
        error = response.json()
        if error.get('detail', {}).get('error_code') == 'ALREADY_PROCESSED':
            print_warning("目录已经导入过，继续测试")
            return 1
        print_error(f"目录导入失败: {response.text}")
        return None


def test_2_list_containers():
    """测试2: 列出容器，筛选功能"""
    print_info("Test 2: 列出容器和筛选")
    all_passed = True

    response = requests.get(f"{BASE_URL}/api/containers")
    if response.status_code == 200:
        containers = response.json()
        print_success(f"成功列出所有容器，共 {len(containers)} 个")
    else:
        print_error(f"列出容器失败: {response.text}")
        all_passed = False

    response = requests.get(f"{BASE_URL}/api/containers", params={"namespace": "frontend"})
    if response.status_code == 200:
        containers = response.json()
        print_success(f"按命名空间筛选成功，frontend 有 {len(containers)} 个容器")
    else:
        print_error(f"按命名空间筛选失败: {response.text}")
        all_passed = False

    response = requests.get(f"{BASE_URL}/api/containers", params={"issue_type": "missing_both"})
    if response.status_code == 200:
        containers = response.json()
        print_success(f"按问题类型筛选成功，missing_both 有 {len(containers)} 个容器")
    else:
        print_error(f"按问题类型筛选失败: {response.text}")
        all_passed = False

    return all_passed


def test_3_namespace_aggregation():
    """测试3: 命名空间聚合统计"""
    print_info("Test 3: 命名空间聚合统计")

    response = requests.get(f"{BASE_URL}/api/namespaces")
    if response.status_code == 200:
        namespaces = response.json()
        print_success(f"成功获取命名空间统计，共 {len(namespaces)} 个命名空间")
        for ns in namespaces:
            print_info(f"  - {ns['namespace']}: {ns['total_containers']} 个容器, {ns['total_issues']} 个问题")
        return True
    else:
        print_error(f"获取命名空间统计失败: {response.text}")
        return False


def test_4_status_workflow():
    """测试4: 状态工作流（含异常流）"""
    print_info("Test 4: 状态工作流")
    all_passed = True

    response = requests.get(f"{BASE_URL}/api/containers", params={"limit": 1})
    container = response.json()[0]
    container_id = container['id']
    print_info(f"测试容器 ID: {container_id}, 当前状态: {container['status']}")

    response = requests.patch(
        f"{BASE_URL}/api/containers/{container_id}/status",
        json={"status": "needs_review", "notes": "需要人工复核资源配置"}
    )
    if response.status_code == 200:
        print_success("成功将状态更新为 needs_review")
    else:
        print_error(f"更新为 needs_review 失败: {response.text}")
        all_passed = False

    response = requests.patch(
        f"{BASE_URL}/api/containers/{container_id}/status",
        json={"status": "processed"}
    )
    if response.status_code == 200:
        print_success("成功将状态更新为 processed")
    else:
        print_error(f"更新为 processed 失败: {response.text}")
        all_passed = False

    response = requests.patch(
        f"{BASE_URL}/api/containers/{container_id}/status",
        json={"status": "pending"}
    )
    if response.status_code == 409:
        error = response.json()
        if error.get('detail', {}).get('error_code') == 'STATUS_NOT_ALLOWED':
            print_success("正确阻止了从 processed 回退到 pending")
        else:
            print_error(f"错误响应不正确: {response.text}")
            all_passed = False
    else:
        print_error("应该返回 409 状态码")
        all_passed = False

    return all_passed


def test_5_error_handling():
    """测试5: 错误处理"""
    print_info("Test 5: 错误处理验证")
    all_passed = True

    response = requests.post(f"{BASE_URL}/api/directories/import", json={"directory_path": ""})
    if response.status_code == 400:
        error = response.json()
        if error.get('detail', {}).get('error_code') == 'MISSING_FIELD':
            print_success("正确处理了缺失字段的情况")
        else:
            print_error(f"错误码不正确: {response.text}")
            all_passed = False
    else:
        print_error("应该返回 400 状态码")
        all_passed = False

    response = requests.post(f"{BASE_URL}/api/directories/import", json={"directory_path": "/nonexistent/path"})
    if response.status_code == 400:
        error = response.json()
        if error.get('detail', {}).get('error_code') == 'INVALID_DIRECTORY':
            print_success("正确处理了不存在目录的情况")
        else:
            print_error(f"错误码不正确: {response.text}")
            all_passed = False
    else:
        print_error("应该返回 400 状态码")
        all_passed = False

    response = requests.get(f"{BASE_URL}/api/containers/99999")
    if response.status_code == 404:
        error = response.json()
        if error.get('detail', {}).get('error_code') == 'NOT_FOUND':
            print_success("正确处理了容器不存在的情况")
        else:
            print_error(f"错误码不正确: {response.text}")
            all_passed = False
    else:
        print_error("应该返回 404 状态码")
        all_passed = False

    return all_passed


def test_6_report_generation_and_export():
    """测试6: 报告生成和导出"""
    print_info("Test 6: 报告生成和导出")
    all_passed = True

    response = requests.post(f"{BASE_URL}/api/reports/generate", json={})
    if response.status_code == 200:
        report_data = response.json()
        report_id = report_data['report_id']
        print_success(f"成功生成报告，report_id={report_id}")
        summary = report_data['summary']
        print_info(f"  总计: {summary['total_containers']} 个容器")
        print_info(f"  缺失 requests: {summary['by_issue_type']['missing_requests']}")
        print_info(f"  缺失 limits: {summary['by_issue_type']['missing_limits']}")
        print_info(f"  缺失两者: {summary['by_issue_type']['missing_both']}")
        print_info(f"  比例问题: {summary['by_issue_type']['ratio_mismatch']}")
    else:
        print_error(f"生成报告失败: {response.text}")
        return False

    response = requests.get(f"{BASE_URL}/api/reports/{report_id}/export")
    if response.status_code == 200:
        export_data = response.json()
        print_success(f"成功导出报告，包含 {len(export_data['containers'])} 个容器数据")
        output_file = Path(__file__).parent / "report_export.json"
        with open(output_file, 'w') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        print_success(f"报告已导出到: {output_file}")
    else:
        print_error(f"导出报告失败: {response.text}")
        all_passed = False

    return all_passed


def test_7_statistics():
    """测试7: 统计信息"""
    print_info("Test 7: 统计信息")

    response = requests.get(f"{BASE_URL}/api/statistics")
    if response.status_code == 200:
        stats = response.json()
        print_success(f"成功获取统计信息")
        print_info(f"  总容器数: {stats['total_containers']}")
        print_info(f"  命名空间数: {stats['namespaces_count']}")
        print_info(f"  按问题类型: {json.dumps(stats['by_issue_type'], indent=2)}")
        print_info(f"  按状态: {json.dumps(stats['by_status'], indent=2)}")
        return True
    else:
        print_error(f"获取统计信息失败: {response.text}")
        return False


def main():
    print_info("=" * 60)
    print_info("K8s Requests/Limits Checker API 自检脚本")
    print_info("=" * 60)

    print_info("等待服务器启动...")
    if not wait_for_server():
        print_error("服务器启动超时，请先运行: uvicorn main:app --reload")
        sys.exit(1)
    print_success("服务器已启动")

    results = {}

    results['test_1'] = test_1_import_directory()
    print()
    results['test_2'] = test_2_list_containers()
    print()
    results['test_3'] = test_3_namespace_aggregation()
    print()
    results['test_4'] = test_4_status_workflow()
    print()
    results['test_5'] = test_5_error_handling()
    print()
    results['test_6'] = test_6_report_generation_and_export()
    print()
    results['test_7'] = test_7_statistics()
    print()

    print_info("=" * 60)
    print_info("测试结果汇总")
    print_info("=" * 60)

    passed = sum(1 for r in results.values() if r)
    total = len(results)

    for test_name, result in results.items():
        if result:
            print_success(f"{test_name}")
        else:
            print_error(f"{test_name}")

    print()
    if passed == total:
        print_success(f"所有测试通过! ({passed}/{total})")
    else:
        print_error(f"部分测试失败! ({passed}/{total})")
        sys.exit(1)


if __name__ == "__main__":
    main()
