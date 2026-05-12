#!/usr/bin/env python3
import requests
import json
import sys
from datetime import date, datetime

BASE_URL = "http://127.0.0.1:5000"


def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_response(response, show_details=True):
    print(f"状态码: {response.status_code}")
    try:
        data = response.json()
        if show_details:
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            print(f"成功: {data.get('success')}")
            print(f"消息: {data.get('message')}")
    except Exception as e:
        print(f"响应: {response.text[:200]}")


def check_server():
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        return response.status_code == 200
    except:
        return False


def demo_normal_medication():
    """场景1：正常服药流程"""
    print_header("场景1：正常服药流程")
    print("演示：张护士为陈大爷（R001）执行今日早8点的硝苯地平用药确认")
    
    today = date.today().isoformat()
    
    print("\n1. 查看今日用药计划（陈大爷）")
    response = requests.get(f"{BASE_URL}/api/medications/plans", params={
        'resident_id': 'R001',
        'date': today
    })
    print_response(response)
    
    print("\n2. 张护士（N001）确认用药")
    req_id = f"DEMO-CONF-{datetime.now().strftime('%H%M%S')}"
    response = requests.post(f"{BASE_URL}/api/medications/confirm", json={
        'request_id': req_id,
        'plan_id': 'PLAN-005',
        'nurse_id': 'N001',
        'notes': '老人服药后无不适'
    })
    print_response(response)
    
    print("\n3. 重复调用同一个request_id（幂等性测试）")
    response = requests.post(f"{BASE_URL}/api/medications/confirm", json={
        'request_id': req_id,
        'plan_id': 'PLAN-005',
        'nurse_id': 'N001'
    })
    print_response(response)
    
    print("\n4. 查看更新后的用药计划状态")
    response = requests.get(f"{BASE_URL}/api/medications/plans/PLAN-005")
    print_response(response)


def demo_missed_makeup():
    """场景2：漏服补服流程"""
    print_header("场景2：漏服补服流程")
    print("演示：陈大爷昨日（PLAN-003）硝苯地平漏服，申请补服并执行")
    
    print("\n1. 查看漏服的用药计划")
    response = requests.get(f"{BASE_URL}/api/medications/plans/PLAN-003")
    print_response(response)
    
    print("\n2. 李护士（N002）申请补服")
    req1 = f"DEMO-MKREQ-{datetime.now().strftime('%H%M%S')}"
    response = requests.post(f"{BASE_URL}/api/medications/makeup/request", json={
        'request_id': req1,
        'plan_id': 'PLAN-003',
        'nurse_id': 'N002',
        'reason': '老人外出返回，申请补服'
    })
    print_response(response)
    
    print("\n3. 张护士（N001，护士长）审批补服")
    req2 = f"DEMO-MKAPP-{datetime.now().strftime('%H%M%S')}"
    response = requests.post(f"{BASE_URL}/api/medications/makeup/approve", json={
        'request_id': req2,
        'plan_id': 'PLAN-003',
        'nurse_id': 'N001'
    })
    print_response(response)
    
    print("\n4. 李护士执行补服确认")
    req3 = f"DEMO-MKCONF-{datetime.now().strftime('%H%M%S')}"
    response = requests.post(f"{BASE_URL}/api/medications/confirm", json={
        'request_id': req3,
        'plan_id': 'PLAN-003',
        'nurse_id': 'N002',
        'notes': '补服已执行'
    })
    print_response(response)
    
    print("\n5. 查看最终状态")
    response = requests.get(f"{BASE_URL}/api/medications/plans/PLAN-003")
    print_response(response)


def demo_prescription_stop():
    """场景3：医嘱停用流程"""
    print_header("场景3：医嘱停用流程")
    print("演示：由于不良反应，停用陈大爷的二甲双胍医嘱")
    
    print("\n1. 查看当前医嘱状态")
    response = requests.get(f"{BASE_URL}/api/prescriptions/P002")
    print_response(response)
    
    print("\n2. 查看该医嘱下的待执行用药计划")
    response = requests.get(f"{BASE_URL}/api/medications/plans", params={
        'status': '待执行'
    })
    data = response.json()
    pending = [p for p in data.get('data', []) if p.get('prescription_id') == 'P002']
    print(f"该医嘱待执行计划数: {len(pending)}")
    if pending:
        print(f"计划ID: {[p['id'] for p in pending]}")
    
    print("\n3. 医生停用医嘱")
    response = requests.post(f"{BASE_URL}/api/prescriptions/P002/discontinue", json={
        'reason': '出现胃肠道不良反应，换用其他降糖药'
    }, headers={
        'X-User-Id': 'DOC-001',
        'X-User-Name': '王医生'
    })
    print_response(response)
    
    print("\n4. 查看医嘱历史记录")
    response = requests.get(f"{BASE_URL}/api/prescriptions/P002", params={'history': 'true'})
    print_response(response)


def demo_inventory_shortage():
    """场景4：库存不足失败路径"""
    print_header("场景4：库存不足 - 失败路径演示")
    print("演示：李奶奶（R002）的阿司匹林库存不足，无法确认用药")
    
    print("\n1. 查看阿司匹林库存")
    response = requests.get(f"{BASE_URL}/api/inventory/INV-003")
    print_response(response)
    
    print("\n2. 尝试确认用药（库存仅有2片，但将演示库存不足场景）")
    print("   （注意：多奈哌齐片 INV-004 库存为0，更适合演示）")
    
    print("\n3. 查看多奈哌齐片库存（已清零）")
    response = requests.get(f"{BASE_URL}/api/inventory/INV-004")
    print_response(response)
    
    print("\n4. 查看异常记录")
    response = requests.get(f"{BASE_URL}/api/exceptions", params={'type': '库存不足'})
    print_response(response)


def demo_handover():
    """场景5：交接班流程"""
    print_header("场景5：交接班流程")
    print("演示：张护士交班给王护士，核对上午用药情况")
    
    today = date.today().isoformat()
    
    print("\n1. 创建交接班记录")
    response = requests.post(f"{BASE_URL}/api/handovers/create", json={
        'id': f'HO-{datetime.now().strftime("%Y%m%d")}-MORNING',
        'shift_date': today,
        'shift_type': 'morning',
        'outgoing_nurse_id': 'N001',
        'incoming_nurse_id': 'N003',
        'notes': '今日上午交接班'
    })
    print_response(response)
    
    print("\n2. 查看交接班详情")
    handover_id = f'HO-{datetime.now().strftime("%Y%m%d")}-MORNING'
    response = requests.get(f"{BASE_URL}/api/handovers/{handover_id}", params={'checklist': 'true'})
    data = response.json()
    print_response(response, show_details=False)
    if data.get('success') and data.get('data'):
        checklist = data['data'].get('checklist', [])
        print(f"核对项数: {len(checklist)}")
    
    print("\n3. 确认交接班")
    response = requests.post(f"{BASE_URL}/api/handovers/{handover_id}/confirm", json={
        'incoming_nurse_id': 'N003'
    })
    print_response(response)


def demo_reports():
    """场景6：报告导出"""
    print_header("场景6：报告导出")
    print("展示各类报告接口的输出")
    
    print("\n1. 用药日历（今日+前后各3天）")
    response = requests.get(f"{BASE_URL}/api/reports/calendar")
    data = response.json()
    if data.get('success'):
        cal = data['data']
        print(f"日期范围: {cal['date_range']['start']} 至 {cal['date_range']['end']}")
        print(f"用药计划总数: {cal['summary']['total_plans']}")
        print(f"状态分布: {cal['summary']['by_status']}")
        print(f"覆盖天数: {cal['summary']['days_covered']}")
        print("\n日历预览:")
        for day, times in cal.get('calendar', {}).items():
            print(f"  {day}:")
            for t, events in times.items():
                for e in events[:2]:
                    print(f"    {t} - {e['resident_name']}: {e['medication_name']} [{e['status']}]")
    
    print("\n2. 异常报告")
    response = requests.get(f"{BASE_URL}/api/reports/exceptions")
    data = response.json()
    if data.get('success'):
        summary = data['data']['summary']
        print(f"异常总数: {summary['total']}")
        print(f"按类型分布: {summary['by_type']}")
        print(f"按状态分布: {summary['by_status']}")
    
    print("\n3. 库存报告")
    response = requests.get(f"{BASE_URL}/api/reports/inventory")
    data = response.json()
    if data.get('success'):
        inv = data['data']
        print(f"库存总品数: {inv['total_items']}")
        print(f"低库存预警数: {inv['low_stock_count']}")
        for item in inv['low_stock_items']:
            print(f"  ⚠️  {item['medication_name']}: {item['quantity']} {item['unit']}")
    
    print("\n4. 仪表盘概览")
    response = requests.get(f"{BASE_URL}/api/reports/dashboard")
    data = response.json()
    if data.get('success'):
        dash = data['data']
        print(f"\n今日概览 ({dash['today']['date']}):")
        print(f"  总计划: {dash['today']['total_plans']}")
        print(f"  已完成: {dash['today']['completed']}")
        print(f"  待执行: {dash['today']['scheduled']}")
        print(f"  漏服/拒绝: {dash['today']['missed']}")
        print(f"  完成率: {dash['today']['completion_rate']}")
        print(f"\n告警数:")
        print(f"  待处理异常: {dash['alerts']['open_exceptions']}")
        print(f"  低库存: {dash['alerts']['low_inventory']}")
        print(f"  待确认交接班: {dash['alerts']['pending_handovers']}")


def main():
    print("=" * 70)
    print("养老院用药提醒 API - 演示脚本")
    print("=" * 70)
    
    if not check_server():
        print("\n错误: 无法连接到服务器")
        print("请先运行: python run.py")
        print("或: flask run --port 5000")
        sys.exit(1)
    
    print("\n服务器连接成功！")
    print("请确保已初始化样例数据: python sample_data.py")
    
    print("\n" + "=" * 70)
    print("选择要演示的场景:")
    print("  1. 正常服药流程（含幂等性测试）")
    print("  2. 漏服补服流程")
    print("  3. 医嘱停用流程")
    print("  4. 库存不足（失败路径）")
    print("  5. 交接班流程")
    print("  6. 报告导出（日历、异常、库存、仪表盘）")
    print("  7. 全部演示")
    print("=" * 70)
    
    choice = input("\n请输入选项 (1-7): ").strip()
    
    if choice == '1':
        demo_normal_medication()
    elif choice == '2':
        demo_missed_makeup()
    elif choice == '3':
        demo_prescription_stop()
    elif choice == '4':
        demo_inventory_shortage()
    elif choice == '5':
        demo_handover()
    elif choice == '6':
        demo_reports()
    elif choice == '7':
        demo_normal_medication()
        demo_missed_makeup()
        demo_prescription_stop()
        demo_inventory_shortage()
        demo_handover()
        demo_reports()
    else:
        print("无效选项")
    
    print("\n" + "=" * 70)
    print("演示完成！")
    print("=" * 70)


if __name__ == '__main__':
    main()
