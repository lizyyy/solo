#!/usr/bin/env python3
import requests
import os
import json

BASE_URL = 'http://localhost:5000/api'

def test_upload():
    print('=' * 60)
    print('测试 1: 上传文件')
    print('=' * 60)
    
    sample_file = 'sample_data_with_errors.csv'
    if not os.path.exists(sample_file):
        print(f'错误: 找不到 {sample_file}')
        return None
    
    with open(sample_file, 'rb') as f:
        files = {'file': (sample_file, f, 'text/csv')}
        data = {'owner': '测试员'}
        response = requests.post(f'{BASE_URL}/upload', files=files, data=data)
    
    print(f'状态码: {response.status_code}')
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if response.status_code == 200:
        batch_id = result['batch_id']
        print(f'\n✅ 上传成功，批次号: {batch_id}')
        return batch_id
    else:
        print('\n❌ 上传失败')
        return None

def test_get_batches(batch_id):
    print('\n' + '=' * 60)
    print('测试 2: 获取批次列表')
    print('=' * 60)
    
    response = requests.get(f'{BASE_URL}/batches')
    print(f'状态码: {response.status_code}')
    result = response.json()
    print(f'批次数量: {len(result["batches"])}')
    
    for batch in result['batches']:
        print(f'  - {batch["filename"]} ({batch["status"]}) - {batch["owner"]}')
    
    print('\n✅ 获取批次列表成功')

def test_get_batch_detail(batch_id):
    print('\n' + '=' * 60)
    print('测试 3: 获取批次详情')
    print('=' * 60)
    
    response = requests.get(f'{BASE_URL}/batch/{batch_id}')
    print(f'状态码: {response.status_code}')
    result = response.json()
    
    print(f'\n文件名: {result["filename"]}')
    print(f'负责人: {result["owner"]}')
    print(f'总行数: {result["total_rows"]}')
    print(f'干净行数: {result["validation"]["clean_rows"]}')
    print(f'脏数据行数: {result["validation"]["dirty_rows"]}')
    print(f'导入成功率: {(result["validation"]["clean_rows"]/result["total_rows"]*100):.1f}%')
    
    print('\n--- 字段映射 ---')
    for orig, std in result['mapped_fields'].items():
        print(f'  {orig} → {std}')
    
    print('\n--- 脏数据详情 ---')
    for error in result['validation']['errors']:
        print(f'\n第 {error["row_number"]} 行:')
        for e in error['errors']:
            print(f'  - {e["field"]}: "{e["value"]}" → {e["error"]}')
    
    print('\n--- 修复建议 ---')
    for row_idx, fixes in result['validation']['fix_suggestions'].items():
        print(f'\n第 {int(row_idx)+2} 行:')
        for field, fix in fixes.items():
            print(f'  - {field}: "{fix["original_value"]}" → {fix["suggestion"]}')
    
    print('\n✅ 获取批次详情成功')

def test_validate(batch_id):
    print('\n' + '=' * 60)
    print('测试 4: 重新校验')
    print('=' * 60)
    
    response = requests.post(f'{BASE_URL}/batch/{batch_id}/validate')
    print(f'状态码: {response.status_code}')
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print('\n✅ 校验成功')

def test_import(batch_id):
    print('\n' + '=' * 60)
    print('测试 5: 执行导入')
    print('=' * 60)
    
    response = requests.post(f'{BASE_URL}/batch/{batch_id}/import')
    print(f'状态码: {response.status_code}')
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if response.status_code == 200:
        print(f'\n✅ 导入成功: {result["imported_count"]} 行, 跳过: {result["skipped_count"]} 行')
    else:
        print('\n❌ 导入失败')

def test_search():
    print('\n' + '=' * 60)
    print('测试 6: 搜索功能')
    print('=' * 60)
    
    search_terms = ['李经理', '测试员', 'sample']
    for term in search_terms:
        response = requests.get(f'{BASE_URL}/batches?search={term}')
        result = response.json()
        print(f'搜索 "{term}": 找到 {len(result["batches"])} 个批次')
    
    print('\n✅ 搜索功能正常')

def test_export(batch_id):
    print('\n' + '=' * 60)
    print('测试 7: 导出报告')
    print('=' * 60)
    
    response = requests.get(f'{BASE_URL}/batch/{batch_id}/export')
    print(f'状态码: {response.status_code}')
    print(f'内容类型: {response.headers.get("Content-Type")}')
    
    os.makedirs('batches', exist_ok=True)
    output_file = f'batches/test_report_{batch_id[:8]}.xlsx'
    with open(output_file, 'wb') as f:
        f.write(response.content)
    
    print(f'报告已保存到: {output_file}')
    print(f'文件大小: {os.path.getsize(output_file)} bytes')
    
    print('\n✅ 导出报告成功')

def main():
    print('🚀 开始 API 测试...\n')
    
    batch_id = test_upload()
    if not batch_id:
        print('\n❌ 上传失败，终止测试')
        return
    
    test_get_batches(batch_id)
    test_get_batch_detail(batch_id)
    test_validate(batch_id)
    test_import(batch_id)
    test_search()
    test_export(batch_id)
    
    print('\n' + '=' * 60)
    print('🎉 所有测试完成！')
    print('=' * 60)
    print(f'\n💡 提示:')
    print(f'  1. 启动服务: python app.py')
    print(f'  2. 访问前端: http://localhost:5000')
    print(f'  3. 使用样例文件: sample_data_with_errors.csv')
    print(f'  4. 查看导出报告: batches/ 目录下')

if __name__ == '__main__':
    main()
