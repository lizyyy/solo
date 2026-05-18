#!/usr/bin/env python3
import subprocess
import sys
import os
import csv
from pathlib import Path


def run_cli(input_dir, output_file, append=False):
    cmd = [
        sys.executable, 'meeting_room_compensation.py',
        '-i', input_dir,
        '-o', output_file
    ]
    if append:
        cmd.append('-a')
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd='/Users/lzy/pro/solo/workspaces/zy10721')
    return result


def test_normal_path():
    print("="*60)
    print("测试 1: 正常路径 - 首次运行")
    print("="*60)
    
    output_file = 'test_output_normal.csv'
    if os.path.exists(output_file):
        os.remove(output_file)
    
    result = run_cli('sample_inputs', output_file)
    
    print("标准输出:")
    print(result.stdout)
    if result.stderr:
        print("标准错误:")
        print(result.stderr)
    
    assert result.returncode == 0, f"CLI运行失败，返回码: {result.returncode}"
    
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"\n输出记录数: {len(rows)}")
    
    booking_ids = [r['booking_id'] for r in rows]
    print(f"处理的预约编号: {booking_ids}")
    
    expected_ids = ['BK002', 'BK003', 'BK004', 'BK005', 'BK007', 'BK008', 'BK101', 'BK102', 'BK104']
    for bid in expected_ids:
        assert bid in booking_ids, f"期望的预约编号 {bid} 不在结果中"
    
    print("\n验证源文件名和行号:")
    for row in rows:
        print(f"  {row['booking_id']}: 文件={row['source_file']}, 行号={row['source_line']}")
        assert row['source_file'] in ['bookings_2026_05.csv', 'bookings_error_test.csv']
        assert int(row['source_line']) >= 2
    
    print("\n✓ 正常路径测试通过\n")
    return rows


def test_idempotency():
    print("="*60)
    print("测试 2: 幂等性 - 重复运行不重复追加（覆盖模式）")
    print("="*60)
    
    output_file = 'test_output_normal.csv'
    
    result = run_cli('sample_inputs', output_file)
    
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows_after = list(reader)
    
    print(f"再次运行后记录数: {len(rows_after)}")
    
    booking_ids_after = [r['booking_id'] for r in rows_after]
    assert len(booking_ids_after) == len(set(booking_ids_after)), "存在重复记录"
    
    print("✓ 幂等性测试通过\n")
    return rows_after


def test_append_mode():
    print("="*60)
    print("测试 3: 追加模式 - 跳过已处理记录")
    print("="*60)
    
    output_file = 'test_output_append.csv'
    if os.path.exists(output_file):
        os.remove(output_file)
    
    single_file_dir = 'single_file_test'
    os.makedirs(single_file_dir, exist_ok=True)
    import shutil
    shutil.copy('sample_inputs/bookings_2026_05.csv', single_file_dir)
    result1 = run_cli(single_file_dir, output_file)
    
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows1 = list(reader)
    print(f"首次运行记录数: {len(rows1)}")
    
    result2 = run_cli('sample_inputs', output_file, append=True)
    
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows2 = list(reader)
    print(f"追加模式运行后记录数: {len(rows2)}")
    
    booking_ids2 = [r['booking_id'] for r in rows2]
    for r in rows1:
        assert r['booking_id'] in booking_ids2, f"原有记录 {r['booking_id']} 丢失"
    
    print("✓ 追加模式测试通过\n")


def test_sort_stability():
    print("="*60)
    print("测试 4: 排序稳定性 - 两次运行结果顺序一致")
    print("="*60)
    
    output_file1 = 'test_output_sort1.csv'
    output_file2 = 'test_output_sort2.csv'
    
    for f in [output_file1, output_file2]:
        if os.path.exists(f):
            os.remove(f)
    
    result1 = run_cli('sample_inputs', output_file1)
    result2 = run_cli('sample_inputs', output_file2)
    
    with open(output_file1, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows1 = list(reader)
    
    with open(output_file2, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows2 = list(reader)
    
    ids1 = [r['booking_id'] for r in rows1]
    ids2 = [r['booking_id'] for r in rows2]
    
    assert ids1 == ids2, "排序不一致"
    
    print(f"排序结果: {ids1}")
    print("✓ 排序稳定性测试通过\n")


def test_specific_compensation():
    print("="*60)
    print("测试 5: 具体补偿规则验证")
    print("="*60)
    
    output_file = 'test_output_normal.csv'
    
    with open(output_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    test_cases = {
        'BK002': {'type': '跨天预约补偿', 'amount': '100.0', 'cross_day': 'True'},
        'BK003': {'type': '设备占用补偿 + 人工取消补偿', 'amount': '80.0', 'equipment': 'True', 'manual': 'True'},
        'BK005': {'type': '跨天预约补偿 + 设备占用补偿 + 人工取消补偿', 'amount': '180.0'},
        'BK007': {'type': '人工取消补偿', 'amount': '30.0'},
    }
    
    for booking_id, expected in test_cases.items():
        row = next(r for r in rows if r['booking_id'] == booking_id)
        print(f"\n{booking_id}:")
        print(f"  补偿类型: {row['compensation_type']}")
        print(f"  补偿金额: {row['compensation_amount']}")
        print(f"  跨天: {row['cross_day']}, 设备: {row['equipment_occupied']}, 人工取消: {row['manual_cancel']}")
        
        assert expected['type'] in row['compensation_type'], f"{booking_id} 补偿类型错误"
        assert row['compensation_amount'] == expected['amount'], f"{booking_id} 补偿金额错误"
    
    print("\n✓ 补偿规则测试通过\n")


def test_empty_input():
    print("="*60)
    print("测试 6: 异常路径 - 空输入目录")
    print("="*60)
    
    empty_dir = 'empty_test_dir'
    os.makedirs(empty_dir, exist_ok=True)
    
    output_file = 'test_output_empty.csv'
    if os.path.exists(output_file):
        os.remove(output_file)
    
    result = run_cli(empty_dir, output_file)
    
    print("标准输出:")
    print(result.stdout)
    print("标准错误:")
    print(result.stderr)
    
    assert result.returncode == 0, "空输入不应导致程序崩溃"
    
    print("✓ 空输入测试通过\n")


def main():
    print("\n" + "╔" + "═"*58 + "╗")
    print("║" + "会议室预约表释放补偿核算 CLI 验收测试".center(58) + "║")
    print("╚" + "═"*58 + "╝\n")
    
    try:
        rows = test_normal_path()
        test_idempotency()
        test_append_mode()
        test_sort_stability()
        test_specific_compensation()
        test_empty_input()
        
        print("="*60)
        print("✓ 所有测试通过!")
        print("="*60)
        
        print("\n最终输出文件内容预览:")
        print("-"*60)
        with open('test_output_normal.csv', 'r', encoding='utf-8') as f:
            for line in f:
                print(line.rstrip())
        print("-"*60)
        
        return 0
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
