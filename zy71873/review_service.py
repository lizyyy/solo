import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
from dataclasses import asdict

from models import (
    PollutionRecord, RecordStatus, RecordRepository,
    AuditLogEntry, PendingQueueItem, IssueType
)


class StateTransitionError(Exception):
    pass


class StateEngine:
    def __init__(self, repo: RecordRepository):
        self.repo = repo
        self._init_transition_rules()
    
    def _init_transition_rules(self) -> None:
        self.allowed_transitions = {
            RecordStatus.DRAFT: [
                RecordStatus.NORMAL,
                RecordStatus.PENDING_REVIEW,
                RecordStatus.REJECTED,
                RecordStatus.ARCHIVED
            ],
            RecordStatus.NORMAL: [
                RecordStatus.PENDING_REVIEW,
                RecordStatus.REJECTED,
                RecordStatus.ARCHIVED
            ],
            RecordStatus.PENDING_REVIEW: [
                RecordStatus.NORMAL,
                RecordStatus.REJECTED,
                RecordStatus.ARCHIVED,
                RecordStatus.DRAFT
            ],
            RecordStatus.REJECTED: [
                RecordStatus.DRAFT,
                RecordStatus.ARCHIVED
            ],
            RecordStatus.ARCHIVED: [
                RecordStatus.DRAFT
            ]
        }
    
    def _generate_id(self) -> str:
        return str(uuid.uuid4())
    
    def _log_action(self, record_id: str, action: str,
                     old_status: Optional[RecordStatus],
                     new_status: Optional[RecordStatus],
                     changed_by: Optional[str],
                     reason: str,
                     changed_fields: Dict[str, Any] = None) -> None:
        log_entry = AuditLogEntry(
            log_id=self._generate_id(),
            record_id=record_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            change_reason=reason,
            changed_fields=changed_fields or {},
            timestamp=datetime.now()
        )
        self.repo.insert_audit_log(log_entry)
    
    def can_transition(self, current_status: RecordStatus, 
                       target_status: RecordStatus) -> bool:
        return target_status in self.allowed_transitions.get(current_status, [])
    
    def transition(self, record_id: str, target_status: RecordStatus,
                   changed_by: str, reason: str,
                   changed_fields: Dict[str, Any] = None,
                   action: str = "status_change") -> PollutionRecord:
        record = self.repo.get_record(record_id)
        if not record:
            raise StateTransitionError(f"记录不存在: {record_id}")
        
        old_status = record.status
        
        if not self.can_transition(old_status, target_status):
            raise StateTransitionError(
                f"不允许的状态流转: {old_status.value} -> {target_status.value}. "
                f"允许的流转: {[s.value for s in self.allowed_transitions.get(old_status, [])]}"
            )
        
        record.status = target_status
        record.updated_at = datetime.now()
        record.current_owner = changed_by
        self.repo.update_record(record)
        
        self._log_action(
            record_id=record_id,
            action=action,
            old_status=old_status,
            new_status=target_status,
            changed_by=changed_by,
            reason=reason,
            changed_fields=changed_fields or {}
        )
        
        return record
    
    def approve(self, record_id: str, approved_by: str, 
                reason: str = "审核通过") -> PollutionRecord:
        return self.transition(
            record_id=record_id,
            target_status=RecordStatus.NORMAL,
            changed_by=approved_by,
            reason=reason,
            action="approve"
        )
    
    def reject(self, record_id: str, rejected_by: str,
               reason: str) -> PollutionRecord:
        return self.transition(
            record_id=record_id,
            target_status=RecordStatus.REJECTED,
            changed_by=rejected_by,
            reason=reason,
            action="reject"
        )
    
    def send_to_review(self, record_id: str, sent_by: str,
                       reason: str) -> PollutionRecord:
        return self.transition(
            record_id=record_id,
            target_status=RecordStatus.PENDING_REVIEW,
            changed_by=sent_by,
            reason=reason,
            action="send_to_review"
        )
    
    def archive(self, record_id: str, archived_by: str,
                reason: str = "归档") -> PollutionRecord:
        return self.transition(
            record_id=record_id,
            target_status=RecordStatus.ARCHIVED,
            changed_by=archived_by,
            reason=reason,
            action="archive"
        )
    
    def redraft(self, record_id: str, redrafted_by: str,
                reason: str) -> PollutionRecord:
        return self.transition(
            record_id=record_id,
            target_status=RecordStatus.DRAFT,
            changed_by=redrafted_by,
            reason=reason,
            action="redraft"
        )


class ReviewService:
    def __init__(self, repo: RecordRepository, state_engine: StateEngine):
        self.repo = repo
        self.state_engine = state_engine
    
    def _generate_id(self) -> str:
        return str(uuid.uuid4())
    
    def _log_action(self, record_id: str, action: str,
                     old_status: Optional[RecordStatus],
                     new_status: Optional[RecordStatus],
                     changed_by: Optional[str],
                     reason: str,
                     changed_fields: Dict[str, Any] = None) -> None:
        log_entry = AuditLogEntry(
            log_id=self._generate_id(),
            record_id=record_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            change_reason=reason,
            changed_fields=changed_fields or {},
            timestamp=datetime.now()
        )
        self.repo.insert_audit_log(log_entry)
    
    def get_pending_queue(self, issue_type: Optional[IssueType] = None) -> List[Dict[str, Any]]:
        pending_items = self.repo.get_pending_items(active_only=True)
        
        if issue_type:
            pending_items = [
                item for item in pending_items
                if item.issue_type == issue_type
            ]
        
        result = []
        for item in pending_items:
            record = self.repo.get_record(item.record_id)
            source = self.repo.get_data_source(record.source_id) if record else None
            
            result.append({
                "queue_item": asdict(item),
                "record": asdict(record) if record else None,
                "source": asdict(source) if source else None
            })
        
        return result
    
    def get_record_review_history(self, record_id: str) -> List[Dict[str, Any]]:
        audit_log = self.repo.get_audit_log(record_id)
        pending_items = self.repo.get_pending_items_for_record(record_id, active_only=False)
        
        review_actions = []
        
        for entry in audit_log:
            if entry.action in ["create", "approve", "reject", "send_to_review", "mark_pending", "resolve_pending", "auto_approve", "manual_correction", "late_attachment", "duplicate_detected", "status_change", "redraft", "archive"]:
                review_actions.append({
                    "type": "audit",
                    "action": entry.action,
                    "timestamp": entry.timestamp.isoformat(),
                    "by": entry.changed_by,
                    "reason": entry.change_reason,
                    "old_status": entry.old_status.value if entry.old_status else None,
                    "new_status": entry.new_status.value if entry.new_status else None,
                    "details": entry.changed_fields
                })
        
        for item in pending_items:
            review_actions.append({
                "type": "pending",
                "issue_type": item.issue_type.value,
                "detected_at": item.detected_at.isoformat(),
                "is_active": item.is_active,
                "reviewed_by": item.reviewed_by,
                "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
                "resolution": item.resolution,
                "description": item.issue_description,
                "review_reason": item.review_reason
            })
        
        review_actions.sort(key=lambda x: x.get("timestamp") or x.get("detected_at"))
        return review_actions
    
    def resolve_pending_issue(self, queue_id: str, reviewed_by: str,
                              resolution: str, accept: bool,
                              resolution_details: Dict[str, Any] = None) -> None:
        pending_items = self.repo.get_pending_items(active_only=True)
        item = next((i for i in pending_items if i.queue_id == queue_id), None)
        
        if not item:
            raise ValueError(f"待处理项不存在或已处理: {queue_id}")
        
        self.repo.resolve_pending_item(queue_id, reviewed_by, resolution)
        
        self._log_action(
            record_id=item.record_id,
            action="resolve_pending",
            old_status=None,
            new_status=None,
            changed_by=reviewed_by,
            reason=f"处理{issue_type_description(item.issue_type)}: {resolution}",
            changed_fields={
                "queue_id": queue_id,
                "issue_type": item.issue_type.value,
                "accepted": accept,
                "resolution": resolution,
                "details": resolution_details or {}
            }
        )
        
        record = self.repo.get_record(item.record_id)
        if not record:
            return
        
        active_pending = self.repo.get_pending_items_for_record(
            item.record_id, active_only=True
        )
        
        if not active_pending and record.status == RecordStatus.PENDING_REVIEW:
            if accept:
                self.state_engine.approve(
                    record_id=item.record_id,
                    approved_by=reviewed_by,
                    reason=f"所有待处理问题已解决，通过审核。最后处理: {resolution}"
                )
            else:
                self.state_engine.reject(
                    record_id=item.record_id,
                    rejected_by=reviewed_by,
                    reason=f"复核不通过: {resolution}"
                )
        elif not active_pending and record.status == RecordStatus.DRAFT:
            if accept:
                self.state_engine.approve(
                    record_id=item.record_id,
                    approved_by=reviewed_by,
                    reason=f"所有待处理问题已解决，通过审核"
                )
    
    def review_and_resolve_all(self, record_id: str, reviewed_by: str,
                                accept: bool, resolution: str,
                                per_issue_resolutions: Dict[str, str] = None) -> None:
        pending_items = self.repo.get_pending_items_for_record(
            record_id, active_only=True
        )
        
        if not pending_items:
            raise ValueError(f"记录{record_id}没有待处理的问题")
        
        per_issue_resolutions = per_issue_resolutions or {}
        
        for item in pending_items:
            issue_resolution = per_issue_resolutions.get(
                item.queue_id, resolution
            )
            self.resolve_pending_issue(
                queue_id=item.queue_id,
                reviewed_by=reviewed_by,
                resolution=issue_resolution,
                accept=accept
            )
    
    def get_review_summary(self) -> Dict[str, Any]:
        all_pending = self.repo.get_pending_items(active_only=True)
        all_records = self.repo.get_records_by_criteria()
        
        summary = {
            "total_records": len(all_records),
            "by_status": {},
            "pending_count": len(all_pending),
            "pending_by_type": {},
            "pending_by_age": {
                "0_1_days": 0,
                "1_3_days": 0,
                "3_7_days": 0,
                "over_7_days": 0
            }
        }
        
        for status in RecordStatus:
            count = len([r for r in all_records if r.status == status])
            if count > 0:
                summary["by_status"][status.value] = count
        
        for item in all_pending:
            itype = item.issue_type.value
            summary["pending_by_type"][itype] = summary["pending_by_type"].get(itype, 0) + 1
            
            age_days = (datetime.now() - item.detected_at).days
            if age_days < 1:
                summary["pending_by_age"]["0_1_days"] += 1
            elif age_days < 3:
                summary["pending_by_age"]["1_3_days"] += 1
            elif age_days < 7:
                summary["pending_by_age"]["3_7_days"] += 1
            else:
                summary["pending_by_age"]["over_7_days"] += 1
        
        return summary
    
    def get_controversial_records(self, min_issues: int = 2) -> List[Dict[str, Any]]:
        all_pending = self.repo.get_pending_items(active_only=False)
        
        record_issue_counts: Dict[str, int] = {}
        for item in all_pending:
            record_issue_counts[item.record_id] = record_issue_counts.get(item.record_id, 0) + 1
        
        controversial_ids = [
            rid for rid, count in record_issue_counts.items()
            if count >= min_issues
        ]
        
        result = []
        for rid in controversial_ids:
            record = self.repo.get_record(rid)
            if not record:
                continue
            
            issues = self.repo.get_pending_items_for_record(rid, active_only=False)
            audit_log = self.repo.get_audit_log(rid)
            source = self.repo.get_data_source(record.source_id)
            
            result.append({
                "record_id": rid,
                "issue_count": len(issues),
                "active_issue_count": len([i for i in issues if i.is_active]),
                "status": record.status.value,
                "location": record.location,
                "pollutant": record.pollutant,
                "value": record.value,
                "unit": record.unit,
                "sample_time": record.sample_time.isoformat(),
                "source": asdict(source) if source else None,
                "issues": [asdict(i) for i in issues],
                "audit_log_count": len(audit_log),
                "constraints": record.constraints,
                "overridden_constraints": record.overridden_constraints
            })
        
        result.sort(key=lambda x: x["issue_count"], reverse=True)
        return result


def issue_type_description(issue_type: IssueType) -> str:
    descriptions = {
        IssueType.UNIT_MISMATCH: "单位混用",
        IssueType.CONSTRAINT_OVERRIDDEN: "约束被覆盖",
        IssueType.RESULT_DRIFT: "结果漂移",
        IssueType.DUPLICATE: "重复记录",
        IssueType.LATE_ATTACHMENT: "晚到附件",
        IssueType.MANUAL_CORRECTION: "人工更正"
    }
    return descriptions.get(issue_type, issue_type.value)
