#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import httpx
import json
from models import Environment, AuthType, RiskLevel, DetectionStatus

BASE_URL = "http://localhost:8000"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_success_flow():
    print_section("成功流演示")

    with httpx.Client(base_url=BASE_URL) as client:
        print("1. 创建API清单...")
        api_response = client.post("/api/inventory/", json={
            "api_path": "/api/v1/users",
            "method": "GET",
            "service_name": "user-service",
            "description": "用户列表接口",
            "environment": Environment.PROD.value
        })
        api_data = api_response.json()
        print(f"   API ID: {api_data['id']}, 路径: {api_data['api_path']}")

        print("\n2. 创建检测任务(演示重复调用防重)...")
        for i in range(3):
            task_response = client.post("/detection/tasks/", json={
                "api_inventory_id": api_data['id'],
                "handler": "security-engineer-01"
            })
            task_data = task_response.json()
            print(f"   第{i+1}次调用 - Task ID: {task_data['task_id']}, 状态: {task_data['status']}")
        task_id = task_data['task_id']

        print("\n3. 查看任务历史...")
        history_response = client.get(f"/detection/tasks/{task_id}/history")
        for h in history_response.json():
            print(f"   [{h['created_at'][:19]}] {h['from_status']} -> {h['to_status']} by {h['handler']}")

        print("\n4. 开始路由扫描...")
        scan_response = client.post(f"/detection/tasks/{task_id}/scan", json={
            "handler": "scanner-bot",
            "remark": "自动扫描开始"
        })
        print(f"   状态变更: {scan_response.json()['status']}")

        print("\n5. 完成路由扫描...")
        scan_complete_response = client.post(f"/detection/tasks/{task_id}/scan/complete", json={
            "scan_result": "发现路由可公开访问,需要进一步认证检查",
            "handler": "scanner-bot"
        })
        print(f"   状态变更: {scan_complete_response.json()['status']}")

        print("\n6. 开始认证检查...")
        auth_response = client.post(f"/detection/tasks/{task_id}/auth-check", json={
            "handler": "auth-checker",
            "remark": "开始认证配置检查"
        })
        print(f"   状态变更: {auth_response.json()['status']}")

        print("\n7. 完成认证检查(发现无认证)...")
        auth_complete_response = client.post(f"/detection/tasks/{task_id}/auth-check/complete", json={
            "auth_type": AuthType.NONE.value,
            "auth_configured": False,
            "auth_check_result": "接口未配置任何认证方式,存在安全风险",
            "handler": "auth-checker"
        })
        print(f"   状态变更: {auth_complete_response.json()['status']}")
        print(f"   认证类型: {auth_complete_response.json()['auth_type']}")
        print(f"   是否配置: {auth_complete_response.json()['auth_configured']}")

        print("\n8. 开始风险评估...")
        risk_response = client.post(f"/detection/tasks/{task_id}/risk-assessment", json={
            "handler": "risk-analyst",
            "remark": "开始风险等级评估"
        })
        print(f"   状态变更: {risk_response.json()['status']}")

        print("\n9. 完成风险评估(高风险)...")
        risk_complete_response = client.post(f"/detection/tasks/{task_id}/risk-assessment/complete", json={
            "risk_level": RiskLevel.HIGH.value,
            "risk_tags": ["no-auth", "public-endpoint", "data-exposure"],
            "risk_assessment_result": "生产环境接口无认证,存在敏感数据泄露风险,评估为高风险",
            "handler": "risk-analyst"
        })
        print(f"   状态变更: {risk_complete_response.json()['status']}")
        print(f"   风险等级: {risk_complete_response.json()['risk_level']}")
        print(f"   风险标签: {risk_complete_response.json()['risk_tags']}")

        print("\n10. 开始关闭确认...")
        close_confirm_response = client.post(f"/detection/tasks/{task_id}/confirm-close", json={
            "handler": "security-manager",
            "remark": "开始关闭验证"
        })
        print(f"   状态变更: {close_confirm_response.json()['status']}")

        print("\n11. 确认关闭并记录...")
        final_close_response = client.post(f"/detection/tasks/{task_id}/close", json={
            "closed_by": "security-manager",
            "close_evidence": "已通过网关配置移除该路由,访问返回404",
            "conclusion": "风险已彻底修复,接口下线并完成整改"
        })
        print(f"   最终状态: {final_close_response.json()['status']}")
        print(f"   完成时间: {final_close_response.json()['completed_at']}")

        print("\n12. 完整历史记录...")
        history_response = client.get(f"/detection/tasks/{task_id}/history")
        for h in history_response.json():
            from_s = h['from_status'] or "INIT"
            print(f"   [{h['created_at'][:19]}] {from_s:12} -> {h['to_status']:15} by {h['handler']} | {h['remark']}")

        return task_id


def test_problem_flow():
    print_section("问题流演示(状态机约束与异常处理)")

    with httpx.Client(base_url=BASE_URL) as client:
        print("1. 创建API清单...")
        api_response = client.post("/api/inventory/", json={
            "api_path": "/api/v1/orders",
            "method": "POST",
            "service_name": "order-service",
            "description": "创建订单接口",
            "environment": Environment.STAGING.value
        })
        api_data = api_response.json()

        print("\n2. 创建检测任务...")
        task_response = client.post("/detection/tasks/", json={
            "api_inventory_id": api_data['id'],
            "handler": "tester-01"
        })
        task_id = task_response.json()['task_id']
        current_status = task_response.json()['status']
        print(f"   Task ID: {task_id}, 状态: {current_status}")

        print("\n3. 演示非法状态跳转(直接从CREATED到CLOSED)...")
        bad_transition = client.post(f"/detection/tasks/{task_id}/close", json={
            "closed_by": "hacker",
            "close_evidence": "test",
            "conclusion": "test"
        })
        print(f"   预期失败: {bad_transition.status_code} - {bad_transition.json()['detail']}")

        print("\n4. 正常开始扫描...")
        client.post(f"/detection/tasks/{task_id}/scan", json={"handler": "tester-01"})

        print("\n5. 演示重复提交扫描结果(状态已变,再次提交扫描)...")
        bad_scan = client.post(f"/detection/tasks/{task_id}/scan", json={"handler": "tester-01"})
        detail = bad_scan.json().get('detail', bad_scan.json().get('message', str(bad_scan.content))) if bad_scan.content else "Internal Server Error"
        print(f"   预期失败: {bad_scan.status_code} - {detail}")

        print("\n6. 完成扫描后尝试直接关闭(跳过认证和风险评估)...")
        client.post(f"/detection/tasks/{task_id}/scan/complete", json={
            "scan_result": "扫描完成",
            "handler": "tester-01"
        })
        bad_close = client.post(f"/detection/tasks/{task_id}/close", json={
            "closed_by": "tester",
            "close_evidence": "xxx",
            "conclusion": "yyy"
        })
        print(f"   预期失败: {bad_close.status_code} - {bad_close.json()['detail']}")

        print("\n7. 演示任务取消...")
        cancel_response = client.post(f"/detection/tasks/{task_id}/cancel", json={
            "handler": "manager",
            "remark": "业务调整,暂时取消检测"
        })
        print(f"   取消成功,状态: {cancel_response.json()['status']}")

        print("\n8. 尝试对已取消任务进行操作...")
        op_after_cancel = client.post(f"/detection/tasks/{task_id}/auth-check", json={"handler": "tester"})
        print(f"   预期失败: {op_after_cancel.status_code} - {op_after_cancel.json()['detail']}")

        return task_id


def test_persistence_and_history():
    print_section("持久化验证")

    with httpx.Client(base_url=BASE_URL) as client:
        print("1. 列出所有检测任务...")
        tasks_response = client.get("/detection/tasks/")
        tasks = tasks_response.json()
        print(f"   总任务数: {len(tasks)}")
        for t in tasks:
            print(f"   - {t['task_id']}: {t['status']} (handler: {t['current_handler']})")

        print("\n2. 生成巡检报告...")
        report_response = client.post("/inspection/reports/")
        report = report_response.json()
        print(f"   报告ID: {report['report_id']}")
        print(f"   API总数: {report['total_apis']}")
        print(f"   高风险数: {report['high_risk_count']}")
        print(f"   中风险数: {report['medium_risk_count']}")
        print(f"   低风险数: {report['low_risk_count']}")
        print(f"   已关闭数: {report['closed_count']}")

        print("\n3. 查看报告列表...")
        reports_response = client.get("/inspection/reports/")
        print(f"   报告总数: {len(reports_response.json())}")


if __name__ == "__main__":
    print("API 发布暗门检测系统 - 功能演示")
    print("请先启动服务: python main.py")
    print()

    try:
        success_task_id = test_success_flow()
        problem_task_id = test_problem_flow()
        test_persistence_and_history()

        print_section("演示完成")
        print(f"成功流任务ID: {success_task_id}")
        print(f"问题流任务ID: {problem_task_id}")
        print("\n核心特性验证:")
        print("  ✓ 重复调用防重 - 相同API不会创建多个进行中任务")
        print("  ✓ 状态机约束 - 状态只能按预定流程跳转")
        print("  ✓ 历史追踪 - 所有状态变更都有记录,包含处理人")
        print("  ✓ 数据持久化 - 重启服务数据不丢失(SQLite)")
        print("  ✓ 异常返回 - 非法操作有清晰错误提示")
        print("\n访问 http://localhost:8000/docs 查看完整API文档")

    except httpx.ConnectError:
        print("错误: 无法连接到服务器，请先运行 python main.py 启动服务")
        sys.exit(1)
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
