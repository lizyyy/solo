#!/usr/bin/env python3
"""生成"出问题样例"特征快照，包含典型的线上特征缺失+默认分场景

输出：在当前脚本所在目录生成 problem_sample_features.csv
"""

import os
import sys
from pathlib import Path

import pandas as pd
import numpy as np

script_dir = Path(__file__).resolve().parent

np.random.seed(20260615)
N = 200

data = {
    "user_id": np.arange(10001, 10001 + N),
    "item_id": np.random.randint(20001, 29999, N),
    "user_click_rate_7d": np.random.uniform(0, 0.5, N),
    "item_ctr_7d": np.random.uniform(0, 0.1, N),
    "category_heat_score": np.random.uniform(0, 1, N),
    "user_tag_match_score": np.random.uniform(0, 1, N),
    "price_sensitivity": np.random.uniform(0, 1, N),
    "time_decay_factor": np.random.uniform(0.3, 1, N),
    "model_score": np.random.uniform(0, 1, N),
    "label": np.random.choice([0, 1], N, p=[0.85, 0.15]),
}

df = pd.DataFrame(data)

problem_rows = {
    3: {
        "desc": "user_click_rate + item_ctr 双缺失 + 默认分",
        "missing": ["user_click_rate_7d", "item_ctr_7d"],
    },
    7: {
        "desc": "category_heat + tag_match 缺失 + 默认分",
        "missing": ["category_heat_score", "user_tag_match_score"],
    },
    15: {
        "desc": "price_sensitivity 单缺失 + 默认分",
        "missing": ["price_sensitivity"],
    },
    24: {
        "desc": "time_decay + item_ctr 缺失 + 默认分",
        "missing": ["time_decay_factor", "item_ctr_7d"],
    },
    33: {
        "desc": "user_click + time_decay 缺失 + 默认分（线上已知bug样本）",
        "missing": ["user_click_rate_7d", "time_decay_factor"],
    },
    45: {
        "desc": "三特征缺失 + 默认分",
        "missing": ["user_click_rate_7d", "category_heat_score", "user_tag_match_score"],
    },
    52: {
        "desc": "price_sensitivity 单缺失，没有默认分（模型正常算分）",
        "missing": ["price_sensitivity"],
        "no_default": True,
    },
    66: {
        "desc": "item_ctr + time_decay 缺失 + 默认分",
        "missing": ["item_ctr_7d", "time_decay_factor"],
    },
}

for row_idx, info in problem_rows.items():
    for col in info["missing"]:
        df.at[row_idx, col] = -999
    if not info.get("no_default"):
        df.at[row_idx, "model_score"] = 0.5

csv_path = script_dir / "problem_sample_features.csv"
df.to_csv(csv_path, index=False)

print(f"✅ 出问题样例已生成: {csv_path}")
print(f"   总样本数: {len(df)}")
print(f"   问题样本数: {len(problem_rows)}")
print()
print("问题样本详情:")
for row_idx, info in problem_rows.items():
    default = "✅默认分 0.5" if not info.get("no_default") else "⚠正常算分"
    print(f"  行 #{row_idx+2}: {info['desc']} [{default}]")
