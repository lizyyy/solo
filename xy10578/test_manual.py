import sys
sys.path.insert(0, '.')

from lead_attribution.database import DatabaseManager
from lead_attribution.data_importer import DataImporter
from lead_attribution.attribution_engine import AttributionEngine
from lead_attribution.models import (
    Customer, SourceType, CustomerType, RecordStatus,
    AdClick, EventAttendance, Referral, Deal
)
from datetime import datetime

db = DatabaseManager()
db.init_database()
importer = DataImporter(db)
engine = AttributionEngine(db)

print("=== 创建客户 ===")

customer1 = Customer(
    id="customer_zhangwei",
    name="张伟",
    customer_type=CustomerType.B2B,
    email="zhangwei@techcorp.com",
    phone="13800138001",
    company_name="科技创新有限公司",
    status=RecordStatus.ACTIVE
)
db.save_customer(customer1)
print(f"创建客户: {customer1.name}")

customer2 = Customer(
    id="customer_liming",
    name="李明",
    customer_type=CustomerType.B2B,
    email="liming@cloudtech.cn",
    phone="13900139002",
    company_name="云途科技",
    status=RecordStatus.ACTIVE
)
db.save_customer(customer2)
print(f"创建客户: {customer2.name}")

customer3 = Customer(
    id="customer_wanghong",
    name="王红",
    customer_type=CustomerType.INDIVIDUAL,
    email="wanghong@example.com",
    phone="13700137003",
    status=RecordStatus.ACTIVE
)
db.save_customer(customer3)
print(f"创建客户: {customer3.name}")

print("\n=== 创建触点 ===")

ad1 = AdClick(
    id="ad_001",
    customer_id=customer1.id,
    campaign_id="camp_001",
    campaign_name="Q1 SaaS 推广",
    channel="百度搜索",
    click_time=datetime(2024, 1, 15, 10, 30, 0),
    cost=58.50,
    status=RecordStatus.ACTIVE
)
db.save_ad_click(ad1)
print(f"广告点击: {customer1.name} - {ad1.campaign_name}")

event1 = EventAttendance(
    id="event_001",
    customer_id=customer1.id,
    event_id="evt_001",
    event_name="SaaS 产品发布会",
    event_type="conference",
    checkin_time=datetime(2024, 2, 10, 9, 30, 0),
    booth="A12",
    salesperson="销售小王",
    status=RecordStatus.ACTIVE
)
db.save_event_attendance(event1)
print(f"活动签到: {customer1.name} - {event1.event_name}")

referral1 = Referral(
    id="ref_001",
    customer_id=customer1.id,
    referrer_id="ref_001",
    referrer_name="孙总",
    referral_time=datetime(2024, 2, 25, 16, 0, 0),
    referral_channel="微信推荐",
    status=RecordStatus.ACTIVE
)
db.save_referral(referral1)
print(f"转介绍: {customer1.name} - 来自 {referral1.referrer_name}")

ad2 = AdClick(
    id="ad_002",
    customer_id=customer2.id,
    campaign_id="camp_002",
    campaign_name="企业解决方案",
    channel="微信广告",
    click_time=datetime(2024, 2, 20, 14, 20, 0),
    cost=120.00,
    status=RecordStatus.ACTIVE
)
db.save_ad_click(ad2)
print(f"广告点击: {customer2.name} - {ad2.campaign_name}")

ad3 = AdClick(
    id="ad_003",
    customer_id=customer3.id,
    campaign_id="camp_003",
    campaign_name="个人版促销",
    channel="抖音",
    click_time=datetime(2024, 3, 5, 9, 15, 0),
    cost=35.00,
    status=RecordStatus.ACTIVE
)
db.save_ad_click(ad3)
print(f"广告点击: {customer3.name} - {ad3.campaign_name}")

referral3 = Referral(
    id="ref_003",
    customer_id=customer3.id,
    referrer_id=None,
    referrer_name="朋友推荐",
    referral_time=datetime(2024, 3, 18, 15, 45, 0),
    referral_channel="社交分享",
    status=RecordStatus.ACTIVE
)
db.save_referral(referral3)
print(f"转介绍: {customer3.name} - 来自 {referral3.referrer_name}")

print("\n=== 创建订单 ===")

deal1 = Deal(
    id="deal_001",
    customer_id=customer1.id,
    deal_name="企业版年度订阅",
    amount=120000.00,
    close_time=datetime(2024, 3, 5, 15, 30, 0),
    salesperson="销售小王",
    pipeline_stage="closed_won",
    status="won"
)
db.save_deal(deal1)
print(f"订单: {deal1.deal_name} - ¥{deal1.amount:,.0f}")

deal2 = Deal(
    id="deal_002",
    customer_id=customer2.id,
    deal_name="旗舰版三年订阅",
    amount=280000.00,
    close_time=datetime(2024, 3, 12, 10, 0, 0),
    salesperson="销售小李",
    pipeline_stage="closed_won",
    status="won"
)
db.save_deal(deal2)
print(f"订单: {deal2.deal_name} - ¥{deal2.amount:,.0f}")

deal3 = Deal(
    id="deal_003",
    customer_id=customer3.id,
    deal_name="个人版年卡",
    amount=2999.00,
    close_time=datetime(2024, 3, 20, 9, 30, 0),
    salesperson="销售小陈",
    pipeline_stage="closed_won",
    status="won"
)
db.save_deal(deal3)
print(f"订单: {deal3.deal_name} - ¥{deal3.amount:,.0f}")

print("\n=== 运行归因计算 ===")
result = engine.run_attribution_for_all_deals()
print(f"处理了 {result['total_deals_processed']} 个订单")

for d in result['deals']:
    print(f"  - {d['deal_name']} ({d['customer']}): ¥{d['amount']:,.0f}")

print("\n=== 查看归因结果 ===")

for deal in [deal1, deal2, deal3]:
    attributions = db.get_attributions_by_deal(deal.id)
    customer = db.get_customer_by_id(deal.customer_id)
    
    print(f"\n【{deal.deal_name}】- {customer.name} (¥{deal.amount:,.0f})")
    print(f"  成交时间: {deal.close_time}")
    
    touch_points = db.get_customer_touch_points(customer.id, deal.close_time)
    print(f"  有效触点数: {len(touch_points)}")
    for tp in touch_points:
        print(f"    - {tp['touch_time'].strftime('%Y-%m-%d')}: {tp['source_type'].value} ({tp['record_type']})")
    
    attr_by_type = {}
    for attr in attributions:
        t = attr.attribution_type.value
        if t not in attr_by_type:
            attr_by_type[t] = []
        attr_by_type[t].append(attr)
    
    for t, attrs in attr_by_type.items():
        type_name = {
            'first_touch': '首触达',
            'last_touch': '末触达',
            'weighted': '加权'
        }.get(t, t)
        print(f"\n  【{type_name}】")
        for attr in attrs:
            print(f"    - {attr.source_type.value}: {attr.percentage:.1f}% = ¥{attr.amount:,.0f}")

print("\n=== 归因汇总 ===")
summary = engine.get_attribution_summary()
print(f"总客户数: {summary['overview']['total_customers']}")
print(f"总订单数: {summary['overview']['total_deals']}")
print(f"总收入: ¥{summary['overview']['total_revenue']:,.0f}")

print("\n首触达归因:")
for src, amt in summary['first_touch'].items():
    print(f"  {src}: ¥{amt:,.0f}")

print("\n末触达归因:")
for src, amt in summary['last_touch'].items():
    print(f"  {src}: ¥{amt:,.0f}")

print("\n加权归因:")
for src, amt in summary['weighted'].items():
    print(f"  {src}: ¥{amt:,.0f}")

print("\n=== 测试完成！===")
