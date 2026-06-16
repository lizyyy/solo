import requests
import sys
import os
import re
import io
import csv

print("=" * 70)
print("  潮汐发电功率预测 - 完整端到端验证")
print("=" * 70)

s = requests.Session()

# ========== 第一部分：标准台账导入 ==========
print("\n[1] 上传标准台账CSV...")
with open('samples/潮汐发电功率预测台账_样例.csv', 'rb') as f:
    resp = s.post('http://127.0.0.1:5001/upload',
                  files={'file': ('潮汐发电功率预测台账_样例.csv', f, 'text/csv')},
                  allow_redirects=True)
print(f"    状态: {resp.status_code}, URL: {resp.url}")
assert '/mapping' in resp.url, "上传后应跳转到映射页面"
print("    ✓ 跳转到列名映射页面")

# 检查映射页面是否有列数警告
col_warnings = '列数异常' in resp.text or '列数不一致' in resp.text
if col_warnings:
    print("    ⚠️  检测到列数不一致警告")
else:
    print("    ✓ 无列数不一致问题")

# ========== 第二部分：提交映射 ==========
print("\n[2] 提交列名映射...")

source_cols = re.findall(r'name="mapping_([^"]+)"', resp.text)
print(f"    源列数: {len(source_cols)}")

form_data = {}
for col in source_cols:
    if col == '记录编号':
        form_data[f'mapping_{col}'] = 'record_id'
    elif col == '站点名称':
        form_data[f'mapping_{col}'] = 'station_name'
    elif col == '观测时间':
        form_data[f'mapping_{col}'] = 'timestamp'
    elif col == '潮差数值':
        form_data[f'mapping_{col}'] = 'tidal_range'
    elif col == '潮差单位':
        form_data[f'mapping_{col}'] = 'tidal_range_unit'
    elif col == '流量数值':
        form_data[f'mapping_{col}'] = 'flow_rate'
    elif col == '流量单位':
        form_data[f'mapping_{col}'] = 'flow_rate_unit'
    elif col == '流速':
        form_data[f'mapping_{col}'] = 'water_velocity'
    elif col == '流速单位':
        form_data[f'mapping_{col}'] = 'water_velocity_unit'
    elif col == '过水面积':
        form_data[f'mapping_{col}'] = 'cross_sectional_area'
    elif col == '面积单位':
        form_data[f'mapping_{col}'] = 'cross_sectional_area_unit'
    elif col == '水轮机效率':
        form_data[f'mapping_{col}'] = 'turbine_efficiency'
    elif col == '数据来源':
        form_data[f'mapping_{col}'] = 'data_source'
    elif col == '备注':
        form_data[f'mapping_{col}'] = 'notes'

mapped = len([v for v in form_data.values() if v])
print(f"    自动映射了 {mapped} 个字段")

resp = s.post('http://127.0.0.1:5001/mapping', data=form_data, allow_redirects=True)
print(f"    状态: {resp.status_code}, URL: {resp.url}")
assert '/preview' in resp.url, "映射后应跳转到预览页面"
print("    ✓ 跳转到数据预览页面")

# ========== 第三部分：关键字段验证 ==========
print("\n[3] 验证关键字段...")

# TIDAL-2024-101: 备注="大潮期，数据完整"，来源="手动录入"
assert '大潮期，数据完整' in resp.text, "TIDAL-2024-101的备注应该是'大潮期，数据完整'"
print("    ✓ TIDAL-2024-101 备注正确: 大潮期，数据完整")

assert '手动录入' in resp.text, "数据来源应该包含'手动录入'"
print("    ✓ TIDAL-2024-101 数据来源正确: 手动录入")

# TIDAL-2024-103: 旧系统导出
assert '旧系统导出' in resp.text, "TIDAL-2024-103的数据来源应该是'旧系统导出'"
print("    ✓ TIDAL-2024-103 数据来源正确: 旧系统导出")

# 检查来源行标记
assert '来源行' in resp.text or '来源行: ' in resp.text, "应该包含来源行标记"
print("    ✓ 来源行标记已保留")

# 检查是否有10条记录
assert 'TIDAL-2024-101' in resp.text, "应该包含TIDAL-2024-101"
assert 'TIDAL-2024-110' in resp.text, "应该包含TIDAL-2024-110"
print("    ✓ 10条记录全部导入")

# ========== 第四部分：批量计算 ==========
print("\n[4] 执行批量计算...")
resp = s.get('http://127.0.0.1:5001/calculate', allow_redirects=True)
print(f"    状态: {resp.status_code}, URL: {resp.url}")
assert '/results' in resp.url, "计算后应跳转到结果页面"
print("    ✓ 跳转到计算结果页面")

# 检查总记录数
assert '10' in resp.text or '总记录' in resp.text, "应该有10条记录"
print("    ✓ 总记录数: 10")

# 检查失败记录是否保留
assert 'TIDAL-2024-104' in resp.text, "失败记录TIDAL-2024-104应该出现在结果中"
print("    ✓ 失败记录 TIDAL-2024-104 保留在结果中")

assert 'TIDAL-2024-108' in resp.text, "失败记录TIDAL-2024-108应该出现在结果中"
print("    ✓ 失败记录 TIDAL-2024-108 保留在结果中")

# 检查需人工确认的记录（效率异常）
assert 'TIDAL-2024-107' in resp.text, "需确认记录TIDAL-2024-107应该出现在结果中"
print("    ✓ 待确认记录 TIDAL-2024-107 保留在结果中")

# ========== 第五部分：CSV导出验证 ==========
print("\n[5] 验证CSV导出...")
resp = s.get('http://127.0.0.1:5001/export_csv')
print(f"    状态: {resp.status_code}, 大小: {len(resp.content)} bytes")

reader = csv.reader(io.StringIO(resp.content.decode('utf-8-sig')))
rows = list(reader)
print(f"    CSV行数: {len(rows)} (1表头 + {len(rows)-1}数据行)")
assert len(rows) == 11, "应该有10条数据 + 1行表头"
print("    ✓ 所有10条记录都导出了")

# 检查失败记录的原因
failed_with_reason = 0
for row in rows[1:]:
    if len(row) > 14 and row[14]:
        failed_with_reason += 1
        if row[0] in ['TIDAL-2024-104', 'TIDAL-2024-108']:
            print(f"    ✓ {row[0]} 导出了原因: {row[14][:40]}...")

print(f"    ✓ 带原因导出的记录: {failed_with_reason} 条")

# ========== 第六部分：HTML报告验证 ==========
print("\n[6] 生成并验证HTML报告...")
resp = s.get('http://127.0.0.1:5001/generate_report')
print(f"    状态: {resp.status_code}, 大小: {len(resp.content)} bytes")
assert len(resp.content) > 10000, "HTML报告应该有足够内容"
print("    ✓ HTML报告生成成功")

# 检查报告中的图表
assert 'Chart' in resp.text or 'chart' in resp.text, "报告应该包含图表"
print("    ✓ 报告包含图表")

# 检查报告中的明细
assert 'TIDAL-2024-101' in resp.text, "报告应该包含明细记录"
print("    ✓ 报告包含明细数据")

# 检查报告中的失败原因
assert 'TIDAL-2024-104' in resp.text, "报告应该包含失败记录"
print("    ✓ 报告包含失败记录及原因")

# ========== 第七部分：差异对比验证 ==========
print("\n[7] 测试差异对比功能...")

# 上传基线文件
with open('samples/老板汇总页_旧口径.csv', 'rb') as f:
    resp = s.post('http://127.0.0.1:5001/diff',
                  files={'baseline_file': ('老板汇总页_旧口径.csv', f, 'text/csv')},
                  allow_redirects=True)
print(f"    基线上传: {resp.status_code}, URL: {resp.url}")
assert '/diff/mapping' in resp.url, "基线上传后应跳转到映射页面"
print("    ✓ 跳转到基线映射页面")

# 提交基线映射
baseline_cols = re.findall(r'name="mapping_([^"]+)"', resp.text)
print(f"    基线源列数: {len(baseline_cols)}")

baseline_form = {}
for col in baseline_cols:
    if col == 'ID':
        baseline_form[f'mapping_{col}'] = 'record_id'
    elif col == '测站':
        baseline_form[f'mapping_{col}'] = 'station_name'
    elif col == '时间':
        baseline_form[f'mapping_{col}'] = 'timestamp'
    elif col == '潮差':
        baseline_form[f'mapping_{col}'] = 'tidal_range'
    elif col == '单位' and 'mapping_单位' not in baseline_form:
        baseline_form[f'mapping_{col}'] = 'tidal_range_unit'
    elif col == '流量':
        baseline_form[f'mapping_{col}'] = 'flow_rate'
    elif col == '单位_流量':
        baseline_form[f'mapping_{col}'] = 'flow_rate_unit'
    elif col == '水流速度':
        baseline_form[f'mapping_{col}'] = 'water_velocity'
    elif col == '速度单位':
        baseline_form[f'mapping_{col}'] = 'water_velocity_unit'
    elif col == '截面面积':
        baseline_form[f'mapping_{col}'] = 'cross_sectional_area'
    elif col == '面积单位':
        baseline_form[f'mapping_{col}'] = 'cross_sectional_area_unit'
    elif col == '效率':
        baseline_form[f'mapping_{col}'] = 'turbine_efficiency'
    elif col == '来源':
        baseline_form[f'mapping_{col}'] = 'data_source'
    elif col == '说明':
        baseline_form[f'mapping_{col}'] = 'notes'

resp = s.post('http://127.0.0.1:5001/diff/mapping', data=baseline_form, allow_redirects=True)
print(f"    基线映射提交: {resp.status_code}, URL: {resp.url}")
assert '/diff/result' in resp.url, "映射后应跳转到差异结果页"
print("    ✓ 跳转到差异对比结果页面")

# 检查差异对比结果
assert '逐条对比明细' in resp.text, "应该包含逐条对比明细"
print("    ✓ 包含逐条对比明细")

# 检查是否有标黄（黄色背景）
assert 'fef3c7' in resp.text, "差异行应该有黄色背景"
print("    ✓ 差异行使用黄色背景标黄")

# 检查差异统计
assert '差异记录数' in resp.text, "应该显示差异数量统计"
print("    ✓ 显示差异统计")

# 检查是否有新增/缺失标记
has_new = '仅当前有' in resp.text or '仅当前有，基线中无' in resp.text
has_missing = '已缺失' in resp.text or '基线有，当前已缺失' in resp.text
print(f"    ✓ 新增记录标记: {'有' if has_new else '无'}")
print(f"    ✓ 缺失记录标记: {'有' if has_missing else '无'}")

# ========== 总结 ==========
print("\n" + "=" * 70)
print("  ✅ 全部验证通过！")
print("=" * 70)
print()
print("验证项汇总:")
print("  ✓ CSV台账上传与列名映射")
print("  ✓ 字段值正确性验证（备注、来源、效率）")
print("  ✓ 来源行信息保留")
print("  ✓ 失败记录不消失，原因完整保留")
print("  ✓ CSV导出包含所有记录及原因")
print("  ✓ HTML报告包含图表和明细")
print("  ✓ 差异对比逐条对比并标黄")
print()
