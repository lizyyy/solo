import urllib.request
import urllib.parse
import json

params = urllib.parse.urlencode({'subject': '物理', 'formula': 'abs'})

url = 'http://127.0.0.1:5000/api/result?' + params
resp = urllib.request.urlopen(url)
data = json.loads(resp.read().decode())
print('=== API /api/result ===')
print('total_samples:', data['statistics']['total_samples'])
print('recalc_formula:', data['statistics']['recalc_formula'])
print('filters:', data['filters'])
print('detail_table rows:', len(data['detail_table']))
print('chart subject total:', sum(x['count'] for x in data['chart_data']['subject']))
print('duplicate_count:', data['statistics']['duplicate_count'])
assert data['statistics']['total_samples'] == len(data['detail_table'])
assert data['statistics']['total_samples'] == sum(x['count'] for x in data['chart_data']['subject'])
print('✅ 统计=明细表=图表 口径一致')

csv_url = 'http://127.0.0.1:5000/export.csv?' + params
csv_resp = urllib.request.urlopen(csv_url)
csv_text = csv_resp.read().decode('utf-8')
csv_lines = [l for l in csv_text.split('\n') if l.strip()]
print()
print('=== CSV /export.csv ===')
print('CSV rows (含表头):', len(csv_lines))
print('CSV data rows:', len(csv_lines) - 1)
assert len(csv_lines) - 1 == data['statistics']['total_samples']
print('✅ CSV行数=统计样本数 口径一致')
assert 'is_duplicate_warning' in csv_text
print('✅ CSV含 is_duplicate_warning 列')
assert '重复样本' in csv_text
print('✅ CSV含重复样本警告文字')

diff_url = 'http://127.0.0.1:5000/api/confirm_diffs?' + params
diff_resp = urllib.request.urlopen(diff_url)
diff_data = json.loads(diff_resp.read().decode())
print()
print('=== API /api/confirm_diffs (第二天复盘用) ===')
print('确认差异记录数:', diff_data['count'])
assert diff_data['count'] >= 1
print('✅ 人工确认前后差异接口可用')

dup_url = 'http://127.0.0.1:5000/api/duplicates?' + params
dup_resp = urllib.request.urlopen(dup_url)
dup_data = json.loads(dup_resp.read().decode())
print()
print('=== API /api/duplicates ===')
print('重复样本数:', dup_data['count'])
assert dup_data['count'] >= 1
print('✅ 重复样本接口可用')

print()
print('🎉 所有端到端Web验证通过！')
