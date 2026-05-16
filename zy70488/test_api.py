#!/usr/bin/env python3
"""
API路由测试脚本
"""

from fastapi.testclient import TestClient
import main

client = TestClient(main.app)

def test_all_routes():
    print("=" * 60)
    print("API路由测试")
    print("=" * 60)
    
    # 1. 健康检查
    print("\n1. 健康检查接口")
    r = client.get('/health')
    print(f"   GET /health: {r.status_code}")
    assert r.status_code == 200, "健康检查失败"
    
    # 2. 执行去重
    print("\n2. 去重接口")
    r = client.post('/api/receipt/deduplicate')
    print(f"   POST /api/receipt/deduplicate: {r.status_code}")
    assert r.status_code == 200, "去重接口失败"
    data = r.json()
    print(f"   - 处理总数: {data['total_processed']}")
    print(f"   - 发现重复: {data['duplicates_found']}")
    print(f"   - 口径变更: {data['caliber_changed_records']}")
    
    # 3. 查询重复记录
    print("\n3. 查询重复记录接口")
    r = client.get('/api/receipt/duplicates')
    print(f"   GET /api/receipt/duplicates: {r.status_code}")
    assert r.status_code == 200, "查询重复记录失败"
    print(f"   - 返回 {len(r.json())} 条记录")
    
    # 4. 查询异常记录
    print("\n4. 查询异常记录接口")
    r = client.get('/api/receipt/abnormal')
    print(f"   GET /api/receipt/abnormal: {r.status_code}")
    assert r.status_code == 200, "查询异常记录失败"
    print(f"   - 返回 {len(r.json())} 条记录")
    
    # 5. 查询统计信息
    print("\n5. 查询统计信息接口")
    r = client.get('/api/receipt/statistics')
    print(f"   GET /api/receipt/statistics: {r.status_code}")
    assert r.status_code == 200, "查询统计信息失败"
    data = r.json()
    print(f"   - 总记录: {data['total_records']}")
    
    # 6. 原始ID回溯
    print("\n6. 原始ID回溯接口")
    r = client.get('/api/receipt/original/ORIG000000')
    print(f"   GET /api/receipt/original/ORIG000000: {r.status_code}")
    assert r.status_code == 200, "原始ID回溯失败"
    data = r.json()
    print(f"   - 设备名称: {data['device_name']}")
    
    # 7. 按审批节点查询
    print("\n7. 按审批节点查询接口")
    r = client.get('/api/receipt/by-approval-node/%E8%B4%A2%E5%8A%A1%E5%AE%A1%E6%A0%B8')
    print(f"   GET /api/receipt/by-approval-node/财务审核: {r.status_code}")
    assert r.status_code == 200, "按审批节点查询失败"
    print(f"   - 返回 {len(r.json())} 条记录")
    
    # 8. 批量预览
    print("\n8. 批量预览接口")
    preview_data = {
        'file_names': [],
        'deduplication_fields': ['receipt_number', 'device_code'],
        'enable_caliber_check': True
    }
    r = client.post('/api/preview/batch', json=preview_data)
    print(f"   POST /api/preview/batch: {r.status_code}")
    assert r.status_code == 200, "批量预览失败"
    data = r.json()
    print(f"   - 总记录: {data['total_records']}")
    print(f"   - 影响门店: {len(data['affected_stores'])}")
    
    # 9. 导出异常记录
    print("\n9. 导出异常记录接口")
    r = client.post('/api/export/abnormal')
    print(f"   POST /api/export/abnormal: {r.status_code}")
    assert r.status_code == 200, "导出异常记录失败"
    data = r.json()
    print(f"   - 导出文件: {data['file_path']}")
    print(f"   - 导出数量: {data['record_count']}")
    
    # 10. 按审批节点导出
    print("\n10. 按审批节点导出接口")
    r = client.post('/api/export/by-approval-node/%E8%B4%A2%E5%8A%A1%E5%AE%A1%E6%A0%B8')
    print(f"   POST /api/export/by-approval-node/财务审核: {r.status_code}")
    assert r.status_code == 200, "按审批节点导出失败"
    data = r.json()
    print(f"   - 导出数量: {data['record_count']}")
    
    # 11. 导出口径变更记录
    print("\n11. 出口径变更记录接口")
    r = client.post('/api/export/caliber-changed')
    print(f"   POST /api/export/caliber-changed: {r.status_code}")
    assert r.status_code == 200, "出口径变更记录失败"
    data = r.json()
    print(f"   - 导出数量: {data['record_count']}")
    
    print("\n" + "=" * 60)
    print("✅ 所有API路由测试通过！")
    print("=" * 60)
    
    # 打印所有可用路由
    print("\n📋 所有可用API路由:")
    routes = sorted([route.path for route in main.app.routes if '/api/' in route.path])
    for route in routes:
        print(f"   - {route}")

if __name__ == "__main__":
    test_all_routes()
