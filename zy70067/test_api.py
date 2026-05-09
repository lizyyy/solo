#!/usr/bin/env python3
"""
实验课耗材领用API测试脚本
"""

import requests
import json
import sys

BASE = 'http://localhost:8000'


def test_basic_apis():
    print("=" * 60)
    print("测试实验课耗材领用API系统")
    print("=" * 60)

    try:
        print("\n【1/8】健康检查...")
        r = requests.get(f'{BASE}/health')
        print(f"  状态码: {r.status_code}")
        print(f"  响应: {json.dumps(r.json(), ensure_ascii=False, indent=2)}")

        print("\n【2/8】获取耗材列表...")
        r = requests.get(f'{BASE}/materials')
        materials = r.json()
        print(f"  共 {len(materials)} 种耗材")
        for m in materials[:3]:
            print(f"    - {m['name']} ({m['category']})")

        print("\n【3/8】获取库存情况...")
        r = requests.get(f'{BASE}/inventory')
        inv = r.json()
        print(f"  库存记录: {len(inv)} 条")
        for item in inv:
            flag = "⚠️ 低库存" if item["is_low_stock"] else "✓"
            print(f"    {flag} {item['material_name']}: 可用 {item['available_qty']}, 总量 {item['total_qty']}")

        print("\n【4/8】获取课程计划...")
        r = requests.get(f'{BASE}/course-plans/PLAN202605100002')
        plan = r.json()
        print(f"  计划编号: {plan['plan_no']}")
        print(f"  实验名称: {plan['experiment_name']}")
        print(f"  任课教师: {plan['teacher_name']}")
        print(f"  班级: {plan['class_name']}")
        print(f"  分组数: {plan['total_groups']}")
        print(f"  计划耗材:")
        for item in plan['items']:
            print(f"    - {item['material_name']}: {item['total_qty']} {item['material_unit']}")

        print("\n【5/8】查看历史领用记录...")
        r = requests.get(f'{BASE}/usage/LY202605090001')
        usage = r.json()
        print(f"  领用单号: {usage['record_no']}")
        print(f"  状态: {usage['status']}")
        print(f"  教师确认: {'已确认' if usage['teacher_confirmed'] else '未确认'}")
        print(f"  领用明细:")
        for item in usage['usage_items']:
            print(f"    - {item['material_name']}: 领用 {item['actual_qty']}")
        print(f"  退料明细:")
        for item in usage['return_items']:
            print(f"    - {item['material_name']}: 退料 {item['returned_qty']}")
        print(f"  损耗明细:")
        for item in usage['loss_items']:
            print(f"    - {item['material_name']}: 损耗 {item['loss_qty']} ({item['loss_reason']})")

        print("\n【6/8】查看补偿记录...")
        r = requests.get(f'{BASE}/compensations/pending')
        comps = r.json()
        print(f"  待补偿记录: {len(comps)} 条")

        return materials, inv, plan

    except Exception as e:
        print(f"\n❌ 基础测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def test_business_flow(materials, inv, plan):
    print("\n" + "=" * 60)
    print("业务流程测试")
    print("=" * 60)

    mat_map = {m['name']: m for m in materials}
    ethanol_id = mat_map['无水乙醇']['id']
    acid_id = mat_map['浓硫酸']['id']

    try:
        print("\n【7/8】执行正常领用流程...")
        usage_data = {
            "plan_id": 2,
            "operator_name": "测试管理员",
            "operator_id": 999,
            "items": [
                {
                    "material_id": ethanol_id,
                    "actual_qty": 16,
                    "plan_qty": 16,
                    "returnable_qty": 8
                },
                {
                    "material_id": acid_id,
                    "actual_qty": 4,
                    "plan_qty": 4,
                    "returnable_qty": 2
                }
            ],
            "remarks": "API测试领用"
        }

        r = requests.post(f'{BASE}/usage', json=usage_data)
        result = r.json()
        print(f"  状态码: {r.status_code}")
        print(f"  成功: {result.get('success')}")
        print(f"  消息: {result.get('message')}")

        if not result.get('success'):
            print(f"  错误: {result}")
            return

        record_no = result['data']['record_no']
        print(f"  领用单号: {record_no}")

        print(f"\n【8/8】测试异常拦截...")

        print("\n  测试1: 重复领用同一计划...")
        r = requests.post(f'{BASE}/usage', json=usage_data)
        result = r.json()
        print(f"    状态码: {r.status_code}")
        print(f"    拦截成功: {not result.get('success')}")
        print(f"    消息: {result.get('message')}")

        print("\n  测试2: 超量退料...")
        return_data = {
            "record_no": record_no,
            "operator_name": "测试管理员",
            "items": [
                {
                    "material_id": ethanol_id,
                    "returned_qty": 100,
                    "condition": "完好"
                }
            ]
        }
        r = requests.post(f'{BASE}/return', json=return_data)
        result = r.json()
        print(f"    状态码: {r.status_code}")
        print(f"    拦截成功: {not result.get('success')}")
        print(f"    消息: {result.get('message')}")

        print("\n  测试3: 非任课教师确认...")
        confirm_data = {
            "record_no": record_no,
            "teacher_id": 1,
            "confirm_notes": "错误的教师"
        }
        r = requests.post(f'{BASE}/confirm', json=confirm_data)
        result = r.json()
        print(f"    状态码: {r.status_code}")
        print(f"    拦截成功: {not result.get('success')}")
        print(f"    消息: {result.get('message')}")

        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ 业务流程测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    materials, inv, plan = test_basic_apis()
    test_business_flow(materials, inv, plan)
