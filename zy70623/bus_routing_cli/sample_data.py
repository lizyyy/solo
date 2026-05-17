from datetime import datetime, date, timedelta

from .models import (
    BusStop, Student, BusRoute, ReroutePlan, ParentConfirmation,
    RecoveryCheck, RerouteReason, ConfirmationStatus, RecoveryStatus,
    ConfirmationChannel
)


def generate_sample_data(cli, sample_type: str):
    """生成样例数据"""
    
    route = BusRoute(
        route_id="R001",
        route_number="1号线",
        name="阳光小学-东区"
    )
    cli.storage.save_route(route)
    
    stop1 = BusStop(
        stop_id="S001",
        name="东门站",
        address="阳光路1号"
    )
    stop2 = BusStop(
        stop_id="S002",
        name="南门站",
        address="阳光路2号"
    )
    cli.storage.save_stop(stop1)
    cli.storage.save_stop(stop2)
    
    students = []
    for i in range(1, 6):
        student = Student(
            student_id=f"STU00{i}",
            name=f"学生{i}",
            grade="3",
            class_name=f"班{i}",
            primary_contact=f"家长{i}",
            phone_number=f"1380000000{i}",
            default_stop_id="S001"
        )
        students.append(student)
        cli.storage.save_student(student)
    
    reroute = ReroutePlan(
        reroute_id="RR001",
        route_id="R001",
        reason=RerouteReason.ROAD_CONSTRUCTION,
        reason_detail="阳光路修路，预计工期3天",
        effective_date=date.today()
    )
    
    temp_stop = BusStop(
        stop_id="TEMP001",
        name="临时停靠站",
        address="辅路临时站点",
        is_temporary=True
    )
    reroute.original_stop_replacements["S001"] = temp_stop
    
    cli.storage.save_reroute(reroute)
    
    if sample_type == "empty":
        return
    
    base_time = datetime.now() - timedelta(hours=5)
    
    if sample_type == "normal":
        _generate_normal_data(cli, reroute, students, base_time)
    elif sample_type == "dirty":
        _generate_dirty_data(cli, reroute, students, base_time)
    elif sample_type == "conflict":
        _generate_conflict_data(cli, reroute, students, base_time)


def _generate_normal_data(cli, reroute, students, base_time):
    """生成正常样例数据"""
    
    for i, student in enumerate(students[:4]):
        conf = ParentConfirmation(
            confirmation_id=f"CONF00{i+1}",
            student_id=student.student_id,
            reroute_id=reroute.reroute_id,
            status=ConfirmationStatus.CONFIRMED,
            channel=ConfirmationChannel.WECHAT_GROUP,
            confirmed_at=base_time + timedelta(minutes=i*10),
            parent_name=f"{student.primary_contact}",
            notes=f"已知晓改线安排，准时接送",
            original_stop_id="S001"
        )
        cli.storage.save_confirmation(conf)
    
    conf5 = ParentConfirmation(
        confirmation_id="CONF005",
        student_id=students[4].student_id,
        reroute_id=reroute.reroute_id,
        status=ConfirmationStatus.PENDING,
        channel=ConfirmationChannel.WECHAT_GROUP,
        parent_name=f"{students[4].primary_contact}",
        original_stop_id="S001"
    )
    cli.storage.save_confirmation(conf5)
    
    check = RecoveryCheck(
        check_id="CHECK001",
        reroute_id=reroute.reroute_id,
        status=RecoveryStatus.IN_PROGRESS,
        checked_at=datetime.now(),
        checked_by="张老师"
    )
    cli.storage.save_recovery_check(check)


def _generate_dirty_data(cli, reroute, students, base_time):
    """生成脏数据样例"""
    
    conf1 = ParentConfirmation(
        confirmation_id="CONF001",
        student_id=students[0].student_id,
        reroute_id=reroute.reroute_id,
        status=ConfirmationStatus.CONFIRMED,
        channel=ConfirmationChannel.WECHAT_GROUP,
        confirmed_at=base_time,
        parent_name="",
        original_stop_id="S001"
    )
    cli.storage.save_confirmation(conf1)
    
    conf2 = ParentConfirmation(
        confirmation_id="CONF002",
        student_id="",
        reroute_id=reroute.reroute_id,
        status=ConfirmationStatus.CONFIRMED,
        channel=ConfirmationChannel.WECHAT_GROUP,
        confirmed_at=base_time + timedelta(minutes=10),
        parent_name="家长2",
        original_stop_id="S001"
    )
    cli.storage.save_confirmation(conf2)
    
    conf3 = ParentConfirmation(
        confirmation_id="CONF003",
        student_id=students[2].student_id,
        reroute_id=reroute.reroute_id,
        status=ConfirmationStatus.CONFIRMED,
        channel=ConfirmationChannel.WECHAT_GROUP,
        confirmed_at=None,
        parent_name="家长3",
        original_stop_id="INVALID_STOP"
    )
    cli.storage.save_confirmation(conf3)
    
    conf4 = ParentConfirmation(
        confirmation_id="CONF004",
        student_id=students[3].student_id,
        reroute_id="INVALID_REROUTE",
        status=ConfirmationStatus.PENDING,
        channel=ConfirmationChannel.WECHAT_GROUP,
        parent_name="家长4"
    )
    cli.storage.save_confirmation(conf4)


def _generate_conflict_data(cli, reroute, students, base_time):
    """生成边界冲突样例"""
    
    for i in range(3):
        conf = ParentConfirmation(
            confirmation_id=f"CONF00{i+1}",
            student_id=students[0].student_id,
            reroute_id=reroute.reroute_id,
            status=ConfirmationStatus.CONFIRMED,
            channel=ConfirmationChannel.WECHAT_GROUP,
            confirmed_at=base_time + timedelta(minutes=i*5),
            parent_name=f"家长1-重复{i+1}",
            notes=f"第{i+1}次回复",
            original_stop_id="S001"
        )
        cli.storage.save_confirmation(conf)
    
    conf4 = ParentConfirmation(
        confirmation_id="CONF004",
        student_id=students[1].student_id,
        reroute_id=reroute.reroute_id,
        status=ConfirmationStatus.CONFIRMED,
        channel=ConfirmationChannel.WECHAT_GROUP,
        confirmed_at=base_time,
        parent_name="家长2-已确认",
        original_stop_id="S001"
    )
    cli.storage.save_confirmation(conf4)
    
    conf5 = ParentConfirmation(
        confirmation_id="CONF005",
        student_id=students[1].student_id,
        reroute_id=reroute.reroute_id,
        status=ConfirmationStatus.REJECTED,
        channel=ConfirmationChannel.PHONE,
        confirmed_at=base_time + timedelta(minutes=30),
        parent_name="家长2-已拒绝",
        notes="不同意改线，自行接送",
        original_stop_id="S001"
    )
    cli.storage.save_confirmation(conf5)
    
    conf6 = ParentConfirmation(
        confirmation_id="CONF006",
        student_id=students[2].student_id,
        reroute_id=reroute.reroute_id,
        status=ConfirmationStatus.CONFIRMED,
        channel=ConfirmationChannel.WECHAT_GROUP,
        confirmed_at=base_time - timedelta(hours=2),
        parent_name="家长3-较早确认",
        is_late=False,
        original_stop_id="S001"
    )
    cli.storage.save_confirmation(conf6)
