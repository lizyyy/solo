import pandas as pd

df_failures = pd.read_excel('output/failures.xlsx')
df_metrics = pd.read_excel('output/model_metrics.xlsx')

print("=" * 80)
print("模型评估指标")
print("=" * 80)
print(df_metrics.to_string(index=False))

print("\n" + "=" * 80)
print("异常类型统计")
print("=" * 80)
type_counts = df_failures['异常类型'].value_counts()
print(type_counts.to_string())

print("\n" + "=" * 80)
print("单位问题示例 (前10条)")
print("=" * 80)
unit_issues = df_failures[df_failures['异常类型'].str.contains('unit', case=False, na=False)]
if len(unit_issues) > 0:
    print(unit_issues.head(10).to_string(index=False))
else:
    print("无单位问题记录")

print("\n" + "=" * 80)
print("无法识别的单位问题示例 (前10条)")
print("=" * 80)
unrecognized = df_failures[df_failures['异常类型'] == 'unrecognized_unit']
if len(unrecognized) > 0:
    print(unrecognized.head(10).to_string(index=False))
else:
    print("无无法识别的单位问题")

print("\n" + "=" * 80)
print("各列单位问题分布")
print("=" * 80)
unit_df = df_failures[df_failures['异常类型'].str.contains('unit', case=False, na=False)]
if len(unit_df) > 0:
    print(unit_df.groupby(['列名', '异常类型']).size().to_string())
