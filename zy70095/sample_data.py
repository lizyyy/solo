from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import schemas
from services import PlanService

models.Base.metadata.create_all(bind=engine)

STATION_ID = "STATION_001"
TODAY = date.today()

def create_price_windows(db: Session):
    print("创建电价窗口数据...")
    
    base_time = datetime.combine(TODAY, datetime.min.time())
    
    windows = [
        {
            "start_time": base_time + timedelta(hours=0),
            "end_time": base_time + timedelta(hours=6),
            "price_per_kwh": 0.35,
            "window_type": "谷电",
            "is_charge_window": True,
            "is_discharge_window": False
        },
        {
            "start_time": base_time + timedelta(hours=6),
            "end_time": base_time + timedelta(hours=8),
            "price_per_kwh": 0.68,
            "window_type": "平电",
            "is_charge_window": False,
            "is_discharge_window": False
        },
        {
            "start_time": base_time + timedelta(hours=8),
            "end_time": base_time + timedelta(hours=11),
            "price_per_kwh": 1.25,
            "window_type": "尖峰",
            "is_charge_window": False,
            "is_discharge_window": True
        },
        {
            "start_time": base_time + timedelta(hours=11),
            "end_time": base_time + timedelta(hours=14),
            "price_per_kwh": 0.68,
            "window_type": "平电",
            "is_charge_window": False,
            "is_discharge_window": False
        },
        {
            "start_time": base_time + timedelta(hours=14),
            "end_time": base_time + timedelta(hours=17),
            "price_per_kwh": 1.25,
            "window_type": "尖峰",
            "is_charge_window": False,
            "is_discharge_window": True
        },
        {
            "start_time": base_time + timedelta(hours=17),
            "end_time": base_time + timedelta(hours=19),
            "price_per_kwh": 0.95,
            "window_type": "峰电",
            "is_charge_window": False,
            "is_discharge_window": True
        },
        {
            "start_time": base_time + timedelta(hours=19),
            "end_time": base_time + timedelta(hours=22),
            "price_per_kwh": 0.68,
            "window_type": "平电",
            "is_charge_window": False,
            "is_discharge_window": False
        },
        {
            "start_time": base_time + timedelta(hours=22),
            "end_time": base_time + timedelta(hours=24),
            "price_per_kwh": 0.35,
            "window_type": "谷电",
            "is_charge_window": True,
            "is_discharge_window": False
        }
    ]
    
    created_windows = []
    for w in windows:
        existing = db.query(models.PriceWindow).filter(
            models.PriceWindow.start_time == w["start_time"],
            models.PriceWindow.end_time == w["end_time"]
        ).first()
        
        if existing:
            created_windows.append(existing)
        else:
            window = models.PriceWindow(**w)
            db.add(window)
            db.commit()
            db.refresh(window)
            created_windows.append(window)
    
    print(f"  已创建 {len(created_windows)} 个电价窗口")
    return created_windows

def create_soc_constraint(db: Session):
    print("创建 SOC 约束...")
    
    constraint = models.SOCConstraint(
        plan_date=TODAY,
        min_soc=20.0,
        max_soc=90.0,
        initial_soc=30.0,
        target_soc=50.0,
        station_id=STATION_ID
    )
    
    existing = db.query(models.SOCConstraint).filter(
        models.SOCConstraint.station_id == STATION_ID,
        models.SOCConstraint.plan_date == TODAY
    ).first()
    
    if existing:
        for key, value in constraint.__dict__.items():
            if key != 'id' and key != '_sa_instance_state':
                setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        print(f"  已更新 SOC 约束 ID: {existing.id}")
        return existing
    
    db.add(constraint)
    db.commit()
    db.refresh(constraint)
    print(f"  已创建 SOC 约束 ID: {constraint.id}")
    return constraint

def create_normal_plan(db: Session, soc_constraint: models.SOCConstraint, windows: list):
    print("\n【场景1】创建正常充放电计划...")
    
    base_time = datetime.combine(TODAY, datetime.min.time())
    
    charge_window = next((w for w in windows if w.window_type == "谷电"), None)
    peak_window = next((w for w in windows if w.window_type == "尖峰"), None)
    
    plan_data = schemas.ChargePlanCreate(
        station_id=STATION_ID,
        plan_date=TODAY,
        plan_name="正常充放电计划 - 峰谷套利",
        description="基于电价曲线的典型峰谷套利策略",
        soc_constraint_id=soc_constraint.id,
        load_forecast_data={
            "forecast_date": str(TODAY),
            "peak_load_kw": 1500,
            "valley_load_kw": 300
        },
        segments=[
            schemas.PlanSegmentCreate(
                start_time=base_time + timedelta(hours=0),
                end_time=base_time + timedelta(hours=6),
                operation_type=schemas.OperationType.CHARGE,
                power_kw=500,
                energy_kwh=3000,
                expected_soc=45.0,
                price_window_id=charge_window.id if charge_window else None
            ),
            schemas.PlanSegmentCreate(
                start_time=base_time + timedelta(hours=8),
                end_time=base_time + timedelta(hours=11),
                operation_type=schemas.OperationType.DISCHARGE,
                power_kw=-500,
                energy_kwh=-1500,
                expected_soc=37.5,
                price_window_id=peak_window.id if peak_window else None
            ),
            schemas.PlanSegmentCreate(
                start_time=base_time + timedelta(hours=14),
                end_time=base_time + timedelta(hours=17),
                operation_type=schemas.OperationType.DISCHARGE,
                power_kw=-500,
                energy_kwh=-1500,
                expected_soc=30.0,
                price_window_id=peak_window.id if peak_window else None
            )
        ]
    )
    
    try:
        plan = PlanService.create_plan(db, plan_data, "测试人员_A")
        print(f"  计划创建成功，ID: {plan.id}")
        print(f"  状态: {plan.status}")
        print(f"  时段数: {len(plan.segments)}")
        return plan
    except ValueError as e:
        print(f"  创建失败: {e}")
        existing = db.query(models.ChargePlan).filter(
            models.ChargePlan.station_id == STATION_ID,
            models.ChargePlan.plan_date == TODAY
        ).first()
        if existing:
            print(f"  使用已存在的计划 ID: {existing.id}")
            return existing
        return None

def create_abnormal_plan_for_validation(db: Session, soc_constraint: models.SOCConstraint):
    print("\n【场景2】测试异常拦截 - SOC 超出限制...")
    
    base_time = datetime.combine(TODAY, datetime.min.time())
    
    tomorrow = TODAY + timedelta(days=1)
    soc_constraint_tomorrow = db.query(models.SOCConstraint).filter(
        models.SOCConstraint.station_id == STATION_ID,
        models.SOCConstraint.plan_date == tomorrow
    ).first()
    
    if not soc_constraint_tomorrow:
        soc_constraint_tomorrow = models.SOCConstraint(
            plan_date=tomorrow,
            min_soc=20.0,
            max_soc=90.0,
            initial_soc=85.0,
            target_soc=50.0,
            station_id=STATION_ID
        )
        db.add(soc_constraint_tomorrow)
        db.commit()
        db.refresh(soc_constraint_tomorrow)
    
    invalid_plan = schemas.ChargePlanCreate(
        station_id=STATION_ID,
        plan_date=tomorrow,
        plan_name="无效计划 - SOC 超出上限",
        description="测试 SOC 校验拦截",
        soc_constraint_id=soc_constraint_tomorrow.id,
        segments=[
            schemas.PlanSegmentCreate(
                start_time=datetime.combine(tomorrow, datetime.min.time()),
                end_time=datetime.combine(tomorrow, datetime.min.time()) + timedelta(hours=2),
                operation_type=schemas.OperationType.CHARGE,
                power_kw=500,
                energy_kwh=2000,
                expected_soc=95.0
            )
        ]
    )
    
    try:
        PlanService.create_plan(db, invalid_plan, "测试人员_A")
        print("  错误: 应该被拦截但未拦截")
        return False
    except ValueError as e:
        print(f"  拦截成功: {e}")
        return True

def test_duplicate_operations(db: Session, plan: models.ChargePlan):
    print("\n【场景3】测试重复操作拦截...")
    
    print("  测试1: 重复开始执行")
    if plan.status not in [schemas.PlanStatus.APPROVED.value, schemas.PlanStatus.MANUALLY_CORRECTED.value]:
        if plan.status == schemas.PlanStatus.DRAFT.value:
            PlanService.submit_plan_for_approval(db, plan.id, "审批员_B")
            db.refresh(plan)
        if plan.status == schemas.PlanStatus.PENDING.value:
            PlanService.approve_plan(db, plan.id, "审批员_B")
            db.refresh(plan)
    
    PlanService.start_execution(db, plan.id, "操作员_C")
    db.refresh(plan)
    print(f"  第一次开始执行成功，状态: {plan.status}")
    
    try:
        PlanService.start_execution(db, plan.id, "操作员_C")
        print("  错误: 重复开始执行应该被拦截")
    except ValueError as e:
        print(f"  拦截成功: {e}")
    
    print("\n  测试2: 重复提交执行回执")
    if plan.segments:
        segment = plan.segments[0]
        receipt_data = schemas.ExecutionReceiptCreate(
            plan_id=plan.id,
            segment_id=segment.id,
            actual_start_time=segment.start_time,
            actual_end_time=segment.end_time,
            actual_power_kw=segment.power_kw,
            actual_energy_kwh=segment.energy_kwh,
            actual_soc=44.5,
            equipment_status=schemas.EquipmentStatus.AVAILABLE
        )
        
        from services import ExecutionService
        try:
            ExecutionService.create_receipt(db, receipt_data)
            print(f"  第一次回执提交成功")
        except ValueError as e:
            print(f"  回执提交: {e}")
        
        try:
            ExecutionService.create_receipt(db, receipt_data)
            print("  错误: 重复回执应该被拦截")
        except ValueError as e:
            print(f"  拦截成功: {e}")

def test_manual_correction(db: Session, plan: models.ChargePlan):
    print("\n【场景4】测试人工修正和历史查询...")
    
    if plan.status == schemas.PlanStatus.COMPLETED.value:
        print("  计划已完成，跳过修正测试")
        return
    
    correction_data = schemas.ManualCorrectionCreate(
        plan_id=plan.id,
        target_status=schemas.PlanStatus.MANUALLY_CORRECTED,
        reason="设备临时维护，需要调整计划",
        corrected_by="运维管理员_D",
        correction_data={
            "maintenance_notes": "PCS 设备需要校准",
            "expected_resume_time": "2小时后"
        }
    )
    
    plan = PlanService.manual_correct(db, correction_data)
    print(f"  人工修正成功，新版本: {plan.version}")
    print(f"  当前状态: {plan.status}")
    
    history = PlanService.get_plan_history(db, plan.id)
    print(f"\n  历史记录 (共 {len(history)} 条):")
    for h in history:
        print(f"    [{h.created_at.strftime('%H:%M:%S')}] {h.action}: {h.old_status or 'N/A'} -> {h.new_status}")
        if h.reason:
            print(f"      原因: {h.reason}")
        if h.operator:
            print(f"      操作人: {h.operator}")
    
    versions = plan.versions
    print(f"\n  版本快照 (共 {len(versions)} 个):")
    for v in sorted(versions, key=lambda x: x.version_number):
        print(f"    版本 {v.version_number}: 状态={v.status}, 原因={v.change_reason or '初始版本'}")

def test_deviation_and_revenue(db: Session, plan: models.ChargePlan):
    print("\n【场景5】测试偏差告警和收益计算...")
    
    if plan.status != schemas.PlanStatus.EXECUTING.value:
        if plan.status == schemas.PlanStatus.MANUALLY_CORRECTED.value:
            PlanService.start_execution(db, plan.id, "操作员_C")
            db.refresh(plan)
    
    from services import ExecutionService
    
    for i, segment in enumerate(plan.segments):
        if i == 0:
            continue
        
        if i == 1:
            receipt_data = schemas.ExecutionReceiptCreate(
                plan_id=plan.id,
                segment_id=segment.id,
                actual_start_time=segment.start_time,
                actual_end_time=segment.end_time,
                actual_power_kw=segment.power_kw * 0.75,
                actual_energy_kwh=segment.energy_kwh * 0.75,
                actual_soc=42.0,
                equipment_status=schemas.EquipmentStatus.LIMITED,
                remarks="电网限制，功率下调"
            )
        else:
            receipt_data = schemas.ExecutionReceiptCreate(
                plan_id=plan.id,
                segment_id=segment.id,
                actual_start_time=segment.start_time,
                actual_end_time=segment.end_time,
                actual_power_kw=segment.power_kw,
                actual_energy_kwh=segment.energy_kwh,
                actual_soc=35.0,
                equipment_status=schemas.EquipmentStatus.AVAILABLE
            )
        
        try:
            receipt = ExecutionService.create_receipt(db, receipt_data)
            print(f"  时段 {i+1} 回执提交成功")
        except ValueError as e:
            print(f"  时段 {i+1}: {e}")
    
    alerts = db.query(models.DeviationAlert).filter(
        models.DeviationAlert.plan_id == plan.id
    ).all()
    
    print(f"\n  生成的告警 (共 {len(alerts)} 条):")
    for alert in alerts:
        status_emoji = "✓" if alert.is_resolved else "✗"
        level_color = {
            "info": "信息",
            "warning": "警告",
            "critical": "严重"
        }.get(alert.alert_level, alert.alert_level)
        print(f"    [{status_emoji}] [{level_color}] {alert.alert_type}: {alert.message}")
        if alert.deviation_value is not None:
            print(f"      偏差: {alert.deviation_value:.2f}% (阈值: {alert.threshold_value}%)")

def main():
    print("=" * 60)
    print("储能充放电计划 API - 样例数据初始化")
    print("=" * 60)
    print(f"电站 ID: {STATION_ID}")
    print(f"计划日期: {TODAY}")
    print()
    
    db = SessionLocal()
    
    try:
        windows = create_price_windows(db)
        soc_constraint = create_soc_constraint(db)
        
        plan = create_normal_plan(db, soc_constraint, windows)
        
        if plan:
            create_abnormal_plan_for_validation(db, soc_constraint)
            test_duplicate_operations(db, plan)
            test_manual_correction(db, plan)
            test_deviation_and_revenue(db, plan)
        
        print("\n" + "=" * 60)
        print("样例数据初始化完成！")
        print("=" * 60)
        print("\n下一步操作:")
        print("  1. 运行 'uvicorn main:app --reload' 启动服务")
        print("  2. 访问 http://localhost:8000/docs 查看 API 文档")
        print("  3. 查看 /plans/ 接口获取计划列表")
        print("  4. 导出报表: GET /plans/{plan_id}/export/excel")
        print()
        print("可测试的接口:")
        print("  - 电价窗口管理: /price-windows/")
        print("  - SOC 约束: /soc-constraints/")
        print("  - 计划生命周期: /plans/{id}/submit, approve, start, cancel")
        print("  - 执行回执: /execution-receipts/")
        print("  - 偏差告警: /alerts/")
        print("  - 收益报表: /revenue-reports/")
        print("  - 历史查询: /plans/{id}/history, /plans/{id}/versions")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
