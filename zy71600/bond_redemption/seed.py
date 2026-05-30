"""
混合测试数据：
- 正常记录：城投01，票息正常、公告提前、回执齐全
- 缺项记录：城投02，有赎回公告但缺托管回执
- 不合理记录：城投03，公告日期偏晚、票息重复、资金日历缺失
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import date
from database import SessionLocal, engine, Base
from models import (
    BondLedger, CouponSchedule, RedemptionNotice,
    CustodyReceipt, FundCalendar, WarningSheet,
)

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def seed():
    db.query(CustodyReceipt).delete()
    db.query(CouponSchedule).delete()
    db.query(RedemptionNotice).delete()
    db.query(FundCalendar).delete()
    db.query(WarningSheet).delete()
    db.query(BondLedger).delete()
    db.commit()

    # ========== 债券台账 ==========
    # 正常：城投01
    b1 = BondLedger(
        bond_code="CT202301", bond_name="城投01企业债", issuer="XX城投集团",
        face_value=5000.0, coupon_rate=4.5, issue_date=date(2023, 1, 15),
        maturity_date=date(2026, 6, 15), redemption_type="到期赎回", status="存续",
        source_type="spreadsheet", source_detail="2025年债券台账.xlsx-Sheet1",
        quality_status="normal",
    )
    # 缺项：城投02（有赎回公告但缺回执）
    b2 = BondLedger(
        bond_code="CT202302", bond_name="城投02企业债", issuer="YY建投公司",
        face_value=8000.0, coupon_rate=3.8, issue_date=date(2023, 3, 1),
        maturity_date=date(2026, 7, 1), redemption_type="提前赎回", status="存续",
        source_type="email", source_detail="李总邮件 2026-05-25 赎回公告",
        quality_status="normal",
    )
    # 不合理：城投03（公告偏晚 + 票息重复 + 资金日历缺失）
    b3 = BondLedger(
        bond_code="CT202303", bond_name="城投03企业债", issuer="ZZ交通投资",
        face_value=12000.0, coupon_rate=5.2, issue_date=date(2022, 6, 1),
        maturity_date=date(2026, 6, 8), redemption_type="到期赎回", status="存续",
        source_type="group_message", source_detail="资金部微信群 5月28日截图",
        quality_status="normal",
    )
    # 正常但额度大的：城投04
    b4 = BondLedger(
        bond_code="CT202304", bond_name="城投04企业债", issuer="AA产投集团",
        face_value=15000.0, coupon_rate=4.0, issue_date=date(2021, 9, 1),
        maturity_date=date(2026, 9, 1), redemption_type="到期赎回", status="存续",
        source_type="spreadsheet", source_detail="2025年债券台账.xlsx-Sheet2",
        quality_status="normal",
    )
    db.add_all([b1, b2, b3, b4])
    db.commit()

    # ========== 票息计划 ==========
    # 城投01 正常票息
    coupons_1 = [
        CouponSchedule(bond_id=b1.id, payment_date=date(2026, 6, 15), coupon_amount=225.0,
                       coupon_period="年度", is_paid=False,
                       source_type="spreadsheet", source_detail="票息计划表-财务部"),
        CouponSchedule(bond_id=b1.id, payment_date=date(2026, 12, 15), coupon_amount=225.0,
                       coupon_period="年度", is_paid=False,
                       source_type="spreadsheet", source_detail="票息计划表-财务部"),
    ]

    # 城投02 正常票息
    coupons_2 = [
        CouponSchedule(bond_id=b2.id, payment_date=date(2026, 7, 1), coupon_amount=304.0,
                       coupon_period="年度", is_paid=False,
                       source_type="email", source_detail="李总邮件 2026-05-25 票息确认"),
    ]

    # 城投03 票息 + 故意重复一条
    coupons_3 = [
        CouponSchedule(bond_id=b3.id, payment_date=date(2026, 6, 8), coupon_amount=624.0,
                       coupon_period="年度", is_paid=False,
                       source_type="group_message", source_detail="资金部微信群 5月28日截图",
                       quality_status="normal"),
        CouponSchedule(bond_id=b3.id, payment_date=date(2026, 6, 8), coupon_amount=624.0,
                       coupon_period="年度", is_paid=False,
                       source_type="email", source_detail="财务处小王邮件 5月29日票息确认",
                       quality_status="suspect", anomaly_notes=["同一债券同一日同一金额，疑似重复录入"]),
    ]

    # 城投04 正常票息
    coupons_4 = [
        CouponSchedule(bond_id=b4.id, payment_date=date(2026, 9, 1), coupon_amount=600.0,
                       coupon_period="年度", is_paid=False,
                       source_type="spreadsheet", source_detail="票息计划表-财务部"),
    ]

    db.add_all(coupons_1 + coupons_2 + coupons_3 + coupons_4)
    db.commit()

    # ========== 赎回公告 ==========
    # 城投01：公告提前，正常
    n1 = RedemptionNotice(
        bond_id=b1.id, notice_date=date(2026, 5, 10), redemption_date=date(2026, 6, 15),
        redemption_price=5000.0, notice_version=1, is_latest=True,
        notice_title="城投01企业债到期赎回公告",
        source_type="email", source_detail="合规部邮件 2026-05-10",
        quality_status="normal", is_late=False,
    )

    # 城投02：提前赎回，公告正常
    n2 = RedemptionNotice(
        bond_id=b2.id, notice_date=date(2026, 5, 20), redemption_date=date(2026, 7, 1),
        redemption_price=8000.0, notice_version=1, is_latest=True,
        notice_title="城投02企业债提前赎回公告",
        source_type="email", source_detail="李总邮件 2026-05-20",
        quality_status="normal", is_late=False,
    )

    # 城投03：公告日期偏晚！公告日6月3日，赎回日6月8日，间隔不足5天
    n3 = RedemptionNotice(
        bond_id=b3.id, notice_date=date(2026, 6, 3), redemption_date=date(2026, 6, 8),
        redemption_price=12000.0, notice_version=1, is_latest=True,
        notice_title="城投03企业债到期赎回公告（紧急）",
        source_type="group_message", source_detail="资金部微信群 6月3日紧急通知",
        quality_status="suspect", is_late=True,
        anomaly_notes=["公告日期偏晚：公告日2026-06-03距赎回日2026-06-08仅5天，不足5个工作日"],
    )

    # 城投03：第二版公告（版本升级场景）
    n3v2 = RedemptionNotice(
        bond_id=b3.id, notice_date=date(2026, 6, 4), redemption_date=date(2026, 6, 8),
        redemption_price=12000.0, notice_version=2, is_latest=False,
        notice_title="城投03企业债到期赎回公告（修订版）",
        source_type="email", source_detail="合规部邮件 2026-06-04 修订通知",
        quality_status="suspect", is_late=True,
        anomaly_notes=["修订版公告仍偏晚"],
    )

    # 城投04：正常
    n4 = RedemptionNotice(
        bond_id=b4.id, notice_date=date(2026, 8, 1), redemption_date=date(2026, 9, 1),
        redemption_price=15000.0, notice_version=1, is_latest=True,
        notice_title="城投04企业债到期赎回公告",
        source_type="spreadsheet", source_detail="合规部公告台账",
        quality_status="normal", is_late=False,
    )

    db.add_all([n1, n2, n3, n3v2, n4])
    db.commit()

    # ========== 托管回执 ==========
    # 城投01：回执齐全
    r1 = CustodyReceipt(
        bond_id=b1.id, receipt_date=date(2026, 6, 15), receipt_amount=5225.0,
        custodian="中国结算", receipt_no="RCPT-CT202301-001",
        is_matched=False,
        source_type="email", source_detail="托管部邮件 2026-05-28 回执确认",
        quality_status="normal",
    )

    # 城投02：故意不给回执（测试缺失场景）

    # 城投03：给一条不匹配的回执（金额、日期对不上）
    r3 = CustodyReceipt(
        bond_id=b3.id, receipt_date=date(2026, 5, 20), receipt_amount=600.0,
        custodian="中国结算", receipt_no="RCPT-CT202303-001",
        is_matched=False,
        source_type="group_message", source_detail="托管处微信截图 5月28日",
        quality_status="suspect", anomaly_notes=["回执日期和金额与预期现金流不匹配"],
    )

    # 城投04：回执齐全
    r4 = CustodyReceipt(
        bond_id=b4.id, receipt_date=date(2026, 9, 1), receipt_amount=15600.0,
        custodian="中国结算", receipt_no="RCPT-CT202304-001",
        is_matched=False,
        source_type="email", source_detail="托管部邮件 2026-05-29",
        quality_status="normal",
    )

    db.add_all([r1, r3, r4])
    db.commit()

    # ========== 资金日历 ==========
    # 城投01到期日：资金充足
    fc1 = FundCalendar(
        calendar_date=date(2026, 6, 15), expected_inflow=6000.0, expected_outflow=5225.0,
        description="城投01到期本息兑付",
        source_type="spreadsheet", source_detail="资金日历-资金岗",
        quality_status="normal",
    )
    # 城投03到期日：故意不设资金日历（测试缺失场景）
    # 城投04到期日：资金不足
    fc2 = FundCalendar(
        calendar_date=date(2026, 9, 1), expected_inflow=5000.0, expected_outflow=15600.0,
        description="城投04到期本息兑付",
        source_type="spreadsheet", source_detail="资金日历-资金岗",
        quality_status="normal",
    )
    # 一个空的日期
    fc3 = FundCalendar(
        calendar_date=date(2026, 7, 1), expected_inflow=1000.0, expected_outflow=8304.0,
        description="城投02赎回",
        source_type="manual", source_detail="资金岗手工录入",
        quality_status="normal",
    )

    db.add_all([fc1, fc2, fc3])
    db.commit()

    print("=== 测试数据已录入 ===")
    print(f"债券台账: {db.query(BondLedger).count()} 条")
    print(f"票息计划: {db.query(CouponSchedule).count()} 条")
    print(f"赎回公告: {db.query(RedemptionNotice).count()} 条")
    print(f"托管回执: {db.query(CustodyReceipt).count()} 条")
    print(f"资金日历: {db.query(FundCalendar).count()} 条")
    print()
    print("预期异常：")
    print("  [票息重复] 城投03有两笔相同票息（6月8日 624万）")
    print("  [公告偏晚] 城投03公告日6月3日，距赎回日6月8日不足5个工作日")
    print("  [回执缺失] 城投02有赎回公告和票息但无托管回执")
    print("  [回执无匹配] 城投03回执日期5月20日/金额600万，对不上6月8日现金流")
    print("  [资金缺口] 城投04：9月1日需求15600万，可用仅5000万")
    print("  [日历缺失] 城投03到期日6月8日无资金日历记录")


if __name__ == "__main__":
    seed()
