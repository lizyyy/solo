#!/usr/bin/env python3
import os
import sys
import json
import subprocess
from pathlib import Path

def run_test(name, test_dir, expected_valid, expected_orders, expected_missing):
    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print(f"{'='*60}")
    
    output_dir = Path("test_output") / name.replace(" ", "_")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    cmd = [sys.executable, "photo_audit.py", test_dir, "-o", str(output_dir), "--json-only"]
    print(f"执行命令: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent)
    
    if result.returncode != 0:
        print(f"命令执行失败，退出码: {result.returncode}")
        print(f"stderr: {result.stderr}")
        return False
    
    print(f"stdout: {result.stdout}")
    
    json_files = list(output_dir.glob("*.json"))
    if not json_files:
        print("错误: 未生成JSON报告")
        return False
    
    with open(json_files[0], 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    summary = report['summary']
    print(f"\n实际结果:")
    print(f"  总照片数: {summary['total_photos']}")
    print(f"  有效照片: {summary['valid_photos']}")
    print(f"  总工单: {summary['total_orders']}")
    print(f"  缺图工单: {summary['orders_with_missing']}")
    
    print(f"\n预期结果:")
    print(f"  有效照片: {expected_valid}")
    print(f"  总工单: {expected_orders}")
    print(f"  缺图工单: {expected_missing}")
    
    all_passed = True
    if summary['valid_photos'] != expected_valid:
        print(f"❌ 有效照片数不匹配")
        all_passed = False
    if summary['total_orders'] != expected_orders:
        print(f"❌ 总工单数不匹配")
        all_passed = False
    if summary['orders_with_missing'] != expected_missing:
        print(f"❌ 缺图工单数不匹配")
        all_passed = False
    
    if all_passed:
        print(f"\n✅ 测试通过!")
    else:
        print(f"\n❌ 测试失败!")
    
    return all_passed

def test_normal_case():
    """正常样例: 所有工单都有完整的前后对比图"""
    return run_test(
        "正常样例",
        "test_samples/normal_case",
        expected_valid=6,
        expected_orders=3,
        expected_missing=0
    )

def test_abnormal_case():
    """异常样例: 包含缺图、重复、无效文件的混合情况"""
    return run_test(
        "异常样例",
        "test_samples/boundary_conflict",
        expected_valid=6,
        expected_orders=4,
        expected_missing=4
    )

def test_empty_case():
    """空目录测试"""
    return run_test(
        "空目录",
        "test_samples/empty_result",
        expected_valid=0,
        expected_orders=0,
        expected_missing=0
    )

def test_dirty_data():
    """脏数据测试"""
    return run_test(
        "脏数据",
        "test_samples/dirty_data",
        expected_valid=0,
        expected_orders=0,
        expected_missing=0
    )

def main():
    print("售后照片清点缺图归档报告排查CLI - 验收测试")
    print("=" * 60)
    
    tests = [
        test_normal_case,
        test_abnormal_case,
        test_empty_case,
        test_dirty_data
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        if test():
            passed += 1
        else:
            failed += 1
    
    print(f"\n{'='*60}")
    print(f"测试总结: 通过 {passed}, 失败 {failed}")
    print(f"{'='*60}")
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n🎉 所有验收测试通过!")
        sys.exit(0)

if __name__ == '__main__':
    main()
