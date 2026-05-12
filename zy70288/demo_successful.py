#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = 'http://localhost:5000'

def print_section(title):
    print(f"\n{'='*80}")
    print(f"【顺利样例】{title}")
    print(f"{'='*80}")

def demo_reset():
    print_section("1. 重置测试数据")
    response = requests.post(f'{BASE_URL}/api/reset')
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

def demo_create_tenants():
    print_section("2. 创建租户档案")
    
    tenants = [
        {
            "tenant_id": "T001",
            "tenant_name": "科技先锋有限公司",
            "floor": 1,
            "area": 500,
            "start_date": "2024-01-01",
            "contact_person": "张三",
            "contact_phone": "13800138001"
        },
        {
            "tenant_id": "T002",
            "tenant_name": "创新企业管理咨询",
            "floor": 2,
            "area": 300,
            "start_date": "2024-01-01",
            "contact_person": "李四",
            "contact_phone": "13800138002"
        },
        {
            "tenant_id": "T003",
            "tenant_name": "智慧教育科技中心",
            "floor": 1,
            "area": 200,
            "start_date": "2024-01-15",
            "contact_person": "王五",
            "contact_phone": "13800138003"
        }
    ]
    
    for tenant in tenants:
        response = requests.post(f'{BASE_URL}/api/tenants', json=tenant)
        print(f"\n创建租户 {tenant['tenant_id']}:")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    response = requests.get(f'{BASE_URL}/api/tenants')
    print(f"\n所有租户列表:")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

def demo_create_area_rules():
    print_section("3. 配置面积分摊规则")
    
    rules = [
        {
            "floor": 1,
            "public_area_ratio": 0.1,
            "air_conditioning_ratio": 0.6,
            "elevator_ratio": 0.5,
            "lighting_ratio": 0.6,
            "description": "1楼为主要办公层，公共区域10%"
        },
        {
            "floor": 2,
            "public_area_ratio": 0.15,
            "air_conditioning_ratio": 0.4,
            "elevator_ratio": 0.5,
            "lighting_ratio": 0.4,
            "description": "2楼公共区域15%"
        }
    ]
    
    for rule in rules:
        response = requests.post(f'{BASE_URL}/api/area-rules', json=rule)
        print(f"\n创建楼层 {rule['floor']} 规则:")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    response = requests.get(f'{BASE_URL}/api/area-rules')
    print(f"\n所有规则列表:")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

def demo_create_energy_readings():
    print_section("4. 录入能耗读数")
    
    readings = [
        {
            "type": "air_conditioning",
            "period_start": "2024-01-01",
            "period_end": "2024-01-31",
            "total_consumption": 5000,
            "total_cost": 15000,
            "unit_price": 3.0,
            "source": "meter"
        },
        {
            "type": "elevator",
            "period_start": "2024-01-01",
            "period_end": "2024-01-31",
            "total_consumption": 2000,
            "total_cost": 4000,
            "unit_price": 2.0,
            "source": "meter"
        },
        {
            "type": "lighting",
            "period_start": "2024-01-01",
            "period_end": "2024-01-31",
            "total_consumption": 1500,
            "total_cost": 3000,
            "unit_price": 2.0,
            "source": "meter"
        }
    ]
    
    reading_ids = {}
    
    for reading in readings:
        response = requests.post(f'{BASE_URL}/api/energy-readings', json=reading)
        print(f"\n创建 {reading['type']} 读数:")
        print(f"状态码: {response.status_code}")
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        reading_ids[reading['type']] = result['reading']['reading_id']
    
    response = requests.get(f'{BASE_URL}/api/energy-readings')
    print(f"\n所有读数列表:")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    return reading_ids

def demo_allocate_energy(reading_ids):
    print_section("5. 执行能耗分摊")
    
    for energy_type, reading_id in reading_ids.items():
        response = requests.post(f'{BASE_URL}/api/allocate', json={
            "reading_id": reading_id,
            "month": "2024-01"
        })
        print(f"\n分摊 {energy_type}:")
        print(f"状态码: {response.status_code}")
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        
        if 'allocation' in result:
            print(f"\n分摊详情分析:")
            for alloc in result['allocation']['allocations']:
                print(f"  租户 {alloc['tenant_id']} ({alloc['tenant_name']}):")
                print(f"    面积: {alloc['area']} 平方米 (占比: {alloc['area_ratio']*100:.1f}%)")
                print(f"    使用时段占比: {alloc['usage_ratio']*100:.1f}%")
                print(f"    公共能耗分摊: ¥{alloc['public_cost']:.2f}")
                print(f"    私有能耗分摊: ¥{alloc['private_cost']:.2f}")
                print(f"    总计: ¥{alloc['total_cost']:.2f}")

def demo_create_bills():
    print_section("6. 生成月度账单")
    
    bills = [
        {
            "tenant_id": "T001",
            "month": "2024-01",
            "items": [
                {"type": "air_conditioning", "description": "空调能耗", "amount": 8100.00},
                {"type": "elevator", "description": "电梯能耗", "amount": 1800.00},
                {"type": "lighting", "description": "照明能耗", "amount": 1620.00}
            ]
        },
        {
            "tenant_id": "T002",
            "month": "2024-01",
            "items": [
                {"type": "air_conditioning", "description": "空调能耗", "amount": 5400.00},
                {"type": "elevator", "description": "电梯能耗", "amount": 1200.00},
                {"type": "lighting", "description": "照明能耗", "amount": 1080.00}
            ]
        },
        {
            "tenant_id": "T003",
            "month": "2024-01",
            "items": [
                {"type": "air_conditioning", "description": "空调能耗", "amount": 1500.00},
                {"type": "elevator", "description": "电梯能耗", "amount": 1000.00},
                {"type": "lighting", "description": "照明能耗", "amount": 300.00}
            ]
        }
    ]
    
    bill_ids = []
    
    for bill in bills:
        response = requests.post(f'{BASE_URL}/api/bills', json=bill)
        print(f"\n创建账单 {bill['tenant_id']}:")
        print(f"状态码: {response.status_code}")
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        bill_ids.append(result['bill']['bill_id'])
    
    return bill_ids

def demo_bill_workflow(bill_ids):
    print_section("7. 账单状态流转（完整流程）")
    
    bill_id = bill_ids[0]
    
    transitions = [
        {"status": "pending_review", "reason": "已完成初步审核"},
        {"status": "approved", "reason": "财务审批通过"},
        {"status": "sent", "reason": "账单已发送给租户"},
        {"status": "paid", "reason": "租户已付款"}
    ]
    
    for transition in transitions:
        response = requests.put(f'{BASE_URL}/api/bills/{bill_id}/status', json=transition)
        print(f"\n状态变更: {transition['status']}")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    
    response = requests.get(f'{BASE_URL}/api/bills/{bill_id}')
    print(f"\n最终账单状态:")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

def demo_export_bill(bill_ids):
    print_section("8. 导出账单")
    
    for bill_id in bill_ids:
        response = requests.get(f'{BASE_URL}/api/export/{bill_id}')
        print(f"\n导出账单 {bill_id}:")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

def demo_audit_logs():
    print_section("9. 查看审计日志")
    
    response = requests.get(f'{BASE_URL}/api/audit-logs')
    logs = response.json()
    print(f"共 {len(logs['logs'])} 条日志")
    print("最近10条:")
    for log in logs['logs'][-10:]:
        print(f"  [{log['timestamp']}] {log['action']}: {log['details']}")

def main():
    print("""
╔══════════════════════════════════════════════════════════════════════════╗
║                    园区能耗分摊系统 - 顺利流程演示                         ║
║                                                                          ║
║  本演示将展示:                                                             ║
║  1. 创建租户档案（不同楼层、不同面积、不同入住时间）                        ║
║  2. 配置面积分摊规则（各楼层公共区域占比、能耗类型比例）                     ║
║  3. 录入月度能耗读数（空调、电梯、照明三种公共能耗）                        ║
║  4. 按面积和时段分摊能耗                                                  ║
║  5. 生成租户月度账单                                                       ║
║  6. 账单审批流转流程                                                       ║
║  7. 导出账单数据                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
    """)
    
    input("按回车键开始演示...")
    
    demo_reset()
    time.sleep(0.5)
    
    demo_create_tenants()
    time.sleep(0.5)
    
    demo_create_area_rules()
    time.sleep(0.5)
    
    reading_ids = demo_create_energy_readings()
    time.sleep(0.5)
    
    demo_allocate_energy(reading_ids)
    time.sleep(0.5)
    
    bill_ids = demo_create_bills()
    time.sleep(0.5)
    
    demo_bill_workflow(bill_ids)
    time.sleep(0.5)
    
    demo_export_bill(bill_ids)
    time.sleep(0.5)
    
    demo_audit_logs()
    
    print("\n" + "="*80)
    print("【顺利流程演示完成】")
    print("="*80)
    print("""
关键差异点说明:
1. 园区公共能耗: 系统支持空调、电梯、照明三种公共能耗的独立管理
2. 租户面积分摊: 根据租户面积占比 + 楼层规则计算
3. 时段分摊: 考虑租户实际入住时段（如T003从1月15日开始，使用比例50%）

分摊公式:
- 私有部分: 总费用 × (1-公共区域比例) × 面积比例 × 时段比例
- 公共部分: 总费用 × 公共区域比例 × 类型比例 × 时段比例
- 总计 = 私有部分 + 公共部分
    """)

if __name__ == '__main__':
    main()
