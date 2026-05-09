import sys
import os
from datetime import datetime, date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, Base, engine
from app.models.user import User, UserRole
from app.models.instrument import Instrument, InstrumentStatus
from app.models.borrow import Borrow, BorrowStatus
from app.models.calibration import Calibration, CalibrationStatus
from app.models.approval import ApprovalRequest, ApprovalType, ApprovalStatus
from app.models.history import InstrumentHistory


def _simple_hash(pwd: str) -> str:
    return f"HASHED:{pwd}:v1"


def clear_all(db):
    db.query(InstrumentHistory).delete()
    db.query(ApprovalRequest).delete()
    db.query(Calibration).delete()
    db.query(Borrow).delete()
    db.query(Instrument).delete()
    db.query(User).delete()
    db.commit()


def create_users(db):
    users_data = [
        {
            "username": "admin",
            "password": "admin123",
            "full_name": "系统管理员",
            "email": "admin@example.com",
            "phone": "13800000001",
            "department": "质量管理部",
            "role": UserRole.ADMIN,
        },
        {
            "username": "metro1",
            "password": "metro123",
            "full_name": "计量师-张三",
            "email": "zhangsan@example.com",
            "phone": "13800000002",
            "department": "计量室",
            "role": UserRole.METROLOGIST,
        },
        {
            "username": "metro2",
            "password": "metro123",
            "full_name": "计量师-李四",
            "email": "lisi@example.com",
            "phone": "13800000003",
            "department": "计量室",
            "role": UserRole.METROLOGIST,
        },
        {
            "username": "ws_user1",
            "password": "ws123",
            "full_name": "车间-王五",
            "email": "wangwu@example.com",
            "phone": "13800000004",
            "department": "生产一车间",
            "role": UserRole.WORKSHOP_USER,
        },
        {
            "username": "ws_user2",
            "password": "ws123",
            "full_name": "车间-赵六",
            "email": "zhaoliu@example.com",
            "phone": "13800000005",
            "department": "生产二车间",
            "role": UserRole.WORKSHOP_USER,
        },
        {
            "username": "approver1",
            "password": "approve123",
            "full_name": "审批人-周经理",
            "email": "zhou@example.com",
            "phone": "13800000006",
            "department": "质量部",
            "role": UserRole.APPROVER,
        },
    ]
    
    users = []
    for u in users_data:
        user = User(
            username=u["username"],
            password_hash=_simple_hash(u["password"]),
            full_name=u["full_name"],
            email=u["email"],
            phone=u["phone"],
            department=u["department"],
            role=u["role"],
            is_active=True,
        )
        db.add(user)
        users.append(user)
    
    db.commit()
    for u in users:
        db.refresh(u)
    
    print(f"✓ 创建 {len(users)} 个用户")
    for u in users:
        print(f"  - {u.username} ({u.full_name}, {u.role.value})")
    return users


def create_instruments(db):
    today = date.today()
    instruments_data = [
        {
            "code": "INS-001",
            "name": "游标卡尺",
            "specification": "0-150mm / 0.02mm",
            "serial_number": "SN-CALI-2024-0001",
            "manufacturer": "Mitutoyo",
            "accuracy": "0.02mm",
            "measurement_range": "0-150mm",
            "location": "计量室-货架A-01",
            "calibration_period_months": 12,
            "last_calibration_date": today - timedelta(days=300),
        },
        {
            "code": "INS-002",
            "name": "数显千分尺",
            "specification": "0-25mm / 0.001mm",
            "serial_number": "SN-MIC-2024-0002",
            "manufacturer": "Mitutoyo",
            "accuracy": "0.001mm",
            "measurement_range": "0-25mm",
            "location": "计量室-货架A-02",
            "calibration_period_months": 6,
            "last_calibration_date": today - timedelta(days=120),
        },
        {
            "code": "INS-003",
            "name": "电子天平",
            "specification": "210g / 0.1mg",
            "serial_number": "SN-BAL-2024-0003",
            "manufacturer": "Sartorius",
            "accuracy": "0.1mg",
            "measurement_range": "0-210g",
            "location": "天平室",
            "calibration_period_months": 12,
            "last_calibration_date": today - timedelta(days=380),
        },
        {
            "code": "INS-004",
            "name": "压力变送器",
            "specification": "0-1MPa",
            "serial_number": "SN-PRE-2024-0004",
            "manufacturer": "Rosemount",
            "accuracy": "0.075%",
            "measurement_range": "0-1MPa",
            "location": "压力实验室",
            "calibration_period_months": 12,
            "last_calibration_date": today - timedelta(days=200),
        },
        {
            "code": "INS-005",
            "name": "温湿度记录仪",
            "specification": "-20~80℃ / 10~95%RH",
            "serial_number": "SN-TH-2024-0005",
            "manufacturer": "Testo",
            "accuracy": "±0.3℃ / ±2%RH",
            "measurement_range": "-20~80℃",
            "location": "环境实验室",
            "calibration_period_months": 12,
            "last_calibration_date": today - timedelta(days=350),
        },
        {
            "code": "INS-006",
            "name": "硬度计",
            "specification": "洛氏硬度计 HR-150A",
            "serial_number": "SN-HRD-2024-0006",
            "manufacturer": "时代",
            "accuracy": "±1HRC",
            "measurement_range": "20-70HRC",
            "location": "材料实验室",
            "calibration_period_months": 12,
            "last_calibration_date": today - timedelta(days=100),
        },
        {
            "code": "INS-007",
            "name": "光谱分析仪",
            "specification": "XRF台式",
            "serial_number": "SN-XRF-2024-0007",
            "manufacturer": "Thermo",
            "accuracy": "±0.1%",
            "measurement_range": "Ti-U",
            "location": "化学分析室",
            "calibration_period_months": 12,
            "last_calibration_date": today - timedelta(days=250),
        },
        {
            "code": "INS-008",
            "name": "扭矩扳手",
            "specification": "10-100N·m",
            "serial_number": "SN-TQ-2024-0008",
            "manufacturer": "Wera",
            "accuracy": "±4%",
            "measurement_range": "10-100N·m",
            "location": "工具间",
            "calibration_period_months": 6,
            "last_calibration_date": today - timedelta(days=180),
        },
    ]
    
    instruments = []
    for i_data in instruments_data:
        months = i_data["calibration_period_months"]
        last_cal = i_data.get("last_calibration_date")
        next_cal = None
        if last_cal:
            next_cal = last_cal + timedelta(days=months * 30)
        
        instrument = Instrument(
            code=i_data["code"],
            name=i_data["name"],
            specification=i_data["specification"],
            serial_number=i_data["serial_number"],
            manufacturer=i_data["manufacturer"],
            accuracy=i_data["accuracy"],
            measurement_range=i_data["measurement_range"],
            location=i_data["location"],
            status=InstrumentStatus.IN_STOCK,
            calibration_period_months=months,
            last_calibration_date=last_cal,
            next_calibration_date=next_cal,
            created_by=1,
        )
        db.add(instrument)
        instruments.append(instrument)
    
    db.commit()
    for i in instruments:
        db.refresh(i)
    
    print(f"✓ 创建 {len(instruments)} 个计量器具")
    return instruments


def create_borrows(db, users, instruments):
    today = date.today()
    
    ws_user1 = next((u for u in users if u.username == "ws_user1"), None)
    ws_user2 = next((u for u in users if u.username == "ws_user2"), None)
    admin = next((u for u in users if u.username == "admin"), None)
    
    borrows_data = [
        {
            "instrument": instruments[1],
            "borrower": ws_user1,
            "purpose": "生产一车间工件尺寸检测",
            "department": "生产一车间",
            "workshop": "机加工段",
            "work_order": "WO-2026-0501",
            "borrow_date": today - timedelta(days=25),
            "expected_return_date": today - timedelta(days=5),
            "status": BorrowStatus.OVERDUE,
            "is_overdue": True,
        },
        {
            "instrument": instruments[3],
            "borrower": ws_user1,
            "purpose": "生产线压力传感器比对",
            "department": "生产一车间",
            "workshop": "装配段",
            "work_order": "WO-2026-0510",
            "borrow_date": today - timedelta(days=5),
            "expected_return_date": today + timedelta(days=10),
            "status": BorrowStatus.BORROWED,
            "is_overdue": False,
        },
        {
            "instrument": instruments[7],
            "borrower": ws_user2,
            "purpose": "产线螺栓扭矩复检",
            "department": "生产二车间",
            "workshop": "总装段",
            "work_order": "WO-2026-0520",
            "borrow_date": today - timedelta(days=10),
            "expected_return_date": today + timedelta(days=5),
            "status": BorrowStatus.BORROWED,
            "is_overdue": False,
        },
        {
            "instrument": instruments[2],
            "borrower": ws_user2,
            "purpose": "来料重量抽检",
            "department": "生产二车间",
            "workshop": "检验段",
            "work_order": "WO-2026-0505",
            "borrow_date": today - timedelta(days=60),
            "expected_return_date": today - timedelta(days=40),
            "actual_return_date": today - timedelta(days=42),
            "status": BorrowStatus.RETURNED,
            "is_overdue": False,
            "return_condition": "正常",
        },
        {
            "instrument": instruments[0],
            "borrower": ws_user1,
            "purpose": "批次工件抽检",
            "department": "生产一车间",
            "workshop": "粗加工段",
            "work_order": "WO-2026-0420",
            "borrow_date": today - timedelta(days=90),
            "expected_return_date": today - timedelta(days=75),
            "actual_return_date": today - timedelta(days=77),
            "status": BorrowStatus.RETURNED,
            "is_overdue": False,
            "return_condition": "正常",
        },
    ]
    
    borrows = []
    for b_data in borrows_data:
        instrument = b_data["instrument"]
        if b_data["status"] in [BorrowStatus.BORROWED, BorrowStatus.OVERDUE]:
            instrument.status = InstrumentStatus.BORROWED
        
        borrow = Borrow(
            instrument_id=instrument.id,
            borrower_id=b_data["borrower"].id,
            purpose=b_data["purpose"],
            department=b_data["department"],
            workshop=b_data["workshop"],
            work_order=b_data["work_order"],
            borrow_date=b_data["borrow_date"],
            expected_return_date=b_data["expected_return_date"],
            actual_return_date=b_data.get("actual_return_date"),
            status=b_data["status"],
            is_overdue=b_data["is_overdue"],
            return_condition=b_data.get("return_condition"),
            overdue_notice_count=2 if b_data["status"] == BorrowStatus.OVERDUE else 0,
            created_by=admin.id if admin else None,
        )
        db.add(borrow)
        borrows.append(borrow)
    
    db.commit()
    for b in borrows:
        db.refresh(b)
    
    print(f"✓ 创建 {len(borrows)} 条借用记录")
    return borrows


def create_calibrations(db, users, instruments):
    today = date.today()
    metro1 = next((u for u in users if u.username == "metro1"), None)
    
    calibrations_data = [
        {
            "instrument": instruments[0],
            "calibration_type": "定期校准",
            "scheduled_date": today - timedelta(days=300),
            "calibration_date": today - timedelta(days=300),
            "status": CalibrationStatus.PASSED,
            "result_pass": True,
            "certificate_number": "CERT-2025-0001",
        },
        {
            "instrument": instruments[2],
            "calibration_type": "定期校准",
            "scheduled_date": today - timedelta(days=380),
            "calibration_date": today - timedelta(days=380),
            "status": CalibrationStatus.PASSED,
            "result_pass": True,
            "certificate_number": "CERT-2025-0002",
        },
        {
            "instrument": instruments[4],
            "calibration_type": "定期校准",
            "scheduled_date": today - timedelta(days=350),
            "calibration_date": today - timedelta(days=350),
            "status": CalibrationStatus.PASSED,
            "result_pass": True,
            "certificate_number": "CERT-2025-0003",
        },
        {
            "instrument": instruments[6],
            "calibration_type": "定期校准",
            "scheduled_date": today - timedelta(days=250),
            "calibration_date": today - timedelta(days=250),
            "status": CalibrationStatus.PASSED,
            "result_pass": True,
            "certificate_number": "CERT-2025-0004",
        },
        {
            "instrument": instruments[5],
            "calibration_type": "定期校准",
            "scheduled_date": today + timedelta(days=10),
            "status": CalibrationStatus.SCHEDULED,
            "calibration_agency": "第三方计量校准中心",
        },
        {
            "instrument": instruments[1],
            "calibration_type": "定期校准",
            "scheduled_date": today + timedelta(days=5),
            "status": CalibrationStatus.SCHEDULED,
            "calibration_agency": "内部计量室",
        },
    ]
    
    calibrations = []
    for c_data in calibrations_data:
        cal = Calibration(
            instrument_id=c_data["instrument"].id,
            calibration_type=c_data["calibration_type"],
            scheduled_date=c_data["scheduled_date"],
            calibration_date=c_data.get("calibration_date"),
            calibration_agency=c_data.get("calibration_agency"),
            certificate_number=c_data.get("certificate_number"),
            status=c_data["status"],
            result_pass=c_data.get("result_pass"),
            calibrated_by=metro1.id if metro1 and c_data.get("calibration_date") else None,
        )
        db.add(cal)
        calibrations.append(cal)
    
    db.commit()
    for c in calibrations:
        db.refresh(c)
    
    print(f"✓ 创建 {len(calibrations)} 条校准记录")
    return calibrations


def create_approvals(db, users, instruments):
    today = date.today()
    metro1 = next((u for u in users if u.username == "metro1"), None)
    
    approvals_data = [
        {
            "instrument": instruments[6],
            "approval_type": ApprovalType.SEAL,
            "reason": "仪器精度超差，待专业维修后再评估",
            "status": ApprovalStatus.PENDING,
        },
    ]
    
    approvals = []
    for a_data in approvals_data:
        from datetime import datetime as dt
        from app.services.approval_service import ApprovalService
        
        approval = ApprovalRequest(
            request_no=f"APR-{dt.now().strftime('%Y%m%d%H%M%S')}-{len(approvals):02d}",
            approval_type=a_data["approval_type"],
            instrument_id=a_data["instrument"].id,
            reason=a_data["reason"],
            status=a_data["status"],
            requester_id=metro1.id if metro1 else None,
            requester_name=metro1.full_name if metro1 else None,
        )
        db.add(approval)
        approvals.append(approval)
    
    db.commit()
    for a in approvals:
        db.refresh(a)
    
    print(f"✓ 创建 {len(approvals)} 条审批申请")
    return approvals


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("  开始初始化测试数据")
        print("=" * 60)
        
        clear_all(db)
        print("✓ 清理现有数据")
        
        users = create_users(db)
        instruments = create_instruments(db)
        borrows = create_borrows(db, users, instruments)
        calibrations = create_calibrations(db, users, instruments)
        approvals = create_approvals(db, users, instruments)
        
        print("=" * 60)
        print("  测试数据初始化完成")
        print("=" * 60)
        print(f"  用户: {len(users)} 条")
        print(f"  器具: {len(instruments)} 条")
        print(f"  借用: {len(borrows)} 条")
        print(f"  校准: {len(calibrations)} 条")
        print(f"  审批: {len(approvals)} 条")
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
