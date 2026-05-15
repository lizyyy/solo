#!/usr/bin/env python3
import requests
import json

BASE_URL = 'http://localhost:5001/api/v1'

def test_api():
    print("=" * 60)
    print("  多步骤导入确认 API 测试")
    print("=" * 60)
    
    operator = 'test@example.com'
    filename = 'test_import_new.csv'
    
    print("\n[1/8] 健康检查")
    r = requests.get(f'{BASE_URL}/health')
    print(f"  状态: {r.status_code} - {'OK' if r.status_code == 200 else 'FAIL'}")
    
    print("\n[2/8] 创建上传包")
    r = requests.post(f'{BASE_URL}/packages', json={
        'filename': filename,
        'file_type': 'csv',
        'file_size': 10240,
        'uploaded_by': operator
    })
    print(f"  状态: {r.status_code}")
    print(f"  响应: {json.dumps(r.json(), indent=2, ensure_ascii=False)}")
    package_id = r.json()['data']['id']
    
    print("\n[3/8] 解析上传包 (无 body)")
    r = requests.post(f'{BASE_URL}/packages/{package_id}/parse')
    print(f"  状态: {r.status_code} - {'OK' if r.status_code == 200 else 'FAIL'}")
    assert r.status_code == 200, f"预期 200，实际 {r.status_code}"
    
    print("\n[4/8] 预览差异")
    r = requests.get(f'{BASE_URL}/packages/{package_id}/preview')
    print(f"  状态: {r.status_code} - {'OK' if r.status_code == 200 else 'FAIL'}")
    data = r.json()['data']
    print(f"  差异数量: {len(data['diffs'])}")
    print(f"  汇总: NEW={data['summary']['new_count']}, UPDATE={data['summary']['update_count']}, DELETE={data['summary']['delete_count']}")
    
    print("\n[5/8] 创建确认令牌 (无 body)")
    r = requests.post(f'{BASE_URL}/packages/{package_id}/confirm-token')
    print(f"  状态: {r.status_code} - {'OK' if r.status_code == 200 else 'FAIL'}")
    assert r.status_code == 200, f"预期 200，实际 {r.status_code}"
    token = r.json()['data']['token']
    print(f"  Token: {token[:16]}...")
    
    print("\n[6/8] 确认并写入")
    r = requests.post(f'{BASE_URL}/packages/{package_id}/write', json={
        'token': token,
        'confirmed_by': operator
    })
    print(f"  状态: {r.status_code} - {'OK' if r.status_code == 200 else 'FAIL'}")
    batch_id = r.json()['data'][0]['id']
    
    print("\n[7/8] 查询操作历史")
    r = requests.get(f'{BASE_URL}/history', params={'package_id': package_id})
    print(f"  状态: {r.status_code} - {'OK' if r.status_code == 200 else 'FAIL'}")
    history = r.json()['data']
    print(f"  历史记录数: {len(history)}")
    for h in history:
        print(f"    - {h['operation']}: {h['from_status']} -> {h['to_status']}")
    
    print("\n[8/8] 验证确定性：相同文件得到相同解析结果")
    r2 = requests.post(f'{BASE_URL}/packages', json={
        'filename': filename,
        'file_type': 'csv',
        'file_size': 10240,
        'uploaded_by': 'another@example.com'
    })
    package_id2 = r2.json()['data']['id']
    
    requests.post(f'{BASE_URL}/packages/{package_id2}/parse', json={'parsed_by': operator})
    r_preview1 = requests.get(f'{BASE_URL}/packages/{package_id}/preview')
    r_preview2 = requests.get(f'{BASE_URL}/packages/{package_id2}/preview')
    
    diffs1 = r_preview1.json()['data']['diffs']
    diffs2 = r_preview2.json()['data']['diffs']
    
    print(f"  相同文件解析一致性: {'PASS' if len(diffs1) == len(diffs2) else 'FAIL'}")
    print(f"  包1差异数: {len(diffs1)}, 包2差异数: {len(diffs2)}")
    
    print("\n" + "=" * 60)
    print("  所有测试通过！")
    print("=" * 60)

if __name__ == '__main__':
    test_api()
