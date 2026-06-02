import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, precision_recall_curve, accuracy_score
)
from .config import Config, DEFAULT_CONFIG


class MetricCalculator:
    def __init__(self, config: Config = DEFAULT_CONFIG):
        self.config = config
        self.processing_log = []
        self.metrics_history = []

    def calculate_metrics(self, df: pd.DataFrame, 
                          label_col: str = "resolved_label",
                          score_col: str = "model_score",
                          pred_col: str = "model_prediction",
                          group_name: str = "overall") -> Dict:
        self._log(f"=== 开始计算指标 [{group_name}] ===")
        
        valid_df = df[df[label_col].notna() & df[score_col].notna()]
        
        if len(valid_df) == 0:
            self._log("⚠️  没有有效的数据用于计算指标")
            return {}
        
        y_true = valid_df[label_col].astype(int)
        y_scores = valid_df[score_col].astype(float)
        y_pred = (y_scores >= self.config.fraud_threshold).astype(int)
        
        metrics = {
            "group_name": group_name,
            "sample_count": len(valid_df),
            "positive_count": int(y_true.sum()),
            "negative_count": int((1 - y_true).sum()),
            "positive_ratio": float(y_true.mean()),
            "threshold": self.config.fraud_threshold
        }
        
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
        
        metrics.update({
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
            "accuracy": accuracy_score(y_true, y_pred),
            "precision": precision_score(y_true, y_pred, zero_division=0),
            "recall": recall_score(y_true, y_pred, zero_division=0),
            "specificity": tn / (tn + fp) if (tn + fp) > 0 else 0,
            "f1": f1_score(y_true, y_pred, zero_division=0)
        })
        
        if y_true.nunique() > 1:
            metrics["roc_auc"] = roc_auc_score(y_true, y_scores)
            
            precision_curve, recall_curve, thresholds = precision_recall_curve(y_true, y_scores)
            f1_scores = 2 * precision_curve * recall_curve / (precision_curve + recall_curve + 1e-10)
            best_idx = f1_scores.argmax()
            metrics.update({
                "best_f1": f1_scores[best_idx],
                "best_threshold": thresholds[best_idx],
                "best_precision": precision_curve[best_idx],
                "best_recall": recall_curve[best_idx]
            })
        else:
            metrics["roc_auc"] = None
        
        self._log(f"样本数: {metrics['sample_count']}, 欺诈率: {metrics['positive_ratio']:.1%}")
        self._log(f"准确率: {metrics['accuracy']:.4f}, 精确率: {metrics['precision']:.4f}, 召回率: {metrics['recall']:.4f}")
        self._log(f"F1: {metrics['f1']:.4f}, AUC: {metrics.get('roc_auc', 'N/A')}")
        
        return metrics

    def calculate_segmented_metrics(self, df: pd.DataFrame, 
                               segment_col: str) -> List[Dict]:
        self._log(f"=== 按 {segment_col} 分群计算指标 ===")
        
        segmented = []
        
        if segment_col not in df.columns:
            self._log(f"⚠️  未找到列 {segment_col}")
            return []
        
        for segment, group_df in df.groupby(segment_col):
            if len(group_df) >= 10:
                metrics = self.calculate_metrics(group_df, group_name=str(segment))
                metrics["segment"] = segment
                segmented.append(metrics)
            else:
                self._log(f"跳过分段 {segment}，样本数不足 (n={len(group_df)})")
        
        return segmented

    def compare_metrics(self, metrics1: Dict, metrics2: Dict, 
                        run1_name: str = "前次运行",
                        run2_name: str = "本次运行") -> Dict:
        self._log(f"=== 指标对比: {run1_name} vs {run2_name}")
        
        comparison = {
            "run1_name": run1_name,
            "run2_name": run2_name,
            "sample_diff": {},
            "metric_diff": {}
        }
        
        comparison["sample_diff"] = {
            "run1_count": metrics1.get("sample_count", 0),
            "run2_count": metrics2.get("sample_count", 0),
            "count_change": metrics2.get("sample_count", 0) - metrics1.get("sample_count", 0),
            "run1_positive": metrics1.get("positive_count", 0),
            "run2_positive": metrics2.get("positive_count", 0),
            "positive_change": metrics2.get("positive_count", 0) - metrics1.get("positive_count", 0)
        }
        
        metric_keys = ["accuracy", "precision", "recall", "f1", "roc_auc"]
        for key in metric_keys:
            v1 = metrics1.get(key)
            v2 = metrics2.get(key)
            if v1 is not None and v2 is not None:
                comparison["metric_diff"][key] = {
                    "run1": v1,
                    "run2": v2,
                    "diff": v2 - v1,
                    "diff_pct": (v2 - v1) / v1 * 100 if v1 != 0 else None
                }
        
        self._log(f"样本变化: {comparison['sample_diff']['count_change']:+d} 条")
        self._log(f"欺诈样本变化: {comparison['sample_diff']['positive_change']:+d} 条")
        
        return comparison

    def analyze_errors(self, df: pd.DataFrame, 
                   label_col: str = "resolved_label",
                   score_col: str = "model_score") -> Dict:
        self._log("=== 错误分析 ===")
        
        valid_df = df[df[label_col].notna() & df[score_col].notna()]
        y_true = valid_df[label_col].astype(int)
        y_pred = (valid_df[score_col] >= self.config.fraud_threshold).astype(int)
        
        fp_mask = (y_true == 0) & (y_pred == 1)
        fn_mask = (y_true == 1) & (y_pred == 0)
        
        errors = {
            "false_positives": valid_df[fp_mask],
            "false_negatives": valid_df[fn_mask],
            "fp_count": fp_mask.sum(),
            "fn_count": fn_mask.sum()
        }
        
        self._log(f"误报 (FP): {errors['fp_count']} 条")
        self._log(f"漏报 (FN): {errors['fn_count']} 条")
        
        if errors["fp_count"] > 0:
            self._log("=== 误报样本特征:")
            fp_df = errors["false_positives"]
            if "loan_amount" in fp_df.columns:
                self._log(f"  - 平均贷款金额: {fp_df['loan_amount'].mean():.0f}")
            if "model_score" in fp_df.columns:
                self._log(f"  - 平均模型评分: {fp_df['model_score'].mean():.4f}")
        
        if errors["fn_count"] > 0:
            self._log("=== 漏报样本特征:")
            fn_df = errors["false_negatives"]
            if "loan_amount" in fn_df.columns:
                self._log(f"  - 平均贷款金额: {fn_df['loan_amount'].mean():.0f}")
            if "model_score" in fn_df.columns:
                self._log(f"  - 平均模型评分: {fn_df['model_score'].mean():.4f}")
        
        return errors

    def get_threshold_sensitivity(self, df: pd.DataFrame,
                                  label_col: str = "resolved_label",
                                  score_col: str = "model_score") -> pd.DataFrame:
        valid_df = df[df[label_col].notna() & df[score_col].notna()]
        y_true = valid_df[label_col].astype(int)
        y_scores = valid_df[score_col].astype(float)
        
        results = []
        thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
        
        for thresh in thresholds:
            y_pred = (y_scores >= thresh).astype(int)
            tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
            
            results.append({
                "threshold": thresh,
                "precision": tp / (tp + fp) if (tp + fp) > 0 else 0,
                "recall": tp / (tp + fn) if (tp + fn) > 0 else 0,
                "f1": f1_score(y_true, y_pred, zero_division=0),
                "fp_count": int(fp),
                "fn_count": int(fn)
            })
        
        return pd.DataFrame(results)

    def _log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_msg = f"[{timestamp}] {message}"
        self.processing_log.append(log_msg)
        print(log_msg)

    def get_log(self) -> List[str]:
        return self.processing_log
