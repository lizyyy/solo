from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models, schemas, crud
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)


def create_normal_flow(db: Session):
    print("=== 场景1: 正常流程（报警→派单→到场→解决→审核通过）===")
    
    alarm = schemas.ElevatorAlarmCreate(
        elevator_no="A-01-01",
        alarm_time=datetime.now() - timedelta(hours=3),
        passenger_count=2,
        source="monitor",
        location="1号楼1单元",
        description="电梯卡在5-6楼之间，有2人被困",
        created_by="张值班",
        maintenance_person=None,
        maintenance_phone=None
    )
    db_alarm = crud.create_alarm(db, alarm)
    alarm_id = db_alarm.id
    print(f"创建报警: {db_alarm.alarm_no}, ID={alarm_id}")
    
    call1 = schemas.CallRecordCreate(
        call_type="安抚乘客",
        caller="李乘客",
        caller_phone="13800138001",
        call_time=datetime.now() - timedelta(hours=2, minutes=55),
        duration=180,
        content="告知乘客已派维保，请保持冷静，不要扒门",
        operator="张值班"
    )
    crud.add_call_record(db, alarm_id, call1)
    print("添加安抚通话记录")
    
    dispatch = schemas.DispatchMaintenance(
        maintenance_person="王师傅",
        maintenance_phone="13900139001",
        operator="张值班",
        remark="紧急派单"
    )
    db_alarm = crud.dispatch_maintenance(db, alarm_id, dispatch)
    print(f"派单给王师傅，当前状态: {db_alarm.status}")
    
    call2 = schemas.CallRecordCreate(
        call_type="联系维保",
        caller="王师傅",
        caller_phone="13900139001",
        call_time=datetime.now() - timedelta(hours=2, minutes=40),
        duration=60,
        content="确认王师傅已出发，预计15分钟到",
        operator="张值班"
    )
    crud.add_call_record(db, alarm_id, call2)
    print("添加联系维保通话记录")
    
    arrive = schemas.ArriveOnSite(
        operator="王师傅",
        remark="已到达现场"
    )
    db_alarm = crud.arrive_on_site(db, alarm_id, arrive)
    print(f"维保到场，当前状态: {db_alarm.status}")
    
    call3 = schemas.CallRecordCreate(
        call_type="安抚乘客",
        caller="李乘客",
        caller_phone="13800138001",
        call_time=datetime.now() - timedelta(hours=2, minutes=20),
        duration=45,
        content="告知乘客维保已到，正在救援",
        operator="张值班"
    )
    crud.add_call_record(db, alarm_id, call3)
    print("添加第二次安抚通话记录")
    
    resolve = schemas.ResolveAlarm(
        resolution="门锁故障，已调整门锁间隙，救出2名乘客无受伤",
        operator="王师傅",
        remark="故障解决"
    )
    db_alarm = crud.resolve_alarm(db, alarm_id, resolve)
    print(f"故障解决提交审核，当前状态: {db_alarm.status}")
    
    review = schemas.ReviewAlarm(
        is_approved=True,
        reviewer="刘主管",
        comment="处理及时，记录完整，同意结案"
    )
    db_alarm = crud.review_alarm(db, alarm_id, review)
    print(f"审核通过结案，当前状态: {db_alarm.status}")
    print(f"正常流程完成！\n")
    return alarm_id


def create_conflict_flow(db: Session):
    print("=== 场景2: 冲突流程（解决→驳回→修改→重新提交→通过）===")
    
    alarm = schemas.ElevatorAlarmCreate(
        elevator_no="B-02-03",
        alarm_time=datetime.now() - timedelta(hours=5),
        passenger_count=1,
        source="phone",
        location="2号楼2单元",
        description="乘客按紧急呼叫报警",
        created_by="李值班"
    )
    db_alarm = crud.create_alarm(db, alarm)
    alarm_id = db_alarm.id
    print(f"创建报警: {db_alarm.alarm_no}, ID={alarm_id}")
    
    dispatch = schemas.DispatchMaintenance(
        maintenance_person="赵师傅",
        maintenance_phone="13700137001",
        operator="李值班"
    )
    crud.dispatch_maintenance(db, alarm_id, dispatch)
    print("派单给赵师傅")
    
    arrive = schemas.ArriveOnSite(operator="赵师傅")
    crud.arrive_on_site(db, alarm_id, arrive)
    print("维保到场")
    
    resolve = schemas.ResolveAlarm(
        resolution="已解决",
        operator="赵师傅"
    )
    db_alarm = crud.resolve_alarm(db, alarm_id, resolve)
    print(f"提交解决，当前状态: {db_alarm.status}")
    
    review = schemas.ReviewAlarm(
        is_approved=False,
        reviewer="刘主管",
        comment="处理结果描述太简单，请补充故障原因、救援过程、乘客情况等详细信息"
    )
    db_alarm = crud.review_alarm(db, alarm_id, review)
    print(f"审核驳回，当前状态: {db_alarm.status}")
    print(f"驳回历史: {db_alarm.previous_rejection}")
    
    resubmit = schemas.ResubmitAlarm(
        resolution="门机变频器故障，复位后恢复正常。救出1名老年乘客，情绪稳定无受伤。已登记该电梯需更换变频器。",
        operator="赵师傅",
        remark="补充详细处理结果"
    )
    db_alarm = crud.resubmit_alarm(db, alarm_id, resubmit)
    print(f"重新提交，当前状态: {db_alarm.status}，重新提交次数: {db_alarm.resubmit_count}")
    
    review2 = schemas.ReviewAlarm(
        is_approved=True,
        reviewer="刘主管",
        comment="记录详细，同意结案"
    )
    db_alarm = crud.review_alarm(db, alarm_id, review2)
    print(f"审核通过结案，当前状态: {db_alarm.status}")
    print(f"驳回历史有{len(db_alarm.previous_rejection['history'])}条记录")
    print(f"冲突流程完成！\n")
    return alarm_id


def create_cancel_flow(db: Session):
    print("=== 场景3: 撤回流程（误报警→取消）===")
    
    alarm = schemas.ElevatorAlarmCreate(
        elevator_no="C-03-02",
        alarm_time=datetime.now() - timedelta(hours=1),
        passenger_count=0,
        source="manual",
        location="3号楼3单元",
        description="监控室接到呼叫，无应答",
        created_by="王值班"
    )
    db_alarm = crud.create_alarm(db, alarm)
    alarm_id = db_alarm.id
    print(f"创建报警: {db_alarm.alarm_no}, ID={alarm_id}")
    
    call = schemas.CallRecordCreate(
        call_type="现场核实",
        caller="保安小王",
        caller_phone="13600136001",
        call_time=datetime.now() - timedelta(minutes=50),
        duration=30,
        content="保安到现场确认，电梯正常运行，无人被困",
        operator="王值班"
    )
    crud.add_call_record(db, alarm_id, call)
    print("添加现场核实通话记录")
    
    db_alarm = crud.cancel_alarm(db, alarm_id, "王值班", "误报警，现场核实无人被困")
    print(f"撤回报警，当前状态: {db_alarm.status}")
    print(f"撤回流程完成！\n")
    return alarm_id


def create_manual_correction_flow(db: Session):
    print("=== 场景4: 人工修正（修改关键信息→留痕）===")
    
    alarm = schemas.ElevatorAlarmCreate(
        elevator_no="D-01-05",
        alarm_time=datetime.now() - timedelta(hours=4),
        passenger_count=3,
        source="monitor",
        location="1号楼5单元",
        description="电梯故障",
        created_by="陈值班"
    )
    db_alarm = crud.create_alarm(db, alarm)
    alarm_id = db_alarm.id
    print(f"创建报警: {db_alarm.alarm_no}, ID={alarm_id}")
    print(f"初始乘客数: {db_alarm.passenger_count}, 描述: {db_alarm.description}")
    
    update = schemas.ElevatorAlarmUpdate(
        passenger_count=5,
        description="1号楼5单元D栋电梯停在8楼，5名乘客被困，其中有小孩",
        location="1号楼5单元D栋"
    )
    db_alarm = crud.update_alarm(
        db, alarm_id, update,
        operator="陈值班",
        change_reason="接到乘客第二个电话，补充正确信息"
    )
    print(f"修改后乘客数: {db_alarm.passenger_count}, 位置: {db_alarm.location}")
    
    audit_logs = db.query(models.AuditLog).filter(models.AuditLog.alarm_id == alarm_id).all()
    print(f"修改日志共 {len(audit_logs)} 条:")
    for log in audit_logs:
        print(f"  - {log.field_name}: {log.old_value} → {log.new_value} (原因: {log.change_reason})")
    
    dispatch = schemas.DispatchMaintenance(
        maintenance_person="孙师傅",
        maintenance_phone="13500135001",
        operator="陈值班"
    )
    crud.dispatch_maintenance(db, alarm_id, dispatch)
    
    update2 = schemas.ElevatorAlarmUpdate(
        maintenance_person="周师傅",
        maintenance_phone="13400134001"
    )
    db_alarm = crud.update_alarm(
        db, alarm_id, update2,
        operator="陈值班",
        change_reason="孙师傅临时有事，换周师傅去"
    )
    print(f"重新派单后维保: {db_alarm.maintenance_person}")
    
    audit_logs2 = db.query(models.AuditLog).filter(models.AuditLog.alarm_id == alarm_id).all()
    print(f"修改日志共 {len(audit_logs2)} 条")
    
    arrive = schemas.ArriveOnSite(operator="周师傅")
    crud.arrive_on_site(db, alarm_id, arrive)
    
    resolve = schemas.ResolveAlarm(
        resolution="安全回路断开，复位后恢复。5名乘客安全救出，包括1名5岁小孩",
        operator="周师傅"
    )
    crud.resolve_alarm(db, alarm_id, resolve)
    
    review = schemas.ReviewAlarm(
        is_approved=True,
        reviewer="刘主管",
        comment="处理及时，修改留痕清晰"
    )
    crud.review_alarm(db, alarm_id, review)
    print(f"人工修正流程完成！\n")
    return alarm_id


def create_duplicate_merge_flow(db: Session):
    print("=== 场景5: 重复报警合并（同一电梯多次报警自动合并）===")
    
    alarm1 = schemas.ElevatorAlarmCreate(
        elevator_no="E-02-01",
        alarm_time=datetime.now() - timedelta(minutes=45),
        passenger_count=2,
        source="monitor",
        location="2号楼1单元E栋",
        description="电梯报警",
        created_by="吴值班"
    )
    db_alarm1 = crud.create_alarm(db, alarm1)
    alarm1_id = db_alarm1.id
    print(f"创建报警1: {db_alarm1.alarm_no}, ID={alarm1_id}")
    
    alarm2_data = schemas.ElevatorAlarmCreate(
        elevator_no="E-02-01",
        alarm_time=datetime.now() - timedelta(minutes=40),
        passenger_count=2,
        source="phone",
        location="2号楼1单元",
        description="乘客打电话说被困",
        created_by="吴值班"
    )
    print(f"尝试创建报警2（同一电梯，系统应自动合并）...")
    db_alarm2 = crud.create_alarm(db, alarm2_data)
    print(f"创建后返回的报警: {db_alarm2.alarm_no} (ID={db_alarm2.id})")
    
    db.refresh(db_alarm1)
    print(f"主记录合并次数: {db_alarm1.merge_count}")
    print(f"合并的子记录数: {len(db_alarm1.merged_alarms)}")
    
    alarm3_data = schemas.ElevatorAlarmCreate(
        elevator_no="E-02-01",
        alarm_time=datetime.now() - timedelta(minutes=35),
        passenger_count=2,
        source="phone",
        location="2号楼1单元E栋",
        description="被困者家属来电询问",
        created_by="吴值班"
    )
    db_alarm3 = crud.create_alarm(db, alarm3_data)
    print(f"创建报警3（也会被自动合并），返回: {db_alarm3.alarm_no}")
    
    db.refresh(db_alarm1)
    print(f"主记录合并次数: {db_alarm1.merge_count}")
    
    dispatch = schemas.DispatchMaintenance(
        maintenance_person="郑师傅",
        maintenance_phone="13300133001",
        operator="吴值班"
    )
    crud.dispatch_maintenance(db, alarm1_id, dispatch)
    print("派单给郑师傅（主记录）")
    
    arrive = schemas.ArriveOnSite(operator="郑师傅")
    crud.arrive_on_site(db, alarm1_id, arrive)
    
    resolve = schemas.ResolveAlarm(
        resolution="平层感应器故障，已更换。2名乘客安全救出。",
        operator="郑师傅"
    )
    crud.resolve_alarm(db, alarm1_id, resolve)
    
    review = schemas.ReviewAlarm(
        is_approved=True,
        reviewer="刘主管",
        comment="重复报警合并正确"
    )
    crud.review_alarm(db, alarm1_id, review)
    print(f"重复报警合并流程完成！\n")
    return alarm1_id


def create_timeout_flow(db: Session):
    print("=== 场景6: 超时到场（系统自动标记超时）===")
    
    past_time = datetime.now() - timedelta(minutes=45)
    
    alarm = schemas.ElevatorAlarmCreate(
        elevator_no="F-01-08",
        alarm_time=past_time,
        passenger_count=1,
        source="monitor",
        location="1号楼8单元F栋",
        description="电梯报警",
        created_by="周值班"
    )
    db_alarm = crud.create_alarm(db, alarm)
    alarm_id = db_alarm.id
    print(f"创建报警: {db_alarm.alarm_no}, ID={alarm_id}")
    print(f"报警时间: {past_time.strftime('%H:%M:%S')}")
    
    dispatch = schemas.DispatchMaintenance(
        maintenance_person="冯师傅",
        maintenance_phone="13200132001",
        operator="周值班"
    )
    crud.dispatch_maintenance(db, alarm_id, dispatch)
    print("派单给冯师傅")
    
    import crud as crud_module
    original_timeout = crud_module.TIMEOUT_MINUTES
    crud_module.TIMEOUT_MINUTES = 5
    
    db_alarm = crud.get_alarm(db, alarm_id)
    print(f"检查超时: is_timeout={db_alarm.is_timeout}, reason={db_alarm.timeout_reason}")
    
    crud_module.TIMEOUT_MINUTES = original_timeout
    
    call = schemas.CallRecordCreate(
        call_type="催单",
        caller="冯师傅",
        caller_phone="13200132001",
        call_time=datetime.now(),
        duration=120,
        content="催促冯师傅尽快到场，已超时",
        operator="周值班"
    )
    crud.add_call_record(db, alarm_id, call)
    print("添加催单通话记录")
    
    arrive = schemas.ArriveOnSite(
        operator="冯师傅",
        remark="路上堵车，迟到了"
    )
    crud.arrive_on_site(db, alarm_id, arrive)
    print(f"维保到场，is_timeout仍为: {db_alarm.is_timeout}")
    
    resolve = schemas.ResolveAlarm(
        resolution="接触器粘连，已处理。1名乘客救出。",
        operator="冯师傅"
    )
    crud.resolve_alarm(db, alarm_id, resolve)
    
    review = schemas.ReviewAlarm(
        is_approved=True,
        reviewer="刘主管",
        comment="超时原因记录清楚，需注意维保响应时效"
    )
    crud.review_alarm(db, alarm_id, review)
    print(f"超时流程完成！\n")
    return alarm_id


def main():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("开始创建电梯困人响应系统样例数据")
        print("=" * 60 + "\n")
        
        id1 = create_normal_flow(db)
        id2 = create_conflict_flow(db)
        id3 = create_cancel_flow(db)
        id4 = create_manual_correction_flow(db)
        id5 = create_duplicate_merge_flow(db)
        id6 = create_timeout_flow(db)
        
        print("=" * 60)
        print("所有样例数据创建完成！")
        print(f"正常流程报警ID: {id1}")
        print(f"冲突流程报警ID: {id2}")
        print(f"撤回流程报警ID: {id3}")
        print(f"人工修正流程报警ID: {id4}")
        print(f"重复报警合并ID: {id5}")
        print(f"超时流程报警ID: {id6}")
        print("=" * 60)
        print("\n可通过以下方式查看:")
        print("1. 启动服务: uvicorn main:app --reload")
        print("2. 访问文档: http://localhost:8000/docs")
        print("3. 查看列表: GET /alarms/")
        print("4. 查看详情: GET /alarms/{id}")
        print("5. 导出Excel: GET /export/alarms/")
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
