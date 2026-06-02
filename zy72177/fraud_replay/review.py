import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from .config import Config, DEFAULT_CONFIG


class ReviewProcessor:
    def __init__(self, config: Config = DEFAULT_CONFIG):
        self.config = config
        self.processing_log = []
        self.review_history = []

    def process_review_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        self._log("=== 开始人工复核和线上反馈处理 ===")
        df = df.copy()
        
        df = self._standardize_review_columns(df)
        df = self._resolve_label_precedence(df)
        df = self._tag_discrepancies(df)
        
        summary = self._get_review_summary(df)
        self._log(f"复核处理完成，共 {len(df)} 条记录")
        
        return df, summary

    def _standardize_review_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        review_mapping = {
            "人工复核结果": "review_result",
            "audit_result": "review_result",
            "manual_label": "review_result",
            "review_label": "review_result",
            "线上反馈结果": "online_feedback",
            "feedback_result": "online_feedback",
            "actual_result": "online_feedback",
            "最终结果": "final_label",
            "final_result": "final_label"
        }
        
        for old_col, new_col in review_mapping.items():
            if old_col in df.columns and new_col not in df.columns:
                df[new_col] = df[old_col]
                self._log(f"列名映射: {old_col} -> {new_col}")
        
        if "online_feedback" in df.columns and "final_label" not in df.columns:
            df["final_label"] = df["online_feedback"]
        
        if "review_result" not in df.columns:
            df["review_result"] = df.get("is_fraud", np.nan)
            self._log("未找到人工复数列，使用原始标签作为默认复核结果")
        
        return df

    def _resolve_label_precedence(self, df: pd.DataFrame) -> pd.DataFrame:
        df["resolved_label"] = np.nan
        
        if "online_feedback" in df.columns:
            mask = df["online_feedback"].notna()
            df.loc[mask, "resolved_label"] = df.loc[mask, "online_feedback"]
            df.loc[mask, "label_source"] = "线上反馈"
            self._log(f"使用线上反馈作为最终标签: {mask.sum()} 条")
        
        mask_review = df["resolved_label"].isna() & df["review_result"].notna()
        if mask_review.any():
            df.loc[mask_review, "resolved_label"] = df.loc[mask_review, "review_result"]
            df.loc[mask_review, "label_source"] = "人工复核"
            self._log(f"使用人工复核作为最终标签: {mask_review.sum()} 条")
        
        mask_original = df["resolved_label"].isna() & df["is_fraud"].notna()
        if mask_original.any():
            df.loc[mask_original, "resolved_label"] = df.loc[mask_original, "is_fraud"]
            df.loc[mask_original, "label_source"] = "原始标签"
            self._log(f"使用原始标签作为最终标签: {mask_original.sum()} 条")
        
        df["resolved_label"] = pd.to_numeric(df["resolved_label"], errors="coerce")
        
        return df

    def _tag_discrepancies(self, df: pd.DataFrame) -> pd.DataFrame:
        df["model_correct"] = np.nan
        
        if "model_prediction" in df.columns and "resolved_label" in df.columns:
            df["model_correct"] = (df["model_prediction"] == df["resolved_label"]).astype(int)
            
            wrong_mask = df["model_correct"] == 0
            if wrong_mask.any():
                fp_mask = wrong_mask & (df["model_prediction"] == 1) & (df["resolved_label"] == 0)
                fn_mask = wrong_mask & (df["model_prediction"] == 0) & (df["resolved_label"] == 1)
                
                df["error_type"] = np.nan
                df.loc[fp_mask, "error_type"] = "误报 (FP)"
                df.loc[fn_mask, "error_type"] = "漏报 (FN)"
                
                self._log(f"模型预测错误: {wrong_mask.sum()} 条，其中误报 {fp_mask.sum()} 条，漏报 {fn_mask.sum()} 条")
        
        df["label_changed"] = False
        if "is_fraud" in df.columns and "resolved_label" in df.columns:
            df["label_changed"] = (df["is_fraud"] != df["resolved_label"]) & \
                                  df["is_fraud"].notna() & \
                                  df["resolved_label"].notna()
            self._log(f"标签变更记录: {df['label_changed'].sum()} 条")
        
        return df

    def merge_review_feedback(self, model_df: pd.DataFrame, 
                              review_df: Optional[pd.DataFrame] = None,
                              feedback_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        merged_df = model_df.copy()
        
        if review_df is not None and not review_df.empty:
            review_cols = [c for c in ["sample_id", "review_result", "review_time", "reviewer", "review_note"] 
                          if c in review_df.columns]
            if "sample_id" in review_cols:
                review_data = review_df[review_cols].drop_duplicates("sample_id", keep="last")
                merged_df = merged_df.merge(
                    review_data,
                    on="sample_id",
                    how="left",
                    suffixes=("", "_review")
                )
                if "review_result_review" in merged_df.columns:
                    merged_df["review_result"] = merged_df["review_result_review"].fillna(merged_df.get("review_result"))
                    merged_df = merged_df.drop(columns=["review_result_review"])
                self._log(f"合并人工复核数据: {len(review_df)} 条")
        
        if feedback_df is not None and not feedback_df.empty:
            feedback_cols = [c for c in ["sample_id", "online_feedback", "feedback_time", "feedback_source", "feedback_note"]
                            if c in feedback_df.columns]
            if "sample_id" in feedback_cols:
                feedback_data = feedback_df[feedback_cols].drop_duplicates("sample_id", keep="last")
                merged_df = merged_df.merge(
                    feedback_data,
                    on="sample_id",
                    how="left",
                    suffixes=("", "_feedback")
                )
                self._log(f"合并线上反馈数据: {len(feedback_df)} 条")
        
        return merged_df

    def update_label_for_sample(self, df: pd.DataFrame, sample_id: str, 
                                new_label: int, source: str = "manual",
                                note: str = "") -> pd.DataFrame:
        df = df.copy()
        mask = df["sample_id"] == sample_id
        
        if mask.any():
            old_label = df.loc[mask, "resolved_label"].values[0] if "resolved_label" in df.columns else None
            df.loc[mask, "review_result"] = new_label
            df.loc[mask, "resolved_label"] = new_label
            df.loc[mask, "label_source"] = source
            df.loc[mask, "review_note"] = note
            df.loc[mask, "review_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            self.review_history.append({
                "sample_id": sample_id,
                "old_label": old_label,
                "new_label": new_label,
                "source": source,
                "note": note,
                "update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            self._log(f"更新样本 {sample_id} 标签: {old_label} -> {new_label} ({source})")
        
        return df

    def _get_review_summary(self, df: pd.DataFrame) -> Dict:
        summary = {
            "label_source_distribution": df["label_source"].value_counts().to_dict() if "label_source" in df.columns else {},
            "label_changed_count": df["label_changed"].sum() if "label_changed" in df.columns else 0,
            "model_accuracy": df["model_correct"].mean() if "model_correct" in df.columns and df["model_correct"].notna().any() else None,
            "error_breakdown": {
                "false_positive": ((df["error_type"] == "误报 (FP)").sum() if "error_type" in df.columns else 0),
                "false_negative": ((df["error_type"] == "漏报 (FN)").sum() if "error_type" in df.columns else 0)
            }
        }
        return summary

    def get_samples_for_review(self, df: pd.DataFrame, 
                               priority: str = "high_conflict") -> pd.DataFrame:
        if priority == "high_conflict":
            return df[df.get("has_label_conflict", False)].copy()
        elif priority == "boundary":
            mask = (df["model_score"] >= self.config.fraud_threshold - 0.1) & \
                   (df["model_score"] <= self.config.fraud_threshold + 0.1)
            return df[mask].sort_values("model_score").copy()
        elif priority == "errors":
            return df[df.get("model_correct", True) == 0].copy()
        else:
            return df.copy()

    def _log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_msg = f"[{timestamp}] {message}"
        self.processing_log.append(log_msg)
        print(log_msg)

    def get_review_history(self) -> List[Dict]:
        return self.review_history

    def get_log(self) -> List[str]:
        return self.processing_log
