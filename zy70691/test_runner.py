#!/usr/bin/env python3
import subprocess
import sys
import os
import shutil


def run_command(cmd, description, expect_success=True):
    print(f"\n{'='*60}")
    print(f"测试: {description}")
    print(f"命令: {cmd}")
    print(f"{'='*60}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        print("STDOUT:")
        print(result.stdout)
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
        print(f"退出码: {result.returncode}")
        actual_success = result.returncode == 0
        passed = actual_success == expect_success
        print(f"期望: {'成功' if expect_success else '失败'}, 实际: {'成功' if actual_success else '失败'}, 结果: {'通过' if passed else '失败'}")
        return passed
    except Exception as e:
        print(f"执行异常: {e}")
        return False


def test_normal_scenario():
    print("\n\n" + "#"*60)
    print("# 测试场景1: 正常业务流程")
    print("#"*60)
    shutil.copy("data_normal.json", "data.json")
    all_pass = True
    all_pass &= run_command("python3 cli.py list-flowers", "列出所有花材")
    all_pass &= run_command("python3 cli.py list-subscriptions", "列出所有订阅")
    all_pass &= run_command("python3 cli.py list-schedules", "列出所有配送计划")
    all_pass &= run_command("python3 cli.py list-schedules --subscription-id SUB001", "过滤订阅配送计划")
    all_pass &= run_command("python3 cli.py swap SUB001 --old-flowers F001 --new-flowers F003 --effective-date 2024-05-15", "申请换花(差价测试)")
    all_pass &= run_command("python3 cli.py list-requests", "列出调整申请")
    all_pass &= run_command("python3 cli.py pause SUB002 --effective-date 2024-05-20 --end-date 2024-06-05", "申请暂停")
    all_pass &= run_command("python3 cli.py resume SUB002 --effective-date 2024-06-01", "申请恢复")
    all_pass &= run_command("python3 cli.py verify", "验证数据一致性")
    all_pass &= run_command("python3 cli.py report SUB001 --start-date 2024-05-01 --end-date 2024-06-30 --output report_sub001.json --verify", "生成报告并验证一致性")
    print(f"\n正常场景测试结果: {'通过' if all_pass else '失败'}")
    return all_pass


def test_dirty_data_scenario():
    print("\n\n" + "#"*60)
    print("# 测试场景2: 脏数据处理")
    print("#"*60)
    shutil.copy("data_dirty.json", "data.json")
    all_pass = True
    all_pass &= run_command("python3 cli.py list-flowers", "列出花材(含无效数据)")
    all_pass &= run_command("python3 cli.py list-subscriptions", "列出订阅(含日期颠倒)")
    all_pass &= run_command("python3 cli.py swap SUB001 --old-flowers F001 --new-flowers INVALID_FLOWER", "换花到无效花材(应失败)", expect_success=False)
    all_pass &= run_command("python3 cli.py swap SUB002 --old-flowers F002 --new-flowers F001", "已取消订阅换花(应失败)", expect_success=False)
    all_pass &= run_command("python3 cli.py verify", "验证脏数据一致性")
    print(f"\n脏数据场景测试结果: {'通过' if all_pass else '失败'}")
    return all_pass


def test_conflict_scenario():
    print("\n\n" + "#"*60)
    print("# 测试场景3: 边界冲突处理")
    print("#"*60)
    shutil.copy("data_conflict.json", "data.json")
    all_pass = True
    all_pass &= run_command("python3 cli.py swap SUB001 --old-flowers F001 --new-flowers F003 --effective-date 2024-05-15", "换花到库存不足(应失败)", expect_success=False)
    all_pass &= run_command("python3 cli.py pause SUB001 --effective-date 2024-05-15 --end-date 2024-05-25", "暂停日期重叠(应失败)", expect_success=False)
    all_pass &= run_command("python3 cli.py swap SUB001 --old-flowers F001 --new-flowers F003 --effective-date 2025-01-01", "生效日期超出订阅周期(应失败)", expect_success=False)
    all_pass &= run_command("python3 cli.py swap SUB001 --old-flowers F001 --new-flowers F001 --effective-date 2024-05-15", "重复换花测试")
    print(f"\n边界冲突场景测试结果: {'通过' if all_pass else '失败'}")
    return all_pass


def test_empty_scenario():
    print("\n\n" + "#"*60)
    print("# 测试场景4: 空结果处理")
    print("#"*60)
    shutil.copy("data_empty.json", "data.json")
    all_pass = True
    all_pass &= run_command("python3 cli.py list-flowers", "空花材列表")
    all_pass &= run_command("python3 cli.py list-subscriptions", "空订阅列表")
    all_pass &= run_command("python3 cli.py list-schedules", "空配送计划")
    all_pass &= run_command("python3 cli.py list-requests", "空调整申请")
    all_pass &= run_command("python3 cli.py verify", "空数据验证")
    all_pass &= run_command("python3 cli.py report SUB001", "不存在的订阅生成报告(应失败)", expect_success=False)
    print(f"\n空结果场景测试结果: {'通过' if all_pass else '失败'}")
    return all_pass


def main():
    print("鲜花订阅换花差价暂停恢复排查CLI - 综合测试")
    print("="*60)
    if not os.path.exists("data_normal.json"):
        print("生成样例数据...")
        subprocess.run("python3 sample_data.py", shell=True)
    results = {}
    results["正常业务流程"] = test_normal_scenario()
    results["脏数据处理"] = test_dirty_data_scenario()
    results["边界冲突处理"] = test_conflict_scenario()
    results["空结果处理"] = test_empty_scenario()
    print("\n\n" + "="*60)
    print("测试汇总:")
    print("="*60)
    for name, passed in results.items():
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {name}: {status}")
    all_passed = all(results.values())
    print(f"\n总体结果: {'全部通过 ✓' if all_passed else '存在失败 ✗'}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
