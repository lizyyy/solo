from datetime import datetime, date
from typing import List, Dict, Optional, Callable
from .models import (
    MarginRecord,
    CounterFlow,
    ConflictRecord,
    ApprovalStatus,
    SettlementType
)


class ApprovalFlow:
    def __init__(self):
        self.pending_approvals: List[Dict[str, any]] = []
        self.approval_history: List[Dict[str, any]] = []
        self.on_approval_callback: Optional[Callable] = None

    def submit_for_approval(
        self,
        record: MarginRecord,
        conflict: Optional[ConflictRecord] = None,
        flow: Optional[CounterFlow] = None
    ) -> Dict[str, any]:
        approval_item = {
            "record_id": record.record_id,
            "record": record,
            "conflict": conflict,
            "flow": flow,
            "submit_time": datetime.now(),
            "approver": "林姐",
            "status": ApprovalStatus.PENDING,
            "type": self._determine_approval_type(record, conflict, flow)
        }
        self.pending_approvals.append(approval_item)
        return approval_item

    def _determine_approval_type(
        self,
        record: MarginRecord,
        conflict: Optional[ConflictRecord],
        flow: Optional[CounterFlow]
    ) -> str:
        if conflict:
            return "尾号冲突确认"
        if flow and flow.is_manual_modified and flow.settlement_type == SettlementType.T2:
            return "手工改T+2复核"
        if record.source.value == "补录材料":
            return "补录材料确认"
        return "常规审批"

    def get_pending_approvals(self, approver: str = None) -> List[Dict[str, any]]:
        pending = [a for a in self.pending_approvals if a["status"] == ApprovalStatus.PENDING]
        if approver:
            pending = [a for a in pending if a["approver"] == approver]
        return pending

    def approve_by_linjie(
        self,
        record_id: str,
        approval_note: str = ""
    ) -> bool:
        for item in self.pending_approvals:
            if item["record_id"] == record_id and item["approver"] == "林姐":
                item["status"] = ApprovalStatus.APPROVED
                item["approved_by"] = "林姐"
                item["approved_time"] = datetime.now()
                item["approval_note"] = approval_note
                
                record = item["record"]
                record.approval_status = ApprovalStatus.APPROVED
                record.approved_by = "林姐"
                record.approved_time = datetime.now()
                
                if item["type"] == "手工改T+2复核":
                    item["status"] = ApprovalStatus.PENDING_REVIEW
                    item["approver"] = "基金经理"
                    record.approval_status = ApprovalStatus.PENDING_REVIEW
                    self._record_history(item)
                    return True
                
                self._record_history(item)
                if self.on_approval_callback:
                    self.on_approval_callback(record, "approved")
                return True
        return False

    def reject_by_linjie(
        self,
        record_id: str,
        reject_reason: str
    ) -> bool:
        for item in self.pending_approvals:
            if item["record_id"] == record_id and item["approver"] == "林姐":
                item["status"] = ApprovalStatus.REJECTED
                item["approved_by"] = "林姐"
                item["approved_time"] = datetime.now()
                item["reject_reason"] = reject_reason
                
                record = item["record"]
                record.approval_status = ApprovalStatus.REJECTED
                record.approved_by = "林姐"
                record.approved_time = datetime.now()
                
                self._record_history(item)
                if self.on_approval_callback:
                    self.on_approval_callback(record, "rejected")
                return True
        return False

    def review_by_manager(
        self,
        record_id: str,
        approved: bool,
        review_note: str = ""
    ) -> bool:
        for item in self.pending_approvals:
            if (item["record_id"] == record_id and
                item["approver"] == "基金经理" and
                item["status"] == ApprovalStatus.PENDING_REVIEW):
                
                if approved:
                    item["status"] = ApprovalStatus.REVIEWED
                    item["approved_by"] = "基金经理"
                    item["approved_time"] = datetime.now()
                    item["review_note"] = review_note
                    
                    record = item["record"]
                    record.approval_status = ApprovalStatus.REVIEWED
                    record.approved_by = "基金经理"
                    record.approved_time = datetime.now()
                else:
                    item["status"] = ApprovalStatus.REJECTED
                    item["approved_by"] = "基金经理"
                    item["approved_time"] = datetime.now()
                    item["reject_reason"] = review_note
                    
                    record = item["record"]
                    record.approval_status = ApprovalStatus.REJECTED
                
                self._record_history(item)
                if self.on_approval_callback:
                    self.on_approval_callback(record, "reviewed" if approved else "rejected")
                return True
        return False

    def _record_history(self, item: Dict[str, any]):
        self.approval_history.append({
            "record_id": item["record_id"],
            "status": item["status"],
            "approver": item.get("approved_by", ""),
            "time": item.get("approved_time", datetime.now()),
            "note": item.get("approval_note", "") or item.get("reject_reason", "") or item.get("review_note", ""),
            "type": item["type"]
        })

    def format_approval_prompt(self, item: Dict[str, any]) -> str:
        record = item["record"]
        conflict = item.get("conflict")
        flow = item.get("flow")
        
        lines = [
            "=" * 60,
            f"📌 待审批 - {item['type']}",
            "=" * 60,
            f"记录ID: {record.record_id}",
            f"交易日期: {record.trade_date.strftime('%Y-%m-%d')}",
            f"保证金类型: {record.margin_type}",
            f"金额: {record.amount:,.2f}",
            f"方向: {record.direction}",
            f"来源: {record.source.value}",
            "",
        ]
        
        if conflict:
            lines.extend([
                "⚠️  尾号冲突信息:",
                f"   流水号: {conflict.flow_id}",
                f"   柜台尾号: {conflict.flow_tail_counter}",
                f"   邮件尾号: {conflict.flow_tail_email}",
                f"   邮件备注: {conflict.email_remark[:100]}..." if len(conflict.email_remark) > 100 else f"   邮件备注: {conflict.email_remark}",
                "",
            ])
        
        if flow and flow.is_manual_modified:
            lines.extend([
                "✏️  手工修改信息:",
                f"   修改人: {flow.modified_by}",
                f"   修改时间: {flow.modified_time.strftime('%Y-%m-%d %H:%M') if flow.modified_time else '未知'}",
                f"   原到账类型: T+1",
                f"   新到账类型: {flow.settlement_type.value}",
                "",
            ])
        
        if record.email_remark:
            lines.extend([
                "📧 客户经理邮件备注:",
                f"   {record.email_remark}",
                "",
            ])
        
        if item["type"] == "手工改T+2复核":
            lines.extend([
                "请基金经理选择:",
                "   [1] 通过 - 确认手工修改有效",
                "   [2] 驳回 - 不同意修改",
            ])
        else:
            lines.extend([
                "请基金会计林姐选择:",
                "   [1] 确认 - 以柜台系统为准",
                "   [2] 驳回 - 以邮件备注为准",
            ])
        
        lines.append("=" * 60)
        return "\n".join(lines)

    def get_approval_status(self, record_id: str) -> Optional[Dict[str, any]]:
        for item in self.pending_approvals:
            if item["record_id"] == record_id:
                return {
                    "status": item["status"],
                    "approver": item["approver"],
                    "type": item["type"],
                    "submit_time": item["submit_time"]
                }
        
        for hist in self.approval_history:
            if hist["record_id"] == record_id:
                return {
                    "status": hist["status"],
                    "approver": hist["approver"],
                    "type": hist["type"],
                    "approved_time": hist["time"],
                    "note": hist["note"]
                }
        
        return None

    def get_approvals_by_date(self, trade_date: date) -> List[Dict[str, any]]:
        return [h for h in self.approval_history if h["record"].trade_date == trade_date]

    def get_approval_summary(self) -> Dict[str, int]:
        return {
            "待林姐确认": len([a for a in self.pending_approvals if a["approver"] == "林姐" and a["status"] == ApprovalStatus.PENDING]),
            "待基金经理复核": len([a for a in self.pending_approvals if a["approver"] == "基金经理" and a["status"] == ApprovalStatus.PENDING_REVIEW]),
            "已通过": len([h for h in self.approval_history if h["status"] in [ApprovalStatus.APPROVED, ApprovalStatus.REVIEWED]]),
            "已驳回": len([h for h in self.approval_history if h["status"] == ApprovalStatus.REJECTED]),
        }
