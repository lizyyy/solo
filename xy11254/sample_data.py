import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def create_sample_orders():
    orders = [
        {
            "order_no": "ORD202401010001",
            "group_leader": "李团长",
            "customer_name": "张三",
            "customer_phone": "13800138001",
            "product_name": "有机蔬菜礼盒",
            "product_sku": "VEG001",
            "order_quantity": 5,
            "order_amount": 250.0,
            "actual_quantity": 5,
            "actual_amount": 250.0,
            "compensation_type": None,
            "compensation_amount": None,
            "coupon_code": None,
            "coupon_expire_date": None,
            "operator": "admin"
        },
        {
            "order_no": "ORD202401010002",
            "group_leader": "李团长",
            "customer_name": "李四",
            "customer_phone": "13800138002",
            "product_name": "新鲜水果篮",
            "product_sku": "FRUIT001",
            "order_quantity": 3,
            "order_amount": 180.0,
            "actual_quantity": 2,
            "actual_amount": 120.0,
            "compensation_type": "refund",
            "compensation_amount": 60.0,
            "coupon_code": None,
            "coupon_expire_date": None,
            "operator": "admin"
        },
        {
            "order_no": "ORD202401010003",
            "group_leader": "王团长",
            "customer_name": "王五",
            "customer_phone": "13800138003",
            "product_name": "鲜肉套餐",
            "product_sku": "MEAT001",
            "order_quantity": 2,
            "order_amount": 200.0,
            "actual_quantity": 1,
            "actual_amount": 100.0,
            "compensation_type": "coupon",
            "compensation_amount": 100.0,
            "coupon_code": "COUPON2024001",
            "coupon_expire_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "operator": "admin"
        },
        {
            "order_no": "ORD202401010004",
            "group_leader": "王团长",
            "customer_name": "赵六",
            "customer_phone": "13800138004",
            "product_name": "海鲜大礼包",
            "product_sku": "SEA001",
            "order_quantity": 1,
            "order_amount": 500.0,
            "actual_quantity": 0,
            "actual_amount": 0,
            "compensation_type": "exchange",
            "compensation_amount": 500.0,
            "coupon_code": None,
            "coupon_expire_date": None,
            "operator": "admin"
        },
        {
            "order_no": "ORD202401010005",
            "group_leader": "李团长",
            "customer_name": "孙七",
            "customer_phone": "13800138005",
            "product_name": "有机蔬菜礼盒",
            "product_sku": "VEG001",
            "order_quantity": 4,
            "order_amount": 200.0,
            "actual_quantity": 2,
            "actual_amount": 100.0,
            "compensation_type": "coupon",
            "compensation_amount": 100.0,
            "coupon_code": "COUPON2024002",
            "coupon_expire_date": (datetime.now() + timedelta(days=3)).isoformat(),
            "operator": "admin"
        },
        {
            "order_no": "ORD202401010006",
            "group_leader": "张团长",
            "customer_name": "周八",
            "customer_phone": "13800138006",
            "product_name": "蛋奶套餐",
            "product_sku": "DAIRY001",
            "order_quantity": 6,
            "order_amount": 120.0,
            "actual_quantity": 4,
            "actual_amount": 80.0,
            "compensation_type": "refund",
            "compensation_amount": 200.0,
            "coupon_code": None,
            "coupon_expire_date": None,
            "operator": "admin"
        },
        {
            "order_no": "ORD202401010007",
            "group_leader": "张团长",
            "customer_name": "吴九",
            "customer_phone": "13800138007",
            "product_name": "新鲜水果篮",
            "product_sku": "FRUIT001",
            "order_quantity": 2,
            "order_amount": 120.0,
            "actual_quantity": 2,
            "actual_amount": 120.0,
            "compensation_type": "refund",
            "compensation_amount": 120.0,
            "coupon_code": None,
            "coupon_expire_date": None,
            "operator": "admin"
        },
        {
            "order_no": "ORD202401010008",
            "group_leader": "王团长",
            "customer_name": "郑十",
            "customer_phone": "13800138008",
            "product_name": "鲜肉套餐",
            "product_sku": "MEAT001",
            "order_quantity": 3,
            "order_amount": 300.0,
            "actual_quantity": 3,
            "actual_amount": 100.0,
            "compensation_type": None,
            "compensation_amount": None,
            "coupon_code": None,
            "coupon_expire_date": None,
            "operator": "admin"
        }
    ]
    return orders


def import_sample_data():
    print("=" * 60)
    print("开始导入样例数据...")
    print("=" * 60)

    orders = create_sample_orders()
    print(f"\n准备导入 {len(orders)} 条订单数据\n")

    try:
        response = requests.post(
            f"{BASE_URL}/api/orders/import",
            json=orders
        )
        result = response.json()

        print(f"导入批次: {result['batch_no']}")
        print(f"总数量: {result['total_count']}")
        print(f"成功数量: {result['success_count']}")
        print(f"失败数量: {result['failed_count']}")

        if result['errors']:
            print("\n错误详情:")
            for error in result['errors']:
                print(f"  - 第{error['row']}行 订单{error['order_no']}: {error['error']}")

    except Exception as e:
        print(f"导入失败: {e}")
        print("请先启动服务: python -m app.main")
        return False

    return True


def test_api_endpoints():
    print("\n" + "=" * 60)
    print("测试API接口...")
    print("=" * 60)

    try:
        print("\n1. 获取汇总统计:")
        response = requests.get(f"{BASE_URL}/api/summary")
        summary = response.json()
        print(f"   总订单数: {summary['total_count']}")
        print(f"   通过数: {summary['pass_count']}")
        print(f"   拦截数: {summary['reject_count']}")
        print(f"   通过率: {summary['pass_rate']:.1f}%")
        print(f"   总补偿金额: {summary['total_compensation_amount']:.2f}")
        print(f"   规则拦截分布: {summary['rule_breakdown']}")

        print("\n2. 获取订单列表（前5条）:")
        response = requests.get(f"{BASE_URL}/api/orders", params={"page_size": 5})
        orders = response.json()
        for item in orders['items'][:3]:
            status = "✅ 通过" if item['is_pass'] else "❌ 拦截"
            print(f"   {item['order_no']} - {item['group_leader']} - {status}")

        print("\n3. 获取团长列表:")
        response = requests.get(f"{BASE_URL}/api/group-leaders")
        leaders = response.json()
        print(f"   团长列表: {leaders}")

        print("\n4. 获取规则类型:")
        response = requests.get(f"{BASE_URL}/api/rule-types")
        rule_types = response.json()
        print(f"   规则类型: {rule_types}")

        print("\n5. 查看被拦截订单详情（第一条）:")
        response = requests.get(f"{BASE_URL}/api/orders", params={"is_pass": False, "page_size": 1})
        rejected = response.json()
        if rejected['items']:
            order = rejected['items'][0]
            print(f"   订单号: {order['order_no']}")
            print(f"   拦截原因: {order['review_reason']}")
            print(f"   审核日志:")
            for log in order['review_logs']:
                status = "✅" if log['is_pass'] else "❌"
                print(f"     {status} {log['rule_name']}: {log['reason']}")

        print("\n" + "=" * 60)
        print("样例数据说明:")
        print("=" * 60)
        print("\n✅ 正常通过的订单:")
        print("   - ORD202401010001: 无缺货，完整发货")
        print("   - ORD202401010002: 部分缺货，退款金额合理")
        print("   - ORD202401010003: 券补偿，优惠券有效期正常")
        print("   - ORD202401010004: 全部缺货，换货处理")

        print("\n❌ 被拦截的异常订单:")
        print("   - ORD202401010005: 优惠券即将过期（仅剩3天）")
        print("   - ORD202401010006: 补偿金额异常偏高（缺货金额40，补偿200）")
        print("   - ORD202401010007: 无缺货但申请退款补偿")
        print("   - ORD202401010008: 账单数据不一致（发货3件金额仅100）")

        print("\n📝 访问接口文档: http://localhost:8000/docs")
        print("=" * 60)

    except Exception as e:
        print(f"API测试失败: {e}")
        return False

    return True


if __name__ == "__main__":
    import_sample_data()
    test_api_endpoints()
