import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api"


def print_response(method, url, response):
    print(f"\n{method} {url}")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(response.text)


def seed_data():
    print("=" * 60)
    print("开始创建测试数据...")
    print("=" * 60)

    print("\n1. 创建客户")
    customers = [
        {"name": "张三农场", "phone": "13800138001", "contact": "张三", "address": "北京市朝阳区"},
        {"name": "李四合作社", "phone": "13800138002", "contact": "李四", "address": "北京市海淀区"},
        {"name": "王五养殖场", "phone": "13800138003", "contact": "王五", "address": "北京市丰台区"},
    ]
    customer_ids = []
    for c in customers:
        r = requests.post(f"{BASE_URL}/customers/", json=c)
        print_response("POST", "/customers/", r)
        if r.status_code == 200:
            customer_ids.append(r.json()['data']['customer']['id'])

    print("\n2. 创建品类")
    categories = [
        {"name": "玉米", "code": "CORN001", "description": "黄玉米"},
        {"name": "小麦", "code": "WHEAT001", "description": "冬小麦"},
        {"name": "大豆", "code": "SOY001", "description": "黄豆"},
    ]
    category_ids = []
    for cat in categories:
        r = requests.post(f"{BASE_URL}/categories/", json=cat)
        print_response("POST", "/categories/", r)
        if r.status_code == 200:
            category_ids.append(r.json()['data']['category']['id'])

    print("\n3. 创建价格（带版本控制）")
    prices = []
    for i, cat_id in enumerate(category_ids):
        price_data = {
            "category_id": cat_id,
            "price": 2.5 + i * 0.5,
            "effective_date": datetime.now().isoformat(),
            "created_by": "管理员"
        }
        r = requests.post(f"{BASE_URL}/prices/", json=price_data)
        print_response("POST", "/prices/", r)
        if r.status_code == 200:
            prices.append(r.json()['data']['price'])

    print("\n4. 创建扣杂比例（带版本控制）")
    deductions = []
    for i, cat_id in enumerate(category_ids):
        ded_data = {
            "category_id": cat_id,
            "name": f"{['玉米', '小麦', '大豆'][i]}标准扣杂",
            "ratio": 0.02 + i * 0.005,
            "effective_date": datetime.now().isoformat(),
            "created_by": "管理员"
        }
        r = requests.post(f"{BASE_URL}/deductions/", json=ded_data)
        print_response("POST", "/deductions/", r)
        if r.status_code == 200:
            deductions.append(r.json()['data']['deduction'])

    print("\n5. 创建称重记录")
    weighings = []
    for i in range(6):
        weigh_data = {
            "record_no": f"W{datetime.now().strftime('%Y%m%d')}{i+1:03d}",
            "customer_id": customer_ids[i % 3],
            "category_id": category_ids[i % 3],
            "gross_weight": 1000 + i * 200,
            "tare_weight": 300 + i * 50,
            "weigher": ["小李", "小王", "小张"][i % 3],
            "created_by": "管理员"
        }
        r = requests.post(f"{BASE_URL}/weighings/", json=weigh_data)
        print_response("POST", "/weighings/", r)
        if r.status_code == 200:
            weighings.append(r.json()['data']['weighing'])

    print("\n6. 为前4条称重记录设置价格")
    for i in range(4):
        w = weighings[i]
        price_data = {
            "price_id": prices[i % 3]['id'],
            "operator": "计价员"
        }
        r = requests.post(f"{BASE_URL}/weighings/{w['id']}/set-price", json=price_data)
        print_response("POST", f"/weighings/{w['id']}/set-price", r)

    print("\n7. 为前3条称重记录设置扣杂")
    for i in range(3):
        w = weighings[i]
        ded_data = {
            "deduction_id": deductions[i % 3]['id'],
            "operator": "扣杂员"
        }
        r = requests.post(f"{BASE_URL}/weighings/{w['id']}/set-deduction", json=ded_data)
        print_response("POST", f"/weighings/{w['id']}/set-deduction", r)

    print("\n8. 对第2条称重记录进行人工修正")
    if len(weighings) >= 2:
        w = weighings[1]
        correct_data = {
            "gross_weight": 1250,
            "tare_weight": 360,
            "operator": "主管",
            "reason": "称重设备校准，修正重量"
        }
        r = requests.post(f"{BASE_URL}/weighings/{w['id']}/manual-correction", json=correct_data)
        print_response("POST", f"/weighings/{w['id']}/manual-correction", r)

    print("\n9. 结算前3条称重记录（客户1的玉米和小麦）")
    settlement_weighings = [w for w in weighings[:3] if w['status'] == 'deducted']
    if settlement_weighings:
        settlement_data = {
            "settlement_no": f"S{datetime.now().strftime('%Y%m%d')}001",
            "customer_id": customer_ids[0],
            "weighing_ids": [w['id'] for w in settlement_weighings],
            "settled_by": "结算员"
        }
        r = requests.post(f"{BASE_URL}/settlements/", json=settlement_data)
        print_response("POST", "/settlements/", r)

    print("\n10. 测试重复结算拦截（尝试再次结算同一条记录）")
    if settlement_weighings:
        settlement_data = {
            "settlement_no": f"S{datetime.now().strftime('%Y%m%d')}002",
            "customer_id": customer_ids[0],
            "weighing_ids": [settlement_weighings[0]['id']],
            "settled_by": "结算员"
        }
        r = requests.post(f"{BASE_URL}/settlements/", json=settlement_data)
        print_response("POST", "/settlements/", r)

    print("\n11. 撤回第4条称重记录")
    if len(weighings) >= 4:
        w = weighings[3]
        close_data = {
            "operator": "主管",
            "reason": "客户取消交易"
        }
        r = requests.post(f"{BASE_URL}/weighings/{w['id']}/cancel", json=close_data)
        print_response("POST", f"/weighings/{w['id']}/cancel", r)

    print("\n" + "=" * 60)
    print("测试数据创建完成！")
    print("=" * 60)


if __name__ == "__main__":
    seed_data()
