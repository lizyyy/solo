import httpx
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"

def test_v2_fixes():
    print("=" * 70)
    print("  第二轮修复验证测试")
    print("=" * 70)
    
    with httpx.Client() as client:
        print("\n【修复1: SQLAlchemy func.sum 导入验证】")
        print("-" * 50)
        
        print("\n1. 创建测试房间")
        r = client.post(f"{BASE_URL}/rooms", json={
            "room_number": "V2-TEST-101",
            "floor": 1,
            "building": "测试楼"
        })
        room_id = r.json()["id"]
        print(f"   ✓ 房间ID: {room_id}")
        
        print("\n2. 创建测试租客")
        r = client.post(f"{BASE_URL}/tenants", json={
            "name": "测试租客-余额",
            "phone": "18800000001",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=30)).isoformat()
        })
        tenant_id = r.json()["id"]
        print(f"   ✓ 租客ID: {tenant_id}")
        
        print("\n3. 租客预充值 500元")
        r = client.post(f"{BASE_URL}/precharges", json={
            "tenant_id": tenant_id,
            "amount": 500.0,
            "payment_method": "test"
        })
        print(f"   ✓ 预充值完成")
        
        print("\n4. 查询余额（验证 func.sum 不报错）")
        r = client.get(f"{BASE_URL}/tenants/{tenant_id}/balance")
        if r.status_code == 200:
            balance_data = r.json()
            print(f"   ✓ 余额查询成功！")
            print(f"     - 总预充值: {balance_data['total_precharge']}")
            print(f"     - 总账单: {balance_data['total_bill']}")
            print(f"     - 当前余额: {balance_data['balance']}")
            print(f"     - 余额不足标记: {balance_data['insufficient']}")
        else:
            print(f"   ✗ 余额查询失败: {r.status_code} - {r.text}")
            return False
        
        print("\n【修复2: 账单幂等性验证 - 防止重复出账】")
        print("-" * 50)
        
        print("\n5. 设置单价")
        client.post(f"{BASE_URL}/prices", json={
            "meter_type": "water",
            "unit_price": 5.0,
            "effective_date": (datetime.now() - timedelta(days=60)).isoformat()
        })
        client.post(f"{BASE_URL}/prices", json={
            "meter_type": "electricity",
            "unit_price": 0.8,
            "effective_date": (datetime.now() - timedelta(days=60)).isoformat()
        })
        print(f"   ✓ 单价设置完成")
        
        print("\n6. 创建抄表记录")
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 100.0,
            "reading_date": (datetime.now() - timedelta(days=30)).isoformat()
        })
        client.post(f"{BASE_URL}/meter-readings/{r.json()['id']}/confirm")
        
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id,
            "meter_type": "electricity",
            "reading_value": 1000.0,
            "reading_date": (datetime.now() - timedelta(days=30)).isoformat()
        })
        client.post(f"{BASE_URL}/meter-readings/{r.json()['id']}/confirm")
        
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 120.0,
            "reading_date": datetime.now().isoformat()
        })
        client.post(f"{BASE_URL}/meter-readings/{r.json()['id']}/confirm")
        
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id,
            "meter_type": "electricity",
            "reading_value": 1100.0,
            "reading_date": datetime.now().isoformat()
        })
        client.post(f"{BASE_URL}/meter-readings/{r.json()['id']}/confirm")
        print(f"   ✓ 抄表记录创建并确认完成")
        
        period_start = (datetime.now() - timedelta(days=30)).isoformat()
        period_end = datetime.now().isoformat()
        
        print("\n7. 第一次生成账单")
        r = client.post(f"{BASE_URL}/bills/generate", params={
            "room_id": room_id,
            "tenant_id": tenant_id,
            "period_start": period_start,
            "period_end": period_end
        })
        result1 = r.json()
        bill1_id = result1["bill_id"]
        bill1_no = result1["bill_no"]
        print(f"   ✓ 账单ID: {bill1_id}, 单号: {bill1_no}, 金额: {result1['total_amount']}")
        
        print("\n8. 第二次生成账单（相同参数 - 应该幂等）")
        r = client.post(f"{BASE_URL}/bills/generate", params={
            "room_id": room_id,
            "tenant_id": tenant_id,
            "period_start": period_start,
            "period_end": period_end
        })
        result2 = r.json()
        
        if result2.get("is_existing") and result2["bill_id"] == bill1_id:
            print(f"   ✓ 幂等生效！返回已存在账单，没有重复创建")
            print(f"     - 账单ID相同: {result2['bill_id']} == {bill1_id}")
        else:
            print(f"   ✗ 幂等失败！创建了重复账单")
            print(f"     - 第一次ID: {bill1_id}, 第二次ID: {result2.get('bill_id')}")
            return False
        
        print("\n9. 查询账单列表 - 验证只有1条账单")
        r = client.get(f"{BASE_URL}/bills", params={"tenant_id": tenant_id})
        bills = r.json()
        if len(bills) == 1:
            print(f"   ✓ 账单数量正确，只有1条账单")
        else:
            print(f"   ✗ 账单数量错误，期望1条，实际{len(bills)}条")
            return False
        
        print("\n【修复3: 预充值扣减闭环验证】")
        print("-" * 50)
        
        print("\n10. 确认账单前再次查询余额")
        r = client.get(f"{BASE_URL}/tenants/{tenant_id}/balance")
        before_balance = r.json()["balance"]
        print(f"   ✓ 确认前余额: {before_balance}")
        
        print("\n11. 确认账单")
        r = client.post(f"{BASE_URL}/bills/{bill1_id}/confirm", json={
            "bill_id": bill1_id,
            "notes": "测试确认账单"
        })
        if r.status_code == 200:
            print(f"   ✓ 账单确认成功")
        else:
            print(f"   ✗ 账单确认失败: {r.status_code} - {r.text}")
            return False
        
        print("\n12. 确认后查询余额（验证已确认账单被正确计算）")
        r = client.get(f"{BASE_URL}/tenants/{tenant_id}/balance")
        after_balance = r.json()["balance"]
        bill_amount = result1["total_amount"]
        expected_balance = 500 - bill_amount
        
        if abs(after_balance - expected_balance) < 0.01:
            print(f"   ✓ 余额扣减正确！")
            print(f"     - 确认前余额: {before_balance}")
            print(f"     - 账单金额: {bill_amount}")
            print(f"     - 确认后余额: {after_balance}")
            print(f"     - 期望余额: {expected_balance}")
        else:
            print(f"   ✗ 余额扣减错误")
            print(f"     - 确认后余额: {after_balance}, 期望: {expected_balance}")
            return False
        
        print("\n13. 第二次确认同一账单（应该幂等，不重复扣减）")
        r = client.post(f"{BASE_URL}/bills/{bill1_id}/confirm", json={
            "bill_id": bill1_id
        })
        if r.status_code == 200 and "已确认" in r.json().get("message", ""):
            print(f"   ✓ 重复确认幂等生效，不会重复扣减")
        else:
            print(f"   ✗ 重复确认处理异常")
            return False
        
        print("\n14. 再次查询余额（验证没有重复扣减）")
        r = client.get(f"{BASE_URL}/tenants/{tenant_id}/balance")
        final_balance = r.json()["balance"]
        if abs(final_balance - after_balance) < 0.01:
            print(f"   ✓ 余额没有变化，确认幂等生效")
            print(f"     - 最终余额: {final_balance}")
        else:
            print(f"   ✗ 余额被重复扣减！")
            return False
        
        print("\n【场景: 预充值不足验证】")
        print("-" * 50)
        
        print("\n15. 创建余额不足的租客")
        r = client.post(f"{BASE_URL}/tenants", json={
            "name": "测试租客-欠费",
            "phone": "18800000002",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=10)).isoformat()
        })
        poor_tenant_id = r.json()["id"]
        
        print("\n16. 只充值 50元")
        client.post(f"{BASE_URL}/precharges", json={
            "tenant_id": poor_tenant_id,
            "amount": 50.0,
            "payment_method": "test"
        })
        
        print("\n17. 为该租客生成大额账单（水费 20吨 * 5 = 100元）")
        period_start_poor = (datetime.now() - timedelta(days=10)).isoformat()
        period_end_poor = datetime.now().isoformat()
        
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 200.0,
            "reading_date": period_start_poor
        })
        rid1 = r.json()["id"]
        client.post(f"{BASE_URL}/meter-readings/{rid1}/confirm")
        
        r = client.post(f"{BASE_URL}/meter-readings", json={
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 220.0,
            "reading_date": period_end_poor
        })
        rid2 = r.json()["id"]
        client.post(f"{BASE_URL}/meter-readings/{rid2}/confirm")
        
        r = client.post(f"{BASE_URL}/bills/generate", params={
            "room_id": room_id,
            "tenant_id": poor_tenant_id,
            "period_start": period_start_poor,
            "period_end": period_end_poor
        })
        poor_bill_id = r.json()["bill_id"]
        poor_bill_amount = r.json()["total_amount"]
        print(f"   ✓ 账单金额: {poor_bill_amount}元")
        
        print("\n18. 尝试确认账单（应该失败 - 余额不足）")
        r = client.post(f"{BASE_URL}/bills/{poor_bill_id}/confirm", json={
            "bill_id": poor_bill_id
        })
        if r.status_code == 400 and "余额不足" in r.json()["detail"]:
            print(f"   ✓ 余额不足校验生效，账单确认被阻止")
            print(f"     - 返回信息: {r.json()['detail']}")
        else:
            print(f"   ✗ 余额不足校验未生效")
            print(f"     - 状态码: {r.status_code}, 返回: {r.text}")
            return False
        
        print("\n" + "=" * 70)
        print("  ✅ 所有第二轮修复验证通过！")
        print("=" * 70)
        print("\n修复总结:")
        print("  1. ✅ SQLAlchemy func.sum 导入修复 - 余额查询不再报错")
        print("  2. ✅ 账单幂等机制 - 相同账期不会重复出账")
        print("  3. ✅ 预充值扣减闭环 - 账单确认正确扣减且不重复")
        print("  4. ✅ 余额不足校验 - 欠费时阻止账单确认")
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
    
    test_v2_fixes()
