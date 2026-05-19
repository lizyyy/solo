#!/usr/bin/env python3
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_elderly_management():
    print_section("1. 老人信息管理")

    elderly_data = [
        {
            "name": "张爷爷",
            "room_number": "101室",
            "delivery_route": "A线-1号楼",
            "phone": "13800138001",
            "chronic_conditions": "糖尿病,高血压",
            "allergies": "海鲜",
            "dietary_restrictions": "辛辣",
            "notes": "需要软食"
        },
        {
            "name": "李奶奶",
            "room_number": "203室",
            "delivery_route": "B线-2号楼",
            "phone": "13800138002",
            "chronic_conditions": "高血压",
            "allergies": "花生",
            "dietary_restrictions": "",
            "notes": ""
        },
        {
            "name": "王爷爷",
            "room_number": "105室",
            "delivery_route": "A线-1号楼",
            "phone": "13800138003",
            "chronic_conditions": "糖尿病,心脏病",
            "allergies": "",
            "dietary_restrictions": "油腻",
            "notes": "血糖偏高"
        }
    ]

    elderly_ids = []
    for data in elderly_data:
        response = requests.post(f"{BASE_URL}/elderly/", json=data)
        result = response.json()
        elderly_ids.append(result["id"])
        print(f"✓ 已添加: {result['name']} (ID: {result['id']})")
        print(f"  - 慢病: {result['chronic_conditions']}")
        print(f"  - 过敏: {result['allergies'] or '无'}")
        print(f"  - 配送路线: {result['delivery_route']}\n")

    return elderly_ids


def test_meal_validation(elderly_ids):
    print_section("2. 配餐校验测试")

    test_cases = [
        {
            "name": "正常配餐（张爷爷）",
            "elderly_idx": 0,
            "menu": "米饭,清蒸鱼,炒青菜,冬瓜汤",
            "expected": "通过"
        },
        {
            "name": "糖尿病禁忌（张爷爷配蛋糕）",
            "elderly_idx": 0,
            "menu": "米饭,红烧肉,炒青菜,水果蛋糕",
            "expected": "拦截"
        },
        {
            "name": "过敏风险（李奶奶配花生）",
            "elderly_idx": 1,
            "menu": "馒头,宫保鸡丁,花生粥",
            "expected": "拦截"
        },
        {
            "name": "多种问题（王爷爷配糖和海鲜）",
            "elderly_idx": 2,
            "menu": "糖醋排骨,海鲜汤,米饭",
            "expected": "拦截"
        },
        {
            "name": "正常配餐（李奶奶）",
            "elderly_idx": 1,
            "menu": "小米粥,馒头,炒蛋,凉拌黄瓜",
            "expected": "通过"
        }
    ]

    record_ids = []
    for case in test_cases:
        meal_data = {
            "elderly_id": elderly_ids[case["elderly_idx"]],
            "meal_date": datetime.now().isoformat(),
            "meal_type": "午餐",
            "menu_items": case["menu"],
            "handled_by": "张管理员"
        }

        print(f"测试: {case['name']}")
        print(f"  菜单: {case['menu']}")

        validate_response = requests.post(f"{BASE_URL}/meals/validate", json=meal_data)
        validate_result = validate_response.json()
        print(f"  校验结果: {validate_result['status']}")
        print(f"  异常类型: {validate_result['exception_type']}")
        print(f"  原因: {validate_result['reason']}")

        create_response = requests.post(f"{BASE_URL}/meals/", json=meal_data)
        create_result = create_response.json()
        record_ids.append(create_result["id"])
        print(f"  → 记录已保存 (ID: {create_result['id']})\n")

    return record_ids


def test_meal_modification(record_ids):
    print_section("3. 改餐流程（保留历史记录）")

    meal_id = record_ids[1]

    print(f"原始记录 (ID: {meal_id}):")
    response = requests.get(f"{BASE_URL}/meals/{meal_id}")
    original = response.json()
    print(f"  菜单: {original['menu_items']}")
    print(f"  状态: {original['status']}")
    print(f"  原因: {original['reason']}\n")

    print("修改菜单（移除蛋糕）:")
    update_data = {
        "menu_items": "米饭,红烧肉,炒青菜,苹果",
        "changed_by": "李管理员",
        "change_reason": "家属要求更换蛋糕为水果"
    }

    response = requests.put(f"{BASE_URL}/meals/{meal_id}", json=update_data)
    updated = response.json()
    print(f"  新菜单: {updated['menu_items']}")
    print(f"  新状态: {updated['status']}")
    print(f"  新原因: {updated['reason']}\n")

    print("查看改餐历史:")
    history_response = requests.get(f"{BASE_URL}/meals/{meal_id}/history")
    history = history_response.json()
    for h in history:
        print(f"  时间: {h['created_at']}")
        print(f"  修改人: {h['changed_by']}")
        print(f"  原菜单: {h['previous_menu']}")
        print(f"  新菜单: {h['new_menu']}")
        print(f"  改餐原因: {h['change_reason']}\n")


def test_query_and_filter():
    print_section("4. 查询与筛选功能")

    print("查询所有拦截记录:")
    response = requests.get(f"{BASE_URL}/meals/", params={"status": "拦截"})
    blocked_records = response.json()
    for record in blocked_records:
        print(f"  ID: {record['id']}, {record['elderly_name']}")
        print(f"    菜单: {record['menu_items']}")
        print(f"    拦截原因: {record['reason']}\n")

    print("按操作人筛选:")
    response = requests.get(f"{BASE_URL}/meals/", params={"handled_by": "张管理员"})
    print(f"  张管理员处理的记录数: {len(response.json())}\n")

    print("按异常类型筛选（糖尿病禁忌）:")
    response = requests.get(f"{BASE_URL}/meals/", params={"exception_type": "糖尿病禁忌"})
    diabetes_records = response.json()
    print(f"  糖尿病禁忌记录数: {len(diabetes_records)}")
    for r in diabetes_records:
        print(f"    - {r['elderly_name']}: {r['reason']}")


def test_export_report():
    print_section("5. 导出Excel报告")

    print("导出所有配餐记录...")
    response = requests.get(f"{BASE_URL}/export/meals")

    with open("配餐记录报告.xlsx", "wb") as f:
        f.write(response.content)

    print("✓ 报告已导出: 配餐记录报告.xlsx")

    print("\n导出拦截记录报告...")
    response = requests.get(f"{BASE_URL}/export/meals", params={"status": "拦截"})
    with open("拦截记录报告.xlsx", "wb") as f:
        f.write(response.content)
    print("✓ 报告已导出: 拦截记录报告.xlsx")


def test_single_record_explanation():
    print_section("6. 单条记录详细说明（用于向老人/家属解释）")

    response = requests.get(f"{BASE_URL}/meals/")
    records = response.json()

    if records:
        record = records[1]
        print(f"【配餐记录详情 - ID: {record['id']}】")
        print(f"  老人姓名: {record['elderly_name']}")
        print(f"  配餐日期: {record['meal_date'][:10]}")
        print(f"  菜单: {record['menu_items']}")
        print(f"  处理状态: {record['status']}")
        print(f"  异常类型: {record['exception_type']}")
        print(f"  详细原因: {record['reason']}")
        print(f"  操作人: {record['handled_by']}")
        print(f"\n  解释话术示例:")
        print(f"  '您好，{record['elderly_name']}的这餐饭因为{record['reason']}，")
        print(f"   所以被系统拦截了。我们已经安排重新调配适合的餐食，请放心。'")


def main():
    print("社区食堂配餐管理系统 - 流程演示")
    print("=" * 60)

    try:
        elderly_ids = test_elderly_management()
        record_ids = test_meal_validation(elderly_ids)
        test_meal_modification(record_ids)
        test_query_and_filter()
        test_export_report()
        test_single_record_explanation()

        print_section("演示完成")
        print("✓ 所有流程测试通过！")
        print(f"\nAPI文档地址: {BASE_URL}/docs")
        print("可以使用上面的地址查看完整的API接口文档")

    except requests.exceptions.ConnectionError:
        print("\n✗ 连接失败！请先启动服务:")
        print("  python main.py")
        print("  或")
        print("  uvicorn main:app --reload")
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
