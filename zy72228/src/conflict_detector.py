import uuid
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from .models import (
    CounterFlow,
    MarginRecord,
    ConflictRecord,
    ApprovalStatus,
    SettlementType
)
from .importer import DataImporter


@dataclass
class ConflictEvidence:
    flow_id: str
    counter_tail: str
    email_tail: str
    counter_amount: float
    email_amount: Optional[float]
    email_remark: str
    trade_date: date


class ConflictDetector:
    def __init__(self, importer: Optional[DataImporter] = None):
        self.importer = importer or DataImporter()
        self.conflicts: List[ConflictRecord] = []
        self.resolved_conflicts: Dict[str, ConflictRecord] = {}

    def detect_conflicts(
        self,
        flows: List[CounterFlow],
        records: List[MarginRecord]
    ) -> List[ConflictRecord]:
        new_conflicts = []
        
        flow_map = {flow.flow_id: flow for flow in flows}
        
        for record in records:
            if not record.email_remark:
                continue
            
            if record.linked_flow_id:
                flow = flow_map.get(record.linked_flow_id)
                if flow:
                    conflict = self._check_single_flow_vs_email(flow, record)
                    if conflict:
                        new_conflicts.append(conflict)
            
            email_tails = self.importer.parse_tail_from_email(record.email_remark)
            email_amounts = self.importer.parse_amount_from_email(record.email_remark)
            
            for flow in flows:
                if flow.flow_id == record.linked_flow_id:
                    continue
                
                for email_tail in email_tails:
                    if self._tails_conflict(flow.flow_tail, email_tail):
                        conflict = self._create_conflict_record(
                            flow, record, email_tail,
                            email_amounts[0] if email_amounts else None
                        )
                        if not self._is_duplicate_conflict(conflict, new_conflicts):
                            new_conflicts.append(conflict)
        
        self.conflicts.extend(new_conflicts)
        return new_conflicts

    def _check_single_flow_vs_email(
        self,
        flow: CounterFlow,
        record: MarginRecord
    ) -> Optional[ConflictRecord]:
        email_tails = self.importer.parse_tail_from_email(record.email_remark)
        email_amounts = self.importer.parse_amount_from_email(record.email_remark)
        
        if not email_tails:
            return None
        
        has_conflict = any(self._tails_conflict(flow.flow_tail, et) for et in email_tails)
        
        if has_conflict:
            email_amount = email_amounts[0] if email_amounts else None
            email_tail = next((et for et in email_tails if self._tails_conflict(flow.flow_tail, et)), email_tails[0])
            return self._create_conflict_record(flow, record, email_tail, email_amount)
        
        return None

    def _tails_conflict(self, counter_tail: str, email_tail: str) -> bool:
        ct = counter_tail.strip()
        et = email_tail.strip()
        
        if ct == et:
            return False
        
        min_len = min(len(ct), len(et))
        if ct[-min_len:] == et[-min_len:]:
            return False
        
        return True

    def _create_conflict_record(
        self,
        flow: CounterFlow,
        record: MarginRecord,
        email_tail: str,
        email_amount: Optional[float]
    ) -> ConflictRecord:
        conflict_id = f"CONF{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"
        return ConflictRecord(
            conflict_id=conflict_id,
            trade_date=flow.trade_date,
            flow_id=flow.flow_id,
            flow_tail_counter=flow.flow_tail,
            flow_tail_email=email_tail,
            counter_amount=flow.amount,
            email_amount=email_amount,
            email_remark=record.email_remark,
            resolution=ApprovalStatus.PENDING
        )

    def _is_duplicate_conflict(
        self,
        conflict: ConflictRecord,
        existing: List[ConflictRecord]
    ) -> bool:
        for c in existing:
            if (c.flow_id == conflict.flow_id and
                c.flow_tail_email == conflict.flow_tail_email):
                return True
        return False

    def get_conflict_evidence(self, conflict: ConflictRecord) -> Dict[str, str]:
        return {
            "交易日期": conflict.trade_date.strftime('%Y-%m-%d'),
            "流水号": conflict.flow_id,
            "柜台流水尾号": conflict.flow_tail_counter,
            "邮件备注尾号": conflict.flow_tail_email,
            "柜台金额": f"{conflict.counter_amount:,.2f}",
            "邮件金额": f"{conflict.email_amount:,.2f}" if conflict.email_amount else "未识别",
            "邮件备注原文": conflict.email_remark,
            "发现时间": conflict.detected_time.strftime('%Y-%m-%d %H:%M:%S')
        }

    def format_conflict_for_user(self, conflict: ConflictRecord) -> str:
        evidence = self.get_conflict_evidence(conflict)
        lines = [
            "=" * 50,
            f"⚠️  冲突发现 - {conflict.conflict_id}",
            "=" * 50,
            f"📅 交易日期: {evidence['交易日期']}",
            f"🔢 流水号: {evidence['流水号']}",
            "",
            "❌ 尾号不一致:",
            f"   柜台系统尾号: {evidence['柜台流水尾号']}",
            f"   邮件备注尾号: {evidence['邮件备注尾号']}",
            "",
            "💰 金额对比:",
            f"   柜台金额: {evidence['柜台金额']}",
            f"   邮件金额: {evidence['邮件金额']}",
            "",
            "📧 客户经理邮件备注原文:",
            f"   {conflict.email_remark}",
            "",
            "请基金会计林姐确认:",
            "   [1] 确认 - 以柜台系统为准",
            "   [2] 驳回 - 以邮件备注为准",
            "=" * 50
        ]
        return "\n".join(lines)

    def resolve_conflict(
        self,
        conflict_id: str,
        resolution: ApprovalStatus,
        resolved_by: str,
        resolution_note: str = ""
    ) -> bool:
        for conflict in self.conflicts:
            if conflict.conflict_id == conflict_id:
                conflict.resolution = resolution
                conflict.resolved_by = resolved_by
                conflict.resolved_time = datetime.now()
                conflict.resolution_note = resolution_note
                self.resolved_conflicts[conflict_id] = conflict
                return True
        return False

    def get_pending_conflicts(self) -> List[ConflictRecord]:
        return [c for c in self.conflicts if c.resolution == ApprovalStatus.PENDING]

    def get_conflicts_by_date(
        self,
        trade_date: date
    ) -> List[ConflictRecord]:
        return [c for c in self.conflicts if c.trade_date == trade_date]

    def detect_amount_mismatch(
        self,
        flows: List[CounterFlow],
        records: List[MarginRecord]
    ) -> List[Dict[str, any]]:
        mismatches = []
        flow_map = {flow.flow_id: flow for flow in flows}
        
        for record in records:
            if not record.linked_flow_id or record.amount == 0:
                continue
            
            flow = flow_map.get(record.linked_flow_id)
            if not flow:
                continue
            
            if abs(flow.amount - record.amount) > 0.01:
                mismatches.append({
                    "type": "金额不一致",
                    "flow_id": flow.flow_id,
                    "flow_amount": flow.amount,
                    "record_amount": record.amount,
                    "difference": flow.amount - record.amount,
                    "trade_date": flow.trade_date,
                    "email_remark": record.email_remark
                })
        
        return mismatches

    def detect_settlement_change(
        self,
        original_flows: List[CounterFlow],
        modified_flows: List[CounterFlow]
    ) -> List[Dict[str, any]]:
        changes = []
        original_map = {f.flow_id: f for f in original_flows}
        
        for modified in modified_flows:
            original = original_map.get(modified.flow_id)
            if not original:
                continue
            
            if (original.settlement_type == SettlementType.T1 and
                modified.settlement_type == SettlementType.T2 and
                modified.is_manual_modified):
                changes.append({
                    "type": "T+1改为T+2",
                    "flow_id": modified.flow_id,
                    "original_settlement": original.settlement_type.value,
                    "modified_settlement": modified.settlement_type.value,
                    "modified_by": modified.modified_by,
                    "modified_time": modified.modified_time,
                    "trade_date": modified.trade_date,
                    "needs_review": True
                })
        
        return changes

    def get_conflict_summary(self) -> Dict[str, int]:
        return {
            "总冲突数": len(self.conflicts),
            "待确认": len(self.get_pending_conflicts()),
            "已确认": sum(1 for c in self.conflicts if c.resolution == ApprovalStatus.APPROVED),
            "已驳回": sum(1 for c in self.conflicts if c.resolution == ApprovalStatus.REJECTED)
        }
