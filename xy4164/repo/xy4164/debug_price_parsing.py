#!/usr/bin/env python3
"""调试电价解析问题"""

import sys
import os
import csv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def debug_csv_parsing():
    """直接调试CSV解析"""
    examples_dir = os.path.join(os.path.dirname(__file__), "examples")
    price_path = os.path.join(examples_dir, "electricity_price.csv")
    
    print("=" * 60)
    print("调试电价CSV解析")
    print("=" * 60)
    print()
    
    print(f"文件路径: {price_path}")
    print()
    
    print("[1] 原始文件内容:")
    with open(price_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            print(f"  行{i}: {line.strip()}")
    print()
    
    print("[2] CSV DictReader解析:")
    with open(price_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        print(f"  列名: {reader.fieldnames}")
        print()
        
        for row_num, row in enumerate(reader, 2):
            print(f"  行{row_num}:")
            for key, value in row.items():
                print(f"    {key}='{value}'")
            print()


def debug_with_validator():
    """使用验证器调试"""
    from lighting_previewer.validators import CSVParser
    
    examples_dir = os.path.join(os.path.dirname(__file__), "examples")
    price_path = os.path.join(examples_dir, "electricity_price.csv")
    
    print("=" * 60)
    print("使用CSVParser调试")
    print("=" * 60)
    print()
    
    parser = CSVParser()
    prices = parser.parse_electricity_price(price_path)
    
    print(f"解析到的电价方案数: {len(prices)}")
    print()
    
    for i, p in enumerate(prices):
        print(f"方案{i}: {p.price_id} - {p.price_name}")
        print(f"  时段数: {len(p.tiers)}")
        for j, t in enumerate(p.tiers):
            print(f"    时段{j}: {t.tier_name}")
            print(f"      {t.start_time} - {t.end_time}")
            print(f"      电价: {t.price_per_kwh} 元/kWh")
            print(f"      时长: {t.duration_hours} 小时")
    
    print()
    
    if parser.get_last_errors():
        print("错误:")
        for e in parser.get_last_errors():
            print(f"  - {e}")
    
    if parser.get_last_warnings():
        print("警告:")
        for w in parser.get_last_warnings():
            print(f"  - {w}")


if __name__ == "__main__":
    debug_csv_parsing()
    debug_with_validator()
