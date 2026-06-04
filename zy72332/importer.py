from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import uuid
import os

from models import (
    StoreGroupingRecord, StudentAnswer, ScreenshotReference,
    RecordStatus, ProcessingType, AuditTrail
)
from store import DataStore


class DataImporter:
    """数据导入模块 - 处理旧公式截图导入，检测重复答案"""

    def __init__(self, store: DataStore):
        self.store = store

    def import_screenshot(self, record_id: str, screenshot_path: str,
                          formula_text: str, description: str,
                          operator: str = "小祁") -> ScreenshotReference:
        """导入旧公式截图"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        screenshot = ScreenshotReference(
            screenshot_id=f"shot_{uuid.uuid4().hex[:8]}",
            file_path=screenshot_path,
            description=description,
            imported_at=datetime.now(),
            formula_text=formula_text
        )
        record.screenshot_refs.append(screenshot)
        record.log_operation("导入旧公式截图", operator, {
            "screenshot_id": screenshot.screenshot_id,
            "description": description
        })

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "SCREENSHOT_IMPORTED",
                f"导入旧公式截图: {description}",
                operator,
                {"screenshot_id": screenshot.screenshot_id, "formula": formula_text}
            )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return screenshot

    def import_student_answers(self, record_id: str,
                               answers_data: List[Dict[str, Any]],
                               operator: str = "小祁") -> Tuple[StoreGroupingRecord, List[StudentAnswer]]:
        """导入学生答案，自动检测同一学生交两版答案"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        imported_answers = []
        student_submissions: Dict[str, List[StudentAnswer]] = {}

        for ans_data in answers_data:
            answer = StudentAnswer(
                answer_id=f"ans_{uuid.uuid4().hex[:8]}",
                student_id=ans_data["student_id"],
                student_name=ans_data["student_name"],
                submission_time=ans_data.get("submission_time", datetime.now()),
                content=ans_data["content"],
                version=ans_data.get("version", 1)
            )
            imported_answers.append(answer)
            record.student_answers.append(answer)

            if ans_data["student_id"] not in student_submissions:
                student_submissions[ans_data["student_id"]] = []
            student_submissions[ans_data["student_id"]].append(answer)

        detected_duplicates = []
        for student_id, submissions in student_submissions.items():
            if len(submissions) > 1:
                for ans in submissions:
                    ans.is_duplicate = True
                    detected_duplicates.append(ans)

        if detected_duplicates:
            record.status = RecordStatus.DUPLICATE_DETECTED
            record.error_explanation.update(
                f"检测到同一学生交了{len(detected_duplicates)}版答案，待业务运营复核后再处理",
                operator
            )
            record.log_operation("检测到重复答案", operator, {
                "duplicate_count": len(detected_duplicates),
                "students": list(student_submissions.keys())
            })
        else:
            record.status = RecordStatus.IMPORTED

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "ANSWERS_IMPORTED",
                f"导入{len(imported_answers)}条学生答案",
                operator,
                {
                    "total_imported": len(imported_answers),
                    "duplicate_detected": len(detected_duplicates) > 0,
                    "duplicate_count": len(detected_duplicates)
                }
            )
            if detected_duplicates:
                audit.add_event(
                    "DUPLICATE_DETECTED",
                    f"检测到同一学生交了{len(detected_duplicates)}版答案，不自动归正常，留给业务运营复核",
                    "系统自动检测",
                    {"student_ids": list(student_submissions.keys())}
                )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return record, imported_answers

    def create_new_record(self, store_id: str, store_name: str,
                          processing_type: ProcessingType,
                          operator: str = "小祁") -> StoreGroupingRecord:
        """创建新的门店分群记录"""
        record_id = f"rec_{uuid.uuid4().hex[:8]}"
        record = StoreGroupingRecord(
            record_id=record_id,
            store_id=store_id,
            store_name=store_name,
            processing_type=processing_type
        )

        audit = AuditTrail(
            trail_id=f"audit_{uuid.uuid4().hex[:8]}",
            record_id=record_id
        )
        audit.add_event(
            "RECORD_CREATED",
            f"创建门店分群记录: {store_name}",
            operator,
            {"store_id": store_id, "processing_type": processing_type.value}
        )

        self.store.save_record(record)
        self.store.save_audit_trail(audit)
        return record

    def mark_for_review(self, record_id: str, operator: str = "小祁") -> StoreGroupingRecord:
        """标记为待业务运营复核 - 检测到重复答案后的状态转换"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        record.status = RecordStatus.PENDING_REVIEW
        record.log_operation("提交业务运营复核", operator, {
            "reason": "存在同一学生多版答案，需要运营确认正确版本"
        })

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "PENDING_REVIEW",
                "标记为待业务运营复核，不自动归正常",
                operator,
                {"reason": "同一学生提交了多版答案"}
            )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return record
