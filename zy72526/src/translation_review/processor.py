from __future__ import annotations
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import (
    TranslationRecord,
    FeedbackTicket,
    DesensitizationNote,
    ManualChange,
    RecordStatus,
    WorkflowStep,
    AbnormalType,
)
from .storage import Storage


def _gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class RecordProcessor:
    def __init__(self, storage: Storage):
        self.storage = storage

    def import_ticket(
        self,
        ticket_data: Dict,
        sample_no: str,
        model_version: str,
        model_translation: str,
        import_batch_no: str = "",
        operator: str = "system",
    ) -> TranslationRecord:
        ticket = FeedbackTicket(**ticket_data)

        existing_by_ticket = self.storage.find_by_ticket_id(ticket.ticket_id)
        existing_by_sample = self.storage.find_by_sample_no(sample_no)

        abnormal_types: List[AbnormalType] = []
        status = RecordStatus.PENDING_REVIEW

        if existing_by_ticket:
            abnormal_types.append(AbnormalType.DUPLICATE_IMPORT)
            status = RecordStatus.NEEDS_RECHECK

        if existing_by_sample:
            for rec in existing_by_sample:
                if rec.model_version != model_version:
                    abnormal_types.append(AbnormalType.MODEL_VERSION_CHANGED)
                    status = RecordStatus.NEEDS_RECHECK
                    break

        record = TranslationRecord(
            record_id=_gen_id("rec"),
            sample_no=sample_no,
            model_version=model_version,
            model_translation=model_translation,
            final_translation=model_translation,
            feedback_ticket=ticket,
            status=status,
            current_step=WorkflowStep.STEP1_IMPORT,
            abnormal_types=abnormal_types,
            imported_at=datetime.now(),
            import_batch_no=import_batch_no,
        )

        self.storage.save_record(record)
        return record

    def batch_import(
        self,
        records_data: List[Dict],
        import_batch_no: str = "",
        operator: str = "system",
    ) -> List[TranslationRecord]:
        if not import_batch_no:
            import_batch_no = _gen_id("batch")

        results = []
        for item in records_data:
            record = self.import_ticket(
                ticket_data=item["ticket"],
                sample_no=item["sample_no"],
                model_version=item["model_version"],
                model_translation=item["model_translation"],
                import_batch_no=import_batch_no,
                operator=operator,
            )
            results.append(record)
        return results

    def add_desensitization_note(
        self,
        record_id: str,
        rule_name: str,
        rule_description: str,
        reviewer: str,
        is_desensitized: bool,
        remark: str = "",
    ) -> TranslationRecord:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        note = DesensitizationNote(
            note_id=_gen_id("note"),
            ticket_id=record.feedback_ticket.ticket_id,
            rule_name=rule_name,
            rule_description=rule_description,
            reviewer=reviewer,
            reviewed_at=datetime.now(),
            is_desensitized=is_desensitized,
            remark=remark,
        )

        old_note = record.desensitization_note
        if old_note:
            change = ManualChange(
                change_id=_gen_id("chg"),
                record_id=record_id,
                field_name="desensitization_note",
                old_value=old_note.model_dump(),
                new_value=note.model_dump(),
                operator=reviewer,
                changed_at=datetime.now(),
                reason="更新脱敏规则备注",
            )
            record.manual_changes.append(change)

        record.desensitization_note = note

        if AbnormalType.MODEL_VERSION_CHANGED not in record.abnormal_types:
            record.status = RecordStatus.DESENSITIZATION_REVIEWED
        record.current_step = WorkflowStep.STEP2_DESENSITIZATION

        self.storage.save_record(record)
        return record

    def update_translation(
        self,
        record_id: str,
        new_translation: str,
        operator: str,
        reason: str,
    ) -> TranslationRecord:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        old_value = record.final_translation
        change = ManualChange(
            change_id=_gen_id("chg"),
            record_id=record_id,
            field_name="final_translation",
            old_value=old_value,
            new_value=new_translation,
            operator=operator,
            changed_at=datetime.now(),
            reason=reason,
        )

        record.final_translation = new_translation
        record.manual_changes.append(change)
        record.updated_at = datetime.now()

        self.storage.save_record(record)
        return record

    def mark_supplementary(
        self,
        record_id: str,
        operator: str,
        reason: str = "补录数据",
    ) -> TranslationRecord:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        if AbnormalType.SUPPLEMENTARY_RECORD not in record.abnormal_types:
            record.abnormal_types.append(AbnormalType.SUPPLEMENTARY_RECORD)
        record.status = RecordStatus.NEEDS_RECHECK
        record.recheck_count += 1
        record.updated_at = datetime.now()

        change = ManualChange(
            change_id=_gen_id("chg"),
            record_id=record_id,
            field_name="recheck_count",
            old_value=record.recheck_count - 1,
            new_value=record.recheck_count,
            operator=operator,
            changed_at=datetime.now(),
            reason=reason,
        )
        record.manual_changes.append(change)

        self.storage.save_record(record)
        return record

    def recalculate(
        self,
        record_id: str,
        new_model_translation: Optional[str] = None,
        operator: str = "system",
    ) -> TranslationRecord:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        if new_model_translation and new_model_translation != record.model_translation:
            change = ManualChange(
                change_id=_gen_id("chg"),
                record_id=record_id,
                field_name="model_translation",
                old_value=record.model_translation,
                new_value=new_model_translation,
                operator=operator,
                changed_at=datetime.now(),
                reason="重算模型翻译结果",
            )
            record.model_translation = new_model_translation
            record.manual_changes.append(change)

            if record.final_translation == record.model_translation:
                record.final_translation = new_model_translation

        record.recheck_count += 1
        record.updated_at = datetime.now()

        if AbnormalType.MODEL_VERSION_CHANGED in record.abnormal_types:
            record.status = RecordStatus.NEEDS_RECHECK
        elif record.desensitization_note:
            record.status = RecordStatus.DESENSITIZATION_REVIEWED
        else:
            record.status = RecordStatus.PENDING_REVIEW

        self.storage.save_record(record)
        return record

    def get_duplicates(self, ticket_id: str) -> List[TranslationRecord]:
        return self.storage.find_by_ticket_id(ticket_id)

    def get_model_conflicts(self, sample_no: str) -> List[TranslationRecord]:
        records = self.storage.find_by_sample_no(sample_no)
        if len(records) <= 1:
            return []
        versions = {r.model_version for r in records}
        if len(versions) <= 1:
            return []
        return records

    def find_version_changed_samples(self) -> List[str]:
        sample_records: Dict[str, List[TranslationRecord]] = {}
        for r in self.storage.list_records():
            sample_records.setdefault(r.sample_no, []).append(r)

        conflict_samples = []
        for sample_no, records in sample_records.items():
            versions = {r.model_version for r in records}
            if len(versions) > 1:
                conflict_samples.append(sample_no)
        return conflict_samples
