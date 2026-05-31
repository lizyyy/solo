from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from models import (
    InspectionRecord, CustomerServiceDialog, KnowledgeBaseChange,
    EvidenceLink, RecordStatus, ChangeType, ConclusionType
)


class RAGInspectionEngine:
    def __init__(self):
        self.records: Dict[str, InspectionRecord] = {}
        self.dialogs: Dict[str, List[CustomerServiceDialog]] = defaultdict(list)
        self.kb_changes: Dict[str, List[KnowledgeBaseChange]] = defaultdict(list)
        self.evidence_links: Dict[str, List[EvidenceLink]] = defaultdict(list)

    def add_inspection_record(self, record: InspectionRecord) -> None:
        self.records[record.record_id] = record

    def add_customer_dialog(self, dialog: CustomerServiceDialog) -> None:
        self.dialogs[dialog.record_id].append(dialog)
        if dialog.record_id in self.records:
            record = self.records[dialog.record_id]
            if record.status == RecordStatus.PENDING_SUPPLEMENT:
                record.material_supplement_at = dialog.received_at
                self._add_change_history(
                    record,
                    change_type=ChangeType.MATERIAL_SUPPLEMENT,
                    description=f"补充客服对话 {dialog.dialog_id}",
                    changed_at=dialog.received_at
                )

    def add_knowledge_change(self, change: KnowledgeBaseChange) -> None:
        self.kb_changes[change.record_id].append(change)
        if change.record_id in self.records:
            record = self.records[change.record_id]
            record.last_modified_at = change.changed_at
            record.modified_by = change.operator
            if change.change_type == ChangeType.CONCLUSION_CHANGE:
                record.status = RecordStatus.MANUAL_MODIFIED
            self._add_change_history(
                record,
                change_type=change.change_type,
                description=f"{change.field_name}: {change.old_value} → {change.new_value}",
                changed_at=change.changed_at,
                operator=change.operator,
                reason=change.reason
            )

    def _add_change_history(self, record: InspectionRecord, change_type: ChangeType,
                            description: str, changed_at: datetime,
                            operator: Optional[str] = None,
                            reason: Optional[str] = None) -> None:
        record.change_history.append({
            "change_type": change_type,
            "description": description,
            "changed_at": changed_at,
            "operator": operator,
            "reason": reason
        })

    def create_evidence_link(self, record_id: str, evidence_type: str,
                             evidence_id: str, evidence_title: str,
                             evidence_summary: str, conclusion_point: str,
                             confidence: float) -> EvidenceLink:
        link = EvidenceLink(
            record_id=record_id,
            evidence_type=evidence_type,
            evidence_id=evidence_id,
            evidence_title=evidence_title,
            evidence_summary=evidence_summary,
            conclusion_point=conclusion_point,
            confidence=confidence
        )
        self.evidence_links[record_id].append(link)
        return link

    def get_record_with_evidence(self, record_id: str) -> Dict:
        record = self.records.get(record_id)
        if not record:
            return {}

        dialogs = self.dialogs.get(record_id, [])
        kb_changes = self.kb_changes.get(record_id, [])
        evidences = self.evidence_links.get(record_id, [])

        return {
            "record": record,
            "dialogs": dialogs,
            "kb_changes": kb_changes,
            "evidences": evidences,
            "change_type_analysis": self._analyze_change_types(record, kb_changes, dialogs)
        }

    def _analyze_change_types(self, record: InspectionRecord,
                              kb_changes: List[KnowledgeBaseChange],
                              dialogs: List[CustomerServiceDialog]) -> Dict:
        material_supplements = []
        conclusion_changes = []
        knowledge_modifications = []

        if dialogs:
            for d in dialogs:
                if d.is_delayed:
                    material_supplements.append({
                        "type": "客服对话补录",
                        "id": d.dialog_id,
                        "delay_hours": d.delay_hours,
                        "received_at": d.received_at
                    })

        for change in kb_changes:
            if change.change_type == ChangeType.MATERIAL_SUPPLEMENT:
                material_supplements.append({
                    "type": "材料补充",
                    "field": change.field_name,
                    "old": change.old_value,
                    "new": change.new_value,
                    "operator": change.operator,
                    "changed_at": change.changed_at
                })
            elif change.change_type == ChangeType.CONCLUSION_CHANGE:
                conclusion_changes.append({
                    "type": "结论变更",
                    "field": change.field_name,
                    "old": change.old_value,
                    "new": change.new_value,
                    "operator": change.operator,
                    "changed_at": change.changed_at,
                    "reason": change.reason
                })
            elif change.change_type == ChangeType.KNOWLEDGE_MODIFY:
                knowledge_modifications.append({
                    "type": "知识库修改",
                    "field": change.field_name,
                    "old": change.old_value,
                    "new": change.new_value,
                    "operator": change.operator,
                    "changed_at": change.changed_at,
                    "reason": change.reason
                })

        return {
            "material_supplements": material_supplements,
            "conclusion_changes": conclusion_changes,
            "knowledge_modifications": knowledge_modifications,
            "has_material_only": len(material_supplements) > 0 and len(conclusion_changes) == 0,
            "has_conclusion_change": len(conclusion_changes) > 0
        }

    def trace_conclusion_evidence(self, record_id: str, conclusion_point: str) -> List[EvidenceLink]:
        return [
            link for link in self.evidence_links.get(record_id, [])
            if conclusion_point in link.conclusion_point
        ]

    def get_records_by_status(self, status: RecordStatus) -> List[InspectionRecord]:
        return [r for r in self.records.values() if r.status == status]

    def get_delayed_dialog_records(self) -> List[Tuple[InspectionRecord, List[CustomerServiceDialog]]]:
        result = []
        for record_id, dialogs in self.dialogs.items():
            delayed = [d for d in dialogs if d.is_delayed]
            if delayed and record_id in self.records:
                result.append((self.records[record_id], delayed))
        return result

    def get_modified_records(self) -> List[Tuple[InspectionRecord, List[KnowledgeBaseChange]]]:
        result = []
        for record_id, changes in self.kb_changes.items():
            manual_changes = [c for c in changes if c.is_manual]
            if manual_changes and record_id in self.records:
                result.append((self.records[record_id], manual_changes))
        return result
