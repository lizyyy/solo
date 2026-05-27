#!/usr/bin/env python3
import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

session = requests.Session()
session.trust_env = False


def test_room_number_fix():
    print("【测试1】房间号类型检查修复")
    print("-" * 50)

    session.post(f"{BASE_URL}/api/clear")

    with open('sample_data/repairs.csv', 'rb') as f1, \
         open('sample_data/workers.json', 'rb') as f2, \
         open('sample_data/ratings.json', 'rb') as f3:

        files = {
            'repair_csv': ('repairs.csv', f1),
            'worker_json': ('workers.json', f2),
            'rating_json': ('ratings.json', f3),
        }

        response = session.post(f"{BASE_URL}/api/upload", files=files)
        result = response.json()

    repair_records = [r for r in result['normal_records'] + result['pending_records'] + result['failed_records']
                      if r['record_type'] == 'repair']

    room_issue_count = sum(1 for r in repair_records
                           if r['reason'] and '房间号缺失' in r['reason'])

    print(f"判定为'房间号缺失'的记录数: {room_issue_count}")

    r001 = next((r for r in repair_records
                 if r['original_data'].get('repair_id') == 'R001'
                 and r['original_data'].get('room') == 301), None)

    if r001:
        print(f"R001(301数字房间号)状态: {r001['status']}, 原因: {r001['reason']}")

    assert room_issue_count <= 2, f"房间号缺失记录过多，应该只有R010等真正缺失的，实际有{room_issue_count}条"

    print("✓ 房间号类型检查修复验证通过")
    return result


def test_malicious_rating_order(result):
    print("\n【测试2】恶意评分检测顺序修复")
    print("-" * 50)

    rating_records = [r for r in result['normal_records'] + result['pending_records'] + result['failed_records']
                      if r['record_type'] == 'rating']

    t004 = next((r for r in rating_records
                 if r['original_data'].get('rating_id') == 'T004'), None)

    if t004:
        print(f"T004(1分'差')状态: {t004['status']}, 原因: {t004['reason']}")
        assert t004['status'] == 'failed', "T004应该被判定为恶意评分而失败"
        assert '恶意评分' in t004['reason'], "T004应该命中恶意评分检测"
        print("✓ 恶意评分检测顺序修复验证通过")
    else:
        print("⚠ 未找到T004记录")


def test_timeout_penalty_tracking(result):
    print("\n【测试3】超时罚分扣分追踪")
    print("-" * 50)

    repair_records = [r for r in result['normal_records'] + result['pending_records'] + result['failed_records']
                      if r['record_type'] == 'repair']

    r003 = next((r for r in repair_records
                 if r['original_data'].get('repair_id') == 'R003'), None)

    if r003:
        print(f"R003状态: {r003['status']}")
        print(f"R003原因: {r003['reason']}")

        if r003['reason'] and '超时' in r003['reason']:
            print("✓ R003超时罚分已记录")
        else:
            print("R003未超时或无需罚分（提交01-17 08:45，完成01-18 11:00，间隔约26小时）")


def test_key_records_classification(result):
    print("\n【测试4】核心记录分类验证")
    print("-" * 50)

    print(f"总计: {result['total_count']} 条")
    print(f"  正常: {result['normal_count']} 条")
    print(f"  待确认: {result['pending_count']} 条")
    print(f"  失败: {result['failed_count']} 条")

    failed_ids = []
    for r in result['failed_records']:
        oid = (r['original_data'].get('repair_id') or
               r['original_data'].get('worker_id') or
               r['original_data'].get('rating_id'))
        failed_ids.append(oid)
        print(f"  失败: {oid} - {r['reason']}")

    assert 'R001' in failed_ids, "R001重复报修应该被判定为失败"
    assert 'W001' in failed_ids, "W001重复注册应该被判定为失败"

    print("\n待确认记录:")
    for r in result['pending_records'][:5]:
        oid = (r['original_data'].get('repair_id') or
               r['original_data'].get('worker_id') or
               r['original_data'].get('rating_id'))
        print(f"  待确认: {oid} - {r['reason']}")

    print("✓ 核心记录分类验证通过")


def test_idempotency():
    print("\n【测试5】幂等性验证")
    print("-" * 50)

    with open('sample_data/repairs.csv', 'rb') as f:
        files = {'repair_csv': ('repairs.csv', f)}
        response1 = session.post(f"{BASE_URL}/api/upload", files=files)
        result1 = response1.json()

    batch_id_1 = result1['batch_id']
    print(f"第一次提交批次ID: {batch_id_1[:16]}...")

    with open('sample_data/repairs.csv', 'rb') as f:
        files = {'repair_csv': ('repairs.csv', f)}
        response2 = session.post(f"{BASE_URL}/api/upload", files=files)
        result2 = response2.json()

    batch_id_2 = result2['batch_id']
    print(f"第二次提交批次ID: {batch_id_2[:16]}...")

    assert batch_id_1 == batch_id_2, "相同数据应该产生相同批次ID"
    print("✓ 幂等性验证通过")


def main():
    try:
        response = session.get(f"{BASE_URL}/")
        print(f"服务状态: {response.json()['message']}")
    except:
        print("错误：无法连接到服务，请先运行: python3 -m app.main")
        sys.exit(1)

    try:
        result = test_room_number_fix()
        test_malicious_rating_order(result)
        test_timeout_penalty_tracking(result)
        test_key_records_classification(result)
        test_idempotency()

        print("\n" + "=" * 50)
        print("✅ 所有断言测试通过！")
        print("=" * 50)
        return 0
    except AssertionError as e:
        print(f"\n❌ 断言失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
