import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.database.models import CallRecord


class CallSummaryParser:
    REQUIRED_FIELDS = ["call_id", "caller_id", "call_time", "summary_text"]

    @classmethod
    def parse_file(cls, file_path: Path) -> List[Dict[str, Any]]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            if "calls" in data or "records" in data:
                records = data.get("calls", data.get("records", []))
            else:
                records = [data]
        elif isinstance(data, list):
            records = data
        else:
            raise ValueError("JSON 格式不支持，应为对象或数组")
        
        results = []
        for i, record in enumerate(records):
            try:
                parsed = cls._parse_single(record, i + 1)
                results.append(parsed)
            except Exception as e:
                raise ValueError(f"第 {i+1} 条记录解析失败: {str(e)}")
        
        return results

    @classmethod
    def _parse_single(cls, record: Dict[str, Any], line_num: int) -> Dict[str, Any]:
        for field in cls.REQUIRED_FIELDS:
            if field not in record:
                raise ValueError(f"缺少必填字段: {field}")
        
        call_time = cls._parse_datetime(record.get("call_time"), "call_time")
        
        initial_risk = record.get("initial_risk_level", record.get("risk_level", "green"))
        if initial_risk not in ["green", "yellow", "orange", "red"]:
            initial_risk = "green"
        
        referral_time = record.get("referral_time")
        if referral_time:
            referral_time = cls._parse_datetime(referral_time, "referral_time")
        
        return {
            "call_id": str(record["call_id"]).strip(),
            "caller_id": str(record["caller_id"]).strip(),
            "call_time": call_time,
            "duration_minutes": int(record.get("duration_minutes", 0)),
            "summary_text": str(record.get("summary_text", "")).strip(),
            "initial_risk_level": initial_risk,
            "operator_id": record.get("operator_id"),
            "operator_name": record.get("operator_name"),
            "has_referral": bool(record.get("has_referral", False)),
            "referral_to": record.get("referral_to"),
            "referral_time": referral_time,
        }

    @staticmethod
    def _parse_datetime(value: Any, field_name: str) -> datetime:
        if isinstance(value, datetime):
            return value
        if not value:
            raise ValueError(f"{field_name} 不能为空")
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(str(value).strip(), fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析 {field_name} 时间格式: {value}")
