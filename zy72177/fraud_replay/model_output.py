import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from .config import Config, DEFAULT_CONFIG


class ModelOutputProcessor:
    def __init__(self, config: Config = DEFAULT_CONFIG):
        self.config = config
        self.processing_log = []
        self.label_conflicts = []
        self.leakage_candidates = []

    def process_model_output(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        self._log("=== 开始模型输出处理 ===")
        df = df.copy()
        
        df = self._normalize_model_scores(df)
        df = self._detect_label_conflicts(df)
        df = self._detect_sample_leakage(df)
        
        summary = self._get_model_summary(df)
        self._log(f"模型输出处理完成，共 {len(df)} 条记录")
        
        return df, summary

    def _normalize_model_scores(self, df: pd.DataFrame) -> pd.DataFrame:
        if "model_score" in df.columns:
            df["model_score"] = pd.to_numeric(df["model_score"], errors="coerce")
            
            score_min = df["model_score"].min()
            score_max = df["model_score"].max()
            
            if score_max > 1.0 or score_min < 0.0:
                self._log(f"⚠️  模型评分范围异常: [{score_min:.4f}, {score_max:.4f}]，将进行归一化")
                df["model_score_raw"] = df["model_score"].copy()
                df["model_score"] = (df["model_score"] - score_min) / (score_max - score_min)
            
            df["model_prediction"] = (df["model_score"] >= self.config.fraud_threshold).astype(int)
        else:
            self._log("⚠️  未找到 model_score 列，跳过模型预测生成")
        
        return df

    def _detect_label_conflicts(self, df: pd.DataFrame) -> pd.DataFrame:
        conflicts = []
        
        if "is_fraud" in df.columns and "review_result" in df.columns:
            df["is_fraud_num"] = pd.to_numeric(df["is_fraud"], errors="coerce")
            df["review_result_num"] = pd.to_numeric(df["review_result"], errors="coerce")
            
            conflict_mask = (df["is_fraud_num"] != df["review_result_num"]) & \
                           df["is_fraud_num"].notna() & \
                           df["review_result_num"].notna()
            
            conflict_samples = df[conflict_mask]
            
            for _, row in conflict_samples.iterrows():
                conflicts.append({
                    "sample_id": row.get("sample_id", "unknown"),
                    "user_id": row.get("user_id", "unknown"),
                    "original_label": row["is_fraud_num"],
                    "review_label": row["review_result_num"],
                    "model_score": row.get("model_score", None),
                    "source": row.get("source", "unknown"),
                    "apply_time": row.get("apply_time", None)
                })
        
        conflict_count = len(conflicts)
        conflict_ratio = conflict_count / len(df) if len(df) > 0 else 0
        
        self.label_conflicts = conflicts
        
        if conflict_count > 0:
            self._log(f"⚠️  发现 {conflict_count} 条标签冲突记录 ({conflict_ratio:.1%})")
            
            if conflict_ratio >= self.config.label_conflict_warning_threshold:
                self._log(f"🚨 标签冲突比例超过警戒值 {self.config.label_conflict_warning_threshold:.0%}，请重点关注！")
        
        df["has_label_conflict"] = df["sample_id"].isin([c["sample_id"] for c in conflicts])
        
        return df

    def _detect_sample_leakage(self, df: pd.DataFrame) -> pd.DataFrame:
        leakage_candidates = []
        
        if "apply_time" in df.columns and "user_id" in df.columns:
            df["apply_time_dt"] = pd.to_datetime(df["apply_time"], errors="coerce")
            
            user_groups = df[df["apply_time_dt"].notna()].groupby("user_id")
            
            for user_id, group in user_groups:
                if len(group) > 1:
                    sorted_group = group.sort_values("apply_time_dt")
                    
                    for i in range(1, len(sorted_group)):
                        time_diff = sorted_group.iloc[i]["apply_time_dt"] - sorted_group.iloc[i-1]["apply_time_dt"]
                        hours_diff = time_diff.total_seconds() / 3600
                        
                        if hours_diff <= self.config.leakage_detection_window_hours:
                            leakage_candidates.append({
                                "user_id": user_id,
                                "sample_id_1": sorted_group.iloc[i-1]["sample_id"],
                                "sample_id_2": sorted_group.iloc[i]["sample_id"],
                                "apply_time_1": sorted_group.iloc[i-1]["apply_time"],
                                "apply_time_2": sorted_group.iloc[i]["apply_time"],
                                "hours_diff": round(hours_diff, 2),
                                "model_score_1": sorted_group.iloc[i-1].get("model_score", None),
                                "model_score_2": sorted_group.iloc[i].get("model_score", None)
                            })
        
        self.leakage_candidates = leakage_candidates
        
        if leakage_candidates:
            self._log(f"⚠️  发现 {len(leakage_candidates)} 组潜在样本泄漏（同一用户 {self.config.leakage_detection_window_hours} 小时内多次申请）")
        
        return df

    def get_conflict_samples(self) -> List[Dict]:
        return self.label_conflicts

    def get_leakage_candidates(self) -> List[Dict]:
        return self.leakage_candidates

    def _get_model_summary(self, df: pd.DataFrame) -> Dict:
        summary = {
            "label_conflict_count": len(self.label_conflicts),
            "label_conflict_ratio": len(self.label_conflicts) / len(df) if len(df) > 0 else 0,
            "leakage_candidate_count": len(self.leakage_candidates),
            "conflict_details": self.label_conflicts[:10],
            "leakage_details": self.leakage_candidates[:10]
        }
        
        if "model_score" in df.columns:
            summary.update({
                "score_distribution": {
                    "mean": df["model_score"].mean(),
                    "median": df["model_score"].median(),
                    "min": df["model_score"].min(),
                    "max": df["model_score"].max(),
                    "std": df["model_score"].std()
                },
                "prediction_distribution": df["model_prediction"].value_counts().to_dict() if "model_prediction" in df.columns else {}
            })
        
        return summary

    def compare_runs(self, run1_df: pd.DataFrame, run2_df: pd.DataFrame) -> Dict:
        self._log("=== 开始两次运行对比 ===")
        
        comparison = {
            "sample_changes": {},
            "metric_changes": {}
        }
        
        samples1 = set(run1_df["sample_id"].unique())
        samples2 = set(run2_df["sample_id"].unique())
        
        new_samples = samples2 - samples1
        removed_samples = samples1 - samples2
        common_samples = samples1 & samples2
        
        comparison["sample_changes"] = {
            "total_run1": len(samples1),
            "total_run2": len(samples2),
            "new_samples_count": len(new_samples),
            "removed_samples_count": len(removed_samples),
            "common_samples_count": len(common_samples),
            "new_sample_ids": list(new_samples)[:20],
            "removed_sample_ids": list(removed_samples)[:20]
        }
        
        if common_samples and "model_score" in run1_df.columns and "model_score" in run2_df.columns:
            common1 = run1_df[run1_df["sample_id"].isin(common_samples)].set_index("sample_id")
            common2 = run2_df[run2_df["sample_id"].isin(common_samples)].set_index("sample_id")
            
            score_diff = common2["model_score"] - common1["model_score"]
            changed_mask = score_diff.abs() > 1e-6
            
            comparison["metric_changes"] = {
                "score_changed_count": changed_mask.sum(),
                "score_changed_ratio": changed_mask.mean(),
                "score_diff_mean": score_diff.mean(),
                "score_diff_std": score_diff.std(),
                "top_increases": score_diff.nlargest(10).to_dict(),
                "top_decreases": score_diff.nsmallest(10).to_dict()
            }
        
        self._log(f"对比完成: 新增 {len(new_samples)} 条，移除 {len(removed_samples)} 条，共有 {len(common_samples)} 条")
        
        return comparison

    def _log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_msg = f"[{timestamp}] {message}"
        self.processing_log.append(log_msg)
        print(log_msg)

    def get_log(self) -> List[str]:
        return self.processing_log
