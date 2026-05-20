import requests
import json

BASE_URL = "http://localhost:8000"


def test_allocate_bills():
    print("=== 测试分摊接口 ===")
    
    files = {
        'meter_file': open('sample_data/meter_data.csv', 'rb'),
        'contract_file': open('sample_data/contracts.json', 'rb'),
        'zone_file': open('sample_data/zones.csv', 'rb')
    }
    
    data = {
        'batch_id': 'BATCH_202401'
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/allocate", files=files, data=data)
    
    for f in files.values():
        f.close()
    
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n批次ID: {result['batch_id']}")
        print(f"总记录数: {result['total_records']}")
        print(f"成功: {result['success_count']}")
        print(f"待确认: {result['pending_count']}")
        print(f"失败: {result['failed_count']}")
        
        print("\n=== 成功项示例 ===")
        for item in result['success_items'][:2]:
            print(f"  {item['tenant_name']} - 原始: {item['original_kwh']}kWh, 分摊: {item['allocated_kwh']:.2f}kWh, 金额: {item['amount']:.2f}元")
            print(f"  来源追溯: {item['source_trace']}")
        
        print("\n=== 待确认项示例 ===")
        for item in result['pending_items'][:2]:
            print(f"  {item['meter_id']} - 状态: {item['status']}")
            print(f"  错误: {item['error_message']}")
            print(f"  建议: {item['suggestions']}")
            print(f"  来源追溯: {item['source_trace']}")
        
        print("\n=== 失败项示例 ===")
        for item in result['failed_items'][:2]:
            print(f"  {item['meter_id']} - 状态: {item['status']}")
            print(f"  错误: {item['error_message']}")
            print(f"  建议: {item['suggestions']}")
            print(f"  原始数据: {item['raw_data']}")
        
        print(f"\n汇总: {result['summary']}")
    else:
        print(f"错误: {response.text}")


def test_duplicate_batch():
    print("\n=== 测试重复提交（幂等性）===")
    
    files = {
        'meter_file': open('sample_data/meter_data.csv', 'rb'),
        'contract_file': open('sample_data/contracts.json', 'rb'),
        'zone_file': open('sample_data/zones.csv', 'rb')
    }
    
    data = {
        'batch_id': 'BATCH_202401'
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/allocate", files=files, data=data)
    
    for f in files.values():
        f.close()
    
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.text}")


def test_list_batches():
    print("\n=== 测试批次列表 ===")
    
    response = requests.get(f"{BASE_URL}/api/v1/batches")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        batches = response.json()
        print(f"批次数量: {len(batches)}")
        for batch in batches:
            print(f"  {batch['batch_id']} - {batch['processed_at'][:19]} - 成功:{batch['success_count']} 待确认:{batch['pending_count']} 失败:{batch['failed_count']}")


def test_tenant_history():
    print("\n=== 测试租户历史追溯 ===")
    
    response = requests.get(f"{BASE_URL}/api/v1/tenant/T001/history")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        history = response.json()
        print(f"租户ID: {history['tenant_id']}")
        print(f"总批次: {history['total_batches']}")
        print(f"总记录数: {history['total_records']}")
        print(f"总金额: {history['total_amount']:.2f}元")
        print(f"\n记录数: {len(history['records'])}")
        for record in history['records'][:1]:
            print(f"  批次: {record['batch_id']}")
            print(f"  分摊明细: {record['record']['allocated_kwh']:.2f}kWh, {record['record']['amount']:.2f}元")
            print(f"  来源追溯: {record['record']['source_trace']}")


def test_health():
    print("\n=== 健康检查 ===")
    response = requests.get(f"{BASE_URL}/health")
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")


if __name__ == "__main__":
    test_health()
    test_allocate_bills()
    test_duplicate_batch()
    test_list_batches()
    test_tenant_history()
    
    print("\n=== 测试完成 ===")
