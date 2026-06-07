"""统一数据存储和状态管理 - 单数据源，导出/页面/接口都读这里"""

import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

import pandas as pd

from .models import (
    TrackingRecord,
    RecordStatus,
    EvidenceLog,
    ProcessingResult,
    IssueType,
)
from .importer import generate_id


class UnifiedDataStore:
    """统一数据存储 - 唯一数据源"""

    def __init__(self, storage_dir: str = "./data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.records: Dict[str, TrackingRecord] = {}
        self.processing_history: List[Dict[str, Any]] = []

    def add_records(self, records: List[TrackingRecord]) -> None:
        """添加记录"""
        for record in records:
            self.records[record.record_id] = record

    def get_record(self, record_id: str) -> Optional[TrackingRecord]:
        """获取单条记录"""
        return self.records.get(record_id)

    def get_all_records(self) -> Dict[str, TrackingRecord]:
        """获取所有记录"""
        return self.records

    def get_records_by_status(self, status: RecordStatus) -> List[TrackingRecord]:
        """按状态获取记录"""
        return [r for r in self.records.values() if r.status == status]

    def get_records_by_issue(self, issue_type: IssueType) -> List[TrackingRecord]:
        """按问题类型获取记录"""
        return [r for r in self.records.values() if r.issue_type == issue_type]

    def get_duplicate_feedback_records(self) -> List[TrackingRecord]:
        """获取所有重复用户反馈的记录"""
        return [r for r in self.records.values() if r.is_duplicate_user_feedback]

    def update_record_status(
        self,
        record_id: str,
        new_status: RecordStatus,
        operator: str,
        reason: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """更新记录状态并记录日志"""
        record = self.records.get(record_id)
        if not record:
            return False

        log = EvidenceLog(
            log_id=generate_id("log"),
            record_id=record_id,
            action="update_status",
            operator=operator,
            before_status=record.status,
            after_status=new_status,
            reason=reason,
            metadata=metadata or {},
        )

        record.evidence_logs.append(log)
        record.status = new_status
        record.updated_at = datetime.now()

        if new_status in [RecordStatus.REVIEWED, RecordStatus.CONFIRMED]:
            record.review_by = operator
            record.review_timestamp = datetime.now()
            if metadata and "review_reason" in metadata:
                record.review_reason = metadata["review_reason"]

        return True

    def review_duplicate_record(
        self,
        record_id: str,
        operator: str,
        keep: bool,
        review_reason: str,
    ) -> bool:
        """复核重复用户反馈记录

        - 不急着归正常，留给标注负责人决定
        - keep=True: 保留该记录，标记为已复核
        - keep=False: 标记为拒绝，但保留记录用于复盘
        """
        record = self.records.get(record_id)
        if not record:
            return False

        new_status = RecordStatus.REVIEWED if keep else RecordStatus.REJECTED

        log = EvidenceLog(
            log_id=generate_id("log"),
            record_id=record_id,
            action="review_duplicate",
            operator=operator,
            before_status=record.status,
            after_status=new_status,
            reason=review_reason,
            metadata={
                "keep": keep,
                "original_issue_type": record.issue_type.value,
                "is_duplicate_user_feedback": record.is_duplicate_user_feedback,
            },
        )

        record.evidence_logs.append(log)
        record.status = new_status
        record.review_by = operator
        record.review_reason = review_reason
        record.review_timestamp = datetime.now()
        record.updated_at = datetime.now()

        return True

    def get_evidence_trail(self, record_id: str) -> List[Dict[str, Any]]:
        """获取单条记录的证据链"""
        record = self.records.get(record_id)
        if not record:
            return []

        trail = []

        trail.append({
            "type": "model_output",
            "raw_line_number": record.initial_model_fragment.raw_line_number,
            "import_batch_id": record.initial_model_fragment.import_batch_id,
            "content": record.initial_model_fragment.raw_content,
            "timestamp": record.initial_model_fragment.import_timestamp.isoformat(),
            "description": f"模型输出原始行号: {record.initial_model_fragment.raw_line_number}",
        })

        for idx, judgment in enumerate(record.manual_judgments):
            trail.append({
                "type": "manual_judgment",
                "judgment_index": idx + 1,
                "judge_name": judgment.judge_name,
                "judgment_result": judgment.judgment_result,
                "judgment_reason": judgment.judgment_reason,
                "raw_line_number": judgment.raw_line_number,
                "timestamp": judgment.judgment_timestamp.isoformat(),
                "description": (
                    f"人工改判 #{idx + 1}: {judgment.judge_name} "
                    f"判定为 {judgment.judgment_result}"
                ),
            })

        for log in record.evidence_logs:
            trail.append({
                "type": "status_change",
                "action": log.action,
                "operator": log.operator,
                "before_status": log.before_status.value if log.before_status else None,
                "after_status": log.after_status.value,
                "reason": log.reason,
                "timestamp": log.timestamp.isoformat(),
                "metadata": log.metadata,
                "description": (
                    f"{log.operator} 执行 {log.action}: "
                    f"{log.before_status.value if log.before_status else '初始'} → {log.after_status.value}"
                ),
            })

        trail.sort(key=lambda x: x["timestamp"])
        return trail

    def get_duplicate_group_detail(
        self,
        group_id: str,
    ) -> Dict[str, Any]:
        """获取重复用户反馈分组详情 - 用于证据回放"""
        group_records = [
            r for r in self.records.values()
            if r.duplicate_group_id == group_id
        ]

        if not group_records:
            return {}

        sample = group_records[0]

        detail = {
            "group_id": group_id,
            "user_feedback_id": sample.user_feedback_id,
            "record_count": len(group_records),
            "records": [],
        }

        for record in group_records:
            record_detail = {
                "record_id": record.record_id,
                "user_id": record.user_id,
                "kb_link": record.kb_link,
                "status": record.status.value,
                "review_by": record.review_by,
                "review_reason": record.review_reason,
                "review_timestamp": record.review_timestamp.isoformat() if record.review_timestamp else None,
                "raw_line_number": record.initial_model_fragment.raw_line_number,
                "import_batch_id": record.initial_model_fragment.import_batch_id,
                "evidence_trail": self.get_evidence_trail(record.record_id),
                "manual_judgments": [
                    {
                        "judge_name": j.judge_name,
                        "judgment_result": j.judgment_result,
                        "judgment_reason": j.judgment_reason,
                        "raw_line_number": j.raw_line_number,
                    }
                    for j in record.manual_judgments
                ],
            }
            detail["records"].append(record_detail)

        return detail

    def to_dataframe(self) -> pd.DataFrame:
        """导出为DataFrame - 统一数据源，页面展示、导出明细、接口返回都用这个"""
        records_list = [r.to_dict() for r in self.records.values()]
        if not records_list:
            return pd.DataFrame()
        return pd.DataFrame(records_list)

    def export_to_csv(self, file_path: str) -> str:
        """导出CSV - 从统一数据源输出"""
        df = self.to_dataframe()
        path = Path(file_path)
        df.to_csv(path, index=False, encoding="utf-8-sig")
        return str(path)

    def export_to_json(self, file_path: str) -> str:
        """导出JSON - 从统一数据源输出"""
        df = self.to_dataframe()
        path = Path(file_path)
        df.to_json(path, orient="records", force_ascii=False, indent=2)
        return str(path)

    def get_api_response(self) -> Dict[str, Any]:
        """获取API响应数据 - 从统一数据源输出"""
        df = self.to_dataframe()
        return {
            "data_source": "unified",
            "total": len(df),
            "records": df.to_dict(orient="records"),
            "export_timestamp": datetime.now().isoformat(),
        }

    def save_state(self, file_path: Optional[str] = None) -> str:
        """保存完整状态（含所有证据链）"""
        if not file_path:
            file_path = str(self.storage_dir / f"store_state_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl")

        state = {
            "records": self.records,
            "processing_history": self.processing_history,
            "saved_at": datetime.now(),
        }

        with open(file_path, "wb") as f:
            pickle.dump(state, f)

        return file_path

    def load_state(self, file_path: str) -> bool:
        """加载完整状态 - 用于复盘和重新跑"""
        try:
            with open(file_path, "rb") as f:
                state = pickle.load(f)
            self.records = state["records"]
            self.processing_history = state.get("processing_history", [])
            return True
        except Exception:
            return False

    def generate_review_summary(self) -> Dict[str, Any]:
        """生成复核总览"""
        total = len(self.records)
        duplicate_records = self.get_duplicate_feedback_records()
        review_required = self.get_records_by_status(RecordStatus.REVIEW_REQUIRED)
        reviewed = self.get_records_by_status(RecordStatus.REVIEWED)

        duplicate_groups: Dict[str, List[TrackingRecord]] = {}
        for r in duplicate_records:
            gid = r.duplicate_group_id or "ungrouped"
            if gid not in duplicate_groups:
                duplicate_groups[gid] = []
            duplicate_groups[gid].append(r)

        return {
            "total_records": total,
            "duplicate_user_feedback_count": len(duplicate_records),
            "duplicate_group_count": len(duplicate_groups),
            "review_required_count": len(review_required),
            "reviewed_count": len(reviewed),
            "duplicate_groups": [
                {
                    "group_id": gid,
                    "user_feedback_id": group[0].user_feedback_id if group else "",
                    "record_count": len(group),
                    "status": "pending_review" if any(r.status == RecordStatus.REVIEW_REQUIRED for r in group) else "reviewed",
                }
                for gid, group in duplicate_groups.items()
            ],
        }
