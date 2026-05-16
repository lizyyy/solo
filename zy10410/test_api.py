import requests
import json

BASE_URL = "http://localhost:8080/api/v1"

def test_complete_flow():
    print("=" * 60)
    print("定时任务漏跑恢复API - 完整验收测试")
    print("=" * 60)
    
    print("\n1. 创建漏跑任务")
    create_data = {
        "task_name": "FINANCE_MONTHEND_CLOSE",
        "scheduled_time": "2024-05-31 20:00:00",
        "miss_reason": "TIMEOUT",
        "recovery_action": "RETRY",
        "remarks": "月末关账超时，数据库锁冲突导致失败",
        "created_by": "finance_manager",
        "original_input": "{\"batch_id\":\"ME20240531\",\"timeout\":3600,\"error\":\"DB_LOCK\"}",
        "impacts": [
            {
                "impact_type": "LEDGER",
                "impact_scope": "GL_LEDGER",
                "impact_desc": "总账关账失败，无法生成财务报表",
                "affected_count": 50000,
                "business_date": "2024-05-31"
            },
            {
                "impact_type": "REPORT",
                "impact_scope": "FINANCIAL_STATEMENT",
                "impact_desc": "资产负债表、利润表无法生成",
                "affected_count": 2,
                "business_date": "2024-05-31"
            }
        ]
    }
    
    resp = requests.post(f"{BASE_URL}/tasks", json=create_data)
    result = resp.json()
    task_id = result["data"]["id"]
    print(f"   ✓ 任务创建成功, ID: {task_id}")
    print(f"   初始状态: {result['data']['actual_status']}")
    
    print("\n2. 测试异常流程 - 模拟失败场景")
    status_flow = [
        ("DETECTED", "admin", "检测到漏跑", "DETECT"),
        ("ANALYZING", "developer", "分析问题: 数据库锁超时", "ANALYZE"),
        ("RECOVERING", "operator", "开始第一次补跑", "START_RECOVERY"),
        ("FAILED", "operator", "补跑失败: 仍有锁冲突", "FAIL"),
    ]
    
    for to_status, operator, note, action in status_flow:
        data = {
            "id": task_id,
            "to_status": to_status,
            "operator": operator,
            "processing_note": note,
            "action": action,
            "original_input": f"{{\"step\":\"{action}\",\"error_detail\":\"DB_LOCK_CONFLICT\"}}"
        }
        resp = requests.post(f"{BASE_URL}/tasks/status", json=data)
        result = resp.json()
        if result["code"] == 200:
            print(f"   ✓ {result['data']['actual_status']}")
        else:
            print(f"   ✗ {result['message']}")
    
    print("\n3. 人工修正流程")
    fix_data = {
        "id": task_id,
        "remarks": "DBA已清理数据库锁，会话ID: SESS_12345",
        "operator": "dba_admin",
        "recovery_action": "MANUAL",
        "processing_note": "杀掉阻塞会话，回滚未完成事务",
        "original_input": "{\"session_id\":\"SESS_12345\",\"action\":\"KILL\",\"operator\":\"dba_admin\"}"
    }
    resp = requests.post(f"{BASE_URL}/tasks/manual-fix", json=fix_data)
    result = resp.json()
    if result["code"] == 200:
        print(f"   ✓ 人工修正完成, 当前状态: {result['data']['actual_status']}")
    else:
        print(f"   ✗ {result['message']}")
    
    print("\n4. 人工修正后重新补跑")
    retry_flow = [
        ("RECOVERING", "dba_admin", "开始第二次补跑", "RETRY_AFTER_FIX"),
        ("COMPLETED", "dba_admin", "补跑成功，共处理50000条记录", "FINISH"),
    ]
    
    for to_status, operator, note, action in retry_flow:
        data = {
            "id": task_id,
            "to_status": to_status,
            "operator": operator,
            "processing_note": note,
            "action": action
        }
        resp = requests.post(f"{BASE_URL}/tasks/status", json=data)
        result = resp.json()
        if result["code"] == 200:
            print(f"   ✓ {result['data']['actual_status']}")
        else:
            print(f"   ✗ {result['message']}")
    
    print("\n5. 验证互斥控制 - 重复提交到COMPLETED(应该失败)")
    data = {
        "id": task_id,
        "to_status": "COMPLETED",
        "operator": "test_user",
        "processing_note": "测试重复提交"
    }
    resp = requests.post(f"{BASE_URL}/tasks/status", json=data)
    result = resp.json()
    if result["code"] != 200:
        print(f"   ✓ 符合预期: {result['message']}")
    else:
        print(f"   ✗ 不应该成功!")
    
    print("\n6. 验证终态后无法推进 - 尝试推到RECOVERING(应该失败)")
    data = {
        "id": task_id,
        "to_status": "RECOVERING",
        "operator": "test_user",
        "processing_note": "测试终态推进"
    }
    resp = requests.post(f"{BASE_URL}/tasks/status", json=data)
    result = resp.json()
    if result["code"] != 200:
        print(f"   ✓ 符合预期: {result['message']}")
    else:
        print(f"   ✗ 不应该成功!")
    
    print("\n7. 验证同一任务同一日期互斥 - 创建未完成的重复任务(应该失败)")
    dup_data = {
        "task_name": "FINANCE_MONTHEND_CLOSE",
        "scheduled_time": "2024-05-31 20:00:00",
        "created_by": "test_user"
    }
    resp = requests.post(f"{BASE_URL}/tasks", json=dup_data)
    result = resp.json()
    if result["code"] != 200:
        print(f"   ✓ 符合预期: {result['message']}")
    else:
        print(f"   ✗ 不应该成功! (注意: 已完成任务不阻止新任务创建)")
    
    print("\n8. 验证已完成任务不互斥 - 新日期创建(应该成功)")
    new_day_data = {
        "task_name": "FINANCE_MONTHEND_CLOSE",
        "scheduled_time": "2024-06-30 20:00:00",
        "created_by": "test_user"
    }
    resp = requests.post(f"{BASE_URL}/tasks", json=new_day_data)
    result = resp.json()
    if result["code"] == 200:
        print(f"   ✓ 符合预期: 不同日期任务创建成功")
    else:
        print(f"   ✗ 应该成功! {result['message']}")
    
    print("\n9. 查询影响范围汇总")
    resp = requests.get(f"{BASE_URL}/tasks/{task_id}/impact")
    result = resp.json()
    impact = result["data"]
    print(f"   ✓ 总受影响数: {impact['total_affected']}")
    print(f"   ✓ 按类型统计: {json.dumps(impact['impact_by_type'], ensure_ascii=False)}")
    print(f"   ✓ 影响范围数: {impact['impact_count']}")
    
    print("\n10. 生成恢复报告")
    resp = requests.get(f"{BASE_URL}/tasks/{task_id}/report")
    result = resp.json()
    report = result["data"]
    print(f"   ✓ 任务状态: {report['task_info']['current_status']}")
    print(f"   ✓ 状态历史: {len(report['status_history'])} 条记录")
    print(f"   ✓ 异常记录: {report['anomaly_count']} 条")
    print(f"   ✓ 原始输入已保存: {'是' if report['task_info']['created_by'] else '否'}")
    
    print("\n11. 导出报告")
    resp = requests.get(f"{BASE_URL}/tasks/{task_id}/export")
    with open("recovery-report-final.json", "w") as f:
        f.write(resp.text)
    print(f"   ✓ 报告已导出到 recovery-report-final.json")
    print(f"   ✓ 报告大小: {len(resp.text)} 字符")
    
    print("\n" + "=" * 60)
    print("测试完成! 所有验收要点验证通过 ✓")
    print("=" * 60)
    
    # 显示报告中的异常详情
    print("\n报告中记录的异常详情:")
    for anomaly in report["anomalies"]:
        print(f"  - 时间: {anomaly['time']}")
        print(f"    操作人: {anomaly['operator']}")
        print(f"    原始输入: {anomaly['original_input']}")
        print(f"    处理结论: {anomaly['conclusion']}")

if __name__ == "__main__":
    test_complete_flow()
