from typing import Dict, Any, List
from .single_source import SingleSourceOfTruth


class ApiService:
    """
    API接口层 - 必须从单一数据源读取
    确保接口返回与页面展示、导出明细完全一致
    """

    def __init__(self, source_of_truth: SingleSourceOfTruth):
        self.source = source_of_truth

    def list_records(self, status_filter: str = None) -> Dict[str, Any]:
        """列表接口"""
        records = self.source.get_for_api()
        if status_filter:
            records = [r for r in records if r["status"] == status_filter]
        return {
            "code": 0,
            "message": "success",
            "data": records,
            "total": len(records),
        }

    def get_record(self, record_id: str) -> Dict[str, Any]:
        """详情接口"""
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
        """异常汇总接口"""
        records = self.source.get_for_api()
        abnormal = [r for r in records if r["status"] in ["abnormal", "review_required"]]
        leave_counted = [
            r for r in records
            if r.get("abnormal_type") == "leave_counted_as_consumed"
        ]
        return {
            "code": 0,
            "message": "success",
            "data": {
                "total_abnormal": len(abnormal),
                "leave_counted_as_consumed": len(leave_counted),
                "pending_review": len([r for r in records if r["status"] == "review_required"]),
                "leave_counted_details": leave_counted,
            },
        }

    def export_data(self, format: str = "json") -> Dict[str, Any]:
        """导出数据接口"""
        if format == "json":
            data = self.source.get_for_export()
        else:
            data = self.source.get_for_api()
        return {
            "code": 0,
            "message": "success",
            "data": data,
        }
