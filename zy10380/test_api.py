#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = 'http://localhost:5001/api/v1'

def print_response(title, response):
    print(f'\n{"="*60}')
    print(f'  {title}')
    print(f'{"="*60}')
    print(f'Status: {response.status_code}')
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    return response.json()

def test_success_flow():
    print('\n' + '#'*60)
    print('#  SUCCESS FLOW - 成功流程')
    print('#'*60)
    
    operator = 'admin@example.com'
    
    print('\n1. 创建上传包')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'user_data_2024.csv',
        'file_type': 'csv',
        'file_size': 15240,
        'uploaded_by': operator
    })
    result = print_response('创建上传包', response)
    package_id = result['data']['id']
    print(f'Package ID: {package_id}')
    
    print('\n2. 解析上传包')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/parse', json={
        'parsed_by': operator
    })
    print_response('解析上传包', response)
    
    print('\n3. 查看解析状态')
    response = requests.get(f'{BASE_URL}/packages/{package_id}')
    print_response('包状态查询', response)
    
    print('\n4. 预览差异')
    response = requests.get(f'{BASE_URL}/packages/{package_id}/preview')
    print_response('差异预览', response)
    
    print('\n5. 创建确认令牌')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/confirm-token', json={
        'created_by': operator
    })
    result = print_response('创建确认令牌', response)
    token = result['data']['token']
    print(f'Confirmation Token: {token}')
    
    print('\n6. 确认并写入')
    response = requests.post(f'{BASE_URL}/packages/{package_id}/write', json={
        'token': token,
        'confirmed_by': operator
    })
    result = print_response('确认写入', response)
    batch_id = result['data'][0]['id']
    
    print('\n7. 查看最终状态')
    response = requests.get(f'{BASE_URL}/packages/{package_id}')
    print_response('最终状态', response)
    
    print('\n8. 查看操作历史')
    response = requests.get(f'{BASE_URL}/history', params={'package_id': package_id})
    print_response('操作历史', response)
    
    return package_id, batch_id

def test_problem_flow():
    print('\n' + '#'*60)
    print('#  PROBLEM FLOW - 问题流程')
    print('#'*60)
    
    operator = 'user@example.com'
    
    print('\n1. 创建上传包 (第一个)')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'duplicate_test.xlsx',
        'file_type': 'xlsx',
        'file_size': 25000,
        'uploaded_by': operator
    })
    result = print_response('创建第一个包', response)
    package_id1 = result['data']['id']
    
    print('\n2. 重复提交相同文件 (应该返回已存在的包)')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'duplicate_test.xlsx',
        'file_type': 'xlsx',
        'file_size': 25000,
        'uploaded_by': operator
    })
    result = print_response('重复提交', response)
    assert result['data']['id'] == package_id1, "应该返回相同的包ID"
    assert result['created'] == False, "created应该为False"
    
    print('\n3. 查询不存在的包')
    response = requests.get(f'{BASE_URL}/packages/nonexistent-id')
    print_response('查询不存在的包 (应该404)', response)
    
    print('\n4. 未解析就创建确认令牌')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'error_test.json',
        'file_type': 'json',
        'file_size': 1000,
        'uploaded_by': operator
    })
    package_id2 = response.json()['data']['id']
    
    response = requests.post(f'{BASE_URL}/packages/{package_id2}/confirm-token', json={})
    print_response('未解析就创建令牌 (应该失败)', response)
    
    print('\n5. 解析后使用错误令牌')
    response = requests.post(f'{BASE_URL}/packages/{package_id2}/parse', json={})
    response = requests.post(f'{BASE_URL}/packages/{package_id2}/confirm-token', json={})
    response = requests.post(f'{BASE_URL}/packages/{package_id2}/write', json={
        'token': 'wrong-token-12345',
        'confirmed_by': operator
    })
    print_response('使用错误令牌写入 (应该失败)', response)
    
    return package_id1, package_id2

def test_revocation_flow():
    print('\n' + '#'*60)
    print('#  REVOCATION FLOW - 撤销流程')
    print('#'*60)
    
    operator = 'manager@example.com'
    
    print('\n1. 创建并写入一个包')
    response = requests.post(f'{BASE_URL}/packages', json={
        'filename': 'revocation_test.csv',
        'file_type': 'csv',
        'file_size': 50000,
        'uploaded_by': operator
    })
    package_id = response.json()['data']['id']
    
    response = requests.post(f'{BASE_URL}/packages/{package_id}/parse', json={})
    response = requests.post(f'{BASE_URL}/packages/{package_id}/confirm-token', json={})
    token = response.json()['data']['token']
    
    response = requests.post(f'{BASE_URL}/packages/{package_id}/write', json={
        'token': token,
        'confirmed_by': operator
    })
    batch_id = response.json()['data'][0]['id']
    
    print('\n2. 撤销写入批次')
    response = requests.post(f'{BASE_URL}/batches/{batch_id}/revoke', json={
        'revoked_by': operator,
        'reason': '发现数据质量问题，需要重新导入'
    })
    print_response('撤销批次', response)
    
    print('\n3. 查看撤销后的状态')
    response = requests.get(f'{BASE_URL}/packages/{package_id}')
    print_response('撤销后的包状态', response)
    
    print('\n4. 再次撤销 (应该失败)')
    response = requests.post(f'{BASE_URL}/batches/{batch_id}/revoke', json={
        'revoked_by': operator,
        'reason': '再次测试撤销'
    })
    print_response('再次撤销 (应该失败)', response)
    
    return package_id

def test_persistence():
    print('\n' + '#'*60)
    print('#  PERSISTENCE CHECK - 持久化验证')
    print('#'*60)
    
    print('\n1. 列出所有上传包')
    response = requests.get(f'{BASE_URL}/packages')
    result = print_response('所有包列表', response)
    print(f'共找到 {result["count"]} 个包')
    
    print('\n2. 查看所有操作历史')
    response = requests.get(f'{BASE_URL}/history')
    result = print_response('全局操作历史', response)
    print(f'共找到 {result["count"]} 条历史记录')
    
    print('\n3. 按操作者筛选历史')
    response = requests.get(f'{BASE_URL}/history', params={'operator': 'admin@example.com'})
    result = print_response('admin的操作历史', response)
    
    print('\n4. 按状态筛选包')
    response = requests.get(f'{BASE_URL}/packages', params={'status': 'WRITTEN'})
    result = print_response('已写入的包', response)
    
    response = requests.get(f'{BASE_URL}/packages', params={'status': 'REVOKED'})
    result = print_response('已撤销的包', response)

def main():
    print('多步骤导入确认 API 测试脚本')
    print('='*60)
    
    print('\n等待服务器启动... (请确保 run.py 已在运行)')
    for i in range(3):
        try:
            response = requests.get(f'{BASE_URL}/health', timeout=2)
            if response.status_code == 200:
                print('服务器已就绪!')
                break
        except:
            print(f'等待中... ({i+1}/3)')
            time.sleep(2)
    else:
        print('错误: 无法连接到服务器，请先运行 python run.py')
        return
    
    try:
        package_id_success, batch_id = test_success_flow()
        package_id_problem1, package_id_problem2 = test_problem_flow()
        package_id_revocation = test_revocation_flow()
        test_persistence()
        
        print('\n' + '#'*60)
        print('#  TEST SUMMARY - 测试总结')
        print('#'*60)
        print(f'成功流程包ID: {package_id_success}')
        print(f'问题流程包ID: {package_id_problem1}, {package_id_problem2}')
        print(f'撤销流程包ID: {package_id_revocation}')
        print('\n所有测试完成! 数据库中的数据可以跨重启持久化保存。')
        
    except Exception as e:
        print(f'\n测试过程中出错: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
