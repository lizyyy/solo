from datetime import datetime, timedelta
from database import SessionLocal, engine
import models
import crud
import schemas

models.Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    print("开始初始化样例数据...")

    parking_spots = [
        {"spot_number": "T001", "area": "东区临时车位", "level": "1层", "is_temporary": True},
        {"spot_number": "T002", "area": "东区临时车位", "level": "1层", "is_temporary": True},
        {"spot_number": "T003", "area": "东区临时车位", "level": "1层", "is_temporary": True},
        {"spot_number": "T004", "area": "西区临时车位", "level": "B1层", "is_temporary": True},
        {"spot_number": "T005", "area": "西区临时车位", "level": "B1层", "is_temporary": True},
        {"spot_number": "F001", "area": "固定车位区", "level": "1层", "is_temporary": False},
        {"spot_number": "F002", "area": "固定车位区", "level": "1层", "is_temporary": False},
    ]

    spot_ids = {}
    for spot_data in parking_spots:
        existing = crud.get_parking_spot_by_number(db, spot_data["spot_number"])
        if not existing:
            spot = schemas.ParkingSpotCreate(**spot_data)
            db_spot = crud.create_parking_spot(db, spot)
            spot_ids[spot_data["spot_number"]] = db_spot.id
            print(f"创建车位: {spot_data['spot_number']} (ID: {db_spot.id})")
        else:
            spot_ids[spot_data["spot_number"]] = existing.id
            if existing.status != models.ParkingSpotStatus.AVAILABLE.value:
                crud.release_parking_spot(db, existing.id)
                print(f"重置车位状态: {spot_data['spot_number']} -> 可用")

    visitors = [
        {"name": "张三", "phone": "13800138001", "company": "华为技术有限公司", "id_card": "110101199001011234"},
        {"name": "李四", "phone": "13800138002", "company": "阿里巴巴集团", "id_card": "310101199002022345"},
        {"name": "王五", "phone": "13800138003", "company": "腾讯科技", "id_card": "440101199003033456"},
        {"name": "赵六", "phone": "13800138004", "company": "字节跳动", "id_card": "110105199004044567"},
    ]

    created_visitors = []
    for visitor_data in visitors:
        existing = db.query(models.Visitor).filter(
            models.Visitor.phone == visitor_data["phone"]
        ).first()
        if not existing:
            visitor = schemas.VisitorCreate(**visitor_data)
            db_visitor = crud.create_visitor(db, visitor)
            created_visitors.append(db_visitor)
            print(f"创建访客: {visitor_data['name']} (ID: {db_visitor.id})")
        else:
            created_visitors.append(existing)
            print(f"访客已存在: {visitor_data['name']} (ID: {existing.id})")

    existing_appointments = db.query(models.MeetingAppointment).filter(
        models.MeetingAppointment.meeting_room.in_(["A栋301会议室", "B栋201会议室", "C栋101会议室"])
    ).all()
    for appt in existing_appointments:
        for pc in appt.pass_codes:
            db.delete(pc)
        for cr in appt.cancel_records:
            db.delete(cr)
        db.delete(appt)
    db.commit()
    print(f"清理历史预约记录: {len(existing_appointments)} 条")

    now = datetime.now()
    appointment_templates = [
        {
            "visitor_idx": 0,
            "spot_number": "T001",
            "meeting_room": "A栋301会议室",
            "host_name": "王经理",
            "host_phone": "13900139001",
            "hours_offset_start": 1,
            "hours_offset_end": 3,
        },
        {
            "visitor_idx": 1,
            "spot_number": "T002",
            "meeting_room": "B栋201会议室",
            "host_name": "李主管",
            "host_phone": "13900139002",
            "hours_offset_start": 2,
            "hours_offset_end": 4,
        },
        {
            "visitor_idx": 2,
            "spot_number": None,
            "meeting_room": "C栋101会议室",
            "host_name": "张总监",
            "host_phone": "13900139003",
            "hours_offset_start": 24,
            "hours_offset_end": 26,
        },
    ]

    created_appointments = []
    for tmpl in appointment_templates:
        spot_id = spot_ids.get(tmpl["spot_number"]) if tmpl["spot_number"] else None
        if spot_id:
            spot = crud.get_parking_spot(db, spot_id)
            if spot and spot.status != models.ParkingSpotStatus.AVAILABLE.value:
                print(f"车位 {tmpl['spot_number']} 状态为 {spot.status}，跳过预约")
                continue

        appt_data = {
            "visitor_id": created_visitors[tmpl["visitor_idx"]].id,
            "parking_spot_id": spot_id,
            "meeting_room": tmpl["meeting_room"],
            "host_name": tmpl["host_name"],
            "host_phone": tmpl["host_phone"],
            "start_time": now + timedelta(hours=tmpl["hours_offset_start"]),
            "end_time": now + timedelta(hours=tmpl["hours_offset_end"]),
        }

        appointment = schemas.MeetingAppointmentCreate(**appt_data)
        db_appt = crud.create_meeting_appointment(db, appointment)

        if spot_id:
            db.refresh(db_appt)
            locked_spot = crud.get_parking_spot(db, spot_id)
            if locked_spot and locked_spot.status != models.ParkingSpotStatus.LOCKED.value:
                print(f"警告: 车位 {tmpl['spot_number']} 锁定失败，预约 {db_appt.id} 已创建但车位未锁定")
            else:
                print(f"创建会议预约: {tmpl['meeting_room']}，车位 {tmpl['spot_number']} 已锁定")
        else:
            if db_appt.parking_spot_id:
                assigned_spot = crud.get_parking_spot(db, db_appt.parking_spot_id)
                print(f"创建会议预约: {tmpl['meeting_room']}，自动分配车位 {assigned_spot.spot_number}")
            else:
                print(f"创建会议预约: {tmpl['meeting_room']}，无可用车位")

        created_appointments.append(db_appt)

    for idx, appt in enumerate(created_appointments[:2]):
        existing_pc = db.query(models.PassCode).filter(
            models.PassCode.appointment_id == appt.id
        ).first()
        if not existing_pc:
            pass_code, msg = crud.generate_pass_code(db, appt.id)
            if pass_code:
                print(f"生成放行码: {pass_code.code} (预约ID: {appt.id})")
            else:
                print(f"生成放行码失败: {msg} (预约ID: {appt.id})")
        else:
            print(f"放行码已存在: {existing_pc.code} (预约ID: {appt.id})")

    if len(created_appointments) >= 2:
        appt_to_cancel = created_appointments[1]
        existing_cancel = db.query(models.CancelRecord).filter(
            models.CancelRecord.appointment_id == appt_to_cancel.id
        ).first()
        if not existing_cancel and appt_to_cancel.status != models.MeetingStatus.CANCELLED.value:
            cancel_data = schemas.CancelRecordCreate(
                appointment_id=appt_to_cancel.id,
                cancel_reason="会议时间调整",
                cancelled_by="系统管理员",
                spot_released=True
            )
            crud.cancel_meeting_appointment(db, appt_to_cancel.id, cancel_data)
            print(f"取消预约: 预约ID {appt_to_cancel.id}，车位已释放")
        else:
            print(f"预约已取消: 预约ID {appt_to_cancel.id}")

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    existing_report = db.query(models.OccupancyReport).filter(
        models.OccupancyReport.report_date >= today_start,
        models.OccupancyReport.report_date <= today_end
    ).first()
    if not existing_report:
        crud.generate_occupancy_report(db, generated_by="系统初始化")
        print("生成今日占用报告")
    else:
        print("今日报告已存在，跳过生成")

    print("\n样例数据初始化完成!")
    print(f"- 车位: {len(parking_spots)} 个")
    print(f"- 访客: {len(visitors)} 个")
    print(f"- 会议预约: {len(created_appointments)} 个")
    print(f"- 放行码: {min(2, len(created_appointments))} 个")
    print(f"- 占用报告: 1 份")

except Exception as e:
    print(f"初始化失败: {e}")
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
