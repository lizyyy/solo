from datetime import datetime
from typing import List, Dict, Optional
from models import (
    FeatureRecord,
    FeatureVersionTable,
    HistoryLog,
    RecordStatus,
    RecordSource,
    OnlineExperimentBucket,
    NegativeSampleList,
    ParameterVersion,
    DistillationResult,
)


class AnomalyRuleDistillationEngine:
    def __init__(self):
        self.feature_version_table = FeatureVersionTable(version="v1.0")
        self.history_logs: List[HistoryLog] = []
        self.pending_reviews: List[FeatureRecord] = []
        self.conflicts: List[FeatureRecord] = []
        self.training_batch_map: Dict[str, List[str]] = {}

    def _log_history(
        self,
        action: str,
        feature_id: str,
        before_status: Optional[RecordStatus],
        after_status: RecordStatus,
        operator: str,
        details: str,
        parameter_versions: List[ParameterVersion] = None,
    ):
        log = HistoryLog(
            timestamp=datetime.now(),
            action=action,
            feature_id=feature_id,
            before_status=before_status,
            after_status=after_status,
            operator=operator,
            details=details,
            parameter_versions=parameter_versions or [],
        )
        self.history_logs.append(log)

    def _detect_caliber_conflict(
        self,
        feature_id: str,
        bucket: OnlineExperimentBucket,
        neg_list: NegativeSampleList,
    ) -> List[str]:
        evidence = []
        bucket_caliber = bucket.caliber_notes.get(feature_id, "")
        neg_caliber = neg_list.caliber_notes.get(feature_id, "")

        if bucket_caliber and neg_caliber and bucket_caliber != neg_caliber:
            evidence.append(
                f"线上实验桶口径: {bucket_caliber}"
            )
            evidence.append(
                f"负样本列表口径: {neg_caliber}"
            )
            evidence.append(
                f"差异点: 实验桶使用【{bucket_caliber.split('-')[0]}】，负样本使用【{neg_caliber.split('-')[0]}】"
            )
        return evidence

    def _detect_duplicate_training(
        self, feature_id: str, training_batch_id: str
    ) -> Optional[str]:
        batch_features = self.training_batch_map.get(training_batch_id, [])
        if feature_id in batch_features:
            return f"feature_id={feature_id} 在训练批次 {training_batch_id} 中已存在"
        return None

    def step1_import_online_experiment_bucket(
        self,
        bucket: OnlineExperimentBucket,
        feature_params: Dict[str, List[ParameterVersion]] = None,
    ) -> List[FeatureRecord]:
        imported_records = []
        feature_params = feature_params or {}
        import_count = len(self.training_batch_map.get(bucket.bucket_id, [])) // len(bucket.feature_ids) if bucket.feature_ids else 0

        for idx, feature_id in enumerate(bucket.feature_ids):
            existing_record = self.feature_version_table.get_record(feature_id)
            before_status = existing_record.status if existing_record else None

            duplicate_msg = self._detect_duplicate_training(
                feature_id, bucket.bucket_id
            )

            is_duplicate = duplicate_msg is not None

            if is_duplicate:
                dup_feature_id = f"{feature_id}-dup-{import_count + 1}"
                record = FeatureRecord(
                    feature_id=dup_feature_id,
                    feature_name=f"特征-{feature_id}(第{import_count + 1}次导入)",
                    feature_version=bucket.version,
                    caliber=bucket.caliber_notes.get(feature_id, ""),
                    source=RecordSource.ONLINE_EXPERIMENT_BUCKET,
                    import_timestamp=datetime.now(),
                    status=RecordStatus.PENDING_PRODUCT_REVIEW,
                    training_batch_id=bucket.bucket_id,
                    duplicate_of=feature_id,
                    parameter_versions=feature_params.get(feature_id, []),
                )
                record.review_notes.append(
                    f"同一批数据重复训练两次: {duplicate_msg}。请策略产品复核，不归为正常。"
                )
                self.pending_reviews.append(record)
                self.feature_version_table.add_record(record)
                imported_records.append(record)

                self._log_history(
                    action="线上实验桶导入-检测到重复",
                    feature_id=dup_feature_id,
                    before_status=None,
                    after_status=RecordStatus.PENDING_PRODUCT_REVIEW,
                    operator="system",
                    details=f"从实验桶 {bucket.bucket_id} 重复导入，原始特征={feature_id}，已标记待策略产品复核",
                    parameter_versions=record.parameter_versions,
                )
            else:
                record = FeatureRecord(
                    feature_id=feature_id,
                    feature_name=f"特征-{feature_id}",
                    feature_version=bucket.version,
                    caliber=bucket.caliber_notes.get(feature_id, ""),
                    source=RecordSource.ONLINE_EXPERIMENT_BUCKET,
                    import_timestamp=datetime.now(),
                    status=RecordStatus.NORMAL,
                    training_batch_id=bucket.bucket_id,
                    parameter_versions=feature_params.get(feature_id, []),
                )
                self.feature_version_table.add_record(record)
                imported_records.append(record)

                self._log_history(
                    action="线上实验桶导入",
                    feature_id=feature_id,
                    before_status=before_status,
                    after_status=RecordStatus.NORMAL,
                    operator="system",
                    details=f"从实验桶 {bucket.bucket_id} 导入，版本={bucket.version}",
                    parameter_versions=record.parameter_versions,
                )

            if bucket.bucket_id not in self.training_batch_map:
                self.training_batch_map[bucket.bucket_id] = []
            self.training_batch_map[bucket.bucket_id].append(feature_id)

        return imported_records

    def step2_scientist_review_negative_samples(
        self,
        neg_list: NegativeSampleList,
        scientist_name: str = "林姐",
    ) -> Dict[str, FeatureRecord]:
        reviewed_records = {}

        for feature_id in neg_list.feature_ids:
            record = self.feature_version_table.get_record(feature_id)
            if not record:
                continue

            before_status = record.status
            conflict_evidence = self._detect_caliber_conflict(
                feature_id,
                OnlineExperimentBucket(
                    bucket_id="temp",
                    version=record.feature_version,
                    feature_ids=[feature_id],
                    caliber_notes={feature_id: record.caliber},
                ),
                neg_list,
            )

            if conflict_evidence:
                record.status = RecordStatus.CONFLICT_DETECTED
                record.conflict_evidence = conflict_evidence
                record.review_notes.append(
                    f"[{scientist_name}] 发现线上实验桶与负样本列表口径矛盾，请确认或驳回"
                )
                self.conflicts.append(record)

                self._log_history(
                    action="负样本列表核对-发现冲突",
                    feature_id=feature_id,
                    before_status=before_status,
                    after_status=RecordStatus.CONFLICT_DETECTED,
                    operator=scientist_name,
                    details="口径冲突检测：线上实验桶与负样本列表不一致，已列出冲突证据待确认",
                    parameter_versions=record.parameter_versions,
                )
            else:
                record.review_notes.append(
                    f"[{scientist_name}] 负样本列表核对通过，口径一致"
                )

                self._log_history(
                    action="负样本列表核对-通过",
                    feature_id=feature_id,
                    before_status=before_status,
                    after_status=record.status,
                    operator=scientist_name,
                    details="负样本列表口径核对一致",
                    parameter_versions=record.parameter_versions,
                )

            reviewed_records[feature_id] = record

        return reviewed_records

    def step3_update_feature_version_table(
        self,
        supplementary_features: List[Dict] = None,
    ) -> FeatureVersionTable:
        supplementary_features = supplementary_features or []

        for feat_info in supplementary_features:
            feature_id = feat_info["feature_id"]
            existing_record = self.feature_version_table.get_record(feature_id)
            before_status = existing_record.status if existing_record else None

            record = FeatureRecord(
                feature_id=feature_id,
                feature_name=feat_info.get("feature_name", f"特征-{feature_id}"),
                feature_version=feat_info.get("feature_version", "v1.0"),
                caliber=feat_info.get("caliber", ""),
                source=RecordSource.SUPPLEMENTARY,
                import_timestamp=datetime.now(),
                status=RecordStatus.SUPPLEMENTARY_OLD_CALIBER,
                training_batch_id=feat_info.get("training_batch_id", "supplementary"),
                supplementary_from=feat_info.get("supplementary_from", "负样本列表历史补录"),
                parameter_versions=feat_info.get("parameter_versions", []),
            )

            record.review_notes.append("从负样本列表补录的旧口径记录")

            self.feature_version_table.add_record(record)

            self._log_history(
                action="补录旧口径特征",
                feature_id=feature_id,
                before_status=before_status,
                after_status=RecordStatus.SUPPLEMENTARY_OLD_CALIBER,
                operator="林姐",
                details=f"补录来源: {record.supplementary_from}",
                parameter_versions=record.parameter_versions,
            )

        return self.feature_version_table

    def scientist_resolve_conflict(
        self,
        feature_id: str,
        action: str,
        scientist_name: str = "林姐",
        notes: str = "",
    ) -> Optional[FeatureRecord]:
        record = self.feature_version_table.get_record(feature_id)
        if not record or record.status != RecordStatus.CONFLICT_DETECTED:
            return None

        before_status = record.status

        if action == "confirm":
            record.status = RecordStatus.CONFIRMED_BY_SCIENTIST
            record.review_notes.append(f"[{scientist_name}] 确认采用线上实验桶口径。备注: {notes}")
            log_action = "冲突处理-确认"
            details = f"数据科学家确认口径，采纳线上实验桶定义。备注: {notes}"
        elif action == "reject":
            record.status = RecordStatus.REJECTED_BY_SCIENTIST
            record.review_notes.append(f"[{scientist_name}] 驳回到负样本列表口径。备注: {notes}")
            log_action = "冲突处理-驳回"
            details = f"数据科学家驳回，采用负样本列表口径。备注: {notes}"
        else:
            return None

        if record in self.conflicts:
            self.conflicts.remove(record)

        self._log_history(
            action=log_action,
            feature_id=feature_id,
            before_status=before_status,
            after_status=record.status,
            operator=scientist_name,
            details=details,
            parameter_versions=record.parameter_versions,
        )

        return record

    def product_review_duplicate(
        self,
        feature_id: str,
        is_approved: bool,
        product_name: str = "策略产品",
        notes: str = "",
    ) -> Optional[FeatureRecord]:
        record = self.feature_version_table.get_record(feature_id)
        if not record or record.status != RecordStatus.PENDING_PRODUCT_REVIEW:
            return None

        before_status = record.status

        if is_approved:
            record.status = RecordStatus.NORMAL
            record.review_notes.append(f"[{product_name}] 复核通过，重复训练记录归为正常。备注: {notes}")
            log_action = "重复训练复核-通过"
        else:
            record.status = RecordStatus.DUPLICATE_TRAINING
            record.review_notes.append(f"[{product_name}] 复核不通过，标记为重复训练。备注: {notes}")
            log_action = "重复训练复核-不通过"

        if record in self.pending_reviews:
            self.pending_reviews.remove(record)

        self._log_history(
            action=log_action,
            feature_id=feature_id,
            before_status=before_status,
            after_status=record.status,
            operator=product_name,
            details=notes,
            parameter_versions=record.parameter_versions,
        )

        return record

    def get_result(self) -> DistillationResult:
        return DistillationResult(
            feature_version_table=self.feature_version_table,
            history_logs=self.history_logs,
            pending_reviews=self.pending_reviews,
            conflicts=self.conflicts,
        )
