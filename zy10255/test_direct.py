import httpx
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"

def run_test():
    print("=" * 60)
    print("  公寓水电抄表 API 测试")
    print("=" * 60)
    
    with httpx.Client() as client:
        print("\n【场景1: 正常账单流程】")
        
        print("\n1. 创建房间")
        room_data = {"room_number": "101", "floor": 1, "building": "A栋"}
        r = client.post(f"{BASE_URL}/rooms", json=room_data)
        print(f"   状态: {r.status_code}")
        if r.status_code != 200:
            print(f"   错误: {r.text}")
            return
        room_id = r.json()["id"]
        print(f"   房间ID: {room_id}")
        
        print("\n2. 创建租客")
        tenant_data = {
            "name": "张三",
            "phone": "13800138000",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=60)).isoformat()
        }
        r = client.post(f"{BASE_URL}/tenants", json=tenant_data)
        tenant_id = r.json()["id"]
        print(f"   租客ID: {tenant_id}")
        
        print("\n3. 设置单价")
        price_data = {
            "meter_type": "water",
            "unit_price": 5.5,
            "effective_date": (datetime.now() - timedelta(days=90)).isoformat()
        }
        r = client.post(f"{BASE_URL}/prices", json=price_data)
        print(f"   水价设置: {r.status_code}")
        
        price_data = {
            "meter_type": "electricity",
            "unit_price": 0.85,
            "effective_date": (datetime.now() - timedelta(days=90)).isoformat()
        }
        r = client.post(f"{BASE_URL}/prices", json=price_data)
        print(f"   电价设置: {r.status_code}")
        
        print("\n4. 预充值 500元")
        precharge_data = {
            "tenant_id": tenant_id,
            "amount": 500.0,
            "payment_method": "wechat"
        }
        r = client.post(f"{BASE_URL}/precharges", json=precharge_data)
        print(f"   充值状态: {r.status_code}")
        
        print("\n5. 月初抄表 (水表: 100, 电表: 1000)")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 100.0,
            "reading_date": (datetime.now() - timedelta(days=30)).isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        water_reading_id_1 = r.json()["id"]
        
        reading_data = {
            "room_id": room_id,
            "meter_type": "electricity",
            "reading_value": 1000.0,
            "reading_date": (datetime.now() - timedelta(days=30)).isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        elec_reading_id_1 = r.json()["id"]
        
        print("\n6. 确认抄表")
        r = client.post(f"{BASE_URL}/meter-readings/{water_reading_id_1}/confirm")
        print(f"   水表确认: {r.json()}")
        r = client.post(f"{BASE_URL}/meter-readings/{elec_reading_id_1}/confirm")
        print(f"   电表确认: {r.json()}")
        
        print("\n7. 月末抄表 (水表: 125, 电表: 1150)")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 125.0,
            "reading_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        water_reading_id_2 = r.json()["id"]
        
        reading_data = {
            "room_id": room_id,
            "meter_type": "electricity",
            "reading_value": 1150.0,
            "reading_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        elec_reading_id_2 = r.json()["id"]
        
        print("\n8. 确认抄表")
        r = client.post(f"{BASE_URL}/meter-readings/{water_reading_id_2}/confirm")
        print(f"   水表确认: {r.json()}")
        r = client.post(f"{BASE_URL}/meter-readings/{elec_reading_id_2}/confirm")
        print(f"   电表确认: {r.json()}")
        
        print("\n9. 生成账单")
        bill_params = {
            "room_id": room_id,
            "tenant_id": tenant_id,
            "period_start": (datetime.now() - timedelta(days=30)).isoformat(),
            "period_end": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/bills/generate", params=bill_params)
        print(f"   生成结果: {r.json()}")
        bill_id = r.json()["bill_id"]
        
        print("\n10. 账单详情")
        r = client.get(f"{BASE_URL}/bills/{bill_id}")
        detail = r.json()
        print(f"   账单号: {detail['bill']['bill_no']}")
        print(f"   总金额: {detail['bill']['total_amount']}")
        for item in detail['items']:
            print(f"   - {item['meter_type']}: 用量{item['usage']}, 金额{item['amount']}")
        
        print("\n11. 查看余额")
        r = client.get(f"{BASE_URL}/tenants/{tenant_id}/balance")
        balance = r.json()
        print(f"   预充值总额: {balance['total_precharge']}")
        print(f"   已出账单总额: {balance['total_bill']}")
        print(f"   当前余额: {balance['balance']}")
        
        print("\n12. 确认账单")
        r = client.post(f"{BASE_URL}/bills/{bill_id}/confirm", json={"bill_id": bill_id})
        print(f"   确认结果: {r.json()}")
        
        print("\n13. 确认后余额")
        r = client.get(f"{BASE_URL}/tenants/{tenant_id}/balance")
        balance = r.json()
        print(f"   当前余额: {balance['balance']}")
        
        print("\n【场景2: 异常读数测试】")
        
        print("\n1. 尝试录入读数倒退 (应该失败)")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 90.0,
            "reading_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        print(f"   状态: {r.status_code}, 信息: {r.json()['detail']}")
        
        print("\n2. 重复提交相同抄表 (应该幂等)")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 130.0,
            "reading_date": (datetime.now() + timedelta(days=1)).isoformat(),
            "idempotency_key": "test_key_001"
        }
        r1 = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        r2 = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        print(f"   第一次ID: {r1.json()['id']}")
        print(f"   第二次ID: {r2.json()['id']}")
        print(f"   幂等验证: {'通过' if r1.json()['id'] == r2.json()['id'] else '失败'}")
        
        print("\n【场景3: 换租分摊】")
        
        print("\n1. 创建新租客")
        tenant_data = {
            "name": "李四",
            "phone": "13900139000",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=15)).isoformat()
        }
        r = client.post(f"{BASE_URL}/tenants", json=tenant_data)
        new_tenant_id = r.json()["id"]
        print(f"   新租客ID: {new_tenant_id}")
        
        print("\n2. 新租客预充值 300元")
        precharge_data = {
            "tenant_id": new_tenant_id,
            "amount": 300.0,
            "payment_method": "alipay"
        }
        r = client.post(f"{BASE_URL}/precharges", json=precharge_data)
        
        print("\n3. 创建换租交接 (15天前交接)")
        transfer_data = {
            "room_id": room_id,
            "old_tenant_id": tenant_id,
            "new_tenant_id": new_tenant_id,
            "transfer_date": (datetime.now() - timedelta(days=15)).isoformat(),
            "water_reading": 115.0,
            "electricity_reading": 1075.0
        }
        r = client.post(f"{BASE_URL}/tenant-transfers", json=transfer_data)
        transfer_id = r.json()["id"]
        print(f"   换租ID: {transfer_id}")
        
        print("\n4. 确认换租交接")
        r = client.post(f"{BASE_URL}/tenant-transfers/{transfer_id}/confirm")
        print(f"   确认结果: {r.json()}")
        
        print("\n5. 生成旧租客账单 (按天数分摊, 比例50%)")
        bill_params = {
            "room_id": room_id,
            "tenant_id": tenant_id,
            "period_start": (datetime.now() - timedelta(days=30)).isoformat(),
            "period_end": datetime.now().isoformat(),
            "transfer_id": transfer_id
        }
        r = client.post(f"{BASE_URL}/bills/generate", params=bill_params)
        print(f"   生成结果: {r.json()}")
        old_bill_id = r.json()["bill_id"]
        
        print("\n6. 旧租客账单详情")
        r = client.get(f"{BASE_URL}/bills/{old_bill_id}")
        detail = r.json()
        print(f"   总金额: {detail['bill']['total_amount']}")
        for item in detail['items']:
            print(f"   - {item['meter_type']}: 分摊比例{item['transfer_split_ratio']*100:.0f}%, 金额{item['amount']}")
        
        print("\n7. 确认旧租客账单")
        r = client.post(f"{BASE_URL}/bills/{old_bill_id}/confirm", json={"bill_id": old_bill_id})
        print(f"   确认结果: {r.json()}")
        
        print("\n8. 账单历史")
        r = client.get(f"{BASE_URL}/bills/{old_bill_id}/history")
        print(f"   历史记录数: {len(r.json())}")
        
        print("\n【场景4: 预充值不足】")
        
        print("\n1. 创建新租客王五")
        tenant_data = {
            "name": "王五",
            "phone": "13700137000",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=10)).isoformat()
        }
        r = client.post(f"{BASE_URL}/tenants", json=tenant_data)
        tenant5_id = r.json()["id"]
        
        print("\n2. 少量预充值 50元")
        precharge_data = {"tenant_id": tenant5_id, "amount": 50.0}
        r = client.post(f"{BASE_URL}/precharges", json=precharge_data)
        
        print("\n3. 创建抄表记录")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 200.0,
            "reading_date": (datetime.now() - timedelta(days=10)).isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        rid1 = r.json()["id"]
        client.post(f"{BASE_URL}/meter-readings/{rid1}/confirm")
        
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 230.0,
            "reading_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        rid2 = r.json()["id"]
        client.post(f"{BASE_URL}/meter-readings/{rid2}/confirm")
        
        print("\n4. 生成大额账单 (水费 30吨 * 5.5 = 165元)")
        bill_params = {
            "room_id": room_id,
            "tenant_id": tenant5_id,
            "period_start": (datetime.now() - timedelta(days=10)).isoformat(),
            "period_end": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/bills/generate", params=bill_params)
        bill5_id = r.json()["bill_id"]
        print(f"   账单金额: {r.json()['total_amount']}")
        
        print("\n5. 尝试确认账单 (应该失败, 余额不足)")
        r = client.post(f"{BASE_URL}/bills/{bill5_id}/confirm", json={"bill_id": bill5_id})
        print(f"   状态: {r.status_code}, 信息: {r.json()['detail']}")
        
        print("\n" + "=" * 60)
        print("  ✅ 所有测试完成!")
        print("=" * 60)

if __name__ == "__main__":
    run_test()
