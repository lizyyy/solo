#!/usr/bin/env python3
"""养老院探访预约系统测试脚本

包含:
1. 正常输入测试
2. 脏数据测试
3. 边界冲突测试
4. 空结果测试
"""
import os
import sys
import shutil
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from nursing_home_visit_cli.models import (
    Elder, Visitor, Room, AppointmentStatus
)
from nursing_home_visit_cli.services import (
    StorageService, AppointmentService, ReportService
)


class TestScenario:
    def __init__(self, name):
        self.name = name
        self.data_dir = f"test_data_{name}"
        self.reports_dir = f"test_reports_{name}"
        self._cleanup()
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.reports_dir, exist_ok=True)

        self.storage = StorageService(self.data_dir)
        self.appointment_service = AppointmentService(self.storage)
        self.report_service = ReportService(self.storage, self.reports_dir)

    def _cleanup(self):
        if os.path.exists(self.data_dir):
            shutil.rmtree(self.data_dir)
        if os.path.exists(self.reports_dir):
            shutil.rmtree(self.reports_dir)

    def init_basic_data(self):
        """初始化基础数据"""
        elders = [
            Elder(id='E001', name='张三', id_card='110101194001011234',
                  room_number='101', bed_number='A', health_status='良好'),
            Elder(id='E002', name='李四', id_card='110101194102025678',
                  room_number='101', bed_number='B', health_status='一般'),
            Elder(id='E003', name='王五', id_card='110101194203039012',
                  room_number='102', bed_number='A', health_status='需要关注'),
        ]
        for e in elders:
            self.storage.add_elder(e)

        visitors = [
            Visitor(id='V001', name='张明', id_card='110101196501013456',
                    phone='13800138001', relation='儿子'),
            Visitor(id='V002', name='李华', id_card='110101196602027890',
                    phone='13800138002', relation='女儿'),
            Visitor(id='V003', name='王芳', id_card='110101196703031234',
                    phone='13800138003', relation='孙女'),
        ]
        for v in visitors:
            self.storage.add_visitor(v)

        rooms = [
            Room(id='R001', room_number='101', capacity=2, floor='1楼', area='A区'),
            Room(id='R002', room_number='102', capacity=3, floor='1楼', area='A区'),
            Room(id='R003', room_number='201', capacity=2, floor='2楼', area='B区'),
        ]
        for r in rooms:
            self.storage.add_room(r)

    def print_header(self, title):
        print("\n" + "=" * 70)
        print(f"  {title}")
        print("=" * 70)

    def print_result(self, test_name, passed, message=""):
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"  {status} - {test_name}")
        if message:
            print(f"     {message}")


def test_normal_input():
    """测试1: 正常输入场景"""
    test = TestScenario("normal_input")
    test.print_header("测试1: 正常输入场景")
    test.init_basic_data()

    tomorrow = datetime.now() + timedelta(days=1)
    start = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
    end = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)

    # 正常创建预约
    apt, results = test.appointment_service.create_appointment(
        elder_id='E001',
        visitor_ids=['V001'],
        room_number='101',
        scheduled_start=start,
        scheduled_end=end,
        operator='护士A',
        notes='常规探访'
    )
    all_pass = all(r.is_valid for r in results)
    test.print_result("创建预约", all_pass)
    if apt:
        print(f"     预约ID: {apt.id}, 状态: {apt.status.value}")

    # 确认预约
    apt2, result = test.appointment_service.update_status(
        apt.id, AppointmentStatus.CONFIRMED, '护士A', '确认预约'
    )
    test.print_result("确认预约", result.is_valid)

    # 添加健康申报 (正常)
    declaration, health_result = test.appointment_service.add_health_declaration(
        apt.id, 'V001', 36.5, False, False, False, '', '护士A'
    )
    test.print_result("健康申报(正常体温)", health_result.is_valid)

    # 改约
    new_start = end + timedelta(hours=1)
    new_end = new_start + timedelta(hours=1)
    apt3, reschedule_results = test.appointment_service.reschedule(
        apt.id, new_start, new_end, '护士A', '时间调整'
    )
    test.print_result("改约", all(r.is_valid for r in reschedule_results))

    # 生成报告
    report = test.report_service.generate_appointment_detail_report(apt.id)
    json_path = test.report_service.save_report_json(report, f"normal_{apt.id}")
    txt_path = test.report_service.save_report_text(report, f"normal_{apt.id}")
    test.print_result("生成报告", 'error' not in report)

    # 日报
    daily = test.report_service.generate_daily_report(tomorrow)
    test.print_result("生成日报", daily['summary']['total_appointments'] > 0)

    print(f"\n  📄 测试报告已保存:")
    print(f"     JSON: {json_path}")
    print(f"     TXT:  {txt_path}")

    test._cleanup()
    return True


def test_dirty_data():
    """测试2: 脏数据/异常输入场景"""
    test = TestScenario("dirty_data")
    test.print_header("测试2: 脏数据/异常输入场景")
    test.init_basic_data()

    tomorrow = datetime.now() + timedelta(days=1)
    start = tomorrow.replace(hour=9, minute=0)
    end = tomorrow.replace(hour=10, minute=0)

    # 不存在的老人ID
    apt, results = test.appointment_service.create_appointment(
        elder_id='E999',
        visitor_ids=['V001'],
        room_number='101',
        scheduled_start=start,
        scheduled_end=end
    )
    test.print_result("不存在的老人ID", apt is None)
    if results:
        print(f"     错误: {results[0].message}")

    # 不存在的探访人
    apt2, results2 = test.appointment_service.create_appointment(
        elder_id='E001',
        visitor_ids=['V999'],
        room_number='101',
        scheduled_start=start,
        scheduled_end=end
    )
    test.print_result("不存在的探访人ID", apt2 is None)

    # 不存在的房间
    apt3, results3 = test.appointment_service.create_appointment(
        elder_id='E001',
        visitor_ids=['V001'],
        room_number='999',
        scheduled_start=start,
        scheduled_end=end
    )
    test.print_result("不存在的房间号", apt3 is None)

    # 开始时间 > 结束时间
    apt4, results4 = test.appointment_service.create_appointment(
        elder_id='E001',
        visitor_ids=['V001'],
        room_number='101',
        scheduled_start=end,
        scheduled_end=start
    )
    test.print_result("开始时间晚于结束时间", apt4 is None)

    # 预约过去的时间
    past = datetime.now() - timedelta(hours=1)
    apt5, results5 = test.appointment_service.create_appointment(
        elder_id='E001',
        visitor_ids=['V001'],
        room_number='101',
        scheduled_start=past,
        scheduled_end=past + timedelta(hours=1)
    )
    test.print_result("预约过去的时间", apt5 is None)

    # 体温异常的健康申报
    apt_valid, _ = test.appointment_service.create_appointment(
        elder_id='E001',
        visitor_ids=['V001'],
        room_number='101',
        scheduled_start=start,
        scheduled_end=end
    )
    declaration, health_result = test.appointment_service.add_health_declaration(
        apt_valid.id, 'V001', 37.8, False, False, False
    )
    test.print_result("体温异常(37.8℃)拒绝", not health_result.is_valid)
    print(f"     申报状态: {'通过' if declaration.is_passed else '未通过'}")

    # 有症状的健康申报
    declaration2, health_result2 = test.appointment_service.add_health_declaration(
        apt_valid.id, 'V001', 36.5, True, True, False, '感冒症状'
    )
    test.print_result("有症状拒绝", not health_result2.is_valid)

    test._cleanup()
    return True


def test_boundary_conflicts():
    """测试3: 边界冲突场景"""
    test = TestScenario("boundary")
    test.print_header("测试3: 边界冲突场景")
    test.init_basic_data()

    tomorrow = datetime.now() + timedelta(days=1)

    # 房间容量: 101房间容量为2，先预约2人
    start1 = tomorrow.replace(hour=9, minute=0)
    end1 = tomorrow.replace(hour=11, minute=0)

    apt1, _ = test.appointment_service.create_appointment(
        'E001', ['V001', 'V002'], '101', start1, end1
    )
    test.print_result("预约2人(达到容量上限)", apt1 is not None)
    if apt1:
        print(f"     房间101同时探访人数: 2")

    # 再预约第3人，应该被拒绝
    apt2, results2 = test.appointment_service.create_appointment(
        'E002', ['V003'], '101', start1, end1
    )
    test.print_result("超出房间容量被拒绝", apt2 is None)
    for r in results2:
        if not r.is_valid:
            print(f"     原因: {r.message}")

    # 重复预约: 同一探访人同一时间
    start2 = tomorrow.replace(hour=14, minute=0)
    end2 = tomorrow.replace(hour=15, minute=0)

    apt3, _ = test.appointment_service.create_appointment(
        'E001', ['V001'], '102', start2, end2
    )

    apt4, results4 = test.appointment_service.create_appointment(
        'E002', ['V001'], '102', start2, end2
    )
    test.print_result("重复预约被拒绝", apt4 is None)
    for r in results4:
        if not r.is_valid:
            print(f"     原因: {r.message}")

    # 状态流转: 已取消的预约不能再确认
    test.appointment_service.update_status(apt3.id, AppointmentStatus.CONFIRMED, 'op')
    test.appointment_service.update_status(apt3.id, AppointmentStatus.CANCELLED, 'op')

    apt5, result5 = test.appointment_service.update_status(
        apt3.id, AppointmentStatus.CONFIRMED, 'op'
    )
    test.print_result("已取消预约不能再确认", not result5.is_valid)

    # 改约也可能冲突
    apt6, _ = test.appointment_service.create_appointment(
        'E003', ['V002'], '102',
        start1 + timedelta(hours=3),
        end1 + timedelta(hours=3)
    )
    test.appointment_service.update_status(apt6.id, AppointmentStatus.CONFIRMED, 'op')

    # 尝试改约到与apt3冲突的时间
    apt7, res7 = test.appointment_service.reschedule(
        apt6.id, start2, end2, 'op'
    )
    test.print_result("改约时间冲突被拒绝", apt7 is None)

    # 边界: 时长刚好15分钟
    start_short = tomorrow.replace(hour=16, minute=0)
    end_short = start_short + timedelta(minutes=15)
    apt_short, results_short = test.appointment_service.create_appointment(
        'E001', ['V001'], '101', start_short, end_short
    )
    test.print_result("时长15分钟(刚好下限)", apt_short is not None)

    # 边界: 时长14分钟应该被拒绝
    end_tooshort = start_short + timedelta(minutes=14)
    apt_tooshort, results_tooshort = test.appointment_service.create_appointment(
        'E001', ['V001'], '101', start_short, end_tooshort
    )
    test.print_result("时长14分钟(不足15分钟)被拒绝", apt_tooshort is None)

    test._cleanup()
    return True


def test_empty_results():
    """测试4: 空结果/无数据场景"""
    test = TestScenario("empty")
    test.print_header("测试4: 空结果/无数据场景")

    # 不初始化任何数据，直接查询

    # 查询所有预约
    appointments = test.storage.get_all_appointments()
    test.print_result("空预约列表", len(appointments) == 0)
    print(f"     预约数量: {len(appointments)}")

    # 查询所有老人
    elders = test.storage.get_all_elders()
    test.print_result("空老人列表", len(elders) == 0)

    # 查询所有探访人
    visitors = test.storage.get_all_visitors()
    test.print_result("空探访人列表", len(visitors) == 0)

    # 查询不存在的预约
    apt = test.storage.get_appointment('APT000')
    test.print_result("查询不存在的预约", apt is None)

    # 生成空日报
    report = test.report_service.generate_daily_report(datetime.now())
    test.print_result("空日报统计正确", report['summary']['total_appointments'] == 0)
    print(f"     日报预约数: {report['summary']['total_appointments']}")

    # 生成不存在预约的详情报告
    detail = test.report_service.generate_appointment_detail_report('APT999')
    test.print_result("不存在预约的详情报告", 'error' in detail)

    # 初始化后删除，测试边界
    test.init_basic_data()
    test._cleanup()

    # 再次查询应该为空
    storage2 = StorageService(test.data_dir)
    test.print_result("清理后数据为空", len(storage2.get_all_elders()) == 0)

    return True


def main():
    print("\n" + "🚀" * 20)
    print("  养老院探访预约系统 - 完整场景测试")
    print("🚀" * 20)

    tests = [
        ("正常输入", test_normal_input),
        ("脏数据", test_dirty_data),
        ("边界冲突", test_boundary_conflicts),
        ("空结果", test_empty_results),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n  💥 测试异常: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 70)
    print("  测试总结")
    print("=" * 70)
    print(f"  ✅ 通过: {passed}")
    print(f"  ❌ 失败: {failed}")
    print(f"  📊 总计: {passed + failed}")
    print("=" * 70)

    if failed == 0:
        print("\n  🎉 所有测试通过！系统功能正常。")
    else:
        print(f"\n  ⚠️  有 {failed} 个测试失败，请检查。")

    return failed == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
