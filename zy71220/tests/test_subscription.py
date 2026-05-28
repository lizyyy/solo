"""
测试用例 - 覆盖冷静期未满、材料过期、同投资者重复认购三大场景
"""
import os
import json
import pandas as pd
from datetime import datetime, timedelta, date
from private_fund.models import (
    SubscriptionOrder, InvestorMaterial, CoolOffPeriod,
    VisitRecord, PaymentFlow, MaterialType, MaterialStatus
)
from private_fund.service import PrivateFundService


def create_test_data():
    """创建测试数据 - 包含正常数据和各种异常场景"""
    today = date.today()
    now = datetime.now()

    test_orders = []

    order1 = SubscriptionOrder(
        order_no="TEST001",
        investor_id="INV001",
        investor_name="张三",
        product_code="PROD001",
        product_name="私募产品A",
        subscription_amount=1000000,
        submit_time=now - timedelta(days=3),
        operator="test_op",
    )
    order1.materials = [
        InvestorMaterial(investor_id="INV001", material_type=MaterialType.ID_CARD,
                         file_path="/data/id/INV001_id.jpg", expire_date=today + timedelta(days=365)),
        InvestorMaterial(investor_id="INV001", material_type=MaterialType.INVESTOR_QUALIFICATION,
                         file_path="/data/qual/INV001_qual.pdf", expire_date=today + timedelta(days=180)),
        InvestorMaterial(investor_id="INV001", material_type=MaterialType.RISK_ASSESSMENT,
                         file_path="/data/risk/INV001_risk.pdf", expire_date=today + timedelta(days=90)),
    ]
    order1.cool_off = CoolOffPeriod(subscription_id=order1.subscription_id)
    order1.cool_off.start(now - timedelta(hours=48))
    order1.visit = VisitRecord(subscription_id=order1.subscription_id, investor_id="INV001")
    order1.visit.record("/data/visit/TEST001.mp3", "test_op", now - timedelta(hours=47))
    order1.visit.confirm(True)
    order1.payment = PaymentFlow(subscription_id=order1.subscription_id, amount=1000000,
                                 pay_time=now - timedelta(hours=50), pay_account="6222****1234")
    test_orders.append(order1)

    order2 = SubscriptionOrder(
        order_no="TEST002",
        investor_id="INV002",
        investor_name="李四 - 冷静期未满",
        product_code="PROD001",
        product_name="私募产品A",
        subscription_amount=500000,
        submit_time=now - timedelta(hours=12),
        operator="test_op",
    )
    order2.materials = [
        InvestorMaterial(investor_id="INV002", material_type=MaterialType.ID_CARD,
                         file_path="/data/id/INV002_id.jpg", expire_date=today + timedelta(days=365)),
        InvestorMaterial(investor_id="INV002", material_type=MaterialType.INVESTOR_QUALIFICATION,
                         file_path="/data/qual/INV002_qual.pdf", expire_date=today + timedelta(days=180)),
        InvestorMaterial(investor_id="INV002", material_type=MaterialType.RISK_ASSESSMENT,
                         file_path="/data/risk/INV002_risk.pdf", expire_date=today + timedelta(days=90)),
    ]
    order2.cool_off = CoolOffPeriod(subscription_id=order2.subscription_id)
    order2.cool_off.start(now - timedelta(hours=12))
    order2.visit = VisitRecord(subscription_id=order2.subscription_id, investor_id="INV002")
    order2.visit.record("/data/visit/TEST002.mp3", "test_op", now - timedelta(hours=11))
    order2.visit.confirm(True)
    test_orders.append(order2)

    order3 = SubscriptionOrder(
        order_no="TEST003",
        investor_id="INV003",
        investor_name="王五 - 材料过期",
        product_code="PROD001",
        product_name="私募产品A",
        subscription_amount=800000,
        submit_time=now - timedelta(days=2),
        operator="test_op",
    )
    order3.materials = [
        InvestorMaterial(investor_id="INV003", material_type=MaterialType.ID_CARD,
                         file_path="/data/id/INV003_id.jpg", expire_date=today + timedelta(days=365)),
        InvestorMaterial(investor_id="INV003", material_type=MaterialType.INVESTOR_QUALIFICATION,
                         file_path="/data/qual/INV003_qual.pdf", expire_date=today - timedelta(days=30)),
        InvestorMaterial(investor_id="INV003", material_type=MaterialType.RISK_ASSESSMENT,
                         file_path="/data/risk/INV003_risk.pdf", expire_date=today + timedelta(days=90)),
    ]
    order3.cool_off = CoolOffPeriod(subscription_id=order3.subscription_id)
    order3.cool_off.start(now - timedelta(hours=48))
    order3.visit = VisitRecord(subscription_id=order3.subscription_id, investor_id="INV003")
    order3.visit.record("/data/visit/TEST003.mp3", "test_op", now - timedelta(hours=47))
    order3.visit.confirm(True)
    test_orders.append(order3)

    order4 = SubscriptionOrder(
        order_no="TEST004",
        investor_id="INV001",
        investor_name="张三 - 重复认购",
        product_code="PROD001",
        product_name="私募产品A",
        subscription_amount=2000000,
        submit_time=now - timedelta(days=1),
        operator="test_op",
    )
    order4.materials = [
        InvestorMaterial(investor_id="INV001", material_type=MaterialType.ID_CARD,
                         file_path="/data/id/INV001_id.jpg", expire_date=today + timedelta(days=365)),
        InvestorMaterial(investor_id="INV001", material_type=MaterialType.INVESTOR_QUALIFICATION,
                         file_path="/data/qual/INV001_qual.pdf", expire_date=today + timedelta(days=180)),
        InvestorMaterial(investor_id="INV001", material_type=MaterialType.RISK_ASSESSMENT,
                         file_path="/data/risk/INV001_risk.pdf", expire_date=today + timedelta(days=90)),
    ]
    order4.cool_off = CoolOffPeriod(subscription_id=order4.subscription_id)
    order4.cool_off.start(now - timedelta(hours=36))
    order4.visit = VisitRecord(subscription_id=order4.subscription_id, investor_id="INV001")
    order4.visit.record("/data/visit/TEST004.mp3", "test_op", now - timedelta(hours=35))
    order4.visit.confirm(True)
    test_orders.append(order4)

    order5 = SubscriptionOrder(
        order_no="TEST005",
        investor_id="INV004",
        investor_name="赵六 - 冷静期未开始",
        product_code="PROD001",
        product_name="私募产品A",
        subscription_amount=300000,
        submit_time=now - timedelta(days=1),
        operator="test_op",
    )
    order5.materials = [
        InvestorMaterial(investor_id="INV004", material_type=MaterialType.ID_CARD,
                         file_path="/data/id/INV004_id.jpg", expire_date=today + timedelta(days=365)),
        InvestorMaterial(investor_id="INV004", material_type=MaterialType.INVESTOR_QUALIFICATION,
                         file_path="/data/qual/INV004_qual.pdf", expire_date=today + timedelta(days=180)),
    ]
    order5.visit = VisitRecord(subscription_id=order5.subscription_id, investor_id="INV004")
    order5.visit.record("/data/visit/TEST005.mp3", "test_op", now - timedelta(hours=20))
    order5.visit.confirm(True)
    test_orders.append(order5)

    order6 = SubscriptionOrder(
        order_no="TEST006",
        investor_id="INV005",
        investor_name="钱七 - 缺少必备材料+回访未确认",
        product_code="PROD002",
        product_name="私募产品B",
        subscription_amount=1500000,
        submit_time=now - timedelta(days=5),
        operator="test_op",
    )
    order6.materials = [
        InvestorMaterial(investor_id="INV005", material_type=MaterialType.ID_CARD,
                         file_path="/data/id/INV005_id.jpg", expire_date=today + timedelta(days=365)),
    ]
    order6.cool_off = CoolOffPeriod(subscription_id=order6.subscription_id)
    order6.cool_off.start(now - timedelta(hours=72))
    order6.visit = VisitRecord(subscription_id=order6.subscription_id, investor_id="INV005")
    test_orders.append(order6)

    return test_orders


def create_test_excel(file_path: str = "./test_data.xlsx"):
    """创建测试Excel文件"""
    today = date.today()
    now = datetime.now()

    data = [
        {
            "order_no": "TEST001",
            "investor_id": "INV001",
            "investor_name": "张三",
            "product_code": "PROD001",
            "product_name": "私募产品A",
            "subscription_amount": 1000000,
            "submit_time": now - timedelta(days=3),
            "cool_off_start": now - timedelta(hours=48),
            "mat_id_card_file": "/data/id/INV001_id.jpg",
            "mat_id_card_expire": today + timedelta(days=365),
            "mat_investor_qualification_file": "/data/qual/INV001_qual.pdf",
            "mat_investor_qualification_expire": today + timedelta(days=180),
            "mat_risk_assessment_file": "/data/risk/INV001_risk.pdf",
            "mat_risk_assessment_expire": today + timedelta(days=90),
            "visit_record_file": "/data/visit/TEST001.mp3",
            "visit_operator": "test_op",
            "visit_confirmed": "是",
            "payment_amount": 1000000,
            "payment_account": "6222****1234",
            "operator": "test_op",
        },
        {
            "order_no": "TEST002",
            "investor_id": "INV002",
            "investor_name": "李四 - 冷静期未满",
            "product_code": "PROD001",
            "product_name": "私募产品A",
            "subscription_amount": 500000,
            "submit_time": now - timedelta(hours=12),
            "cool_off_start": now - timedelta(hours=12),
            "mat_id_card_file": "/data/id/INV002_id.jpg",
            "mat_id_card_expire": today + timedelta(days=365),
            "mat_investor_qualification_file": "/data/qual/INV002_qual.pdf",
            "mat_investor_qualification_expire": today + timedelta(days=180),
            "mat_risk_assessment_file": "/data/risk/INV002_risk.pdf",
            "mat_risk_assessment_expire": today + timedelta(days=90),
            "visit_record_file": "/data/visit/TEST002.mp3",
            "visit_operator": "test_op",
            "visit_confirmed": "是",
            "operator": "test_op",
        },
        {
            "order_no": "TEST003",
            "investor_id": "INV003",
            "investor_name": "王五 - 材料过期",
            "product_code": "PROD001",
            "product_name": "私募产品A",
            "subscription_amount": 800000,
            "submit_time": now - timedelta(days=2),
            "cool_off_start": now - timedelta(hours=48),
            "mat_id_card_file": "/data/id/INV003_id.jpg",
            "mat_id_card_expire": today + timedelta(days=365),
            "mat_investor_qualification_file": "/data/qual/INV003_qual.pdf",
            "mat_investor_qualification_expire": today - timedelta(days=30),
            "mat_risk_assessment_file": "/data/risk/INV003_risk.pdf",
            "mat_risk_assessment_expire": today + timedelta(days=90),
            "visit_record_file": "/data/visit/TEST003.mp3",
            "visit_operator": "test_op",
            "visit_confirmed": "是",
            "operator": "test_op",
        },
        {
            "order_no": "TEST004",
            "investor_id": "INV001",
            "investor_name": "张三 - 重复认购",
            "product_code": "PROD001",
            "product_name": "私募产品A",
            "subscription_amount": 2000000,
            "submit_time": now - timedelta(days=1),
            "cool_off_start": now - timedelta(hours=36),
            "mat_id_card_file": "/data/id/INV001_id.jpg",
            "mat_id_card_expire": today + timedelta(days=365),
            "mat_investor_qualification_file": "/data/qual/INV001_qual.pdf",
            "mat_investor_qualification_expire": today + timedelta(days=180),
            "mat_risk_assessment_file": "/data/risk/INV001_risk.pdf",
            "mat_risk_assessment_expire": today + timedelta(days=90),
            "visit_record_file": "/data/visit/TEST004.mp3",
            "visit_operator": "test_op",
            "visit_confirmed": "是",
            "operator": "test_op",
        },
        {
            "order_no": "TEST005",
            "investor_id": "INV004",
            "investor_name": "赵六 - 冷静期未开始",
            "product_code": "PROD001",
            "product_name": "私募产品A",
            "subscription_amount": 300000,
            "submit_time": now - timedelta(days=1),
            "cool_off_start": None,
            "mat_id_card_file": "/data/id/INV004_id.jpg",
            "mat_id_card_expire": today + timedelta(days=365),
            "mat_investor_qualification_file": "/data/qual/INV004_qual.pdf",
            "mat_investor_qualification_expire": today + timedelta(days=180),
            "visit_record_file": "/data/visit/TEST005.mp3",
            "visit_operator": "test_op",
            "visit_confirmed": "是",
            "operator": "test_op",
        },
        {
            "order_no": "TEST006",
            "investor_id": "INV005",
            "investor_name": "钱七 - 缺少必备材料+回访未确认",
            "product_code": "PROD002",
            "product_name": "私募产品B",
            "subscription_amount": 1500000,
            "submit_time": now - timedelta(days=5),
            "cool_off_start": now - timedelta(hours=72),
            "mat_id_card_file": "/data/id/INV005_id.jpg",
            "mat_id_card_expire": today + timedelta(days=365),
            "visit_record_file": None,
            "operator": "test_op",
        },
    ]

    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False)
    print(f"测试数据已生成: {file_path}")
    return file_path


def run_all_tests():
    """运行所有测试用例"""
    print("=" * 70)
    print("私募销售认购系统 - 压力测试")
    print("=" * 70)

    service = PrivateFundService(output_dir="./test_output", report_dir="./test_reports")
    test_orders = create_test_data()

    print(f"\n【测试1】锁住逻辑验证 - 冷静期、材料、回访必须一起锁住")
    for order in test_orders:
        success, messages = service.lock_subscription(order, "test_operator")
        status = "✓ 通过" if success else "✗ 失败"
        print(f"  {order.order_no} ({order.investor_name}): {status}")
        if not success:
            for msg in messages:
                print(f"    - {msg}")

    print(f"\n【测试2】压力测试 - 冷静期未满、材料过期、重复认购")
    pressure_result = service.run_pressure_tests(test_orders)
    print(json.dumps(pressure_result, ensure_ascii=False, indent=2))

    print(f"\n【测试3】线索串联 - 按投资者查询所有关联线索")
    investor_clues = service.find_by_investor(test_orders, "INV001")
    print(f"投资者 INV001 (张三) 线索:")
    print(f"  订单数: {investor_clues['order_count']}")
    print(f"  订单号: {', '.join(investor_clues['orders'])}")
    print(f"  材料数: {investor_clues['material_count']}")
    print(f"  冷静期数: {investor_clues['cool_off_count']}")

    print(f"\n【测试4】报告导出 - 取舍逻辑验证")
    export_result = service.batch_export_reports(test_orders, "test_operator")
    print(f"  成功导出: {len(export_result['exported'])} 份")
    for item in export_result['exported']:
        print(f"    ✓ {item['order_no']} -> {item['report_file']}")
    print(f"  跳过: {len(export_result['skipped'])} 份")
    for item in export_result['skipped']:
        print(f"    ✗ {item['order_no']}: {'; '.join(item['reasons'])}")

    print(f"\n【测试5】批量文件处理")
    test_file = create_test_excel("./test_subscriptions.xlsx")
    batch_result = service.process_subscription_file(test_file, "test_operator")

    if "error" in batch_result:
        print(f"错误: {batch_result['error']}")
    else:
        print(f"\n批量处理结果:")
        print(f"  总计: {batch_result['total_count']} 条")
        print(f"  正常通过: {len(batch_result['clean'])} 条")
        print(f"  脏数据: {len(batch_result['dirty'])} 条")
        print(f"  重复认购: {len(batch_result['duplicates'])} 组")

    print("\n" + "=" * 70)
    print("测试完成！请查看输出目录:")
    print("  - 测试数据: ./test_subscriptions.xlsx")
    print("  - 处理结果: ./test_output/")
    print("  - 报告文件: ./test_reports/")
    print("=" * 70)

    return True


if __name__ == "__main__":
    run_all_tests()
