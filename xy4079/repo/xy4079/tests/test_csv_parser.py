# -*- coding: utf-8 -*-
"""
测试CSV解析器
"""

import sys
from pathlib import Path
from datetime import datetime

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from importer import CSVParser


def test_csv_parser():
    """测试CSV解析器"""
    parser = CSVParser()
    
    # 测试示例CSV
    sample_csv = Path(__file__).parent.parent / "samples" / "work_order_sample.csv"
    
    if sample_csv.exists():
        result = parser.parse(sample_csv)
        
        print(f"解析成功: {result.success}")
        print(f"工单数量: {len(result.work_orders)}")
        
        for wo in result.work_orders:
            print(f"\n工单: {wo.order_id}")
            print(f"  电梯: {wo.elevator_no}")
            print(f"  位置: {wo.location}")
            print(f"  维保日期: {wo.maintenance_date}")
            print(f"  维保人员: {wo.technician}")
            print(f"  必拍点位: {wo.required_points}")
            print(f"  有整改: {wo.has_rectification}")
            if wo.has_rectification:
                print(f"  整改项: {wo.rectification_items}")
        
        if result.warnings:
            print(f"\n警告: {result.warnings}")
        
        return result.success
    else:
        print(f"示例CSV文件不存在: {sample_csv}")
        return False


def test_date_parsing():
    """测试日期解析"""
    parser = CSVParser()
    
    test_dates = [
        "2026-05-01",
        "2026/05/01",
        "2026年05月01日",
        "05/01/2026",
    ]
    
    print("\n测试日期解析:")
    for date_str in test_dates:
        result = parser._parse_date(date_str)
        print(f"  '{date_str}' -> {result}")


if __name__ == "__main__":
    print("=" * 50)
    print("测试CSV解析器")
    print("=" * 50)
    
    test_csv_parser()
    test_date_parsing()
