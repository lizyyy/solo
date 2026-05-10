"""
博物馆藏品出库审批系统 - 测试脚本

这个脚本演示了完整的业务流程：
1. 创建藏品档案
2. 创建出库审批申请
3. 提交审批
4. 两级审批通过
5. 办理保险单
6. 开始运输
7. 记录运输节点
8. 记录环境监测
9. 到达目的地
10. 开始归还
11. 归还验收
12. 完成审批
13. 查询完整追踪信息
14. 后台任务和重跑机制演示

运行方式:
    python test_api.py
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"


def print_separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_collection_items():
    print_separator("1. 创建藏品档案")
    
    data = {
        "item_code": "COL-2024-0001",
        "name": "清代青花瓷瓶",
        "category": "瓷器",
        "era": "清代康熙年间",
        "description": "清代官窑青花瓷瓶，高35cm，保存完好",
        "current_location": "一号库房 A-12",
        "condition": "良好",
        "value": 500000.0
    }
    
    response = requests.post(f"{BASE_URL}/collection", json=data)
    print(f"创建藏品: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return result["id"]


def test_approval_flow(item_id):
    print_separator("2. 创建出库审批申请")
    
    now = datetime.now()
    approval_data = {
        "item_id": item_id,
        "borrower": "上海博物馆",
        "borrower_contact": "张馆长 138-0000-1234",
        "purpose": "参加『中国清代瓷器特展』展览",
        "destination": "上海市黄浦区人民大道201号 上海博物馆",
        "start_date": (now + timedelta(days=7)).isoformat(),
        "end_date": (now + timedelta(days=90)).isoformat(),
        "applicant": "李明",
        "applicant_department": "展览部",
        "comments": "展品要求：恒温恒湿运输，保险金额不低于50万元"
    }
    
    response = requests.post(f"{BASE_URL}/approvals", json=approval_data)
    print(f"创建审批申请: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    approval_id = result["id"]
    approval_no = result["approval_no"]
    print(f"\n审批单号: {approval_no}")
    
    print_separator("3. 提交审批")
    response = requests.post(
        f"{BASE_URL}/approvals/{approval_id}/submit",
        params={"operator": "李明"}
    )
    print(f"提交审批: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print_separator("4. 部门主管审批通过")
    approve_data = {
        "approver": "王主任",
        "approver_role": "部门主管",
        "comments": "同意出借，注意运输安全"
    }
    response = requests.post(
        f"{BASE_URL}/approvals/{approval_id}/approve",
        json=approve_data
    )
    print(f"部门主管审批: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print_separator("5. 馆长审批通过")
    approve_data2 = {
        "approver": "赵馆长",
        "approver_role": "馆长",
        "comments": "同意，保险请确保覆盖全程"
    }
    response = requests.post(
        f"{BASE_URL}/approvals/{approval_id}/approve",
        json=approve_data2
    )
    print(f"馆长审批: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\n审批状态: {result['status']}")
    
    return approval_id


def test_insurance(approval_id, item_id):
    print_separator("6. 办理保险单")
    
    now = datetime.now()
    insurance_data = {
        "approval_id": approval_id,
        "item_id": item_id,
        "insurance_company": "中国人民财产保险股份有限公司",
        "insured_value": 600000.0,
        "coverage_start": now.isoformat(),
        "coverage_end": (now + timedelta(days=100)).isoformat(),
        "coverage_details": "全险：包括运输险、展览险、失窃险，保额60万元"
    }
    
    response = requests.post(
        f"{BASE_URL}/insurance",
        json=insurance_data,
        params={"operator": "保险专员-陈"}
    )
    print(f"创建保险单: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    insurance_id = result["id"]
    policy_no = result["policy_no"]
    print(f"\n保险单号: {policy_no}")
    
    print_separator("7. 签发保险单")
    response = requests.post(
        f"{BASE_URL}/insurance/{insurance_id}/issue",
        params={
            "operator": "保险专员-陈",
            "policy_document_url": "/documents/insurance/INS-2024001.pdf"
        }
    )
    print(f"签发保险单: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    return insurance_id


def test_transport(approval_id):
    print_separator("8. 开始运输")
    response = requests.post(
        f"{BASE_URL}/approvals/{approval_id}/start-transit",
        params={"operator": "运输管理员-刘"}
    )
    print(f"开始运输: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print_separator("9. 记录运输节点 - 博物馆出库")
    transport1 = {
        "approval_id": approval_id,
        "sequence": 1,
        "node_name": "北京博物馆出库",
        "node_type": "起点",
        "location": "北京市东城区五四大街1号",
        "handler": "库房管理员-周",
        "handler_contact": "139-0000-5678",
        "arrival_time": datetime.now().isoformat(),
        "departure_time": (datetime.now() + timedelta(minutes=30)).isoformat(),
        "condition_check": "藏品检查完好，包装完好，已拍照记录",
        "remarks": "使用专用恒温恒湿包装箱"
    }
    response = requests.post(
        f"{BASE_URL}/tracking/transport",
        json=transport1,
        params={"operator": "运输管理员-刘"}
    )
    print(f"运输节点1: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print_separator("10. 记录环境监测数据")
    env1 = {
        "approval_id": approval_id,
        "record_time": datetime.now().isoformat(),
        "temperature": 20.5,
        "humidity": 55.0,
        "light_level": 0,
        "vibration": 0.1,
        "status": "normal",
        "notes": "运输途中环境监测正常",
        "operator": "运输押运员-赵"
    }
    response = requests.post(
        f"{BASE_URL}/tracking/environment",
        json=env1,
        params={"operator": "运输押运员-赵"}
    )
    print(f"环境记录1: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print_separator("11. 记录运输节点 - 中转站")
    transport2 = {
        "approval_id": approval_id,
        "sequence": 2,
        "node_name": "济南中转站",
        "node_type": "中转",
        "location": "济南市历下区物流中心",
        "handler": "中转站管理员-王",
        "handler_contact": "137-0000-1111",
        "arrival_time": (datetime.now() + timedelta(hours=4)).isoformat(),
        "departure_time": (datetime.now() + timedelta(hours=4, minutes=30)).isoformat(),
        "condition_check": "中转检查完好，环境数据正常",
        "remarks": "短暂停留30分钟"
    }
    response = requests.post(
        f"{BASE_URL}/tracking/transport",
        json=transport2,
        params={"operator": "运输管理员-刘"}
    )
    print(f"运输节点2: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print_separator("12. 标记到达目的地")
    response = requests.post(
        f"{BASE_URL}/approvals/{approval_id}/arrive",
        params={"operator": "上海博物馆-李"}
    )
    print(f"到达目的地: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))


def test_return(approval_id):
    print_separator("13. 开始归还运输")
    response = requests.post(
        f"{BASE_URL}/approvals/{approval_id}/start-return",
        params={"operator": "上海博物馆-李"}
    )
    print(f"开始归还: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print_separator("14. 归还验收")
    inspection_data = {
        "approval_id": approval_id,
        "return_date": datetime.now().isoformat(),
        "inspector": "库房管理员-周",
        "inspector_department": "保管部",
        "condition_before": "出库时状态：完好，无损伤",
        "condition_after": "归还时状态：整体完好，轻微包装磨损",
        "damage_found": False,
        "damage_description": None,
        "packaging_check": "外包装有轻微划痕，但内部防护完好",
        "documents_complete": True,
        "missing_items": None,
        "overall_status": "normal",
        "recommendations": "下次运输建议加强边角防护",
        "signature_url": "/signatures/inspection-001.png"
    }
    response = requests.post(
        f"{BASE_URL}/tracking/inspection",
        json=inspection_data,
        params={"operator": "库房管理员-周"}
    )
    print(f"归还验收: {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print_separator("15. 完成审批流程")
    response = requests.post(
        f"{BASE_URL}/approvals/{approval_id}/complete",
        params={"operator": "库房管理员-周"}
    )
    print(f"完成审批: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\n最终状态: {result['status']}")


def test_trace(approval_id):
    print_separator("16. 查询完整追踪信息")
    response = requests.get(f"{BASE_URL}/approvals/{approval_id}/trace")
    print(f"获取追踪信息: {response.status_code}")
    result = response.json()
    
    print("\n【审批基本信息】")
    approval = result['approval']
    print(f"  审批单号: {approval['approval_no']}")
    print(f"  状态: {approval['status']}")
    print(f"  借展方: {approval['borrower']}")
    print(f"  目的地: {approval['destination']}")
    
    if result['insurance']:
        print(f"\n【保险信息】")
        ins = result['insurance']
        print(f"  保险单号: {ins['policy_no']}")
        print(f"  保险公司: {ins['insurance_company']}")
        print(f"  保额: ¥{ins['insured_value']:,.2f}")
        print(f"  状态: {ins['status']}")
    
    if result['transport_records']:
        print(f"\n【运输节点】")
        for t in result['transport_records']:
            print(f"  [{t['sequence']}] {t['node_name']} ({t['node_type']})")
            print(f"      位置: {t['location']}")
            print(f"      负责人: {t['handler']}")
    
    if result['environment_logs']:
        print(f"\n【环境监测记录】")
        for env in result['environment_logs']:
            print(f"  时间: {env['record_time'][:19]}")
            print(f"      温度: {env['temperature']}°C, 湿度: {env['humidity']}%")
            print(f"      状态: {env['status']}")
    
    if result['return_inspection']:
        print(f"\n【归还验收】")
        insp = result['return_inspection']
        print(f"  验收人: {insp['inspector']}")
        print(f"  发现损坏: {'是' if insp['damage_found'] else '否'}")
        print(f"  总体状态: {insp['overall_status']}")
    
    print(f"\n【时间线】")
    for i, event in enumerate(result['timeline'][:10], 1):
        print(f"  [{i}] {event['time'][:19]} - {event['type']}: {event['title']}")
    
    print(f"\n【操作历史】")
    for op in result['operation_history']:
        print(f"  {op['created_at'][:19]} - {op['operator_role']} {op['operator']}: {op['description']}")


def test_background_tasks(approval_id):
    print_separator("17. 后台任务演示")
    
    print("\n创建通知保险公司任务:")
    response = requests.post(
        f"{BASE_URL}/tasks",
        params={
            "task_type": "notify_insurance",
            "approval_id": approval_id
        }
    )
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    task_id = result['data']['task_id']
    
    print(f"\n执行任务 {task_id}:")
    response = requests.post(f"{BASE_URL}/tasks/{task_id}/execute")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    
    print("\n查看任务详情:")
    response = requests.get(f"{BASE_URL}/tasks/{task_id}")
    task = response.json()
    print(f"任务状态: {task['status']}")
    print(f"尝试次数: {task['attempts']}/{task['max_attempts']}")
    if task['error_message']:
        print(f"错误信息: {task['error_message']}")
        print(f"下次重试: {task['next_retry_at']}")
    if task['result']:
        print(f"执行结果: {json.dumps(task['result'], indent=2, ensure_ascii=False)}")
    
    print("\n查看所有失败任务:")
    response = requests.get(f"{BASE_URL}/tasks/failed")
    failed_tasks = response.json()
    print(f"失败任务数量: {len(failed_tasks)}")
    for task in failed_tasks[:5]:
        print(f"  - {task['task_id']}: {task['task_type']} ({task['attempts']}次尝试)")


def main():
    print("\n" + "="*60)
    print("  博物馆藏品出库审批系统 - 完整流程测试")
    print("  请先启动服务: uvicorn main:app --reload")
    print("="*60)
    
    try:
        item_id = test_collection_items()
        approval_id = test_approval_flow(item_id)
        insurance_id = test_insurance(approval_id, item_id)
        test_transport(approval_id)
        test_return(approval_id)
        test_trace(approval_id)
        test_background_tasks(approval_id)
        
        print("\n" + "="*60)
        print("  ✅ 测试完成！")
        print("  📋 API 文档: http://localhost:8000/docs")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
