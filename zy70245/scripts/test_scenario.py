#!/usr/bin/env python3
import json
import hashlib
from datetime import datetime
import requests
import sys

BASE_URL = 'http://localhost:5001/api'


def generate_signature(rider_id, equipment_no, operation_date_str):
    if '.' in operation_date_str:
        operation_date_str = operation_date_str.split('.')[0]
    date = datetime.strptime(operation_date_str, '%Y-%m-%dT%H:%M:%S')
    date_str = date.strftime('%Y-%m-%d')
    sign_str = rider_id + '|' + equipment_no + '|' + date_str
    return hashlib.sha256(sign_str.encode()).hexdigest()[:16]


def print_separator(title):
    print('\n' + '='*60)
    print('  ' + title)
    print('='*60 + '\n')


def print_response(name, response):
    print('[' + name + ']')
    print('  HTTP Status: ' + str(response.status_code))
    try:
        data = response.json()
        success_val = data.get('success', False)
        print('  Success: ' + str(success_val))
        if 'message' in data:
            print('  Message: ' + str(data['message']))
        if 'error' in data:
            print('  Error Code: ' + str(data['error']['code']))
            print('  Error Message: ' + str(data['error']['message']))
            if data['error'].get('details'):
                details_str = json.dumps(data['error']['details'], ensure_ascii=False, indent=4)
                print('  Error Details: ' + details_str)
        full_resp = json.dumps(data, ensure_ascii=False, indent=2)
        print('  Full Response: ' + full_resp)
    except:
        print('  Response: ' + str(response.text))


def wait_for_server():
    import time
    for i in range(30):
        try:
            response = requests.get(BASE_URL + '/riders/')
            if response.status_code < 500:
                return True
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(1)
    print('Error: Server not responding after 30 seconds')
    return False


def test_normal_flow():
    print_separator('SCENARIO 1: 正常处理流程')

    print('步骤 1: 创建骑手档案...')
    rider_data = {
        'rider_id': 'RIDER001',
        'name': '张三',
        'phone': '13800138001',
        'id_card': '110101199001011234',
        'station_id': 'ST001',
        'station_name': '朝阳路站点',
        'join_date': '2024-01-15'
    }
    response = requests.post(BASE_URL + '/riders/', json=rider_data)
    print_response('创建骑手', response)
    assert response.status_code == 201, '创建骑手失败'

    print('\n步骤 2: 激活骑手档案...')
    response = requests.post(BASE_URL + '/riders/RIDER001/activate')
    print_response('激活骑手', response)
    assert response.status_code == 200, '激活骑手失败'

    print('\n步骤 3: 验证骑手档案是否生效...')
    response = requests.post(BASE_URL + '/riders/RIDER001/verify')
    print_response('验证骑手', response)
    assert response.status_code == 200, '验证骑手失败'
    assert response.json()['data']['is_active'] == True, '骑手应该处于生效状态'

    print('\n步骤 4: 创建装备批次...')
    batch_data = {
        'batch_no': 'BATCH-H001',
        'equipment_type': 'helmet',
        'supplier': '安全装备有限公司',
        'quantity': 10,
        'arrival_date': '2024-01-20'
    }
    response = requests.post(BASE_URL + '/equipment/batches', json=batch_data)
    print_response('创建批次', response)
    assert response.status_code == 201, '创建批次失败'

    print('\n步骤 5: 质检装备批次...')
    inspect_data = {
        'inspector': '李四',
        'inspection_report': '批次抽检合格，符合安全标准',
        'is_qualified': True
    }
    response = requests.post(BASE_URL + '/equipment/batches/BATCH-H001/inspect', json=inspect_data)
    print_response('质检批次', response)
    assert response.status_code == 200, '质检批次失败'

    print('\n步骤 6: 验证装备批次是否可靠...')
    response = requests.post(BASE_URL + '/equipment/batches/BATCH-H001/verify')
    print_response('验证批次', response)
    assert response.status_code == 200, '验证批次失败'

    print('\n步骤 7: 创建具体装备...')
    equipment_data = {
        'batch_no': 'BATCH-H001',
        'equipment_no': 'HELMET001',
        'rfid_tag': 'RFID-H001'
    }
    response = requests.post(BASE_URL + '/equipment/', json=equipment_data)
    print_response('创建装备', response)
    assert response.status_code == 201, '创建装备失败'

    print('\n步骤 8: 创建领用记录...')
    operation_time = datetime.utcnow().isoformat(timespec='seconds')
    issue_data = {
        'rider_id': 'RIDER001',
        'equipment_no': 'HELMET001',
        'operator': '王五',
        'operation_date': operation_time
    }
    response = requests.post(BASE_URL + '/records/issue', json=issue_data)
    print_response('创建领用记录', response)
    assert response.status_code == 201, '创建领用记录失败'
    issue_record = response.json()['data']
    record_no = issue_record['record_no']

    print('\n步骤 9: 生成正确签名并确认领用...')
    signature = generate_signature('RIDER001', 'HELMET001', operation_time)
    print('  生成的签名: ' + signature)
    confirm_data = {'signature': signature}
    response = requests.post(BASE_URL + '/records/' + record_no + '/confirm', json=confirm_data)
    print_response('确认领用', response)
    assert response.status_code == 200, '确认领用失败'

    print('\n步骤 10: 验证领用签收是否与原始数据对得上...')
    response = requests.post(BASE_URL + '/records/' + record_no + '/verify')
    print_response('验证记录一致性', response)
    assert response.status_code == 200, '验证记录失败'
    verification = response.json()['data']
    assert verification['is_consistent'] == True, '记录应该是一致的'

    print('\n' + '-'*60)
    print('SCENARIO 1 完成: 所有正常流程验证通过')
    print('-'*60)
    return True


def test_failure_flow():
    print_separator('SCENARIO 2: 失败场景测试')

    print('\n测试 1: 验证未激活的骑手...')
    rider_data = {
        'rider_id': 'RIDER002',
        'name': '赵六',
        'phone': '13800138002',
        'id_card': '110101199001011235',
        'station_id': 'ST001',
        'station_name': '朝阳路站点',
        'join_date': '2024-01-20'
    }
    response = requests.post(BASE_URL + '/riders/', json=rider_data)
    assert response.status_code == 201

    response = requests.post(BASE_URL + '/riders/RIDER002/verify')
    print_response('验证未激活骑手', response)
    assert response.status_code == 403, '应该返回 403 禁止访问'
    assert response.json()['error']['code'] == 'RIDER_NOT_ACTIVE'

    print('\n测试 2: 验证未质检的装备批次...')
    batch_data = {
        'batch_no': 'BATCH-H002',
        'equipment_type': 'helmet',
        'supplier': '安全装备有限公司',
        'quantity': 5,
        'arrival_date': '2024-01-25'
    }
    response = requests.post(BASE_URL + '/equipment/batches', json=batch_data)
    assert response.status_code == 201

    response = requests.post(BASE_URL + '/equipment/batches/BATCH-H002/verify')
    print_response('验证未质检批次', response)
    assert response.status_code == 400, '应该返回 400 错误'
    assert response.json()['error']['code'] == 'BATCH_NOT_QUALIFIED'

    print('\n测试 3: 用错误签名确认记录...')
    operation_time = datetime.utcnow().isoformat(timespec='seconds')

    equipment_data = {
        'batch_no': 'BATCH-H001',
        'equipment_no': 'HELMET002',
        'rfid_tag': 'RFID-H002'
    }
    response = requests.post(BASE_URL + '/equipment/', json=equipment_data)
    assert response.status_code == 201

    issue_data = {
        'rider_id': 'RIDER001',
        'equipment_no': 'HELMET002',
        'operator': '王五',
        'operation_date': operation_time
    }
    response = requests.post(BASE_URL + '/records/issue', json=issue_data)
    assert response.status_code == 201
    issue_record = response.json()['data']
    record_no = issue_record['record_no']

    wrong_signature = 'WRONG_SIGNATURE_12345'
    confirm_data = {'signature': wrong_signature}
    response = requests.post(BASE_URL + '/records/' + record_no + '/confirm', json=confirm_data)
    print_response('用错误签名确认', response)
    assert response.status_code == 400, '应该返回 400 错误'
    assert response.json()['error']['code'] == 'SIGNATURE_MISMATCH'

    print('\n测试 4: 骑手有未归还装备时尝试离职...')
    response = requests.post(BASE_URL + '/riders/RIDER001/resign')
    print_response('有装备未归还时离职', response)
    assert response.status_code == 400, '应该返回 400 错误'
    assert response.json()['error']['code'] == 'RIDER_HAS_OUTSTANDING_EQUIPMENT'

    print('\n' + '-'*60)
    print('SCENARIO 2 完成: 所有失败场景验证通过')
    print('-'*60)
    return True


def test_correction_flow():
    print_separator('SCENARIO 3: 修正后重跑流程')

    print('\n步骤 1: 创建一个有问题的领用记录...')
    operation_time = datetime.utcnow().isoformat(timespec='seconds')

    equipment_data = {
        'batch_no': 'BATCH-H001',
        'equipment_no': 'HELMET003',
        'rfid_tag': 'RFID-H003'
    }
    response = requests.post(BASE_URL + '/equipment/', json=equipment_data)
    assert response.status_code == 201

    issue_data = {
        'rider_id': 'RIDER001',
        'equipment_no': 'HELMET003',
        'operator': '王五',
        'operation_date': operation_time
    }
    response = requests.post(BASE_URL + '/records/issue', json=issue_data)
    assert response.status_code == 201
    issue_record = response.json()['data']
    record_no = issue_record['record_no']

    print('\n步骤 2: 第一次尝试 - 使用错误签名...')
    wrong_signature = 'INVALID_SIGNATURE'
    confirm_data = {'signature': wrong_signature}
    response = requests.post(BASE_URL + '/records/' + record_no + '/confirm', json=confirm_data)
    print_response('第一次尝试(错误签名)', response)
    assert response.status_code == 400

    print('\n步骤 3: 查看记录状态(应该是 anomaly)...')
    response = requests.get(BASE_URL + '/records/' + record_no)
    print_response('查看异常记录', response)
    record_data = response.json()['data']
    assert record_data['status'] == 'anomaly'

    print('\n步骤 4: 检查对账报告(应该显示有不一致记录)...')
    response = requests.get(BASE_URL + '/records/reconciliation')
    print_response('对账报告(修正前)', response)
    report = response.json()['data']
    assert report['reconciliation_status'] == 'needs_review'

    print('\n步骤 5: 修正 - 归还异常装备后重新领用...')
    response = requests.put(BASE_URL + '/equipment/HELMET003/status', json={'new_status': 'in_stock'})
    print_response('重置装备状态', response)

    new_operation_time = datetime.utcnow().isoformat(timespec='seconds')
    issue_data2 = {
        'rider_id': 'RIDER001',
        'equipment_no': 'HELMET003',
        'operator': '王五',
        'operation_date': new_operation_time
    }
    response = requests.post(BASE_URL + '/records/issue', json=issue_data2)
    print_response('重新创建领用记录', response)
    assert response.status_code == 201
    new_record_no = response.json()['data']['record_no']

    print('\n步骤 6: 第二次尝试 - 使用正确签名...')
    correct_signature = generate_signature('RIDER001', 'HELMET003', new_operation_time)
    confirm_data = {'signature': correct_signature}
    response = requests.post(BASE_URL + '/records/' + new_record_no + '/confirm', json=confirm_data)
    print_response('第二次尝试(正确签名)', response)
    assert response.status_code == 200

    print('\n步骤 7: 验证修正后的记录...')
    response = requests.post(BASE_URL + '/records/' + new_record_no + '/verify')
    print_response('验证修正后记录', response)
    verification = response.json()['data']
    assert verification['is_consistent'] == True

    print('\n步骤 8: 归还装备并处理损坏赔付...')
    return_data = {
        'rider_id': 'RIDER001',
        'equipment_no': 'HELMET003',
        'operator': '王五',
        'return_condition': '有划痕，功能正常',
        'damage_level': 'moderate'
    }
    response = requests.post(BASE_URL + '/records/return', json=return_data)
    print_response('创建归还记录', response)
    assert response.status_code == 201
    return_record = response.json()['data']
    return_record_no = return_record['record_no']

    return_signature = generate_signature('RIDER001', 'HELMET003', return_record['operation_date'])
    response = requests.post(BASE_URL + '/records/' + return_record_no + '/confirm', json={'signature': return_signature})
    print_response('确认归还', response)
    assert response.status_code == 200

    print('\n步骤 9: 创建赔付记录并完成赔付...')
    compensation_data = {
        'rider_id': 'RIDER001',
        'equipment_no': 'HELMET003',
        'damage_reason': '使用过程中意外磕碰',
        'damage_level': 'moderate'
    }
    response = requests.post(BASE_URL + '/compensation/', json=compensation_data)
    print_response('创建赔付记录', response)
    assert response.status_code == 201
    compensation_no = response.json()['data']['compensation_no']

    response = requests.post(BASE_URL + '/compensation/' + compensation_no + '/pay', json={'payment_method': 'cash'})
    print_response('完成赔付', response)
    assert response.status_code == 200

    print('\n步骤 10: 对账赔付记录...')
    response = requests.post(BASE_URL + '/compensation/' + compensation_no + '/reconcile', json={'is_valid': True, 'remarks': '赔付金额正确，已入账'})
    print_response('对账赔付', response)
    assert response.status_code == 200

    print('\n步骤 11: 检查最终对账状态...')
    response = requests.get(BASE_URL + '/compensation/reconciliation')
    print_response('赔付对账报告', response)

    print('\n' + '-'*60)
    print('SCENARIO 3 完成: 修正重跑流程验证通过')
    print('-'*60)
    return True


def main():
    if not wait_for_server():
        return 1

    success_count = 0
    total_count = 3

    print_separator('外卖骑手装备领用 API 测试开始')

    try:
        if test_normal_flow():
            success_count += 1
    except Exception as e:
        print('\nSCENARIO 1 失败: ' + str(e))
        import traceback
        traceback.print_exc()

    try:
        if test_failure_flow():
            success_count += 1
    except Exception as e:
        print('\nSCENARIO 2 失败: ' + str(e))
        import traceback
        traceback.print_exc()

    try:
        if test_correction_flow():
            success_count += 1
    except Exception as e:
        print('\nSCENARIO 3 失败: ' + str(e))
        import traceback
        traceback.print_exc()

    print_separator('测试总结')
    print('通过: ' + str(success_count) + '/' + str(total_count))
    if success_count == total_count:
        print('所有测试场景通过！')
        return 0
    else:
        print(str(total_count - success_count) + ' 个测试场景失败')
        return 1


if __name__ == '__main__':
    sys.exit(main())
