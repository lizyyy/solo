import pandas as pd
import numpy as np
import os

np.random.seed(123)
out_dir = os.path.dirname(os.path.abspath(__file__))

orig = pd.read_csv(os.path.join(out_dir, 'model_output_logs.csv'))
orig = orig.drop_duplicates(subset=['sample_id']).reset_index(drop=True)

df_prev = orig.iloc[:30].copy()

df_curr = orig.iloc[5:40].copy()
np.random.seed(123)
perturb_idx = np.random.choice(df_curr.index, size=8, replace=False)
df_curr.loc[perturb_idx, 'model_score'] = df_curr.loc[perturb_idx, 'model_score'].astype(float) + \
    np.random.uniform(-0.3, 0.3, size=len(perturb_idx))
df_curr['model_score'] = df_curr['model_score'].clip(0, 1).round(4)

extra_rows = [
    {"sample_id": "SAMPLE_NEW01", "user_id": "USER_0050", "apply_time": "2024-02-10 09:00:00",
     "loan_amount": 80000, "loan_term": 12, "income_level": "中", "credit_score": 680,
     "region": "华东", "is_fraud": 1, "model_score": 0.8800, "review_result": 1,
     "source": "模型日志A", "process_time": "2024-02-11 10:00:00"},
    {"sample_id": "SAMPLE_NEW02", "user_id": "USER_0051", "apply_time": "2024-02-11 14:00:00",
     "loan_amount": 30000, "loan_term": 6, "income_level": "低", "credit_score": 580,
     "region": "华南", "is_fraud": 0, "model_score": 0.1200, "review_result": 0,
     "source": "模型日志B", "process_time": "2024-02-12 11:00:00"},
    {"sample_id": "SAMPLE_NEW03", "user_id": "USER_0052", "apply_time": "2024-02-12 08:00:00",
     "loan_amount": 150000, "loan_term": 24, "income_level": "高", "credit_score": 720,
     "region": "华北", "is_fraud": 1, "model_score": 0.4200, "review_result": 1,
     "source": "模型日志A", "process_time": "2024-02-13 09:00:00"},
]
df_curr = pd.concat([df_curr, pd.DataFrame(extra_rows)], ignore_index=True)

prev_path = os.path.join(out_dir, 'run_previous.csv')
curr_path = os.path.join(out_dir, 'run_current.csv')
df_prev.to_csv(prev_path, index=False, encoding='utf-8-sig')
df_curr.to_csv(curr_path, index=False, encoding='utf-8-sig')
print(f"OK: {prev_path} ({len(df_prev)} rows), {curr_path} ({len(df_curr)} rows)")
