import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models import (
    ReviewSample, QualityInspection, CustomerServiceDialog,
    KnowledgeBaseEntry, ChangeHistory, FilterCondition
)
from config import DATA_SOURCE_TYPES, CHANGE_TYPES


class TraceService:
    @staticmethod
    def get_sample_trace(db: Session, sample_id: int) -> Dict[str, Any]:
        sample = db.query(ReviewSample).filter(ReviewSample.id == sample_id).first()
        if not sample:
            raise ValueError(f"Sample {sample_id} not found")

        data_sources = []
        data_timeline = []

        if sample.inspection:
            data_sources.append({
                "source_type": "QUALITY_FORM",
                "source_name": DATA_SOURCE_TYPES["QUALITY_FORM"],
                "source_id": sample.inspection.id,
                "source_no": sample.inspection.inspection_no,
                "link": f"/api/quality-inspections/{sample.inspection.id}",
                "details": {
                    "inspector": sample.inspection.inspector,
                    "inspection_time": sample.inspection.inspection_time.isoformat() if sample.inspection.inspection_time else None,
                    "is_late_submit": sample.inspection.is_late_submit,
                    "submit_time": sample.inspection.submit_time.isoformat() if sample.inspection.submit_time else None,
                    "content": sample.inspection.content,
                }
            })
            if sample.inspection.is_late_submit:
                data_timeline.append({
                    "event_time": sample.inspection.submit_time.isoformat() if sample.inspection.submit_time else None,
                    "event_type": "LATE_SUBMIT",
                    "event_name": "质检表晚交",
                    "source": DATA_SOURCE_TYPES["QUALITY_FORM"],
                    "source_id": sample.inspection.id,
                })

        if sample.dialog:
            data_sources.append({
                "source_type": "CUSTOMER_SERVICE",
                "source_name": DATA_SOURCE_TYPES["CUSTOMER_SERVICE"],
                "source_id": sample.dialog.id,
                "source_no": sample.dialog.dialog_id,
                "link": f"/api/customer-dialogs/{sample.dialog.id}",
                "details": {
                    "agent_id": sample.dialog.agent_id,
                    "start_time": sample.dialog.start_time.isoformat() if sample.dialog.start_time else None,
                    "end_time": sample.dialog.end_time.isoformat() if sample.dialog.end_time else None,
                    "is_late_supplement": sample.dialog.is_late_supplement,
                    "supplement_time": sample.dialog.supplement_time.isoformat() if sample.dialog.supplement_time else None,
                    "content": sample.dialog.content,
                }
            })
            if sample.dialog.is_late_supplement:
                data_timeline.append({
                    "event_time": sample.dialog.supplement_time.isoformat() if sample.dialog.supplement_time else None,
                    "event_type": "LATE_SUPPLEMENT",
                    "event_name": "客服对话晚补",
                    "source": DATA_SOURCE_TYPES["CUSTOMER_SERVICE"],
                    "source_id": sample.dialog.id,
                })

        if sample.knowledge_entry:
            data_sources.append({
                "source_type": "KNOWLEDGE_BASE",
                "source_name": DATA_SOURCE_TYPES["KNOWLEDGE_BASE"],
                "source_id": sample.knowledge_entry.id,
                "source_no": sample.knowledge_entry.entry_id,
                "link": f"/api/knowledge-entries/{sample.knowledge_entry.id}",
                "details": {
                    "title": sample.knowledge_entry.title,
                    "category": sample.knowledge_entry.category,
                    "version": sample.knowledge_entry.version,
                    "is_manual_modified": sample.knowledge_entry.is_manual_modified,
                    "modified_time": sample.knowledge_entry.modified_time.isoformat() if sample.knowledge_entry.modified_time else None,
                    "modifier": sample.knowledge_entry.modifier,
                    "content": sample.knowledge_entry.content,
                }
            })
            if sample.knowledge_entry.is_manual_modified:
                data_timeline.append({
                    "event_time": sample.knowledge_entry.modified_time.isoformat() if sample.knowledge_entry.modified_time else None,
                    "event_type": "MANUAL_MODIFY",
                    "event_name": "知识库手工改动",
                    "source": DATA_SOURCE_TYPES["KNOWLEDGE_BASE"],
                    "source_id": sample.knowledge_entry.id,
                })

        change_history = []
        for ch in sample.change_histories:
            change_history.append({
                "id": ch.id,
                "change_type": ch.change_type,
                "change_type_name": CHANGE_TYPES.get(ch.change_type, ch.change_type),
                "field_name": ch.field_name,
                "old_value": ch.old_value,
                "new_value": ch.new_value,
                "operator": ch.operator,
                "operation_time": ch.operation_time.isoformat(),
                "remark": ch.remark,
                "change_source": ch.change_source,
                "version_hash": ch.version_hash,
            })

        data_timeline.sort(key=lambda x: x["event_time"] or "")

        return {
            "sample_id": sample.id,
            "conclusion": sample.conclusion,
            "evidence_summary": sample.evidence_summary,
            "is_anomaly": sample.is_anomaly,
            "anomaly_type": sample.anomaly_type,
            "review_status": sample.review_status,
            "data_sources": data_sources,
            "change_history": change_history,
            "data_timeline": data_timeline,
        }

    @staticmethod
    def check_sensitive_data_anomaly(db: Session, sample_id: int) -> Dict[str, Any]:
        trace = TraceService.get_sample_trace(db, sample_id)

        sensitive_words = ["身份证", "手机号", "银行卡", "住址", "密码", "验证码"]
        sensitive_found = []

        for source in trace["data_sources"]:
            content = source.get("details", {}).get("content", {})
            if isinstance(content, str):
                for word in sensitive_words:
                    if word in content:
                        sensitive_found.append({
                            "source": source["source_name"],
                            "field": "content",
                            "sensitive_word": word,
                        })
            elif isinstance(content, dict):
                for key, value in content.items():
                    if isinstance(value, str):
                        for word in sensitive_words:
                            if word in value:
                                sensitive_found.append({
                                    "source": source["source_name"],
                                    "field": key,
                                    "sensitive_word": word,
                                })

        is_anomaly = len(sensitive_found) > 0
        manual_fix_count = sum(
            1 for ch in trace["change_history"]
            if ch["change_type"] == "DATA_CORRECTION" and "脱敏" in (ch["remark"] or "")
        )

        return {
            "is_anomaly": is_anomaly,
            "anomaly_type": "SENSITIVE_DATA_LEAK" if is_anomaly else None,
            "sensitive_findings": sensitive_found,
            "manual_fix_count": manual_fix_count,
            "is_exception": is_anomaly and manual_fix_count == 0,
            "judgment": "敏感词漏脱敏属于异常" if is_anomaly and manual_fix_count == 0 
                       else "敏感词已通过手工修正，不算异常" if manual_fix_count > 0 
                       else "未发现敏感词",
        }
