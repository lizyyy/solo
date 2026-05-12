#!/usr/bin/env python3
"""
社区积分兑换系统 - 演示数据脚本

运行方式: python demo_data.py
查看 API 文档: http://localhost:8000/docs
"""

import requests
from datetime import datetime

BASE_URL = "http://localhost:8000"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def demo():
    session = requests.Session()

    print_section("1. 创建家庭成员（演示积分分散问题）")

    residents = [
        {"name": "张三", "id_card": "110101199001010001", "phone": "13800138001"},
        {"name": "李四", "id_card": "110101199001010002", "phone": "13800138002"},
        {"name": "张小明", "id_card": "110101201501010003", "phone": "13800138003"},
        {"name": "张奶奶", "id_card": "110101195501010004", "phone": "13800138004"},
    ]

    resident_ids = []
    account_ids = []
    for r in residents:
        response = session.post(f"{BASE_URL}/residents/", json=r)
        data = response.json()
        print(f"创建居民: {data['data']['name']}, 账户ID: {data['data']['account_id']}")
        resident_ids.append(data['data']['resident_id'])
        account_ids.append(data['data']['account_id'])

    print_section("2. 创建家庭账户")

    family_response = session.post(f"{BASE_URL}/families/", json={
        "family_name": "张三一家",
        "address": "幸福小区1号楼1单元101室",
        "contact_phone": "13800138001"
    })
    family_data = family_response.json()
    family_id = family_data['data']['family_id']
    family_account_id = family_data['data']['account_id']
    print(f"创建家庭: {family_data['data']['family_name']}, 家庭ID: {family_id}")

    print_section("3. 将家庭成员添加到家庭")

    for resident_id in resident_ids:
        session.post(f"{BASE_URL}/families/add-resident?family_id={family_id}&resident_id={resident_id}")
    print("所有家庭成员已关联到家庭")

    print_section("4. 创建兑换物品（发米油场景）")

    items = [
        {"item_name": "大米 (10kg)", "points_required": 100, "category": "粮油", "stock_quantity": 50, "unit": "袋"},
        {"item_name": "食用油 (5L)", "points_required": 80, "category": "粮油", "stock_quantity": 50, "unit": "桶"},
        {"item_name": "洗衣液 (2kg)", "points_required": 50, "category": "日用品", "stock_quantity": 100, "unit": "瓶"},
        {"item_name": "纸巾 (10包)", "points_required": 30, "category": "日用品", "stock_quantity": 200, "unit": "提"},
    ]

    item_ids = []
    for item in items:
        response = session.post(f"{BASE_URL}/inventory/", json=item)
        data = response.json()
        print(f"创建物品: {data['data']['item_name']}, ID: {data['data']['item_id']}")
        item_ids.append(data['data']['item_id'])

    print_section("5. 为家庭成员添加服务记录并积分（演示积分分散）")

    service_types = ["社区巡逻", "环境清洁", "敬老服务", "疫情防控", "交通疏导"]
    points = [50, 30, 80, 100, 40]

    service_record_ids = []
    for i, (resident_id, account_id) in enumerate(zip(resident_ids, account_ids)):
        service_date = datetime.now().isoformat()
        record_response = session.post(f"{BASE_URL}/service-records/", json={
            "resident_id": resident_id,
            "service_type": service_types[i % len(service_types)],
            "service_date": service_date,
            "service_hours": 2.5,
            "points_earned": points[i % len(points)],
            "description": f"2024年{service_types[i % len(service_types)]}志愿服务"
        })
        record_data = record_response.json()
        service_record_id = record_data['data']['record_id']
        service_record_ids.append(service_record_id)

        earn_response = session.post(f"{BASE_URL}/points/earn", json={
            "account_id": account_id,
            "amount": points[i % len(points)],
            "service_record_id": service_record_id,
            "description": f"{service_types[i % len(service_types)]}服务积分"
        })
        earn_data = earn_response.json()
        print(f"居民ID {resident_id}: +{earn_data['data']['amount']}积分, 余额: {earn_data['data']['balance_after']}")

    print_section("6. 查看各成员当前积分余额（积分分散状态）")

    for account_id in account_ids:
        response = session.get(f"{BASE_URL}/accounts/{account_id}/balance")
        data = response.json()
        print(f"账户 {account_id}: {data['data']['resident_name']} - 余额: {data['data']['balance']} 积分")

    family_response = session.get(f"{BASE_URL}/accounts/{family_account_id}/balance")
    family_data = family_response.json()
    print(f"家庭账户 {family_account_id}: {family_data['data']['family_name']} - 余额: {family_data['data']['balance']} 积分")

    print_section("7. 合并家庭成员积分到家庭账户（发米油前统一积分）")

    merge_response = session.post(f"{BASE_URL}/families/merge-accounts", json={
        "target_family_id": family_id,
        "source_account_ids": account_ids,
        "operator_id": "admin"
    })
    merge_data = merge_response.json()
    print(f"合并成功! 总合并积分: {merge_data['data']['total_merged']}")
    for detail in merge_data['data']['details']:
        print(f"  - {detail['resident_name']}: 合并 {detail['amount']} 积分")

    print_section("8. 查看合并后的账户余额")

    for account_id in account_ids:
        response = session.get(f"{BASE_URL}/accounts/{account_id}/balance")
        data = response.json()
        print(f"账户 {account_id}: {data['data']['resident_name']} - 余额: {data['data']['balance']} 积分")

    family_response = session.get(f"{BASE_URL}/accounts/{family_account_id}/balance")
    family_data = family_response.json()
    print(f"家庭账户 {family_account_id}: {family_data['data']['family_name']} - 余额: {family_data['data']['balance']} 积分 ✅")

    print_section("9. 使用家庭积分兑换大米和食用油")

    rice_item_id = item_ids[0]
    oil_item_id = item_ids[1]

    exchange1 = session.post(f"{BASE_URL}/points/exchange", json={
        "account_id": family_account_id,
        "item_id": rice_item_id,
        "quantity": 2,
        "operator_id": "admin"
    })
    exchange1_data = exchange1.json()
    order_id = exchange1_data['data']['order_id']
    print(f"兑换2袋大米: 使用 {exchange1_data['data']['points_used']} 积分, 剩余: {exchange1_data['data']['balance_after']}")

    exchange2 = session.post(f"{BASE_URL}/points/exchange", json={
        "account_id": family_account_id,
        "item_id": oil_item_id,
        "quantity": 1,
        "operator_id": "admin"
    })
    exchange2_data = exchange2.json()
    print(f"兑换1桶食用油: 使用 {exchange2_data['data']['points_used']} 积分, 剩余: {exchange2_data['data']['balance_after']}")

    print_section("10. 查看兑换后的库存变化")

    inventory_response = session.get(f"{BASE_URL}/inventory/")
    inventory_data = inventory_response.json()
    for item in inventory_data['data']:
        print(f"{item['item_name']}: 库存 {item['stock_quantity']} {item['unit']}")

    print_section("11. 演示撤销兑换并回滚积分（发错物品场景）")

    revoke_response = session.post(f"{BASE_URL}/points/revoke-exchange", json={
        "order_id": order_id,
        "reason": "发放错误，需要重新发放",
        "operator_id": "admin"
    })
    revoke_data = revoke_response.json()
    print(f"撤销兑换成功! 返还 {revoke_data['data']['returned_points']} 积分, 余额: {revoke_data['data']['balance_after']}")

    print_section("12. 查看撤销后的库存变化")

    inventory_response = session.get(f"{BASE_URL}/inventory/")
    inventory_data = inventory_response.json()
    for item in inventory_data['data']:
        print(f"{item['item_name']}: 库存 {item['stock_quantity']} {item['unit']}")

    print_section("13. 查看家庭账户的完整余额变更历史")

    history_response = session.get(f"{BASE_URL}/accounts/{family_account_id}/balance-history")
    history_data = history_response.json()
    print("余额变更历史:")
    for record in history_data['data']:
        date_str = record['date']
        print(f"  {date_str} | {record['type']:12} | {record['amount']:+6d} | {record['balance_after']:4d} | {record['description']}")

    print_section("14. 查看待复核的交易记录（家庭合并需要人工复核）")

    pending_response = session.get(f"{BASE_URL}/transactions/pending-review")
    pending_data = pending_response.json()
    print(f"待复核交易数: {len(pending_data['data'])}")
    for tx in pending_data['data']:
        print(f"  - {tx['transaction_type']}: {tx['amount']} 积分, 账户: {tx['account_number']}")

    print_section("15. 复核家庭合并交易")

    for tx in pending_data['data']:
        review_response = session.post(f"{BASE_URL}/transactions/review", json={
            "transaction_id": tx['transaction_id'],
            "approved": True,
            "review_note": "家庭合并积分确认无误",
            "reviewer_id": "审核员001"
        })
        review_data = review_response.json()
        print(f"复核交易 {tx['transaction_id']}: {review_data['data']['status']}")

    print_section("16. 查看完整的交易流水")

    transactions_response = session.get(f"{BASE_URL}/transactions/")
    transactions_data = transactions_response.json()
    print(f"总交易数: {len(transactions_data['data'])}")
    for tx in transactions_data['data']:
        print(f"  {tx['transaction_type']:12} | {tx['amount']:+6d} | {tx['balance_after']:4d} | {tx['status']:10} | {tx['description']}")

    print("\n" + "="*60)
    print("  演示完成!")
    print(f"  API 文档: http://localhost:8000/docs")
    print(f"  导出待复核Excel: GET {BASE_URL}/export/pending-review")
    print("="*60 + "\n")


if __name__ == "__main__":
    try:
        demo()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先运行: python main.py")
