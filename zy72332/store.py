from typing import Dict, List, Optional
from models import StoreGroupingRecord, AuditTrail, GroupingResult
import json
import os
from datetime import datetime


class DataStore:
    """数据存储 - 基于文件的简单存储"""

    def __init__(self, base_dir: str = "data"):
        self.base_dir = base_dir
        self.records_dir = os.path.join(base_dir, "records")
        self.audit_dir = os.path.join(base_dir, "audit_trails")
        self.results_dir = os.path.join(base_dir, "results")
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [self.base_dir, self.records_dir, self.audit_dir, self.results_dir]:
            os.makedirs(d, exist_ok=True)

    def _record_path(self, record_id: str) -> str:
        return os.path.join(self.records_dir, f"{record_id}.json")

    def _audit_path(self, trail_id: str) -> str:
        return os.path.join(self.audit_dir, f"{trail_id}.json")

    def _result_path(self, record_id: str) -> str:
        return os.path.join(self.results_dir, f"{record_id}_result.json")

    def save_record(self, record: StoreGroupingRecord) -> None:
        with open(self._record_path(record.record_id), "w", encoding="utf-8") as f:
            json.dump(self._record_to_dict(record), f, ensure_ascii=False, indent=2, default=str)

    def get_record(self, record_id: str) -> Optional[StoreGroupingRecord]:
        path = self._record_path(record_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._dict_to_record(data)

    def get_all_records(self) -> List[StoreGroupingRecord]:
        records = []
        for filename in os.listdir(self.records_dir):
            if filename.endswith(".json"):
                with open(os.path.join(self.records_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    records.append(self._dict_to_record(data))
        return records

    def save_audit_trail(self, trail: AuditTrail) -> None:
        with open(self._audit_path(trail.trail_id), "w", encoding="utf-8") as f:
            json.dump(self._audit_to_dict(trail), f, ensure_ascii=False, indent=2, default=str)

    def get_audit_trail(self, trail_id: str) -> Optional[AuditTrail]:
        path = self._audit_path(trail_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._dict_to_audit(data)

    def get_audit_trail_by_record(self, record_id: str) -> Optional[AuditTrail]:
        for filename in os.listdir(self.audit_dir):
            if filename.endswith(".json"):
                with open(os.path.join(self.audit_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("record_id") == record_id:
                        return self._dict_to_audit(data)
        return None

    def save_grouping_result(self, result: GroupingResult) -> None:
        with open(self._result_path(result.record_id), "w", encoding="utf-8") as f:
            json.dump(self._result_to_dict(result), f, ensure_ascii=False, indent=2, default=str)

    def get_grouping_result(self, record_id: str) -> Optional[GroupingResult]:
        path = self._result_path(record_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._dict_to_result(data)

    def get_all_results(self) -> List[GroupingResult]:
        results = []
        for filename in os.listdir(self.results_dir):
            if filename.endswith("_result.json"):
                with open(os.path.join(self.results_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    results.append(self._dict_to_result(data))
        return results

    @staticmethod
    def _record_to_dict(record: StoreGroupingRecord) -> Dict:
        return {
            "record_id": record.record_id,
            "store_id": record.store_id,
            "store_name": record.store_name,
            "processing_type": record.processing_type.value,
            "student_answers": [
                {
                    "answer_id": a.answer_id,
                    "student_id": a.student_id,
                    "student_name": a.student_name,
                    "submission_time": a.submission_time.isoformat() if isinstance(a.submission_time, datetime) else a.submission_time,
                    "content": a.content,
                    "version": a.version,
                    "is_duplicate": a.is_duplicate
                } for a in record.student_answers
            ],
            "annotations": [
                {
                    "annotation_id": a.annotation_id,
                    "teacher_name": a.teacher_name,
                    "content": a.content,
                    "annotated_at": a.annotated_at.isoformat() if isinstance(a.annotated_at, datetime) else a.annotated_at,
                    "old_standard_reference": a.old_standard_reference,
                    "error_explanation_update": a.error_explanation_update
                } for a in record.annotations
            ],
            "screenshot_refs": [
                {
                    "screenshot_id": s.screenshot_id,
                    "file_path": s.file_path,
                    "description": s.description,
                    "imported_at": s.imported_at.isoformat() if isinstance(s.imported_at, datetime) else s.imported_at,
                    "formula_text": s.formula_text
                } for s in record.screenshot_refs
            ],
            "error_explanation": {
                "current_text": record.error_explanation.current_text,
                "history": record.error_explanation.history,
                "last_updated_at": record.error_explanation.last_updated_at.isoformat() if isinstance(record.error_explanation.last_updated_at, datetime) else record.error_explanation.last_updated_at,
                "updated_by": record.error_explanation.updated_by
            },
            "status": record.status.value,
            "created_at": record.created_at.isoformat() if isinstance(record.created_at, datetime) else record.created_at,
            "updated_at": record.updated_at.isoformat() if isinstance(record.updated_at, datetime) else record.updated_at,
            "final_group": record.final_group,
            "manual_correction_note": record.manual_correction_note,
            "re_run_count": record.re_run_count,
            "operation_log": record.operation_log
        }

    @staticmethod
    def _dict_to_record(data: Dict) -> StoreGroupingRecord:
        from models import (
            StudentAnswer, TeacherAnnotation, ScreenshotReference,
            ErrorExplanation, RecordStatus, ProcessingType
        )

        record = StoreGroupingRecord(
            record_id=data["record_id"],
            store_id=data["store_id"],
            store_name=data["store_name"],
            processing_type=ProcessingType(data["processing_type"]),
            status=RecordStatus(data["status"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            final_group=data.get("final_group"),
            manual_correction_note=data.get("manual_correction_note"),
            re_run_count=data.get("re_run_count", 0),
            operation_log=data.get("operation_log", [])
        )

        record.student_answers = [
            StudentAnswer(
                answer_id=a["answer_id"],
                student_id=a["student_id"],
                student_name=a["student_name"],
                submission_time=datetime.fromisoformat(a["submission_time"]),
                content=a["content"],
                version=a.get("version", 1),
                is_duplicate=a.get("is_duplicate", False)
            ) for a in data.get("student_answers", [])
        ]

        record.annotations = [
            TeacherAnnotation(
                annotation_id=a["annotation_id"],
                teacher_name=a["teacher_name"],
                content=a["content"],
                annotated_at=datetime.fromisoformat(a["annotated_at"]),
                old_standard_reference=a.get("old_standard_reference"),
                error_explanation_update=a.get("error_explanation_update")
            ) for a in data.get("annotations", [])
        ]

        record.screenshot_refs = [
            ScreenshotReference(
                screenshot_id=s["screenshot_id"],
                file_path=s["file_path"],
                description=s["description"],
                imported_at=datetime.fromisoformat(s["imported_at"]),
                formula_text=s.get("formula_text")
            ) for s in data.get("screenshot_refs", [])
        ]

        ee_data = data.get("error_explanation", {})
        record.error_explanation = ErrorExplanation(
            current_text=ee_data.get("current_text", "初始导入，待分析"),
            history=ee_data.get("history", []),
            last_updated_at=datetime.fromisoformat(ee_data["last_updated_at"]) if ee_data.get("last_updated_at") else None,
            updated_by=ee_data.get("updated_by")
        )

        return record

    @staticmethod
    def _audit_to_dict(trail: AuditTrail) -> Dict:
        return {
            "trail_id": trail.trail_id,
            "record_id": trail.record_id,
            "events": trail.events,
            "created_at": trail.created_at.isoformat() if isinstance(trail.created_at, datetime) else trail.created_at
        }

    @staticmethod
    def _dict_to_audit(data: Dict) -> AuditTrail:
        return AuditTrail(
            trail_id=data["trail_id"],
            record_id=data["record_id"],
            events=data.get("events", []),
            created_at=datetime.fromisoformat(data["created_at"])
        )

    @staticmethod
    def _result_to_dict(result: GroupingResult) -> Dict:
        return {
            "record_id": result.record_id,
            "store_id": result.store_id,
            "final_group": result.final_group,
            "confidence": result.confidence,
            "processing_type": result.processing_type.value,
            "status": result.status.value,
            "error_explanation": result.error_explanation,
            "generated_at": result.generated_at.isoformat() if isinstance(result.generated_at, datetime) else result.generated_at,
            "reviewed_by": result.reviewed_by
        }

    @staticmethod
    def _dict_to_result(data: Dict) -> GroupingResult:
        from models import RecordStatus, ProcessingType
        return GroupingResult(
            record_id=data["record_id"],
            store_id=data["store_id"],
            final_group=data["final_group"],
            confidence=data["confidence"],
            processing_type=ProcessingType(data["processing_type"]),
            status=RecordStatus(data["status"]),
            error_explanation=data["error_explanation"],
            generated_at=datetime.fromisoformat(data["generated_at"]),
            reviewed_by=data.get("reviewed_by")
        )
