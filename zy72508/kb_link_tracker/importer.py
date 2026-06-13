"""数据导入模块 - 处理模型输出片段和人工改判表导入"""

import json
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional, Set

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
        self.imported_record_ids: Set[str] = set()
        self._existing_content_keys: Dict[str, str] = {}

    def import_model_output(
        self,
        file_path: str,
        existing_records: Optional[Dict[str, TrackingRecord]] = None,
        batch_id: Optional[str] = None,
    ) -> Tuple[List[TrackingRecord], List[str], List[str]]:
        """导入模型输出片段

        同一批数据第二次导入时，标记哪些是复用记录、哪些是真新增。
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

        if existing_records:
            for rid, r in existing_records.items():
                key = f"{r.user_feedback_id}|{r.kb_link}|{r.user_id}|{r.initial_model_fragment.raw_line_number}"
                self._existing_content_keys[key] = rid

        for idx, row in df.iterrows():
            raw_line_number = idx + 2

            user_feedback_id = str(row.get("user_feedback_id", ""))
            if not user_feedback_id:
                warnings.append(f"第{raw_line_number}行: user_feedback_id为空，跳过")
                continue

            content_key = f"{user_feedback_id}|{row.get('kb_link', '')}|{row.get('user_id', '')}|{raw_line_number}"

            is_reimport = False
            reimport_source_record_id = None

            if existing_records:
                existing_rid = self._existing_content_keys.get(content_key)
                if existing_rid:
                    is_reimport = True
                    reimport_source_record_id = existing_rid
                    warnings.append(
                        f"第{raw_line_number}行: 复用已有记录 {existing_rid} "
                        f"(user_feedback_id={user_feedback_id}, kb_link={row.get('kb_link', '')})"
                    )
                else:
                    partial_key = f"{user_feedback_id}|{row.get('kb_link', '')}|{row.get('user_id', '')}"
                    partial_matches = [
                        k for k in self._existing_content_keys
                        if k.startswith(partial_key + "|")
                    ]
                    if partial_matches:
                        warnings.append(
                            f"第{raw_line_number}行: 同一 user_feedback_id+kb_link+user_id 已有记录，"
                            f"本条为真新增（行号不同）"
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
                    "is_reimport": is_reimport,
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
                is_reimport=is_reimport,
                reimport_source_record_id=reimport_source_record_id,
            )

            if is_reimport:
                record.manual_judgment_summary = f"复用记录，源记录: {reimport_source_record_id}"

            records.append(record)
            self.imported_record_ids.add(record_id)
            self._existing_content_keys[content_key] = record_id

        self.import_history.append({
            "batch_id": batch_id,
            "file": str(path),
            "record_count": len(records),
            "reimport_count": sum(1 for r in records if r.is_reimport),
            "new_count": sum(1 for r in records if not r.is_reimport),
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

        核心修复: 每条人工改判必须精确匹配到**一条**记录。
        匹配策略:
          1. user_feedback_id + kb_link 完全一致 → 按顺序分配给未匹配的记录
          2. user_feedback_id 一致但 kb_link 不同 → 按 kb_link 精确匹配
          3. 无匹配 → 创建新记录
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

        feedback_to_records: Dict[str, List[TrackingRecord]] = defaultdict(list)
        for r in existing_records.values():
            feedback_to_records[r.user_feedback_id].append(r)

        matched_record_ids: Set[str] = set()

        for idx, row in df.iterrows():
            raw_line_number = idx + 2

            user_feedback_id = str(row.get("user_feedback_id", ""))
            if not user_feedback_id:
                warnings.append(f"第{raw_line_number}行: user_feedback_id为空，跳过")
                continue

            judgment_kb_link = str(row.get("kb_link", ""))

            candidates = feedback_to_records.get(user_feedback_id, [])

            target_record = None

            if candidates:
                kb_matched = [
                    r for r in candidates
                    if r.kb_link == judgment_kb_link
                ]

                unmatched_kb = [
                    r for r in kb_matched
                    if r.record_id not in matched_record_ids
                ]

                if unmatched_kb:
                    target_record = unmatched_kb[0]
                elif kb_matched:
                    warnings.append(
                        f"第{raw_line_number}行: user_feedback_id={user_feedback_id} "
                        f"kb_link={judgment_kb_link} 的记录已全部匹配过改判，"
                        f"本条改判追加到最后一条匹配记录"
                    )
                    target_record = kb_matched[-1]
                else:
                    unmatched_any = [
                        r for r in candidates
                        if r.record_id not in matched_record_ids
                    ]
                    if unmatched_any:
                        target_record = unmatched_any[0]
                    else:
                        target_record = candidates[-1]
                        warnings.append(
                            f"第{raw_line_number}行: user_feedback_id={user_feedback_id} "
                            f"所有记录均已匹配过改判，本条追加到最后一条"
                        )

            if not target_record:
                warnings.append(
                    f"第{raw_line_number}行: 未找到匹配的记录 "
                    f"user_feedback_id={user_feedback_id}，创建新记录"
                )
                record_id = generate_id("rec")
                fragment = ModelOutputFragment(
                    record_id=record_id,
                    raw_line_number=raw_line_number,
                    user_feedback_id=user_feedback_id,
                    user_id=str(row.get("user_id", "")),
                    kb_link=judgment_kb_link,
                    link_status=str(row.get("link_status", "")),
                    confidence=float(row.get("confidence", 0.0)),
                    raw_content=row.to_dict(),
                    import_batch_id=f"manual_{datetime.now().strftime('%Y%m%d')}",
                )
                record = TrackingRecord(
                    record_id=record_id,
                    user_feedback_id=user_feedback_id,
                    user_id=str(row.get("user_id", "")),
                    kb_link=judgment_kb_link,
                    initial_model_fragment=fragment,
                    status=RecordStatus.IMPORTED,
                )
                existing_records[record_id] = record
                feedback_to_records[user_feedback_id].append(record)
                target_record = record

            matched_record_ids.add(target_record.record_id)

            judgment = ManualJudgment(
                judgment_id=generate_id("jud"),
                record_id=target_record.record_id,
                user_feedback_id=user_feedback_id,
                user_id=target_record.user_id,
                judge_name=judge_name,
                judgment_result=str(row.get("judgment_result", "")),
                judgment_reason=str(row.get("judgment_reason", "")),
                judgment_timestamp=datetime.now(),
                raw_line_number=raw_line_number,
                raw_content=row.to_dict(),
            )

            target_record.manual_judgments.append(judgment)

            target_record.manual_judgment_summary = "; ".join(
                f"{j.judgment_result}({j.judgment_reason[:20]})"
                for j in target_record.manual_judgments
            )

            log = EvidenceLog(
                log_id=generate_id("log"),
                record_id=target_record.record_id,
                action="add_manual_judgment",
                operator=judge_name,
                before_status=target_record.status,
                after_status=RecordStatus.REVIEW_REQUIRED,
                reason=f"补录人工改判，来自 {path.name} 第{raw_line_number}行",
                metadata={
                    "source_file": path.name,
                    "raw_line_number": raw_line_number,
                    "judgment_result": judgment.judgment_result,
                    "judgment_reason": judgment.judgment_reason,
                    "matched_kb_link": judgment_kb_link,
                },
            )

            target_record.evidence_logs.append(log)
            target_record.status = RecordStatus.REVIEW_REQUIRED
            target_record.updated_at = datetime.now()
            target_record.review_by = judge_name

            updated_record_ids.append(target_record.record_id)

        self.import_history.append({
            "file": str(path),
            "updated_count": len(updated_record_ids),
            "timestamp": datetime.now(),
            "type": "manual_judgment",
            "judge_name": judge_name,
        })

        return updated_record_ids, warnings, errors
