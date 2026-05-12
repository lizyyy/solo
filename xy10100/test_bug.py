#!/usr/bin/env python3
"""
验证总体判定逻辑修复
"""

import sys
import string
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))

from pcr_qc import DataLoader, QCValidator
from pcr_qc.qc_validator import QCStatus
import pandas as pd

all_passed = True

def test_case(name, result, expected):
    global all_passed
    actual = result.overall_status.value
    passed = actual == expected
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status} {name}")
    print(f"    预期: {expected.upper()}, 实际: {actual.upper()}")
    if not passed:
        all_passed = False
    print()
    return passed

print("=" * 70)
print("验证总体判定逻辑修复")
print("目标: 阴阳性对照一错，整批结果都不敢发 (FAIL)")
print("=" * 70)
print()

loader = DataLoader()
validator = QCValidator()

# 测试1: 只有阴性对照失败
print("【测试1】只有阴性对照失败")
print("-" * 70)
data1 = loader.load('examples/test_nc_failure_only.csv')
result1 = validator.validate(data1)
test_case("阴性对照污染", result1, QCStatus.FAIL.value)

# 测试2: 只有阳性对照失败
print("【测试2】只有阳性对照失败")
print("-" * 70)
test_data2 = pd.DataFrame([
    {'sample_id': 'S001', 'well': 'A1', 'ct_value': 22.5, 'sample_type': '样本'},
    {'sample_id': 'PC1', 'well': 'B1', 'ct_value': 8.0, 'sample_type': '阳性对照'},
    {'sample_id': 'NC1', 'well': 'C1', 'ct_value': None, 'sample_type': '阴性对照'},
])
temp_file = '/tmp/test_pc_failure_only.csv'
test_data2.to_csv(temp_file, index=False)
data2 = loader.load(temp_file)
result2 = validator.validate(data2)
test_case("阳性对照失败", result2, QCStatus.FAIL.value)

# 测试3: 只有空白对照失败
print("【测试3】只有空白对照失败")
print("-" * 70)
test_data3 = pd.DataFrame([
    {'sample_id': 'S001', 'well': 'A1', 'ct_value': 22.5, 'sample_type': '样本'},
    {'sample_id': 'PC1', 'well': 'B1', 'ct_value': 20.0, 'sample_type': '阳性对照'},
    {'sample_id': 'NC1', 'well': 'C1', 'ct_value': None, 'sample_type': '阴性对照'},
    {'sample_id': 'Blank1', 'well': 'D1', 'ct_value': 28.0, 'sample_type': '空白'},
])
temp_file3 = '/tmp/test_blank_failure_only.csv'
test_data3.to_csv(temp_file3, index=False)
data3 = loader.load(temp_file3)
result3 = validator.validate(data3)
test_case("空白对照污染", result3, QCStatus.FAIL.value)

# 测试4: 只有样本Ct范围错误 (error级别)
print("【测试4】只有样本Ct范围错误 (error级别)")
print("-" * 70)
test_data4 = pd.DataFrame([
    {'sample_id': 'S001', 'well': 'A1', 'ct_value': 8.0, 'sample_type': '样本'},
    {'sample_id': 'S002', 'well': 'A2', 'ct_value': 25.0, 'sample_type': '样本'},
    {'sample_id': 'PC1', 'well': 'B1', 'ct_value': 20.0, 'sample_type': '阳性对照'},
    {'sample_id': 'NC1', 'well': 'C1', 'ct_value': None, 'sample_type': '阴性对照'},
])
temp_file4 = '/tmp/test_error_sample.csv'
test_data4.to_csv(temp_file4, index=False)
data4 = loader.load(temp_file4)
result4 = validator.validate(data4)
test_case("样本Ct范围错误 (error级别)", result4, QCStatus.FAIL.value)

# 测试5: 没有失败，全通过（包含足够孔位避免板位警告）
print("【测试5】没有失败，全通过")
print("-" * 70)
test_data5 = pd.DataFrame([
    {'sample_id': 'S001', 'well': 'A1', 'ct_value': 25.0, 'sample_type': '样本'},
    {'sample_id': 'S002', 'well': 'A2', 'ct_value': 26.0, 'sample_type': '样本'},
    {'sample_id': 'S003', 'well': 'A3', 'ct_value': 24.0, 'sample_type': '样本'},
    {'sample_id': 'S004', 'well': 'A4', 'ct_value': 27.0, 'sample_type': '样本'},
    {'sample_id': 'S005', 'well': 'A5', 'ct_value': 25.5, 'sample_type': '样本'},
    {'sample_id': 'S006', 'well': 'A6', 'ct_value': 23.0, 'sample_type': '样本'},
    {'sample_id': 'S007', 'well': 'A7', 'ct_value': 28.0, 'sample_type': '样本'},
    {'sample_id': 'S008', 'well': 'A8', 'ct_value': 22.0, 'sample_type': '样本'},
    {'sample_id': 'S009', 'well': 'A9', 'ct_value': 25.0, 'sample_type': '样本'},
    {'sample_id': 'S010', 'well': 'A10', 'ct_value': 26.0, 'sample_type': '样本'},
    {'sample_id': 'S011', 'well': 'A11', 'ct_value': 24.0, 'sample_type': '样本'},
    {'sample_id': 'S012', 'well': 'A12', 'ct_value': 27.0, 'sample_type': '样本'},
    {'sample_id': 'S013', 'well': 'B1', 'ct_value': 25.0, 'sample_type': '样本'},
    {'sample_id': 'S014', 'well': 'B2', 'ct_value': 26.0, 'sample_type': '样本'},
    {'sample_id': 'S015', 'well': 'B3', 'ct_value': 24.0, 'sample_type': '样本'},
    {'sample_id': 'PC1', 'well': 'C1', 'ct_value': 20.0, 'sample_type': '阳性对照'},
    {'sample_id': 'PC2', 'well': 'C2', 'ct_value': 21.0, 'sample_type': '阳性对照'},
    {'sample_id': 'NC1', 'well': 'D1', 'ct_value': None, 'sample_type': '阴性对照'},
    {'sample_id': 'NC2', 'well': 'D2', 'ct_value': None, 'sample_type': '阴性对照'},
    {'sample_id': 'Blank1', 'well': 'E1', 'ct_value': None, 'sample_type': '空白'},
    {'sample_id': 'Blank2', 'well': 'E2', 'ct_value': None, 'sample_type': '空白'},
])
temp_file5 = '/tmp/test_warning_only.csv'
test_data5.to_csv(temp_file5, index=False)
data5 = loader.load(temp_file5)
result5 = validator.validate(data5)
test_case("无失败，全通过", result5, QCStatus.PASS.value)

# 测试6: 板位不完整 (warning级别) - 需要超过50%孔位才会检查
print("【测试6】板位不完整 (warning级别)")
print("-" * 70)
rows = list(string.ascii_uppercase[:8])  # A-H
cols = list(range(1, 13))  # 1-12
test_data6_list = []
sample_idx = 1

for row in rows:
    for col in cols:
        # 跳过几个孔位来模拟缺失
        if f'{row}{col}' in ['D5', 'D6', 'E7', 'E8', 'F9', 'F10']:
            continue
        test_data6_list.append({
            'sample_id': f'S{sample_idx:03d}',
            'well': f'{row}{col}',
            'ct_value': 25.0,
            'sample_type': '样本'
        })
        sample_idx += 1

test_data6_list.extend([
    {'sample_id': 'PC1', 'well': 'H1', 'ct_value': 20.0, 'sample_type': '阳性对照'},
    {'sample_id': 'PC2', 'well': 'H2', 'ct_value': 21.0, 'sample_type': '阳性对照'},
    {'sample_id': 'NC1', 'well': 'H3', 'ct_value': None, 'sample_type': '阴性对照'},
    {'sample_id': 'NC2', 'well': 'H4', 'ct_value': None, 'sample_type': '阴性对照'},
    {'sample_id': 'Blank1', 'well': 'H5', 'ct_value': None, 'sample_type': '空白'},
    {'sample_id': 'Blank2', 'well': 'H6', 'ct_value': None, 'sample_type': '空白'},
])

test_data6 = pd.DataFrame(test_data6_list)
temp_file6 = '/tmp/test_plate_only.csv'
test_data6.to_csv(temp_file6, index=False)
data6 = loader.load(temp_file6)
result6 = validator.validate(data6)
test_case("板位不完整 (warning级别)", result6, QCStatus.WARN.value)

print("=" * 70)
if all_passed:
    print("✓ 所有测试通过!")
else:
    print("✗ 部分测试失败!")
    sys.exit(1)
print("=" * 70)
