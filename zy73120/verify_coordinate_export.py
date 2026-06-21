import pandas as pd

xlsx = pd.ExcelFile('data/output/浮标海况清洗结果_坐标增强版.xlsx')
df = pd.read_excel(xlsx, '清洗结果')
row = df[df['采样瓶编号'] == 'B20260615-005'].iloc[0]
print('B20260615-005 清洗结果:')
print(f'  原始纬度: {row["原始纬度"]}')
print(f'  建议纬度: {row["建议纬度"]}')
print(f'  标准化纬度: {row["标准化纬度"]}')
print(f'  坐标格式: {row["坐标格式"]}')
print(f'  已确认: {row["已确认"]}')
print(f'  人工备注: {str(row["人工备注"])[:70]}')
assert abs(row['标准化纬度'] - 30.5) < 0.001, '标准化纬度应为30.5'
print('  ✅ 标准化纬度=30.5 断言通过')
print()

df_audit = pd.read_excel(xlsx, '变更审计日志')
lat_logs = df_audit[(df_audit['采样瓶编号'] == 'B20260615-005') & (df_audit['修改字段'] == 'latitude_std')]
print('B20260615-005 纬度变更审计:')
for _, r in lat_logs.iterrows():
    print(f'  {r["旧值"]} -> {r["新值"]} (操作人:{r["操作人"]}, 原因:{str(r["原因"])[:30]})')
assert len(lat_logs) >= 1, '应有纬度变更日志'
print('  ✅ 纬度旧值/新值留痕断言通过')
print()

print('筛选口径说明:')
df_f = pd.read_excel(xlsx, '筛选口径说明')
for _, r in df_f.iterrows():
    print(f'  {r["筛选口径项"]}: {r["筛选口径值"]}')
print()

still_pending = df[df['待确认'] == '是']
print(f'仍待确认记录数: {len(still_pending)} (B20260615-006/007未确认不出现在默认导出)')
print()

print(f'导出总记录数: {len(df)}')
print(f'已确认记录数: {len(df[df["已确认"]=="是"])}')
