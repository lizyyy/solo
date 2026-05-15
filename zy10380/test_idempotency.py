#!/usr/bin/env python3
import requests
import json

BASE_URL = 'http://localhost:5001/api/v1'

def test_idempotency():
    print('=' * 60)
    print('  Idempotency Test - 重复提交幂等性验证')
    print('=' * 60)
    
    operator = 'tester@example.com'
    filename = 'idempotent_test.json'
    
    json_data = [
        {"id": "data_001", "name": "Test User", "email": "test@example.com", "status": "active"}
    ]
    
    payload = {
        'filename': filename,
        'file_type': 'json',
        'file_size': len(json.dumps(json_data)),
        'uploaded_by': operator,
        'content': json.dumps(json_data)
    }
    
    print('\n1. 第一次提交 - 应该创建新包 (201, created=True)')
    response1 = requests.post(f'{BASE_URL}/packages', json=payload)
    print(f'   Status: {response1.status_code}')
    result1 = response1.json()
    package_id1 = result1['data']['id']
    created1 = result1['created']
    print(f'   Package ID: {package_id1}')
    print(f'   Created: {created1}')
    assert response1.status_code == 201, "Expected 201 for first submission"
    assert created1 == True, "Expected created=True for first submission"
    
    print('\n2. 第二次提交 - 相同 payload，应该返回已存在的包')
    response2 = requests.post(f'{BASE_URL}/packages', json=payload)
    print(f'   Status: {response2.status_code}')
    result2 = response2.json()
    package_id2 = result2['data']['id']
    created2 = result2['created']
    print(f'   Package ID: {package_id2}')
    print(f'   Created: {created2}')
    assert package_id1 == package_id2, "Package IDs should be identical (idempotent)"
    assert created2 == False, "Expected created=False for duplicate submission"
    
    print('\n3. 第三次提交 - 验证仍然返回相同包')
    response3 = requests.post(f'{BASE_URL}/packages', json=payload)
    print(f'   Status: {response3.status_code}')
    result3 = response3.json()
    package_id3 = result3['data']['id']
    created3 = result3['created']
    print(f'   Package ID: {package_id3}')
    print(f'   Created: {created3}')
    assert package_id1 == package_id3, "Package IDs should be identical (idempotent)"
    assert created3 == False, "Expected created=False for duplicate submission"
    
    print('\n4. 修改 file_size - 应该创建新包')
    payload_v2 = payload.copy()
    payload_v2['file_size'] = payload_v2['file_size'] + 100
    response4 = requests.post(f'{BASE_URL}/packages', json=payload_v2)
    print(f'   Status: {response4.status_code}')
    result4 = response4.json()
    package_id4 = result4['data']['id']
    created4 = result4['created']
    print(f'   Package ID: {package_id4}')
    print(f'   Created: {created4}')
    assert package_id1 != package_id4, "Different file_size should create new package"
    assert created4 == True, "Expected created=True for different file_size"
    
    print('\n5. 修改 uploaded_by - 应该创建新包')
    payload_v3 = payload.copy()
    payload_v3['uploaded_by'] = 'another@example.com'
    response5 = requests.post(f'{BASE_URL}/packages', json=payload_v3)
    print(f'   Status: {response5.status_code}')
    result5 = response5.json()
    package_id5 = result5['data']['id']
    created5 = result5['created']
    print(f'   Package ID: {package_id5}')
    print(f'   Created: {created5}')
    assert package_id1 != package_id5, "Different uploaded_by should create new package"
    assert created5 == True, "Expected created=True for different uploaded_by"
    
    print('\n6. 修改 filename - 应该创建新包')
    payload_v4 = payload.copy()
    payload_v4['filename'] = 'different_filename.json'
    response6 = requests.post(f'{BASE_URL}/packages', json=payload_v4)
    print(f'   Status: {response6.status_code}')
    result6 = response6.json()
    package_id6 = result6['data']['id']
    created6 = result6['created']
    print(f'   Package ID: {package_id6}')
    print(f'   Created: {created6}')
    assert package_id1 != package_id6, "Different filename should create new package"
    assert created6 == True, "Expected created=True for different filename"
    
    print('\n' + '=' * 60)
    print('  ALL IDEMPOTENCY TESTS PASSED!')
    print('=' * 60)
    print(f'\n  3次相同提交: 返回相同的 Package ID = {package_id1}')
    print(f'  不同 file_size: 新建包 ID = {package_id4}')
    print(f'  不同 uploaded_by: 新建包 ID = {package_id5}')
    print(f'  不同 filename: 新建包 ID = {package_id6}')
    print('\n  重复提交不会制造脏结果 ✓')

if __name__ == '__main__':
    test_idempotency()
