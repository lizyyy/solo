from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    PetRecord,
    EvidenceMaterial,
    ProcessingHistory,
    ProcessingStatus,
)


class HistoryManager:
    def __init__(self):
        self._revision_index: Dict[str, List[ProcessingHistory]] = {}

    def add_incremental_evidence(
        self,
        record: PetRecord,
        new_evidence: EvidenceMaterial,
        operator: str,
        reason: str,
        notes: str = "",
        allow_override: bool = False,
    ) -> ProcessingHistory:
        old_status = record.current_status
        old_evidence_ids = [e.evidence_id for e in record.evidence_materials]
        old_notes = record.operator_notes
        old_snapshot = {
            "initial_weight": record.initial_weight,
            "current_weight": record.current_weight,
            "target_weight": record.target_weight,
            "status": old_status.value,
            "evidence_count": len(old_evidence_ids),
            "notes": old_notes,
        }

        if not allow_override:
            existing = [
                e
                for e in record.evidence_materials
                if e.evidence_id == new_evidence.evidence_id
                or (e.hash_value and e.hash_value == new_evidence.hash_value)
            ]
            if existing:
                raise ValueError(
                    f"证据 {new_evidence.evidence_id} 已存在，禁止无提示覆盖。"
                    f"如需覆盖请显式指定 allow_override=True，"
                    f"并确保已与人工确认改判原因。"
                )

        record.evidence_materials.append(new_evidence)
        record.operator_notes = notes

        new_status = self._reevaluate_status(record)
        status_changed = new_status != old_status
        if status_changed:
            record.is_manually_modified = True
            record.current_status = new_status

        history_entry = ProcessingHistory(
            history_id=f"HIST_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{record.record_id}",
            timestamp=datetime.now(),
            previous_status=old_status,
            new_status=record.current_status,
            operator=operator,
            reason=reason,
            previous_evidence_ids=old_evidence_ids,
            new_evidence_ids=[e.evidence_id for e in record.evidence_materials],
            previous_notes=old_notes,
            new_notes=notes,
            revision_snapshot={
                "before": old_snapshot,
                "after": {
                    "initial_weight": record.initial_weight,
                    "current_weight": record.current_weight,
                    "target_weight": record.target_weight,
                    "status": record.current_status.value,
                    "evidence_count": len(record.evidence_materials),
                    "notes": notes,
                    "status_changed": status_changed,
                    "conclusion_changed": status_changed,
                },
            },
        )

        record.processing_history.append(history_entry)

        if record.record_id not in self._revision_index:
            self._revision_index[record.record_id] = []
        self._revision_index[record.record_id].append(history_entry)

        return history_entry

    def revise_weight(
        self,
        record: PetRecord,
        new_current_weight: float,
        operator: str,
        reason: str,
        supporting_evidence: Optional[EvidenceMaterial] = None,
        notes: str = "",
    ) -> ProcessingHistory:
        old_status = record.current_status
        old_weight = record.current_weight
        old_notes = record.operator_notes
        old_evidence_ids = [e.evidence_id for e in record.evidence_materials]

        record.current_weight = new_current_weight
        if supporting_evidence:
            record.evidence_materials.append(supporting_evidence)
        record.operator_notes = notes
        record.is_manually_modified = True

        new_status = self._reevaluate_status(record)
        record.current_status = new_status

        new_evidence_ids = [e.evidence_id for e in record.evidence_materials]

        history_entry = ProcessingHistory(
            history_id=f"HIST_W_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{record.record_id}",
            timestamp=datetime.now(),
            previous_status=old_status,
            new_status=new_status,
            operator=operator,
            reason=f"【体重改判】{reason}",
            previous_evidence_ids=old_evidence_ids,
            new_evidence_ids=new_evidence_ids,
            previous_notes=old_notes,
            new_notes=notes,
            revision_snapshot={
                "type": "weight_revision",
                "before": {
                    "status": old_status.value,
                    "current_weight": old_weight,
                },
                "after": {
                    "status": new_status.value,
                    "current_weight": new_current_weight,
                },
                "weight_delta": round(new_current_weight - old_weight, 2),
                "conclusion_changed": old_status != new_status,
            },
        )
        record.processing_history.append(history_entry)

        if record.record_id not in self._revision_index:
            self._revision_index[record.record_id] = []
        self._revision_index[record.record_id].append(history_entry)

        return history_entry

    def resolve_duplicate_manually(
        self,
        record: PetRecord,
        operator: str,
        resolution_reason: str,
        canonical_alias: str,
        notes: str = "",
    ) -> ProcessingHistory:
        old_status = record.current_status
        old_notes = record.operator_notes
        old_evidence_ids = [e.evidence_id for e in record.evidence_materials]

        record.duplicate_issues = []
        record.fostering_registration.pet_aliases = [canonical_alias] + [
            a for a in record.fostering_registration.pet_aliases if a != canonical_alias
        ]
        record.is_manually_modified = True

        new_status = self._reevaluate_status(record)
        record.current_status = new_status

        history_entry = ProcessingHistory(
            history_id=f"HIST_D_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{record.record_id}",
            timestamp=datetime.now(),
            previous_status=old_status,
            new_status=new_status,
            operator=operator,
            reason=f"【人工消除重复别名】{resolution_reason}（规范别名：{canonical_alias}）",
            previous_evidence_ids=old_evidence_ids,
            new_evidence_ids=old_evidence_ids,
            previous_notes=old_notes,
            new_notes=notes,
            revision_snapshot={
                "type": "duplicate_resolution",
                "canonical_alias": canonical_alias,
                "conclusion_changed": old_status != new_status,
            },
        )
        record.processing_history.append(history_entry)

        if record.record_id not in self._revision_index:
            self._revision_index[record.record_id] = []
        self._revision_index[record.record_id].append(history_entry)

        return history_entry

    def get_history(self, record: PetRecord) -> List[ProcessingHistory]:
        return list(record.processing_history)

    def get_history_by_record_id(self, record_id: str) -> List[ProcessingHistory]:
        return list(self._revision_index.get(record_id, []))

    def has_conclusion_changed(self, record: PetRecord) -> bool:
        if len(record.processing_history) < 1:
            return False
        first_status = record.processing_history[0].previous_status
        return any(h.previous_status != h.new_status for h in record.processing_history)

    def format_history_summary(self, record: PetRecord) -> List[str]:
        lines = []
        for i, h in enumerate(record.processing_history, 1):
            changed = "🔄 结论变更" if h.previous_status != h.new_status else "➡️ 仅补充材料"
            lines.append(
                f"  [{i}] {h.timestamp.strftime('%Y-%m-%d %H:%M:%S')} | "
                f"{h.operator} | {changed}\n"
                f"      状态: {h.previous_status.value} → {h.new_status.value}\n"
                f"      原因: {h.reason}\n"
                f"      原材料: {h.previous_evidence_ids or ['无']}\n"
                f"      新备注: {h.new_notes or '无'}"
            )
        return lines

    @staticmethod
    def _reevaluate_status(record: PetRecord) -> ProcessingStatus:
        if record.duplicate_issues:
            return ProcessingStatus.ABNORMAL
        if not record.evidence_materials:
            return ProcessingStatus.NEED_EVIDENCE
        if record.is_target_met:
            return ProcessingStatus.PASSED
        return ProcessingStatus.NEED_EVIDENCE
