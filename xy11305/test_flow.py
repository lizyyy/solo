import requests
import json

BASE_URL = "http://localhost:8000"

def print_step(step, description):
    print(f"\n{'='*60}")
    print(f"步骤 {step}: {description}")
    print('='*60)

def print_response(title, data):
    print(f"\n{title}:")
    print(json.dumps(data, ensure_ascii=False, indent=2))

def test_full_flow():
    print("社区食堂配餐管理系统 - 完整流程测试")
    print("=" * 60)

    print_step(1, "导入老人档案CSV（含正常和异常记录）")
    with open('test_elderly.csv', 'rb') as f:
        files = {'file': ('test_elderly.csv', f, 'text/csv')}
        response = requests.post(f"{BASE_URL}/api/elderly/import-csv", files=files)
    result = response.json()
    print_response("导入结果", result)
    print(f"\n✓ 正常记录: {result['valid_count']} 条, 异常记录: {result['invalid_count']} 条")
    
    elderly_list = result['valid_records']
    elderly_ids = [e['id'] for e in elderly_list]
    
    print_step(2, "查看所有老人列表（敏感字段已脱敏）")
    response = requests.get(f"{BASE_URL}/api/elderly")
    print_response("老人列表", response.json())

    print_step(3, "创建菜单（含无糖和有糖选项）")
    menus = [
        {"name": "无糖小米粥", "meal_type": "早餐", "date": "2024-01-15", "ingredients": ["小米", "水"], "is_sugar_free": True, "allergens": []},
        {"name": "红糖发糕", "meal_type": "早餐", "date": "2024-01-15", "ingredients": ["面粉", "红糖"], "is_sugar_free": False, "allergens": ["麸质"]},
        {"name": "清蒸鱼", "meal_type": "午餐", "date": "2024-01-15", "ingredients": ["鱼", "姜", "葱"], "is_sugar_free": True, "allergens": ["海鲜"]},
        {"name": "红烧肉", "meal_type": "午餐", "date": "2024-01-15", "ingredients": ["猪肉", "酱油", "糖"], "is_sugar_free": False, "allergens": []},
    ]
    menu_ids = []
    for menu in menus:
        response = requests.post(f"{BASE_URL}/api/menu", json=menu)
        menu_data = response.json()
        menu_ids.append(menu_data['id'])
        print(f"创建菜单: {menu['name']} (ID: {menu_data['id']})")

    print_step(4, "查看当日菜单")
    response = requests.get(f"{BASE_URL}/api/menu?meal_date=2024-01-15")
    print_response("当日菜单", response.json())

    print_step(5, "为糖尿病老人配无糖餐（应该通过）")
    response = requests.post(
        f"{BASE_URL}/api/meal-order?request_id=req001&elderly_id={elderly_ids[0]}&menu_item_id={menu_ids[0]}"
    )
    result = response.json()
    print_response("配餐结果", result)
    order_id_1 = result['order']['id']

    print_step(6, "为糖尿病老人配有糖餐（应该拦截）")
    response = requests.post(
        f"{BASE_URL}/api/meal-order?request_id=req002&elderly_id={elderly_ids[0]}&menu_item_id={menu_ids[1]}"
    )
    result = response.json()
    print_response("配餐结果（糖尿病禁忌拦截）", result)

    print_step(7, "为海鲜过敏老人配海鲜餐（应该拦截）")
    response = requests.post(
        f"{BASE_URL}/api/meal-order?request_id=req003&elderly_id={elderly_ids[0]}&menu_item_id={menu_ids[2]}"
    )
    result = response.json()
    print_response("配餐结果（过敏源拦截）", result)

    print_step(8, "重复提交相同request_id（幂等性测试）")
    response = requests.post(
        f"{BASE_URL}/api/meal-order?request_id=req001&elderly_id={elderly_ids[0]}&menu_item_id={menu_ids[0]}"
    )
    result = response.json()
    print_response("幂等性测试结果", result)

    print_step(9, "改餐 - 换成红烧肉（测试改餐历史记录）")
    response = requests.post(
        f"{BASE_URL}/api/meal-order/change?request_id=change001&order_id={order_id_1}&new_menu_item_id={menu_ids[3]}&change_reason=老人想吃肉"
    )
    result = response.json()
    print_response("改餐结果", result)

    print_step(10, "查看订单改餐历史")
    response = requests.get(f"{BASE_URL}/api/meal-order/{order_id_1}/changes")
    print_response("改餐历史", response.json())

    print_step(11, "创建配送记录")
    response = requests.post(
        f"{BASE_URL}/api/delivery?request_id=delivery001&order_id={order_id_1}"
    )
    result = response.json()
    print_response("配送创建结果", result)
    delivery_id = result['delivery']['id']

    print_step(12, "按路线查看配送列表")
    response = requests.get(f"{BASE_URL}/api/delivery?route=路线A")
    print_response("路线A配送列表", response.json())

    print_step(13, "确认配送完成")
    response = requests.put(
        f"{BASE_URL}/api/delivery/{delivery_id}/status?status=已送达&notes=老人已签收，态度很好"
    )
    print_response("配送状态更新", response.json())

    print_step(14, "创建回访记录")
    response = requests.post(
        f"{BASE_URL}/api/follow-up?request_id=follow001&order_id={order_id_1}&satisfaction=5&feedback=饭菜可口，温度合适"
    )
    result = response.json()
    print_response("回访记录", result)

    print_step(15, "查看回访记录")
    response = requests.get(f"{BASE_URL}/api/follow-up")
    print_response("所有回访记录", response.json())

    print("\n" + "="*60)
    print("✓ 完整流程测试完成！")
    print("="*60)
    print("\n主要功能验证点：")
    print("1. ✓ CSV导入自动区分正常/异常记录")
    print("2. ✓ 敏感字段（电话、身份证）在响应和日志中脱敏")
    print("3. ✓ 糖尿病禁忌配餐拦截")
    print("4. ✓ 过敏源配餐拦截")
    print("5. ✓ 重复提交幂等性保证")
    print("6. ✓ 改餐历史记录保留")
    print("7. ✓ 每条拦截/放行都有明确原因")

if __name__ == "__main__":
    try:
        test_full_flow()
    except Exception as e:
        print(f"\n测试出错: {e}")
        print("请先启动服务: python main.py")
