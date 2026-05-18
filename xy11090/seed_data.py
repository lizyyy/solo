from sqlalchemy.orm import Session
from database import engine, Base
import models
from datetime import date, timedelta
from models import InvoiceStatus


def init_db():
    Base.metadata.create_all(bind=engine)


def seed_all_data():
    db = Session(bind=engine)
    try:
        seed_stalls(db)
        seed_vendors(db)
        seed_market_closures(db)
        seed_personal_leaves(db)
        seed_fee_records(db)
        print("种子数据导入完成！")
    finally:
        db.close()


def seed_stalls(db: Session):
    if db.query(models.Stall).count() > 0:
        print("摊位数据已存在，跳过")
        return
    
    stalls = [
        models.Stall(
            stall_number="A001",
            stall_area=12.5,
            stall_type="蔬菜摊",
            market_zone="A区-蔬菜",
            monthly_fee_standard=1500.0,
            is_active=True
        ),
        models.Stall(
            stall_number="A002",
            stall_area=10.0,
            stall_type="蔬菜摊",
            market_zone="A区-蔬菜",
            monthly_fee_standard=1200.0,
            is_active=True
        ),
        models.Stall(
            stall_number="B001",
            stall_area=15.0,
            stall_type="水产摊",
            market_zone="B区-水产",
            monthly_fee_standard=2000.0,
            is_active=True
        ),
        models.Stall(
            stall_number="B002",
            stall_area=18.0,
            stall_type="水产摊",
            market_zone="B区-水产",
            monthly_fee_standard=2400.0,
            is_active=True
        ),
        models.Stall(
            stall_number="C001",
            stall_area=8.0,
            stall_type="鲜肉摊",
            market_zone="C区-鲜肉",
            monthly_fee_standard=1800.0,
            is_active=True
        ),
    ]
    db.add_all(stalls)
    db.commit()
    print(f"已导入 {len(stalls)} 条摊位数据")


def seed_vendors(db: Session):
    if db.query(models.Vendor).count() > 0:
        print("摊主数据已存在，跳过")
        return
    
    stalls = db.query(models.Stall).all()
    vendors = [
        models.Vendor(
            stall_id=stalls[0].id,
            vendor_name="张大明",
            id_card_number="310101197001011234",
            phone_number="13800138001",
            business_scope="蔬菜、豆制品零售",
            contract_start_date=date(2024, 1, 1),
            contract_end_date=date(2024, 12, 31)
        ),
        models.Vendor(
            stall_id=stalls[1].id,
            vendor_name="李淑芬",
            id_card_number="310101197502025678",
            phone_number="13800138002",
            business_scope="有机蔬菜零售",
            contract_start_date=date(2024, 1, 1),
            contract_end_date=date(2024, 12, 31)
        ),
        models.Vendor(
            stall_id=stalls[2].id,
            vendor_name="王海洋",
            id_card_number="310101198003039012",
            phone_number="13800138003",
            business_scope="淡水鱼、海鲜零售",
            contract_start_date=date(2024, 1, 1),
            contract_end_date=date(2024, 12, 31)
        ),
        models.Vendor(
            stall_id=stalls[3].id,
            vendor_name="赵翠花",
            id_card_number="310101198504043456",
            phone_number="13800138004",
            business_scope="海鲜、贝类零售",
            contract_start_date=date(2024, 1, 1),
            contract_end_date=date(2024, 12, 31)
        ),
        models.Vendor(
            stall_id=stalls[4].id,
            vendor_name="陈一刀",
            id_card_number="310101197805057890",
            phone_number="13800138005",
            business_scope="猪肉、牛羊肉零售",
            contract_start_date=date(2024, 1, 1),
            contract_end_date=date(2024, 12, 31)
        ),
    ]
    db.add_all(vendors)
    db.commit()
    print(f"已导入 {len(vendors)} 条摊主数据")


def seed_market_closures(db: Session):
    if db.query(models.MarketClosure).count() > 0:
        print("休市通知数据已存在，跳过")
        return
    
    closures = [
        models.MarketClosure(
            closure_notice_no="XS-2024-001",
            closure_title="春节市场休市通知",
            closure_reason="春节假期，市场整体休市",
            start_date=date(2024, 2, 9),
            end_date=date(2024, 2, 17),
            affected_zones="A区、B区、C区",
            issuer_department="市场管理部",
            issued_at=date(2024, 1, 15)
        ),
        models.MarketClosure(
            closure_notice_no="XS-2024-002",
            closure_title="五一假期休市通知",
            closure_reason="五一劳动节假期休市",
            start_date=date(2024, 5, 1),
            end_date=date(2024, 5, 5),
            affected_zones="A区、B区、C区",
            issuer_department="市场管理部",
            issued_at=date(2024, 4, 20)
        ),
        models.MarketClosure(
            closure_notice_no="XS-2024-003",
            closure_title="A区消防改造临时休市",
            closure_reason="消防设施升级改造",
            start_date=date(2024, 3, 15),
            end_date=date(2024, 3, 17),
            affected_zones="A区",
            issuer_department="安全管理部",
            issued_at=date(2024, 3, 10)
        ),
    ]
    db.add_all(closures)
    db.commit()
    print(f"已导入 {len(closures)} 条休市通知数据")


def seed_personal_leaves(db: Session):
    if db.query(models.PersonalLeave).count() > 0:
        print("请假申请数据已存在，跳过")
        return
    
    vendors = db.query(models.Vendor).all()
    leaves = [
        models.PersonalLeave(
            leave_no="QJ-2024-001",
            vendor_id=vendors[0].id,
            leave_reason="家中有事，需回老家处理",
            start_date=date(2024, 3, 10),
            end_date=date(2024, 3, 20),
            leave_days=11,
            approver="刘主任",
            approved_at=date(2024, 3, 8)
        ),
        models.PersonalLeave(
            leave_no="QJ-2024-002",
            vendor_id=vendors[2].id,
            leave_reason="身体不适，需住院检查",
            start_date=date(2024, 4, 1),
            end_date=date(2024, 4, 7),
            leave_days=7,
            approver="刘主任",
            approved_at=date(2024, 3, 28)
        ),
        models.PersonalLeave(
            leave_no="QJ-2024-003",
            vendor_id=vendors[1].id,
            leave_reason="参加子女婚礼",
            start_date=date(2024, 5, 10),
            end_date=date(2024, 5, 15),
            leave_days=6,
            approver="刘主任",
            approved_at=date(2024, 5, 5)
        ),
        models.PersonalLeave(
            leave_no="QJ-2024-004",
            vendor_id=vendors[0].id,
            leave_reason="与休市重叠测试请假",
            start_date=date(2024, 3, 14),
            end_date=date(2024, 3, 18),
            leave_days=5,
            approver="测试员",
            approved_at=date(2024, 3, 12)
        ),
    ]
    db.add_all(leaves)
    db.commit()
    print(f"已导入 {len(leaves)} 条请假申请数据")


def seed_fee_records(db: Session):
    if db.query(models.FeeRecord).count() > 0:
        print("收费记录数据已存在，跳过")
        return
    
    stalls = db.query(models.Stall).all()
    fee_records = []
    
    for stall in stalls:
        for month in ["2024-02", "2024-03", "2024-04", "2024-05"]:
            year, mon = map(int, month.split("-"))
            fee_records.append(
                models.FeeRecord(
                    stall_id=stall.id,
                    fee_month=month,
                    fee_amount=stall.monthly_fee_standard,
                    paid_amount=stall.monthly_fee_standard,
                    payment_deadline=date(year, mon, 25),
                    payment_date=date(year, mon, 20),
                    invoice_status=InvoiceStatus.ISSUED,
                    invoice_no=f"FP{month.replace('-', '')}{stall.stall_number}"
                )
            )
    
    db.add_all(fee_records)
    db.commit()
    print(f"已导入 {len(fee_records)} 条收费记录数据")


def get_sample_reduction_data(db: Session):
    samples = []
    
    stalls = db.query(models.Stall).all()
    closures = db.query(models.MarketClosure).all()
    leaves = db.query(models.PersonalLeave).all()
    
    samples.append({
        "name": "正常申请-春节休市减免",
        "data": {
            "reduction_no": "JM-2024-02-001",
            "stall_number": stalls[0].stall_number,
            "reduction_type": "临时休市减免",
            "reduction_month": "2024-02",
            "reduction_amount": 450.0,
            "closure_notice_no": closures[0].closure_notice_no,
            "applicant": "张大明",
            "application_date": "2024-02-01",
            "review_deadline": "2024-02-28",
            "remarks": "春节休市9天，按比例减免"
        },
        "expected": "正常导入，状态为已导入"
    })
    
    samples.append({
        "name": "异常申请-重复减免",
        "data": {
            "reduction_no": "JM-2024-02-002",
            "stall_number": stalls[0].stall_number,
            "reduction_type": "临时休市减免",
            "reduction_month": "2024-02",
            "reduction_amount": 300.0,
            "closure_notice_no": closures[0].closure_notice_no,
            "applicant": "张大明",
            "application_date": "2024-02-05",
            "review_deadline": "2024-02-28",
            "remarks": "重复申请测试"
        },
        "expected": "导入失败，提示重复减免"
    })
    
    samples.append({
        "name": "异常申请-减免金额超标",
        "data": {
            "reduction_no": "JM-2024-03-001",
            "stall_number": stalls[1].stall_number,
            "reduction_type": "困难补助",
            "reduction_month": "2024-03",
            "reduction_amount": 2000.0,
            "applicant": "李淑芬",
            "application_date": "2024-03-01",
            "review_deadline": "2024-03-31",
            "remarks": "金额超过月费标准测试"
        },
        "expected": "进入待人工处理状态，提示金额超标"
    })
    
    samples.append({
        "name": "异常申请-休市与请假同时减免",
        "data": {
            "reduction_no": "JM-2024-03-002",
            "stall_number": stalls[0].stall_number,
            "reduction_type": "个人请假减免",
            "reduction_month": "2024-03",
            "reduction_amount": 500.0,
            "leave_no": leaves[3].leave_no,
            "applicant": "张大明",
            "application_date": "2024-03-12",
            "review_deadline": "2024-03-31",
            "remarks": "与休市同时段测试"
        },
        "expected": "进入待人工处理状态，提示与休市重叠"
    })
    
    samples.append({
        "name": "正常申请-个人请假减免",
        "data": {
            "reduction_no": "JM-2024-04-001",
            "stall_number": stalls[2].stall_number,
            "reduction_type": "个人请假减免",
            "reduction_month": "2024-04",
            "reduction_amount": 466.67,
            "leave_no": leaves[1].leave_no,
            "applicant": "王海洋",
            "application_date": "2024-04-02",
            "review_deadline": "2024-04-30",
            "remarks": "请假7天，按比例减免"
        },
        "expected": "正常导入，状态为已导入"
    })
    
    return samples


if __name__ == "__main__":
    init_db()
    seed_all_data()
