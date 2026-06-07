"""数据导入模块 - 处理模型输出片段和人工改判表导入"""

import csv
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

import pandas as pd

from .models import (
    ModelOutputFragment,
    ManualJudgment,
    TrackingRecord,
    RecordStatus,
    EvidenceLog,
)


def generate_id(prefix: str = "rec") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class DataImporter:
    """数据导入器"""

    def __init__(self):
        self.import_history: List[Dict[str, Any]] = []
        self.imported_record_ids: set = set()
        self.imported_user_feedback_ids: set = set()

    def import_model_output(
        self,
        file_path: str,
        batch_id: Optional[str] = None,
    ) -> Tuple[List[TrackingRecord], List[str], List[str]]:
        """导入模型输出片段

        返回: (追踪记录列表, 警告列表, 错误列表)
        """
        warnings: List[str] = []
        errors: List[str] = []
        records: List[TrackingRecord] = []

        if not batch_id:
            batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        path = Path(file_path)
        if not path.exists():
            errors.append(f"文件不存在: {file_path}")
            return records, warnings, errors

        try:
            if path.suffix == ".csv":
                df = pd.read_csv(path)
            elif path.suffix in [".xlsx", ".xls"]:
                df = pd.read_excel(path)
            elif path.suffix == ".json":
                df = pd.read_json(path)
            else:
                errors.append(f"不支持的文件格式: {path.suffix}")
                return records, warnings, errors
        except Exception as e:
            errors.append(f"读取文件失败: {str(e)}")
            return records, warnings, errors

        required_cols = ["user_feedback_id", "user_id", "kb_link", "link_status"]
        missing_cols = [c for c in required_cols if c not in df.columns]
        if missing_cols:
            errors.append(f"缺少必要列: {', '.join(missing_cols)}")
            return records, warnings, errors

        for idx, row in df.iterrows():
            raw_line_number = idx + 2

            user_feedback_id = str(row.get("user_feedback_id", ""))
            if not user_feedback_id:
                warnings.append(f"第{raw_line_number}行: user_feedback_id为空，跳过")
                continue

            record_id = generate_id("rec")

            fragment = ModelOutputFragment(
                record_id=record_id,
                raw_line_number=raw_line_number,
                user_feedback_id=user_feedback_id,
                user_id=str(row.get("user_id", "")),
                kb_link=str(row.get("kb_link", "")),
                link_status=str(row.get("link_status", "")),
                confidence=float(row.get("confidence", 0.0)),
                raw_content=row.to_dict(),
                import_batch_id=batch_id,
            )

            log = EvidenceLog(
                log_id=generate_id("log"),
                record_id=record_id,
                action="import_model_output",
                operator="system",
                before_status=None,
                after_status=RecordStatus.IMPORTED,
                reason=f"从文件 {path.name} 第{raw_line_number}行导入模型输出",
                metadata={
                    "source_file": path.name,
                    "raw_line_number": raw_line_number,
                    "batch_id": batch_id,
                },
            )

            record = TrackingRecord(
                record_id=record_id,
                user_feedback_id=user_feedback_id,
                user_id=str(row.get("user_id", "")),
                kb_link=str(row.get("kb_link", "")),
                initial_model_fragment=fragment,
                evidence_logs=[log],
                status=RecordStatus.IMPORTED,
                current_link_status=str(row.get("link_status", "")),
            )

            records.append(record)
            self.imported_record_ids.add(record_id)
            self.imported_user_feedback_ids.add(user_feedback_id)

        self.import_history.append({
            "batch_id": batch_id,
            "file": str(path),
            "record_count": len(records),
            "timestamp": datetime.now(),
            "type": "model_output",
        })

        return records, warnings, errors

    def import_manual_judgments(
        self,
        file_path: str,
        existing_records: Dict[str, TrackingRecord],
        judge_name: str = "周姐",
    ) -> Tuple[List[str], List[str], List[str]]:
        """导入人工改判表，补录到现有记录中

        返回: (更新的记录ID列表, 警告列表, 错误列表)
        """
        warnings: List[str] = []
        errors: List[str] = []
        updated_record_ids: List[str] = []

        path = Path(file_path)
        if not path.exists():
            errors.append(f"文件不存在: {file_path}")
            return updated_record_ids, warnings, errors

        try:
            if path.suffix == ".csv":
                df = pd.read_csv(path)
            elif path.suffix in [".xlsx", ".xls"]:
                df = pd.read_excel(path)
            elif path.suffix == ".json":
                df = pd.read_json(path)
            else:
                errors.append(f"不支持的文件格式: {path.suffix}")
                return updated_record_ids, warnings, errors
        except Exception as e:
            errors.append(f"读取文件失败: {str(e)}")
            return updated_record_ids, warnings, errors

        required_cols = ["user_feedback_id", "judgment_result", "judgment_reason"]
        missing_cols = [c for c in required_cols if c not in df.columns]
        if missing_cols:
            errors.append(f"缺少必要列: {', '.join(missing_cols)}")
            return updated_record_ids, warnings, errors

        for idx, row in df.iterrows():
            raw_line_number = idx + 2

            user_feedback_id = str(row.get("user_feedback_id", ""))
            if not user_feedback_id:
                warnings.append(f"第{raw_line_number}行: user_feedback_id为空，跳过")
                continue

            matched_records = [
                r for r in existing_records.values()
                if r.user_feedback_id == user_feedback_id
            ]

            if not matched_records:
                warnings.append(
                    f"第{raw_line_number}行: 未找到匹配的记录 user_feedback_id={user_feedback_id}，创建新记录"
                )
                record_id = generate_id("rec")
                fragment = ModelOutputFragment(
                    record_id=record_id,
                    raw_line_number=raw_line_number,
                    user_feedback_id=user_feedback_id,
                    user_id=str(row.get("user_id", "")),
                    kb_link=str(row.get("kb_link", "")),
                    link_status=str(row.get("link_status", "")),
                    confidence=float(row.get("confidence", 0.0)),
                    raw_content=row.to_dict(),
                    import_batch_id=f"manual_{datetime.now().strftime('%Y%m%d')}",
                )
                record = TrackingRecord(
                    record_id=record_id,
                    user_feedback_id=user_feedback_id,
                    user_id=str(row.get("user_id", "")),
                    kb_link=str(row.get("kb_link", "")),
                    initial_model_fragment=fragment,
                    status=RecordStatus.IMPORTED,
                )
                existing_records[record_id] = record
                matched_records = [record]

            for record in matched_records:
                judgment = ManualJudgment(
                    judgment_id=generate_id("jud"),
                    record_id=record.record_id,
                    user_feedback_id=user_feedback_id,
                    user_id=record.user_id,
                    judge_name=judge_name,
                    judgment_result=str(row.get("judgment_result", "")),
                    judgment_reason=str(row.get("judgment_reason", "")),
                    judgment_timestamp=datetime.now(),
                    raw_line_number=raw_line_number,
                    raw_content=row.to_dict(),
                )

                record.manual_judgments.append(judgment)

                log = EvidenceLog(
                    log_id=generate_id("log"),
                    record_id=record.record_id,
                    action="add_manual_judgment",
                    operator=judge_name,
                    before_status=record.status,
                    after_status=RecordStatus.REVIEW_REQUIRED,
                    reason=f"补录人工改判，来自 {path.name} 第{raw_line_number}行",
                    metadata={
                        "source_file": path.name,
                        "raw_line_number": raw_line_number,
                        "judgment_result": judgment.judgment_result,
                    },
                )

                record.evidence_logs.append(log)
                record.status = RecordStatus.REVIEW_REQUIRED
                record.updated_at = datetime.now()
                record.review_by = judge_name

                updated_record_ids.append(record.record_id)

        self.import_history.append({
            "file": str(path),
            "updated_count": len(updated_record_ids),
            "timestamp": datetime.now(),
            "type": "manual_judgment",
            "judge_name": judge_name,
        })

        return updated_record_ids, warnings, errors
