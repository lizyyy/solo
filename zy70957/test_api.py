#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

session = requests.Session()
session.trust_env = False


def test_upload_all():
    print("=" * 60)
    print("测试1：上传所有样例数据")
    print("=" * 60)

    files = {
        'repair_csv': ('repairs.csv', open('sample_data/repairs.csv', 'rb')),
        'worker_json': ('workers.json', open('sample_data/workers.json', 'rb')),
        'rating_json': ('ratings.json', open('sample_data/ratings.json', 'rb')),
    }

    response = session.post(f"{BASE_URL}/api/upload", files=files)
    result = response.json()

    print(f"\n批次ID: {result['batch_id']}")
    print(f"处理时间: {result['process_time']}")
    print(f"总计: {result['total_count']} 条")
    print(f"  - 正常: {result['normal_count']} 条")
    print(f"  - 待确认: {result['pending_count']} 条")
    print(f"  - 失败: {result['failed_count']} 条")

    print("\n" + "-" * 60)
    print("失败记录详情：")
    print("-" * 60)
    for record in result['failed_records']:
        print(f"\n【{record['record_type']}】{record['original_data'].get('repair_id') or record['original_data'].get('worker_id') or record['original_data'].get('rating_id')}")
        print(f"  原因: {record['reason']}")
        print(f"  建议: {record['suggestion']}")

    print("\n" + "-" * 60)
    print("待确认记录详情：")
    print("-" * 60)
    for record in result['pending_records']:
        print(f"\n【{record['record_type']}】{record['original_data'].get('repair_id') or record['original_data'].get('worker_id') or record['original_data'].get('rating_id')}")
        print(f"  原因: {record['reason']}")
        print(f"  建议: {record['suggestion']}")
        print(f"  原始数据: {json.dumps(record['original_data'], ensure_ascii=False)[:100]}...")

    return result['batch_id']


def test_idempotency():
    print("\n" + "=" * 60)
    print("测试2：幂等性验证 - 重复提交相同数据")
    print("=" * 60)

    files = {
        'repair_csv': ('repairs.csv', open('sample_data/repairs.csv', 'rb')),
    }

    print("\n第一次提交...")
    response1 = session.post(f"{BASE_URL}/api/upload", files=files)
    result1 = response1.json()
    print(f"批次ID: {result1['batch_id']}")
    print(f"记录数: 总计={result1['total_count']}, 正常={result1['normal_count']}")

    files = {
        'repair_csv': ('repairs.csv', open('sample_data/repairs.csv', 'rb')),
    }

    print("\n第二次提交（相同数据）...")
    response2 = session.post(f"{BASE_URL}/api/upload", files=files)
    result2 = response2.json()
    print(f"批次ID: {result2['batch_id']}")

    if result1['batch_id'] == result2['batch_id']:
        print("✓ 幂等性验证通过：相同数据产生相同批次ID")
        if result2['normal_count'] == 0 and result2['pending_count'] == 0 and result2['failed_count'] == 0:
            print("✓ 重复提交未产生新的处理记录")
        else:
            print("⚠ 注意：重复提交处理结果有数据")
    else:
        print("✗ 幂等性验证失败")


def test_clear_and_list():
    print("\n" + "=" * 60)
    print("测试3：清空数据和查询批次列表")
    print("=" * 60)

    print("\n当前批次列表：")
    response = session.get(f"{BASE_URL}/api/batches")
    batches = response.json()
    for b in batches:
        print(f"  - {b['batch_id'][:8]}...: 总计{b['total_count']}条, 状态: {b['status']}")

    print("\n清空历史数据...")
    response = session.post(f"{BASE_URL}/api/clear")
    print(f"响应: {response.json()}")

    print("\n清空后批次列表：")
    response = session.get(f"{BASE_URL}/api/batches")
    batches = response.json()
    print(f"批次数量: {len(batches)}")


def main():
    try:
        response = session.get(f"{BASE_URL}/")
        print(f"服务状态: {response.json()['message']}")
    except:
        print("错误：无法连接到服务，请先运行: python -m app.main")
        return

    test_upload_all()
    test_idempotency()
    test_clear_and_list()

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    print("\n完整API文档请访问: http://localhost:8000/docs")


if __name__ == "__main__":
    main()
