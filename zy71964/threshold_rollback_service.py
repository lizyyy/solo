from typing import List, Optional, Dict, Any, Set
from datetime import datetime

from models import (
    MaterialInfo, TrainingLog, ThresholdConfig, RollbackRecord,
    RollbackStatus, AbnormalInfo, AbnormalType
)
from storage import Storage
from anomaly_detector import AnomalyDetector
from version_comparator import VersionComparator
from exceptions import (
    ThresholdRollbackException,
    ERROR_DUPLICATE_MATERIAL,
    ERROR_LOG_NOT_FOUND,
    ERROR_THRESHOLD_INVALID,
    ERROR_METRIC_CHANGED,
    ERROR_DATA_LEAKAGE,
    ERROR_LABEL_MISSING,
    ERROR_LOG_VERSION_CONFLICT,
    raise_with_params,
    create_friendly_error,
)


class ThresholdRollbackService:
    def __init__(self, storage: Optional[Storage] = None):
        self.storage = storage or Storage()
        self.version_comparator = VersionComparator()

    def upload_material(self, material_id: str, name: str, version: str,
                        metadata: Optional[Dict[str, Any]] = None) -> MaterialInfo:
        material = MaterialInfo(
            material_id=material_id,
            name=name,
            version=version,
            metadata=metadata or {}
        )
        self.storage.save_material(material)
        return material

    def upload_training_log(
        self,
        log_id: str,
        material_id: str,
        version: str,
        metrics: Dict[str, float],
        feature_stats: Dict[str, Any],
        label_mapping: Dict[str, str],
        training_set_ids: List[str],
        check_version_diff: bool = True,
    ) -> Dict[str, Any]:
        material = self.storage.get_material(material_id)
        if not material:
            raise_with_params(ERROR_LOG_NOT_FOUND, material_id=material_id)

        new_log = TrainingLog(
            log_id=log_id,
            material_id=material_id,
            version=version,
            metrics=metrics,
            feature_stats=feature_stats,
            label_mapping=label_mapping,
            training_set_ids=training_set_ids,
        )

        result = {
            "log_id": log_id,
            "material_id": material_id,
            "version": version,
            "version_conflict": False,
            "comparison_result": None,
            "message": "训练日志上传成功。",
        }

        old_log = self.storage.get_latest_log(material_id)
        if old_log and check_version_diff:
            existing_same_hash = self.storage.get_log_by_hash(material_id, new_log.content_hash())
            if existing_same_hash:
                result["message"] = "该训练日志内容与历史版本完全一致，已跳过重复上传。"
                result["existing_log_id"] = existing_same_hash.log_id
                return result

            comparison = self.version_comparator.compare(new_log, old_log)
            if comparison["has_changes"]:
                result["version_conflict"] = True
                result["comparison_result"] = comparison
                result["message"] = self.version_comparator.format_changes_for_display(comparison)

        self.storage.save_training_log(new_log)
        return result

    def execute_rollback(
        self,
        material_id: str,
        threshold_configs: List[ThresholdConfig],
        grayscale_set_ids: Optional[Set[str]] = None,
        current_labels: Optional[List[str]] = None,
        force_recalculate: bool = False,
        ignore_metric_change: bool = False,
        ignore_data_leakage: bool = False,
        ignore_label_missing: bool = False,
    ) -> RollbackRecord:
        self._validate_threshold_configs(threshold_configs)

        material = self.storage.get_material(material_id)
        if not material:
            raise_with_params(ERROR_LOG_NOT_FOUND, material_id=material_id)

        current_log = self.storage.get_latest_log(material_id)
        if not current_log:
            raise_with_params(ERROR_LOG_NOT_FOUND, material_id=material_id)

        existing_record = self.storage.get_active_successful_record(material_id)
        if existing_record and not force_recalculate:
            existing_log = self.storage.get_log_by_hash(material_id, current_log.content_hash())
            if existing_log and existing_record.log_id == existing_log.log_id:
                raise_with_params(ERROR_DUPLICATE_MATERIAL, material_id=material_id)

        historical_log = self._get_previous_log(material_id, current_log)

        detector = AnomalyDetector(grayscale_set_ids=grayscale_set_ids)
        abnormalities = detector.detect_all(
            current_log=current_log,
            historical_log=historical_log,
            current_labels=current_labels,
        )

        record = RollbackRecord(
            material_id=material_id,
            material_name=material.name,
            log_id=current_log.log_id,
            log_version=current_log.version,
            threshold_configs=threshold_configs,
        )

        needs_manual_confirm = False
        human_messages = []

        for abnormal in abnormalities:
            if abnormal.abnormal_type == AbnormalType.METRIC_CHANGED and not ignore_metric_change:
                needs_manual_confirm = True
                human_messages.append(self._format_abnormal_message(abnormal))
            elif abnormal.abnormal_type == AbnormalType.DATA_LEAKAGE and not ignore_data_leakage:
                needs_manual_confirm = True
                human_messages.append(self._format_abnormal_message(abnormal))
            elif abnormal.abnormal_type == AbnormalType.LABEL_MISSING and not ignore_label_missing:
                needs_manual_confirm = True
                human_messages.append(self._format_abnormal_message(abnormal))

        record.abnormalities = abnormalities
        record.human_message = "\n\n".join(human_messages) if human_messages else ""

        if needs_manual_confirm:
            record.status = RollbackStatus.ABNORMAL
            record.human_message = "检测到以下异常，需人工确认后才能继续：\n\n" + record.human_message
        else:
            record.status = RollbackStatus.PENDING
            record = self._calculate_and_rollback(record, current_log)

        if existing_record and force_recalculate:
            self.storage.mark_record_as_historical(existing_record.record_id, record.record_id)
            record.previous_record_id = existing_record.record_id

            all_logs = self.storage.get_all_logs(material_id)
            old_log_for_compare = None
            for log in all_logs:
                if log.log_id != current_log.log_id:
                    old_log_for_compare = log
                    break

            if old_log_for_compare and old_log_for_compare.log_id != current_log.log_id:
                comparison = self.version_comparator.compare(current_log, old_log_for_compare)
                if comparison["has_changes"]:
                    record.version_changes = comparison
                    if record.human_message:
                        record.human_message += "\n\n"
                    record.human_message += "⚠️  训练日志版本变更提醒：\n"
                    record.human_message += self.version_comparator.format_changes_for_display(comparison)

        self.storage.save_rollback_record(record)
        return record

    def confirm_and_continue(
        self,
        record_id: str,
        approve_metric_change: bool = False,
        approve_data_leakage: bool = False,
        approve_label_missing: bool = False,
    ) -> RollbackRecord:
        records = [r for r in self.storage._rollback_records.values() if r.record_id == record_id]
        if not records:
            raise ValueError(f"未找到记录 {record_id}")

        record = records[0]
        if record.status != RollbackStatus.ABNORMAL:
            return record

        pending_types = set(a.abnormal_type for a in record.abnormalities)

        if AbnormalType.METRIC_CHANGED in pending_types and not approve_metric_change:
            raise ValueError("需要确认指标口径变化后才能继续")
        if AbnormalType.DATA_LEAKAGE in pending_types and not approve_data_leakage:
            raise ValueError("需要确认训练集泄漏情况后才能继续")
        if AbnormalType.LABEL_MISSING in pending_types and not approve_label_missing:
            raise ValueError("需要确认标签映射问题后才能继续")

        current_log = self.storage.get_latest_log(record.material_id)
        record.status = RollbackStatus.PENDING
        record = self._calculate_and_rollback(record, current_log)
        record.updated_at = datetime.now()
        self.storage.save_rollback_record(record)
        return record

    def _validate_threshold_configs(self, configs: List[ThresholdConfig]) -> None:
        for config in configs:
            if not (0 <= config.threshold <= 1):
                raise_with_params(ERROR_THRESHOLD_INVALID, threshold=config.threshold)
            if not (0 <= config.min_coverage <= 1):
                raise_with_params(ERROR_THRESHOLD_INVALID, threshold=config.min_coverage)

    def _get_previous_log(self, material_id: str, current_log: TrainingLog) -> Optional[TrainingLog]:
        all_logs = self.storage.get_all_logs(material_id)
        for log in all_logs:
            if log.log_id != current_log.log_id:
                return log
        return None

    def _calculate_and_rollback(self, record: RollbackRecord, training_log: TrainingLog) -> RollbackRecord:
        original_thresholds = {}
        new_thresholds = {}
        grayscale_result = {
            "coverage": {},
            "meets_threshold": {},
            "rollback_applied": {},
        }

        for config in record.threshold_configs:
            metric_value = training_log.metrics.get(config.metric_name)
            if metric_value is None:
                continue

            original_thresholds[config.metric_name] = config.threshold

            adjusted_threshold = self._calculate_adjusted_threshold(
                config, training_log, metric_value
            )
            new_thresholds[config.metric_name] = adjusted_threshold

            coverage = self._calculate_coverage(config, training_log)
            meets = self._check_threshold(metric_value, adjusted_threshold, config.operator)

            grayscale_result["coverage"][config.metric_name] = coverage
            grayscale_result["meets_threshold"][config.metric_name] = meets
            grayscale_result["rollback_applied"][config.metric_name] = not meets

        record.original_thresholds = original_thresholds
        record.new_thresholds = new_thresholds
        record.grayscale_result = grayscale_result

        if record.status != RollbackStatus.ABNORMAL:
            all_meets = all(grayscale_result["meets_threshold"].values())
            record.status = RollbackStatus.SUCCESS if all_meets else RollbackStatus.FAILED
            record.human_message = self._generate_success_message(record, all_meets)

        record.updated_at = datetime.now()
        return record

    def _calculate_adjusted_threshold(
        self,
        config: ThresholdConfig,
        training_log: TrainingLog,
        metric_value: float,
    ) -> float:
        baseline = training_log.metrics.get(f"{config.metric_name}_baseline", config.threshold)
        adjustment_factor = 0.95
        adjusted = config.threshold * adjustment_factor
        return max(0.0, min(1.0, adjusted))

    def _calculate_coverage(self, config: ThresholdConfig, training_log: TrainingLog) -> float:
        feature_stats = training_log.feature_stats
        total_samples = feature_stats.get("total_samples", 1000)
        valid_samples = feature_stats.get("valid_samples", int(total_samples * 0.95))
        return valid_samples / total_samples if total_samples > 0 else 0.0

    def _check_threshold(self, value: float, threshold: float, operator: str) -> bool:
        operators = {
            ">=": lambda v, t: v >= t,
            ">": lambda v, t: v > t,
            "<=": lambda v, t: v <= t,
            "<": lambda v, t: v < t,
            "==": lambda v, t: abs(v - t) < 1e-9,
        }
        func = operators.get(operator, operators[">="])
        return func(value, threshold)

    def _format_abnormal_message(self, abnormal: AbnormalInfo) -> str:
        type_names = {
            AbnormalType.METRIC_CHANGED: "🔄 指标口径变化",
            AbnormalType.DATA_LEAKAGE: "⚠️  训练集泄漏",
            AbnormalType.LABEL_MISSING: "🏷️  标签漏映射",
        }
        title = type_names.get(abnormal.abnormal_type, "异常")

        error_map = {
            AbnormalType.METRIC_CHANGED: ERROR_METRIC_CHANGED,
            AbnormalType.DATA_LEAKAGE: ERROR_DATA_LEAKAGE,
            AbnormalType.LABEL_MISSING: ERROR_LABEL_MISSING,
        }
        error = error_map.get(abnormal.abnormal_type)

        details_str = ""
        if abnormal.abnormal_type == AbnormalType.LABEL_MISSING:
            missing_count = abnormal.details.get("missing_count", 0)
            error_msg = error.message.format(missing_count=missing_count)
        else:
            error_msg = error.message

        if abnormal.details.get("changed_values"):
            changes = abnormal.details["changed_values"]
            details_str = "\n  具体变动："
            for name, vals in changes.items():
                sign = "+" if vals["diff_percent"] > 0 else ""
                details_str += f"\n    - {name}: {vals['previous']} → {vals['current']} ({sign}{vals['diff_percent']}%)"

        if abnormal.details.get("leaked_sample_count"):
            details_str = f"\n  泄漏样本数：{abnormal.details['leaked_sample_count']}"
            details_str += f"\n  泄漏比例：{abnormal.details['leakage_ratio'] * 100:.1f}%"

        if abnormal.details.get("missing_labels"):
            details_str = f"\n  缺失标签：{', '.join(abnormal.details['missing_labels'])}"

        return (
            f"{title}\n"
            f"  问题：{error_msg}\n"
            f"  描述：{abnormal.description}{details_str}\n"
            f"  建议：{error.suggestion}"
        )

    def _generate_success_message(self, record: RollbackRecord, all_meets: bool) -> str:
        if all_meets:
            messages = ["✅ 阈值灰度回滚执行成功，所有指标均满足要求。"]
        else:
            messages = ["❌ 阈值灰度回滚执行完成，部分指标未达到要求，已触发回滚。"]

        for config in record.threshold_configs:
            name = config.metric_name
            original = record.original_thresholds.get(name, 0)
            new = record.new_thresholds.get(name, 0)
            coverage = record.grayscale_result["coverage"].get(name, 0)
            meets = record.grayscale_result["meets_threshold"].get(name, False)
            rolled_back = record.grayscale_result["rollback_applied"].get(name, False)

            status = "✅ 通过" if meets else "❌ 未通过"
            rollback_str = "（已回滚）" if rolled_back else ""

            messages.append(
                f"\n  {name} {status}{rollback_str}\n"
                f"    原始阈值: {original:.4f}，调整后阈值: {new:.4f}\n"
                f"    覆盖率: {coverage * 100:.1f}%（要求 ≥ {config.min_coverage * 100:.0f}%）"
            )

        return "".join(messages)

    def get_version_change_reminder(self, material_id: str) -> Optional[str]:
        logs = self.storage.get_all_logs(material_id)
        if len(logs) < 2:
            return None

        new_log, old_log = logs[0], logs[1]
        comparison = self.version_comparator.compare(new_log, old_log)

        if not comparison["has_changes"]:
            return "当前训练日志与上一版本内容无差异。"

        return self.version_comparator.format_changes_for_display(comparison)
