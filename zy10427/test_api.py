#!/usr/bin/env python3
import json
import requests
import time
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

SAMPLE_DATA = {
    "region_name": "华北-北京机房",
    "created_by": "admin_user",
    "tenant_bindings": [
        {
            "tenant_id": "T001",
            "tenant_name": "电商平台",
            "local_resources": ["MySQL-01", "Redis-Cache", "Object-Storage"],
            "traffic_percentage": 100.0
        },
        {
            "tenant_id": "T002",
            "tenant_name": "支付系统",
            "local_resources": ["PostgreSQL-01", "Kafka-Cluster"],
            "traffic_percentage": 100.0
        },
        {
            "tenant_id": "T003",
            "tenant_name": "用户中心",
            "local_resources": ["MySQL-02", "Elasticsearch"],
            "traffic_percentage": 100.0
        }
    ],
    "local_dependencies": [
        {
            "resource_type": "Database",
            "resource_name": "MySQL-Cluster",
            "is_critical": True,
            "check_status": "PASS",
            "detail": "主从同步正常"
        },
        {
            "resource_type": "Network",
            "resource_name": "Core-Switch",
            "is_critical": True,
            "check_status": "PASS",
            "detail": "带宽充足"
        },
        {
            "resource_type": "Storage",
            "resource_name": "NAS-Storage",
            "is_critical": False,
            "check_status": "PENDING",
            "detail": "容量检查中"
        }
    ],
    "target_percentage": 0.0
}

SAMPLE_DATA_WITH_BLOCKED_DEP = {
    "region_name": "华东-上海机房",
    "created_by": "operator_01",
    "tenant_bindings": [
        {
            "tenant_id": "T101",
            "tenant_name": "日志服务",
            "local_resources": ["Elasticsearch-Cluster"],
            "traffic_percentage": 100.0
        }
    ],
    "local_dependencies": [
        {
            "resource_type": "Database",
            "resource_name": "MySQL-Main",
            "is_critical": True,
            "check_status": "FAIL",
            "detail": "主库连接超时"
        }
    ],
    "target_percentage": 25.0
}


def print_section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def print_response(resp: Dict[str, Any]):
    print(json.dumps(resp, indent=2, ensure_ascii=False))
    print()


def test_create_plan():
    print_section("1. 创建撤离计划")
    url = f"{BASE_URL}/api/v1/plans"
    response = requests.post(url, json=SAMPLE_DATA)
    data = response.json()
    print_response(data)
    return data["data"]["plan_id"] if data.get("data") else None


def test_create_plan_with_blocked_dep():
    print_section("1b. 创建含阻塞依赖的撤离计划")
    url = f"{BASE_URL}/api/v1/plans"
    response = requests.post(url, json=SAMPLE_DATA_WITH_BLOCKED_DEP)
    data = response.json()
    print_response(data)
    return data["data"]["plan_id"] if data.get("data") else None


def test_get_plan(plan_id: str):
    print_section("2. 查询计划详情")
    url = f"{BASE_URL}/api/v1/plans/{plan_id}"
    response = requests.get(url)
    data = response.json()
    print_response(data)


def test_list_plans():
    print_section("3. 查询所有计划")
    url = f"{BASE_URL}/api/v1/plans"
    response = requests.get(url)
    data = response.json()
    print_response(data)


def test_review_plan(plan_id: str, approved: bool = True, reason: str = ""):
    action = "通过" if approved else "驳回"
    print_section(f"4. 复核撤离计划 - {action}")
    url = f"{BASE_URL}/api/v1/plans/{plan_id}/review"
    payload = {
        "operator": "reviewer_admin",
        "approved": approved,
        "reason": reason
    }
    response = requests.post(url, json=payload)
    data = response.json()
    print_response(data)
    return data


def test_advance_step(plan_id: str, force: bool = False):
    print_section("5. 推进撤离步骤")
    url = f"{BASE_URL}/api/v1/plans/{plan_id}/advance"
    payload = {
        "operator": "operator_001",
        "force": force
    }
    response = requests.post(url, json=payload)
    data = response.json()
    print_response(data)
    return data


def test_handle_exception(plan_id: str, compensate: bool = False):
    action = "已补偿" if compensate else "已拦截"
    print_section(f"6. 异常处理 - {action}")
    url = f"{BASE_URL}/api/v1/plans/{plan_id}/exception"
    payload = {
        "operator": "sre_engineer",
        "exception_type": "NETWORK_PARTITION",
        "exception_detail": "机房网络分区，流量切换中断",
        "compensate": compensate
    }
    response = requests.post(url, json=payload)
    data = response.json()
    print_response(data)
    return data


def test_manual_correct(plan_id: str):
    print_section("7. 人工修正")
    url = f"{BASE_URL}/api/v1/plans/{plan_id}/correct"
    payload = {
        "operator": "senior_sre",
        "target_traffic_percentage": 50.0,
        "status": "IN_PROGRESS",
        "block_reason": "人工介入调整流量比例",
        "local_dependencies": [
            {
                "resource_type": "Database",
                "resource_name": "MySQL-Main",
                "check_status": "PASS",
                "detail": "已恢复主库连接"
            }
        ]
    }
    response = requests.post(url, json=payload)
    data = response.json()
    print_response(data)
    return data


def test_get_summary(plan_id: str):
    print_section("8. 导出执行摘要")
    url = f"{BASE_URL}/api/v1/plans/{plan_id}/summary"
    response = requests.get(url)
    data = response.json()
    print_response(data)


def test_get_logs(plan_id: str):
    print_section("9. 查询执行日志")
    url = f"{BASE_URL}/api/v1/plans/{plan_id}/logs"
    response = requests.get(url)
    data = response.json()
    print_response(data)


def run_full_workflow():
    print_section("开始执行完整API闭环测试")
    
    plan_id = test_create_plan()
    if not plan_id:
        print("创建计划失败，终止测试")
        return
    
    print(f"创建的计划ID: {plan_id}\n")
    
    test_get_plan(plan_id)
    test_list_plans()
    test_review_plan(plan_id, approved=True)
    
    for i in range(5):
        result = test_advance_step(plan_id)
        time.sleep(0.5)
        if result.get("data", {}).get("status") == "COMPLETED":
            print("撤离已完成，停止推进")
            break
    
    test_get_summary(plan_id)
    test_get_logs(plan_id)
    
    print_section("完整流程测试完成")
    return plan_id


def run_blocked_dependency_workflow():
    print_section("开始执行依赖阻塞场景测试")
    
    plan_id = test_create_plan_with_blocked_dep()
    if not plan_id:
        print("创建计划失败，终止测试")
        return
    
    print(f"创建的计划ID: {plan_id}\n")
    
    result = test_review_plan(plan_id, approved=True)
    print(f"预期结果: BLOCKED (因依赖检查失败)")
    
    test_manual_correct(plan_id)
    
    test_review_plan(plan_id, approved=True)
    
    test_advance_step(plan_id)
    
    test_handle_exception(plan_id, compensate=True)
    
    test_get_summary(plan_id)
    test_get_logs(plan_id)
    
    print_section("依赖阻塞场景测试完成")


def check_server_ready():
    """检查API服务是否启动"""
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=2)
        return response.status_code in [200, 404]
    except:
        return False


def main():
    print("\n区域流量撤离API - 自动化测试脚本")
    print("="*60)
    
    if not check_server_ready():
        print("\n警告: API服务似乎未启动!")
        print("请先运行: python api.py")
        print("或: uvicorn api:app --reload --host 0.0.0.0 --port 8000")
        print("\n是否继续尝试运行测试? (y/n)")
        choice = input().strip().lower()
        if choice != 'y':
            return
    
    print("\n请选择测试模式:")
    print("1. 完整撤离流程测试")
    print("2. 依赖阻塞场景测试")
    print("3. 运行所有测试")
    print("0. 退出")
    
    choice = input("\n请输入选项 (0-3): ").strip()
    
    if choice == "1":
        run_full_workflow()
    elif choice == "2":
        run_blocked_dependency_workflow()
    elif choice == "3":
        plan1 = run_full_workflow()
        print("\n\n")
        plan2 = run_blocked_dependency_workflow()
        print(f"\n\n测试完成! 共创建{len([p for p in [plan1, plan2] if p])}个计划")
    elif choice == "0":
        print("退出测试")
        return
    else:
        print("无效选项")
    
    print("\n测试脚本执行完毕!")
    print(f"\nAPI文档地址: {BASE_URL}/docs")
    print(f"数据存储位置: ./data/evacuation_plans.json")


if __name__ == "__main__":
    main()
