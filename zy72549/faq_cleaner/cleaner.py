import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import (
    FAQRecord,
    ManualCorrection,
    ConflictEvidence,
    RecordStatus,
    RecordSource,
)


class FAQCleaner:
    def __init__(self):
        self.manual_corrections: Dict[str, ManualCorrection] = {}
        self.processed_records: Dict[str, FAQRecord] = {}

    def load_manual_corrections(self, corrections: List[ManualCorrection]):
        for corr in corrections:
            self.manual_corrections[corr.faq_id] = corr

    def clean_text(self, text: str) -> str:
        if not text:
            return text
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        return " ".join(lines)

    def detect_conflicts(
        self, model_record: FAQRecord, manual_corr: ManualCorrection
    ) -> List[ConflictEvidence]:
        conflicts = []

        if model_record.question != manual_corr.corrected_question:
            conflicts.append(
                ConflictEvidence(
                    faq_id=model_record.faq_id,
                    field_name="question",
                    model_value=model_record.question,
                    manual_value=manual_corr.corrected_question,
                    model_source=model_record.batch_id,
                    manual_source=manual_corr.batch_id,
                    model_time=model_record.create_time,
                    manual_time=manual_corr.correction_time,
                    description=f"问题字段冲突：模型输出为 '{model_record.question[:30]}...'，人工改判为 '{manual_corr.corrected_question[:30]}...'",
                )
            )

        if model_record.answer != manual_corr.corrected_answer:
            conflicts.append(
                ConflictEvidence(
                    faq_id=model_record.faq_id,
                    field_name="answer",
                    model_value=model_record.answer,
                    manual_value=manual_corr.corrected_answer,
                    model_source=model_record.batch_id,
                    manual_source=manual_corr.batch_id,
                    model_time=model_record.create_time,
                    manual_time=manual_corr.correction_time,
                    description=f"回答字段冲突：模型输出为 '{model_record.answer[:30]}...'，人工改判为 '{manual_corr.corrected_answer[:30]}...'",
                )
            )

        return conflicts

    def process_normal_record(self, record: FAQRecord, batch_id: str) -> FAQRecord:
        record.status = RecordStatus.NORMAL
        record.source = RecordSource.MODEL_OUTPUT
        record.batch_id = batch_id
        record.add_history(
            action="import_model_output",
            operator="system",
            detail=f"从批次 {batch_id} 导入模型输出，标记为正常记录",
        )
        return record

    def process_overwritten_correction(
        self, record: FAQRecord, manual_corr: ManualCorrection, batch_id: str
    ) -> FAQRecord:
        record.manual_correction = manual_corr
        record.status = RecordStatus.OVERWRITTEN
        record.source = RecordSource.MERGED
        record.review_required = True
        record.batch_id = batch_id

        record.add_remark(
            f"[人工改判备注] {manual_corr.remark} "
            f"(操作人：{manual_corr.operator}，时间：{manual_corr.correction_time.strftime('%Y-%m-%d %H:%M:%S')})"
        )
        record.add_remark(
            f"[覆盖警告] 该人工改判（批次{manual_corr.batch_id}）已被当前批次{batch_id}覆盖，需安全审核同事复核"
        )
        record.add_history(
            action="detect_overwritten_correction",
            operator="system",
            detail=f"检测到人工改判（批次{manual_corr.batch_id}）被当前批次{batch_id}覆盖，标记为待复核",
        )
        return record

    def process_supplemented_record(
        self, record: FAQRecord, manual_corr: ManualCorrection, batch_id: str
    ) -> FAQRecord:
        record.question = manual_corr.corrected_question
        record.answer = manual_corr.corrected_answer
        record.manual_correction = manual_corr
        record.status = RecordStatus.SUPPLEMENTED
        record.source = RecordSource.SUPPLEMENT
        record.batch_id = batch_id

        record.add_remark(
            f"[补录来源] 从人工改判表补录旧口径，原批次：{manual_corr.batch_id}，"
            f"操作人：{manual_corr.operator}，时间：{manual_corr.correction_time.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        record.add_remark(f"[原改判备注] {manual_corr.remark}")
        record.add_history(
            action="supplement_from_manual",
            operator="system",
            detail=f"从人工改判表（批次{manual_corr.batch_id}）补录旧口径到当前批次{batch_id}",
        )
        return record

    def process_conflict_record(
        self,
        record: FAQRecord,
        manual_corr: ManualCorrection,
        conflicts: List[ConflictEvidence],
        batch_id: str,
    ) -> FAQRecord:
        record.manual_correction = manual_corr
        record.conflicts = conflicts
        record.status = RecordStatus.CONFLICT
        record.source = RecordSource.MERGED
        record.batch_id = batch_id

        record.add_remark(
            f"[冲突警告] 模型输出与人工改判存在{len(conflicts)}处冲突，请算法运营老唐确认或驳回"
        )
        for i, conflict in enumerate(conflicts, 1):
            record.add_remark(
                f"[冲突{i}] 字段：{conflict.field_name} | 模型值：{conflict.model_value[:50]}... | "
                f"人工值：{conflict.manual_value[:50]}... | 详情：{conflict.description}"
            )
        record.add_remark(
            f"[人工改判备注] {manual_corr.remark} "
            f"(操作人：{manual_corr.operator})"
        )
        record.add_history(
            action="detect_conflict",
            operator="system",
            detail=f"检测到{len(conflicts)}处冲突，等待算法运营确认",
        )
        return record

    def process_manual_corrected(
        self, record: FAQRecord, manual_corr: ManualCorrection, batch_id: str
    ) -> FAQRecord:
        record.question = manual_corr.corrected_question
        record.answer = manual_corr.corrected_answer
        record.manual_correction = manual_corr
        record.status = RecordStatus.MANUAL_CORRECTED
        record.source = RecordSource.MANUAL_CORRECTION
        record.batch_id = batch_id

        record.add_remark(
            f"[人工改判] 已应用人工改判，操作人：{manual_corr.operator}，"
            f"时间：{manual_corr.correction_time.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        record.add_remark(f"[改判备注] {manual_corr.remark}")
        record.add_history(
            action="apply_manual_correction",
            operator="system",
            detail=f"应用人工改判（批次{manual_corr.batch_id}）到当前批次{batch_id}",
        )
        return record

    def process_record(
        self,
        record: FAQRecord,
        batch_id: str,
        is_supplement: bool = False,
    ) -> Tuple[FAQRecord, Optional[List[ConflictEvidence]]]:
        faq_id = record.faq_id
        manual_corr = self.manual_corrections.get(faq_id)

        if not manual_corr:
            return self.process_normal_record(record, batch_id), None

        if is_supplement:
            return self.process_supplemented_record(record, manual_corr, batch_id), None

        conflicts = self.detect_conflicts(record, manual_corr)

        if manual_corr.is_overwritten:
            return (
                self.process_overwritten_correction(record, manual_corr, batch_id),
                conflicts if conflicts else None,
            )

        if conflicts:
            return (
                self.process_conflict_record(record, manual_corr, conflicts, batch_id),
                conflicts,
            )

        return self.process_manual_corrected(record, manual_corr, batch_id), None

    def resolve_conflict(
        self,
        faq_id: str,
        operator: str,
        accept_manual: bool,
        resolution_note: str = "",
    ) -> FAQRecord:
        record = self.processed_records.get(faq_id)
        if not record or record.status != RecordStatus.CONFLICT:
            raise ValueError(f"未找到冲突记录：{faq_id}")

        manual_corr = record.manual_correction
        if accept_manual and manual_corr:
            record.question = manual_corr.corrected_question
            record.answer = manual_corr.corrected_answer
            record.status = RecordStatus.MANUAL_CORRECTED
            record.source = RecordSource.MANUAL_CORRECTION
            action_detail = f"算法运营{operator}确认采用人工改判"
        else:
            record.status = RecordStatus.NORMAL
            record.source = RecordSource.MODEL_OUTPUT
            action_detail = f"算法运营{operator}驳回人工改判，采用模型输出"

        if resolution_note:
            record.add_remark(f"[冲突解决备注] {resolution_note}")
        record.add_history(
            action="resolve_conflict",
            operator=operator,
            detail=action_detail,
        )
        record.conflicts = []

        return record
