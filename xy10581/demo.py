#!/usr/bin/env python3
import requests
import json
import time
import os

BASE_URL = 'http://127.0.0.1:5000/api/v1'

def print_header(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print('='*70)

def print_response(name, resp):
    print(f"\n--- {name} ---")
    if resp.status_code in [200, 201]:
        data = resp.json()
        print(f"✅ 状态码: {resp.status_code}")
        if data.get('success'):
            print(f"✅ 成功: {data.get('message', '操作成功')}")
            if 'data' in data:
                print(json.dumps(data['data'], indent=2, ensure_ascii=False)[:2000])
        else:
            print(f"❌ 失败: {data.get('error', '未知错误')}")
    else:
        print(f"❌ HTTP状态码: {resp.status_code}")
        try:
            print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
        except:
            print(resp.text)

def wait_for_server():
    print("等待服务器启动...")
    for i in range(30):
        try:
            r = requests.get(f"{BASE_URL}/cards", timeout=1)
            if r.status_code == 200:
                print("✅ 服务器已就绪")
                return True
        except:
            pass
        time.sleep(1)
    print("❌ 服务器启动超时")
    return False

def demo1_normal_consume():
    print_header("场景1: 正常消费流程")
    print("演示: 开卡 → 充值 → 跨店消费 → 查询账本")
    
    print("\n1. 初始化演示数据 (3家门店 + 3张卡片)")
    r = requests.post(f"{BASE_URL}/init-demo")
    print_response("初始化演示数据", r)
    
    print("\n2. 给CARD001充值 1000元")
    r = requests.post(f"{BASE_URL}/cards/CARD001/recharge", json={
        "amount": 1000.0,
        "channel": "微信支付",
        "request_id": "RECHARGE_001"
    })
    print_response("充值1000元", r)
    
    print("\n3. 跨店消费 - 北京朝阳门店消费200元")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD001",
        "store_id": "STORE001",
        "amount": 200.0,
        "request_id": "CONSUME_001"
    })
    print_response("STORE001消费200元", r)
    txn1_id = None
    if r.status_code == 200:
        data = r.json()
        if data.get('success') and 'data' in data:
            txn1_id = data['data']['transaction']['id']
            print(f"  交易ID: {txn1_id}")
    
    print("\n4. 再次跨店消费 - 上海静安店消费300元")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD001",
        "store_id": "STORE002",
        "amount": 300.0,
        "request_id": "CONSUME_002"
    })
    print_response("STORE002消费300元", r)
    
    print("\n5. 查询CARD001完整账本")
    r = requests.get(f"{BASE_URL}/cards/CARD001")
    print_response("查询卡片账本", r)
    
    return txn1_id

def demo2_lost_card_block():
    print_header("场景2: 挂失后消费拦截")
    print("演示: 正常消费 → 挂失卡片 → 尝试消费被拦截 → 解挂 → 恢复消费")
    
    print("\n1. 给CARD002充值500元")
    r = requests.post(f"{BASE_URL}/cards/CARD002/recharge", json={
        "amount": 500.0,
        "channel": "支付宝",
        "request_id": "RECHARGE_002"
    })
    print_response("充值500元", r)
    
    print("\n2. 正常消费100元 (成功)")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD002",
        "store_id": "STORE001",
        "amount": 100.0,
        "request_id": "CONSUME_003"
    })
    print_response("挂失前消费", r)
    
    print("\n3. 挂失卡片 CARD002")
    r = requests.post(f"{BASE_URL}/cards/CARD002/report-lost")
    print_response("挂失卡片", r)
    
    print("\n4. 挂失后尝试消费 (应该被拦截)")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD002",
        "store_id": "STORE002",
        "amount": 100.0,
        "request_id": "CONSUME_004"
    })
    print_response("挂失后消费", r)
    
    print("\n5. 查询交易历史 (查看失败原因)")
    r = requests.get(f"{BASE_URL}/cards/CARD002/history")
    print_response("交易历史", r)
    
    print("\n6. 解挂卡片")
    r = requests.post(f"{BASE_URL}/cards/CARD002/resolve-lost")
    print_response("解挂卡片", r)
    
    print("\n7. 解挂后再次消费 (应该成功)")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD002",
        "store_id": "STORE003",
        "amount": 50.0,
        "request_id": "CONSUME_005"
    })
    print_response("解挂后消费", r)

def demo3_multi_store_risk():
    print_header("场景3: 短时间多店刷卡风险检测")
    print("演示: 充值 → 连续3家门店消费 → 第3次触发风控")
    
    print("\n1. 给CARD003充值2000元")
    r = requests.post(f"{BASE_URL}/cards/CARD003/recharge", json={
        "amount": 2000.0,
        "channel": "线下充值",
        "request_id": "RECHARGE_003"
    })
    print_response("充值2000元", r)
    
    print("\n2. 第1家门店消费 (北京朝阳店)")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD003",
        "store_id": "STORE001",
        "amount": 100.0,
        "request_id": "RISK_TEST_001"
    })
    print_response("STORE001消费", r)
    
    print("\n3. 第2家门店消费 (上海静安店)")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD003",
        "store_id": "STORE002",
        "amount": 200.0,
        "request_id": "RISK_TEST_002"
    })
    print_response("STORE002消费", r)
    
    print("\n4. 第3家门店消费 (广州天河店) - 应该触发多店风险检测")
    print("   (规则: 30分钟内在2家以上不同门店消费即触发)")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD003",
        "store_id": "STORE003",
        "amount": 300.0,
        "request_id": "RISK_TEST_003"
    })
    print_response("STORE003消费 (风险检测)", r)
    
    print("\n5. 查询风险事件")
    r = requests.post(f"{BASE_URL}/risk/scan", json={"card_id": "CARD003"})
    print_response("风险扫描结果", r)

def demo4_refund_rollback(txn1_id):
    print_header("场景4: 退款回原充值批次")
    print("演示: 消费 → 退款 → 查看余额和批次更新")
    
    if not txn1_id:
        print("⚠️  跳过此场景（需要场景1的交易ID）")
        return
    
    print(f"\n1. 查询原始交易 {txn1_id}")
    r = requests.get(f"{BASE_URL}/cards/CARD001")
    data = r.json()
    if data.get('success'):
        card = data['data']['card']
        print(f"  退款前余额: 可用={card['available_balance']}, 总额={card['total_balance']}")
    
    print("\n2. 发起退款 (退款给CARD001的第一笔消费)")
    r = requests.post(f"{BASE_URL}/transactions/{txn1_id}/refund", json={
        "amount": 200.0,
        "request_id": "REFUND_001"
    })
    print_response("退款请求", r)
    
    print("\n3. 查看退款后的卡片账本")
    r = requests.get(f"{BASE_URL}/cards/CARD001")
    print_response("退款后账本", r)

def demo5_idempotency():
    print_header("场景5: 重复请求幂等性")
    print("演示: 重复发送相同请求 → 只执行一次 → 返回已有结果")
    
    print("\n1. 首次消费请求 (request_id=IDEMPOTENT_001)")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD001",
        "store_id": "STORE001",
        "amount": 50.0,
        "request_id": "IDEMPOTENT_001"
    })
    print_response("首次请求", r)
    
    print("\n2. 重复相同请求 (应该返回已有结果，不重复扣款)")
    r = requests.post(f"{BASE_URL}/transactions/consume", json={
        "card_id": "CARD001",
        "store_id": "STORE001",
        "amount": 50.0,
        "request_id": "IDEMPOTENT_001"
    })
    print_response("重复请求", r)
    
    print("\n3. 回调幂等性测试")
    print("\n   首次回调 (callback_id=CB_TEST_001)")
    r = requests.post(f"{BASE_URL}/callback", json={
        "callback_id": "CB_TEST_001",
        "transaction_id": "TXN_DEMO_001",
        "status": "SUCCESS",
        "message": "支付渠道回调"
    })
    print_response("首次回调", r)
    
    print("\n   重复回调 (应该识别为重复)")
    r = requests.post(f"{BASE_URL}/callback", json={
        "callback_id": "CB_TEST_001",
        "transaction_id": "TXN_DEMO_001",
        "status": "SUCCESS"
    })
    print_response("重复回调", r)

def demo6_manual_correction():
    print_header("场景6: 人工修正 (留痕)")
    print("演示: 查询当前状态 → 人工修正 → 查看前后差异")
    
    print("\n1. 查询CARD002当前状态")
    r = requests.get(f"{BASE_URL}/cards/CARD002")
    print_response("修正前状态", r)
    
    print("\n2. 执行人工修正 (调整余额 + 100元)")
    r = requests.post(f"{BASE_URL}/manual-correction", json={
        "card_id": "CARD002",
        "operator": "admin_001",
        "correction_type": "BALANCE_ADJUST",
        "balance_adjustment": 100.0,
        "reason": "客户投诉退款漏记，经核实后补记"
    })
    print_response("人工修正", r)
    
    print("\n3. 查看修正记录 (包含前后差异)")
    r = requests.get(f"{BASE_URL}/cards/CARD002")
    data = r.json()
    if data.get('success'):
        corrections = data['data']['ledger']['corrections']
        for c in corrections:
            print(f"\n📝 修正记录 {c['id']}:")
            print(f"   操作者: {c['operator']}")
            print(f"   修正类型: {c['correction_type']}")
            print(f"   修正原因: {c['reason']}")
            print(f"\n   修正前:")
            print(json.dumps(json.loads(c['before_state']), indent=2, ensure_ascii=False))
            print(f"\n   修正后:")
            print(json.dumps(json.loads(c['after_state']), indent=2, ensure_ascii=False))

def demo7_reports():
    print_header("场景7: 报告导出")
    print("演示: 门店消费报告 + 系统总览报告")
    
    print("\n1. 门店消费报告")
    r = requests.get(f"{BASE_URL}/reports/stores")
    print_response("门店报告", r)
    
    print("\n2. 系统总览报告导出")
    r = requests.get(f"{BASE_URL}/reports/export")
    print_response("导出报告", r)

def main():
    print("\n" + "#"*70)
    print("#")
    print("#  预付卡消费风控系统 - 完整演示")
    print("#")
    print("#"*70)
    
    if not wait_for_server():
        print("\n请先启动服务器: python app.py")
        return
    
    print("\n" + "="*70)
    print("  演示清单:")
    print("  1. 正常消费流程 (开卡→充值→跨店消费→查询账本)")
    print("  2. 挂失后消费拦截 (挂失→拦截→解挂→恢复)")
    print("  3. 短时间多店刷卡风险检测 (30分钟多店消费风控)")
    print("  4. 退款回原充值批次 (退款→余额回滚)")
    print("  5. 重复请求幂等性 (重复请求/回调不重复执行)")
    print("  6. 人工修正 (操作留痕，前后差异记录)")
    print("  7. 报告导出 (门店消费报告+系统总览)")
    print("="*70)
    
    input("\n按回车键开始演示...")
    
    txn1_id = None
    try:
        txn1_id = demo1_normal_consume()
        input("\n按回车键继续...")
        
        demo2_lost_card_block()
        input("\n按回车键继续...")
        
        demo3_multi_store_risk()
        input("\n按回车键继续...")
        
        demo4_refund_rollback(txn1_id)
        input("\n按回车键继续...")
        
        demo5_idempotency()
        input("\n按回车键继续...")
        
        demo6_manual_correction()
        input("\n按回车键继续...")
        
        demo7_reports()
    except Exception as e:
        print(f"\n❌ 演示出错: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70)
    print("  演示完成！")
    print("  查看详细数据请访问API接口:")
    print("  - 卡片列表: GET /api/v1/cards")
    print("  - 卡片详情: GET /api/v1/cards/<card_id>")
    print("  - 风险扫描: POST /api/v1/risk/scan")
    print("  - 门店报告: GET /api/v1/reports/stores")
    print("="*70)

if __name__ == '__main__':
    main()
