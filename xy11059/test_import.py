#!/usr/bin/env python3
import requests
import os

BASE_URL = 'http://localhost:5000'

def test_normal_import():
    print('=== 测试1: 正常数据导入 ===')
    file_path = os.path.join(os.path.dirname(__file__), 'test_data_normal.csv')
    
    with open(file_path, 'rb') as f:
        files = {'file': ('test_data_normal.csv', f, 'text/csv')}
        response = requests.post(f'{BASE_URL}/api/import/replace', files=files)
    
    result = response.json()
    print(f'总条数: {result["summary"]["total"]}')
    print(f'成功: {result["summary"]["success"]}')
    print(f'坏行: {result["summary"]["bad_rows"]}')
    
    if result['bad_rows']:
        print('\n坏行详情:')
        for bad in result['bad_rows']:
            print(f'  行{bad["row"]}: {bad["error"]}')
            print(f'    建议: {bad["suggestion"]}')
    
    assert result['success'] == True
    assert result['summary']['success'] == 4
    assert result['summary']['bad_rows'] == 0
    print('✓ 正常数据导入测试通过\n')

def test_edge_cases_import():
    print('=== 测试2: 边界情况导入（无人工覆盖） ===')
    file_path = os.path.join(os.path.dirname(__file__), 'test_data_edge_cases.csv')
    
    with open(file_path, 'rb') as f:
        files = {'file': ('test_data_edge_cases.csv', f, 'text/csv')}
        response = requests.post(f'{BASE_URL}/api/import/replace', files=files)
    
    result = response.json()
    print(f'总条数: {result["summary"]["total"]}')
    print(f'成功: {result["summary"]["success"]}')
    print(f'坏行: {result["summary"]["bad_rows"]}')
    
    if result['bad_rows']:
        print('\n坏行详情:')
        for bad in result['bad_rows']:
            print(f'  行{bad["row"]}: {bad["error"]}')
            print(f'    建议: {bad["suggestion"]}')
    
    assert result['success'] == True
    assert result['summary']['bad_rows'] >= 5
    print('✓ 边界情况测试通过\n')

def test_manual_override_import():
    print('=== 测试3: 人工覆盖模式导入 ===')
    file_path = os.path.join(os.path.dirname(__file__), 'test_data_edge_cases.csv')
    
    with open(file_path, 'rb') as f:
        files = {'file': ('test_data_edge_cases.csv', f, 'text/csv')}
        data = {
            'allow_manual_override': 'true',
            'manual_notes': '客服审核通过，特殊情况允许继续流程'
        }
        response = requests.post(f'{BASE_URL}/api/import/replace', files=files, data=data)
    
    result = response.json()
    print(f'总条数: {result["summary"]["total"]}')
    print(f'成功: {result["summary"]["success"]}')
    print(f'坏行: {result["summary"]["bad_rows"]}')
    print(f'警告: {result["summary"]["warnings"]}')
    
    if result['warning_rows']:
        print('\n警告详情:')
        for warning in result['warning_rows']:
            print(f'  行{warning["row"]} ({warning["record_id"]}):')
            for w in warning['warnings']:
                print(f'    - {w}')
            print(f'    备注: {warning["note"]}')
    
    if result['bad_rows']:
        print('\n仍然失败的坏行:')
        for bad in result['bad_rows']:
            print(f'  行{bad["row"]}: {bad["error"]}')
    
    assert result['success'] == True
    assert result['summary']['success'] > result['summary']['bad_rows']
    print('✓ 人工覆盖模式测试通过\n')

def test_get_records():
    print('=== 测试4: 查询所有记录 ===')
    response = requests.get(f'{BASE_URL}/api/replace/records')
    records = response.json()
    print(f'总记录数: {len(records)}')
    
    if records:
        print('示例记录:')
        first = records[0]
        print(f'  换件单号: {first["record_id"]}')
        print(f'  客户: {first["customer_name"]}')
        print(f'  门锁型号: {first["lock_model"]}')
        print(f'  状态: {first["status"]}')
        print(f'  是否人工覆盖: {first["has_manual_override"]}')
        if first['manual_notes']:
            print(f'  人工备注: {first["manual_notes"]}')
    
    print('✓ 查询记录测试通过\n')

def test_get_single_record():
    print('=== 测试5: 查询单条记录 ===')
    response = requests.get(f'{BASE_URL}/api/replace/record/HJ20240101001')
    record = response.json()
    print(f'换件单号: {record["record_id"]}')
    print(f'客户姓名: {record["customer_name"]}')
    print(f'门锁型号: {record["lock_model"]}')
    print(f'故障类型: {record["fault_type"]}')
    print(f'新配件: {record["new_part_name"]}')
    print(f'状态: {record["status"]}')
    print('✓ 查询单条记录测试通过\n')

if __name__ == '__main__':
    print('智能门锁售后换件导入接口测试\n')
    
    try:
        response = requests.get(f'{BASE_URL}/health')
        if response.status_code != 200:
            print('错误: 服务未启动，请先运行 python app.py')
            exit(1)
    except:
        print('错误: 无法连接到服务，请先运行 python app.py')
        exit(1)
    
    test_normal_import()
    test_edge_cases_import()
    test_manual_override_import()
    test_get_records()
    test_get_single_record()
    
    print('🎉 所有测试完成!')
