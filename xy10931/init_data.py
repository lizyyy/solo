#!/usr/bin/env python3
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import engine, Base
from app import models

Base.metadata.create_all(bind=engine)

db = Session(bind=engine)

try:
    print("初始化样例数据...")

    group_names = ["纳米材料课题组", "生物医学课题组", "量子计算课题组"]
    existing_groups = db.query(models.ResearchGroup).filter(
        models.ResearchGroup.name.in_(group_names)
    ).all()
    existing_group_names = {g.name for g in existing_groups}
    
    groups = []
    for name in group_names:
        if name not in existing_group_names:
            if name == "纳米材料课题组":
                group = models.ResearchGroup(name=name, leader="张教授", contact="zhang@lab.edu", credit_score=95.0)
            elif name == "生物医学课题组":
                group = models.ResearchGroup(name=name, leader="李教授", contact="li@lab.edu", credit_score=88.0)
            else:
                group = models.ResearchGroup(name=name, leader="王教授", contact="wang@lab.edu", credit_score=75.0)
            groups.append(group)
    
    if groups:
        db.add_all(groups)
        db.flush()
        print(f"  新增 {len(groups)} 个课题组")
    else:
        print(f"  课题组已存在，跳过创建")
        groups = existing_groups
    
    group_map = {g.name: g for g in groups}

    instrument_names = ["透射电子显微镜", "扫描电子显微镜", "原子力显微镜", "高效液相色谱仪"]
    existing_instruments = db.query(models.Instrument).filter(
        models.Instrument.name.in_(instrument_names)
    ).all()
    existing_instrument_names = {i.name for i in existing_instruments}
    
    instruments = []
    for name in instrument_names:
        if name not in existing_instrument_names:
            if name == "透射电子显微镜":
                inst = models.Instrument(name=name, model="TEM-2024", location="A栋101", hourly_rate=500.0, max_reservation_hours=8, requires_risk_assessment=True, status="available")
            elif name == "扫描电子显微镜":
                inst = models.Instrument(name=name, model="SEM-X100", location="A栋102", hourly_rate=300.0, max_reservation_hours=12, requires_risk_assessment=False, status="available")
            elif name == "原子力显微镜":
                inst = models.Instrument(name=name, model="AFM-Pro", location="B栋201", hourly_rate=200.0, max_reservation_hours=24, requires_risk_assessment=False, status="maintenance")
            else:
                inst = models.Instrument(name=name, model="HPLC-9000", location="B栋301", hourly_rate=150.0, max_reservation_hours=10, requires_risk_assessment=True, status="available")
            instruments.append(inst)
    
    if instruments:
        db.add_all(instruments)
        db.flush()
        print(f"  新增 {len(instruments)} 台仪器")
    else:
        print(f"  仪器已存在，跳过创建")
        instruments = existing_instruments
    
    instrument_map = {i.name: i for i in instruments}

    nano_group = group_map["纳米材料课题组"]
    bio_group = group_map["生物医学课题组"]
    quantum_group = group_map["量子计算课题组"]
    tem = instrument_map["透射电子显微镜"]
    sem = instrument_map["扫描电子显微镜"]

    existing_reservations = db.query(models.Reservation).filter(
        models.Reservation.instrument_id.in_([tem.id, sem.id]),
        models.Reservation.user_name.in_(["张三", "李四", "王五"])
    ).count()
    
    if existing_reservations == 0:
        reservations = [
            models.Reservation(
                instrument_id=tem.id, group_id=nano_group.id, user_name="张三",
                start_time=datetime.now() + timedelta(hours=2),
                end_time=datetime.now() + timedelta(hours=6),
                status="confirmed",
                sample_type="纳米颗粒", purpose="材料表征"
            ),
            models.Reservation(
                instrument_id=sem.id, group_id=bio_group.id, user_name="李四",
                start_time=datetime.now() + timedelta(days=1),
                end_time=datetime.now() + timedelta(days=1, hours=4),
                status="pending",
                sample_type="生物组织切片", purpose="细胞结构观察"
            ),
            models.Reservation(
                instrument_id=tem.id, group_id=quantum_group.id, user_name="王五",
                start_time=datetime.now() + timedelta(days=2),
                end_time=datetime.now() + timedelta(days=2, hours=5),
                status="pending",
                sample_type="量子点", purpose="光学特性分析"
            ),
        ]
        db.add_all(reservations)
        db.flush()
        print(f"  新增 {len(reservations)} 条预约记录")

        first_res = reservations[0]
        existing_risk = db.query(models.SampleRisk).filter(
            models.SampleRisk.reservation_id == first_res.id
        ).first()
        if not existing_risk:
            risk = models.SampleRisk(
                reservation_id=first_res.id, risk_level="medium",
                contamination_risk=False, biohazard_level=1,
                special_requirements="需要在手套箱中操作",
                approved=True, approved_by="管理员",
                approved_at=datetime.now() - timedelta(hours=1)
            )
            db.add(risk)
            print(f"  新增样本风险评估记录")

        third_res = reservations[2]
        third_res.status = "cancelled"
        existing_cancel = db.query(models.CancellationRecord).filter(
            models.CancellationRecord.reservation_id == third_res.id
        ).first()
        if not existing_cancel:
            cancellation = models.CancellationRecord(
                reservation_id=third_res.id, cancelled_by="王五",
                reason="实验方案调整", penalty_amount=0.0,
                penalty_applied=False
            )
            db.add(cancellation)
            print(f"  新增取消记录")

        existing_report = db.query(models.UsageReport).filter(
            models.UsageReport.reservation_id == first_res.id
        ).first()
        if not existing_report:
            usage_report = models.UsageReport(
                reservation_id=first_res.id, instrument_id=tem.id, group_id=nano_group.id,
                actual_start_time=datetime.now() - timedelta(days=3),
                actual_end_time=datetime.now() - timedelta(days=3, hours=4, minutes=30),
                actual_duration_hours=4.5, exceeded_hours=0.5,
                overtime_penalty=375.0, total_cost=2375.0,
                issues_found="仪器工作正常", sample_contamination=False,
                submitted_by="张三"
            )
            db.add(usage_report)
            print(f"  新增使用报告")
    else:
        print(f"  预约记录已存在，跳过创建")

    existing_exceptions = db.query(models.ExceptionLog).count()
    if existing_exceptions == 0:
        exception_log = models.ExceptionLog(
            endpoint="/reservations/", raw_input='{"instrument_id": 999, "group_id": 1}',
            error_type="ValueError", error_message="Instrument not found",
            handling_conclusion="用户输入了不存在的仪器ID，已告知用户正确的仪器列表",
            handled_by="系统管理员", handled_at=datetime.now(), resolved=True
        )
        db.add(exception_log)
        print(f"  新增异常处理记录")
    else:
        print(f"  异常记录已存在，跳过创建")

    db.commit()
    print("\n✅ 样例数据初始化成功!")
    print("   (可重复执行，已存在的数据会自动跳过)")

except Exception as e:
    db.rollback()
    print(f"\n❌ 初始化失败: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
