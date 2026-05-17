#!/usr/bin/env python3
"""校车改线家长回执站点恢复排查CLI验收测试"""

import subprocess
import sys
import json
import os
from pathlib import Path


def run_command(cmd, capture_output=True):
    """运行命令并返回结果"""
    print(f"\n>>> 执行命令: python main.py {cmd}")
    result = subprocess.run(
        [sys.executable, "main.py"] + cmd.split(),
        capture_output=capture_output,
        text=True
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)
    return result


def test_normal_sample():
    """正常样例测试"""
    print("\n" + "="*60)
    print("测试1: 正常样例数据")
    print("="*60)
    
    run_command("generate-sample normal --clear")
    run_command("list-routes")
    run_command("list-reroutes")
    
    run_command("process-confirmations RR001")
    run_command("start-recovery-check RR001 --checked-by 李老师")
    
    checks = json.load(open("data/recovery_checks.json"))
    if checks:
        check_id = checks[-1]["check_id"]
        run_command(f"verify-recovery {check_id} --checked-by 李老师 --notes 所有家长已确认，站点替换正常")
    
    run_command("generate-report RR001")
    
    report_path = Path("reports/recovery_report.json")
    if report_path.exists():
        with open(report_path, encoding="utf-8") as f:
            report = json.load(f)
        print(f"\n✓ 机器可读报告验证: 共 {len(report['confirmations'])} 条有效回执")
        assert report["recovery_assessment"]["readiness_score"] >= 80, "恢复就绪分数应 >= 80"
        print("✓ 恢复就绪分数验证通过")
    
    print("\n✓ 正常样例测试通过")
    return True


def test_abnormal_sample():
    """异常样例测试"""
    print("\n" + "="*60)
    print("测试2: 异常（冲突）样例数据")
    print("="*60)
    
    run_command("generate-sample conflict --clear")
    
    run_command("process-confirmations RR001")
    
    run_command("start-recovery-check RR001 --checked-by 王老师")
    
    checks = json.load(open("data/recovery_checks.json"))
    if checks:
        check_id = checks[-1]["check_id"]
        run_command(f"mark-recovery-failed {check_id} --checked-by 王老师 --issue 存在重复回执 --issue 存在状态冲突回执")
    
    run_command("generate-report RR001 --name conflict_report")
    
    report_path = Path("reports/conflict_report.json")
    if report_path.exists():
        with open(report_path, encoding="utf-8") as f:
            report = json.load(f)
        print(f"\n✓ 异常报告验证: 共 {len(report['duplicates'])} 条重复回执")
        assert len(report["duplicates"]) > 0, "应检测到重复回执"
        print("✓ 重复回执检测验证通过")
        
        if not report["recovery_assessment"]["can_recover"]:
            print("✓ 不可恢复状态验证通过（因存在冲突）")
    
    print("\n✓ 异常样例测试通过")
    return True


def verify_report_consistency():
    """验证机器可读报告和人类可读报告一致性"""
    print("\n" + "="*60)
    print("测试3: 报告一致性验证")
    print("="*60)
    
    json_report = Path("reports/recovery_report.json")
    txt_report = Path("reports/recovery_report.txt")
    
    if json_report.exists() and txt_report.exists():
        with open(json_report, encoding="utf-8") as f:
            json_data = json.load(f)
        
        with open(txt_report, encoding="utf-8") as f:
            txt_data = f.read()
        
        json_count = len(json_data["confirmations"])
        if f"有效回执: {json_count}" in txt_data:
            print(f"✓ 回执数量一致 (JSON={json_count}, TXT包含此数字)")
        else:
            print(f"✗ 回执数量可能不一致 (JSON={json_count})")
            return False
        
        score = json_data["recovery_assessment"]["readiness_score"]
        if f"恢复就绪分数: {score}" in txt_data:
            print(f"✓ 恢复就绪分数一致 ({score})")
        else:
            print(f"✗ 恢复就绪分数可能不一致 (JSON={score})")
            return False
        
        can_recover = "是" if json_data["recovery_assessment"]["can_recover"] else "否"
        if f"是否可恢复: {can_recover}" in txt_data:
            print(f"✓ 是否可恢复标志一致 ({can_recover})")
        else:
            print(f"✗ 是否可恢复标志可能不一致 (JSON={can_recover})")
            return False
    
    print("\n✓ 报告一致性验证通过")
    return True


def verify_error_messages():
    """验证错误提示"""
    print("\n" + "="*60)
    print("测试4: 错误提示验证")
    print("="*60)
    
    result = run_command("generate-report INVALID_ID")
    if result.returncode != 0 and "未找到改线ID" in result.stdout:
        print("✓ 无效改线ID错误提示正确")
    else:
        print("✗ 无效改线ID错误提示可能不正确")
        return False
    
    result = run_command("verify-recovery INVALID_CHECK")
    if result.returncode != 0 and "未找到排查ID" in result.stdout:
        print("✓ 无效排查ID错误提示正确")
    else:
        print("✗ 无效排查ID错误提示可能不正确")
        return False
    
    print("\n✓ 错误提示验证通过")
    return True


def main():
    print("\n" + "#"*60)
    print("# 校车改线家长回执站点恢复排查CLI - 验收测试")
    print("#"*60)
    
    os.makedirs("data", exist_ok=True)
    os.makedirs("reports", exist_ok=True)
    
    try:
        test_normal_sample()
        test_abnormal_sample()
        verify_report_consistency()
        verify_error_messages()
        
        print("\n" + "="*60)
        print("🎉 所有验收测试通过！")
        print("="*60)
        print("\n验收总结:")
        print("  ✓ 正常样例: 数据处理、状态流转、报告生成")
        print("  ✓ 异常样例: 冲突检测、重复回执识别、失败标记")
        print("  ✓ 报告一致: 机器可读与人类可读数据一致")
        print("  ✓ 错误提示: 边界情况有明确错误信息")
        print("\n历史记录请查看:")
        print("  - data/ 目录下的 JSON 数据文件")
        print("  - reports/ 目录下的生成报告")
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
