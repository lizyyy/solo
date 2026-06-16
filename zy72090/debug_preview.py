import requests
import re

s = requests.Session()

# 上传文件
with open('samples/潮汐发电功率预测台账_样例.csv', 'rb') as f:
    resp = s.post('http://127.0.0.1:5001/upload',
                  files={'file': ('潮汐发电功率预测台账_样例.csv', f, 'text/csv')},
                  allow_redirects=True)

print("=== 映射页面 ===")
source_cols = re.findall(r'name="mapping_([^"]+)"', resp.text)
print("源列:", source_cols)

# 提交映射
form_data = {}
for col in source_cols:
    col_lower = col.lower()
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

print("\n映射配置:", form_data)

resp = s.post('http://127.0.0.1:5001/mapping', data=form_data, allow_redirects=True)
print(f"\n预览页面URL: {resp.url}")
print(f"页面大小: {len(resp.text)} bytes")

# 查找 TIDAL-2024-101 相关的内容
idx = resp.text.find('TIDAL-2024-101')
if idx >= 0:
    print(f"\n=== TIDAL-2024-101 附近内容 ===")
    print(resp.text[idx:idx+1000])
else:
    print("\n=== 没找到 TIDAL-2024-101，打印页面前5000字符 ===")
    print(resp.text[:5000])
