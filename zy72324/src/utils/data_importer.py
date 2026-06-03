import pandas as pd
from datetime import datetime
import hashlib
import os
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session

from src.models.database import (
    SampleList, TeacherComment, ImportBatch, BorderlineCase,
    get_db
)
from src.utils.border_rules import (
    detect_score_issues, detect_rank_issues, apply_border_rule,
    compare_versions, generate_record_hash
)


class DataImporter:
    def __init__(self, db: Session):
        self.db = db
        self.stats = {
            "total": 0,
            "new": 0,
            "updated": 0,
            "duplicate": 0,
            "borderline": 0
        }

    def import_sample_list(self, file_path: str, imported_by: str = "system", 
                          import_note: str = "") -> Tuple[str, Dict]:
        """
        导入抽样名单（保留完整备注信息）
        """
        batch_id = self._generate_batch_id("sample")
        
        df = self._read_file(file_path)
        total_samples = len(df)
        
        batch = ImportBatch(
            batch_id=batch_id,
            batch_type="sample_list",
            file_name=os.path.basename(file_path),
            total_records=total_samples,
            imported_by=imported_by,
            import_note=import_note
        )
        self.db.add(batch)
        
        for _, row in df.iterrows():
            self.stats["total"] += 1
            self._process_sample_row(row, batch_id, total_samples)
        
        batch.new_records = self.stats["new"]
        batch.updated_records = self.stats["updated"]
        batch.duplicate_records = self.stats["duplicate"]
        
        self.db.commit()
        
        return batch_id, self.stats

    def import_teacher_comments(self, file_path: str, imported_by: str = "teacher",
                                import_note: str = "") -> Tuple[str, Dict]:
        """
        导入老师批注（版本追踪，不重复计数）
        """
        batch_id = self._generate_batch_id("comment")
        
        df = self._read_file(file_path)
        total_comments = len(df)
        
        batch = ImportBatch(
            batch_id=batch_id,
            batch_type="teacher_comment",
            file_name=os.path.basename(file_path),
            total_records=total_comments,
            imported_by=imported_by,
            import_note=import_note
        )
        self.db.add(batch)
        
        for _, row in df.iterrows():
            self._process_comment_row(row, batch_id, imported_by)
        
        batch.new_records = self.stats["new"]
        batch.updated_records = self.stats["updated"]
        batch.duplicate_records = self.stats["duplicate"]
        
        self.db.commit()
        
        return batch_id, self.stats

    def _process_sample_row(self, row: pd.Series, batch_id: str, total_samples: int):
        """
        处理单行抽样名单数据
        """
        student_id = str(row.get("学号", row.get("student_id", ""))).strip()
        if not student_id:
            return
        
        existing = self.db.query(SampleList).filter(
            SampleList.student_id == student_id
        ).first()
        
        raw_score = str(row.get("分数", row.get("score", "")))
        has_issue, issue_type, score_details = detect_score_issues(raw_score)
        
        sample_data = {
            "student_id": student_id,
            "student_name": str(row.get("姓名", row.get("student_name", ""))),
            "raw_score": raw_score,
            "score": score_details["cleaned_value"],
            "rank": self._safe_int(row.get("排名", row.get("rank", None))),
            "volunteer_1": str(row.get("志愿1", row.get("volunteer_1", ""))),
            "volunteer_2": str(row.get("志愿2", row.get("volunteer_2", ""))),
            "volunteer_3": str(row.get("志愿3", row.get("volunteer_3", ""))),
            "remark": str(row.get("备注", row.get("remark", ""))),
            "source_file": batch_id,
            "import_batch": batch_id
        }
        
        if existing:
            old_data = {
                "score": existing.score,
                "rank": existing.rank,
                "remark": existing.remark
            }
            changes = compare_versions(old_data, sample_data)
            
            if changes:
                existing.score = sample_data["score"]
                existing.rank = sample_data["rank"]
                existing.remark = sample_data["remark"]
                existing.raw_score = sample_data["raw_score"]
                existing.import_batch = batch_id
                existing.updated_at = datetime.utcnow()
                self.stats["updated"] += 1
            else:
                self.stats["duplicate"] += 1
                return
        else:
            sample = SampleList(**sample_data)
            self.db.add(sample)
            self.db.flush()
            self.stats["new"] += 1
            existing = sample
        
        if has_issue:
            self._handle_border_issue(existing, issue_type, score_details)

    def _process_comment_row(self, row: pd.Series, batch_id: str, imported_by: str):
        """
        处理单行老师批注（支持版本追踪）
        """
        student_id = str(row.get("学号", row.get("student_id", ""))).strip()
        comment_text = str(row.get("批注", row.get("comment", ""))).strip()
        
        if not student_id or not comment_text or student_id == "nan" or comment_text == "nan":
            return
        
        sample = self.db.query(SampleList).filter(
            SampleList.student_id == student_id
        ).first()
        
        if not sample:
            return
        
        self.stats["total"] += 1
        
        existing_latest = self.db.query(TeacherComment).filter(
            TeacherComment.sample_id == sample.id,
            TeacherComment.is_latest == True
        ).first()
        
        if existing_latest and existing_latest.comment == comment_text:
            self.stats["duplicate"] += 1
            return
        
        if existing_latest:
            existing_latest.is_latest = False
            new_version = existing_latest.version + 1
            prev_id = existing_latest.id
            self.stats["updated"] += 1
        else:
            new_version = 1
            prev_id = None
            self.stats["new"] += 1
        
        comment = TeacherComment(
            sample_id=sample.id,
            teacher_name=str(row.get("老师", row.get("teacher_name", imported_by))),
            comment=comment_text,
            comment_type=str(row.get("类型", row.get("comment_type", "general"))),
            import_batch=batch_id,
            version=new_version,
            is_latest=True,
            previous_version_id=prev_id,
            created_by=imported_by
        )
        self.db.add(comment)

    def _handle_border_issue(self, sample: SampleList, issue_type: str, details: Dict):
        """
        处理边界问题（负数、缺失等）
        """
        self.stats["borderline"] += 1
        
        rule_result = apply_border_rule(issue_type, {})
        
        sample.is_negative = (issue_type == "negative_score")
        sample.is_missing = (issue_type == "missing_score")
        sample.needs_review = rule_result["needs_review"]
        sample.review_status = "pending"
        
        borderline = BorderlineCase(
            sample_id=sample.id,
            case_type=issue_type,
            description=f"检测到边界问题: {issue_type}",
            original_value=details["original_value"],
            status="pending",
            assigned_to=rule_result.get("review_assignee", "student_assistant")
        )
        self.db.add(borderline)

    def _read_file(self, file_path: str) -> pd.DataFrame:
        """
        读取Excel或CSV文件
        """
        if file_path.endswith(".csv"):
            return pd.read_csv(file_path, dtype=str)
        else:
            return pd.read_excel(file_path, dtype=str)

    def _generate_batch_id(self, prefix: str) -> str:
        """
        生成批次ID
        """
        import uuid
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        random_suffix = uuid.uuid4().hex[:6]
        return f"{prefix}_{timestamp}_{random_suffix}"

    def _safe_int(self, value) -> Optional[int]:
        """
        安全转换整数
        """
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None
