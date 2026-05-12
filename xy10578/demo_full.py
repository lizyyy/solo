#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from lead_attribution.database import DatabaseManager
from lead_attribution.data_importer import DataImporter
from lead_attribution.attribution_engine import AttributionEngine
from lead_attribution.models import (
    Customer, SourceType, CustomerType, RecordStatus,
    AdClick, EventAttendance, Referral, Deal,
    SalesFollowUp, AttributionType
)
from datetime import datetime

def main():
    print("=" * 50)
    print("  销售线索归因 CLI 完整演示")
    print("=" * 50)
    print()

    db = DatabaseManager()
    db.init_database()
    importer = DataImporter(db)
    engine = AttributionEngine(db)

    print("[1/8] 初始化数据库... 完成")
    print(f"    数据库路径: {db.db_path}")
    print()

    print("[2/8] 创建B2B客户（张伟 - 科技创新有限公司）")
    customer_zw = Customer(
        id="customer_zhangwei",
        name="张伟",
        customer_type=CustomerType.B2B,
        email="zhangwei@techcorp.com",
        phone="13800138001",
        company_name="科技创新有限公司",
        status=RecordStatus.ACTIVE
    )
    db.save_customer(customer_zw)
    print(f"    创建: {customer_zw.name} ({customer_zw.company_name})")
    print()

    print("[3/8] 创建个人客户（王红）")
    customer_wh = Customer(
        id="customer_wanghong",
        name="王红",
        customer_type=CustomerType.INDIVIDUAL,
        email="wanghong@example.com",
        phone="13700137003",
        status=RecordStatus.ACTIVE
    )
    db.save_customer(customer_wh)
    print(f"    创建: {customer_wh.name}")
    print()

    print("[4/8] 记录张伟的多来源触点...")
    
    ad_zw = AdClick(
        id="ad_zw_001",
        customer_id=customer_zw.id,
        campaign_id="camp_q1_saas",
        campaign_name="Q1 SaaS 推广",
        channel="百度搜索",
        click_time=datetime(2024, 1, 15, 10, 30, 0),
        cost=58.50,
        status=RecordStatus.ACTIVE
    )
    db.save_ad_click(ad_zw)
    print(f"    [2024-01-15] 广告点击: {ad_zw.campaign_name}")

    event_zw = EventAttendance(
        id="event_zw_001",
        customer_id=customer_zw.id,
        event_id="evt_saas_launch",
        event_name="2024 SaaS 产品发布会",
        event_type="conference",
        checkin_time=datetime(2024, 2, 10, 9, 30, 0),
        booth="A12",
        salesperson="销售小王",
        status=RecordStatus.ACTIVE
    )
    db.save_event_attendance(event_zw)
    print(f"    [2024-02-10] 活动签到: {event_zw.event_name}")

    ref_zw = Referral(
        id="ref_zw_001",
        customer_id=customer_zw.id,
        referrer_id="ref_sunzong",
        referrer_name="孙总",
        referral_time=datetime(2024, 2, 25, 16, 0, 0),
        referral_channel="微信推荐",
        status=RecordStatus.ACTIVE
    )
    db.save_referral(ref_zw)
    print(f"    [2024-02-25] 转介绍: 来自 {ref_zw.referrer_name}")
    print()

    print("[5/8] 记录王红的触点...")
    
    ad_wh = AdClick(
        id="ad_wh_001",
        customer_id=customer_wh.id,
        campaign_id="camp_personal",
        campaign_name="个人版促销",
        channel="抖音",
        click_time=datetime(2024, 3, 5, 9, 15, 0),
        cost=35.00,
        status=RecordStatus.ACTIVE
    )
    db.save_ad_click(ad_wh)
    print(f"    [2024-03-05] 广告点击: {ad_wh.campaign_name}")

    ref_wh = Referral(
        id="ref_wh_001",
        customer_id=customer_wh.id,
        referrer_id=None,
        referrer_name="朋友推荐",
        referral_time=datetime(2024, 3, 18, 15, 45, 0),
        referral_channel="社交分享",
        status=RecordStatus.ACTIVE
    )
    db.save_referral(ref_wh)
    print(f"    [2024-03-18] 转介绍: 来自 {ref_wh.referrer_name}")
    print()

    print("[6/8] 创建成交订单...")
    
    deal_zw = Deal(
        id="deal_zw_001",
        customer_id=customer_zw.id,
        deal_name="企业版年度订阅",
        amount=120000.00,
        close_time=datetime(2024, 3, 5, 15, 30, 0),
        salesperson="销售小王",
        pipeline_stage="closed_won",
        status="won"
    )
    db.save_deal(deal_zw)
    print(f"    [2024-03-05] 张伟成交: ¥{deal_zw.amount:,.0f}")

    deal_wh = Deal(
        id="deal_wh_001",
        customer_id=customer_wh.id,
        deal_name="个人版年卡",
        amount=2999.00,
        close_time=datetime(2024, 3, 20, 9, 30, 0),
        salesperson="销售小陈",
        pipeline_stage="closed_won",
        status="won"
    )
    db.save_deal(deal_wh)
    print(f"    [2024-03-20] 王红成交: ¥{deal_wh.amount:,.0f}")
    print()

    print("[7/8] 运行归因计算...")
    result = engine.run_attribution_for_all_deals()
    print(f"    处理了 {result['total_deals_processed']} 个订单")
    for d in result['deals']:
        print(f"      - {d['deal_name']}: ¥{d['amount']:,.0f}")
    print()

    print("[8/8] 展示归因结果...")
    print()
    print("-" * 50)
    print("  订单1: 张伟 - 企业版年度订阅 (¥120,000)")
    print("-" * 50)
    
    touch_points_zw = db.get_customer_touch_points(customer_zw.id, deal_zw.close_time)
    print(f"  有效触点数: {len(touch_points_zw)}")
    for i, tp in enumerate(touch_points_zw, 1):
        print(f"    {i}. {tp['touch_time'].strftime('%Y-%m-%d')}: {tp['source_type'].value} ({tp['record_type']})")
    print()

    attrs_zw = [a for a in db.get_attributions_by_deal(deal_zw.id)]
    
    print("  【首触达归因】- 第一个触点获得100%")
    for a in [x for x in attrs_zw if x.attribution_type.value == 'first_touch']:
        print(f"    {a.source_type.value}: {a.percentage:.1f}% = ¥{a.amount:,.0f}")
    print()

    print("  【末触达归因】- 最后一个触点获得100%")
    for a in [x for x in attrs_zw if x.attribution_type.value == 'last_touch']:
        print(f"    {a.source_type.value}: {a.percentage:.1f}% = ¥{a.amount:,.0f}")
    print()

    print("  【加权归因】- 首触22.5% + 中间45% + 末触32.5%")
    for a in [x for x in attrs_zw if x.attribution_type.value == 'weighted']:
        print(f"    {a.source_type.value}: {a.percentage:.1f}% = ¥{a.amount:,.0f}")
    print()

    print("-" * 50)
    print("  订单2: 王红 - 个人版年卡 (¥2,999)")
    print("-" * 50)
    
    touch_points_wh = db.get_customer_touch_points(customer_wh.id, deal_wh.close_time)
    print(f"  有效触点数: {len(touch_points_wh)}")
    for i, tp in enumerate(touch_points_wh, 1):
        print(f"    {i}. {tp['touch_time'].strftime('%Y-%m-%d')}: {tp['source_type'].value} ({tp['record_type']})")
    print()

    attrs_wh = [a for a in db.get_attributions_by_deal(deal_wh.id)]
    
    print("  【首触达归因】")
    for a in [x for x in attrs_wh if x.attribution_type.value == 'first_touch']:
        print(f"    {a.source_type.value}: {a.percentage:.1f}% = ¥{a.amount:,.0f}")
    print()

    print("  【末触达归因】")
    for a in [x for x in attrs_wh if x.attribution_type.value == 'last_touch']:
        print(f"    {a.source_type.value}: {a.percentage:.1f}% = ¥{a.amount:,.0f}")
    print()

    print("  【加权归因】- 首触40% + 末触60% (2个触点)")
    for a in [x for x in attrs_wh if x.attribution_type.value == 'weighted']:
        print(f"    {a.source_type.value}: {a.percentage:.1f}% = ¥{a.amount:,.0f}")
    print()

    print("-" * 50)
    print("  归因汇总")
    print("-" * 50)
    summary = engine.get_attribution_summary()
    print(f"  总客户数: {summary['overview']['total_customers']}")
    print(f"  总订单数: {summary['overview']['total_deals']}")
    print(f"  总收入: ¥{summary['overview']['total_revenue']:,.0f}")
    print(f"  总归因记录: {summary['overview']['total_attributions']}")
    print()

    print("  首触达归因分布:")
    for src, amt in summary['first_touch'].items():
        pct = (amt / summary['overview']['total_revenue'] * 100) if summary['overview']['total_revenue'] > 0 else 0
        print(f"    {src}: ¥{amt:,.0f} ({pct:.1f}%)")
    print()

    print("  末触达归因分布:")
    for src, amt in summary['last_touch'].items():
        pct = (amt / summary['overview']['total_revenue'] * 100) if summary['overview']['total_revenue'] > 0 else 0
        print(f"    {src}: ¥{amt:,.0f} ({pct:.1f}%)")
    print()

    print("  加权归因分布:")
    for src, amt in summary['weighted'].items():
        pct = (amt / summary['overview']['total_revenue'] * 100) if summary['overview']['total_revenue'] > 0 else 0
        print(f"    {src}: ¥{amt:,.0f} ({pct:.1f}%)")
    print()

    print("=" * 50)
    print("  人工调整演示")
    print("=" * 50)
    print()
    
    print("场景: 销售经理认为张伟的订单应该更多归功于转介绍")
    print()
    
    old_attrs = [a for a in db.get_attributions_by_deal(deal_zw.id) 
                 if a.attribution_type.value == 'last_touch']
    print("调整前（末触达归因）:")
    for a in old_attrs:
        print(f"  {a.source_type.value}: {a.percentage:.1f}% = ¥{a.amount:,.0f}")
    print()

    print("调整后:")
    new_attrs = engine.manual_update_attribution(
        deal_id=deal_zw.id,
        attribution_type=AttributionType(AttributionType.LAST_TOUCH),
        new_source=[
            {'source_type': 'referral', 'percentage': 60.0},
            {'source_type': 'event', 'percentage': 40.0}
        ],
        operator="销售经理",
        reason="根据实际销售记录，该订单主要来自转介绍"
    )
    for a in new_attrs:
        print(f"  {a.source_type.value}: {a.percentage:.1f}% = ¥{a.amount:,.0f}")
    print()

    print("操作历史记录:")
    logs = db.get_audit_logs(record_type='attribution')
    for log in logs[:3]:
        print(f"  [{log.created_at.strftime('%H:%M:%S')}] {log.action} - {log.operator}: {log.reason or '-'}")
    print()

    print("=" * 50)
    print("  数据一致性检查")
    print("=" * 50)
    consistency = importer.check_data_consistency()
    print(f"  总订单数: {consistency['total_deals']}")
    print(f"  总归因数: {consistency['total_attributions']}")
    print(f"  发现问题: {consistency['issues_found']}")
    for issue in consistency['issues']:
        print(f"    - [{issue['type']}] {issue['message']}")
    print()

    print("=" * 50)
    print("  演示完成！")
    print("=" * 50)
    print()
    print("可使用以下CLI命令继续探索:")
    print("  lead status          - 查看系统状态")
    print("  lead check           - 检查数据一致性")
    print("  lead report          - 查看归因报告")
    print("  lead detail <id>     - 查看订单详情")
    print("  lead history         - 查看操作历史")
    print()
    print("示例:")
    print("  export PATH=\"$HOME/Library/Python/3.9/bin:$PATH\"")
    print("  lead detail deal_zw_001")
    print("  lead report --type weighted")

if __name__ == '__main__':
    main()
