import os
import glob
import json
from datetime import datetime
from typing import List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import (
    LogDirectory, RegressionTask, RegressionResult,
    DiffReport, FailedRecord
)
from app.core.constants import TaskStatus, DiffType
from app.services.masking_engine import MaskingEngine


class FileScanner:
    @staticmethod
    def scan_directory(directory_path: str, file_pattern: str = "*.log") -> List[str]:
        pattern = os.path.join(directory_path, "**", file_pattern)
        files = glob.glob(pattern, recursive=True)
        return sorted(files)

    @staticmethod
    def read_file_lines(file_path: str, encoding: str = "utf-8") -> List[str]:
        try:
            with open(file_path, "r", encoding=encoding) as f:
                return f.readlines()
        except UnicodeDecodeError:
            with open(file_path, "r", encoding="latin-1") as f:
                return f.readlines()
        except Exception:
            return []


class RegressionProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.masking_engine = MaskingEngine(db)

    def process_task(self, task_id: int, force_restart: bool = False) -> Dict[str, Any]:
        task = self.db.query(RegressionTask).filter(RegressionTask.id == task_id).first()
        if not task:
            return {"success": False, "error": "Task not found"}

        if task.status == TaskStatus.COMPLETED or task.status == TaskStatus.REVIEWED:
            return {"success": False, "error": "Task already processed", "error_code": "already_processed"}

        if task.status == TaskStatus.PROCESSING:
            return {"success": False, "error": "Task is already processing", "error_code": "invalid_status"}

        if task.status == TaskStatus.NEED_REVIEW and not force_restart:
            unreviewed_count = self.db.query(DiffReport).filter(
                DiffReport.task_id == task_id,
                DiffReport.is_reviewed == False
            ).count()
            return {
                "success": False,
                "error": f"Task has {unreviewed_count} unreviewed diffs, need manual review first",
                "error_code": "need_manual_review",
                "unreviewed_count": unreviewed_count
            }

        log_dir = self.db.query(LogDirectory).filter(
            LogDirectory.id == task.log_directory_id
        ).first()

        if not log_dir:
            task.status = TaskStatus.FAILED
            task.error_message = "Log directory not found"
            self.db.commit()
            return {"success": False, "error": "Log directory not found"}

        task.status = TaskStatus.PROCESSING
        task.started_at = datetime.utcnow()
        self.db.commit()

        try:
            files = FileScanner.scan_directory(log_dir.path, log_dir.file_pattern)
            task.total_files = len(files)

            total_lines = 0
            processed_lines = 0
            failed_lines = 0
            diff_count = 0
            risk_score = 0.0

            for file_path in files:
                lines = FileScanner.read_file_lines(file_path)
                for line_num, line in enumerate(lines, 1):
                    total_lines += 1
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        masked_content, applied_rules = self.masking_engine.apply_masking(line)

                        result = RegressionResult(
                            task_id=task_id,
                            file_path=file_path,
                            line_number=line_num,
                            original_content=line,
                            masked_content=masked_content,
                            applied_rules=json.dumps(applied_rules),
                            is_matched=len(applied_rules) > 0
                        )
                        self.db.add(result)
                        self.db.flush()

                        diffs = self.masking_engine.compare_contents(line, masked_content)
                        for diff in diffs:
                            diff_report = DiffReport(
                                task_id=task_id,
                                result_id=result.id,
                                diff_type=diff["diff_type"],
                                field_name=diff.get("field_name"),
                                original_value=diff.get("original_value"),
                                masked_value=diff.get("masked_value"),
                                severity=diff.get("severity", "medium"),
                                description=f"Diff detected in {os.path.basename(file_path)} line {line_num}"
                            )
                            self.db.add(diff_report)
                            diff_count += 1

                        risks = self.masking_engine.check_risk_words(masked_content)
                        for risk in risks:
                            risk_score += 1.0 if risk["severity"] == "high" else 0.5 if risk["severity"] == "medium" else 0.1

                        processed_lines += 1

                    except Exception as e:
                        failed_lines += 1
                        failed_record = FailedRecord(
                            task_id=task_id,
                            file_path=file_path,
                            line_number=line_num,
                            original_content=line,
                            error_type="processing_error",
                            error_message=str(e)
                        )
                        self.db.add(failed_record)

                self.db.commit()

            task.total_lines = total_lines
            task.processed_lines = processed_lines
            task.failed_lines = failed_lines
            task.diff_count = diff_count
            task.risk_score = risk_score
            task.status = TaskStatus.NEED_REVIEW if diff_count > 0 or risk_score > 0 else TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()
            self.db.commit()

            return {
                "success": True,
                "task_id": task_id,
                "total_files": len(files),
                "total_lines": total_lines,
                "processed_lines": processed_lines,
                "failed_lines": failed_lines,
                "diff_count": diff_count,
                "risk_score": risk_score
            }

        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            self.db.commit()
            return {"success": False, "error": str(e)}
