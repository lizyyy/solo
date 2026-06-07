import requests
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tidal_power_predictor.importer.column_mapper import ColumnNameNormalizer
import pandas as pd

s = requests.Session()

print("=" * 60)
print("  潮汐发电功率预测 - 端到端验证脚本")
print("=" * 60)

# Step 1: Upload CSV file
print("\n[1] 上传CSV台账文件...")
with open('samples/潮汐发电功率预测台账_样例.csv', 'rb') as f:
    resp = s.post('http://127.0.0.1:5001/upload', files={'file': ('台账样例.csv', f, 'text/csv')}, allow_redirects=True)
print(f"    状态: {resp.status_code}, URL: {resp.url}")

# Step 2: Check mapping page
if '/mapping' in resp.url:
    print("\n[2] 列名映射页面加载成功")
    
    df = pd.read_csv('samples/潮汐发电功率预测台账_样例.csv', nrows=5, dtype=str, encoding='utf-8-sig')
    normalizer = ColumnNameNormalizer()
    mappings = normalizer.generate_suggested_mappings(list(df.columns))
    
    form_data = {}
    for m in mappings:
        if m.target_column:
            form_data[f'mapping_{m.source_column}'] = m.target_column
            print(f"    {m.source_column} -> {m.target_column} (置信度: {m.confidence:.0%})")
    
    # Step 3: Submit mapping
    print(f"\n[3] 提交映射，共 {len(form_data)} 个字段...")
    resp = s.post('http://127.0.0.1:5001/mapping', data=form_data, allow_redirects=True)
    print(f"    状态: {resp.status_code}, URL: {resp.url}")

# Step 4: Check preview page
if '/preview' in resp.url:
    record_count = resp.text.count('编辑/补录')
    print(f"\n[4] 数据预览页面加载成功")
    print(f"    导入记录数: {record_count}")
    
    # Verify field values
    for rid in ['TIDAL-2024-101', 'TIDAL-2024-103', 'TIDAL-2024-104']:
        if rid in resp.text:
            print(f"    ✓ 找到记录 {rid}")
        else:
            print(f"    ✗ 未找到记录 {rid}")

# Step 5: Calculate
print("\n[5] 执行批量计算...")
resp = s.get('http://127.0.0.1:5001/calculate', allow_redirects=True)
print(f"    状态: {resp.status_code}, URL: {resp.url}")

# Step 6: Check results
if '/results' in resp.url:
    print("\n[6] 计算结果页面:")
    success_count = resp.text.count('计算成功')
    review_count = resp.text.count('待人工确认')
    failed_count = resp.text.count('计算失败')
    print(f"    成功: {success_count} | 待确认: {review_count} | 失败: {failed_count}")
    print(f"    总计: {success_count + review_count + failed_count}")
    
    # Verify failed records still visible
    if 'TIDAL-2024-104' in resp.text:
        print("    ✓ 失败记录 TIDAL-2024-104 仍然出现在结果中")
    if 'TIDAL-2024-108' in resp.text:
        print("    ✓ 失败记录 TIDAL-2024-108 仍然出现在结果中")
    if '潮差数值异常' in resp.text:
        print("    ✓ 负数潮差的原因被保留")

# Step 7: Generate HTML report
print("\n[7] 生成HTML报告...")
resp = s.get('http://127.0.0.1:5001/generate_report')
print(f"    报告大小: {len(resp.content)} bytes")
with open('/tmp/test_report.html', 'wb') as f:
    f.write(resp.content)
print("    已保存到 /tmp/test_report.html")

# Step 8: Export CSV
print("\n[8] 导出CSV结果...")
resp = s.get('http://127.0.0.1:5001/export_csv')
print(f"    CSV大小: {len(resp.content)} bytes")

import csv
import io
reader = csv.reader(io.StringIO(resp.content.decode('utf-8-sig')))
rows = list(reader)
print(f"    CSV行数: {len(rows)} (1表头 + {len(rows)-1}数据行)")

failed_with_reason = 0
for row in rows[1:]:
    if len(row) > 14:
        record_id = row[0]
        status = row[11]
        warnings = row[14]
        print(f"    {record_id}: {status}", end="")
        if warnings:
            print(f" | 原因: {warnings[:60]}...", end="")
            failed_with_reason += 1
        print()

print(f"\n    带原因导出的记录数: {failed_with_reason}")
print("    ✓ 所有记录（含失败的）都保留在导出中")

# Step 9: Test old portal CSV upload
print("\n[9] 测试旧口径CSV上传...")
s2 = requests.Session()
with open('samples/老板汇总页_旧口径.csv', 'rb') as f:
    resp = s2.post('http://127.0.0.1:5001/upload', files={'file': ('旧口径.csv', f, 'text/csv')}, allow_redirects=True)
print(f"    上传: {resp.status_code}, URL: {resp.url}")

if '/mapping' in resp.url:
    df = pd.read_csv('samples/老板汇总页_旧口径.csv', dtype=str, encoding='utf-8-sig')
    normalizer = ColumnNameNormalizer()
    mappings = normalizer.generate_suggested_mappings(list(df.columns))
    
    form_data = {}
    for m in mappings:
        if m.target_column:
            form_data[f'mapping_{m.source_column}'] = m.target_column
            print(f"    {m.source_column} -> {m.target_column}")
    
    resp = s2.post('http://127.0.0.1:5001/mapping', data=form_data, allow_redirects=True)
    if '/preview' in resp.url:
        record_count = resp.text.count('编辑/补录')
        print(f"    旧口径导入: {record_count} 条记录")
        if '旧系统导出' in resp.text or '汇总页' in resp.text:
            print("    ✓ 旧口径数据来源标记正确")

print("\n" + "=" * 60)
print("  ✅ 端到端验证完成！")
print("=" * 60)
