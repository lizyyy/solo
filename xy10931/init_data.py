#!/usr/bin/env python3
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import engine, Base
from app import models

Base.metadata.create_all(bind=engine)

db = Session(bind=engine)

try:
    groups = [
        models.ResearchGroup(name="纳米材料课题组", leader="张教授", contact="zhang@lab.edu", credit_score=95.0),
        models.ResearchGroup(name="生物医学课题组", leader="李教授", contact="li@lab.edu", credit_score=88.0),
        models.ResearchGroup(name="量子计算课题组", leader="王教授", contact="wang@lab.edu", credit_score=75.0),
    ]
    db.add_all(groups)
    db.flush()

    instruments = [
        models.Instrument(name="透射电子显微镜", model="TEM-2024", location="A栋101", hourly_rate=500.0, max_reservation_hours=8, requires_risk_assessment=True, status="available"),
        models.Instrument(name="扫描电子显微镜", model="SEM-X100", location="A栋102", hourly_rate=300.0, max_reservation_hours=12, requires_risk_assessment=False, status="available"),
        models.Instrument(name="原子力显微镜", model="AFM-Pro", location="B栋201", hourly_rate=200.0, max_reservation_hours=24, requires_risk_assessment=False, status="maintenance"),
        models.Instrument(name="高效液相色谱仪", model="HPLC-9000", location="B栋301", hourly_rate=150.0, max_reservation_hours=10, requires_risk_assessment=True, status="available"),
    ]
    db.add_all(instruments)
    db.flush()

    reservations = [
        models.Reservation(
            instrument_id=1, group_id=1, user_name="张三",
            start_time=datetime.now() + timedelta(hours=2),
            end_time=datetime.now() + timedelta(hours=6),
            status="confirmed",
            sample_type="纳米颗粒", purpose="材料表征"
        ),
        models.Reservation(
            instrument_id=2, group_id=2, user_name="李四",
            start_time=datetime.now() + timedelta(days=1),
            end_time=datetime.now() + timedelta(days=1, hours=4),
            status="pending",
            sample_type="生物组织切片", purpose="细胞结构观察"
        ),
        models.Reservation(
            instrument_id=1, group_id=3, user_name="王五",
            start_time=datetime.now() + timedelta(days=2),
            end_time=datetime.now() + timedelta(days=2, hours=5),
            status="pending",
            sample_type="量子点", purpose="光学特性分析"
        ),
    ]
    db.add_all(reservations)
    db.flush()

    risks = [
        models.SampleRisk(
            reservation_id=1, risk_level="medium",
            contamination_risk=False, biohazard_level=1,
            special_requirements="需要在手套箱中操作",
            approved=True, approved_by="管理员",
            approved_at=datetime.now() - timedelta(hours=1)
        ),
    ]
    db.add_all(risks)

    cancellation = models.CancellationRecord(
        reservation_id=3, cancelled_by="王五",
        reason="实验方案调整", penalty_amount=0.0,
        penalty_applied=False
    )
    db.add(cancellation)
    db.flush()
    
    res3 = db.query(models.Reservation).filter(models.Reservation.id == 3).first()
    if res3:
        res3.status = "cancelled"

    usage_report = models.UsageReport(
        reservation_id=1, instrument_id=1, group_id=1,
        actual_start_time=datetime.now() - timedelta(days=3),
        actual_end_time=datetime.now() - timedelta(days=3, hours=4, minutes=30),
        actual_duration_hours=4.5, exceeded_hours=0.5,
        overtime_penalty=375.0, total_cost=2375.0,
        issues_found="仪器工作正常", sample_contamination=False,
        submitted_by="张三"
    )
    db.add(usage_report)

    exception_log = models.ExceptionLog(
        endpoint="/reservations/", raw_input='{"instrument_id": 999, "group_id": 1}',
        error_type="ValueError", error_message="Instrument not found",
        handling_conclusion="用户输入了不存在的仪器ID，已告知用户正确的仪器列表",
        handled_by="系统管理员", handled_at=datetime.now(), resolved=True
    )
    db.add(exception_log)

    db.commit()
    print("样例数据初始化成功!")
    print(f"已创建 {len(groups)} 个课题组, {len(instruments)} 台仪器, {len(reservations)} 条预约记录")

except Exception as e:
    db.rollback()
    print(f"初始化失败: {e}")
finally:
    db.close()
