#!/usr/bin/env python3
"""生成示例特征快照数据，用于演示语义向量聚类命名系统"""
import numpy as np
import pandas as pd
import json

np.random.seed(42)

n_samples = 50
n_features = 8

texts = [
    "信用卡申请", "贷款咨询", "理财产品", "基金定投", "股票开户",
    "保险购买", "车险理赔", "信用卡还款", "房贷申请", "个人贷款",
    "转账汇款", "余额查询", "账单明细", "密码重置", "账户挂失",
    "手机银行", "网上银行", "微信支付", "支付宝", "银联扫码",
    "积分兑换", "优惠券", "活动报名", "新客礼", "邀请好友",
    "投诉建议", "客服咨询", "网点查询", "ATM查询", "营业预约",
] * 2

texts = texts[:n_samples]

centers = np.array([
    [1.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.0, 0.0, 0.0, -1.0, 0.0],
    [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, -1.0],
])

labels = np.random.randint(0, 4, n_samples)
X = np.array([centers[l] + np.random.randn(n_features) * 0.3 for l in labels])

data = []
for i in range(n_samples):
    vec_list = X[i].tolist()
    data.append({
        "id": i + 1,
        "text": texts[i],
        "vector": json.dumps(vec_list),
        "category": ["信贷", "理财", "支付", "服务"][labels[i]],
    })

df = pd.DataFrame(data)
df.to_csv("sample_snapshot.csv", index=False, encoding="utf-8-sig")

print(f"已生成示例数据: sample_snapshot.csv ({len(df)} 行)")
print(df.head())

df2 = df.copy()
df2.to_csv("sample_snapshot_duplicate.csv", index=False, encoding="utf-8-sig")
print(f"\n已生成重复数据: sample_snapshot_duplicate.csv")

df_supplement = df.sample(10, random_state=123).copy()
df_supplement["id"] = range(n_samples + 1, n_samples + 1 + len(df_supplement))
df_supplement.to_csv("sample_supplement.csv", index=False, encoding="utf-8-sig")
print(f"已生成补录数据: sample_supplement.csv ({len(df_supplement)} 行)")
