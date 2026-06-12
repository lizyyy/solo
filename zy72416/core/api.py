from typing import Dict, Any, List
from .single_source import SingleSourceOfTruth
from .models import FieldMapping


class ApiService:
    """
    API接口层 - 必须从单一数据源读取，使用 FieldMapping 统一字段
    确保接口返回与页面展示、导出明细完全一致
    """

    def __init__(self, source_of_truth: SingleSourceOfTruth):
        self.source = source_of_truth

    def list_records(self, status_filter: str = None) -> Dict[str, Any]:
        """列表接口 - 从单一数据源读取"""
        records = self.source.get_for_api()
        if status_filter:
            records = [r for r in records if r["status"] == status_filter]
        return {
            "code": 0,
            "message": "success",
            "data": records,
            "total": len(records),
            "consistency_check": self.source.verify_consistency(),
        }

    def get_record(self, record_id: str) -> Dict[str, Any]:
        """详情接口 - 从单一数据源读取"""
        record = self.source.get_record(record_id)
        if not record:
            return {
                "code": 404,
                "message": "记录不存在",
                "data": None,
            }
        return {
            "code": 0,
            "message": "success",
            "data": record.to_dict(),
        }

    def get_abnormal_summary(self) -> Dict[str, Any]:
        """异常汇总接口 - 从单一数据源读取"""
        records = self.source.get_for_api()
        abnormal = [r for r in records if r["status"] in ["abnormal", "review_required"]]
        leave_counted = [
            r for r in records
            if r.get("abnormal_type") == "leave_counted_as_consumed"
        ]

        export_status = self._get_export_status_from_raw()

        return {
            "code": 0,
            "message": "success",
            "data": {
                "total_records": len(records),
                "total_abnormal": len(abnormal),
                "leave_counted_as_consumed": len(leave_counted),
                "pending_review": len([r for r in records if r["status"] == "review_required"]),
                "review_approved": len([r for r in records if r["status"] == "review_approved"]),
                "review_rejected": len([r for r in records if r["status"] == "review_rejected"]),
                "leave_counted_details": leave_counted,
                "export_status": export_status,
            },
        }

    def export_data(self, format: str = "json") -> Dict[str, Any]:
        """导出数据接口 - 从单一数据源读取，与页面/导出同一份数据"""
        if format == "json":
            data = self.source.get_for_export()
        else:
            data = self.source.get_for_api()
        return {
            "code": 0,
            "message": "success",
            "data": data,
            "consistency_check": self.source.verify_consistency(),
        }

    def get_consistency_report(self) -> Dict[str, Any]:
        """获取数据一致性报告 - 核心监控接口"""
        check_result = self.source.verify_consistency()
        display_data = self.source.get_for_display()
        export_data = self.source.get_for_export()
        api_data = self.source.get_for_api()

        return {
            "code": 0,
            "message": "success",
            "data": {
                "consistency_check": check_result,
                "field_mapping": FieldMapping.FIELD_DEFINITIONS,
                "display_sample": display_data[0] if display_data else None,
                "export_sample": export_data[0] if export_data else None,
                "api_sample": api_data[0] if api_data else None,
            },
        }

    def get_export_status(self) -> Dict[str, Any]:
        """获取导出状态接口 - 从单一数据源读取"""
        return {
            "code": 0,
            "message": "success",
            "data": self._get_export_status_from_raw(),
        }

    def _get_export_status_from_raw(self) -> Dict[str, Any]:
        """从原始记录获取导出状态 - 确保与页面使用同一数据源"""
        records = self.source.get_all_records()
        exported = sum(1 for r in records if r.export_meta.exported)
        last_export_time = None
        last_export_operator = None
        last_export_format = None
        last_export_file = None
        last_export_conclusion = None

        for r in records:
            if r.export_meta.export_time:
                if last_export_time is None or r.export_meta.export_time > last_export_time:
                    last_export_time = r.export_meta.export_time
                    last_export_operator = r.export_meta.export_operator
                    last_export_format = r.export_meta.export_format
                    last_export_file = r.export_meta.export_file_path
                    last_export_conclusion = r.export_meta.export_conclusion

        return {
            "total_records": len(records),
            "exported_count": exported,
            "not_exported_count": len(records) - exported,
            "all_exported": exported == len(records) and len(records) > 0,
            "last_export_time": last_export_time.isoformat() if last_export_time else None,
            "last_export_operator": last_export_operator,
            "last_export_format": last_export_format,
            "last_export_file": last_export_file,
            "last_export_conclusion": last_export_conclusion,
        }
