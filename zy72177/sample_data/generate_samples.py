import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

np.random.seed(42)

def generate_sample_data(output_dir: str = "./sample_data"):
    os.makedirs(output_dir, exist_ok=True)
    
    n_samples = 50
    
    user_ids = [f"USER_{i:04d}" for i in range(1, 41)]
    
    base_time = datetime(2024, 1, 15, 10, 0, 0)
    
    data = []
    for i in range(n_samples):
        user_idx = i % 40
        hour_offset = np.random.randint(0, 720)
        
        is_fraud = 1 if np.random.random() < 0.15 else 0
        
        if is_fraud:
            model_score = np.random.uniform(0.3, 0.95)
        else:
            model_score = np.random.uniform(0.01, 0.7)
        
        review_result = is_fraud
        if np.random.random() < 0.08:
            review_result = 1 - review_result
        
        row = {
            "sample_id": f"SAMPLE_{i+1:05d}",
            "user_id": user_ids[user_idx],
            "apply_time": (base_time + timedelta(hours=hour_offset)).strftime("%Y-%m-%d %H:%M:%S"),
            "loan_amount": int(np.random.choice([5000, 10000, 20000, 50000, 100000, 200000])),
            "loan_term": int(np.random.choice([3, 6, 12, 24, 36])),
            "income_level": np.random.choice(["低", "中", "高"], p=[0.3, 0.5, 0.2]),
            "credit_score": int(np.random.normal(650, 100)),
            "region": np.random.choice(["华东", "华南", "华北", "西南", "东北"]),
            "is_fraud": is_fraud,
            "model_score": round(model_score, 4),
            "review_result": review_result,
            "source": np.random.choice(["模型日志A", "模型日志B", "人工复核"]),
            "process_time": (base_time + timedelta(hours=hour_offset + 24)).strftime("%Y-%m-%d %H:%M:%S")
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    
    df.loc[5, "income_level"] = ""
    df.loc[12, "credit_score"] = np.nan
    df.loc[28, "region"] = "NA"
    
    df.loc[35] = df.loc[10].copy()
    df.loc[35, "source"] = "重复评测"
    df.loc[36] = df.loc[20].copy()
    df.loc[36, "model_score"] = 0.52
    
    df.loc[40, "model_score"] = 0.51
    df.loc[41, "model_score"] = 0.49
    df.loc[42, "model_score"] = 0.50
    
    df.loc[45, "review_result"] = 1 - df.loc[45, "is_fraud"]
    df.loc[46, "review_result"] = 1 - df.loc[46, "is_fraud"]
    
    df.loc[47, "user_id"] = user_ids[5]
    df.loc[47, "apply_time"] = (base_time + timedelta(hours=100)).strftime("%Y-%m-%d %H:%M:%S")
    df.loc[48, "user_id"] = user_ids[5]
    df.loc[48, "apply_time"] = (base_time + timedelta(hours=105)).strftime("%Y-%m-%d %H:%M:%S")
    
    model_output_path = f"{output_dir}/model_output_logs.csv"
    df.to_csv(model_output_path, index=False, encoding="utf-8-sig")
    print(f"✅ 已生成模型输出日志: {model_output_path}")
    print(f"   - 样本总数: {len(df)}")
    print(f"   - 欺诈样本: {df['is_fraud'].sum()}")
    print(f"   - 包含空值、重复项、边界记录")
    
    review_data = df[["sample_id", "review_result"]].sample(20).copy()
    review_data["reviewer"] = np.random.choice(["张审核", "李审核", "王审核"], size=len(review_data))
    review_data["review_time"] = (base_time + timedelta(days=5)).strftime("%Y-%m-%d")
    review_path = f"{output_dir}/manual_review.csv"
    review_data.to_csv(review_path, index=False, encoding="utf-8-sig")
    print(f"✅ 已生成人工复核数据: {review_path}")
    
    feedback_data = df[df["is_fraud"] == 1][["sample_id", "is_fraud"]].copy()
    feedback_data.columns = ["sample_id", "online_feedback"]
    feedback_data["feedback_source"] = "催收反馈"
    feedback_path = f"{output_dir}/online_feedback.csv"
    feedback_data.to_csv(feedback_path, index=False, encoding="utf-8-sig")
    print(f"✅ 已生成线上反馈数据: {feedback_path}")
    
    return df

if __name__ == "__main__":
    generate_sample_data()
