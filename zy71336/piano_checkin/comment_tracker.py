"""点评追踪系统 - 管理老师点评与历史记录关联"""
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime

from .models import (
    Comment, CheckinRecord, RecordStatus, Student,
    generate_id, load_json, save_json,
    COMMENTS_FILE, STUDENTS_FILE, RECORDS_FILE
)


@dataclass
class CommentWithContext:
    comment: Comment
    student: Optional[Student]
    record: Optional[CheckinRecord]


class CommentTracker:
    def __init__(self):
        self._comments: List[Comment] = []
        self._students: List[Student] = []
        self._records: List[CheckinRecord] = []
        self._load_all()

    def _load_all(self):
        comments_data = load_json(COMMENTS_FILE, [])
        self._comments = [Comment.from_dict(c) for c in comments_data]

        students_data = load_json(STUDENTS_FILE, [])
        self._students = [Student.from_dict(s) for s in students_data]

        records_data = load_json(RECORDS_FILE, [])
        self._records = [CheckinRecord.from_dict(r) for r in records_data]

    def _reload(self):
        self._load_all()

    def add_comment(
        self,
        record_id: str,
        teacher: str,
        content: str
    ) -> Comment:
        if not content or not content.strip():
            raise ValueError("点评内容不能为空")

        record = self._find_record(record_id)
        if not record:
            raise ValueError(f"打卡记录不存在: {record_id}")

        if record.status == RecordStatus.MERGED:
            raise ValueError(
                f"无法对已合并记录点评: {record_id}，"
                f"请对主记录[{record.merged_into}]进行点评"
            )

        comment = Comment(
            comment_id=generate_id("c_"),
            record_id=record_id,
            teacher=teacher,
            content=content.strip(),
            created_at=datetime.now().isoformat()
        )

        self._comments.append(comment)
        self._save_comments()

        return comment

    def update_comment(
        self,
        comment_id: str,
        new_content: str
    ) -> Optional[Comment]:
        for comment in self._comments:
            if comment.comment_id == comment_id:
                comment.content = new_content.strip()
                self._save_comments()
                return comment
        return None

    def delete_comment(self, comment_id: str) -> bool:
        for i, comment in enumerate(self._comments):
            if comment.comment_id == comment_id:
                del self._comments[i]
                self._save_comments()
                return True
        return False

    def get_comments_for_record(
        self,
        record_id: str
    ) -> List[CommentWithContext]:
        record = self._find_record(record_id)
        student = self._find_student(record.student_id) if record else None

        comments = [
            CommentWithContext(
                comment=c,
                student=student,
                record=record
            )
            for c in self._comments
            if c.record_id == record_id
        ]

        if record and record.merged_from:
            for merged_id in record.merged_from:
                merged_comments = [
                    CommentWithContext(
                        comment=c,
                        student=student,
                        record=self._find_record(merged_id)
                    )
                    for c in self._comments
                    if c.record_id == merged_id
                ]
                comments.extend(merged_comments)

        return sorted(comments, key=lambda x: x.comment.created_at)

    def get_comments_for_student(
        self,
        student_id: str
    ) -> List[CommentWithContext]:
        student = self._find_student(student_id)
        student_records = [
            r for r in self._records if r.student_id == student_id
        ]

        results = []
        for record in student_records:
            record_comments = self.get_comments_for_record(record.record_id)
            results.extend(record_comments)

        return sorted(results, key=lambda x: x.comment.created_at, reverse=True)

    def get_comment_history(
        self,
        student_id: Optional[str] = None,
        limit: int = 50
    ) -> List[CommentWithContext]:
        results = []
        for comment in self._comments:
            record = self._find_record(comment.record_id)
            if student_id and record and record.student_id != student_id:
                continue
            student = self._find_student(record.student_id) if record else None
            results.append(CommentWithContext(
                comment=comment,
                student=student,
                record=record
            ))

        return sorted(
            results,
            key=lambda x: x.comment.created_at,
            reverse=True
        )[:limit]

    def get_uncommented_records(
        self,
        date_filter: Optional[str] = None,
        include_abnormal_only: bool = False
    ) -> List[CheckinRecord]:
        commented_record_ids = {c.record_id for c in self._comments}

        records = [
            r for r in self._records
            if r.record_id not in commented_record_ids
            and r.status != RecordStatus.MERGED
        ]

        if date_filter:
            records = [r for r in records if r.checkin_date == date_filter]

        if include_abnormal_only:
            records = [r for r in records if r.abnormal_types]

        return sorted(records, key=lambda x: (x.checkin_date, x.checkin_time))

    def get_comment_summary(self) -> Dict[str, Any]:
        total_records = len([
            r for r in self._records if r.status != RecordStatus.MERGED
        ])
        commented_records = len({c.record_id for c in self._comments})
        uncommented = total_records - commented_records

        by_teacher: Dict[str, int] = {}
        for c in self._comments:
            by_teacher[c.teacher] = by_teacher.get(c.teacher, 0) + 1

        recent_comments = sorted(
            self._comments,
            key=lambda x: x.created_at,
            reverse=True
        )[:10]

        return {
            "total_comments": len(self._comments),
            "commented_records": commented_records,
            "uncommented_records": uncommented,
            "comment_rate": round(commented_records / total_records * 100, 1) if total_records > 0 else 0,
            "by_teacher": by_teacher,
            "recent_comments": [c.to_dict() for c in recent_comments]
        }

    def _find_record(self, record_id: str) -> Optional[CheckinRecord]:
        for r in self._records:
            if r.record_id == record_id:
                return r
        return None

    def _find_student(self, student_id: str) -> Optional[Student]:
        for s in self._students:
            if s.student_id == student_id:
                return s
        return None

    def _save_comments(self):
        data = [c.to_dict() for c in self._comments]
        save_json(COMMENTS_FILE, data, save_history=True)
        self._reload()
