from typing import List, Dict, Any
from datetime import datetime
from collections import defaultdict
from .schemas import (
    EvaluationRecord, AnomalyRecord, AnomalyType,
    SampleRecord, HumanReview
)


class AnomalyDetector:
    def __init__(self, boundary_threshold: float = 0.95, null_threshold: float = 0.3):
        self.boundary_threshold = boundary_threshold
        self.null_threshold = null_threshold

    def detect_all(self, records: List[EvaluationRecord]) -> List[AnomalyRecord]:
        all_anomalies: List[AnomalyRecord] = []
        all_anomalies.extend(self.detect_duplicates(records))
        for record in records:
            single_anomalies = self.detect_single(record)
            record.anomalies.extend(single_anomalies)
            all_anomalies.extend(single_anomalies)
        all_anomalies.extend(self.detect_label_conflicts(records))
        all_anomalies.extend(self.detect_sample_leakage(records))
        return all_anomalies

    def _attach_anomaly(self, record: EvaluationRecord, anomaly: AnomalyRecord) -> None:
        record.anomalies.append(anomaly)

    def detect_duplicates(self, records: List[EvaluationRecord]) -> List[AnomalyRecord]:
        anomalies = []
        id_groups = defaultdict(list)
        feature_hashes = defaultdict(list)
        id_dup_ids = set()
        for record in records:
            id_groups[record.sample_id].append(record)
            feature_hash = self._hash_features(record.sample.features)
            feature_hashes[feature_hash].append(record)
        for sample_id, group in id_groups.items():
            if len(group) > 1:
                id_dup_ids.add(sample_id)
                sources = [r.sample.source for r in group]
                for record in group:
                    anomaly = AnomalyRecord(
                        anomaly_type=AnomalyType.DUPLICATE,
                        sample_id=sample_id,
                        description=f"样本ID重复出现 {len(group)} 次，来源: {sources}",
                        severity="error",
                        details={
                            "duplicate_count": len(group),
                            "duplicate_type": "sample_id",
                            "sources": sources,
                            "source": record.sample.source
                        }
                    )
                    anomalies.append(anomaly)
                    self._attach_anomaly(record, anomaly)
        for feature_hash, group in feature_hashes.items():
            if len(group) > 1:
                distinct_ids = list(dict.fromkeys(r.sample_id for r in group))
                if len(distinct_ids) < 2:
                    continue
                for record in group:
                    if record.sample_id in id_dup_ids:
                        continue
                    other_ids = [sid for sid in distinct_ids if sid != record.sample_id]
                    anomaly = AnomalyRecord(
                        anomaly_type=AnomalyType.DUPLICATE,
                        sample_id=record.sample_id,
                        description=f"样本特征与不同ID样本重复: {other_ids}",
                        severity="warning",
                        details={
                            "duplicate_count": len(group),
                            "duplicate_type": "features",
                            "duplicate_with": distinct_ids,
                            "source": record.sample.source
                        }
                    )
                    anomalies.append(anomaly)
                    self._attach_anomaly(record, anomaly)
        return anomalies

    def detect_null_values(self, record: EvaluationRecord) -> List[AnomalyRecord]:
        anomalies = []
        features = record.sample.features
        null_fields = []
        for key, value in features.items():
            if value is None or (isinstance(value, str) and value.strip() == ""):
                null_fields.append(key)
        if null_fields:
            null_ratio = len(null_fields) / len(features)
            anomaly = AnomalyRecord(
                anomaly_type=AnomalyType.NULL_VALUE,
                sample_id=record.sample_id,
                description=f"存在 {len(null_fields)} 个空值字段: {null_fields}",
                severity="error" if null_ratio >= self.null_threshold else "warning",
                details={
                    "null_fields": null_fields,
                    "null_ratio": null_ratio,
                    "total_fields": len(features),
                    "source": record.sample.source
                }
            )
            anomalies.append(anomaly)
        return anomalies

    def detect_boundary(self, record: EvaluationRecord) -> List[AnomalyRecord]:
        anomalies = []
        score = record.prediction.score
        if score >= self.boundary_threshold or score <= (1 - self.boundary_threshold):
            anomaly = AnomalyRecord(
                anomaly_type=AnomalyType.BOUNDARY,
                sample_id=record.sample_id,
                description=f"模型预测分数 {score:.4f} 处于边界区域",
                severity="warning",
                details={
                    "score": score,
                    "threshold": self.boundary_threshold,
                    "boundary_type": "high" if score >= self.boundary_threshold else "low",
                    "source": record.sample.source,
                    "prediction": record.prediction.prediction
                }
            )
            anomalies.append(anomaly)
        return anomalies

    def detect_single(self, record: EvaluationRecord) -> List[AnomalyRecord]:
        anomalies = []
        anomalies.extend(self.detect_null_values(record))
        anomalies.extend(self.detect_boundary(record))
        return anomalies

    def detect_label_conflicts(self, records: List[EvaluationRecord]) -> List[AnomalyRecord]:
        anomalies = []
        for record in records:
            if not record.review or not record.review.corrected_label:
                continue
            pred = record.prediction.prediction
            corrected = record.review.corrected_label
            conflicts = self._compare_labels(pred, corrected, parent_key="")
            if conflicts:
                anomaly = AnomalyRecord(
                    anomaly_type=AnomalyType.LABEL_CONFLICT,
                    sample_id=record.sample_id,
                    description=f"人工复核与模型预测存在 {len(conflicts)} 处标签冲突",
                    severity="error",
                    details={
                        "conflicts": conflicts,
                        "model_prediction": pred,
                        "human_correction": corrected,
                        "reviewer": record.review.reviewer,
                        "review_comment": record.review.review_comment,
                        "review_round": record.review.review_round,
                        "source": record.sample.source
                    }
                )
                anomalies.append(anomaly)
                self._attach_anomaly(record, anomaly)
        return anomalies

    def detect_sample_leakage(self, records: List[EvaluationRecord]) -> List[AnomalyRecord]:
        anomalies = []
        for record in records:
            features = record.sample.features
            prediction = record.prediction.prediction
            leakage_fields = []
            for feat_key, feat_val in features.items():
                for pred_key, pred_val in prediction.items():
                    if self._is_leakage(feat_key, feat_val, pred_key, pred_val):
                        leakage_fields.append({
                            "feature_field": feat_key,
                            "prediction_field": pred_key,
                            "feature_value": feat_val,
                            "prediction_value": pred_val,
                            "leakage_type": "structured_field"
                        })
            explanation_text = prediction.get("explanation_text", "")
            text_leakage = self._find_leakage_in_text(explanation_text, features)
            leakage_fields.extend(text_leakage)
            if leakage_fields:
                anomaly = AnomalyRecord(
                    anomaly_type=AnomalyType.SAMPLE_LEAKAGE,
                    sample_id=record.sample_id,
                    description=f"检测到 {len(leakage_fields)} 处潜在样本泄漏",
                    severity="critical",
                    details={
                        "leakage_fields": leakage_fields,
                        "source": record.sample.source
                    }
                )
                anomalies.append(anomaly)
                self._attach_anomaly(record, anomaly)
        return anomalies

    def _hash_features(self, features: Dict[str, Any]) -> str:
        exclude_keys = {"user_id", "item_id", "sample_id", "id", "uid", "iid"}
        filtered = {k: v for k, v in features.items() if k not in exclude_keys}
        items = sorted(filtered.items())
        return str(hash(str(items)))

    def _find_leakage_in_text(
        self, text: str, features: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        leakage = []
        if not isinstance(text, str):
            return leakage
        for feat_key, feat_val in features.items():
            if feat_val is None:
                continue
            if isinstance(feat_val, (int, float)):
                if abs(feat_val) < 1e-9:
                    continue
                found = False
                val_str = f"{feat_val:.2f}"
                if val_str in text:
                    found = True
                if feat_val == int(feat_val) and str(int(feat_val)) in text:
                    found = True
                    val_str = str(int(feat_val))
                if found:
                    leakage.append({
                        "feature_field": feat_key,
                        "prediction_field": "explanation_text",
                        "feature_value": feat_val,
                        "prediction_value": val_str,
                        "leakage_type": "text_numeric"
                    })
            elif isinstance(feat_val, str):
                if len(feat_val) > 2 and feat_val in text:
                    leakage.append({
                        "feature_field": feat_key,
                        "prediction_field": "explanation_text",
                        "feature_value": feat_val,
                        "prediction_value": feat_val,
                        "leakage_type": "text_string"
                    })
        return leakage

    def _compare_labels(
        self, pred: Any, corrected: Any, parent_key: str = ""
    ) -> List[Dict[str, Any]]:
        conflicts = []
        if isinstance(pred, dict) and isinstance(corrected, dict):
            all_keys = set(pred.keys()) | set(corrected.keys())
            for key in all_keys:
                full_key = f"{parent_key}.{key}" if parent_key else key
                if key not in pred:
                    conflicts.append({"field": full_key, "issue": "missing_in_prediction",
                                     "predicted": None, "corrected": corrected[key]})
                elif key not in corrected:
                    conflicts.append({"field": full_key, "issue": "extra_in_prediction",
                                     "predicted": pred[key], "corrected": None})
                else:
                    conflicts.extend(
                        self._compare_labels(pred[key], corrected[key], full_key)
                    )
        elif pred != corrected:
            conflicts.append({
                "field": parent_key if parent_key else "root",
                "issue": "value_mismatch",
                "predicted": pred,
                "corrected": corrected
            })
        return conflicts

    def _is_leakage(self, feat_key: str, feat_val: Any, pred_key: str, pred_val: Any) -> bool:
        if feat_val is None or pred_val is None:
            return False
        if isinstance(feat_val, (int, float)) and isinstance(pred_val, (int, float)):
            if abs(feat_val - pred_val) < 1e-9:
                return True
        if isinstance(feat_val, str) and isinstance(pred_val, str):
            if feat_val.lower() == pred_val.lower():
                return True
        if feat_val == pred_val:
            return True
        return False
