#!/usr/bin/env python3
import subprocess
import json
import os
import shutil
from datetime import datetime, timedelta


def run_cli(cmd):
    result = subprocess.run(
        f"python cli.py {cmd}",
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )
    return result


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_normal_flow():
    """正常流程测试"""
    print_section("1. 正常流程测试")

    print("添加客户张小明...")
    result = run_cli('add-customer --name "张小明" --phone 13800138001')
    print(result.stdout)
    data = json.loads(result.stdout)
    customer1_id = data["customer"]["customer_id"]

    print("\n添加客户李小芳...")
    result = run_cli('add-customer --name "李小芳" --phone 13800138002')
    print(result.stdout)
    data = json.loads(result.stdout)
    customer2_id = data["customer"]["customer_id"]

    print("\n添加寄存商品 (张小明的奶粉)...")
    future_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
    result = run_cli(
        f'add-storage --customer-id {customer1_id} --product "爱他美白金版" '
        f'--category "奶粉" --batch "AP20240501" --expiry {future_date} '
        f'--quantity 6 --unit "罐"'
    )
    print(result.stdout)
    data = json.loads(result.stdout)
    storage1_id = data["storage"]["storage_id"]

    print("\n添加寄存商品 (张小明的尿裤)...")
    result = run_cli(
        f'add-storage --customer-id {customer1_id} --product "花王L号" '
        f'--category "尿裤" --batch "KW20240615" --expiry {future_date} '
        f'--quantity 2 --unit "包"'
    )
    print(result.stdout)

    print("\n领用商品...")
    result = run_cli(f'use --storage-id {storage1_id} --quantity 2 --notes "宝宝日常饮用"')
    print(result.stdout)

    print("\n创建转赠申请...")
    result = run_cli(
        f'transfer-request --from-customer {customer1_id} --to-customer {customer2_id} '
        f'--storage-id {storage1_id} --quantity 1 --notes "送给朋友家宝宝"'
    )
    print(result.stdout)
    data = json.loads(result.stdout)
    transfer_id = data["transfer_request"]["transfer_id"]

    print("\n审批转赠申请...")
    result = run_cli(f'approve-transfer --transfer-id {transfer_id} --approver "店长王姐"')
    print(result.stdout)

    print("\n生成寄存报告 (人读格式)...")
    result = run_cli("report-storage --format human")
    print(result.stdout)

    print("\n生成效期报告 (JSON格式)...")
    result = run_cli("report-expiry --days 90 --format json")
    print(result.stdout)

    return customer1_id, customer2_id, storage1_id


def test_dirty_data():
    """脏数据测试"""
    print_section("2. 脏数据测试")

    print("测试: 空姓名...")
    result = run_cli('add-customer --name "" --phone 13900139001')
    print(result.stdout)

    print("\n测试: 无效手机号 (位数不足)...")
    result = run_cli('add-customer --name "测试用户" --phone "123"')
    print(result.stdout)

    print("\n测试: 无效手机号 (非数字)...")
    result = run_cli('add-customer --name "测试用户" --phone "abcdefghijk"')
    print(result.stdout)

    print("\n测试: 重复手机号...")
    result = run_cli('add-customer --name "重号用户" --phone 13800138001')
    print(result.stdout)

    print("\n测试: 无效效期日期格式...")
    result = run_cli(
        f'add-storage --customer-id "dummy" --product "测试商品" '
        f'--category "其他" --batch "TEST001" --expiry "2024/13/01" '
        f'--quantity 1 --unit "件"'
    )
    print(result.stdout)

    print("\n测试: 负数数量...")
    result = run_cli(
        f'add-storage --customer-id "dummy" --product "测试商品" '
        f'--category "其他" --batch "TEST001" --expiry "2025-12-01" '
        f'--quantity -5 --unit "件"'
    )
    print(result.stdout)


def test_boundary_conflicts(customer1_id, storage1_id):
    """边界冲突测试"""
    print_section("3. 边界冲突测试")

    print("测试: 领用超过库存数量...")
    result = run_cli(f'use --storage-id {storage1_id} --quantity 100')
    print(result.stdout)

    print("\n测试: 过期商品领用 (添加已过期商品)...")
    past_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
    result = run_cli(
        f'add-storage --customer-id {customer1_id} --product "过期奶粉" '
        f'--category "奶粉" --batch "EXPIRED001" --expiry {past_date} '
        f'--quantity 3 --unit "罐"'
    )
    print(result.stdout)
    data = json.loads(result.stdout)
    expired_storage_id = data["storage"]["storage_id"]

    print("\n尝试领用过期商品...")
    result = run_cli(f'use --storage-id {expired_storage_id} --quantity 1')
    print(result.stdout)

    print("\n尝试转赠过期商品...")
    result = run_cli(
        f'transfer-request --from-customer {customer1_id} --to-customer {customer1_id} '
        f'--storage-id {expired_storage_id} --quantity 1'
    )
    print(result.stdout)

    print("\n测试: 转赠给自己...")
    result = run_cli(
        f'transfer-request --from-customer {customer1_id} --to-customer {customer1_id} '
        f'--storage-id {storage1_id} --quantity 1'
    )
    print(result.stdout)

    print("\n测试: 审批不存在的转赠申请...")
    result = run_cli('approve-transfer --transfer-id "nonexistent"')
    print(result.stdout)

    print("\n测试: 领用不存在的寄存...")
    result = run_cli('use --storage-id "nonexistent" --quantity 1')
    print(result.stdout)


def test_empty_results():
    """空结果测试"""
    print_section("4. 空结果测试")

    print("创建全新空数据目录...")
    if os.path.exists("data_test_empty"):
        shutil.rmtree("data_test_empty")
    os.makedirs("data_test_empty", exist_ok=True)

    original_data_dir = None
    if os.path.exists("data"):
        shutil.move("data", "data_backup")

    try:
        print("\n空数据下的寄存报告...")
        result = run_cli("report-storage --format human")
        print(result.stdout)

        print("\n空数据下的效期报告...")
        result = run_cli("report-expiry --format human")
        print(result.stdout)

        print("\n空数据下的客户列表...")
        result = run_cli("list-customers")
        print(result.stdout)

        print("\n空数据下的待审批转赠...")
        result = run_cli("pending-transfers")
        print(result.stdout)

    finally:
        if os.path.exists("data_backup"):
            shutil.move("data_backup", "data")
        if os.path.exists("data_test_empty"):
            shutil.rmtree("data_test_empty")


def test_report_consistency():
    """机器可读输出和人读报告一致性测试"""
    print_section("5. 报告一致性测试")

    print("生成JSON格式寄存报告...")
    result = run_cli("report-storage --format json")
    json_data = json.loads(result.stdout)
    json_count = json_data["total_items"]
    print(f"JSON报告显示寄存总数: {json_count}")

    print("\n生成Human格式寄存报告...")
    result = run_cli("report-storage --format human")
    human_output = result.stdout
    print(human_output)

    print("\n验证报告一致性...")
    if f"寄存总数: {json_count} 条" in human_output:
        print("✓ 人读报告与机器可读报告数据一致")
    else:
        print("✗ 人读报告与机器可读报告数据不一致")

    print("\n生成效期报告 (JSON)...")
    result = run_cli("report-expiry --days 365 --format json")
    json_expiry = json.loads(result.stdout)
    total_expiry = json_expiry["expiring_count"] + json_expiry["expired_count"]
    print(f"JSON效期报告显示: 即将过期 {json_expiry['expiring_count']}, 已过期 {json_expiry['expired_count']}")

    print("\n生成效期报告 (Human)...")
    result = run_cli("report-expiry --days 365 --format human")
    print(result.stdout)


def main():
    if os.path.exists("data"):
        shutil.rmtree("data")

    customer1_id, customer2_id, storage1_id = test_normal_flow()
    test_dirty_data()
    test_boundary_conflicts(customer1_id, storage1_id)
    test_empty_results()
    test_report_consistency()

    print_section("测试完成")
    print("\n所有测试样例执行完毕！")
    print(f"\n生成的数据文件保存在: {os.path.abspath('data')}/")


if __name__ == "__main__":
    main()
