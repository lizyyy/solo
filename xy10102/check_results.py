import pandas as pd

df_failures = pd.read_excel('output/failures.xlsx')
df_metrics = pd.read_excel('output/model_metrics.xlsx')

print("=" * 60)
print("模型评估指标")
print("=" * 60)
print(df_metrics.to_string(index=False))

print("\n" + "=" * 60)
print("失败样本示例 (前10条)")
print("=" * 60)
print(df_failures.head(10).to_string(index=False))

print("\n" + "=" * 60)
print("异常类型统计")
print("=" * 60)
print(df_failures['异常类型'].value_counts().to_string())
