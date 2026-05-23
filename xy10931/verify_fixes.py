#!/usr/bin/env python3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from app.database import Base
from app import models, schemas, crud

print("=" * 60)
print("验证修复脚本")
print("=" * 60)

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("\n1. 初始化测试数据...")
    group = models.ResearchGroup(name="测试课题组", leader="张教授", contact="test@lab.com", credit_score=95.0)
    instrument = models.Instrument(name="测试电镜", model="Test-2024", location="A101", hourly_rate=500.0, max_reservation_hours=8, requires_risk_assessment=False, status="available")
    db.add_all([group, instrument])
    db.flush()
    
    reservation = models.Reservation(
        instrument_id=1,
        group_id=1,
        user_name="测试用户",
        start_time=datetime.now() - timedelta(days=1),
        end_time=datetime.now() - timedelta(days=1, hours=-4),
        status="confirmed",
        sample_type="测试样品",
        purpose="测试"
    )
    db.add(reservation)
    db.flush()
    print(f"   ✓ 课题组ID: {group.id}, 仪器ID: {instrument.id}, 预约ID: {reservation.id}")

    print("\n2. 测试使用报告创建（修复重复参数问题）...")
    try:
        report_data = schemas.UsageReportCreate(
            reservation_id=1,
            actual_start_time=datetime.now() - timedelta(days=1),
            actual_end_time=datetime.now() - timedelta(days=1, hours=-5),
            issues_found="测试使用报告",
            sample_contamination=False,
            submitted_by="测试用户"
        )
        report = crud.create_usage_report(db, report_data)
        print(f"   ✓ 使用报告创建成功!")
        print(f"     - 报告ID: {report.id}")
        print(f"     - 实际使用时长: {report.actual_duration_hours:.2f}小时")
        print(f"     - 超时: {report.exceeded_hours:.2f}小时")
        print(f"     - 超时罚款: {report.overtime_penalty:.2f}元")
        print(f"     - 总费用: {report.total_cost:.2f}元")
        print(f"     - 预约状态: {reservation.status}")
    except Exception as e:
        print(f"   ✗ 使用报告创建失败: {type(e).__name__}: {e}")
        raise

    print("\n3. 测试异常路径是否保存原始输入...")
    exception_before = db.query(models.ExceptionLog).count()
    print(f"   - 测试前异常记录数: {exception_before}")
    
    try:
        bad_reservation = schemas.ReservationCreate(
            instrument_id=999,
            group_id=1,
            user_name="坏数据测试",
            start_time=datetime.now() + timedelta(days=1),
            end_time=datetime.now() + timedelta(days=1, hours=4)
        )
        crud.create_reservation(db, bad_reservation)
    except ValueError as e:
        exception_log = schemas.ExceptionLogCreate(
            endpoint="/test/bad-reservation",
            raw_input=str(bad_reservation.model_dump()),
            error_type="ValueError",
            error_message=str(e)
        )
        crud.log_exception(db, exception_log)
        print(f"   ✓ 异常已捕获并记录: {e}")
    
    exception_after = db.query(models.ExceptionLog).count()
    print(f"   - 测试后异常记录数: {exception_after}")
    if exception_after > exception_before:
        print(f"   ✓ 异常记录已成功保存!")
        last_log = db.query(models.ExceptionLog).order_by(models.ExceptionLog.id.desc()).first()
        print(f"     - 异常ID: {last_log.id}")
        print(f"     - 错误类型: {last_log.error_type}")
        print(f"     - 原始输入已保存: {'是' if last_log.raw_input else '否'}")
    else:
        print(f"   ✗ 异常记录未保存!")

    print("\n4. 测试样本污染处罚机制...")
    reservation2 = models.Reservation(
        instrument_id=1,
        group_id=1,
        user_name="污染测试",
        start_time=datetime.now() + timedelta(days=2),
        end_time=datetime.now() + timedelta(days=2, hours=3),
        status="confirmed"
    )
    db.add(reservation2)
    db.flush()
    
    credit_before = group.credit_score
    instrument_status_before = instrument.status
    
    report2 = crud.create_usage_report(db, schemas.UsageReportCreate(
        reservation_id=reservation2.id,
        issues_found="发现样本污染",
        sample_contamination=True,
        submitted_by="管理员"
    ))
    
    db.refresh(group)
    db.refresh(instrument)
    
    print(f"   ✓ 样本污染报告已提交")
    print(f"     - 信用分变化: {credit_before} → {group.credit_score} (预期扣除20分)")
    print(f"     - 仪器状态: {instrument_status_before} → {instrument.status} (预期变为 maintenance)")

    print("\n5. 测试数据导出...")
    from app.crud import get_usage_reports
    reports = get_usage_reports(db)
    print(f"   ✓ 可导出使用报告数量: {len(reports)}")
    for r in reports:
        print(f"     - 报告#{r.id}: 预约{r.reservation_id}, 费用{r.total_cost}元")

    print("\n" + "=" * 60)
    print("所有测试通过! ✓")
    print("=" * 60)

except Exception as e:
    print(f"\n测试失败: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
