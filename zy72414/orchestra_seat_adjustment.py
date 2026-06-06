import hashlib
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any

from models import (
    TunerMessage,
    SeatAdjustment,
    ChangeHistory,
    ImportBatch,
    RehearsalRecord,
    AdjustmentStatus,
    ChangeType,
)


class OrchestraSeatAdjustmentSystem:
    BOUNDARY_RULES = {
        "rework_keywords": ["返工", "rework", "需重新", "重新调音", "调整返工"],
        "review_required_statuses": [AdjustmentStatus.REWORK_REVIEW],
        "normal_allowed_statuses": [AdjustmentStatus.PENDING, AdjustmentStatus.NORMAL],
    }

    def __init__(self):
        self.tuner_messages: Dict[str, TunerMessage] = {}
        self.adjustments: Dict[str, SeatAdjustment] = {}
        self.change_histories: Dict[str, List[ChangeHistory]] = {}
        self.import_batches: Dict[str, ImportBatch] = {}
        self.rehearsal_records: Dict[str, RehearsalRecord] = {}
        self.content_hash_index: Dict[str, str] = {}

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _compute_content_hash(self, rows: List[Dict]) -> str:
        content = json.dumps(rows, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def _record_change(
        self,
        adjustment_id: str,
        change_type: ChangeType,
        field_name: Optional[str],
        old_value: Optional[Any],
        new_value: Optional[Any],
        changed_by: str,
        reason: Optional[str] = None,
    ) -> ChangeHistory:
        change = ChangeHistory(
            id=self._generate_id(),
            adjustment_id=adjustment_id,
            change_type=change_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=datetime.now(),
            reason=reason,
        )
        if adjustment_id not in self.change_histories:
            self.change_histories[adjustment_id] = []
        self.change_histories[adjustment_id].append(change)
        return change

    def _detect_rework(self, track_remark: str) -> Tuple[bool, Optional[str]]:
        for keyword in self.BOUNDARY_RULES["rework_keywords"]:
            if keyword in track_remark or keyword.lower() in track_remark.lower():
                return True, track_remark
        return False, None

    def _determine_initial_status(self, tuner_message: TunerMessage) -> AdjustmentStatus:
        if tuner_message.is_rework:
            return AdjustmentStatus.REWORK_REVIEW
        return AdjustmentStatus.PENDING

    def import_tuner_messages(
        self,
        rows: List[Dict],
        source_file: str,
        imported_by: str = "老周",
    ) -> Tuple[ImportBatch, List[SeatAdjustment]]:
        content_hash = self._compute_content_hash(rows)

        if content_hash in self.content_hash_index:
            existing_batch_id = self.content_hash_index[content_hash]
            batch = ImportBatch(
                id=self._generate_id(),
                source_file=source_file,
                imported_at=datetime.now(),
                imported_by=imported_by,
                record_count=len(rows),
                content_hash=content_hash,
                is_duplicate=True,
                duplicate_of_batch=existing_batch_id,
            )
            self.import_batches[batch.id] = batch
            adjustments = self._get_adjustments_by_batch(existing_batch_id)
            return batch, adjustments

        batch_id = self._generate_id()
        batch = ImportBatch(
            id=batch_id,
            source_file=source_file,
            imported_at=datetime.now(),
            imported_by=imported_by,
            record_count=len(rows),
            content_hash=content_hash,
        )
        self.import_batches[batch_id] = batch
        self.content_hash_index[content_hash] = batch_id

        adjustments = []
        for idx, row in enumerate(rows):
            msg_id = self._generate_id()
            track_remark = row.get("track_remark", "")
            is_rework, rework_reason = self._detect_rework(track_remark)

            message = TunerMessage(
                id=msg_id,
                original_row_number=row.get("row_number", idx + 1),
                raw_content=str(row),
                seat_number=row.get("seat_number", ""),
                instrument=row.get("instrument", ""),
                track_remark=track_remark,
                import_batch_id=batch_id,
                imported_at=datetime.now(),
                source_file=source_file,
                is_rework=is_rework,
                rework_reason=rework_reason,
            )
            self.tuner_messages[msg_id] = message

            adj_id = self._generate_id()
            initial_status = self._determine_initial_status(message)
            adjustment = SeatAdjustment(
                id=adj_id,
                tuner_message_id=msg_id,
                seat_number=message.seat_number,
                instrument=message.instrument,
                status=initial_status,
                current_remark=message.track_remark,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                created_by=imported_by,
                updated_by=imported_by,
            )
            self.adjustments[adj_id] = adjustment

            self._record_change(
                adj_id,
                ChangeType.IMPORT,
                None,
                None,
                {
                    "seat_number": adjustment.seat_number,
                    "instrument": adjustment.instrument,
                    "status": initial_status.value,
                    "remark": adjustment.current_remark,
                },
                imported_by,
                reason=f"从 {source_file} 导入调音师留言，行号 {message.original_row_number}",
            )
            adjustments.append(adjustment)

        return batch, adjustments

    def _get_adjustments_by_batch(self, batch_id: str) -> List[SeatAdjustment]:
        result = []
        for msg in self.tuner_messages.values():
            if msg.import_batch_id == batch_id:
                for adj in self.adjustments.values():
                    if adj.tuner_message_id == msg.id:
                        result.append(adj)
        return result

    def manager_edit_remark(
        self,
        adjustment_id: str,
        new_remark: str,
        editor: str = "老周",
        edit_reason: Optional[str] = None,
    ) -> SeatAdjustment:
        if adjustment_id not in self.adjustments:
            raise ValueError(f"调整记录 {adjustment_id} 不存在")

        adjustment = self.adjustments[adjustment_id]
        old_remark = adjustment.current_remark
        old_status = adjustment.status

        is_rework, rework_reason = self._detect_rework(new_remark)

        if is_rework and adjustment.status not in self.BOUNDARY_RULES["review_required_statuses"]:
            new_status = AdjustmentStatus.REWORK_REVIEW
        elif not is_rework and adjustment.status == AdjustmentStatus.REWORK_REVIEW:
            new_status = AdjustmentStatus.REWORK_REVIEW
        else:
            new_status = adjustment.status

        adjustment.current_remark = new_remark
        adjustment.status = new_status
        adjustment.updated_at = datetime.now()
        adjustment.updated_by = editor

        self._record_change(
            adjustment_id,
            ChangeType.MANUAL_EDIT,
            "current_remark",
            old_remark,
            new_remark,
            editor,
            reason=edit_reason or "琴行店长修改备注",
        )

        if old_status != new_status:
            self._record_change(
                adjustment_id,
                ChangeType.STATUS_CHANGE,
                "status",
                old_status.value,
                new_status.value,
                editor,
                reason=f"备注修改后检测到返工原因，状态变更为 {new_status.value}",
            )

        return adjustment

    def update_rehearsal_signup(
        self,
        adjustment_id: str,
        signup_data: Dict[str, Any],
        operator: str = "老周",
    ) -> SeatAdjustment:
        if adjustment_id not in self.adjustments:
            raise ValueError(f"调整记录 {adjustment_id} 不存在")

        adjustment = self.adjustments[adjustment_id]
        old_signup = adjustment.rehearsal_group_signup

        adjustment.rehearsal_group_signup = signup_data
        adjustment.updated_at = datetime.now()
        adjustment.updated_by = operator

        self._record_change(
            adjustment_id,
            ChangeType.REHEARSAL_UPDATE,
            "rehearsal_group_signup",
            old_signup,
            signup_data,
            operator,
            reason="补看排练群接龙信息",
        )

        return adjustment

    def update_rehearsal_change(
        self,
        adjustment_id: str,
        change_record: Dict[str, Any],
        operator: str = "老周",
    ) -> SeatAdjustment:
        if adjustment_id not in self.adjustments:
            raise ValueError(f"调整记录 {adjustment_id} 不存在")

        adjustment = self.adjustments[adjustment_id]
        old_change = adjustment.rehearsal_change_record

        adjustment.rehearsal_change_record = change_record
        adjustment.updated_at = datetime.now()
        adjustment.updated_by = operator

        self._record_change(
            adjustment_id,
            ChangeType.REHEARSAL_UPDATE,
            "rehearsal_change_record",
            old_change,
            change_record,
            operator,
            reason="更新排练变更记录",
        )

        return adjustment

    def copyright_review_rework(
        self,
        adjustment_id: str,
        approve: bool,
        reviewer: str = "版权运营",
        review_comment: Optional[str] = None,
    ) -> SeatAdjustment:
        if adjustment_id not in self.adjustments:
            raise ValueError(f"调整记录 {adjustment_id} 不存在")

        adjustment = self.adjustments[adjustment_id]
        old_status = adjustment.status

        if old_status != AdjustmentStatus.REWORK_REVIEW:
            raise ValueError(f"当前状态 {old_status.value} 不需要版权运营复核")

        if approve:
            new_status = AdjustmentStatus.CONFIRMED
            reason = "版权运营复核通过，确认调整"
        else:
            new_status = AdjustmentStatus.NORMAL
            reason = "版权运营复核不通过，回归正常状态"

        adjustment.status = new_status
        adjustment.updated_at = datetime.now()
        adjustment.updated_by = reviewer

        self._record_change(
            adjustment_id,
            ChangeType.STATUS_CHANGE,
            "status",
            old_status.value,
            new_status.value,
            reviewer,
            reason=review_comment or reason,
        )

        return adjustment

    def rollback_adjustment(
        self,
        adjustment_id: str,
        operator: str = "老周",
        rollback_reason: Optional[str] = None,
    ) -> SeatAdjustment:
        if adjustment_id not in self.adjustments:
            raise ValueError(f"调整记录 {adjustment_id} 不存在")

        adjustment = self.adjustments[adjustment_id]
        old_status = adjustment.status
        old_remark = adjustment.current_remark

        histories = self.change_histories.get(adjustment_id, [])
        import_history = None
        for h in histories:
            if h.change_type == ChangeType.IMPORT:
                import_history = h
                break

        if import_history and isinstance(import_history.new_value, dict):
            adjustment.current_remark = import_history.new_value.get("remark", old_remark)
            adjustment.seat_number = import_history.new_value.get("seat_number", adjustment.seat_number)
            adjustment.instrument = import_history.new_value.get("instrument", adjustment.instrument)

        adjustment.status = AdjustmentStatus.ROLLED_BACK
        adjustment.updated_at = datetime.now()
        adjustment.updated_by = operator

        self._record_change(
            adjustment_id,
            ChangeType.ROLLBACK,
            None,
            {"status": old_status.value, "remark": old_remark},
            {"status": AdjustmentStatus.ROLLED_BACK.value, "remark": adjustment.current_remark},
            operator,
            reason=rollback_reason or "回滚调整到导入时的初始状态",
        )

        return adjustment

    def get_change_history(self, adjustment_id: str) -> List[ChangeHistory]:
        return self.change_histories.get(adjustment_id, [])

    def get_adjustment_with_evidence(self, adjustment_id: str) -> Dict[str, Any]:
        if adjustment_id not in self.adjustments:
            raise ValueError(f"调整记录 {adjustment_id} 不存在")

        adjustment = self.adjustments[adjustment_id]
        tuner_message = self.tuner_messages.get(adjustment.tuner_message_id)
        histories = self.get_change_history(adjustment_id)

        return {
            "adjustment": adjustment,
            "tuner_message": tuner_message,
            "change_history": histories,
            "evidence_summary": {
                "original_row_number": tuner_message.original_row_number if tuner_message else None,
                "original_source_file": tuner_message.source_file if tuner_message else None,
                "manual_edit_count": sum(
                    1 for h in histories if h.change_type == ChangeType.MANUAL_EDIT
                ),
                "status_changes": [
                    (h.old_value, h.new_value, h.changed_at, h.changed_by)
                    for h in histories
                    if h.change_type == ChangeType.STATUS_CHANGE
                ],
            },
        }

    def get_statistics(self) -> Dict[str, Any]:
        status_counts = {}
        for adj in self.adjustments.values():
            status = adj.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "total_adjustments": len(self.adjustments),
            "total_tuner_messages": len(self.tuner_messages),
            "total_import_batches": len(self.import_batches),
            "duplicate_batches": sum(1 for b in self.import_batches.values() if b.is_duplicate),
            "status_distribution": status_counts,
            "rework_awaiting_review": sum(
                1 for adj in self.adjustments.values()
                if adj.status == AdjustmentStatus.REWORK_REVIEW
            ),
        }
