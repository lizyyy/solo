import requests
import json


BASE_URL = "http://localhost:8000"


def test_health_check():
    """测试健康检查接口"""
    response = requests.get(f"{BASE_URL}/health")
    print("=== 健康检查 ===")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    print()


def test_batch_processing():
    """测试批次处理接口"""
    print("=== 批次处理 ===")
    
    files = {
        'declaration_csv': ('test_declarations.csv', open('test_declarations.csv', 'rb'), 'text/csv'),
        'tariff_json': ('tariff_rules.json', open('tariff_rules.json', 'rb'), 'application/json'),
        'return_receipt_json': ('return_receipts.json', open('return_receipts.json', 'rb'), 'application/json'),
    }
    data = {
        'batch_id': 'BATCH001'
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/process/batch", files=files, data=data)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n批次ID: {result['batch_id']}")
        print(f"处理状态: {result['status']}")
        print(f"消息: {result['message']}")
        
        if result['result']:
            r = result['result']
            print(f"\n=== 处理统计 ===")
            print(f"总记录数: {r['total_count']}")
            print(f"正常项: {r['normal_count']}")
            print(f"待确认: {r['pending_count']}")
            print(f"失败项: {r['failed_count']}")
            
            print(f"\n=== 币种换算说明 ===")
            for note in r['currency_notes']:
                print(f"  - {note}")
            
            print(f"\n=== 品类归并说明 ===")
            for note in r['category_notes']:
                print(f"  - {note}")
            
            print(f"\n=== 重复补税说明 ===")
            for note in r['duplicate_notes']:
                print(f"  - {note}")
            
            print(f"\n=== 失败项详情 ===")
            for item in r['failed_items']:
                print(f"\n订单ID: {item['order_id']}")
                print(f"失败类型: {item['failure_type']}")
                print(f"失败原因: {item['failure_reason']}")
                print(f"处理建议: {item['suggestion']}")
                if item['boundary_note']:
                    print(f"边界说明: {item['boundary_note']}")
            
            print(f"\n=== 待确认项详情 ===")
            for item in r['pending_items']:
                print(f"\n订单ID: {item['order_id']}")
                print(f"待确认原因: {item['pending_reason']}")
                print(f"确认建议: {item['suggestion']}")
            
            print(f"\n=== 正常项示例 ===")
            for item in r['normal_items'][:3]:
                print(f"\n订单ID: {item['order_id']}")
                print(f"商品名称: {item['product_name']}")
                print(f"人民币金额: {item['final_amount_cny']}")
                print(f"适用税率: {item['tariff_rate'] * 100}%")
                print(f"税额: {item['tariff_amount']}")
                print(f"归并品类: {item['category']}")
    print()


def test_duplicate_submission():
    """测试重复提交（幂等性）"""
    print("=== 测试重复提交 ===")
    
    files = {
        'declaration_csv': ('test_declarations.csv', open('test_declarations.csv', 'rb'), 'text/csv'),
        'tariff_json': ('tariff_rules.json', open('tariff_rules.json', 'rb'), 'application/json'),
    }
    data = {
        'batch_id': 'BATCH001'
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/process/batch", files=files, data=data)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"处理状态: {result['status']}")
        print(f"消息: {result['message']}")
    print()


def test_get_batch_result():
    """测试获取批次结果"""
    print("=== 获取批次结果 ===")
    response = requests.get(f"{BASE_URL}/api/v1/batch/BATCH001")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"批次ID: {result['batch_id']}")
        print(f"处理时间: {result['processed_at']}")
    print()


def test_get_currency_rates():
    """测试获取汇率"""
    print("=== 获取当前汇率 ===")
    response = requests.get(f"{BASE_URL}/api/v1/rules/currency-rates")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        rates = response.json()
        for currency, rate in rates.items():
            print(f"  {currency}: {rate}")
    print()


if __name__ == "__main__":
    print("=" * 60)
    print("跨境电商关务处理 API 测试")
    print("=" * 60)
    print()
    
    try:
        test_health_check()
        test_batch_processing()
        test_duplicate_submission()
        test_get_batch_result()
        test_get_currency_rates()
        
        print("=" * 60)
        print("测试完成！")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先启动服务:")
        print("  python main.py")
        print("  或")
        print("  uvicorn main:app --reload --host 0.0.0.0 --port 8000")
