#!/usr/bin/env python3
import pandas as pd
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from size_processor import (
    SizeStandardizer,
    HeaderRecognizer,
    StudentMerger,
    ClassSummarizer,
    ReportExporter,
    process_import_data
)
from database import init_db, get_db, ImportBatch, SizeRecord, ExceptionNote, OrderReport


def test_size_standardizer():
    print("=" * 60)
    print("测试 1: 尺码标准化功能")
    print("=" * 60)
    
    test_cases = [
        ("160", "160", []),
        ("XL", "XL", []),
        ("加大", "XL", []),
        ("特大号", "XXL", []),
        ("150cm", "150", []),
        ("L码", "L", []),
        ("M号", "M", []),
        ("小号", "S", []),
        ("", "", ["empty_size"]),
        ("超大170", "XXL", []),
    ]
    
    all_passed = True
    for input_size, expected, expected_ex in test_cases:
        result, exceptions = SizeStandardizer.standardize(input_size)
        passed = result == expected
        all_passed = all_passed and passed
        status = "✓" if passed else "✗"
        print(f"  {status} '{input_size}' -> '{result}' (预期: '{expected}')")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_header_recognizer():
    print("\n" + "=" * 60)
    print("测试 2: 表头识别功能")
    print("=" * 60)
    
    test_data = {
        '学生姓名': ['张三', '李四'],
        '班级': ['高一1班', '高一2班'],
        '校服尺码': ['160', '170'],
        '学号': ['001', '002'],
        '性别': ['男', '女'],
    }
    
    df = pd.DataFrame(test_data)
    header_mapping, warnings = HeaderRecognizer.recognize_headers(df)
    
    all_passed = True
    expected_fields = ['name', 'class_name', 'size', 'student_no', 'gender']
    for field in expected_fields:
        passed = field in header_mapping
        all_passed = all_passed and passed
        status = "✓" if passed else "✗"
        print(f"  {status} 字段 '{field}' 识别: {header_mapping.get(field, '未识别')}")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_student_merger():
    print("\n" + "=" * 60)
    print("测试 3: 重复学生合并功能")
    print("=" * 60)
    
    records = [
        {'name': '张三', 'class_name': '高一1班', 'size': '160', 'original_size': '160', 'student_no': '001'},
        {'name': '张三', 'class_name': '高一1班', 'size': '160', 'original_size': '160cm', 'student_no': '001'},
        {'name': '李四', 'class_name': '高一2班', 'size': '170', 'original_size': '170', 'student_no': '002'},
        {'name': '王五', 'class_name': '高一1班', 'size': '165', 'original_size': '165', 'student_no': '003'},
        {'name': '王五', 'class_name': '高一1班', 'size': '170', 'original_size': '170', 'student_no': '003'},
    ]
    
    merged, duplicates = StudentMerger.merge_duplicates(records)
    
    all_passed = True
    
    passed = len(merged) == 3
    all_passed = all_passed and passed
    print(f"  {'✓' if passed else '✗'} 合并后记录数: {len(merged)} (预期: 3)")
    
    passed = len(duplicates) == 2
    all_passed = all_passed and passed
    print(f"  {'✓' if passed else '✗'} 冲突重复记录数: {len(duplicates)} (预期: 2)")
    
    zhangsan = next((r for r in merged if r['name'] == '张三'), None)
    if zhangsan:
        passed = zhangsan['quantity'] == 2
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 张三数量: {zhangsan['quantity']} (预期: 2)")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_class_summarizer():
    print("\n" + "=" * 60)
    print("测试 4: 班级汇总功能")
    print("=" * 60)
    
    records = [
        {'name': '张三', 'class_name': '高一1班', 'size': '160', 'quantity': 1},
        {'name': '李四', 'class_name': '高一1班', 'size': '160', 'quantity': 1},
        {'name': '王五', 'class_name': '高一1班', 'size': '170', 'quantity': 1},
        {'name': '赵六', 'class_name': '高一2班', 'size': '160', 'quantity': 1},
        {'name': '钱七', 'class_name': '高一2班', 'size': '170', 'quantity': 2},
    ]
    
    summary = ClassSummarizer.summarize_by_class(records)
    total = ClassSummarizer.get_total_summary(summary)
    
    all_passed = True
    
    passed = '高一1班' in summary and '高一2班' in summary
    all_passed = all_passed and passed
    print(f"  {'✓' if passed else '✗'} 班级汇总包含所有班级")
    
    passed = summary['高一1班'].get('160', 0) == 2
    all_passed = all_passed and passed
    print(f"  {'✓' if passed else '✗'} 高一1班 160码: {summary['高一1班'].get('160', 0)} (预期: 2)")
    
    passed = total.get('170', 0) == 3
    all_passed = all_passed and passed
    print(f"  {'✓' if passed else '✗'} 总计 170码: {total.get('170', 0)} (预期: 3)")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_process_import_data():
    print("\n" + "=" * 60)
    print("测试 5: 完整导入处理流程")
    print("=" * 60)
    
    test_data = {
        '学生姓名': ['张三', '李四', '张三', '王五', '赵六'],
        '班级': ['高一1班', '高一2班', '高一1班', '高一1班', '高一2班'],
        '校服尺码': ['160', '加大', '160cm', '170', '特大'],
        '学号': ['001', '002', '001', '003', '004'],
    }
    
    df = pd.DataFrame(test_data)
    result = process_import_data(df)
    
    all_passed = result.success
    
    if result.success:
        print(f"  ✓ 处理成功")
        
        records = result.data['records']
        passed = len(records) == 4
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 记录数: {len(records)} (预期: 4)")
        
        summary = result.data['total_summary']
        passed = 'XL' in summary and 'XXL' in summary
        all_passed = all_passed and passed
        print(f"  {'✓' if passed else '✗'} 中文尺码正确标准化")
        
        exceptions = result.data['exceptions']
        print(f"  ✓ 异常数量: {len(exceptions)}")
    else:
        print(f"  ✗ 处理失败: {result.error_message}")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_report_export():
    print("\n" + "=" * 60)
    print("测试 6: 报告导出功能")
    print("=" * 60)
    
    records = [
        {'班级': '高一1班', '姓名': '张三', '原尺码': '160', '标准尺码': '160', '数量': 1},
        {'班级': '高一1班', '姓名': '李四', '原尺码': '加大', '标准尺码': 'XL', '数量': 1},
        {'班级': '高一2班', '姓名': '王五', '原尺码': '170', '标准尺码': '170', '数量': 2},
    ]
    
    summary = {
        '高一1班': {'160': 1, 'XL': 1},
        '高一2班': {'170': 2},
    }
    
    os.makedirs('test_output', exist_ok=True)
    test_file = 'test_output/test_report.xlsx'
    
    success = ReportExporter.export_to_excel(records, summary, test_file)
    
    all_passed = success and os.path.exists(test_file)
    
    print(f"  {'✓' if success else '✗'} 导出函数执行成功")
    print(f"  {'✓' if os.path.exists(test_file) else '✗'} 输出文件存在: {test_file}")
    
    if os.path.exists(test_file):
        df_detail = pd.read_excel(test_file, sheet_name='学生明细')
        df_summary = pd.read_excel(test_file, sheet_name='班级汇总')
        print(f"  ✓ 学生明细 sheet 行数: {len(df_detail)}")
        print(f"  ✓ 班级汇总 sheet 行数: {len(df_summary)}")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def test_missing_fields():
    print("\n" + "=" * 60)
    print("测试 7: 缺少必要字段错误处理")
    print("=" * 60)
    
    test_data = {
        '学生姓名': ['张三', '李四'],
        '年级': ['高一', '高一'],
    }
    
    df = pd.DataFrame(test_data)
    result = process_import_data(df)
    
    all_passed = not result.success and result.error_type == 'missing_fields'
    
    print(f"  {'✓' if not result.success else '✗'} 正确返回失败状态")
    print(f"  {'✓' if result.error_type == 'missing_fields' else '✗'} 错误类型正确: {result.error_type}")
    print(f"  ✓ 错误信息: {result.error_message}")
    
    print(f"\n  结果: {'通过' if all_passed else '失败'}")
    return all_passed


def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 15 + "校服尺码标准化系统自检" + " " * 17 + "║")
    print("╚" + "═" * 58 + "╝")
    
    init_db()
    
    tests = [
        test_size_standardizer,
        test_header_recognizer,
        test_student_merger,
        test_class_summarizer,
        test_process_import_data,
        test_report_export,
        test_missing_fields,
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"  ✗ 测试异常: {e}")
            results.append(False)
    
    print("\n" + "=" * 60)
    print("自检总结")
    print("=" * 60)
    
    passed_count = sum(results)
    total_count = len(results)
    
    print(f"\n通过: {passed_count}/{total_count}")
    
    if passed_count == total_count:
        print("\n🎉 所有测试通过！系统正常工作。")
    else:
        print(f"\n⚠️  有 {total_count - passed_count} 个测试未通过，请检查。")
    
    print("\n")
    
    return passed_count == total_count


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
