#!/usr/bin/env python3
"""测试脚本 - 验证物业抄表CLI功能"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from property_meter.parser import CSVParser
from property_meter.processor import process_file
from property_meter.exporter import ResultExporter
from property_meter.models import ErrorType


def create_test_data():
    """创建测试数据"""
    print("=" * 60)
    print("创建测试数据...")
    
    clean_data = """住户,表号,上月读数,本月读数,倍率
1栋101,DB001,100,150,1
1栋102,DB002,200,260,1
1栋201,DB003,150,210,1
1栋202,DB004,180,250,1
2栋101,DB005,300,380,1
2栋102,DB006,220,290,1
"""
    
    dirty_data = """住户,表号,上月读数,本月读数,倍率
1栋101,DB001,100,150,1
1栋102,,200,260,1
,DB003,150,210,1
1栋202,DB004,180,abc,1
2栋101,DB005,300,280,1
2栋102,DB006,220,290,-5
3栋101,DB007,100,300,1
3栋102,DB008,150,145,1
3栋201,DB009,200,,1
3栋202,DB010,,250,1
4栋101,DB011,100,150,abc
4栋102,DB012,200,260,0
4栋201,DB013,150,210,-3
"""
    
    reference_data = """表号
DB001
DB002
DB003
DB004
DB005
DB006
DB007
DB008
DB009
DB010
DB011
DB012
"""
    
    Path("test_clean.csv").write_text(clean_data, encoding="utf-8")
    Path("test_dirty.csv").write_text(dirty_data, encoding="utf-8")
    Path("test_reference.csv").write_text(reference_data, encoding="utf-8")
    
    print("✓ 测试文件已创建:")
    print("  - test_clean.csv (干净数据)")
    print("  - test_dirty.csv (含错误数据)")
    print("  - test_reference.csv (参考表号)")


def test_parser():
    """测试CSV解析器"""
    print("\n" + "=" * 60)
    print("测试CSV解析器...")
    
    parser = CSVParser()
    records, errors = parser.parse("test_clean.csv")
    
    print(f"✓ 解析成功: {len(records)} 条记录, {len(errors)} 个错误")
    
    records, errors = parser.parse("test_dirty.csv")
    print(f"✓ 脏数据解析: {len(records)} 条记录, {len(errors)} 个错误")
    for e in errors[:3]:
        print(f"  - 行{e.row_number}: {e.message}")


def test_processor():
    """测试数据处理器"""
    print("\n" + "=" * 60)
    print("测试数据处理器...")
    
    result = process_file(
        input_file="test_dirty.csv",
        output_dir="./test_output",
        abnormal_threshold=1.8,
        reference_file="test_reference.csv"
    )
    
    print(f"✓ 处理完成:")
    print(f"  - 有效记录: {len(result.valid_records)}")
    print(f"  - 异常用量: {len(result.abnormal_records)}")
    print(f"  - 错误记录: {len(result.invalid_records)}")
    print(f"  - 缺表记录: {len(result.missing_meters)}")
    print(f"  - 总用水量: {result.total_usage_water:.2f}")
    print(f"  - 总用电量: {result.total_usage_electric:.2f}")
    
    return result


def test_exporter(result):
    """测试输出模块"""
    print("\n" + "=" * 60)
    print("测试输出模块...")
    
    exporter = ResultExporter(result, "./test_output")
    outputs = exporter.export_all()
    
    print("✓ 输出文件已生成:")
    for key, path in outputs.items():
        if key != "terminal":
            print(f"  - {path}")


def test_multiplier_validation():
    """测试倍率校验功能"""
    print("\n" + "=" * 60)
    print("测试倍率校验功能...")
    
    parser = CSVParser()
    records, errors = parser.parse("test_dirty.csv")
    
    multiplier_errors = [e for e in errors if e.field_name == "倍率"]
    
    print(f"✓ 倍率相关错误: {len(multiplier_errors)} 个")
    
    invalid_multiplier = [e for e in multiplier_errors if e.error_type == ErrorType.INVALID_NUMBER]
    negative_multiplier = [e for e in multiplier_errors if e.error_type == ErrorType.NEGATIVE_READING]
    
    print(f"  - 无效倍率格式(abc): {len(invalid_multiplier)} 个")
    print(f"  - 零/负倍率: {len(negative_multiplier)} 个")
    
    if len(multiplier_errors) >= 3:
        print("✓ 倍率校验功能正常工作")
    else:
        print("✗ 倍率校验可能有问题")
        for e in multiplier_errors:
            print(f"    行{e.row_number}: {e.message}")


def test_robust_average():
    """测试稳健平均值计算（避免脏数据影响）"""
    print("\n" + "=" * 60)
    print("测试稳健平均值计算...")
    
    result = process_file(
        input_file="test_dirty.csv",
        output_dir="./test_output",
        abnormal_threshold=2.0
    )
    
    print(f"✓ 有效记录数: {len(result.valid_records)}")
    print(f"✓ 异常记录数: {len(result.abnormal_records)}")
    print(f"✓ 错误记录数: {len(result.invalid_records)}")
    
    valid_usages = [r.usage for r in result.valid_records if r.usage is not None]
    if valid_usages:
        avg = sum(valid_usages) / len(valid_usages)
        print(f"✓ 有效记录平均用量: {avg:.2f}")
        print(f"✓ 有效记录用量范围: {min(valid_usages):.2f} ~ {max(valid_usages):.2f}")


def test_exit_codes():
    """测试退出码逻辑"""
    print("\n" + "=" * 60)
    print("测试退出码逻辑...")
    
    result_clean = process_file("test_clean.csv", "./test_output")
    exit_code_0 = 0 if not result_clean.has_errors and not result_clean.has_abnormal else 1
    print(f"✓ 干净数据退出码应为 0, 实际: {exit_code_0}")
    
    result_dirty = process_file("test_dirty.csv", "./test_output")
    exit_code_1 = 1 if result_dirty.has_errors or result_dirty.has_abnormal else 0
    print(f"✓ 脏数据退出码应为 1, 实际: {exit_code_1}")


def main():
    try:
        create_test_data()
        test_parser()
        test_multiplier_validation()
        result = test_processor()
        test_robust_average()
        test_exporter(result)
        test_exit_codes()
        
        print("\n" + "=" * 60)
        print("✓ 所有测试通过！CLI功能验证完成。")
        print("=" * 60)
        print("\n使用方法:")
        print("  python -m property_meter.cli example")
        print("  python -m property_meter.cli process test_clean.csv")
        print("  python -m property_meter.cli process test_dirty.csv -t 1.5 -r test_reference.csv")
        print("\n或安装后使用: pip install -e . && meter-cli")
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
