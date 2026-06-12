from typing import List, Dict, Any
from .single_source import SingleSourceOfTruth
from .models import FieldMapping


class DisplayView:
    """
    页面展示层 - 必须从单一数据源读取，使用 FieldMapping 统一字段
    关键：确保页面显示的数据与导出、接口返回完全一致
    """

    def __init__(self, source_of_truth: SingleSourceOfTruth):
        self.source = source_of_truth

    def get_dashboard_data(self) -> Dict[str, Any]:
        """获取仪表盘汇总数据 - 从单一数据源读取"""
        records = self.source.get_for_display()
        mapping = FieldMapping.get_all_fields("display")

        is_abnormal_field = mapping.get("is_abnormal", "is_abnormal")
        status_field = mapping.get("status", "status")
        consumed_field = mapping.get("consumed", "consumed")
        abnormal_type_field = mapping.get("abnormal_type", "abnormal_type")

        total = len(records)
        normal = sum(1 for r in records if r.get(status_field) in ["normal", "review_approved"])
        abnormal = sum(1 for r in records if r.get(is_abnormal_field) is True)
        pending_review = sum(1 for r in records if r.get(status_field) == "review_required")
        consumed = sum(1 for r in records if r.get(consumed_field) == "是")
        leave_counted = sum(
            1 for r in records
            if r.get(abnormal_type_field) == "leave_counted_as_consumed"
        )

        export_status = self._get_export_status(records)

        return {
            "total_count": total,
            "normal_count": normal,
            "abnormal_count": abnormal,
            "pending_review_count": pending_review,
            "consumed_count": consumed,
            "leave_counted_abnormal": leave_counted,
            "export_status": export_status,
            "records": records,
            "consistency_check": self.source.verify_consistency(),
        }

    def get_record_detail(self, record_id: str) -> Dict[str, Any]:
        """获取单条记录详情，包含完整证据链 - 从单一数据源读取"""
        record = self.source.get_record(record_id)
        if not record:
            return {}

        display_data = self.source._format_for_display(record)

        return {
            "basic": display_data,
            "sources": display_data.get("sources", []),
            "audit_logs": display_data.get("audit_logs", []),
            "manual_edits": display_data.get("manual_edits", []),
            "export_meta": display_data.get("export_meta", {}),
            "can_review": record.status in ["review_required", "abnormal"],
            "can_rollback": len(record.audit_logs) >= 2,
            "can_export": True,
        }

    def get_abnormal_records(self) -> List[Dict[str, Any]]:
        """获取所有异常记录 - 从单一数据源读取"""
        records = self.source.get_for_display()
        mapping = FieldMapping.get_all_fields("display")
        is_abnormal_field = mapping.get("is_abnormal", "is_abnormal")
        return [r for r in records if r.get(is_abnormal_field) is True]

    def get_leave_consumed_records(self) -> List[Dict[str, Any]]:
        """获取所有请假课时被算进已消耗的异常记录"""
        records = self.source.get_for_display()
        mapping = FieldMapping.get_all_fields("display")
        abnormal_type_field = mapping.get("abnormal_type", "abnormal_type")
        return [
            r for r in records
            if r.get(abnormal_type_field) == "leave_counted_as_consumed"
        ]

    def _get_export_status(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """获取导出状态 - 从单一数据源读取"""
        mapping = FieldMapping.get_all_fields("display")
        export_status_field = mapping.get("export_status", "export_status")
        export_time_field = mapping.get("export_time", "export_time")
        export_operator_field = mapping.get("export_operator", "export_operator")

        exported = sum(1 for r in records if r.get(export_status_field) == "已导出")
        last_export = None
        last_operator = None

        for r in records:
            rt = r.get(export_time_field)
            if rt and (last_export is None or rt > last_export):
                last_export = rt
                last_operator = r.get(export_operator_field)

        return {
            "total": len(records),
            "exported": exported,
            "not_exported": len(records) - exported,
            "all_exported": exported == len(records) and len(records) > 0,
            "last_export_time": last_export,
            "last_export_operator": last_operator,
        }
