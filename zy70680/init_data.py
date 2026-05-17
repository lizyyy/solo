#!/usr/bin/env python3
"""
造数脚本 - 初始化测试数据
"""

import sys
from datetime import datetime

try:
    import requests
except ImportError:
    print("请先安装 requests: pip install requests")
    sys.exit(1)

BASE_URL = "http://localhost:8000/api/v1"


def create_user(user_id, user_name, phone):
    """创建用户"""
    url = f"{BASE_URL}/users"
    data = {
        "user_id": user_id,
        "user_name": user_name,
        "phone": phone,
        "balance": 0.0
    }
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print(f"✅ 用户创建成功: {user_id} - {user_name}")
        elif response.status_code == 409:
            print(f"ℹ️  用户已存在: {user_id}")
        else:
            print(f"❌ 用户创建失败: {response.text}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")


def create_handler(handler_id, handler_name, department):
    """创建处理人"""
    url = f"{BASE_URL}/handlers"
    data = {
        "handler_id": handler_id,
        "handler_name": handler_name,
        "department": department,
        "role": "客服",
        "is_active": True
    }
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print(f"✅ 处理人创建成功: {handler_id} - {handler_name}")
        elif response.status_code == 409:
            print(f"ℹ️  处理人已存在: {handler_id}")
        else:
            print(f"❌ 处理人创建失败: {response.text}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")


def create_transaction(transaction_id, user_id, amount, pay_channel):
    """创建支付流水"""
    url = f"{BASE_URL}/transactions"
    data = {
        "transaction_id": transaction_id,
        "user_id": user_id,
        "amount": amount,
        "currency": "CNY",
        "pay_channel": pay_channel,
        "pay_time": datetime.now().isoformat(),
        "pay_status": "SUCCESS",
        "raw_data": f'{{"channel": "{pay_channel}"}}'
    }
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print(f"✅ 支付流水创建成功: {transaction_id} - ¥{amount}")
        elif response.status_code == 409:
            print(f"ℹ️  支付流水已存在: {transaction_id}")
        else:
            print(f"❌ 支付流水创建失败: {response.text}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")


def create_voucher(voucher_code, amount, valid_days):
    """创建补偿券"""
    url = f"{BASE_URL}/vouchers"
    data = {
        "voucher_code": voucher_code,
        "voucher_type": "DISCOUNT",
        "amount": amount,
        "min_spend": 0.0,
        "valid_days": valid_days,
        "is_active": True
    }
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print(f"✅ 补偿券创建成功: {voucher_code} - ¥{amount}")
        elif response.status_code == 409:
            print(f"ℹ️  补偿券已存在: {voucher_code}")
        else:
            print(f"❌ 补偿券创建失败: {response.text}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")


def main():
    print("=" * 50)
    print("开始初始化测试数据...")
    print("=" * 50)

    # 检查服务是否启动
    try:
        response = requests.get("http://localhost:8000/health")
        if response.status_code != 200:
            print("❌ 服务状态异常，请先启动服务: uvicorn app.main:app --reload")
            return
    except Exception:
        print("❌ 无法连接到服务，请先启动服务: uvicorn app.main:app --reload")
        return

    print("✅ 服务连接正常")
    print()

    # 创建用户
    print("--- 创建用户 ---")
    create_user("USER001", "张三", "13800138001")
    create_user("USER002", "李四", "13800138002")
    print()

    # 创建处理人
    print("--- 创建处理人 ---")
    create_handler("ADMIN001", "客服小王", "客服部")
    print()

    # 创建补偿券
    print("--- 创建补偿券 ---")
    create_voucher("VOUCHER001", 5.0, 30)
    print()

    # 创建支付流水
    print("--- 创建支付流水 ---")
    create_transaction("PAY20240101001", "USER001", 99.9, "WECHAT")
    create_transaction("PAY20240101002", "USER001", 199.0, "ALIPAY")
    create_transaction("PAY20240101003", "USER002", 49.5, "WECHAT")
    print()

    print("=" * 50)
    print("初始化完成!")
    print()
    print("接下来可以:")
    print("1. 访问 http://localhost:8000/docs 查看API文档")
    print("2. 运行 pytest tests/test_compensation.py -v 执行测试")
    print("3. 参考 README.md 中的 curl 示例进行接口调用")
    print("=" * 50)


if __name__ == "__main__":
    main()
