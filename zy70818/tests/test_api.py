#!/usr/bin/env python3
"""测试API接口"""

import sys
sys.path.insert(0, '.')

import main
from fastapi.testclient import TestClient

client = TestClient(main.app)


def test_api():
    print("=" * 50)
    print("API接口测试")
    print("=" * 50)

    print("\n1. 测试根路由...")
    response = client.get('/')
    assert response.status_code == 200
    print(f"   ✓ {response.status_code} - {response.json()['message']}")

    print("\n2. 导入库存数据...")
    with open('data/sample_inventory.csv', 'rb') as f:
        r = client.post('/api/inventory/import', files={'file': ('inventory.csv', f, 'text/csv')})
    assert r.status_code == 200
    print(f"   ✓ 导入 {r.json()['count']} 条记录")

    print("\n3. 导入召回公告...")
    with open('data/sample_recall.md', 'rb') as f:
        r = client.post('/api/recall/import', files={'file': ('recall.md', f, 'text/markdown')})
    assert r.status_code == 200
    print(f"   ✓ {r.json()['message']}")

    print("\n4. 导入消耗数据...")
    with open('data/sample_consumption.csv', 'rb') as f:
        r = client.post('/api/consumption/import', files={'file': ('consumption.csv', f, 'text/csv')})
    assert r.status_code == 200
    print(f"   ✓ 导入 {r.json()['count']} 条记录")

    print("\n5. 执行对账...")
    r = client.post('/api/reconciliation/run', json={
        'name': 'API测试对账',
        'start_date': '2024-01-01',
        'end_date': '2024-01-31'
    })
    assert r.status_code == 200
    data = r.json()
    print(f"   ✓ 对账任务ID: {data['reconciliation_id']}")
    print(f"   ✓ 总差异: {data['summary']['total_discrepancies']}")
    print(f"   ✓ 召回批号: {data['summary']['recalled_count']}")
    print(f"   ✓ 调拨: {data['summary']['transfer_count']}")

    recon_id = data['reconciliation_id']

    print("\n6. 获取对账详情...")
    r = client.get(f'/api/reconciliation/{recon_id}')
    assert r.status_code == 200
    print(f"   ✓ 对账状态: {r.json()['status']}")

    print("\n7. 获取差异列表...")
    r = client.get(f'/api/reconciliation/{recon_id}/discrepancies')
    assert r.status_code == 200
    discrepancies = r.json()['discrepancies']
    print(f"   ✓ 共 {r.json()['count']} 条差异")

    print("\n8. 复核差异...")
    if discrepancies:
        disc = discrepancies[0]
        r = client.post(f'/api/reconciliation/{recon_id}/discrepancies/{disc["id"]}/review', json={
            'action': '确认差异',
            'notes': 'API测试复核',
            'reviewed_by': '测试用户'
        })
        assert r.status_code == 200
        print(f"   ✓ {r.json()['message']}")

    print("\n9. 预览报告...")
    r = client.get(f'/api/report/{recon_id}/preview')
    assert r.status_code == 200
    print(f"   ✓ 报告标题: {r.json()['title']}")

    print("\n10. 生成Excel报告...")
    r = client.post(f'/api/report/{recon_id}/generate?report_type=汇总报告&report_format=xlsx')
    assert r.status_code == 200
    print(f"   ✓ 文件: {r.json()['file_path'].split('/')[-1]}")
    print(f"   ✓ 大小: {r.json()['file_size']} bytes")

    print("\n" + "=" * 50)
    print("所有API测试通过! ✓")
    print("=" * 50)


if __name__ == '__main__':
    import os
    for f in os.listdir('data'):
        if f.endswith('.json'):
            os.remove(os.path.join('data', f))
    
    test_api()
