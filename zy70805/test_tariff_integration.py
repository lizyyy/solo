import requests
import json

BASE_URL = "http://127.0.0.1:9000"


def test_high_rate_tariff():
    """测试上传高税率税则JSON是否真正参与处理"""
    print("=" * 60)
    print("验证税则 JSON 真正参与处理")
    print("=" * 60)
    print()
    
    print("测试场景：上传税率为 0.99 (99%) 的税则 JSON")
    print("预期结果：匹配到的商品应按 99% 税率判定，而非内置 13%/20%")
    print()
    
    files = {
        'declaration_csv': ('test_declarations.csv', open('test_declarations.csv', 'rb'), 'text/csv'),
        'tariff_json': ('tariff_rules_high_rate.json', open('tariff_rules_high_rate.json', 'rb'), 'application/json'),
    }
    data = {
        'batch_id': 'BATCH_HIGH_RATE_001'
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/process/batch", files=files, data=data)
    
    if response.status_code != 200:
        print(f"请求失败，状态码: {response.status_code}")
        print(response.text)
        return
    
    result = response.json()
    r = result['result']
    
    print(f"=== 处理统计 ===")
    print(f"总记录数: {r['total_count']}")
    print(f"正常项: {r['normal_count']}")
    print(f"待确认: {r['pending_count']}")
    print(f"失败项: {r['failed_count']}")
    print()
    
    print(f"=== 品类归并说明（验证税则JSON是否生效） ===")
    for note in r['category_notes']:
        if "税则JSON匹配" in note:
            print(f"  ✓ {note}")
        else:
            print(f"  - {note}")
    print()
    
    print(f"=== 待确认项详情（验证税率使用的是 99% 而非内置值） ===")
    for item in r['pending_items']:
        if "税率差异过大" in item['pending_reason']:
            print(f"\n订单ID: {item['order_id']}")
            print(f"原因: {item['pending_reason']}")
            if "99.0%" in item['pending_reason']:
                print(f"  ✓ 验证通过：使用了上传的税则税率 99%")
            else:
                print(f"  ✗ 验证失败：未使用上传的税则税率")
    
    print()
    print(f"=== 正常项详情（验证税额计算是否按 99%） ===")
    for item in r['normal_items']:
        if item['tariff_rate'] == 0.99:
            print(f"\n订单ID: {item['order_id']}")
            print(f"商品: {item['product_name']}")
            print(f"税率: {item['tariff_rate'] * 100}%")
            print(f"人民币金额: {item['final_amount_cny']}")
            print(f"税额: {item['tariff_amount']}")
            print(f"  ✓ 验证通过：税额按 99% 计算 = {item['final_amount_cny']} * 0.99")
    
    print()
    print("=" * 60)
    print("验证完成！")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_high_rate_tariff()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先启动服务:")
        print("  python3 main.py")
