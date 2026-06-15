import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from models import (
    AuditRecord, AuditStatus, AuditHistory,
    FeatureSnapshot, FeatureVersion, CorrectionRecord,
    RecordSource
)


class SparseFeatureAuditEngine:
    def __init__(self):
        self.records: Dict[str, AuditRecord] = {}
        self.feature_snapshots: Dict[str, FeatureSnapshot] = {}
        self.feature_versions: List[FeatureVersion] = []
        self._batch_index: Dict[str, List[str]] = {}
        self._version_counter = 0

    def load_snapshots(self, snapshots: Dict[str, FeatureSnapshot]):
        self.feature_snapshots.update(snapshots)

    def load_initial_versions(self, versions: List[FeatureVersion]):
        self.feature_versions.extend(versions)
        self._version_counter = len(versions)

    def load_records(self, records: Dict[str, AuditRecord]):
        for slice_id, record in records.items():
            self.records[slice_id] = record
            batch_id = record.eval_slice.data_batch_id
            if batch_id not in self._batch_index:
                self._batch_index[batch_id] = []
            self._batch_index[batch_id].append(slice_id)

    def _generate_history_id(self) -> str:
        return f"HIST-{uuid.uuid4().hex[:8]}"

    def _generate_version_id(self) -> str:
        self._version_counter += 1
        return f"VER-{self._version_counter:03d}"

    def _generate_correction_id(self) -> str:
        return f"CORR-{uuid.uuid4().hex[:8]}"

    def _add_history(self, record: AuditRecord, operation: str, operator: str,
                     before_status: Optional[AuditStatus] = None,
                     after_status: Optional[AuditStatus] = None,
                     detail: Optional[Dict] = None,
                     remark: str = ""):
        history = AuditHistory(
            history_id=self._generate_history_id(),
            slice_id=record.slice_id,
            operation=operation,
            operator=operator,
            operate_time=datetime.now(),
            before_status=before_status,
            after_status=after_status,
            detail=detail or {},
            remark=remark
        )
        record.history.append(history)
        if after_status:
            record.current_status = after_status

    def _detect_duplicate_training(self, record: AuditRecord) -> Optional[str]:
        batch_id = record.eval_slice.data_batch_id
        existing_slices = self._batch_index.get(batch_id, [])
        for existing_slice_id in existing_slices:
            if existing_slice_id == record.slice_id:
                continue
            existing_record = self.records.get(existing_slice_id)
            if existing_record and existing_record.eval_slice.feature_snapshot_id == record.eval_slice.feature_snapshot_id:
                return existing_slice_id
        return None

    def check_snapshot_by_xiaoqiao(self, slice_id: str, snapshot_id: str) -> Tuple[bool, str]:
        """
        步骤二：算法工程师小乔补看特征快照编号
        """
        record = self.records.get(slice_id)
        if not record:
            return False, f"评测切片 {slice_id} 不存在"

        snapshot = self.feature_snapshots.get(snapshot_id)
        if not snapshot:
            return False, f"特征快照 {snapshot_id} 不存在"

        before_status = record.current_status

        record.eval_slice.feature_snapshot_id = snapshot_id
        record.eval_slice.caliber_version = snapshot.caliber_version
        if snapshot not in record.feature_snapshots:
            record.feature_snapshots.append(snapshot)

        duplicate_with = self._detect_duplicate_training(record)

        if duplicate_with:
            record.is_duplicate_training = True
            record.duplicate_with_slice = duplicate_with
            self._add_history(
                record,
                operation="核验特征快照",
                operator="xiaoqiao",
                before_status=before_status,
                after_status=AuditStatus.PRODUCT_REVIEW,
                detail={
                    "snapshot_id": snapshot_id,
                    "feature_name": snapshot.feature_name,
                    "caliber_version": snapshot.caliber_version,
                    "duplicate_detected": True,
                    "duplicate_with": duplicate_with
                },
                remark="检测到同一批数据重复训练，转策略产品复核"
            )
            return True, f"已核验快照 {snapshot_id}，检测到与 {duplicate_with} 重复训练，转策略产品复核"
        else:
            self._add_history(
                record,
                operation="核验特征快照",
                operator="xiaoqiao",
                before_status=before_status,
                after_status=AuditStatus.SNAPSHOT_CHECKED,
                detail={
                    "snapshot_id": snapshot_id,
                    "feature_name": snapshot.feature_name,
                    "caliber_version": snapshot.caliber_version
                },
                remark="特征快照核验完成"
            )
            return True, f"已核验快照 {snapshot_id}，特征快照核验完成"

    def supplement_snapshot_for_old_data(self, slice_id: str, snapshot_id: str) -> Tuple[bool, str]:
        """
        为补录的旧口径数据补充快照
        """
        record = self.records.get(slice_id)
        if not record:
            return False, f"评测切片 {slice_id} 不存在"

        snapshot = self.feature_snapshots.get(snapshot_id)
        if not snapshot:
            return False, f"特征快照 {snapshot_id} 不存在"

        before_status = record.current_status

        record.eval_slice.feature_snapshot_id = snapshot_id
        record.eval_slice.caliber_version = snapshot.caliber_version
        record.supplement_from_snapshot = snapshot_id
        if snapshot not in record.feature_snapshots:
            record.feature_snapshots.append(snapshot)

        self._add_history(
            record,
            operation="补录特征快照",
            operator="xiaoqiao",
            before_status=before_status,
            after_status=AuditStatus.SUPPLEMENTED,
            detail={
                "snapshot_id": snapshot_id,
                "feature_name": snapshot.feature_name,
                "caliber_version": snapshot.caliber_version,
                "is_old_caliber": not snapshot.is_current
            },
            remark=f"从快照 {snapshot_id} 补录旧口径数据" if not snapshot.is_current else "补录特征快照"
        )
        return True, f"已补录快照 {snapshot_id}"

    def update_feature_version_table(self, slice_id: str) -> Tuple[bool, str]:
        """
        步骤三：特征版本表更新
        """
        record = self.records.get(slice_id)
        if not record:
            return False, f"评测切片 {slice_id} 不存在"

        if record.current_status not in [AuditStatus.SNAPSHOT_CHECKED, AuditStatus.SUPPLEMENTED, AuditStatus.CORRECTED, AuditStatus.NORMAL, AuditStatus.PRODUCT_REVIEW]:
            return False, f"当前状态 {record.current_status.value} 不允许更新版本表"

        if not record.eval_slice.feature_snapshot_id:
            return False, "未关联特征快照，无法更新版本表"

        snapshot = self.feature_snapshots.get(record.eval_slice.feature_snapshot_id)
        if not snapshot:
            return False, f"特征快照 {record.eval_slice.feature_snapshot_id} 不存在"

        before_status = record.current_status

        existing_version = None
        for v in self.feature_versions:
            if v.source_snapshot_id == snapshot.snapshot_id and v.is_active:
                existing_version = v
                break

        if record.is_duplicate_training and not record.duplicate_reviewed:
            self._add_history(
                record,
                operation="拦截版本表更新",
                operator="system",
                before_status=before_status,
                after_status=AuditStatus.PRODUCT_REVIEW,
                detail={
                    "snapshot_id": snapshot.snapshot_id,
                    "reason": "重复训练待策略产品复核",
                    "duplicate_with": record.duplicate_with_slice
                },
                remark="重复训练数据暂不更新版本表，待产品确认后再更新"
            )
            return True, "重复训练数据暂不更新版本表，已转策略产品复核"

        if not existing_version or existing_version.caliber_version != snapshot.caliber_version:
            if existing_version:
                existing_version.is_active = False

            new_version = FeatureVersion(
                version_id=self._generate_version_id(),
                feature_name=snapshot.feature_name,
                caliber_version=snapshot.caliber_version,
                default_value=snapshot.default_value,
                effective_time=datetime.now(),
                is_active=True,
                source_slice_id=slice_id,
                source_snapshot_id=snapshot.snapshot_id,
                remark=f"来源：{record.source.value} | 评测切片：{slice_id}"
            )
            self.feature_versions.append(new_version)
            record.feature_versions.append(new_version)

            version_action = "新增" if not existing_version else "版本更替"
        else:
            record.feature_versions.append(existing_version)
            version_action = "沿用现有版本"

        final_status = AuditStatus.NORMAL if record.source == RecordSource.NORMAL_IMPORT else AuditStatus.SUPPLEMENTED

        self._add_history(
            record,
            operation="更新特征版本表",
            operator="system",
            before_status=before_status,
            after_status=final_status,
            detail={
                "snapshot_id": snapshot.snapshot_id,
                "caliber_version": snapshot.caliber_version,
                "version_action": version_action,
                "feature_name": snapshot.feature_name
            },
            remark=f"版本表更新完成：{version_action}"
        )
        return True, f"特征版本表更新完成：{version_action}"

    def manual_correction(self, slice_id: str, original_snapshot_id: str,
                          corrected_snapshot_id: str, reason: str,
                          operator: str = "xiaoqiao") -> Tuple[bool, str]:
        """
        人工修正：一次人工修正
        """
        record = self.records.get(slice_id)
        if not record:
            return False, f"评测切片 {slice_id} 不存在"

        corrected_snapshot = self.feature_snapshots.get(corrected_snapshot_id)
        if not corrected_snapshot:
            return False, f"修正后的特征快照 {corrected_snapshot_id} 不存在"

        before_status = record.current_status

        correction = CorrectionRecord(
            correction_id=self._generate_correction_id(),
            slice_id=slice_id,
            operator=operator,
            correct_time=datetime.now(),
            original_snapshot_id=original_snapshot_id,
            corrected_snapshot_id=corrected_snapshot_id,
            reason=reason,
            detail={
                "original_caliber": self.feature_snapshots.get(original_snapshot_id, {}).caliber_version if isinstance(self.feature_snapshots.get(original_snapshot_id), FeatureSnapshot) else "unknown",
                "corrected_caliber": corrected_snapshot.caliber_version
            }
        )
        record.corrections.append(correction)

        record.eval_slice.feature_snapshot_id = corrected_snapshot_id
        record.eval_slice.caliber_version = corrected_snapshot.caliber_version
        if corrected_snapshot not in record.feature_snapshots:
            record.feature_snapshots.append(corrected_snapshot)

        self._add_history(
            record,
            operation="人工修正",
            operator=operator,
            before_status=before_status,
            after_status=AuditStatus.CORRECTED,
            detail={
                "correction_id": correction.correction_id,
                "original_snapshot_id": original_snapshot_id,
                "corrected_snapshot_id": corrected_snapshot_id,
                "reason": reason
            },
            remark=f"人工修正：{reason}"
        )
        return True, f"人工修正完成，已切换至快照 {corrected_snapshot_id}"

    def rerun_slice(self, slice_id: str, operator: str = "xiaoqiao") -> Tuple[bool, str]:
        """
        重跑：一次重跑
        """
        record = self.records.get(slice_id)
        if not record:
            return False, f"评测切片 {slice_id} 不存在"

        before_status = record.current_status

        self._add_history(
            record,
            operation="重跑评测",
            operator=operator,
            before_status=before_status,
            after_status=AuditStatus.RERUN,
            detail={"rerun_count": len([h for h in record.history if h.operation == "重跑评测"]) + 1},
            remark="触发重跑流程"
        )
        return True, "重跑流程已触发"

    def product_review_duplicate(self, slice_id: str, approve: bool,
                                  operator: str = "product") -> Tuple[bool, str]:
        """
        策略产品复核重复训练数据
        """
        record = self.records.get(slice_id)
        if not record:
            return False, f"评测切片 {slice_id} 不存在"

        if record.current_status != AuditStatus.PRODUCT_REVIEW:
            return False, f"当前状态 {record.current_status.value} 不是待复核状态"

        before_status = record.current_status

        if approve:
            record.duplicate_reviewed = True
            record.duplicate_approved = True
            self._add_history(
                record,
                operation="策略产品复核通过",
                operator=operator,
                before_status=before_status,
                after_status=AuditStatus.NORMAL,
                detail={
                    "duplicate_approved": True,
                    "duplicate_with": record.duplicate_with_slice,
                    "duplicate_reviewed": True
                },
                remark="重复训练经产品确认有效，归入正常，可继续更新版本表"
            )
            return True, "策略产品复核通过，重复训练数据归入正常，可继续更新版本表"
        else:
            record.duplicate_reviewed = True
            record.duplicate_approved = False
            self._add_history(
                record,
                operation="策略产品复核驳回",
                operator=operator,
                before_status=before_status,
                after_status=AuditStatus.WRONG_CALIBER,
                detail={
                    "duplicate_rejected": True,
                    "duplicate_with": record.duplicate_with_slice,
                    "duplicate_reviewed": True
                },
                remark="重复训练数据被驳回，标记为口径错误"
            )
            return True, "策略产品复核驳回，标记为口径错误"

    def complete_record(self, slice_id: str) -> Tuple[bool, str]:
        record = self.records.get(slice_id)
        if not record:
            return False, f"评测切片 {slice_id} 不存在"

        before_status = record.current_status
        if before_status not in [AuditStatus.NORMAL, AuditStatus.SUPPLEMENTED, AuditStatus.RERUN]:
            return False, f"当前状态 {before_status.value} 不能标记为完成"

        self._add_history(
            record,
            operation="标记完成",
            operator="system",
            before_status=before_status,
            after_status=AuditStatus.COMPLETED,
            remark="审计流程完成"
        )
        return True, "审计流程已完成"
