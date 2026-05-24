import sys
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def run_test(test_name, test_func):
    print(f"\n{'='*60}")
    print(f"测试: {test_name}")
    print(f"{'='*60}")
    try:
        result = test_func()
        if result:
            print(f"✅ 测试通过")
            return True
        else:
            print(f"❌ 测试失败")
            return False
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        return False


def test_health_check():
    response = requests.get(f"{BASE_URL}/health")
    if response.status_code == 200:
        data = response.json()
        print(f"服务状态: {data['status']}")
        return data['status'] == 'healthy'
    return False


def test_create_barrel():
    payload = {
        "barrel_code": "TEST-BARREL-001",
        "location": "测试区-001",
        "capacity": 225.0,
        "current_volume": 0.0
    }
    response = requests.post(f"{BASE_URL}/barrels/", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"创建桶: {data['barrel_code']}")
        return True
    elif response.status_code == 400 and "已存在" in response.json()['detail']:
        print("桶已存在（预期）")
        return True
    return False


def test_create_batch():
    payload = {
        "batch_code": "TEST-BATCH-001",
        "wine_type": "测试赤霞珠",
        "vintage": 2024,
        "initial_volume": 1000.0,
        "remaining_volume": 1000.0
    }
    response = requests.post(f"{BASE_URL}/batches/", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"创建批次: {data['batch_code']}")
        return True
    elif response.status_code == 400 and "已存在" in response.json()['detail']:
        print("批次已存在（预期）")
        return True
    return False


def test_batch_validation_block():
    payload = {
        "barrel_code": "TEST-BARREL-001",
        "source_batch_code": "TEST-BATCH-001",
        "evaporation_volume": 2.5,
        "topping_volume": 2.5,
        "topping_date": datetime.now().isoformat(),
        "operator": "测试操作员",
        "notes": "测试批次错配拦截"
    }
    response = requests.post(f"{BASE_URL}/toppings/", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"批次错配拦截状态: {data['success']}")
        print(f"拦截信息: {data['message']}")
        return not data['success'] and "批次" in data['message']
    return False


def test_inspection_interception():
    response = requests.post(f"{BASE_URL}/toppings/TOP-SEED-001/approve")
    if response.status_code == 200:
        data = response.json()
        print(f"放行结果: {data['success']}")
        print(f"信息: {data['message']}")
        return True
    return False


def test_query_toppings():
    response = requests.get(f"{BASE_URL}/toppings/")
    if response.status_code == 200:
        data = response.json()
        print(f"查询到 {len(data)} 条添酒记录")
        if data:
            record = data[0]
            print(f"记录有效性说明: {record.get('validity_explanation', 'N/A')}")
        return True
    return False


def test_export_csv():
    response = requests.get(f"{BASE_URL}/toppings/export/csv")
    if response.status_code == 200:
        content = response.text
        lines = content.strip().split('\n')
        print(f"导出 CSV 行数: {len(lines)}")
        print(f"表头: {lines[0][:80]}...")
        return len(lines) > 1
    return False


def run_all_tests():
    print("\n" + "="*60)
    print("酒庄橡木桶添酒 API - 轻量自检")
    print("="*60)

    tests = [
        ("健康检查", test_health_check),
        ("创建橡木桶", test_create_barrel),
        ("创建酒液批次", test_create_batch),
        ("批次错配拦截", test_batch_validation_block),
        ("检验后放行", test_inspection_interception),
        ("查询添酒记录", test_query_toppings),
        ("导出 CSV 报告", test_export_csv),
    ]

    results = []
    for test_name, test_func in tests:
        results.append(run_test(test_name, test_func))

    passed = sum(results)
    total = len(results)

    print("\n" + "="*60)
    print(f"自检结果: {passed}/{total} 测试通过")
    print("="*60)

    if passed == total:
        print("🎉 所有测试通过！服务运行正常。")
        return 0
    else:
        print("⚠️  部分测试失败，请检查服务状态。")
        return 1


if __name__ == "__main__":
    try:
        sys.exit(run_all_tests())
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务器")
        print("请先启动服务: uvicorn main:app --reload")
        sys.exit(1)
