#!/usr/bin/env python3
"""专门测试改约时段重叠的修复验证"""
import os
import sys
import shutil
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from nursing_home_visit_cli.models import (
    Elder, Visitor, Room, AppointmentStatus
)
from nursing_home_visit_cli.services import StorageService, AppointmentService


class TestRescheduleFix:
    def __init__(self):
        self.data_dir = "test_reschedule_data"
        self._cleanup()
        os.makedirs(self.data_dir, exist_ok=True)

        self.storage = StorageService(self.data_dir)
        self.appointment_service = AppointmentService(self.storage)
        self._init_data()

    def _cleanup(self):
        if os.path.exists(self.data_dir):
            shutil.rmtree(self.data_dir)

    def _init_data(self):
        """初始化测试数据"""
        self.storage.add_elder(Elder(id='E001', name='张三', id_card='123',
                                       room_number='101', bed_number='A', health_status='良好'))
        self.storage.add_visitor(Visitor(id='V001', name='张明', id_card='456',
                                          phone='13800138001', relation='儿子'))
        self.storage.add_room(Room(id='R001', room_number='101', capacity=2, floor='1楼', area='A区'))

    def test_self_overlap_reschedule(self):
        """测试：改约时段与自己原时段重叠，应该允许通过"""
        print("\n" + "=" * 60)
        print("  测试: 改约时段与自己原时段重叠 (核心修复验证)")
        print("=" * 60)

        tomorrow = datetime.now() + timedelta(days=1)
        old_start = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
        old_end = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
        new_start = tomorrow.replace(hour=9, minute=30, second=0, microsecond=0)
        new_end = tomorrow.replace(hour=10, minute=30, second=0, microsecond=0)

        print(f"\n  1. 创建预约: {old_start.strftime('%H:%M')} - {old_end.strftime('%H:%M')}")
        apt, results = self.appointment_service.create_appointment(
            elder_id='E001',
            visitor_ids=['V001'],
            room_number='101',
            scheduled_start=old_start,
            scheduled_end=old_end,
            operator='护士A'
        )
        print(f"     ✅ 创建成功，预约ID: {apt.id}")

        print(f"\n  2. 确认预约")
        apt_confirmed, result = self.appointment_service.update_status(
            apt.id, AppointmentStatus.CONFIRMED, '护士A'
        )
        print(f"     ✅ 确认成功，当前状态: {apt_confirmed.status.value}")

        print(f"\n  3. 改约到重叠时段: {new_start.strftime('%H:%M')} - {new_end.strftime('%H:%M')}")
        print(f"     ⚠️  新时段与原时段重叠30分钟，修复前会被自己阻塞")

        apt_rescheduled, results = self.appointment_service.reschedule(
            apt.id, new_start, new_end, '护士A', '家属临时改时间'
        )

        for r in results:
            status = "✅" if r.is_valid else "❌"
            print(f"     {status} {r.message} (错误码: {r.error_code or '无'})")

        if apt_rescheduled:
            print(f"\n     ✅ 改约成功! 新时间: {apt_rescheduled.scheduled_start.strftime('%H:%M')} - {apt_rescheduled.scheduled_end.strftime('%H:%M')}")
            print(f"     ✅ 状态: {apt_rescheduled.status.value}")
            print("\n  🎉 核心修复验证通过：改约时不会被自己的旧时段阻塞!")
            return True
        else:
            print("\n  ❌ 改约失败，修复可能未生效!")
            return False

    def test_other_overlap_still_rejected(self):
        """测试：与其他预约重叠仍应被拒绝"""
        print("\n" + "=" * 60)
        print("  测试: 与其他预约重叠仍应被拒绝 (反向验证)")
        print("=" * 60)

        tomorrow = datetime.now() + timedelta(days=1)
        start1 = tomorrow.replace(hour=9, minute=0)
        end1 = tomorrow.replace(hour=10, minute=0)
        start2 = tomorrow.replace(hour=9, minute=30)
        end2 = tomorrow.replace(hour=10, minute=30)

        print(f"\n  1. 创建预约1: V001探访E001")
        apt1, _ = self.appointment_service.create_appointment(
            'E001', ['V001'], '101', start1, end1, '护士A'
        )
        self.appointment_service.update_status(apt1.id, AppointmentStatus.CONFIRMED, '护士A')
        print(f"     ✅ 预约1创建成功: {apt1.id}")

        print(f"\n  2. 创建预约2: V001探访E001 (不同时间)")
        apt2, _ = self.appointment_service.create_appointment(
            'E001', ['V001'], '101',
            start1 + timedelta(hours=2),
            end1 + timedelta(hours=2),
            '护士A'
        )
        self.appointment_service.update_status(apt2.id, AppointmentStatus.CONFIRMED, '护士A')
        print(f"     ✅ 预约2创建成功: {apt2.id}")

        print(f"\n  3. 尝试将预约2改约到与预约1重叠的时间")
        apt_rescheduled, results = self.appointment_service.reschedule(
            apt2.id, start2, end2, '护士A', '测试重叠'
        )

        duplicate_found = any(r.error_code == 'DUPLICATE_APPOINTMENT' for r in results)

        if duplicate_found:
            print(f"\n     ✅ 正确拒绝: 与其他探访人预约重叠被拦截")
            for r in results:
                if not r.is_valid:
                    print(f"     ❌ {r.message}")
            print("\n  🎉 反向验证通过: 与他人重叠仍正常拒绝!")
            return True
        else:
            print("\n  ❌ 未拦截到与他人的重叠，可能存在过宽放行问题!")
            return False

    def run_all_tests(self):
        print("🚀 开始改约修复专项验证测试")
        passed = 0
        failed = 0

        if self.test_self_overlap_reschedule():
            passed += 1
        else:
            failed += 1

        if self.test_other_overlap_still_rejected():
            passed += 1
        else:
            failed += 1

        print("\n" + "=" * 60)
        print("  专项测试总结")
        print("=" * 60)
        print(f"  ✅ 通过: {passed}")
        print(f"  ❌ 失败: {failed}")
        print(f"  📊 总计: {passed + failed}")
        print("=" * 60)

        self._cleanup()
        return failed == 0


if __name__ == '__main__':
    tester = TestRescheduleFix()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
