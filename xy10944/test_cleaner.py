#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from study_tour_cleaner import DataCleaner, ColumnMapper

def test_data_cleaner():
    print("测试 DataCleaner 类...")
    
    print("\n1. 测试护照号清洗:")
    test_cases = [
        ("E12345678", ("E12345678", "正常")),
        ("G 87654321", ("G87654321", "正常")),
        ("AB12345CD", ("AB12345CD", "格式可疑")),
        ("", ("", "空值")),
        (None, ("", "空值")),
    ]
    for input_val, expected in test_cases:
        result = DataCleaner.clean_passport(input_val)
        status = "✓" if result == expected else "✗"
        print(f"  {status} {repr(input_val)} -> {result}")
    
    print("\n2. 测试电话清洗:")
    phone_cases = [
        ("13800138000", ("13800138000", "正常")),
        ("139-1234-5678", ("13912345678", "正常")),
        ("+86 138 8888 9999", ("13888889999", "正常")),
        ("8613777778888", ("13777778888", "正常")),
        ("1361234567", ("1361234567", "格式可疑")),
        ("不是电话", ("不是电话", "格式异常")),
    ]
    for input_val, expected in phone_cases:
        result = DataCleaner.clean_phone(input_val)
        status = "✓" if result == expected else "✗"
        print(f"  {status} {repr(input_val)} -> {result}")
    
    print("\n3. 测试饮食禁忌清洗:")
    dietary_cases = [
        ("海鲜、花生", ("海鲜、花生", "标准化")),
        ("虾", ("海鲜", "标准化")),
        ("没有", ("无", "正常")),
        ("", ("无", "正常")),
        ("辣、鸡蛋", ("辛辣、鸡蛋", "标准化")),
        ("面筋、牛肉", ("麸质、牛肉", "标准化")),
    ]
    for input_val, expected in dietary_cases:
        result = DataCleaner.clean_dietary(input_val)
        status = "✓" if result == expected else "✗"
        print(f"  {status} {repr(input_val)} -> {result}")
    
    print("\n4. 测试字段映射:")
    test_columns = ["学生姓名", "护照号", "监护人电话", "饮食禁忌", "年级"]
    mapping = ColumnMapper.map_columns(test_columns)
    print(f"  输入列: {test_columns}")
    print(f"  映射结果: {mapping}")
    
    print("\n✅ 所有基础功能测试完成！")
    return True

if __name__ == "__main__":
    test_data_cleaner()
