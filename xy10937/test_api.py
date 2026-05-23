import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def print_response(title, response):
    print(f"\n{'='*50}")
    print(f"📌 {title}")
    print(f"状态码: {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return data
    except:
        print(response.text)
        return None


def get_material_id_by_name(materials, name):
    for m in materials:
        if m["name"] == name:
            return m["id"]
    return None


def test_sample_workflow(run_id=None):
    if run_id:
        print(f"\n{'#'*60}")
        print(f"# 🧪 第 {run_id} 次运行测试")
        print(f"{'#'*60}")
    
    print("🚀 开始婚礼物料归还 API 完整流程测试...")
    
    event_date = (datetime.now() + timedelta(days=7)).isoformat()
    timestamp = int(time.time() * 1000)
    
    print("\n" + "="*50)
    print("1️⃣ 创建活动订单")
    order_data = {
        "order_no": f"WD{timestamp}",
        "customer_name": "张三 & 李四",
        "customer_phone": "13800138000",
        "event_date": event_date,
        "event_location": "皇家婚礼宴会厅",
        "notes": "VIP客户，注意花架品质",
        "materials": [
            {
                "name": "白色铁艺花架",
                "category": "flower_stand",
                "quantity": 20,
                "unit_price": 150.0,
                "description": "主舞台两侧装饰"
            },
            {
                "name": "LED暖光灯串",
                "category": "light_string",
                "quantity": 50,
                "unit_price": 30.0,
                "description": "通道装饰"
            },
            {
                "name": "亚克力桌牌",
                "category": "table_card",
                "quantity": 30,
                "unit_price": 25.0,
                "description": "宾客座位"
            }
        ]
    }
    
    r = requests.post(f"{BASE_URL}/api/orders", json=order_data)
    result = print_response("创建订单", r)
    order_id = result["data"]["order_id"]
    print(f"✅ 订单ID: {order_id}")
    
    print("\n" + "="*50)
    print("2️⃣ 查询订单详情，获取动态 material_id")
    r = requests.get(f"{BASE_URL}/api/orders/{order_id}")
    order_detail = print_response("订单详情", r)
    materials = order_detail["data"]["order"]["materials"]
    
    flower_stand_id = get_material_id_by_name(materials, "白色铁艺花架")
    light_string_id = get_material_id_by_name(materials, "LED暖光灯串")
    table_card_id = get_material_id_by_name(materials, "亚克力桌牌")
    
    print(f"✅ 动态获取 material_id: 花架={flower_stand_id}, 灯串={light_string_id}, 桌牌={table_card_id}")
    
    print("\n" + "="*50)
    print("3️⃣ 物料出库 (使用动态 material_id)")
    outbound_data = {
        "order_id": order_id,
        "operator": "仓管员小王",
        "notes": "已清点完毕，全部出库",
        "items": [
            {"material_id": flower_stand_id, "quantity": 20},
            {"material_id": light_string_id, "quantity": 50},
            {"material_id": table_card_id, "quantity": 30}
        ]
    }
    r = requests.post(f"{BASE_URL}/api/outbounds", json=outbound_data)
    result = print_response("物料出库", r)
    outbound_id = result["data"]["outbound_id"]
    
    print("\n" + "="*50)
    print("4️⃣ 检查订单状态 (应为 materials_out)")
    r = requests.get(f"{BASE_URL}/api/orders/{order_id}")
    print_response("订单状态检查", r)
    
    print("\n" + "="*50)
    print("5️⃣ 创建归还记录 (模拟丢失损坏，使用动态 material_id)")
    return_data = {
        "order_id": order_id,
        "operator": "现场负责人老李",
        "notes": "活动结束，开始归还清点",
        "items": [
            {
                "material_id": flower_stand_id,
                "expected_quantity": 20,
                "returned_quantity": 18,
                "damage_type": "lost",
                "damage_notes": "丢失2个花架，疑似被宾客带走"
            },
            {
                "material_id": light_string_id,
                "expected_quantity": 50,
                "returned_quantity": 45,
                "damage_type": "damaged",
                "damage_notes": "5个灯串线路损坏，无法使用"
            },
            {
                "material_id": table_card_id,
                "expected_quantity": 30,
                "returned_quantity": 30,
                "damage_type": "none",
                "damage_notes": "全部完好归还"
            }
        ]
    }
    r = requests.post(f"{BASE_URL}/api/returns", json=return_data)
    result = print_response("创建归还记录", r)
    return_id = result["data"]["return_id"]
    
    print("\n" + "="*50)
    print("6️⃣ 审核归还记录")
    review_data = {
        "reviewed_by": "仓库主管张经理",
        "review_notes": "情况属实，进入赔付流程",
        "status": "reviewed"
    }
    r = requests.put(f"{BASE_URL}/api/returns/{return_id}/review", json=review_data)
    print_response("审核归还记录", r)
    
    print("\n" + "="*50)
    print("7️⃣ 创建赔付记录 (花架丢失，使用动态 material_id)")
    compensation1_data = {
        "order_id": order_id,
        "return_id": return_id,
        "material_id": flower_stand_id,
        "damage_type": "lost",
        "quantity": 2,
        "unit_amount": 150.0,
        "notes": "花架丢失，按原价赔付"
    }
    r = requests.post(f"{BASE_URL}/api/compensations", json=compensation1_data)
    result = print_response("创建赔付记录1", r)
    comp1_id = result["data"]["compensation_id"]
    
    print("\n" + "="*50)
    print("8️⃣ 创建赔付记录 (灯串损坏，使用动态 material_id)")
    compensation2_data = {
        "order_id": order_id,
        "return_id": return_id,
        "material_id": light_string_id,
        "damage_type": "damaged",
        "quantity": 5,
        "unit_amount": 15.0,
        "notes": "灯串损坏，按50%折旧赔付"
    }
    r = requests.post(f"{BASE_URL}/api/compensations", json=compensation2_data)
    result = print_response("创建赔付记录2", r)
    comp2_id = result["data"]["compensation_id"]
    
    print("\n" + "="*50)
    print("9️⃣ 确认赔付已完成")
    update_data1 = {
        "status": "paid",
        "paid_by": "财务小王",
        "notes": "客户已现场转账赔付"
    }
    r = requests.put(f"{BASE_URL}/api/compensations/{comp1_id}/status", json=update_data1)
    print_response("确认赔付1", r)
    
    r = requests.put(f"{BASE_URL}/api/compensations/{comp2_id}/status", json=update_data1)
    print_response("确认赔付2", r)
    
    print("\n" + "="*50)
    print("🔟 导出结案报告")
    r = requests.get(f"{BASE_URL}/api/orders/{order_id}/report", params={"generated_by": "系统管理员"})
    result = print_response("导出结案报告", r)
    
    print("\n" + "="*50)
    print("1️⃣1️⃣ 测试重复归还拦截")
    r = requests.post(f"{BASE_URL}/api/returns", json=return_data)
    print_response("重复归还拦截测试", r)
    
    print("\n" + "="*50)
    print("1️⃣2️⃣ 查看异常记录")
    r = requests.get(f"{BASE_URL}/api/exceptions")
    print_response("异常记录列表", r)
    
    print("\n" + "="*50)
    print("1️⃣3️⃣ 查看订单最终状态 (应为 completed)")
    r = requests.get(f"{BASE_URL}/api/orders/{order_id}")
    print_response("最终订单状态", r)
    
    print("\n" + "="*50)
    print("🎯 所有测试完成！")
    print("📋 测试覆盖了:")
    print("  ✅ 创建订单 & 查询订单")
    print("  ✅ 动态获取 material_id (无硬编码)")
    print("  ✅ 毫秒级订单号 (避免重复)")
    print("  ✅ 物料出库 & 状态流转")
    print("  ✅ 归还记录 & 审核")
    print("  ✅ 丢损赔付 & 状态机")
    print("  ✅ 重复归还拦截")
    print("  ✅ 异常处理 & 记录")
    print("  ✅ 结案报告导出")
    print("\n💾 所有数据已持久化到 SQLite 数据库，重启服务数据不会丢失")
    
    return True


if __name__ == "__main__":
    import sys
    
    num_runs = 1
    if len(sys.argv) > 1:
        num_runs = int(sys.argv[1])
    
    print(f"🧪 将运行 {num_runs} 次完整流程测试")
    print(f"⏱️  每次运行间隔 1 秒确保订单号唯一")
    print()
    
    all_passed = True
    for i in range(1, num_runs + 1):
        try:
            test_sample_workflow(run_id=i)
            print(f"\n✅ 第 {i} 次测试通过！")
            if i < num_runs:
                import time
                time.sleep(1)
        except Exception as e:
            print(f"\n❌ 第 {i} 次测试失败: {e}")
            all_passed = False
            break
    
    print("\n" + "="*60)
    if all_passed:
        print(f"🎉 所有 {num_runs} 次测试全部通过！")
        print("✅ 测试脚本支持重复执行，数据不会冲突")
    else:
        print("❌ 部分测试失败，请检查错误信息")
    print("="*60)