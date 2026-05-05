import json
import os
from datetime import datetime, time
from pathlib import Path
from typing import Any, Dict, List, Optional, TypeVar, Type, Tuple

from theater_audio_checker.models import (
    AudioItem,
    ZoneSchedule,
    DeviceLog,
    ReviewNote,
    AudioType,
    ZoneStatus,
    CheckStatus
)

T = TypeVar('T')


class DataLoadError(Exception):
    """数据加载错误"""
    pass


class DataLoader:
    """数据加载器类，负责加载各种剧场音频相关数据"""

    @staticmethod
    def _parse_time(time_str: str) -> time:
        """解析时间字符串，支持多种格式"""
        formats = [
            "%H:%M",
            "%H:%M:%S",
            "%H:%M:%S.%f",
            "%I:%M %p",
            "%I:%M:%S %p"
        ]
        for fmt in formats:
            try:
                return datetime.strptime(time_str.strip(), fmt).time()
            except ValueError:
                continue
        raise ValueError(f"无法解析时间: {time_str}")

    @staticmethod
    def _parse_datetime(datetime_str: str) -> datetime:
        """解析日期时间字符串"""
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d"
        ]
        for fmt in formats:
            try:
                return datetime.strptime(datetime_str.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期时间: {datetime_str}")

    @staticmethod
    def _load_json_file(file_path: str) -> Any:
        """加载JSON文件"""
        path = Path(file_path)
        if not path.exists():
            raise DataLoadError(f"文件不存在: {file_path}")
        if not path.is_file():
            raise DataLoadError(f"路径不是文件: {file_path}")
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise DataLoadError(f"JSON解析错误: {file_path} - {e}")
        except UnicodeDecodeError:
            raise DataLoadError(f"文件编码错误，请使用UTF-8: {file_path}")

    @classmethod
    def load_audio_manifest(cls, file_path: str) -> List[AudioItem]:
        """
        加载音频清单文件
        
        支持的JSON格式:
        - 数组格式: [{"audio_id": "...", ...}, ...]
        - 包装格式: {"items": [...]} 或 {"audio_items": [...]}
        """
        data = cls._load_json_file(file_path)
        
        if isinstance(data, dict):
            if "items" in data:
                items = data["items"]
            elif "audio_items" in data:
                items = data["audio_items"]
            else:
                items = [data]
        elif isinstance(data, list):
            items = data
        else:
            raise DataLoadError(f"音频清单格式不支持: {file_path}")
        
        audio_items = []
        for idx, item_data in enumerate(items):
            try:
                processed_data = cls._prepare_audio_item_data(item_data)
                audio_item = AudioItem(**processed_data)
                audio_items.append(audio_item)
            except Exception as e:
                raise DataLoadError(f"解析第 {idx+1} 个音频项失败: {e}")
        
        return audio_items

    @classmethod
    def _prepare_audio_item_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """预处理音频项数据"""
        result = dict(data)
        
        if "audio_type" in result and isinstance(result["audio_type"], str):
            try:
                result["audio_type"] = AudioType(result["audio_type"])
            except ValueError:
                pass
        
        if "created_at" in result and isinstance(result["created_at"], str):
            try:
                result["created_at"] = cls._parse_datetime(result["created_at"])
            except ValueError:
                pass
        
        return result

    @classmethod
    def load_zone_schedules(cls, file_path: str) -> List[ZoneSchedule]:
        """加载分区播放计划"""
        data = cls._load_json_file(file_path)
        
        if isinstance(data, dict):
            if "items" in data:
                items = data["items"]
            elif "schedules" in data:
                items = data["schedules"]
            elif "zone_schedules" in data:
                items = data["zone_schedules"]
            else:
                items = [data]
        elif isinstance(data, list):
            items = data
        else:
            raise DataLoadError(f"分区播放计划格式不支持: {file_path}")
        
        schedules = []
        for idx, item_data in enumerate(items):
            try:
                processed_data = cls._prepare_schedule_data(item_data)
                schedule = ZoneSchedule(**processed_data)
                schedules.append(schedule)
            except Exception as e:
                raise DataLoadError(f"解析第 {idx+1} 个播放计划失败: {e}")
        
        return schedules

    @classmethod
    def _prepare_schedule_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """预处理播放计划数据"""
        result = dict(data)
        
        if "start_time" in result and isinstance(result["start_time"], str):
            result["start_time"] = cls._parse_time(result["start_time"])
        
        if "end_time" in result and isinstance(result["end_time"], str):
            result["end_time"] = cls._parse_time(result["end_time"])
        
        if "repeat_days" in result and isinstance(result["repeat_days"], str):
            result["repeat_days"] = [d.strip() for d in result["repeat_days"].split(",")]
        
        return result

    @classmethod
    def load_device_logs(cls, file_path: str) -> List[DeviceLog]:
        """加载设备在线日志"""
        data = cls._load_json_file(file_path)
        
        if isinstance(data, dict):
            if "items" in data:
                items = data["items"]
            elif "devices" in data:
                items = data["devices"]
            elif "device_logs" in data:
                items = data["device_logs"]
            else:
                items = [data]
        elif isinstance(data, list):
            items = data
        else:
            raise DataLoadError(f"设备日志格式不支持: {file_path}")
        
        logs = []
        for idx, item_data in enumerate(items):
            try:
                processed_data = cls._prepare_device_log_data(item_data)
                log = DeviceLog(**processed_data)
                logs.append(log)
            except Exception as e:
                raise DataLoadError(f"解析第 {idx+1} 个设备日志失败: {e}")
        
        return logs

    @classmethod
    def _prepare_device_log_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """预处理设备日志数据"""
        result = dict(data)
        
        if "status" in result and isinstance(result["status"], str):
            try:
                result["status"] = ZoneStatus(result["status"])
            except ValueError:
                pass
        
        if "check_time" in result and isinstance(result["check_time"], str):
            result["check_time"] = cls._parse_datetime(result["check_time"])
        
        if "last_online_time" in result and isinstance(result["last_online_time"], str):
            try:
                result["last_online_time"] = cls._parse_datetime(result["last_online_time"])
            except ValueError:
                pass
        
        return result

    @classmethod
    def load_review_notes(cls, file_path: str) -> List[ReviewNote]:
        """加载人工复核备注"""
        data = cls._load_json_file(file_path)
        
        if isinstance(data, dict):
            if "items" in data:
                items = data["items"]
            elif "notes" in data:
                items = data["notes"]
            elif "review_notes" in data:
                items = data["review_notes"]
            else:
                items = [data]
        elif isinstance(data, list):
            items = data
        else:
            raise DataLoadError(f"复核备注格式不支持: {file_path}")
        
        notes = []
        for idx, item_data in enumerate(items):
            try:
                processed_data = cls._prepare_review_note_data(item_data)
                note = ReviewNote(**processed_data)
                notes.append(note)
            except Exception as e:
                raise DataLoadError(f"解析第 {idx+1} 个复核备注失败: {e}")
        
        return notes

    @classmethod
    def _prepare_review_note_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """预处理复核备注数据"""
        result = dict(data)
        
        if "status" in result and isinstance(result["status"], str):
            try:
                result["status"] = CheckStatus(result["status"])
            except ValueError:
                pass
        
        if "review_time" in result and isinstance(result["review_time"], str):
            result["review_time"] = cls._parse_datetime(result["review_time"])
        
        if "attachments" in result and isinstance(result["attachments"], str):
            result["attachments"] = [a.strip() for a in result["attachments"].split(",")]
        
        return result

    @classmethod
    def load_all(
        cls,
        audio_path: Optional[str] = None,
        schedule_path: Optional[str] = None,
        device_path: Optional[str] = None,
        notes_path: Optional[str] = None
    ) -> Tuple[List[AudioItem], List[ZoneSchedule], List[DeviceLog], List[ReviewNote]]:
        """
        批量加载所有数据文件
        
        返回: (音频清单, 分区计划, 设备日志, 复核备注)
        """
        audio_items = []
        zone_schedules = []
        device_logs = []
        review_notes = []
        
        if audio_path:
            audio_items = cls.load_audio_manifest(audio_path)
        
        if schedule_path:
            zone_schedules = cls.load_zone_schedules(schedule_path)
        
        if device_path:
            device_logs = cls.load_device_logs(device_path)
        
        if notes_path:
            review_notes = cls.load_review_notes(notes_path)
        
        return audio_items, zone_schedules, device_logs, review_notes
