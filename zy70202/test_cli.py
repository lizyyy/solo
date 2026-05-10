#!/usr/bin/env python3
"""测试剧组通告单变更 CLI 工具的所有功能"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

PROJECT_DIR = Path(__file__).parent
TEST_DIR = PROJECT_DIR / "test_run"
EXAMPLES_DIR = PROJECT_DIR / "examples"


def run_cli(args, cwd=None):
    """运行 CLI 命令"""
    cmd = [sys.executable, "-m", "call_sheet_cli.cli"] + args
    print(f"\n>>> 运行: {' '.join(cmd)}")
    print("-" * 80)
    
    result = subprocess.run(
        cmd,
        cwd=cwd or TEST_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )
    
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(f"[STDERR] {result.stderr}")
    
    print("-" * 80)
    return result.returncode


def main():
    print("=" * 80)
    print("剧组通告单变更 CLI 工具测试")
    print("=" * 80)
    
    if TEST_DIR.exists():
        shutil.rmtree(TEST_DIR)
    TEST_DIR.mkdir()
    
    os.chdir(TEST_DIR)
    
    print("\n1. 初始化项目")
    print("=" * 80)
    assert run_cli(["init", "测试电影项目"]) == 0
    
    print("\n2. 导入第一个版本 (v1)")
    print("=" * 80)
    v1_file = str(EXAMPLES_DIR / "call_sheet_v1.json")
    assert run_cli(["import-sheet", v1_file, "--version", "v1"]) == 0
    
    print("\n3. 导入第二个版本 (v2) - 应该检测到冲突和变更")
    print("=" * 80)
    v2_file = str(EXAMPLES_DIR / "call_sheet_v2.json")
    assert run_cli(["import-sheet", v2_file, "--version", "v2"]) == 0
    
    print("\n4. 导入脏数据 - 应该显示所有问题")
    print("=" * 80)
    dirty_file = str(EXAMPLES_DIR / "dirty_data.json")
    assert run_cli(["import-sheet", dirty_file, "--version", "dirty-test"]) == 0
    
    print("\n5. 列出所有版本")
    print("=" * 80)
    assert run_cli(["list"]) == 0
    
    print("\n6. 显示 v1 版本详情")
    print("=" * 80)
    assert run_cli(["show", "2024-01-15__v1"]) == 0
    
    print("\n7. 对比 v1 和 v2 的差异")
    print("=" * 80)
    assert run_cli(["diff", "2024-01-15__v1", "2024-01-15__v2", "--output", "diff_report.txt"]) == 0
    
    print("\n8. 查询所有问题")
    print("=" * 80)
    assert run_cli(["issues", "--output", "issues_report.txt"]) == 0
    
    print("\n9. 只查询错误")
    print("=" * 80)
    assert run_cli(["issues", "--severity", "error"]) == 0
    
    print("\n10. 查询所有冲突")
    print("=" * 80)
    assert run_cli(["conflicts", "--output", "conflicts_report.txt"]) == 0
    
    print("\n11. 重新运行所有检查")
    print("=" * 80)
    assert run_cli(["check"]) == 0
    
    print("\n12. 生成汇总报告")
    print("=" * 80)
    assert run_cli(["report", "--type", "summary", "--output", "summary_report.txt"]) == 0
    
    print("\n13. 生成现场分发报告")
    print("=" * 80)
    assert run_cli(["distribute", "2024-01-15__v2", "--output", "field_report.txt"]) == 0
    
    print("\n14. 生成所有报告")
    print("=" * 80)
    assert run_cli(["report", "--type", "all", "--output", "reports/"]) == 0
    
    print("\n" + "=" * 80)
    print("测试完成！检查生成的文件：")
    print("=" * 80)
    
    generated_files = [
        "diff_report.txt",
        "issues_report.txt", 
        "conflicts_report.txt",
        "summary_report.txt",
        "field_report.txt",
        "reports/summary_*.txt",
        "reports/issues_*.txt",
        "reports/conflicts_*.txt",
    ]
    
    for f in sorted(TEST_DIR.glob("**/*.txt")):
        rel_path = f.relative_to(TEST_DIR)
        size = f.stat().st_size
        print(f"  ✓ {rel_path} ({size} bytes)")
    
    print("\n✅ 所有测试通过！")
    return 0


if __name__ == "__main__":
    sys.exit(main())
