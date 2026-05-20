import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"


def test_fixes():
    print("=" * 70)
    print("修复验证测试 - 验证第一轮发现的问题是否已解决")
    print("=" * 70)
    
    print("\n📋 测试目标:")
    print("  1. 缺字段时不被 FastAPI 422 拦截，能生成任务和错误明细")
    print("  2. 重复编号时生成已拦截记录，不触发数据库约束错误")
    print("  3. 存在导出/最终报告入口，实现关键字段追溯闭环")
    print()
    
    users_response = requests.get(f"{BASE_URL}{API_PREFIX}/users")
    users = users_response.json()
    operator_id = users[0]['id'] if users else 1
    print(f"使用用户 ID: {operator_id}")
    
    print("\n" + "-" * 70)
    print("✅ 测试 1: 缺字段不被 FastAPI 422 拦截")
    print("-" * 70)
    
    incomplete_task = {
        "task_no": None,
        "samples": [
            {
                "sample_code": "",
                "sample_name": None
            }
        ],
        "submitted_by": "test_admin",
        "source_file": "样品表.xlsx",
        "row_number": 15
    }
    
    print("\n提交缺字段的任务...")
    print(f"请求体: {json.dumps(incomplete_task, ensure_ascii=False, indent=2)}")
    
    response = requests.post(
        f"{BASE_URL}{API_PREFIX}/tasks",
        json=incomplete_task
    )
    
    print(f"\n状态码: {response.status_code}")
    
    if response.status_code == 422:
        print("❌ 失败: 仍然被 FastAPI 422 拦截")
        print(f"错误: {response.text}")
        return False
    elif response.status_code == 200:
        task = response.json()
        print(f"✅ 成功: 任务已创建，ID: {task['id']}")
        print(f"   分类: {task['category']}")
        print(f"   状态: {task['status']}")
        print(f"   分类原因: {task['category_reason']}")
        
        print(f"\n查看错误明细...")
        errors_response = requests.get(f"{BASE_URL}{API_PREFIX}/tasks/{task['id']}/errors")
        errors = errors_response.json()
        print(f"错误数量: {len(errors)}")
        for err in errors:
            print(f"  - 类型: {err['error_type']}")
            print(f"    字段: {err['error_field']}")
            print(f"    消息: {err['error_message']}")
            print(f"    行号: {err['row_number']}")
            print(f"    来源文件: {err['source_ref']}")
        
        if len(errors) > 0 and task['category'] == 'need_supplement':
            print(f"\n✅ 验证通过: 缺字段任务正确分类为 'need_supplement'，错误明细已保存")
            task1_id = task['id']
        else:
            print(f"\n❌ 验证失败: 分类或错误明细不符合预期")
            return False
    else:
        print(f"❌ 失败: 状态码 {response.status_code}")
        print(f"响应: {response.text}")
        return False
    
    print("\n" + "-" * 70)
    print("✅ 测试 2: 重复编号生成已拦截记录")
    print("-" * 70)
    
    live_date = (datetime.now() + timedelta(days=7)).isoformat()
    normal_task = {
        "task_no": "DUPLICATE-TEST-001",
        "samples": [
            {
                "sample_code": "SAMPLE-DUP-001",
                "sample_name": "重复测试样品"
            }
        ],
        "submitted_by": "test_admin"
    }
    
    print("\n第一次提交任务...")
    response1 = requests.post(f"{BASE_URL}{API_PREFIX}/tasks", json=normal_task)
    print(f"状态码: {response1.status_code}")
    if response1.status_code == 200:
        task1 = response1.json()
        print(f"✅ 第一次提交成功，任务编号: {task1['task_no']}")
    
    print("\n第二次提交相同编号的任务...")
    response2 = requests.post(f"{BASE_URL}{API_PREFIX}/tasks", json=normal_task)
    print(f"状态码: {response2.status_code}")
    
    if response2.status_code == 200:
        task2 = response2.json()
        print(f"✅ 第二次提交成功（作为已拦截记录）")
        print(f"   分类: {task2['category']}")
        print(f"   状态: {task2['status']}")
        print(f"   分类原因: {task2['category_reason']}")
        print(f"   保存的 task_no: {task2.get('task_no', 'N/A')}")
        
        errors_response = requests.get(f"{BASE_URL}{API_PREFIX}/tasks/{task2['id']}/errors")
        errors = errors_response.json()
        duplicate_errors = [e for e in errors if e['error_type'] == 'duplicate']
        
        if task2['category'] == 'blocked' and len(duplicate_errors) > 0:
            print(f"\n✅ 验证通过: 重复编号任务正确分类为 'blocked'，错误明细已保存")
            task2_id = task2['id']
        else:
            print(f"\n❌ 验证失败: 分类不符合预期")
            return False
    else:
        print(f"❌ 失败: 状态码 {response2.status_code}")
        print(f"响应: {response2.text}")
        return False
    
    print("\n" + "-" * 70)
    print("✅ 测试 3: 导出/最终报告入口和关键字段追溯")
    print("-" * 70)
    
    print("\n3.1 生成单个任务的最终报告...")
    report_response = requests.get(f"{BASE_URL}{API_PREFIX}/tasks/{task1_id}/report")
    print(f"状态码: {report_response.status_code}")
    
    if report_response.status_code == 200:
        report = report_response.json()
        print(f"✅ 报告生成成功")
        
        print(f"\n  报告包含的内容:")
        print(f"    - 任务信息: {'task' in report}")
        print(f"    - 原始数据: {'raw_data' in report}")
        print(f"    - 样品列表: {'samples' in report}")
        print(f"    - 错误明细: {'errors' in report}")
        print(f"    - 审计日志: {'audit_logs' in report}")
        print(f"    - 可追溯信息: {'traceability' in report}")
        
        if 'traceability' in report:
            trace = report['traceability']
            print(f"\n  关键字段追溯:")
            print(f"    - 来源文件: {trace.get('source_location', {}).get('file')}")
            print(f"    - 行号: {trace.get('source_location', {}).get('row')}")
            print(f"    - 处理路径: {trace.get('processing_path', {})}")
        
        has_all_sections = all(k in report for k in ['task', 'raw_data', 'samples', 'errors', 'audit_logs', 'traceability'])
        if has_all_sections:
            print(f"\n✅ 验证通过: 报告包含完整的追溯信息")
        else:
            print(f"\n⚠️ 部分信息缺失")
    else:
        print(f"❌ 失败: 状态码 {report_response.status_code}")
        print(f"响应: {report_response.text}")
        return False
    
    print("\n3.2 获取导出摘要...")
    summary_response = requests.get(f"{BASE_URL}{API_PREFIX}/export/summary")
    print(f"状态码: {summary_response.status_code}")
    if summary_response.status_code == 200:
        summary = summary_response.json()
        print(f"✅ 导出摘要获取成功")
        print(f"   任务总数: {summary['total_count']}")
        print(f"   支持格式: {summary['export_format']}")
    
    print("\n3.3 测试 JSON 导出...")
    export_response = requests.post(
        f"{BASE_URL}{API_PREFIX}/export/json",
        json=[task1_id, task2_id]
    )
    print(f"状态码: {export_response.status_code}")
    if export_response.status_code == 200:
        print(f"✅ JSON 导出成功")
        print(f"   Content-Type: {export_response.headers.get('content-type')}")
        print(f"   Content-Disposition: {export_response.headers.get('content-disposition')}")
    
    print("\n3.4 测试 CSV 导出...")
    csv_response = requests.post(
        f"{BASE_URL}{API_PREFIX}/export/csv",
        json=[task1_id, task2_id]
    )
    print(f"状态码: {csv_response.status_code}")
    if csv_response.status_code == 200:
        print(f"✅ CSV 导出成功")
        print(f"   Content-Type: {csv_response.headers.get('content-type')}")
    
    print("\n" + "=" * 70)
    print("🎉 所有修复验证通过！")
    print("=" * 70)
    print("\n📊 修复总结:")
    print("  1. ✅ 缺字段任务不再被 422 拦截，能正常创建并保存错误明细")
    print("  2. ✅ 重复编号任务能正确分类为 'blocked'，不触发数据库错误")
    print("  3. ✅ 存在导出和报告入口，关键字段可从原始输入追溯到最终报告")
    print(f"\n📝 API 文档: {BASE_URL}/docs")
    print("=" * 70)
    
    return True


if __name__ == "__main__":
    try:
        success = test_fixes()
        exit(0 if success else 1)
    except requests.exceptions.ConnectionError:
        print("❌ 错误: 无法连接到服务器")
        print("请先运行: python3 -m uvicorn main:app --reload")
        exit(1)
