#!/usr/bin/env python3
import requests
import json
import time
import random
from datetime import datetime

API_BASE = 'http://localhost:8080/api'

def send_callback(platform, order_id, event_type, payload):
    event_id = f"EVT-{int(time.time() * 1000)}"
    data = {
        'platform': platform,
        'platform_order_id': order_id,
        'event_type': event_type,
        'event_id': event_id,
        'payload': payload
    }
    response = requests.post(f"{API_BASE}/callbacks", json=data)
    return response.json()

def test_success_callback():
    print("\n=== 测试1: 成功回调 ===")
    order_id = f"TB{int(time.time())}"
    payload = {
        'tid': order_id,
        'payment': '199.00',
        'buyer_nick': '成功测试用户',
        'status': 'WAIT_SELLER_SEND_GOODS',
        'created': datetime.now().isoformat()
    }
    result = send_callback('taobao', order_id, 'trade_success', payload)
    print(f"结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
    return result

def test_duplicate_callback():
    print("\n=== 测试2: 重复提交检测 ===")
    order_id = f"TB{int(time.time())}DUP"
    event_id = f"EVT-DUP-{int(time.time())}"
    
    payload = {
        'tid': order_id,
        'payment': '299.00',
        'buyer_nick': '重复测试用户'
    }
    
    data = {
        'platform': 'taobao',
        'platform_order_id': order_id,
        'event_type': 'trade_notify',
        'event_id': event_id,
        'payload': payload
    }
    
    print("第一次提交:")
    r1 = requests.post(f"{API_BASE}/callbacks", json=data).json()
    print(f"  {json.dumps(r1, ensure_ascii=False)}")
    
    time.sleep(0.5)
    
    print("第二次提交（相同event_id）:")
    r2 = requests.post(f"{API_BASE}/callbacks", json=data).json()
    print(f"  {json.dumps(r2, ensure_ascii=False)}")
    
    if r2.get('is_duplicate'):
        print("✓ 重复检测成功！")
    else:
        print("✗ 重复检测失败")

def test_exception_order():
    print("\n=== 测试3: 异常订单 ===")
    order_id = f"JD{int(time.time())}EXC"
    payload = {
        'orderId': order_id,
        'orderPrice': '99.00',
        'buyerName': '异常订单用户',
        'orderState': 'PAID'
    }
    
    result = send_callback('jd', order_id, 'trade_create', payload)
    print(f"回调结果: {json.dumps(result, ensure_ascii=False)}")
    
    if result.get('unified_order_id'):
        exc_data = {
            'unified_order_id': result['unified_order_id'],
            'exception_type': 'payment_mismatch',
            'severity': 'critical',
            'message': '支付金额与订单金额不匹配：期望 99.00，实际 89.00',
            'callback_id': result.get('callback_id')
        }
        r = requests.post(f"{API_BASE}/exceptions", json=exc_data).json()
        print(f"异常记录结果: {json.dumps(r, ensure_ascii=False)}")
        print("✓ 异常订单创建成功！")

def test_multi_platform():
    print("\n=== 测试4: 多平台订单（淘宝、京东、拼多多）===")
    platforms = ['taobao', 'jd', 'pdd']
    status_maps = {
        'taobao': ['WAIT_BUYER_PAY', 'WAIT_SELLER_SEND_GOODS', 'WAIT_BUYER_CONFIRM_GOODS', 'TRADE_FINISHED'],
        'jd': ['WAIT_PAYMENT', 'PAID', 'DELIVERING', 'COMPLETED'],
        'pdd': [0, 1, 2, 3]
    }
    
    names = ['张三', '李四', '王五', '赵六', '钱七', '孙八']
    
    count = 0
    for i in range(15):
        platform = random.choice(platforms)
        order_id = f"{platform.upper()}{int(time.time())}{i}"
        
        if platform == 'taobao':
            payload = {
                'tid': order_id,
                'payment': f"{random.uniform(50, 500):.2f}",
                'buyer_nick': random.choice(names),
                'status': random.choice(status_maps['taobao']),
                'created': datetime.now().isoformat()
            }
        elif platform == 'jd':
            payload = {
                'orderId': order_id,
                'orderPrice': f"{random.uniform(50, 500):.2f}",
                'buyerName': f"京东{random.choice(names)}",
                'orderState': random.choice(status_maps['jd']),
                'orderStartTime': datetime.now().isoformat()
            }
        else:
            payload = {
                'orderSn': order_id,
                'orderAmount': f"{random.uniform(50, 500):.2f}",
                'buyerNick': f"拼{random.choice(names)}",
                'orderStatus': random.choice(status_maps['pdd']),
                'createdAt': datetime.now().isoformat()
            }
        
        send_callback(platform, order_id, 'trade_notify', payload)
        count += 1
        print(f"  已创建 {platform} 订单: {order_id}")
        time.sleep(0.2)
    
    print(f"✓ 共创建 {count} 条测试订单")

def test_manual_correction():
    print("\n=== 测试5: 人工修正（状态推进）===")
    order_id = f"TB{int(time.time())}FIX"
    payload = {
        'tid': order_id,
        'payment': '399.00',
        'buyer_nick': '待修正用户',
        'status': 'WAIT_BUYER_PAY'
    }
    result = send_callback('taobao', order_id, 'trade_create', payload)
    
    if result.get('unified_order_id'):
        unified_id = result['unified_order_id']
        print(f"初始状态: pending_payment")
        
        update_data = {
            'status': 'paid',
            'operator': '客服小王'
        }
        r = requests.put(f"{API_BASE}/orders/{unified_id}/status", json=update_data).json()
        print(f"人工修正后状态: {r.get('status')}")
        print("✓ 状态推进测试完成！")

def get_stats():
    print("\n=== 统计数据 ===")
    r = requests.get(f"{API_BASE}/dashboard/stats").json()
    print(f"总订单数: {r.get('total_orders', 0)}")
    print(f"异常订单: {r.get('exception_orders', 0)}")
    print(f"待处理异常: {r.get('open_exceptions', 0)}")
    print(f"平台分布: {r.get('platform_stats', {})}")

def main():
    print("=" * 50)
    print("订单回调合并站 - 测试数据生成脚本")
    print("=" * 50)
    
    try:
        response = requests.get(f"{API_BASE}/health", timeout=3)
        if response.status_code != 200:
            print("错误: API服务未正常响应")
            print("请先启动后端服务: cd backend && python run.py")
            return
    except Exception as e:
        print(f"错误: 无法连接到API服务 ({e})")
        print("请先启动后端服务: cd backend && python run.py")
        return
    
    print("✓ API服务连接成功\n")
    
    test_success_callback()
    test_duplicate_callback()
    test_exception_order()
    test_multi_platform()
    test_manual_correction()
    get_stats()
    
    print("\n" + "=" * 50)
    print("测试数据生成完成！")
    print("请打开 frontend/index.html 查看控制台")
    print("=" * 50)

if __name__ == '__main__':
    main()