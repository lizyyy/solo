import requests
import json

BASE_URL = "http://localhost:8000"

def test_api():
    print("=" * 60)
    print("药企QA样品管理系统 - API测试脚本")
    print("=" * 60)

    print("\n1. 检查服务状态...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"   服务状态: {response.json()['status']}")
    except:
        print("   错误: 服务未启动，请先运行 'uvicorn app.main:app --reload'")
        return

    print("\n2. 提交样品数据进行验证...")
    files = {
        'samples_file': open('test_data/samples.csv', 'rb'),
        'plans_file': open('test_data/test_plans.json', 'rb'),
        'chamber_file': open('test_data/chamber_records.json', 'rb')
    }

    response = requests.post(f"{BASE_URL}/api/validate", files=files)
    result = response.json()

    print(f"\n3. 验证结果汇总:")
    print(f"   提交总数: {result['summary']['total_submitted']}")
    print(f"   正常项: {result['summary']['normal_count']}")
    print(f"   待确认项: {result['summary']['pending_confirmation_count']}")
    print(f"   失败项: {result['summary']['failed_count']}")
    print(f"   跳过重复: {result['summary']['duplicates_skipped_count']}")

    if result['normal']:
        print(f"\n4. 正常样品详情:")
        for item in result['normal']:
            print(f"   - 样品ID: {item['sample_id']}, 批次: {item['batch_id']}")

    if result['pending_confirmation']:
        print(f"\n5. 待确认样品详情:")
        for item in result['pending_confirmation']:
            print(f"   - 样品ID: {item['sample_id']}, 批次: {item['batch_id']}")
            for failure in item['failures']:
                print(f"     * {failure['description']}")
                print(f"       边界信息: {failure['boundary_info']}")
                print(f"       处理建议: {failure['suggestion']}")

    if result['failed']:
        print(f"\n6. 失败样品详情:")
        for item in result['failed']:
            print(f"   - 样品ID: {item['sample_id']}, 批次: {item['batch_id']}")
            for failure in item['failures']:
                print(f"     * {failure['description']}")
                print(f"       边界信息: {failure['boundary_info']}")
                print(f"       处理建议: {failure['suggestion']}")

    if result['duplicates_skipped']:
        print(f"\n7. 跳过的重复批次:")
        for dup in result['duplicates_skipped']:
            print(f"   - {dup}")

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    test_api()
