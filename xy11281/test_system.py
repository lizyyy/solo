#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_database, execute_query
from workflow import (
    create_prescription, submit_prescription, review_prescription,
    dispense_prescription, trace_prescription, get_prescription_history,
    cancel_prescription
)
from business_rules import validate_prescription, calculate_dose, check_contraindications


def init_test_data():
    print("=== 初始化测试数据 ===")
    init_database()
    
    execute_query('DELETE FROM prescription_items')
    execute_query('DELETE FROM prescriptions')
    execute_query('DELETE FROM medicine_batches')
    execute_query('DELETE FROM contraindications')
    execute_query('DELETE FROM medicines')
    
    medicines = [
        ('阿莫西林', 'Amoxicillin', '硕腾', '片剂', 5.0, 20.0, 'mg'),
        ('头孢氨苄', 'Cefalexin', '默沙东', '片剂', 10.0, 30.0, 'mg'),
        ('泼尼松龙', 'Prednisolone', '辉瑞', '片剂', 0.5, 2.0, 'mg'),
        ('恩诺沙星', 'Enrofloxacin', '拜耳', '注射液', 2.5, 10.0, 'mg'),
    ]
    
    medicine_ids = []
    for med in medicines:
        mid = execute_query('''
            INSERT INTO medicines 
            (name, generic_name, manufacturer, dosage_form, 
             min_dose_per_kg, max_dose_per_kg, dose_unit)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', med)
        medicine_ids.append(mid)
    
    batches = [
        (medicine_ids[0], 'AMX-TEST-001', 100, '片', '2024-01-15', '2027-01-15'),
        (medicine_ids[1], 'CEF-TEST-001', 150, '片', '2024-02-20', '2027-02-20'),
        (medicine_ids[2], 'PRE-TEST-001', 80, '片', '2024-03-10', '2027-03-10'),
        (medicine_ids[3], 'ENR-TEST-001', 50, '支', '2024-04-05', '2027-04-05'),
    ]
    
    for batch in batches:
        execute_query('''
            INSERT INTO medicine_batches 
            (medicine_id, batch_number, quantity, unit, manufacture_date, expiry_date)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', batch)
    
    execute_query('''
        INSERT INTO contraindications (medicine_a_id, medicine_b_id, reason)
        VALUES (?, ?, ?)
    ''', (medicine_ids[2], medicine_ids[3], '泼尼松龙与恩诺沙星联用禁忌'))
    
    print(f"已初始化 {len(medicine_ids)} 种药品\n")
    return medicine_ids


def test_normal_flow(medicine_ids):
    print("=== 测试1: 正常流程 (小猫 3kg) ===")
    
    result = create_prescription(
        pet_name='小白',
        pet_weight_kg=3.0,
        species='猫',
        doctor_name='张医生',
        created_by='李护士',
        items=[
            {'medicine_id': medicine_ids[0], 'prescribed_dose': 30.0, 'quantity': 10},
        ]
    )
    print(f"创建处方: {'成功' if result['success'] else '失败'}")
    assert result['success'], "创建处方失败"
    rx_id = result['prescription_id']
    
    result = submit_prescription(rx_id, '张医生')
    print(f"提交处方: {'成功' if result['success'] else '失败'}")
    assert result['success'], "提交处方失败"
    
    result = review_prescription(rx_id, '王药师', approve=True, reason='剂量正常')
    print(f"审核处方: {'成功' if result['success'] else '失败'}")
    assert result['success'], "审核处方失败"
    assert result['new_status'] == 'APPROVED'
    
    result = dispense_prescription(rx_id, '赵药师')
    print(f"发药处方: {'成功' if result['success'] else '失败'}")
    assert result['success'], "发药失败"
    assert result['new_status'] == 'DISPENSED'
    
    result = trace_prescription(rx_id)
    print(f"追溯处方: 共 {len(result['workflow_logs'])} 条操作记录")
    assert len(result['workflow_logs']) >= 4, "操作记录不足"
    
    print("正常流程测试通过!\n")


def test_dose_validation(medicine_ids):
    print("=== 测试2: 小体重宠物剂量验证 (0.5kg 仓鼠) ===")
    
    min_d, rec, max_d = calculate_dose(medicine_ids[0], 0.5)
    print(f"0.5kg 剂量范围: {min_d:.4f} - {max_d:.4f} mg")
    
    result = create_prescription(
        pet_name='小仓',
        pet_weight_kg=0.5,
        species='仓鼠',
        doctor_name='张医生',
        created_by='李护士',
        items=[
            {'medicine_id': medicine_ids[0], 'prescribed_dose': 100.0, 'quantity': 1},
        ]
    )
    rx_id = result['prescription_id']
    
    validation = validate_prescription(rx_id)
    print(f"剂量过高验证: {'拦截成功' if not validation['items'][0]['dose_validation']['passed'] else '拦截失败'}")
    assert not validation['items'][0]['dose_validation']['passed'], "应该拦截剂量过高"
    
    result = submit_prescription(rx_id, '张医生')
    result = review_prescription(rx_id, '王药师', approve=True)
    print(f"试图批准超剂量处方: {'正确拦截' if not result['success'] else '错误通过'}")
    assert not result['success'], "超剂量处方应该被拦截"
    
    print("小体重剂量验证测试通过!\n")


def test_contraindication(medicine_ids):
    print("=== 测试3: 禁忌组合验证 ===")
    
    result = create_prescription(
        pet_name='阿黄',
        pet_weight_kg=10.0,
        species='狗',
        doctor_name='张医生',
        created_by='李护士',
        items=[
            {'medicine_id': medicine_ids[2], 'prescribed_dose': 10.0, 'quantity': 5},
            {'medicine_id': medicine_ids[3], 'prescribed_dose': 50.0, 'quantity': 3},
        ]
    )
    rx_id = result['prescription_id']
    
    validation = validate_prescription(rx_id)
    print(f"禁忌组合验证: {'检测成功' if not validation['contraindication_check']['passed'] else '检测失败'}")
    assert not validation['contraindication_check']['passed'], "应该检测到禁忌组合"
    
    print("禁忌组合验证测试通过!\n")


def test_duplicate_submit(medicine_ids):
    print("=== 测试4: 重复提交防重 ===")
    
    result = create_prescription(
        pet_name='小黑',
        pet_weight_kg=5.0,
        species='猫',
        doctor_name='张医生',
        created_by='李护士',
        items=[
            {'medicine_id': medicine_ids[0], 'prescribed_dose': 50.0, 'quantity': 10},
        ]
    )
    rx_id = result['prescription_id']
    
    result1 = submit_prescription(rx_id, '张医生')
    print(f"第一次提交: {'成功' if result1['success'] else '失败'}")
    
    result2 = submit_prescription(rx_id, '张医生')
    print(f"重复提交: {'正确拦截' if not result2['success'] else '错误通过'}")
    assert not result2['success'], "重复提交应该被拦截"
    
    print("重复提交防重测试通过!\n")


def test_history_persistence(medicine_ids):
    print("=== 测试5: 历史记录持久化 ===")
    
    history = get_prescription_history()
    print(f"当前共有 {len(history)} 条处方记录")
    
    for rx in history:
        print(f"  - {rx['prescription_no']}: {rx['pet_name']} ({rx['status']})")
    
    assert len(history) >= 4, "历史记录数量不足"
    
    print("历史记录持久化测试通过!\n")


def test_cancel_prescription(medicine_ids):
    print("=== 测试6: 取消处方 ===")
    
    result = create_prescription(
        pet_name='小蓝',
        pet_weight_kg=4.0,
        species='猫',
        doctor_name='张医生',
        created_by='李护士',
        items=[
            {'medicine_id': medicine_ids[1], 'prescribed_dose': 80.0, 'quantity': 7},
        ]
    )
    rx_id = result['prescription_id']
    
    result = submit_prescription(rx_id, '张医生')
    result = cancel_prescription(rx_id, '张医生', '主人放弃治疗')
    print(f"取消处方: {'成功' if result['success'] else '失败'}")
    assert result['success'], "取消处方失败"
    assert result['new_status'] == 'CANCELLED'
    
    trace = trace_prescription(rx_id)
    cancel_logs = [l for l in trace['workflow_logs'] if l['action'] == 'CANCEL']
    print(f"取消记录: {len(cancel_logs)} 条")
    assert len(cancel_logs) >= 1
    
    print("取消处方测试通过!\n")


def main():
    print("宠物医院药房管理系统 - 自动化测试\n")
    
    medicine_ids = init_test_data()
    
    test_normal_flow(medicine_ids)
    test_dose_validation(medicine_ids)
    test_contraindication(medicine_ids)
    test_duplicate_submit(medicine_ids)
    test_cancel_prescription(medicine_ids)
    test_history_persistence(medicine_ids)
    
    print("=" * 50)
    print("所有测试通过! ✓")
    print("=" * 50)


if __name__ == '__main__':
    main()
