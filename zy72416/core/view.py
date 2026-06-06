from typing import List, Dict, Any
from .single_source import SingleSourceOfTruth


class DisplayView:
    """
    页面展示层 - 必须从单一数据源读取
    确保页面显示的数据与导出、接口返回完全一致
    """

    def __init__(self, source_of_truth: SingleSourceOfTruth):
        self.source = source_of_truth

    def get_dashboard_data(self) -> Dict[str, Any]:
        """获取仪表盘汇总数据"""
        records = self.source.get_for_display()
        total = len(records)
        normal = sum(1 for r in records if r["status"] in ["normal", "review_approved"])
        abnormal = sum(1 for r in records if r["is_abnormal"])
        pending_review = sum(1 for r in records if r["status"] == "review_required")
        consumed = sum(1 for r in records if r["consumed"])
        leave_counted = sum(
            1 for r in records
            if r.get("abnormal_type") == "leave_counted_as_consumed"
        )

        return {
            "total_count": total,
            "normal_count": normal,
            "abnormal_count": abnormal,
            "pending_review_count": pending_review,
            "consumed_count": consumed,
            "leave_counted_abnormal": leave_counted,
            "records": records,
        }

    def get_record_detail(self, record_id: str) -> Dict[str, Any]:
        """获取单条记录详情，包含完整证据链"""
        record = self.source.get_record(record_id)
        if not record:
            return {}

        return {
            "basic": self.source._format_for_display(record),
            "sources": [
                {
                    "source_name": s.source_name,
                    "line_number": s.line_number,
                    "raw_content": s.raw_content,
                    "parsed": s.parsed_data,
                }
                for s in record.sources
            ],
            "audit_logs": [
                {
                    "timestamp": al.timestamp.isoformat(),
                    "step": al.step.value,
                    "operator": al.operator,
                    "action": al.action,
                    "note": al.note,
                }
                for al in record.audit_logs
            ],
            "manual_edits": record.manual_edits,
            "can_review": record.status in ["review_required", "abnormal"],
            "can_rollback": len(record.audit_logs) >= 2,
        }

    def get_abnormal_records(self) -> List[Dict[str, Any]]:
        """获取所有异常记录"""
        records = self.source.get_for_display()
        return [r for r in records if r["is_abnormal"]]
