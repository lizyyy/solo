#!/usr/bin/env python3
"""
社区疫苗预约候补系统测试脚本
"""

import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vaccine_waitlist.models import (
    Person, VaccineBatch, Appointment, WaitingListEntry,
    AppointmentStatus, WaitingListStatus
)
from vaccine_waitlist.data_io import DataStore
from vaccine_waitlist.engine import WaitingListEngine


def test_case_1_children_vaccine():
    """测试1: 儿童疫苗 - 年龄符合条件"""
    print("\n" + "="*60)
    print("测试1: 儿童疫苗 - 年龄符合条件")
    print("="*60)

    store = DataStore()

    store.persons['P1'] = Person(
        id='P1', name='小明', id_card='110101201001011234',
        birth_date=date(2010, 1, 1),
        gender='男', phone='13800138001'
    )

    store.persons['P2'] = Person(
        id='P2', name='小红', id_card='110101201506152345',
        birth_date=date(2015, 6, 15),
        gender='女', phone='13800138002'
    )

    store.vaccine_batches['B1'] = VaccineBatch(
        id='B1', vaccine_name='麻腮风疫苗', vaccine_type='儿童疫苗',
        min_age_months=96,
        max_age_months=144,
        total_doses=2,
        intervals_days=[365],
        available_slots=0
    )

    store.appointments['A1'] = Appointment(
        id='A1', person_id='P1', vaccine_batch_id='B1',
        dose_number=1, appointment_date=date.today(),
        status=AppointmentStatus.BOOKED
    )

    store.waiting_list['W1'] = WaitingListEntry(
        id='W1', person_id='P2', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=1,
        created_at=date.today()
    )

    engine = WaitingListEngine(store)

    print(f"小明年龄: {store.persons['P1'].age}岁 ({store.persons['P1'].age * 12}个月)")
    print(f"小红年龄: {store.persons['P2'].age}岁 ({store.persons['P2'].age * 12}个月)")
    print(f"疫苗要求: {store.vaccine_batches['B1'].min_age_months}-{store.vaccine_batches['B1'].max_age_months}个月")

    result = engine.process_cancellation('A1', 'CANCEL-001')

    print(f"\n取消结果: {result['success']}")
    print(f"释放名额: {result['available_slots']}")

    if result['promoted']:
        print(f"转正成功: {result['promoted'][0]['entry_id']}")
    else:
        print(f"拒绝原因: {result['rejected']}")

    assert result['success'], "取消应该成功"
    assert len(result['promoted']) == 1, "小红应该转正成功"

    print("✓ 测试1通过")
    return True


def test_case_2_age_not_qualified():
    """测试2: 年龄不符合条件"""
    print("\n" + "="*60)
    print("测试2: 年龄不符合条件")
    print("="*60)

    store = DataStore()

    store.persons['P1'] = Person(
        id='P1', name='成年人', id_card='110101198001011234',
        birth_date=date(1980, 1, 1),
        gender='男', phone='13800138001'
    )

    store.persons['P2'] = Person(
        id='P2', name='小宝宝', id_card='110101202412012345',
        birth_date=date(2024, 12, 1),
        gender='女', phone='13800138002'
    )

    store.vaccine_batches['B1'] = VaccineBatch(
        id='B1', vaccine_name='麻腮风疫苗', vaccine_type='儿童疫苗',
        min_age_months=96,
        max_age_months=144,
        total_doses=2,
        intervals_days=[365],
        available_slots=0
    )

    store.appointments['A1'] = Appointment(
        id='A1', person_id='P1', vaccine_batch_id='B1',
        dose_number=1, appointment_date=date.today(),
        status=AppointmentStatus.BOOKED
    )

    store.waiting_list['W1'] = WaitingListEntry(
        id='W1', person_id='P2', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=1,
        created_at=date.today()
    )

    engine = WaitingListEngine(store)

    print(f"小宝宝年龄: {store.persons['P2'].age}岁 ({store.persons['P2'].age * 12}个月)")
    print(f"疫苗要求: {store.vaccine_batches['B1'].min_age_months}-{store.vaccine_batches['B1'].max_age_months}个月")

    result = engine.process_cancellation('A1', 'CANCEL-002')

    print(f"\n取消结果: {result['success']}")
    print(f"释放名额: {result['available_slots']}")

    if result['rejected']:
        print(f"拒绝原因: {result['rejected'][0]['reason']}")

    assert result['success'], "取消应该成功"
    assert len(result['rejected']) == 1, "小宝宝应该被拒绝"
    assert "年龄不符合" in result['rejected'][0]['reason'], "拒绝原因应该包含年龄"

    print("✓ 测试2通过")
    return True


def test_case_3_adult_booster():
    """测试3: 成人加强针"""
    print("\n" + "="*60)
    print("测试3: 成人加强针")
    print("="*60)

    store = DataStore()

    store.persons['P1'] = Person(
        id='P1', name='王女士', id_card='110101198505104567',
        birth_date=date(1985, 5, 10),
        gender='女', phone='13900139001'
    )

    store.persons['P2'] = Person(
        id='P2', name='李先生', id_card='110101198008205678',
        birth_date=date(1980, 8, 20),
        gender='男', phone='13900139002'
    )

    store.vaccine_batches['B1'] = VaccineBatch(
        id='B1', vaccine_name='新冠疫苗', vaccine_type='成人加强针',
        min_age_months=216,
        max_age_months=1200,
        total_doses=1,
        intervals_days=[],
        available_slots=0
    )

    store.appointments['A1'] = Appointment(
        id='A1', person_id='P1', vaccine_batch_id='B1',
        dose_number=1, appointment_date=date.today(),
        status=AppointmentStatus.BOOKED
    )

    store.waiting_list['W1'] = WaitingListEntry(
        id='W1', person_id='P2', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=1,
        created_at=date.today()
    )

    engine = WaitingListEngine(store)

    print(f"王女士年龄: {store.persons['P1'].age}岁")
    print(f"李先生年龄: {store.persons['P2'].age}岁")
    print(f"疫苗要求: {store.vaccine_batches['B1'].min_age_months}-{store.vaccine_batches['B1'].max_age_months}个月")

    result = engine.process_cancellation('A1', 'CANCEL-003')

    print(f"\n取消结果: {result['success']}")

    assert result['success'], "取消应该成功"
    assert len(result['promoted']) == 1, "李先生应该转正成功"

    print("✓ 测试3通过")
    return True


def test_case_4_duplicate_waiting():
    """测试4: 重复候补检查"""
    print("\n" + "="*60)
    print("测试4: 重复候补检查")
    print("="*60)

    store = DataStore()

    store.persons['P1'] = Person(
        id='P1', name='预约者', id_card='110101199001011234',
        birth_date=date(1990, 1, 1),
        gender='男', phone='13800138001'
    )

    store.persons['P2'] = Person(
        id='P2', name='候补者', id_card='110101199001012345',
        birth_date=date(1990, 1, 1),
        gender='女', phone='13800138002'
    )

    store.persons['P3'] = Person(
        id='P3', name='重复候补', id_card='110101199001012345',
        birth_date=date(1990, 1, 1),
        gender='女', phone='13800138003'
    )

    store.vaccine_batches['B1'] = VaccineBatch(
        id='B1', vaccine_name='新冠疫苗', vaccine_type='成人加强针',
        min_age_months=216,
        max_age_months=1200,
        total_doses=1,
        intervals_days=[],
        available_slots=0
    )

    store.appointments['A1'] = Appointment(
        id='A1', person_id='P1', vaccine_batch_id='B1',
        dose_number=1, appointment_date=date.today(),
        status=AppointmentStatus.BOOKED
    )

    store.waiting_list['W1'] = WaitingListEntry(
        id='W1', person_id='P2', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=1,
        created_at=date.today() - timedelta(days=5)
    )

    store.waiting_list['W2'] = WaitingListEntry(
        id='W2', person_id='P3', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=0,
        created_at=date.today()
    )

    engine = WaitingListEngine(store)

    print(f"候补者身份证: {store.persons['P2'].id_card}")
    print(f"重复候补身份证: {store.persons['P3'].id_card}")

    result = engine.process_cancellation('A1', 'CANCEL-004')

    print(f"\n取消结果: {result['success']}")
    print(f"通知顺序: {[n['entry_id'] for n in result['notified']]}")

    if result['rejected']:
        print(f"拒绝原因: {result['rejected']}")

    assert result['success'], "取消应该成功"

    print("✓ 测试4通过")
    return True


def test_case_5_notification_order():
    """测试5: 通知顺序可复盘"""
    print("\n" + "="*60)
    print("测试5: 通知顺序可复盘")
    print("="*60)

    store = DataStore()

    store.persons['P1'] = Person(
        id='P1', name='预约者', id_card='110101199001011234',
        birth_date=date(1990, 1, 1),
        gender='男', phone='13800138001'
    )

    store.persons['P2'] = Person(
        id='P2', name='高优先级', id_card='110101198001012345',
        birth_date=date(1980, 1, 1),
        gender='女', phone='13800138002'
    )

    store.persons['P3'] = Person(
        id='P3', name='低优先级', id_card='110101198501013456',
        birth_date=date(1985, 1, 1),
        gender='男', phone='13800138003'
    )

    store.vaccine_batches['B1'] = VaccineBatch(
        id='B1', vaccine_name='新冠疫苗', vaccine_type='成人加强针',
        min_age_months=216,
        max_age_months=1200,
        total_doses=1,
        intervals_days=[],
        available_slots=0
    )

    store.appointments['A1'] = Appointment(
        id='A1', person_id='P1', vaccine_batch_id='B1',
        dose_number=1, appointment_date=date.today(),
        status=AppointmentStatus.BOOKED
    )

    store.waiting_list['W1'] = WaitingListEntry(
        id='W1', person_id='P3', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=0,
        created_at=date.today() - timedelta(days=10)
    )

    store.waiting_list['W2'] = WaitingListEntry(
        id='W2', person_id='P2', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=1,
        created_at=date.today()
    )

    engine = WaitingListEngine(store)

    result = engine.process_cancellation('A1', 'CANCEL-005')

    print(f"通知顺序: {[n['entry_id'] for n in result['notified']]}")
    print(f"转正: {[p['entry_id'] for p in result['promoted']]}")

    assert result['notified'][0]['entry_id'] == 'W2', "高优先级应该先被通知"
    assert result['promoted'][0]['entry_id'] == 'W2', "高优先级应该先转正"

    print("\n通知记录复盘:")
    for record in store.notification_records:
        print(f"  [{record.order}] {record.waiting_list_entry_id} -> {record.person_id}")

    print("✓ 测试5通过")
    return True


def test_case_6_duplicate_cancellation():
    """测试6: 重复处理同一取消记录不能重复转正"""
    print("\n" + "="*60)
    print("测试6: 重复处理同一取消记录不能重复转正")
    print("="*60)

    store = DataStore()

    store.persons['P1'] = Person(
        id='P1', name='预约者', id_card='110101199001011234',
        birth_date=date(1990, 1, 1),
        gender='男', phone='13800138001'
    )

    store.persons['P2'] = Person(
        id='P2', name='候补者', id_card='110101198001012345',
        birth_date=date(1980, 1, 1),
        gender='女', phone='13800138002'
    )

    store.vaccine_batches['B1'] = VaccineBatch(
        id='B1', vaccine_name='新冠疫苗', vaccine_type='成人加强针',
        min_age_months=216,
        max_age_months=1200,
        total_doses=1,
        intervals_days=[],
        available_slots=0
    )

    store.appointments['A1'] = Appointment(
        id='A1', person_id='P1', vaccine_batch_id='B1',
        dose_number=1, appointment_date=date.today(),
        status=AppointmentStatus.BOOKED
    )

    store.waiting_list['W1'] = WaitingListEntry(
        id='W1', person_id='P2', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=1,
        created_at=date.today()
    )

    engine = WaitingListEngine(store)

    print("第一次处理取消...")
    result1 = engine.process_cancellation('A1', 'CANCEL-006')
    print(f"第一次结果: 成功={result1['success']}, 转正={len(result1['promoted'])}")

    print("\n第二次处理同一取消记录(应该失败)...")
    result2 = engine.process_cancellation('A1', 'CANCEL-006')
    print(f"第二次结果: 成功={result2['success']}")
    if 'error' in result2:
        print(f"错误信息: {result2['error']}")

    assert result1['success'], "第一次取消应该成功"
    assert len(result1['promoted']) == 1, "第一次应该转正1人"

    assert not result2['success'], "第二次取消应该失败"
    assert "已处理过" in result2.get('error', ''), "错误信息应该提示已处理"

    print("✓ 测试6通过")
    return True


def test_case_7_skip_notified():
    """测试7: 已通知未确认的人是否能跳过"""
    print("\n" + "="*60)
    print("测试7: 已通知未确认的人是否能跳过")
    print("="*60)

    store = DataStore()

    store.persons['P1'] = Person(
        id='P1', name='预约者', id_card='110101199001011234',
        birth_date=date(1990, 1, 1),
        gender='男', phone='13800138001'
    )

    store.persons['P2'] = Person(
        id='P2', name='已通知未确认', id_card='110101198001012345',
        birth_date=date(1980, 1, 1),
        gender='女', phone='13800138002'
    )

    store.persons['P3'] = Person(
        id='P3', name='待处理', id_card='110101198501013456',
        birth_date=date(1985, 1, 1),
        gender='男', phone='13800138003'
    )

    store.vaccine_batches['B1'] = VaccineBatch(
        id='B1', vaccine_name='新冠疫苗', vaccine_type='成人加强针',
        min_age_months=216,
        max_age_months=1200,
        total_doses=1,
        intervals_days=[],
        available_slots=0
    )

    store.appointments['A1'] = Appointment(
        id='A1', person_id='P1', vaccine_batch_id='B1',
        dose_number=1, appointment_date=date.today(),
        status=AppointmentStatus.BOOKED
    )

    store.waiting_list['W1'] = WaitingListEntry(
        id='W1', person_id='P2', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.NOTIFIED,
        priority=1,
        notified_at=date.today() - timedelta(days=1),
        created_at=date.today() - timedelta(days=5)
    )

    store.waiting_list['W2'] = WaitingListEntry(
        id='W2', person_id='P3', vaccine_batch_id='B1',
        dose_number=1,
        status=WaitingListStatus.PENDING,
        priority=0,
        created_at=date.today()
    )

    print("测试: 跳过已通知未确认的人 (默认行为)...")
    engine_skip = WaitingListEngine(store, skip_notified_unconfirmed=True)
    result_skip = engine_skip.process_cancellation('A1', 'CANCEL-007')

    print(f"转正: {[p['entry_id'] for p in result_skip['promoted']]}")
    print(f"拒绝: {[r['entry_id'] for r in result_skip['rejected']]}")

    assert result_skip['promoted'][0]['entry_id'] == 'W2', "应该跳过W1，转正W2"

    print("\n✓ 测试7通过")
    return True


def run_all_tests():
    """运行所有测试"""
    print("\n" + "#"*60)
    print("# 社区疫苗预约候补系统 - 测试套件")
    print("#"*60)

    tests = [
        test_case_1_children_vaccine,
        test_case_2_age_not_qualified,
        test_case_3_adult_booster,
        test_case_4_duplicate_waiting,
        test_case_5_notification_order,
        test_case_6_duplicate_cancellation,
        test_case_7_skip_notified,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n✗ 测试失败: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "="*60)
    print(f"测试结果: {passed} 通过, {failed} 失败")
    print("="*60)

    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
