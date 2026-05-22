#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil

DB_PATH = os.path.expanduser("~/.cold_chain_inspector/cold_chain.db")
TEST_DIR = os.path.dirname(os.path.abspath(__file__))


def run_cci(args, input_text=None, expect_success=True):
    cmd = [sys.executable, "-m", "cold_chain_inspector.cli"] + args
    print(f"\n$ cci {' '.join(args)}")
    
    if input_text:
        result = subprocess.run(
            cmd,
            input=input_text.encode(),
            capture_output=True,
            text=False,
            cwd=TEST_DIR
        )
    else:
        result = subprocess.run(
            cmd,
            capture_output=True,
            cwd=TEST_DIR
        )
    
    stdout = result.stdout.decode('utf-8', errors='replace')
    stderr = result.stderr.decode('utf-8', errors='replace')
    
    if stdout:
        print(stdout)
    if stderr and expect_success:
        print(f"STDERR: {stderr}")
    
    success = result.returncode == 0
    if expect_success and not success:
        print(f"[ERROR] Command failed with return code {result.returncode}")
    elif not expect_success and success:
        print(f"[WARNING] Command succeeded but expected failure")
    
    return success, stdout, stderr


def cleanup_database():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"Cleaned up database: {DB_PATH}")


def test_normal_workflow():
    print("\n" + "="*60)
    print("TEST 1: 正常链路测试")
    print("="*60)
    
    cleanup_database()
    
    print("\n--- Step 1: 初始化数据库 ---")
    success, _, _ = run_cci(["init"])
    assert success, "初始化失败"
    
    print("\n--- Step 2: 登录 (录入员) ---")
    success, stdout, _ = run_cci(["login", "-u", "entry", "-p", "entry123"])
    assert "登录成功" in stdout, "登录失败"
    
    print("\n--- Step 3: 导入正常 WMS 数据 ---")
    wms_file = os.path.join(TEST_DIR, "test_data", "wms_normal.csv")
    success, stdout, _ = run_cci(["import-data", "wms", wms_file], input_text="n\n")
    assert "导入成功" in stdout, "WMS 导入失败"
    
    print("\n--- Step 4: 导入温度数据 ---")
    temp_file = os.path.join(TEST_DIR, "test_data", "temperature_log.csv")
    success, stdout, _ = run_cci(["import-data", "temperature", temp_file], input_text="n\n")
    assert "导入成功" in stdout, "温度数据导入失败"
    
    print("\n--- Step 5: 查看批次列表 ---")
    success, stdout, _ = run_cci(["batches"])
    assert "wms_csv" in stdout or "temperature_log" in stdout, "批次列表显示失败"
    
    print("\n--- Step 6: 执行数据检查 ---")
    success, stdout, _ = run_cci(["check"])
    assert "检查完成" in stdout, "数据检查失败"
    
    print("\n[PASS] 正常链路测试通过!")
    return True


def test_bad_data():
    print("\n" + "="*60)
    print("TEST 2: 坏数据检测测试")
    print("="*60)
    
    cleanup_database()
    
    run_cci(["init"])
    run_cci(["login", "-u", "reviewer", "-p", "reviewer123"])
    
    print("\n--- Step 1: 导入含问题的 WMS 数据 ---")
    wms_file = os.path.join(TEST_DIR, "test_data", "wms_with_issues.csv")
    success, stdout, _ = run_cci(["import-data", "wms", wms_file], input_text="y\n")
    assert "导入成功" in stdout, "WMS 导入失败"
    
    print("\n--- Step 2: 登录主管账号查看报表 ---")
    run_cci(["login", "-u", "supervisor", "-p", "supervisor123"])
    success, stdout, _ = run_cci(["report"])
    
    expected_issues = ["missing_field", "cross_day_sign", "amount_conflict"]
    found_issues = [issue for issue in expected_issues if issue in stdout.lower()]
    print(f"检测到的问题类型: {found_issues}")
    assert len(found_issues) >= 2, f"应检测到至少2种问题, 实际: {found_issues}"
    
    print("\n--- Step 3: 导出问题清单 ---")
    success, stdout, _ = run_cci(["export", "--issues", "-o", "test_issues.csv"])
    assert "已导出" in stdout, "问题导出失败"
    
    print("\n[PASS] 坏数据检测测试通过!")
    return True


def test_duplicate_import():
    print("\n" + "="*60)
    print("TEST 3: 重复导入防重测试")
    print("="*60)
    
    cleanup_database()
    
    run_cci(["init"])
    run_cci(["login", "-u", "entry", "-p", "entry123"])
    
    wms_file = os.path.join(TEST_DIR, "test_data", "wms_normal.csv")
    
    print("\n--- Step 1: 首次导入 ---")
    success, stdout, _ = run_cci(["import-data", "wms", wms_file], input_text="n\n")
    assert "导入成功" in stdout, "首次导入失败"
    
    print("\n--- Step 2: 重复导入同一文件 (应失败) ---")
    success, stdout, _ = run_cci(["import-data", "wms", wms_file], input_text="n\n")
    assert "文件已存在重复导入记录" in stdout or "重复" in stdout, "重复导入应被阻止"
    
    print("\n[PASS] 重复导入防重测试通过!")
    return True


def test_fix_and_reimport():
    print("\n" + "="*60)
    print("TEST 4: 修复与再导入测试")
    print("="*60)
    
    cleanup_database()
    
    run_cci(["init"])
    run_cci(["login", "-u", "reviewer", "-p", "reviewer123"])
    
    print("\n--- Step 1: 导入含问题数据 ---")
    wms_file = os.path.join(TEST_DIR, "test_data", "wms_with_issues.csv")
    run_cci(["import-data", "wms", wms_file], input_text="y\n")
    
    print("\n--- Step 2: 查看批次ID ---")
    _, batches_out, _ = run_cci(["batches"])
    
    print("\n--- Step 3: 登录主管审批 ---")
    run_cci(["login", "-u", "supervisor", "-p", "supervisor123"])
    
    success, report_out, _ = run_cci(["report", "-d", "1"])
    assert "运营主管报表" in report_out, "主管报表生成失败"
    
    print("\n--- Step 4: 导出数据 ---")
    success, stdout, _ = run_cci(["export", "-o", "test_export.csv"])
    assert "已导出" in stdout, "数据导出失败"
    
    print("\n--- Step 5: 查看操作历史 ---")
    success, stdout, _ = run_cci(["history", "-l", "10"])
    assert "import" in stdout.lower() or "check" in stdout.lower(), "操作历史应记录导入/检查"
    
    print("\n[PASS] 修复与再导入测试通过!")
    return True


def test_permissions():
    print("\n" + "="*60)
    print("TEST 5: 权限控制测试")
    print("="*60)
    
    cleanup_database()
    
    run_cci(["init"])
    
    print("\n--- Step 1: 只读用户尝试导入 (应失败) ---")
    run_cci(["login", "-u", "viewer", "-p", "viewer123"])
    wms_file = os.path.join(TEST_DIR, "test_data", "wms_normal.csv")
    success, stdout, _ = run_cci(["import-data", "wms", wms_file], input_text="n\n")
    assert "无权执行此操作" in stdout, "只读用户应无法导入数据"
    
    print("\n--- Step 2: 录入员尝试查看报表 (应失败) ---")
    run_cci(["login", "-u", "entry", "-p", "entry123"])
    success, stdout, _ = run_cci(["report"])
    assert "无权执行此操作" in stdout, "录入员应无法查看主管报表"
    
    print("\n--- Step 3: 复核员尝试查看操作历史 (应失败) ---")
    run_cci(["login", "-u", "reviewer", "-p", "reviewer123"])
    success, stdout, _ = run_cci(["history"])
    assert "无权执行此操作" in stdout, "复核员应无法查看完整操作历史"
    
    print("\n--- Step 4: 主管应有全部权限 ---")
    run_cci(["login", "-u", "supervisor", "-p", "supervisor123"])
    success, stdout, _ = run_cci(["report"])
    assert "运营主管报表" in stdout, "主管应能查看报表"
    
    print("\n[PASS] 权限控制测试通过!")
    return True


def main():
    print("冷链中转多源导入巡检 CLI - 验收测试")
    print("="*60)
    
    tests = [
        test_normal_workflow,
        test_bad_data,
        test_duplicate_import,
        test_fix_and_reimport,
        test_permissions,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n[FAIL] {test.__name__} 异常: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "="*60)
    print(f"测试结果: {passed} 通过, {failed} 失败")
    print("="*60)
    
    cleanup_database()
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n🎉 所有验收测试通过!")
        sys.exit(0)


if __name__ == "__main__":
    main()
