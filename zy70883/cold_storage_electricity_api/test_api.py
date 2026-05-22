#!/usr/bin/env python3
"""
API服务测试脚本
用于验证冷库租户电费分摊API服务的基本功能
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_create_batch():
    """测试创建批次"""
    print("\n=== 测试创建批次 ===")
    url = f"{BASE_URL}/api/batches/"
    data = {
        "name": "2024年1月电费测试",
        "billing_month": "2024-01",
        "created_by": "测试用户"
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"创建成功! 批次ID: {result['id']}, 批次号: {result['batch_no']}")
            return result['id']
        else:
            print(f"错误: {response.text}")
    except Exception as e:
        print(f"连接失败: {e}")
    return None


def test_get_batches():
    """测试获取批次列表"""
    print("\n=== 测试获取批次列表 ===")
    url = f"{BASE_URL}/api/batches/"
    
    try:
        response = requests.get(url)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            batches = response.json()
            print(f"获取到 {len(batches)} 个批次")
            for batch in batches[:3]:
                print(f"  - {batch['batch_no']}: {batch['name']} ({batch['status']})")
    except Exception as e:
        print(f"连接失败: {e}")


def test_create_electricity_detail(batch_id):
    """测试创建电费明细"""
    print("\n=== 测试创建电费明细 ===")
    url = f"{BASE_URL}/api/electricity-details/"
    
    test_cases = [
        {
            "name": "正常数据",
            "data": {
                "batch_id": batch_id,
                "tenant_code": "T001",
                "tenant_name": "冷链物流A",
                "temperature_zone": "冷冻区-18℃",
                "electricity_rate": 1.2,
                "meter_reading_start": 10000,
                "meter_reading_end": 12500,
                "basic_electricity": 3000,
                "overtime_hours": 8,
                "overtime_electricity": 200,
                "manual_allocation": 100
            }
        },
        {
            "name": "待补充数据（缺少温区）",
            "data": {
                "batch_id": batch_id,
                "tenant_code": "T002",
                "tenant_name": "冷链物流B",
                "temperature_zone": "",
                "electricity_rate": 1.0,
                "meter_reading_start": 8000,
                "meter_reading_end": 9500,
                "basic_electricity": 1500,
                "overtime_hours": 0,
                "overtime_electricity": 0
            }
        },
        {
            "name": "已拦截数据（读数异常）",
            "data": {
                "batch_id": batch_id,
                "tenant_code": "T003",
                "tenant_name": "冷链物流C",
                "temperature_zone": "冷藏区0-4℃",
                "electricity_rate": 1.1,
                "meter_reading_start": 15000,
                "meter_reading_end": 14000,
                "basic_electricity": 2000
            }
        }
    ]
    
    detail_ids = []
    for case in test_cases:
        try:
            response = requests.post(url, json=case['data'])
            print(f"[{case['name']}] 状态码: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                print(f"  分类: {result['category']}, 原因: {result['category_reason']}")
                detail_ids.append(result['id'])
            else:
                print(f"  错误: {response.text}")
        except Exception as e:
            print(f"[{case['name']}] 连接失败: {e}")
    
    return detail_ids


def test_get_statistics(batch_id):
    """测试获取批次统计"""
    print("\n=== 测试获取批次统计 ===")
    url = f"{BASE_URL}/api/statistics/{batch_id}"
    
    try:
        response = requests.get(url)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"批次号: {result['batch_no']}")
            print(f"总计: {result['summary']['total_count']} 条, {result['summary']['total_amount']:.2f} 元")
            print("分类统计:")
            for stat in result['statistics']:
                print(f"  - {stat['category']}: {stat['count']} 条, {stat['total_electricity']:.2f} 元")
    except Exception as e:
        print(f"连接失败: {e}")


def test_get_traces(detail_id):
    """测试获取处理轨迹"""
    print(f"\n=== 测试获取明细 {detail_id} 的处理轨迹 ===")
    url = f"{BASE_URL}/api/electricity-details/{detail_id}/traces"
    
    try:
        response = requests.get(url)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            traces = response.json()
            print(f"获取到 {len(traces)} 条轨迹")
            for trace in traces:
                print(f"  - [{trace['operated_at']}] {trace['action']} by {trace['operator']}")
                print(f"    备注: {trace['remark']}")
    except Exception as e:
        print(f"连接失败: {e}")


def test_modify_conclusion(detail_id, expected_old_category):
    """测试修改分类结论"""
    print(f"\n=== 测试修改明细 {detail_id} 的分类结论 ===")
    url = f"{BASE_URL}/api/electricity-details/{detail_id}/modify-conclusion"
    expected_change_reason = "联系抄表员确认，读数顺序写反了"
    data = {
        "new_category": "normal",
        "category_reason": "人工审核通过，读数异常为抄表顺序错误，已核实",
        "modified_by": "张主管",
        "change_reason": expected_change_reason
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"修改成功! 新分类: {result['category']}")
            print(f"原因: {result['category_reason']}")
            return True
    except Exception as e:
        print(f"连接失败: {e}")
    return False


def verify_audit_logs(detail_id, expected_change_reason):
    """验证审计日志的正确性"""
    print(f"\n=== 验证明细 {detail_id} 的审计日志 ===")
    url = f"{BASE_URL}/api/electricity-details/{detail_id}/audit-logs"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            logs = response.json()
            print(f"获取到 {len(logs)} 条审计记录")
            
            category_logs = [log for log in logs if log['field_name'] == 'category']
            if category_logs:
                latest_log = category_logs[0]
                actual_reason = latest_log['change_reason']
                
                print(f"\n  字段: {latest_log['field_name']}")
                print(f"  修改人: {latest_log['modified_by']}")
                print(f"  旧值: {latest_log['old_value']}")
                print(f"  新值: {latest_log['new_value']}")
                print(f"  修改原因: {actual_reason}")
                
                if actual_reason == expected_change_reason:
                    print(f"\n  ✅ 审计日志验证通过! change_reason 正确")
                    return True
                else:
                    print(f"\n  ❌ 审计日志验证失败!")
                    print(f"     期望: {expected_change_reason}")
                    print(f"     实际: {actual_reason}")
                    return False
            else:
                print("  未找到 category 字段的修改记录")
    except Exception as e:
        print(f"连接失败: {e}")
    return False


def verify_processing_traces(detail_id, expected_old_category, expected_new_category):
    """验证处理轨迹中前后分类的正确性"""
    print(f"\n=== 验证明细 {detail_id} 的处理轨迹 ===")
    url = f"{BASE_URL}/api/electricity-details/{detail_id}/traces"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            traces = response.json()
            print(f"获取到 {len(traces)} 条轨迹")
            
            modify_traces = [t for t in traces if t['action'] == 'modify_conclusion']
            if modify_traces:
                latest_trace = modify_traces[0]
                
                print(f"\n  操作: {latest_trace['action']}")
                print(f"  操作人: {latest_trace['operator']}")
                print(f"  修改前分类: {latest_trace['previous_category']}")
                print(f"  修改后分类: {latest_trace['new_category']}")
                print(f"  备注: {latest_trace['remark']}")
                
                old_ok = latest_trace['previous_category'] == expected_old_category
                new_ok = latest_trace['new_category'] == expected_new_category
                
                if old_ok and new_ok:
                    print(f"\n  ✅ 处理轨迹验证通过! 前后分类正确")
                    return True
                else:
                    print(f"\n  ❌ 处理轨迹验证失败!")
                    if not old_ok:
                        print(f"     修改前分类 - 期望: {expected_old_category}, 实际: {latest_trace['previous_category']}")
                    if not new_ok:
                        print(f"     修改后分类 - 期望: {expected_new_category}, 实际: {latest_trace['new_category']}")
                    return False
            else:
                print("  未找到 modify_conclusion 操作记录")
    except Exception as e:
        print(f"连接失败: {e}")
    return False


def test_get_audit_logs(detail_id):
    """测试获取审计日志"""
    print(f"\n=== 测试获取明细 {detail_id} 的审计日志 ===")
    url = f"{BASE_URL}/api/electricity-details/{detail_id}/audit-logs"
    
    try:
        response = requests.get(url)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            logs = response.json()
            print(f"获取到 {len(logs)} 条审计记录")
            for log in logs:
                print(f"  - [{log['modified_at']}] {log['modified_by']} 修改了 {log['field_name']}")
                print(f"    旧值: {log['old_value']}")
                print(f"    新值: {log['new_value']}")
                print(f"    原因: {log['change_reason']}")
    except Exception as e:
        print(f"连接失败: {e}")


def test_archive_batch(batch_id):
    """测试归档批次"""
    print(f"\n=== 测试归档批次 {batch_id} ===")
    url = f"{BASE_URL}/api/batches/{batch_id}/archive"
    data = {"operator": "王经理"}
    
    try:
        response = requests.post(url, json=data)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"归档成功! 状态: {result['status']}")
            print(f"归档人: {result['archived_by']}")
            print(f"归档时间: {result['archived_at']}")
    except Exception as e:
        print(f"连接失败: {e}")


def test_export_excel(batch_id):
    """测试导出Excel"""
    print(f"\n=== 测试导出批次 {batch_id} 的Excel ===")
    url = f"{BASE_URL}/api/export/excel"
    data = {"batch_id": batch_id}
    
    try:
        response = requests.post(url, json=data)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            filename = "test_export.xlsx"
            with open(filename, 'wb') as f:
                f.write(response.content)
            print(f"导出成功! 文件已保存为: {filename}")
        else:
            print(f"错误: {response.text}")
    except Exception as e:
        print(f"连接失败: {e}")


def main():
    print("=" * 50)
    print("冷库租户电费分摊API服务测试")
    print("=" * 50)
    
    print(f"\n测试地址: {BASE_URL}")
    print("请确保服务已启动 (python main.py)")
    
    input("\n按 Enter 继续测试...")
    
    batch_id = test_create_batch()
    if not batch_id:
        print("\n创建批次失败，终止测试")
        return
    
    test_get_batches()
    
    detail_ids = test_create_electricity_detail(batch_id)
    
    test_get_statistics(batch_id)
    
    if detail_ids:
        test_get_traces(detail_ids[0])
        
        if len(detail_ids) >= 3:
            blocked_detail_id = detail_ids[2]
            expected_old_category = "blocked"
            expected_new_category = "normal"
            expected_change_reason = "联系抄表员确认，读数顺序写反了"
            
            modify_success = test_modify_conclusion(blocked_detail_id, expected_old_category)
            
            if modify_success:
                print("\n" + "-" * 50)
                print("开始验证修复效果")
                print("-" * 50)
                
                audit_ok = verify_audit_logs(blocked_detail_id, expected_change_reason)
                trace_ok = verify_processing_traces(blocked_detail_id, expected_old_category, expected_new_category)
                
                print("\n" + "-" * 50)
                if audit_ok and trace_ok:
                    print("✅ 所有修复验证通过!")
                else:
                    print("❌ 部分修复验证失败!")
                print("-" * 50)
            
            test_get_audit_logs(blocked_detail_id)
    
    test_archive_batch(batch_id)
    
    test_export_excel(batch_id)
    
    print("\n" + "=" * 50)
    print("测试完成!")
    print("=" * 50)
    print(f"\n查看完整API文档请访问: {BASE_URL}/docs")


if __name__ == "__main__":
    main()
