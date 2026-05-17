#!/usr/bin/env python3
import os
import sys
from datetime import datetime, timedelta
import json


def run_test(name, test_func):
    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print(f"{'='*60}")
    try:
        result = test_func()
        print(f"✓ 测试通过: {name}")
        return True
    except AssertionError as e:
        print(f"✗ 测试失败: {name}")
        print(f"  错误: {e}")
        return False
    except Exception as e:
        print(f"✗ 测试异常: {name}")
        print(f"  异常类型: {type(e).__name__}")
        print(f"  异常信息: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_1_imports():
    """测试模块导入"""
    print("  正在导入数据库模块...")
    import database

    print("  正在导入schemas模块...")
    import schemas

    print("  正在导入services模块...")
    import services

    print("  正在导入exceptions模块...")
    import exceptions

    return True


def test_2_database_operations():
    """测试基础数据库操作"""
    import database
    from sqlalchemy.orm import Session

    print("  初始化数据库...")
    database.init_db()

    print("  创建数据库会话...")
    db = database.SessionLocal()

    try:
        print("  创建测试会员...")
        member = database.Member(
            phone="13800138000",
            name="测试用户",
            member_number="M001",
            membership_level="普通",
            balance=100.0,
            is_active=True
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        assert member.id is not None, "会员创建失败"
        print(f"  创建会员成功: ID={member.id}")

        print("  创建测试工位...")
        station = database.Station(
            name="1号工位",
            station_type="普洗工位",
            is_active=True,
            status="空闲"
        )
        db.add(station)
        db.commit()
        db.refresh(station)
        assert station.id is not None, "工位创建失败"
        print(f"  创建工位成功: ID={station.id}")

        return True
    finally:
        db.close()


def test_3_member_service():
    """测试会员服务"""
    import database
    import schemas
    from services import MemberService

    db = database.SessionLocal()
    try:
        print("  测试创建会员...")
        member_create = schemas.MemberCreate(
            phone="13900139000",
            name="张三",
            membership_level="VIP"
        )
        member = MemberService.create_member(db, member_create)
        assert member.id is not None
        assert member.phone == "13900139000"
        assert member.name == "张三"
        print(f"  会员创建成功: {member.name}")

        print("  测试查询会员...")
        found = MemberService.get_member(db, member.id)
        assert found is not None
        assert found.id == member.id
        print(f"  会员查询成功: {found.name}")

        print("  测试更新会员...")
        update = schemas.MemberUpdate(balance=200.0)
        updated = MemberService.update_member(db, member.id, update)
        assert updated.balance == 200.0
        print(f"  会员更新成功: 余额={updated.balance}")

        return True
    finally:
        db.close()


def test_4_queue_operations():
    """测试排队核心流程"""
    import database
    import schemas
    from services import MemberService, StationService, QueueService

    db = database.SessionLocal()
    today = datetime.now().strftime("%Y-%m-%d")

    try:
        print("  创建测试会员...")
        member = MemberService.create_member(db, schemas.MemberCreate(
            phone="13700137000",
            name="李四"
        ))

        print("  创建测试工位...")
        station = StationService.create_station(db, schemas.StationCreate(
            name="2号工位",
            station_type="精洗工位"
        ))

        print("  测试取号...")
        queue_create = schemas.QueueNumberCreate(
            member_id=member.id,
            service_type="精洗"
        )
        queue = QueueService.create_queue_number(db, queue_create)
        assert queue.id is not None
        assert queue.status == "等待中"
        assert queue.display_number.startswith("A")
        print(f"  取号成功: {queue.display_number}")

        print("  测试查询等待队列...")
        waiting = QueueService.get_waiting_queues(db)
        assert len(waiting) > 0
        print(f"  当前等待队列长度: {len(waiting)}")

        print("  测试叫号...")
        called = QueueService.call_next_queue(db, station.id)
        assert called.status == "已叫号"
        assert called.assigned_station_id == station.id
        print(f"  叫号成功: {called.display_number} -> 工位{station.name}")

        print("  测试开始服务...")
        started = QueueService.start_service(db, called.id)
        assert started.status == "服务中"
        print(f"  开始服务: {started.display_number}")

        print("  测试完成服务...")
        completed = QueueService.complete_service(db, called.id)
        assert completed.status == "已完成"
        print(f"  完成服务: {completed.display_number}")

        station_check = StationService.get_station(db, station.id)
        assert station_check.status == "空闲"
        print(f"  工位已释放: {station_check.status}")

        return True
    finally:
        db.close()


def test_5_duplicate_queue_prevention():
    """测试重复取号拦截"""
    import database
    import schemas
    from services import MemberService, QueueService
    from exceptions import DuplicateOperationException

    db = database.SessionLocal()
    try:
        print("  创建测试会员...")
        member = MemberService.create_member(db, schemas.MemberCreate(
            phone="13600136000",
            name="王五"
        ))

        print("  第一次取号...")
        queue1 = QueueService.create_queue_number(db, schemas.QueueNumberCreate(
            member_id=member.id,
            service_type="普洗"
        ))
        print(f"  第一次取号成功: {queue1.display_number}")

        print("  尝试重复取号...")
        try:
            QueueService.create_queue_number(db, schemas.QueueNumberCreate(
                member_id=member.id,
                service_type="普洗"
            ))
            assert False, "应该抛出重复操作异常"
        except DuplicateOperationException as e:
            print(f"  重复取号已被正确拦截")

        return True
    finally:
        db.close()


def test_6_pass_and_requeue():
    """测试过号补排"""
    import database
    import schemas
    from services import MemberService, StationService, QueueService

    db = database.SessionLocal()
    try:
        print("  创建测试会员...")
        member = MemberService.create_member(db, schemas.MemberCreate(
            phone="13500135000",
            name="赵六"
        ))

        print("  创建测试工位...")
        station = StationService.create_station(db, schemas.StationCreate(
            name="3号工位",
            station_type="普洗工位"
        ))

        print("  取号并叫号...")
        queue = QueueService.create_queue_number(db, schemas.QueueNumberCreate(
            member_id=member.id,
            service_type="普洗"
        ))
        called = QueueService.call_next_queue(db, station.id)
        print(f"  叫号成功: {called.display_number}")

        print("  标记过号...")
        passed_record = QueueService.mark_as_passed(
            db,
            called.id,
            reason="客户未到",
            operator="前台小张"
        )
        assert passed_record.id is not None
        print(f"  过号记录创建成功: ID={passed_record.id}")

        queue_check = QueueService.get_queue_number(db, called.id)
        assert queue_check.status == "过号"
        print(f"  排队状态已更新为: {queue_check.status}")

        station_check = StationService.get_station(db, station.id)
        assert station_check.status == "空闲"
        print(f"  工位已释放: {station_check.status}")

        print("  过号重新排队...")
        requeued = QueueService.requeue_passed(db, passed_record.id)
        assert requeued.id is not None
        assert requeued.status == "等待中"
        assert requeued.priority > 0
        print(f"  重新排队成功: {requeued.display_number}, 优先级: {requeued.priority}")

        return True
    finally:
        db.close()


def test_7_appointment_booking():
    """测试预约锁位"""
    import database
    import schemas
    from services import MemberService, AppointmentService

    db = database.SessionLocal()
    try:
        print("  创建测试会员...")
        member = MemberService.create_member(db, schemas.MemberCreate(
            phone="13400134000",
            name="钱七"
        ))

        print("  创建预约...")
        appointment_time = datetime.now() + timedelta(hours=2)
        appointment_create = schemas.AppointmentCreate(
            member_id=member.id,
            appointment_time=appointment_time,
            service_type="精洗",
            notes="需要车内清洁"
        )
        appointment = AppointmentService.create_appointment(db, appointment_create)
        assert appointment.id is not None
        print(f"  预约创建成功: ID={appointment.id}, 状态={appointment.status}")

        print("  查询预约...")
        found = AppointmentService.get_appointment(db, appointment.id)
        assert found is not None
        print(f"  预约查询成功: {found.service_type}")

        print("  取消预约...")
        cancelled = AppointmentService.cancel_appointment(db, appointment.id)
        assert cancelled.status == "已取消"
        print(f"  预约已取消: {cancelled.status}")

        return True
    finally:
        db.close()


def test_8_status_validation():
    """测试状态校验"""
    import database
    import schemas
    from services import MemberService, StationService, QueueService
    from exceptions import InvalidStatusException, AlreadyProcessedException

    db = database.SessionLocal()
    try:
        print("  创建测试数据...")
        member = MemberService.create_member(db, schemas.MemberCreate(
            phone="13300133000",
            name="孙八"
        ))
        station = StationService.create_station(db, schemas.StationCreate(
            name="4号工位",
            station_type="普洗工位"
        ))

        print("  测试: 不能直接完成未叫号的排队...")
        queue = QueueService.create_queue_number(db, schemas.QueueNumberCreate(
            member_id=member.id,
            service_type="普洗"
        ))
        try:
            QueueService.complete_service(db, queue.id)
            assert False, "应该抛出状态异常"
        except InvalidStatusException:
            print("  ✓ 状态校验正确: 不能直接完成等待中的排队")

        print("  测试: 不能在等待状态标记过号...")
        try:
            QueueService.mark_as_passed(db, queue.id)
            assert False, "应该抛出状态异常"
        except InvalidStatusException:
            print("  ✓ 状态校验正确: 不能在等待状态标记过号")

        print("  正常叫号并完成...")
        called_queue = QueueService.call_next_queue(db, station.id)
        QueueService.start_service(db, called_queue.id)
        QueueService.complete_service(db, called_queue.id)
        queue = called_queue

        print("  测试: 不能重复完成已完成的服务...")
        try:
            QueueService.complete_service(db, queue.id)
            assert False, "应该抛出已处理异常"
        except AlreadyProcessedException:
            print("  ✓ 状态校验正确: 不能重复完成已完成的服务")

        return True
    finally:
        db.close()


def test_9_report_generation():
    """测试报表生成"""
    import database
    import schemas
    from services import MemberService, StationService, QueueService, ReportService
    from services import get_today_str

    db = database.SessionLocal()
    today = get_today_str()

    try:
        print("  创建测试排队数据...")
        member = MemberService.create_member(db, schemas.MemberCreate(
            phone="13200132000",
            name="周九"
        ))
        station = StationService.create_station(db, schemas.StationCreate(
            name="5号工位",
            station_type="普洗工位"
        ))

        for i in range(3):
            m = MemberService.create_member(db, schemas.MemberCreate(
                phone=f"131001310{i:02d}",
                name=f"测试用户{i}"
            ))
            QueueService.create_queue_number(db, schemas.QueueNumberCreate(
                member_id=m.id,
                service_type="普洗"
            ))
            called = QueueService.call_next_queue(db, station.id)
            QueueService.start_service(db, called.id)
            QueueService.complete_service(db, called.id)

        print("  生成日报表...")
        report = ReportService.generate_daily_report(db, today)
        assert report.id is not None
        assert report.total_queues >= 3
        assert report.total_completed >= 3
        print(f"  报表生成成功: 总排队={report.total_queues}, 已完成={report.total_completed}")
        print(f"  平均等待时间: {report.avg_wait_time}分钟")
        print(f"  平均服务时间: {report.avg_service_time}分钟")
        print(f"  高峰时段: {report.peak_hour}")

        return True
    finally:
        db.close()


def test_10_excel_export():
    """测试Excel导出"""
    import database
    from services import ReportService
    from services import get_today_str
    import os

    db = database.SessionLocal()
    today = get_today_str()
    export_path = os.path.join(os.getcwd(), "test_export.xlsx")

    try:
        print("  导出Excel报表...")
        ReportService.export_to_excel(db, today, today, export_path)

        assert os.path.exists(export_path), "导出文件不存在"
        file_size = os.path.getsize(export_path)
        assert file_size > 0, "导出文件为空"
        print(f"  Excel导出成功: {export_path} ({file_size} bytes)")

        return True
    finally:
        db.close()
        if os.path.exists(export_path):
            os.remove(export_path)
            print("  测试文件已清理")


def main():
    print("\n" + "="*70)
    print("洗车排队工位分配系统 - 自检脚本")
    print("="*70)

    if os.path.exists("car_wash.db"):
        os.remove("car_wash.db")
        print("已清理旧的测试数据库")

    tests = [
        ("模块导入测试", test_1_imports),
        ("基础数据库操作", test_2_database_operations),
        ("会员服务测试", test_3_member_service),
        ("排队核心流程", test_4_queue_operations),
        ("重复取号拦截", test_5_duplicate_queue_prevention),
        ("过号补排功能", test_6_pass_and_requeue),
        ("预约锁位功能", test_7_appointment_booking),
        ("状态校验机制", test_8_status_validation),
        ("报表生成功能", test_9_report_generation),
        ("Excel导出功能", test_10_excel_export),
    ]

    results = []
    for name, test_func in tests:
        result = run_test(name, test_func)
        results.append((name, result))

    print("\n" + "="*70)
    print("测试结果汇总")
    print("="*70)

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {status}: {name}")

    print(f"\n总计: {passed}/{total} 测试通过")

    if passed == total:
        print("\n🎉 所有测试通过！系统功能正常！")
        return 0
    else:
        print(f"\n⚠️ 有 {total - passed} 个测试失败，请检查相关功能。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
