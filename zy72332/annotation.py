from typing import Optional
from datetime import datetime
import uuid

from models import (
    StoreGroupingRecord, TeacherAnnotation,
    RecordStatus, AuditTrail
)
from store import DataStore


class AnnotationManager:
    """批注管理模块 - 处理老师批注补录，误差说明自动更新"""

    def __init__(self, store: DataStore):
        self.store = store

    def add_annotation(self, record_id: str, teacher_name: str,
                       content: str, old_standard_reference: Optional[str] = None,
                       error_explanation_update: Optional[str] = None,
                       operator: str = "小祁") -> TeacherAnnotation:
        """添加老师批注，自动更新误差说明"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        annotation = TeacherAnnotation(
            annotation_id=f"ann_{uuid.uuid4().hex[:8]}",
            teacher_name=teacher_name,
            content=content,
            annotated_at=datetime.now(),
            old_standard_reference=old_standard_reference,
            error_explanation_update=error_explanation_update
        )
        record.annotations.append(annotation)

        if error_explanation_update:
            old_error = record.error_explanation.current_text
            record.error_explanation.update(
                error_explanation_update,
                operator,
                annotation_ref=annotation.annotation_id
            )
            record.log_operation("更新误差说明", operator, {
                "annotation_id": annotation.annotation_id,
                "old_error": old_error,
                "new_error": error_explanation_update
            })

        if old_standard_reference:
            record.status = RecordStatus.OLD_STANDARD
            record.log_operation("应用旧口径", operator, {
                "annotation_id": annotation.annotation_id,
                "old_standard_reference": old_standard_reference
            })
        else:
            record.status = RecordStatus.ANNOTATED

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "ANNOTATION_ADDED",
                f"补录{teacher_name}老师的批注",
                operator,
                {
                    "annotation_id": annotation.annotation_id,
                    "teacher_name": teacher_name,
                    "content": content,
                    "old_standard_reference": old_standard_reference
                }
            )
            if error_explanation_update:
                audit.add_event(
                    "ERROR_EXPLANATION_UPDATED",
                    f"误差说明已更新: {error_explanation_update}",
                    operator,
                    {
                        "old_text": old_error,
                        "new_text": error_explanation_update,
                        "source_annotation": annotation.annotation_id
                    }
                )
            if old_standard_reference:
                audit.add_event(
                    "OLD_STANDARD_APPLIED",
                    f"应用旧口径: {old_standard_reference}",
                    operator,
                    {"reference": old_standard_reference}
                )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return annotation

    def review_duplicate_answers(self, record_id: str, approved_answer_id: str,
                                 reviewer: str = "业务运营") -> StoreGroupingRecord:
        """业务运营复核重复答案，指定正确版本"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        approved = None
        for ans in record.student_answers:
            if ans.answer_id == approved_answer_id:
                ans.is_duplicate = False
                approved = ans
            else:
                ans.is_duplicate = True

        if approved:
            record.status = RecordStatus.NORMAL
            old_error = record.error_explanation.current_text
            record.error_explanation.update(
                f"业务运营已复核，采纳学生{approved.student_name}的第{approved.version}版答案",
                reviewer
            )
            record.log_operation("复核完成", reviewer, {
                "approved_answer_id": approved_answer_id,
                "student_name": approved.student_name,
                "version": approved.version
            })

            audit = self.store.get_audit_trail_by_record(record_id)
            if audit:
                audit.add_event(
                    "DUPLICATE_REVIEWED",
                    f"业务运营{reviewer}复核完成，采纳{approved.student_name}第{approved.version}版答案",
                    reviewer,
                    {
                        "approved_answer_id": approved_answer_id,
                        "rejected_count": len([a for a in record.student_answers if a.is_duplicate])
                    }
                )
                audit.add_event(
                    "ERROR_EXPLANATION_UPDATED",
                    f"误差说明更新为: {record.error_explanation.current_text}",
                    reviewer,
                    {"old_text": old_error, "new_text": record.error_explanation.current_text}
                )
                self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return record

    def manual_correct(self, record_id: str, correction_note: str,
                       operator: str = "小祁") -> StoreGroupingRecord:
        """人工修正记录"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        record.status = RecordStatus.MANUAL_CORRECTED
        record.manual_correction_note = correction_note
        record.log_operation("人工修正", operator, {
            "correction_note": correction_note
        })

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "MANUAL_CORRECTED",
                f"人工修正: {correction_note}",
                operator,
                {"correction_note": correction_note}
            )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return record
