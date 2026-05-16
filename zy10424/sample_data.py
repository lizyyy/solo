import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    print(f"Status: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except:
        print(response.text)


def create_sample_cleanups():
    print("\n" + "#"*60)
    print("#  创建样例清理任务")
    print("#"*60)

    sample_1 = {
        "sandbox_id": "SANDBOX-001",
        "preservation_tag": "no_preservation",
        "created_by": "admin",
        "assignee": "operator_a",
        "remarks": "常规清理任务",
        "raw_input": {"source": "scheduler", "trigger": "daily_cleanup"}
    }

    sample_2 = {
        "sandbox_id": "SANDBOX-002",
        "preservation_tag": "under_investigation",
        "created_by": "analyst",
        "assignee": "operator_b",
        "remarks": "样本正在分析中，需要保全",
        "resource_inventory": [
            {
                "resource_id": "FILE-001",
                "resource_type": "file",
                "resource_name": "malware_sample.exe",
                "size_bytes": 1024000,
                "should_preserve": True,
                "preserve_reason": "正在分析的恶意样本"
            },
            {
                "resource_id": "FILE-002",
                "resource_type": "file",
                "resource_name": "analysis_log.txt",
                "size_bytes": 51200,
                "should_preserve": False
            }
        ],
        "cleanup_plan": {
            "estimated_resources": 2,
            "estimated_duration_minutes": 5,
            "priority": "low",
            "cleanup_scope": ["files"]
        },
        "raw_input": {"source": "manual", "trigger": "security_alert"}
    }

    sample_3 = {
        "sandbox_id": "SANDBOX-003",
        "preservation_tag": "evidence",
        "created_by": "security_team",
        "assignee": "forensics",
        "remarks": "取证证据，需要永久保全",
        "raw_input": {"source": "incident_response", "case_id": "IR-2024-001"}
    }

    r1 = requests.post(f"{BASE_URL}/api/v1/cleanups", json=sample_1)
    r2 = requests.post(f"{BASE_URL}/api/v1/cleanups", json=sample_2)
    r3 = requests.post(f"{BASE_URL}/api/v1/cleanups", json=sample_3)

    print_response("创建任务 1 (无保全)", r1)
    print_response("创建任务 2 (正在调查)", r2)
    print_response("创建任务 3 (证据保全)", r3)

    return [r1.json(), r2.json(), r3.json()]


def demo_state_transitions(cleanups):
    print("\n" + "#"*60)
    print("#  演示状态转换流程")
    print("#"*60)

    cleanup_1 = cleanups[0]
    cleanup_id = cleanup_1["cleanup_id"]

    transitions = [
        ("inventorying", "开始资源清点", "operator_a"),
        ("inventory_done", "资源清点完成", "operator_a"),
        ("preservation_checking", "保全检查中", "operator_a"),
        ("ready_to_clean", "准备清理", "operator_a"),
        ("cleaning", "执行清理中", "operator_a"),
        ("completed", "清理完成", "operator_a")
    ]

    for status, conclusion, operator in transitions:
        data = {
            "target_status": status,
            "operator": operator,
            "processing_conclusion": conclusion,
            "details": {"step": status}
        }
        r = requests.post(f"{BASE_URL}/api/v1/cleanups/{cleanup_id}/transition", json=data)
        print_response(f"状态转换 -> {status}", r)


def demo_preservation_intercept(cleanups):
    print("\n" + "#"*60)
    print("#  演示保全拦截（正在调查的沙箱不能清理）")
    print("#"*60)

    cleanup_2 = cleanups[1]
    cleanup_id = cleanup_2["cleanup_id"]

    transitions = [
        ("inventorying", "开始资源清点", "operator_b"),
        ("inventory_done", "资源清点完成", "operator_b"),
        ("preservation_checking", "保全检查中", "operator_b"),
    ]

    for status, conclusion, operator in transitions:
        data = {
            "target_status": status,
            "operator": operator,
            "processing_conclusion": conclusion
        }
        requests.post(f"{BASE_URL}/api/v1/cleanups/{cleanup_id}/transition", json=data)

    intercept_data = {
        "target_status": "ready_to_clean",
        "operator": "operator_b",
        "processing_conclusion": "尝试推进到准备清理状态"
    }
    r = requests.post(f"{BASE_URL}/api/v1/cleanups/{cleanup_id}/transition", json=intercept_data)
    print_response("保全拦截演示", r)


def demo_revoke_cleanup(cleanups):
    print("\n" + "#"*60)
    print("#  演示撤销清理任务")
    print("#"*60)

    cleanup_3 = cleanups[2]
    cleanup_id = cleanup_3["cleanup_id"]

    revoke_data = {
        "revoke_reason": "样本需要进一步分析，暂缓清理",
        "revoked_by": "security_manager",
        "details": {"review_priority": "high"}
    }

    r = requests.post(f"{BASE_URL}/api/v1/cleanups/{cleanup_id}/revoke", json=revoke_data)
    print_response("撤销清理任务", r)


def demo_error_handling(cleanups):
    print("\n" + "#"*60)
    print("#  演示异常记录处理")
    print("#"*60)

    cleanup_1 = cleanups[0]
    cleanup_id = cleanup_1["cleanup_id"]

    error_data = {
        "error_message": "资源清点失败，网络连接超时",
        "operator": "operator_a",
        "raw_input_snapshot": {
            "resource_list": ["file1", "file2"],
            "retry_count": 3
        },
        "processing_notes": "尝试重试3次后仍然失败"
    }

    r = requests.post(f"{BASE_URL}/api/v1/cleanups/{cleanup_id}/error", json=error_data)
    print_response("记录异常", r)


def demo_manual_correction(cleanups):
    print("\n" + "#"*60)
    print("#  演示人工修正（从ERROR状态恢复）")
    print("#"*60)

    cleanup_1 = cleanups[0]
    cleanup_id = cleanup_1["cleanup_id"]

    correction_data = {
        "corrected_status": "pending",
        "modified_by": "admin",
        "modification_reason": "网络已恢复，重置状态重新执行",
        "details": {"network_fixed": True}
    }

    r = requests.post(f"{BASE_URL}/api/v1/cleanups/{cleanup_id}/manual-correction", json=correction_data)
    print_response("人工修正状态", r)


def demo_export_summary():
    print("\n" + "#"*60)
    print("#  演示导出清理摘要")
    print("#"*60)

    export_filter = {
        "export_format": "json"
    }

    r = requests.post(f"{BASE_URL}/api/v1/cleanups/export", json=export_filter)
    print_response("导出所有清理摘要", r)

    export_filter2 = {
        "has_preservation": True,
        "export_format": "json"
    }

    r2 = requests.post(f"{BASE_URL}/api/v1/cleanups/export", json=export_filter2)
    print_response("导出有保全标签的清理任务", r2)


def demo_query_with_audit_logs(cleanups):
    print("\n" + "#"*60)
    print("#  演示查询任务详情（含审计日志）")
    print("#"*60)

    cleanup_1 = cleanups[0]
    cleanup_id = cleanup_1["cleanup_id"]

    r = requests.get(f"{BASE_URL}/api/v1/cleanups/{cleanup_id}?include_audit_logs=true")
    print_response("查询任务详情（含审计日志）", r)


def demo_invalid_transition():
    print("\n" + "#"*60)
    print("#  演示非法状态转换（状态机边界检查）")
    print("#"*60)

    r = requests.get(f"{BASE_URL}/api/v1/status/valid-transitions")
    print_response("查看合法状态转换图", r)


def main():
    print("\n" + "="*60)
    print("  沙箱清理保全API - 完整功能演示")
    print("="*60)

    try:
        cleanups = create_sample_cleanups()

        demo_state_transitions(cleanups)
        demo_preservation_intercept(cleanups)
        demo_revoke_cleanup(cleanups)
        demo_error_handling(cleanups)
        demo_manual_correction(cleanups)
        demo_export_summary()
        demo_query_with_audit_logs(cleanups)
        demo_invalid_transition()

        print("\n" + "="*60)
        print("  演示完成！")
        print("="*60)
        print(f"\nAPI文档地址: {BASE_URL}/docs")

    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到API服务器")
        print("请先运行: python main.py")
        print("或: uvicorn main:app --reload")


if __name__ == "__main__":
    main()
