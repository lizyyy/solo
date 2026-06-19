import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Tuple, Callable
from pathlib import Path

from .models import (
    SongRecord, SongStatus, EvidenceType,
    Evidence, ManualChange, CheckReport
)


class BoundaryRules:
    NAME_CONFLICT_REQUIRES_TEACHER_REVIEW = True
    CONTRACT_EVIDENCE_OUTWEIGHS_GROUP_CHAT = True
    ROLLBACK_PRESERVES_HISTORY = True
    MIN_EVIDENCE_FOR_APPROVAL = 2
    APPROVAL_REQUIRES_GROUP_CHAT = True
    APPROVAL_REQUIRES_CONTRACT = True
    APPROVAL_REQUIRES_NOTE = True

    @classmethod
    def to_dict(cls) -> Dict[str, any]:
        return {
            "NAME_CONFLICT_REQUIRES_TEACHER_REVIEW": cls.NAME_CONFLICT_REQUIRES_TEACHER_REVIEW,
            "CONTRACT_EVIDENCE_OUTWEIGHS_GROUP_CHAT": cls.CONTRACT_EVIDENCE_OUTWEIGHS_GROUP_CHAT,
            "ROLLBACK_PRESERVES_HISTORY": cls.ROLLBACK_PRESERVES_HISTORY,
            "MIN_EVIDENCE_FOR_APPROVAL": cls.MIN_EVIDENCE_FOR_APPROVAL,
            "APPROVAL_REQUIRES_GROUP_CHAT": cls.APPROVAL_REQUIRES_GROUP_CHAT,
            "APPROVAL_REQUIRES_CONTRACT": cls.APPROVAL_REQUIRES_CONTRACT,
            "APPROVAL_REQUIRES_NOTE": cls.APPROVAL_REQUIRES_NOTE
        }


class CopyrightCheckEngine:
    def __init__(self, data_path: str = "data/copyright_check.json"):
        self.data_path = Path(data_path)
        self.data_path.parent.mkdir(parents=True, exist_ok=True)
        self.records: Dict[str, SongRecord] = {}
        self.audit_log: List[Dict] = []
        self._load()

    def _load(self):
        if self.data_path.exists():
            with open(self.data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for record_data in data.get("records", []):
                    record = SongRecord.from_dict(record_data)
                    self.records[record.record_id] = record
                self.audit_log = data.get("audit_log", [])

    def _save(self):
        data = {
            "records": [r.to_dict() for r in self.records.values()],
            "audit_log": self.audit_log,
            "boundary_rules": BoundaryRules.to_dict(),
            "last_saved": datetime.now().isoformat()
        }
        with open(self.data_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _log_audit(self, action: str, record_id: Optional[str], operator: str, details: Dict):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "record_id": record_id,
            "operator": operator,
            "details": details
        }
        self.audit_log.append(entry)
        self._save()

    def import_song(self, live_name: Optional[str], copyright_name: Optional[str],
                    region: str, import_source: str, original_row_number: Optional[int],
                    operator: str) -> SongRecord:
        record_id = str(uuid.uuid4())
        record = SongRecord(
            record_id=record_id,
            live_name=live_name,
            copyright_name=copyright_name,
            region=region,
            status=SongStatus.IMPORTED,
            import_source=import_source,
            original_row_number=original_row_number,
            import_time=datetime.now()
        )

        if record.has_name_conflict():
            record.update_status(SongStatus.NAME_CONFLICT, operator)

        self.records[record_id] = record
        self._log_audit("import", record_id, operator, {
            "live_name": live_name,
            "copyright_name": copyright_name,
            "region": region,
            "original_row_number": original_row_number,
            "has_name_conflict": record.has_name_conflict()
        })
        return record

    def batch_import_from_group_chat(self, rows: List[Dict], operator: str,
                                      source_file: str = "group_chat") -> Tuple[List[SongRecord], List[Dict]]:
        imported = []
        errors = []

        for idx, row in enumerate(rows, start=1):
            try:
                live_name = row.get("现场名") or row.get("live_name")
                copyright_name = row.get("版权名") or row.get("copyright_name")
                region = row.get("授权地域") or row.get("region", "中国大陆")

                record = self.import_song(
                    live_name=live_name,
                    copyright_name=copyright_name,
                    region=region,
                    import_source="group_chat_import",
                    original_row_number=idx,
                    operator=operator
                )

                evidence_content = (
                    f"排练群接龙第{idx}行: "
                    f"现场名={live_name or '无'}, "
                    f"版权名={copyright_name or '无'}, "
                    f"授权地域={region}"
                )
                record.add_evidence(
                    evidence_type=EvidenceType.GROUP_CHAT,
                    source=f"{source_file}:行{idx}",
                    content=evidence_content,
                    operator=operator
                )

                record.metadata["original_row_data"] = dict(row)

                imported.append(record)
            except Exception as e:
                errors.append({"row": idx, "error": str(e), "data": row})

        self._save()
        return imported, errors

    def add_contract_evidence(self, record_id: str, source: str, content: str,
                               operator: str) -> Optional[Evidence]:
        record = self.records.get(record_id)
        if not record:
            return None

        evidence = record.add_evidence(
            evidence_type=EvidenceType.CONTRACT_SCREENSHOT,
            source=source,
            content=content,
            operator=operator
        )

        if record.status == SongStatus.NAME_CONFLICT:
            record.update_status(SongStatus.TEACHER_REVIEW, operator)
        elif record.status in [SongStatus.IMPORTED, SongStatus.AWAITING_CONTRACT]:
            record.update_status(SongStatus.CONTRACT_VERIFIED, operator)

        self._log_audit("add_contract_evidence", record_id, operator, {
            "evidence_id": evidence.evidence_id,
            "source": source,
            "new_status": record.status.value
        })
        self._save()
        return evidence

    def add_group_chat_evidence(self, record_id: str, source: str, content: str,
                                 operator: str) -> Optional[Evidence]:
        record = self.records.get(record_id)
        if not record:
            return None

        evidence = record.add_evidence(
            evidence_type=EvidenceType.GROUP_CHAT,
            source=source,
            content=content,
            operator=operator
        )

        self._log_audit("add_group_chat_evidence", record_id, operator, {
            "evidence_id": evidence.evidence_id,
            "source": source
        })
        self._save()
        return evidence

    def update_song_name(self, record_id: str, field_name: str, new_value: str,
                         operator: str, reason: str) -> Optional[ManualChange]:
        record = self.records.get(record_id)
        if not record:
            return None

        if field_name not in ["live_name", "copyright_name"]:
            raise ValueError(f"不支持修改字段: {field_name}")

        old_value = getattr(record, field_name) or ""
        change = record.add_manual_change(
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            reason=reason
        )

        setattr(record, field_name, new_value)

        if record.has_name_conflict():
            record.update_status(SongStatus.NAME_CONFLICT, operator)
        elif record.status == SongStatus.NAME_CONFLICT and not record.has_name_conflict():
            contract_evidence = [e for e in record.evidences if e.evidence_type == EvidenceType.CONTRACT_SCREENSHOT]
            if contract_evidence:
                record.update_status(SongStatus.CONTRACT_VERIFIED, operator)
            else:
                record.update_status(SongStatus.IMPORTED, operator)

        self._log_audit("update_song_name", record_id, operator, {
            "field": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "reason": reason,
            "new_status": record.status.value
        })
        self._save()
        return change

    def teacher_approve(self, record_id: str, operator: str, note: str = "") -> Tuple[bool, List[str]]:
        record = self.records.get(record_id)
        if not record:
            return False, ["记录不存在"]

        if record.status not in [SongStatus.TEACHER_REVIEW, SongStatus.CONTRACT_VERIFIED]:
            return False, [f"当前状态 {record.status.value} 不允许审批，需为 teacher_review 或 contract_verified"]

        blockers: List[str] = []

        group_chat_count = sum(1 for e in record.evidences if e.evidence_type == EvidenceType.GROUP_CHAT)
        contract_count = sum(1 for e in record.evidences if e.evidence_type == EvidenceType.CONTRACT_SCREENSHOT)
        total_evidence = group_chat_count + contract_count

        if BoundaryRules.APPROVAL_REQUIRES_GROUP_CHAT and group_chat_count == 0:
            blockers.append("缺少排练群接龙证据")

        if BoundaryRules.APPROVAL_REQUIRES_CONTRACT and contract_count == 0:
            blockers.append("缺少合同页截图证据")

        if total_evidence < BoundaryRules.MIN_EVIDENCE_FOR_APPROVAL:
            blockers.append(f"证据总数不足（当前 {total_evidence}，需要 {BoundaryRules.MIN_EVIDENCE_FOR_APPROVAL}）")

        if BoundaryRules.APPROVAL_REQUIRES_NOTE and (not note or not note.strip()):
            blockers.append("审批备注不能为空")

        if blockers:
            if contract_count == 0:
                record.update_status(SongStatus.AWAITING_CONTRACT, operator)
            record.add_evidence(
                evidence_type=EvidenceType.MANUAL_NOTE,
                source="teacher_review_blocked",
                content=f"审批被阻止: {'; '.join(blockers)}",
                operator=operator
            )
            self._log_audit("teacher_approve_blocked", record_id, operator, {
                "blockers": blockers,
                "note": note,
                "group_chat_count": group_chat_count,
                "contract_count": contract_count
            })
            self._save()
            return False, blockers

        record.update_status(SongStatus.APPROVED, operator)

        record.add_evidence(
            evidence_type=EvidenceType.MANUAL_NOTE,
            source="teacher_review",
            content=note,
            operator=operator
        )

        self._log_audit("teacher_approve", record_id, operator, {
            "note": note,
            "group_chat_count": group_chat_count,
            "contract_count": contract_count
        })
        self._save()
        return True, []

    def teacher_reject(self, record_id: str, operator: str, reason: str) -> bool:
        record = self.records.get(record_id)
        if not record:
            return False

        record.update_status(SongStatus.REJECTED, operator)

        record.add_evidence(
            evidence_type=EvidenceType.MANUAL_NOTE,
            source="teacher_review",
            content=f"驳回原因: {reason}",
            operator=operator
        )

        self._log_audit("teacher_reject", record_id, operator, {
            "reason": reason
        })
        self._save()
        return True

    def rollback(self, record_id: str, operator: str, reason: str,
                 steps: int = 1) -> bool:
        record = self.records.get(record_id)
        if not record:
            return False

        if len(record.status_history) <= steps:
            return False

        target_idx = len(record.status_history) - 1 - steps
        target_status = record.status_history[target_idx][0]

        current_status = record.status.value

        record.add_evidence(
            evidence_type=EvidenceType.MANUAL_NOTE,
            source="rollback",
            content=f"从 {current_status} 回滚到 {target_status}，原因: {reason}",
            operator=operator
        )

        record.update_status(SongStatus(target_status), f"rollback:{operator}")

        record.metadata["rollback_count"] = record.metadata.get("rollback_count", 0) + 1

        self._log_audit("rollback", record_id, operator, {
            "reason": reason,
            "rolled_back_from": current_status,
            "rolled_back_to": target_status,
            "steps": steps
        })
        self._save()
        return True

    def get_record(self, record_id: str) -> Optional[SongRecord]:
        return self.records.get(record_id)

    def list_records(self, status: Optional[SongStatus] = None,
                     has_conflict: Optional[bool] = None) -> List[SongRecord]:
        results = list(self.records.values())

        if status:
            results = [r for r in results if r.status == status]

        if has_conflict is not None:
            results = [r for r in results if r.has_name_conflict() == has_conflict]

        return sorted(results, key=lambda r: r.import_time)

    def generate_report(self, include_records: bool = True) -> CheckReport:
        records = list(self.records.values())
        status_breakdown = {}
        conflict_count = 0
        awaiting_review_count = 0

        for r in records:
            status_breakdown[r.status.value] = status_breakdown.get(r.status.value, 0) + 1
            if r.has_name_conflict():
                conflict_count += 1
            if r.status in [SongStatus.TEACHER_REVIEW, SongStatus.AWAITING_CONTRACT]:
                awaiting_review_count += 1

        report_records = []
        if include_records:
            report_records = [r.get_evidence_summary() for r in records]

        return CheckReport(
            report_id=str(uuid.uuid4()),
            generated_at=datetime.now(),
            total_records=len(records),
            status_breakdown=status_breakdown,
            conflict_count=conflict_count,
            awaiting_review_count=awaiting_review_count,
            records=report_records
        )

    def export_weekly_report(self, output_path: str) -> str:
        report = self.generate_report()
        data = report.to_dict()

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        with open(output, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        self._log_audit("export_weekly_report", None, "system", {
            "output_path": str(output),
            "total_records": report.total_records
        })

        return str(output)

    def get_record_details(self, record_id: str) -> Optional[Dict]:
        record = self.get_record(record_id)
        if not record:
            return None

        return {
            "record": record.to_dict(),
            "evidence_summary": record.get_evidence_summary(),
            "can_approve": record.status in [SongStatus.TEACHER_REVIEW, SongStatus.CONTRACT_VERIFIED],
            "can_rollback": len(record.status_history) > 1,
            "boundary_rules_applied": {
                "has_name_conflict": record.has_name_conflict(),
                "requires_teacher_review": record.has_name_conflict() and BoundaryRules.NAME_CONFLICT_REQUIRES_TEACHER_REVIEW,
                "has_contract_evidence": any(e.evidence_type == EvidenceType.CONTRACT_SCREENSHOT for e in record.evidences)
            }
        }
