import pandas as pd

xlsx = pd.ExcelFile('data/output/浮标海况清洗结果_20260619.xlsx')
print('工作表列表:', xlsx.sheet_names)
print()

print('=== 筛选口径说明 ===')
df_filter = pd.read_excel(xlsx, '筛选口径说明')
for _, row in df_filter.iterrows():
    print(f'  {row["筛选口径项"]}: {row["筛选口径值"]}')
print()

print('=== 清洗结果统计 ===')
df_result = pd.read_excel(xlsx, '清洗结果')
print(f'总导出记录: {len(df_result)}')
print(f'已确认记录: {len(df_result[df_result["已确认"] == "是"])}')
print(f'重复标记记录: {len(df_result[df_result["是否重复"] == "是"])}')
print(f'有人工备注: {len(df_result[df_result["人工备注"].notna()])}')
print(f'晚到附件B-2026-013: {len(df_result[df_result["采样瓶编号"] == "B-2026-013"])} 条')
print()

print('=== 坐标格式分布 ===')
format_counts = df_result['坐标格式'].value_counts()
for fmt, cnt in format_counts.items():
    print(f'  {fmt}: {cnt} 条')
print()

print('=== 经纬度标准化验证 (抽样) ===')
sample = df_result[['采样瓶编号', '原始纬度', '原始经度', '标准化纬度', '标准化经度', '坐标格式']].head(7)
for _, row in sample.iterrows():
    print(f'  {row["采样瓶编号"]}: {row["原始纬度"]} -> {row["标准化纬度"]}, {row["原始经度"]} -> {row["标准化经度"]} [{row["坐标格式"]}]')
print()

print('=== 变更审计日志 ===')
df_audit = pd.read_excel(xlsx, '变更审计日志')
for _, row in df_audit.iterrows():
    print(f'  [{row["时间"]}] {row["采样瓶编号"]} {row["修改字段"]}: {row["旧值"]} -> {row["新值"]}')
    print(f'    操作人: {row["操作人"]}, 原因: {row["原因"]}')
print()

print('=== 人工备注验证 ===')
with_notes = df_result[df_result['人工备注'].notna()][['采样瓶编号', '人工备注']]
for _, row in with_notes.iterrows():
    print(f'  {row["采样瓶编号"]}: {row["人工备注"][:50]}...')
