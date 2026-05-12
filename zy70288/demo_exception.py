#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = 'http://localhost:5000'

def print_section(title):
    print(f"\n{'='*80}")
    print(f"【异常样例】{title}")
    print(f"{'='*80}")

def demo_reset():
    print_section("1. 重置测试数据")
    response = requests.post(f'{BASE_URL}/api/reset')
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

def demo_setup_basic_data():
    print_section("2. 创建基础数据（用于后续异常演示）")
    
    tenants = [
        {
            "tenant_id": "T001",
            "tenant_name": "科技先锋有限公司",
            "floor": 1,
            "area": 500,
            "start_date": "2024-01-01"
        }
    ]
    
    for tenant in tenants:
        response = requests.post(f'{BASE_URL}/api/tenants', json=tenant)
        print(f"创建租户: {response.status_code}")
    
    response = requests.post(f'{BASE_URL}/api/area-rules', json={
        "floor": 1,
        "public_area_ratio": 0.1,
        "air_conditioning_ratio": 1.0,
        "elevator_ratio": 1.0,
        "lighting_ratio": 1.0
    })
    print(f"创建面积规则: {response.status_code}")

def demo_missing_fields():
    print_section("3. 演示：缺少必填字段的拦截")
    
    print("\n场景1: 创建租户缺少 tenant_id")
    response = requests.post(f'{BASE_URL}/api/tenants', json={
        "tenant_name": "测试公司",
        "floor": 1,
        "area": 100
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n场景2: 创建能耗读数缺少多个必填字段")
    response = requests.post(f'{BASE_URL}/api/energy-readings', json={
        "type": "air_conditioning"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n场景3: 创建账单缺少 items")
    response = requests.post(f'{BASE_URL}/api/bills', json={
        "tenant_id": "T001",
        "month": "2024-01"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n场景4: 人工修正缺少批准人")
    response = requests.post(f'{BASE_URL}/api/manual-correction', json={
        "bill_id": "BL-001",
        "correction_type": "amount_adjustment",
        "correction_value": -100,
        "reason": "计算错误"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

def demo_duplicate_submission():
    print_section("4. 演示：重复提交的拦截")
    
    print("\n场景1: 创建重复的租户ID")
    response = requests.post(f'{BASE_URL}/api/tenants', json={
        "tenant_id": "T001",
        "tenant_name": "另一家公司",
        "floor": 2,
        "area": 200,
        "start_date": "2024-01-01"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n场景2: 创建重复的楼层面积规则")
    response = requests.post(f'{BASE_URL}/api/area-rules', json={
        "floor": 1,
        "public_area_ratio": 0.2,
        "air_conditioning_ratio": 0.5,
        "elevator_ratio": 0.5,
        "lighting_ratio": 0.5
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n场景3: 创建重复的能耗读数（同一时段同一类型）")
    reading_data = {
        "type": "air_conditioning",
        "period_start": "2024-01-01",
        "period_end": "2024-01-31",
        "total_consumption": 1000,
        "total_cost": 3000
    }
    
    print("第一次提交:")
    response1 = requests.post(f'{BASE_URL}/api/energy-readings', json=reading_data)
    print(f"状态码: {response1.status_code}")
    print(f"响应: {json.dumps(response1.json(), ensure_ascii=False, indent=2)}")
    
    print("\n第二次提交（相同数据）:")
    response2 = requests.post(f'{BASE_URL}/api/energy-readings', json=reading_data)
    print(f"状态码: {response2.status_code}")
    print(f"响应: {json.dumps(response2.json(), ensure_ascii=False, indent=2)}")
    
    return response1.json()['reading']['reading_id']

def demo_illegal_transition(reading_id):
    print_section("5. 演示：非法状态流转的拦截")
    
    print("\n先创建一个账单用于演示状态流转:")
    response = requests.post(f'{BASE_URL}/api/bills', json={
        "tenant_id": "T001",
        "month": "2024-01",
        "items": [
            {"type": "air_conditioning", "description": "空调能耗", "amount": 1000}
        ]
    })
    bill_id = response.json()['bill']['bill_id']
    print(f"创建账单成功, bill_id: {bill_id}")
    print(f"当前状态: draft")
    
    print("\n场景1: 从 draft 直接跳转到 paid（非法流转）")
    response = requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={
        "status": "paid",
        "reason": "跳过审批直接付款"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n场景2: 正常流转到 approved 后，尝试跳回 draft（非法流转）")
    response = requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={
        "status": "pending_review",
        "reason": "提交审核"
    })
    print(f"流转到 pending_review: {response.status_code}")
    
    response = requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={
        "status": "approved",
        "reason": "审核通过"
    })
    print(f"流转到 approved: {response.status_code}")
    
    print("\n尝试从 approved 跳回 draft:")
    response = requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={
        "status": "draft",
        "reason": "需要修改"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n场景3: 从 paid 状态尝试任何变更（已关闭状态不可变更）")
    response = requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={
        "status": "sent",
        "reason": "已付款后尝试重发"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n合法流转图:")
    print("""
    draft → pending_review → approved → sent → paid
      ↓          ↓            ↓         ↓
  cancelled    rejected   disputed   disputed
      ↓          ↓
      ×       draft
    """)
    
    return bill_id

def demo_manual_correction(bill_id):
    print_section("6. 演示：人工修正流程（触发待复核）")
    
    print(f"\n当前账单状态:")
    response = requests.get(f'{BASE_URL}/api/bills/{bill_id}')
    bill = response.json()
    print(f"状态: {bill['status']}")
    print(f"总金额: ¥{bill['total_amount']:.2f}")
    
    print("\n场景1: 人工修正金额（将账单转为待复核状态）")
    response = requests.post(f'{BASE_URL}/api/manual-correction', json={
        "bill_id": bill_id,
        "correction_type": "amount_adjustment",
        "correction_value": -100,
        "reason": "发现分摊计算有误，需要减免100元",
        "approved_by": "财务经理-王经理"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n修正后的账单状态:")
    response = requests.get(f'{BASE_URL}/api/bills/{bill_id}')
    bill = response.json()
    print(f"状态: {bill['status']}")
    print(f"总金额: ¥{bill['total_amount']:.2f}")
    print(f"修正记录: {json.dumps(bill.get('corrections', []), ensure_ascii=False, indent=2)}")
    
    print("\n场景2: 复核通过（重新审批）")
    response = requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={
        "status": "approved",
        "reason": "修正内容复核通过"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n最终账单状态:")
    response = requests.get(f'{BASE_URL}/api/bills/{bill_id}')
    bill = response.json()
    print(f"状态: {bill['status']}")
    print(f"总金额: ¥{bill['total_amount']:.2f}")

def demo_dispute_flow():
    print_section("7. 演示：争议处理流程")
    
    print("\n先创建一个新账单用于争议演示:")
    response = requests.post(f'{BASE_URL}/api/bills', json={
        "tenant_id": "T001",
        "month": "2024-02",
        "items": [
            {"type": "air_conditioning", "description": "空调能耗", "amount": 5000}
        ]
    })
    bill_id = response.json()['bill']['bill_id']
    print(f"创建账单成功, bill_id: {bill_id}")
    
    print("\n先流转到 sent 状态:")
    requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={"status": "pending_review", "reason": "审核中"})
    requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={"status": "approved", "reason": "审核通过"})
    requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={"status": "sent", "reason": "已发送"})
    
    response = requests.get(f'{BASE_URL}/api/bills/{bill_id}')
    print(f"当前状态: {response.json()['status']}")
    
    print("\n场景1: 租户提交争议")
    response = requests.post(f'{BASE_URL}/api/disputes', json={
        "bill_id": bill_id,
        "tenant_id": "T001",
        "reason": "分摊面积计算错误",
        "description": "我司实际承租面积应为400平方米，而非500平方米，导致空调能耗分摊过高",
        "evidence": ["租赁合同复印件", "测量报告"]
    })
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
    dispute_id = result['dispute']['dispute_id']
    
    print("\n争议创建后的账单状态:")
    response = requests.get(f'{BASE_URL}/api/bills/{bill_id}')
    print(f"状态: {response.json()['status']}")
    
    print("\n查看所有待处理争议:")
    response = requests.get(f'{BASE_URL}/api/disputes', params={"status": "open"})
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n场景2: 处理争议（核实后减免20%）")
    response = requests.put(f'{BASE_URL}/api/disputes/{dispute_id}', json={
        "resolution": "partial_waive",
        "resolved_by": "园区管理处-李主任",
        "notes": "经核实，租户面积确实存在误差，同意减免20%能耗费用，调整为4000元"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n争议处理后的账单状态:")
    response = requests.get(f'{BASE_URL}/api/bills/{bill_id}')
    print(f"状态: {response.json()['status']}")
    
    print("\n场景3: 重新审核调整后的账单")
    response = requests.post(f'{BASE_URL}/api/manual-correction', json={
        "bill_id": bill_id,
        "correction_type": "amount_adjustment",
        "correction_value": -1000,
        "reason": "根据争议处理结果，减免1000元",
        "approved_by": "财务经理-王经理"
    })
    print(f"人工修正状态码: {response.status_code}")
    
    response = requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json={
        "status": "approved",
        "reason": "争议处理完成，重新审核通过"
    })
    print(f"重新审批状态码: {response.status_code}")
    
    print("\n最终账单详情:")
    response = requests.get(f'{BASE_URL}/api/bills/{bill_id}')
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

def demo_repeated_allocation(reading_id):
    print_section("8. 演示：重复分摊的拦截")
    
    print(f"\n先执行第一次分摊:")
    response = requests.post(f'{BASE_URL}/api/allocate', json={
        "reading_id": reading_id,
        "month": "2024-01"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    print("\n能耗读数状态:")
    response = requests.get(f'{BASE_URL}/api/energy-readings')
    readings = response.json()['readings']
    for r in readings:
        print(f"  {r['type']}: {r['status']}")
    
    print("\n尝试重复分摊（同一读数再次分摊）:")
    response = requests.post(f'{BASE_URL}/api/allocate', json={
        "reading_id": reading_id,
        "month": "2024-01"
    })
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

def main():
    print("""
╔══════════════════════════════════════════════════════════════════════════╗
║                   园区能耗分摊系统 - 异常场景演示                          ║
║                                                                          ║
║  本演示将展示:                                                             ║
║  1. 缺少必填字段的拦截（缺字段场景）                                        ║
║  2. 重复提交的拦截（重复租户、重复读数、重复分摊）                           ║
║  3. 非法状态流转的拦截（状态机验证）                                        ║
║  4. 人工修正流程（触发待复核）                                             ║
║  5. 争议处理完整流程                                                      ║
╚══════════════════════════════════════════════════════════════════════════╝
    """)
    
    input("按回车键开始演示...")
    
    demo_reset()
    time.sleep(0.5)
    
    demo_setup_basic_data()
    time.sleep(0.5)
    
    demo_missing_fields()
    time.sleep(0.5)
    
    reading_id = demo_duplicate_submission()
    time.sleep(0.5)
    
    bill_id = demo_illegal_transition(reading_id)
    time.sleep(0.5)
    
    demo_manual_correction(bill_id)
    time.sleep(0.5)
    
    demo_dispute_flow()
    time.sleep(0.5)
    
    demo_repeated_allocation(reading_id)
    
    print("\n" + "="*80)
    print("【异常场景演示完成】")
    print("="*80)
    print("""
异常场景总结:

1. 缺字段拦截:
   - 所有API都有必填字段验证
   - 返回400错误，明确列出缺失字段

2. 重复提交拦截:
   - 租户ID唯一检查（409）
   - 楼层规则唯一检查（409）
   - 能耗读数唯一性检查（按类型+时段，409）
   - 重复分摊检查（状态验证，400）

3. 非法流转拦截:
   - 账单状态机验证
   - 不允许跳转过审批环节
   - 已完成状态不可变更

4. 人工修正流程:
   - 需要批准人记录
   - 修正后账单自动转为待复核状态
   - 保留完整修正历史

5. 争议处理:
   - 关联账单自动变为争议状态
   - 支持证据附件
   - 处理后需重新走审批流程
    """)

if __name__ == '__main__':
    main()
