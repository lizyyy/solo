from typing import List, Optional, Set
from models import TrainingLog, AbnormalInfo, AbnormalType


class AnomalyDetector:
    def __init__(self, grayscale_set_ids: Optional[Set[str]] = None):
        self.grayscale_set_ids = grayscale_set_ids or set()

    def detect_all(self, current_log: TrainingLog, historical_log: Optional[TrainingLog] = None,
                   current_labels: Optional[List[str]] = None) -> List[AbnormalInfo]:
        abnormalities: List[AbnormalInfo] = []

        if historical_log:
            metric_abnormality = self._detect_metric_changed(current_log, historical_log)
            if metric_abnormality:
                abnormalities.append(metric_abnormality)

        leakage_abnormality = self._detect_data_leakage(current_log)
        if leakage_abnormality:
            abnormalities.append(leakage_abnormality)

        if current_labels:
            label_abnormality = self._detect_label_missing(current_log, current_labels)
            if label_abnormality:
                abnormalities.append(label_abnormality)

        return abnormalities

    def _detect_metric_changed(self, current_log: TrainingLog, historical_log: TrainingLog) -> Optional[AbnormalInfo]:
        current_metrics = set(current_log.metrics.keys())
        historical_metrics = set(historical_log.metrics.keys())

        new_metrics = current_metrics - historical_metrics
        missing_metrics = historical_metrics - current_metrics

        changed_values = {}
        for metric in current_metrics & historical_metrics:
            curr_val = current_log.metrics[metric]
            hist_val = historical_log.metrics[metric]
            if abs(curr_val - hist_val) > 1e-9:
                changed_values[metric] = {
                    "previous": hist_val,
                    "current": curr_val,
                    "diff_percent": round((curr_val - hist_val) / hist_val * 100, 2) if hist_val != 0 else float('inf')
                }

        if new_metrics or missing_metrics or changed_values:
            details = {
                "new_metrics": list(new_metrics),
                "missing_metrics": list(missing_metrics),
                "changed_values": changed_values,
                "previous_log_id": historical_log.log_id,
                "previous_version": historical_log.version
            }
            description_parts = []
            if new_metrics:
                description_parts.append(f"新增指标: {', '.join(new_metrics)}")
            if missing_metrics:
                description_parts.append(f"缺失指标: {', '.join(missing_metrics)}")
            if changed_values:
                changed_names = ', '.join(changed_values.keys())
                description_parts.append(f"指标值变动: {changed_names}")

            return AbnormalInfo(
                abnormal_type=AbnormalType.METRIC_CHANGED,
                description="；".join(description_parts),
                details=details
            )
        return None

    def _detect_data_leakage(self, current_log: TrainingLog) -> Optional[AbnormalInfo]:
        if not self.grayscale_set_ids:
            return None

        training_ids = set(current_log.training_set_ids)
        leaked_ids = training_ids & self.grayscale_set_ids

        if leaked_ids:
            details = {
                "leaked_sample_count": len(leaked_ids),
                "leaked_sample_ids": list(leaked_ids),
                "training_set_size": len(training_ids),
                "grayscale_set_size": len(self.grayscale_set_ids),
                "leakage_ratio": round(len(leaked_ids) / len(self.grayscale_set_ids), 4)
            }
            return AbnormalInfo(
                abnormal_type=AbnormalType.DATA_LEAKAGE,
                description=f"检测到 {len(leaked_ids)} 个样本同时出现在训练集和灰度验证集中，"
                            f"占灰度集比例约 {details['leakage_ratio'] * 100:.1f}%",
                details=details
            )
        return None

    def _detect_label_missing(self, current_log: TrainingLog, current_labels: List[str]) -> Optional[AbnormalInfo]:
        mapped_labels = set(current_log.label_mapping.keys())
        actual_labels = set(current_labels)
        missing_labels = actual_labels - mapped_labels

        if missing_labels:
            details = {
                "missing_count": len(missing_labels),
                "missing_labels": list(missing_labels),
                "mapped_labels": list(mapped_labels),
                "actual_labels": list(actual_labels)
            }
            return AbnormalInfo(
                abnormal_type=AbnormalType.LABEL_MISSING,
                description=f"有 {len(missing_labels)} 个标签未在映射表中定义: {', '.join(missing_labels)}",
                details=details
            )
        return None
