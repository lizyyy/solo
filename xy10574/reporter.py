import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from models import LeadStatus, BlockReason
from storage import Storage


class Reporter:
    def __init__(self, storage: Storage):
        self.storage = storage

    def get_summary(self) -> Dict[str, Any]:
        all_leads = self.storage.get_all_leads()
        
        summary = {
            "total": len(all_leads),
            "by_status": {},
            "by_block_reason": {},
            "by_type": {},
            "check_sessions": self.storage.get_check_sessions(),
            "import_sessions": self.storage.get_import_sessions()
        }
        
        for status in LeadStatus:
            leads = self.storage.get_leads_by_status(status)
            summary["by_status"][status.value] = len(leads)
        
        blocked_leads = self.storage.get_leads_by_status(LeadStatus.BLOCKED)
        deferred_leads = self.storage.get_leads_by_status(LeadStatus.DEFERRED)
        
        all_blocked = blocked_leads + deferred_leads
        reason_counts = {}
        for lead in all_blocked:
            if lead.block_reason:
                reason_counts[lead.block_reason.value] = reason_counts.get(
                    lead.block_reason.value, 0
                ) + 1
        summary["by_block_reason"] = reason_counts
        
        type_counts = {}
        for lead in all_leads:
            type_counts[lead.type] = type_counts.get(lead.type, 0) + 1
        summary["by_type"] = type_counts
        
        return summary

    def get_callable_leads(self) -> List[Dict[str, Any]]:
        callable = self.storage.get_leads_by_status(LeadStatus.CALLABLE)
        manual = self.storage.get_leads_by_status(LeadStatus.MANUAL_RELEASED)
        all_callable = callable + manual
        
        return [
            {
                "lead_id": l.id,
                "phone": l.phone,
                "name": l.name,
                "type": l.type,
                "region": l.region,
                "status": l.status.value,
                "manual_release_reason": l.manual_release_reason,
                "extra_data": l.extra_data
            } for l in all_callable
        ]

    def get_deferred_leads(self) -> List[Dict[str, Any]]:
        deferred = self.storage.get_leads_by_status(LeadStatus.DEFERRED)
        return [
            {
                "lead_id": l.id,
                "phone": l.phone,
                "name": l.name,
                "type": l.type,
                "region": l.region,
                "block_reason": l.block_reason.value if l.block_reason else None,
                "extra_data": l.extra_data
            } for l in deferred
        ]

    def get_blocked_leads(self) -> List[Dict[str, Any]]:
        blocked = self.storage.get_leads_by_status(LeadStatus.BLOCKED)
        return [
            {
                "lead_id": l.id,
                "phone": l.phone,
                "name": l.name,
                "type": l.type,
                "region": l.region,
                "block_reason": l.block_reason.value if l.block_reason else None,
                "extra_data": l.extra_data
            } for l in blocked
        ]

    def get_lead_detail(self, lead_id: str) -> Dict[str, Any]:
        lead = self.storage.get_lead(lead_id)
        if not lead:
            return {"success": False, "error": "线索不存在"}
        
        logs = self.storage.get_operation_logs(lead_id, "lead")
        callbacks = self.storage.get_active_callbacks(lead.phone)
        history = self.storage.get_call_history(lead.phone)
        blacklist_entry = self.storage.get_blacklist_entry(lead.phone)
        
        return {
            "success": True,
            "lead": {
                "id": lead.id,
                "phone": lead.phone,
                "name": lead.name,
                "type": lead.type,
                "region": lead.region,
                "timezone": lead.timezone,
                "status": lead.status.value,
                "block_reason": lead.block_reason.value if lead.block_reason else None,
                "manual_release_reason": lead.manual_release_reason,
                "source_file": lead.source_file,
                "created_at": lead.created_at.isoformat() if lead.created_at else None,
                "extra_data": lead.extra_data
            },
            "operation_logs": [
                {
                    "timestamp": l.timestamp.isoformat(),
                    "operator": l.operator,
                    "operation_type": l.operation_type,
                    "previous_state": l.previous_state,
                    "new_state": l.new_state,
                    "reason": l.reason
                } for l in logs
            ],
            "active_callbacks": [
                {
                    "id": c.id,
                    "scheduled_time": c.scheduled_time.isoformat(),
                    "reason": c.reason,
                    "created_by": c.created_by
                } for c in callbacks
            ],
            "call_history": [
                {
                    "call_time": h.call_time.isoformat(),
                    "result": h.result.value,
                    "agent": h.agent,
                    "notes": h.notes
                } for h in history
            ],
            "blacklist_entry": {
                "reason": blacklist_entry.reason,
                "source": blacklist_entry.source,
                "created_at": blacklist_entry.created_at.isoformat()
            } if blacklist_entry else None
        }

    def generate_report(self, output_dir: str = "./reports") -> Dict[str, Any]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = output_path / f"cleaning_report_{timestamp}.json"
        
        report = {
            "report_time": datetime.now().isoformat(),
            "summary": self.get_summary(),
            "callable_leads": self.get_callable_leads(),
            "deferred_leads": self.get_deferred_leads(),
            "blocked_leads": self.get_blocked_leads()
        }
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        return {
            "success": True,
            "report_file": str(report_file),
            "summary": report["summary"]
        }

    def print_summary(self, data: Dict[str, Any] = None) -> str:
        if data is None:
            data = self.get_summary()
        
        lines = []
        lines.append("=" * 60)
        lines.append("外呼名单清洗报告 - 概览")
        lines.append("=" * 60)
        lines.append(f"总线索数: {data['total']}")
        lines.append("")
        lines.append("按状态分布:")
        for status, count in data['by_status'].items():
            if count > 0:
                status_name = {
                    'imported': '已导入',
                    'pending': '待检查',
                    'callable': '可拨打',
                    'deferred': '暂缓',
                    'blocked': '禁呼',
                    'connected': '已接通',
                    'rejected': '已拒呼',
                    'manual_released': '人工放行'
                }.get(status, status)
                lines.append(f"  {status_name}: {count}")
        
        if data['by_block_reason']:
            lines.append("")
            lines.append("禁呼/暂缓原因分布:")
            reason_names = {
                'blacklist': '黑名单',
                'duplicate': '重复号码',
                'wrong_timezone': '跨时区',
                'user_rejected': '用户拒呼',
                'compliance': '合规限制',
                'invalid_number': '号码格式错误',
                'invalid_callback': '预约未到期'
            }
            for reason, count in data['by_block_reason'].items():
                name = reason_names.get(reason, reason)
                lines.append(f"  {name}: {count}")
        
        if data['by_type']:
            lines.append("")
            lines.append("按线索类型分布:")
            type_names = {
                'sales': '销售线索',
                'after_sales': '售后回访',
                'renewal': '续费提醒'
            }
            for t, count in data['by_type'].items():
                name = type_names.get(t, t)
                lines.append(f"  {name}: {count}")
        
        return "\n".join(lines)
