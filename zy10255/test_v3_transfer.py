import httpx
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"

def test_v3_transfer():
    print("=" * 70)
    print("  第三轮修复验证：换租分摊算法")
    print("=" * 70)
    
    with httpx.Client() as client:
        print("\n【测试场景：按天数比例分摊】")
        print("-" * 50)
        print("设置：30天账期，第10天换租，总水费用量 30 吨，单价 10 元/吨")
        print("期望：旧租客分摊 10 吨（100 元），新租客分摊 20 吨（200 元）")
        
        print("\n1. 创建测试房间")
        r = client.post(f"{BASE_URL}/rooms", json={
            "room_number": "V3-TEST-201",
            "floor": 2,
            "building": "测试楼"
        })
        room_id = r.json()["id"]
        
        print("\n2. 创建旧租客和新租客")
        r = client.post(f"{BASE_URL}/tenants", json={
            "name": "张三-旧",
            "phone": "18900000001",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=60)).isoformat()
        })
        old_tenant_id = r.json()["id"]
        
        r = client.post(f"{BASE_URL}/tenants", json={
            "name": "李四-新",
            "phone": "18900000002",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=20)).isoformat()
        })
        new_tenant_id = r.json()["id"]
        print(f"   ✓ 旧租客ID: {old_tenant_id}, 新租客ID: {new_tenant_id}")
        
        print("\n3. 设置水费单价为 10 元/吨")
        client.post(f"{BASE_URL}/prices", json={
            "meter_type": "water",
            "unit_price": 10.0,
            "effective_date": (datetime.now() - timedelta(days=60)).isoformat()
        })
        
        print("\n4. 创建抄表记录（期初 100，期末 130，总用量 30 吨）")
        period_start = (datetime.now() - timedelta(days=30)).isoformat()
        period_mid = (datetime.now() - timedelta(days=20)).isoformat()
        period_end = datetime.now().isoformat()
        
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 100.0,
            "reading_date": period_start
        })
        client.post(f"{BASE_URL}/meter-readings/{r.json()['id']}/confirm")
        
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 130.0,
            "reading_date": period_end
        })
        client.post(f"{BASE_URL}/meter-readings/{r.json()['id']}/confirm")
        print(f"   ✓ 期初 100，期末 130，总用量 30 吨")
        
        print("\n5. 创建换租交接（第10天换租，不设置交接表码）")
        r = client.post(f"{BASE_URL}/tenant-transfers", json={
            "room_id": room_id,
            "old_tenant_id": old_tenant_id,
            "new_tenant_id": new_tenant_id,
            "transfer_date": (datetime.now() - timedelta(days=20)).isoformat()
        })
        transfer_id = r.json()["id"]
        print(f"   ✓ 换租交接ID: {transfer_id}")
        
        r = client.post(f"{BASE_URL}/tenant-transfers/{transfer_id}/confirm")
        print(f"   ✓ 确认换租: {r.json()}")
        
        print("\n6. 生成旧租客账单（按比例 10/30）")
        r = client.post(f"{BASE_URL}/bills/generate", params={
            "room_id": room_id,
            "tenant_id": old_tenant_id,
            "period_start": period_start,
            "period_end": period_end,
            "transfer_id": transfer_id
        })
        old_bill_result = r.json()
        old_bill_id = old_bill_result["bill_id"]
        print(f"   ✓ 旧租客账单金额: {old_bill_result['total_amount']} 元")
        
        print("\n7. 旧租客账单详情")
        r = client.get(f"{BASE_URL}/bills/{old_bill_id}")
        old_detail = r.json()
        old_item = old_detail["items"][0]
        print(f"     - 用量: {old_item['usage']} 吨")
        print(f"     - 分摊比例: {old_item['transfer_split_ratio']:.4f}")
        print(f"     - 金额: {old_item['amount']} 元")
        
        expected_old_usage = 10.0
        expected_old_amount = 100.0
        if abs(old_item["usage"] - expected_old_usage) < 0.01:
            print(f"   ✓ 旧租客用量正确！")
        else:
            print(f"   ✗ 旧租客用量错误！期望 {expected_old_usage}，实际 {old_item['usage']}")
            return False
        
        print("\n8. 生成新租客账单（按比例 20/30）")
        r = client.post(f"{BASE_URL}/bills/generate", params={
            "room_id": room_id,
            "tenant_id": new_tenant_id,
            "period_start": period_start,
            "period_end": period_end,
            "transfer_id": transfer_id
        })
        new_bill_result = r.json()
        new_bill_id = new_bill_result["bill_id"]
        print(f"   ✓ 新租客账单金额: {new_bill_result['total_amount']} 元")
        
        print("\n9. 新租客账单详情")
        r = client.get(f"{BASE_URL}/bills/{new_bill_id}")
        new_detail = r.json()
        new_item = new_detail["items"][0]
        print(f"     - 用量: {new_item['usage']} 吨")
        print(f"     - 分摊比例: {new_item['transfer_split_ratio']:.4f}")
        print(f"     - 金额: {new_item['amount']} 元")
        
        expected_new_usage = 20.0
        expected_new_amount = 200.0
        if abs(new_item["usage"] - expected_new_usage) < 0.01:
            print(f"   ✓ 新租客用量正确！")
        else:
            print(f"   ✗ 新租客用量错误！期望 {expected_new_usage}，实际 {new_item['usage']}")
            return False
        
        total_usage = old_item["usage"] + new_item["usage"]
        total_amount = old_item["amount"] + new_item["amount"]
        if abs(total_usage - 30.0) < 0.01:
            print(f"   ✓ 合计用量正确！总计 {total_usage} 吨")
        else:
            print(f"   ✗ 合计用量错误！期望 30，实际 {total_usage}")
            return False
        
        print("\n【测试场景：按交接表码精确分摊】")
        print("-" * 50)
        print("设置：期初 200，换租交接表码 210，期末 230，总用量 30 吨")
        print("期望：旧租客 10 吨，新租客 20 吨")
        
        print("\n10. 创建新测试房间")
        r = client.post(f"{BASE_URL}/rooms", json={
            "room_number": "V3-TEST-202",
            "floor": 2,
            "building": "测试楼"
        })
        room_id2 = r.json()["id"]
        
        print("\n11. 创建新测试租客")
        r = client.post(f"{BASE_URL}/tenants", json={
            "name": "王五-旧2",
            "phone": "18900000003",
            "room_id": room_id2,
            "move_in_date": (datetime.now() - timedelta(days=60)).isoformat()
        })
        old_tenant_id2 = r.json()["id"]
        
        r = client.post(f"{BASE_URL}/tenants", json={
            "name": "赵六-新2",
            "phone": "18900000004",
            "room_id": room_id2,
            "move_in_date": (datetime.now() - timedelta(days=20)).isoformat()
        })
        new_tenant_id2 = r.json()["id"]
        
        print("\n12. 创建抄表记录")
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id2,
            "meter_type": "water",
            "reading_value": 200.0,
            "reading_date": period_start
        })
        client.post(f"{BASE_URL}/meter-readings/{r.json()['id']}/confirm")
        
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id2,
            "meter_type": "water",
            "reading_value": 230.0,
            "reading_date": period_end
        })
        client.post(f"{BASE_URL}/meter-readings/{r.json()['id']}/confirm")
        
        print("\n13. 创建带交接表码的换租交接（水表 210）")
        r = client.post(f"{BASE_URL}/tenant-transfers", json={
            "room_id": room_id2,
            "old_tenant_id": old_tenant_id2,
            "new_tenant_id": new_tenant_id2,
            "transfer_date": (datetime.now() - timedelta(days=20)).isoformat(),
            "water_reading": 210.0
        })
        transfer_id2 = r.json()["id"]
        client.post(f"{BASE_URL}/tenant-transfers/{transfer_id2}/confirm")
        print(f"   ✓ 换租交接，水表码: 210")
        
        print("\n14. 生成旧租客账单（按交接表码 200→210）")
        r = client.post(f"{BASE_URL}/bills/generate", params={
            "room_id": room_id2,
            "tenant_id": old_tenant_id2,
            "period_start": period_start,
            "period_end": period_end,
            "transfer_id": transfer_id2
        })
        old_bill_result2 = r.json()
        old_bill_id2 = old_bill_result2["bill_id"]
        
        r = client.get(f"{BASE_URL}/bills/{old_bill_id2}")
        old_detail2 = r.json()
        old_item2 = old_detail2["items"][0]
        print(f"     - 旧租客用量: {old_item2['usage']} 吨, 金额: {old_item2['amount']} 元")
        
        if abs(old_item2["usage"] - 10.0) < 0.01:
            print(f"   ✓ 旧租客用量正确（10 吨）！")
        else:
            print(f"   ✗ 旧租客用量错误！期望 10，实际 {old_item2['usage']}")
            return False
        
        print("\n15. 生成新租客账单（按交接表码 210→230）")
        r = client.post(f"{BASE_URL}/bills/generate", params={
            "room_id": room_id2,
            "tenant_id": new_tenant_id2,
            "period_start": period_start,
            "period_end": period_end,
            "transfer_id": transfer_id2
        })
        new_bill_result2 = r.json()
        new_bill_id2 = new_bill_result2["bill_id"]
        
        r = client.get(f"{BASE_URL}/bills/{new_bill_id2}")
        new_detail2 = r.json()
        new_item2 = new_detail2["items"][0]
        print(f"     - 新租客用量: {new_item2['usage']} 吨, 金额: {new_item2['amount']} 元")
        
        if abs(new_item2["usage"] - 20.0) < 0.01:
            print(f"   ✓ 新租客用量正确（20 吨）！")
        else:
            print(f"   ✗ 新租客用量错误！期望 20，实际 {new_item2['usage']}")
            return False
        
        total_usage2 = old_item2["usage"] + new_item2["usage"]
        if abs(total_usage2 - 30.0) < 0.01:
            print(f"   ✓ 合计用量正确！总计 {total_usage2} 吨")
        else:
            print(f"   ✗ 合计用量错误！期望 30，实际 {total_usage2}")
            return False
        
        print("\n【测试场景：换租当天重复计费验证】")
        print("-" * 50)
        print("验证：同一账期 + 同一换租交接只能各生成一次")
        
        print("\n16. 重复生成旧租客账单")
        r = client.post(f"{BASE_URL}/bills/generate", params={
            "room_id": room_id2,
            "tenant_id": old_tenant_id2,
            "period_start": period_start,
            "period_end": period_end,
            "transfer_id": transfer_id2
        })
        result = r.json()
        if result.get("is_existing"):
            print(f"   ✓ 幂等生效！返回已有账单，不重复计费")
        else:
            print(f"   ✗ 重复生成了账单！is_existing = {result.get('is_existing')}")
            return False
        
        print("\n17. 查询旧租客账单数量")
        r = client.get(f"{BASE_URL}/bills", params={"tenant_id": old_tenant_id2})
        bills = r.json()
        if len(bills) == 1:
            print(f"   ✓ 账单数量正确，只有 {len(bills)} 条")
        else:
            print(f"   ✗ 账单数量错误！期望 1，实际 {len(bills)}")
            return False
        
        print("\n" + "=" * 70)
        print("  ✅ 第三轮换租分摊算法修复验证通过！")
        print("=" * 70)
        print("\n修复总结：")
        print("  1. ✅ 旧租客正确使用换租前天数/表码计算")
        print("  2. ✅ 新租客正确使用换租后天数/表码计算")
        print("  3. ✅ 支持使用 tenant_transfers.water_reading/electricity_reading 精确计算")
        print("  4. ✅ 新旧租客合计用量 = 总用量，不重复不计漏")
        print("  5. ✅ 幂等机制防止重复计费")
        return True

if __name__ == "__main__":
    import os
    os.system("pkill -9 -f 'python.*main.py' 2>/dev/null")
    import time
    time.sleep(2)
    
    if os.path.exists("apartment_meter.db"):
        os.remove("apartment_meter.db")
        print("已清理旧数据库")
    
    print("启动API服务...")
    import subprocess
    subprocess.Popen(["python3", "main.py"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(3)
    
    test_v3_transfer()
