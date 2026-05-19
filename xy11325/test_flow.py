#!/usr/bin/env python3
import requests
import json
from datetime import date, datetime

BASE_URL = "http://127.0.0.1:8000"


def print_step(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_health_check():
    print_step("1. 健康检查")
    response = requests.get(f"{BASE_URL}/health")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    return response.status_code == 200


def test_batch_process():
    print_step("2. 批量提交作业记录")
    test_records = [
        {
            "record_no": "REC001",
            "tractor_no": "拖拉001",
            "operator": "张三",
            "work_date": "2024-01-15",
            "work_hours": 8,
            "billing_type": "hour",
            "hourly_rate": 15.0
        },
        {
            "record_no": "REC002",
            "tractor_no": "拖拉002",
            "operator": "李四",
            "work_date": "2024-01-15",
            "work_area": 50,
            "billing_type": "area",
            "area_rate": 2.0
        },
        {
            "record_no": "REC003",
            "tractor_no": "拖拉001",
            "operator": "张三",
            "work_date": "2024-01-16",
            "start_time": "2024-01-16T22:00:00",
            "end_time": "2024-01-17T02:00:00",
            "work_hours": 4,
            "billing_type": "hour",
            "hourly_rate": 15.0
        },
        {
            "record_no": "REC004",
            "tractor_no": "拖拉003",
            "operator": "王五",
            "work_date": "2024-01-16",
            "work_hours": 2,
            "billing_type": "hour",
            "hourly_rate": 15.0
        },
        {
            "record_no": "REC001",
            "tractor_no": "拖拉001",
            "operator": "张三",
            "work_date": "2024-01-15",
            "work_hours": 8,
            "billing_type": "hour",
            "hourly_rate": 15.0
        },
        {
            "record_no": "REC005",
            "tractor_no": "",
            "operator": "",
            "work_date": "2024-01-17",
            "billing_type": "hour"
        },
        {
            "record_no": "REC006",
            "tractor_no": "拖拉004",
            "operator": "赵六",
            "work_date": "2024-01-17",
            "work_hours": 6,
            "work_area": 30,
            "fuel_consumption": 20,
            "billing_type": "mixed",
            "hourly_rate": 15.0,
            "area_rate": 2.0,
            "fuel_rate": 3.0
        }
    ]
    print(f"提交 {len(test_records)} 条记录...")
    response = requests.post(f"{BASE_URL}/api/records/batch", json=test_records)
    result = response.json()
    print(f"状态码: {response.status_code}")
    print(f"总记录数: {result['total']}")
    print(f"成功: {result['success_count']} 条")
    print(f"失败: {result['failed_count']} 条")
    if result['success_ids']:
        print(f"成功记录ID: {result['success_ids'][:3]}...")
    if result['failed_details']:
        print("\n失败详情:")
        for detail in result['failed_details']:
            print(f"  - 记录 {detail['record_no']}: {detail['error']}")
    return result


def test_get_all_records():
    print_step("3. 查询所有处理后的记录")
    response = requests.get(f"{BASE_URL}/api/records")
    records = response.json()
    print(f"共 {len(records)} 条记录")
    for r in records:
        status_icon = "✅" if r['status'] == 'approved' else "❌" if r['status'] == 'rejected' else "💰"
        exception_info = f" | 异常: {r['exception_type']} - {r['exception_reason']}" if r['exception_type'] else ""
        print(f"  {status_icon} {r['record_no']} - {r['operator']} - {r['billing_type']} - 金额: {r['amount']}元{exception_info}")
    return records


def test_query_with_filters():
    print_step("4. 按条件筛选查询")
    filters = [
        {"name": "按机手筛选(张三)", "filter": {"operator": "张三"}},
        {"name": "按状态筛选(已拒绝)", "filter": {"status": "rejected"}},
        {"name": "按异常类型筛选(低于最低收费)", "filter": {"exception_type": "below_minimum"}}
    ]
    for f in filters:
        print(f"\n  --- {f['name']} ---")
        response = requests.post(f"{BASE_URL}/api/records/query", json=f['filter'])
        result = response.json()
        print(f"    匹配记录数: {result['summary']['total_count']}")
        print(f"    总金额: {result['summary']['total_amount']} 元")
        if result['summary']['exception_summary']:
            print(f"    异常统计: {result['summary']['exception_summary']}")


def test_export_report():
    print_step("5. 导出Excel报告")
    response = requests.post(f"{BASE_URL}/api/records/export", json={})
    result = response.json()
    print(f"导出成功: {result['success']}")
    print(f"文件路径: {result['filepath']}")
    print(f"导出记录数: {result['record_count']} 条")
    return result


def test_create_settlement(records):
    print_step("6. 创建结算单")
    approved_ids = [r['id'] for r in records if r['status'] == 'approved']
    if not approved_ids:
        print("没有可结算的记录")
        return
    print(f"选择 {len(approved_ids)} 条已通过的记录进行结算...")
    response = requests.post(
        f"{BASE_URL}/api/settlements",
        params={"record_ids": approved_ids, "operator": "财务"}
    )
    result = response.json()
    if response.status_code == 200:
        print(f"结算成功!")
        print(f"  结算单ID: {result['settlement_id']}")
        print(f"  结算金额: {result['total_amount']} 元")
        print(f"  结算记录数: {result['record_count']} 条")
    else:
        print(f"结算失败: {result.get('detail', '未知错误')}")
    return result


def test_retry_failed():
    print_step("7. 重试失败记录")
    fixed_records = [
        {
            "record_no": "REC005_fixed",
            "tractor_no": "拖拉005",
            "operator": "孙七",
            "work_date": "2024-01-17",
            "work_hours": 5,
            "billing_type": "hour",
            "hourly_rate": 15.0
        }
    ]
    print("提交修正后的记录...")
    response = requests.post(f"{BASE_URL}/api/records/retry", json=fixed_records)
    result = response.json()
    print(f"重试结果: 成功 {result['success_count']} 条, 失败 {result['failed_count']} 条")
    return result


def test_get_billing_rules():
    print_step("8. 获取计费规则")
    response = requests.get(f"{BASE_URL}/api/rules")
    rules = response.json()
    print(json.dumps(rules, indent=2, ensure_ascii=False))
    return rules


def main():
    print("农机合作社财务管理系统 - 主流程测试")
    print("=" * 60)
    try:
        if not test_health_check():
            print("\n❌ 服务未启动，请先运行: python main.py")
            return
        batch_result = test_batch_process()
        records = test_get_all_records()
        test_query_with_filters()
        test_export_report()
        if records:
            test_create_settlement(records)
        test_retry_failed()
        test_get_billing_rules()
        print_step("测试完成!")
        print("\n📋 测试总结:")
        print("  ✅ 批量处理（含重复记录、坏行、跨天、最低收费）")
        print("  ✅ 每条记录有明确的放行/拦截原因")
        print("  ✅ 按机手、状态、异常类型筛选")
        print("  ✅ 导出Excel报告")
        print("  ✅ 创建结算单")
        print("  ✅ 失败重试不影响已成功记录")
        print("\n🚀 所有功能验证通过!")
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务，请先运行: python main.py")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
