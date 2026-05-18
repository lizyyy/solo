import sys
sys.path.insert(0, '.')
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

print("=" * 50)
print("开始 API 功能测试")
print("=" * 50)

# 测试根路径
print("\n1. 测试根路径...")
response = client.get('/')
print(f"   状态码: {response.status_code}")
print(f"   服务名称: {response.json()['message']}")

# 测试查询列表
print("\n2. 测试查询列表...")
response = client.get('/api/cutting-queue/')
print(f"   状态码: {response.status_code}")
print(f"   返回记录数: {len(response.json())}")

# 测试按状态筛选
print("\n3. 测试按状态筛选 (status=pending)...")
response = client.get('/api/cutting-queue/?status=pending')
print(f"   状态码: {response.status_code}")
print(f"   pending状态记录数: {len(response.json())}")

# 测试按门店筛选
print("\n4. 测试按门店筛选 (store_name=北京)...")
response = client.get('/api/cutting-queue/?store_name=北京')
print(f"   状态码: {response.status_code}")
print(f"   北京门店记录数: {len(response.json())}")

# 测试按负责人筛选
print("\n5. 测试按负责人筛选 (assigned_to=王师傅)...")
response = client.get('/api/cutting-queue/?assigned_to=王师傅')
print(f"   状态码: {response.status_code}")
print(f"   王师傅负责记录数: {len(response.json())}")

# 测试按日期筛选
print("\n6. 测试按日期筛选...")
response = client.get('/api/cutting-queue/?start_date=2024-05-15&end_date=2024-05-20')
print(f"   状态码: {response.status_code}")
print(f"   日期范围内记录数: {len(response.json())}")

# 测试创建记录
print("\n7. 测试创建记录...")
new_order = {
    'order_no': 'CQ20240518TEST',
    'customer_name': '测试用户',
    'store_name': '测试门店',
    'salesperson': '测试销售',
    'order_date': '2024-05-18',
    'delivery_date': '2024-06-01',
    'board_type': '颗粒板',
    'board_color': '白色',
    'board_thickness': 18.0,
    'board_length': 2440,
    'board_width': 1220,
    'required_pieces': 20,
    'cut_pieces': 0,
    'remaining_pieces': 20,
    'material_code': 'TEST-001',
    'priority': 5,
    'status': 'pending',
    'is_urgent': False,
    'has_remaining_material': False
}
response = client.post('/api/cutting-queue/', json=new_order)
print(f"   状态码: {response.status_code}")
record_id = None
if response.status_code == 200:
    data = response.json()
    print(f"   创建成功 - 订单号: {data['order_no']}, 版本: {data['version']}")
    record_id = data['id']

# 测试修改记录
if record_id:
    print("\n8. 测试修改记录...")
    update_data = {'status': 'queued', 'remarks': '已排队处理', 'updated_by': 'test_operator'}
    response = client.put(f'/api/cutting-queue/{record_id}', json=update_data)
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   修改成功 - 状态: {data['status']}, 新版本: {data['version']}")

# 测试批量导入
print("\n9. 测试批量导入...")
batch_data = [
    {
        'order_no': 'CQ20240518BATCH1',
        'customer_name': '批量测试1',
        'store_name': '批量门店',
        'salesperson': '批量销售',
        'order_date': '2024-05-18',
        'delivery_date': '2024-06-01',
        'board_type': '多层板',
        'board_color': '红色',
        'board_thickness': 18.0,
        'board_length': 2440,
        'board_width': 1220,
        'required_pieces': 25,
        'remaining_pieces': 25,
        'material_code': 'BATCH-001',
        'material_location': 'A区-01-03',
        'has_remaining_material': True
    },
    {
        'order_no': 'CQ20240518001',
        'customer_name': '重复订单',
        'store_name': '测试门店',
        'salesperson': '测试',
        'order_date': '2024-05-18',
        'delivery_date': '2024-06-01',
        'board_type': '颗粒板',
        'board_color': '白色',
        'board_thickness': 18.0,
        'board_length': 2440,
        'board_width': 1220,
        'required_pieces': 10,
        'remaining_pieces': 10,
        'material_code': 'TEST-DUP'
    }
]
response = client.post('/api/cutting-queue/batch-import', json=batch_data)
print(f"   状态码: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"   总计: {data['total']}, 成功: {data['success_count']}, 失败: {data['failed_count']}")
    for result in data['results']:
        print(f"   - 第{result['row']}行: {result['order_no']} - {'成功' if result['success'] else '失败'} - {result['message']}")

# 测试导出功能
print("\n10. 测试导出功能...")
response = client.get('/api/cutting-queue/export')
print(f"   状态码: {response.status_code}")
print(f"   Content-Type: {response.headers.get('Content-Type')}")

print("\n" + "=" * 50)
print("所有 API 测试完成！")
print("=" * 50)
