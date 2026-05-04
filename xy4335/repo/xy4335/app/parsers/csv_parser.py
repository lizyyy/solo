import csv
from datetime import datetime, time
from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd


class ScheduleParser:
    EXPECTED_COLUMNS = [
        "date", "operator_id", "operator_name", 
        "shift_start", "shift_end", "role", "notes"
    ]

    @classmethod
    def parse_file(cls, file_path: Path) -> List[Dict[str, Any]]:
        df = pd.read_csv(file_path, encoding="utf-8")
        df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
        
        results = []
        for idx, row in df.iterrows():
            try:
                parsed = cls._parse_row(row, idx + 1)
                results.append(parsed)
            except Exception as e:
                raise ValueError(f"第 {idx+1} 行解析失败: {str(e)}")
        
        return results

    @classmethod
    def _parse_row(cls, row: pd.Series, row_num: int) -> Dict[str, Any]:
        date_str = cls._get_value(row, ["date", "日期", "排班日期"])
        if not date_str or pd.isna(date_str):
            raise ValueError(f"缺少日期字段")
        
        date = cls._parse_date(date_str)
        
        operator_id = cls._get_value(row, ["operator_id", "员工号", "接线员id"])
        if not operator_id or pd.isna(operator_id):
            raise ValueError(f"缺少接线员ID字段")
        
        shift_start = None
        shift_end = None
        
        start_str = cls._get_value(row, ["shift_start", "start_time", "开始时间"])
        if start_str and not pd.isna(start_str):
            shift_start = cls._parse_time(start_str, date)
        
        end_str = cls._get_value(row, ["shift_end", "end_time", "结束时间"])
        if end_str and not pd.isna(end_str):
            shift_end = cls._parse_time(end_str, date)
        
        return {
            "schedule_id": f"SCH_{date.strftime('%Y%m%d')}_{str(operator_id).strip()}",
            "date": date,
            "operator_id": str(operator_id).strip(),
            "operator_name": cls._get_value(row, ["operator_name", "姓名", "接线员姓名"]) or None,
            "shift_start": shift_start,
            "shift_end": shift_end,
            "role": cls._get_value(row, ["role", "角色", "岗位"]) or None,
            "notes": cls._get_value(row, ["notes", "备注", "说明"]) or None,
        }

    @staticmethod
    def _get_value(row: pd.Series, possible_keys: List[str]) -> Optional[str]:
        for key in possible_keys:
            if key in row.index:
                val = row[key]
                if not pd.isna(val):
                    return str(val).strip()
        return None

    @staticmethod
    def _parse_date(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        
        value = str(value).strip()
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y年%m月%d日",
            "%m/%d/%Y",
            "%d/%m/%Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期格式: {value}")

    @staticmethod
    def _parse_time(value: Any, base_date: datetime) -> datetime:
        if isinstance(value, datetime):
            return value
        
        value = str(value).strip()
        
        if ":" in value:
            parts = value.split(":")
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            return datetime.combine(base_date.date(), time(hour % 24, minute % 60))
        
        formats = [
            "%H:%M",
            "%H:%M:%S",
            "%I:%M %p",
            "%I:%M%p",
        ]
        
        for fmt in formats:
            try:
                t = datetime.strptime(value, fmt).time()
                return datetime.combine(base_date.date(), t)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析时间格式: {value}")


class FollowUpParser:
    EXPECTED_COLUMNS = [
        "follow_up_id", "call_id", "scheduled_time", 
        "actual_time", "operator_id", "operator_name",
        "content", "result", "is_completed"
    ]

    @classmethod
    def parse_file(cls, file_path: Path) -> List[Dict[str, Any]]:
        df = pd.read_csv(file_path, encoding="utf-8")
        df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
        
        results = []
        for idx, row in df.iterrows():
            try:
                parsed = cls._parse_row(row, idx + 1)
                results.append(parsed)
            except Exception as e:
                raise ValueError(f"第 {idx+1} 行解析失败: {str(e)}")
        
        return results

    @classmethod
    def _parse_row(cls, row: pd.Series, row_num: int) -> Dict[str, Any]:
        call_id = cls._get_value(row, ["call_id", "来电id", "通话id"])
        if not call_id or pd.isna(call_id):
            raise ValueError(f"缺少来电ID字段")
        
        scheduled_time = None
        actual_time = None
        
        scheduled_str = cls._get_value(row, ["scheduled_time", "计划时间", "回访时间"])
        if scheduled_str and not pd.isna(scheduled_str):
            scheduled_time = cls._parse_datetime(scheduled_str)
        
        actual_str = cls._get_value(row, ["actual_time", "实际时间", "完成时间"])
        if actual_str and not pd.isna(actual_str):
            actual_time = cls._parse_datetime(actual_str)
        
        is_completed = cls._get_value(row, ["is_completed", "已完成", "完成状态"])
        if is_completed:
            is_completed = str(is_completed).lower() in ["是", "yes", "true", "1", "已完成"]
        else:
            is_completed = False
        
        return {
            "follow_up_id": cls._get_value(row, ["follow_up_id", "回访id"]) or f"FU_{call_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "call_id": str(call_id).strip(),
            "scheduled_time": scheduled_time,
            "actual_time": actual_time,
            "operator_id": cls._get_value(row, ["operator_id", "员工号", "接线员id"]) or None,
            "operator_name": cls._get_value(row, ["operator_name", "姓名", "接线员姓名"]) or None,
            "content": cls._get_value(row, ["content", "内容", "回访内容"]) or None,
            "result": cls._get_value(row, ["result", "结果", "回访结果"]) or None,
            "is_completed": is_completed,
        }

    @staticmethod
    def _get_value(row: pd.Series, possible_keys: List[str]) -> Optional[str]:
        for key in possible_keys:
            if key in row.index:
                val = row[key]
                if not pd.isna(val):
                    return str(val).strip()
        return None

    @staticmethod
    def _parse_datetime(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        
        value = str(value).strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%SZ",
            "%Y年%m月%d日 %H:%M",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期时间格式: {value}")
