import httpx
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_response(title, response):
    print(f"\n--- {title} ---")
    if response.status_code in [200, 201]:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(f"Status: {response.status_code}")
        print(response.text)

def test_normal_billing():
    print_section("场景1: 正常账单流程")
    
    with httpx.Client() as client:
        print("\n1. 创建房间")
        room_data = {"room_number": "101", "floor": 1, "building": "A栋"}
        r = client.post(f"{BASE_URL}/rooms", json=room_data)
        print_response("创建房间", r)
        room_id = r.json()["id"]
        
        print("\n2. 创建租客")
        tenant_data = {
            "name": "张三",
            "phone": "13800138000",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=60)).isoformat()
        }
        r = client.post(f"{BASE_URL}/tenants", json=tenant_data)
        print_response("创建租客", r)
        tenant_id = r.json()["id"]
        
        print("\n3. 设置单价")
        price_data = {
            "meter_type": "water",
            "unit_price": 5.5,
            "effective_date": (datetime.now() - timedelta(days=90)).isoformat()
        }
        r = client.post(f"{BASE_URL}/prices", json=price_data)
        print_response("设置水价", r)
        
        price_data = {
            "meter_type": "electricity",
            "unit_price": 0.85,
            "effective_date": (datetime.now() - timedelta(days=90)).isoformat()
        }
        r = client.post(f"{BASE_URL}/prices", json=price_data)
        print_response("设置电价", r)
        
        print("\n4. 预充值")
        precharge_data = {
            "tenant_id": tenant_id,
            "amount": 500.0,
            "payment_method": "wechat"
        }
        r = client.post(f"{BASE_URL}/precharges", json=precharge_data)
        print_response("预充值", r)
        
        print("\n5. 月初抄表（上月初）")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 100.0,
            "reading_date": (datetime.now() - timedelta(days=30)).isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        print_response("月初水表读数", r)
        water_reading_id_1 = r.json()["id"]
        
        reading_data = {
            "room_id": room_id,
            "meter_type": "electricity",
            "reading_value": 1000.0,
            "reading_date": (datetime.now() - timedelta(days=30)).isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        print_response("月初电表读数", r)
        elec_reading_id_1 = r.json()["id"]
        
        print("\n6. 确认抄表")
        r = client.post(f"{BASE_URL}/meter-readings/{water_reading_id_1}/confirm")
        print_response("确认水表", r)
        r = client.post(f"{BASE_URL}/meter-readings/{elec_reading_id_1}/confirm")
        print_response("确认电表", r)
        
        print("\n7. 月末抄表")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 125.0,
            "reading_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        print_response("月末水表读数", r)
        water_reading_id_2 = r.json()["id"]
        
        reading_data = {
            "room_id": room_id,
            "meter_type": "electricity",
            "reading_value": 1150.0,
            "reading_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        print_response("月末电表读数", r)
        elec_reading_id_2 = r.json()["id"]
        
        print("\n8. 确认抄表")
        r = client.post(f"{BASE_URL}/meter-readings/{water_reading_id_2}/confirm")
        print_response("确认水表", r)
        r = client.post(f"{BASE_URL}/meter-readings/{elec_reading_id_2}/confirm")
        print_response("确认电表", r)
        
        print("\n9. 生成账单")
        bill_params = {
            "room_id": room_id,
            "tenant_id": tenant_id,
            "period_start": (datetime.now() - timedelta(days=30)).isoformat(),
            "period_end": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/bills/generate", params=bill_params)
        print_response("生成账单", r)
        bill_id = r.json()["bill_id"]
        
        print("\n10. 查看账单详情")
        r = client.get(f"{BASE_URL}/bills/{bill_id}")
        print_response("账单详情", r)
        
        print("\n11. 确认账单")
        r = client.post(f"{BASE_URL}/bills/{bill_id}/confirm", json={"bill_id": bill_id})
        print_response("确认账单", r)
        
        print("\n12. 查看余额")
        r = client.get(f"{BASE_URL}/tenants/{tenant_id}/balance")
        print_response("租客余额", r)
        
        return room_id, tenant_id

def test_abnormal_readings():
    print_section("场景2: 异常读数处理")
    
    with httpx.Client() as client:
        rooms = client.get(f"{BASE_URL}/rooms").json()
        if not rooms:
            print("请先运行场景1")
            return
        room_id = rooms[0]["id"]
        
        print("\n1. 尝试录入读数倒退（应该失败）")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 90.0,
            "reading_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        print_response("读数倒退测试", r)
        
        print("\n2. 重复提交相同抄表（应该幂等）")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 125.0,
            "reading_date": datetime.now().isoformat(),
            "idempotency_key": "test_key_001"
        }
        r1 = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        r2 = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        print_response("第一次提交", r1)
        print_response("第二次提交（幂等）", r2)
        print(f"\n两次返回ID相同: {r1.json()['id'] == r2.json()['id']}")
        
        print("\n3. 撤销未关联账单的抄表")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 130.0,
            "reading_date": (datetime.now() + timedelta(days=1)).isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        reading_id = r.json()["id"]
        print_response("创建新抄表", r)
        
        r = client.post(f"{BASE_URL}/meter-readings/{reading_id}/revoke")
        print_response("撤销抄表", r)

def test_tenant_transfer():
    print_section("场景3: 换租分摊流程")
    
    with httpx.Client() as client:
        rooms = client.get(f"{BASE_URL}/rooms").json()
        if not rooms:
            print("请先运行场景1")
            return
        room_id = rooms[0]["id"]
        
        print("\n1. 创建新租客")
        tenant_data = {
            "name": "李四",
            "phone": "13900139000",
            "room_id": room_id,
            "move_in_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/tenants", json=tenant_data)
        print_response("创建新租客", r)
        new_tenant_id = r.json()["id"]
        
        tenants = client.get(f"{BASE_URL}/tenants", params={"room_id": room_id}).json()
        old_tenant_id = None
        for t in tenants:
            if t["name"] == "张三":
                old_tenant_id = t["id"]
                break
        
        print(f"\n旧租客ID: {old_tenant_id}, 新租客ID: {new_tenant_id}")
        
        print("\n2. 新租客预充值")
        precharge_data = {
            "tenant_id": new_tenant_id,
            "amount": 300.0,
            "payment_method": "alipay"
        }
        r = client.post(f"{BASE_URL}/precharges", json=precharge_data)
        print_response("新租客预充值", r)
        
        print("\n3. 创建换租交接")
        transfer_date = datetime.now() - timedelta(days=15)
        transfer_data = {
            "room_id": room_id,
            "old_tenant_id": old_tenant_id,
            "new_tenant_id": new_tenant_id,
            "transfer_date": transfer_date.isoformat(),
            "water_reading": 115.0,
            "electricity_reading": 1080.0
        }
        r = client.post(f"{BASE_URL}/tenant-transfers", json=transfer_data)
        print_response("创建换租交接", r)
        transfer_id = r.json()["id"]
        
        print("\n4. 确认换租交接")
        r = client.post(f"{BASE_URL}/tenant-transfers/{transfer_id}/confirm")
        print_response("确认换租", r)
        
        print("\n5. 生成旧租客账单（按天数分摊）")
        bill_params = {
            "room_id": room_id,
            "tenant_id": old_tenant_id,
            "period_start": (datetime.now() - timedelta(days=30)).isoformat(),
            "period_end": datetime.now().isoformat(),
            "transfer_id": transfer_id
        }
        r = client.post(f"{BASE_URL}/bills/generate", params=bill_params)
        print_response("生成旧租客分摊账单", r)
        old_bill_id = r.json()["bill_id"]
        
        print("\n6. 查看旧租客账单详情")
        r = client.get(f"{BASE_URL}/bills/{old_bill_id}")
        print_response("旧租客账单详情", r)
        
        print("\n7. 确认旧租客账单")
        r = client.post(f"{BASE_URL}/bills/{old_bill_id}/confirm", json={"bill_id": old_bill_id})
        print_response("确认旧租客账单", r)
        
        print("\n8. 查询账单历史")
        r = client.get(f"{BASE_URL}/bills/{old_bill_id}/history")
        print_response("账单历史", r)
        
        print("\n9. 查看所有账单")
        r = client.get(f"{BASE_URL}/bills")
        print_response("所有账单列表", r)

def test_insufficient_balance():
    print_section("场景4: 预充值不足处理")
    
    with httpx.Client() as client:
        rooms = client.get(f"{BASE_URL}/rooms").json()
        if not rooms:
            print("请先运行场景1")
            return
        room_id = rooms[0]["id"]
        
        print("\n1. 创建余额不足的租客")
        tenant_data = {
            "name": "王五",
            "phone": "13700137000",
            "room_id": room_id,
            "move_in_date": (datetime.now() - timedelta(days=10)).isoformat()
        }
        r = client.post(f"{BASE_URL}/tenants", json=tenant_data)
        tenant_id = r.json()["id"]
        
        print("\n2. 少量预充值")
        precharge_data = {
            "tenant_id": tenant_id,
            "amount": 10.0
        }
        r = client.post(f"{BASE_URL}/precharges", json=precharge_data)
        
        print("\n3. 创建抄表")
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 10.0,
            "reading_date": (datetime.now() - timedelta(days=10)).isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        rid1 = r.json()["id"]
        client.post(f"{BASE_URL}/meter-readings/{rid1}/confirm")
        
        reading_data = {
            "room_id": room_id,
            "meter_type": "water",
            "reading_value": 30.0,
            "reading_date": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/meter-readings", json=reading_data)
        rid2 = r.json()["id"]
        client.post(f"{BASE_URL}/meter-readings/{rid2}/confirm")
        
        print("\n4. 生成大额账单")
        bill_params = {
            "room_id": room_id,
            "tenant_id": tenant_id,
            "period_start": (datetime.now() - timedelta(days=10)).isoformat(),
            "period_end": datetime.now().isoformat()
        }
        r = client.post(f"{BASE_URL}/bills/generate", params=bill_params)
        bill_id = r.json()["bill_id"]
        
        print("\n5. 尝试确认账单（应该失败，余额不足）")
        r = client.post(f"{BASE_URL}/bills/{bill_id}/confirm", json={"bill_id": bill_id})
        print_response("确认账单（余额不足）", r)

def test_revoke_bill():
    print_section("场景5: 账单撤销与重新生成")
    
    with httpx.Client() as client:
        bills = client.get(f"{BASE_URL}/bills").json()
        pending_bills = [b for b in bills if b["status"] == "pending"]
        if not pending_bills:
            print("没有待处理的账单")
            return
        bill_id = pending_bills[0]["id"]
        
        print(f"\n1. 撤销账单 ID: {bill_id}")
        r = client.post(f"{BASE_URL}/bills/{bill_id}/revoke")
        print_response("撤销账单", r)
        
        print("\n2. 查看撤销后的状态")
        r = client.get(f"{BASE_URL}/bills/{bill_id}")
        print_response("账单状态", r)

def main():
    print("公寓水电抄表 API 测试脚本")
    print("请先运行: python main.py 启动服务")
    input("\n按 Enter 开始测试...")
    
    try:
        test_normal_billing()
        test_abnormal_readings()
        test_tenant_transfer()
        test_insufficient_balance()
        test_revoke_bill()
        
        print_section("测试完成")
        print("\n✅ 所有场景测试完成")
        print("\n📊 API 文档: http://localhost:8000/docs")
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
