import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from uuid import uuid4

from models import ScreeningResult, DeviceLog, ScreeningStatus, LogLevel, LogEventType


class JSONParseError(Exception):
    pass


class JSONParser:
    def __init__(self):
        self.errors: List[str] = []
    
    def parse_screening_results(self, file_path: Path) -> List[ScreeningResult]:
        self.errors.clear()
        results: List[ScreeningResult] = []
        
        if not file_path.exists():
            raise JSONParseError(f"文件不存在: {file_path}")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise JSONParseError(f"JSON解析错误: {e}")
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    data = json.load(f)
            except Exception as e:
                raise JSONParseError(f"无法读取文件: {e}")
        
        if isinstance(data, dict):
            items = self._extract_results_from_dict(data)
        elif isinstance(data, list):
            items = data
        else:
            raise JSONParseError("JSON格式不支持，需要是数组或包含结果的对象")
        
        for idx, item in enumerate(items):
            try:
                result = self._parse_single_result(item)
                result.source_file = str(file_path)
                results.append(result)
            except Exception as e:
                self.errors.append(f"第{idx}个结果解析失败: {e}")
        
        return results
    
    def _extract_results_from_dict(self, data: Dict) -> List[Dict]:
        possible_keys = [
            "results", "screening_results", "screenings",
            "data", "items", "list", "result"
        ]
        
        for key in possible_keys:
            if key in data and isinstance(data[key], list):
                return data[key]
        
        return [data]
    
    def _parse_single_result(self, item: Dict) -> ScreeningResult:
        screening_id = item.get("screening_id", item.get("id", item.get("result_id", str(uuid4()))))
        student_id = item.get("student_id", item.get("学号", item.get("学生编号", "")))
        
        if not student_id:
            raise ValueError("缺少学生ID")
        
        screening_date = None
        date_str = item.get("screening_date", item.get("date", item.get("筛查日期")))
        if date_str:
            screening_date = self._parse_datetime(date_str)
        
        status = ScreeningStatus.NORMAL
        status_str = item.get("status", item.get("结果", item.get("筛查结果")))
        if status_str:
            status = self._parse_screening_status(status_str)
        
        left_thresholds = self._parse_thresholds(
            item.get("left_ear", item.get("左耳", item.get("left", {})))
        )
        right_thresholds = self._parse_thresholds(
            item.get("right_ear", item.get("右耳", item.get("right", {})))
        )
        
        thresholds = item.get("thresholds", item.get("阈值", {}))
        if isinstance(thresholds, dict):
            if "left" in thresholds or "左耳" in thresholds:
                left_thresholds.update(self._parse_thresholds(thresholds.get("left", thresholds.get("左耳", {}))))
            if "right" in thresholds or "右耳" in thresholds:
                right_thresholds.update(self._parse_thresholds(thresholds.get("right", thresholds.get("右耳", {}))))
        
        left_status = None
        left_status_str = item.get("left_ear_status", item.get("左耳结果"))
        if left_status_str:
            left_status = self._parse_screening_status(left_status_str)
        
        right_status = None
        right_status_str = item.get("right_ear_status", item.get("右耳结果"))
        if right_status_str:
            right_status = self._parse_screening_status(right_status_str)
        
        return ScreeningResult(
            screening_id=str(screening_id),
            student_id=str(student_id),
            device_id=item.get("device_id", item.get("设备ID")),
            screening_date=screening_date,
            status=status,
            left_ear_thresholds=left_thresholds,
            right_ear_thresholds=right_thresholds,
            left_ear_status=left_status,
            right_ear_status=right_status,
            tester=item.get("tester", item.get("测试员")),
            location=item.get("location", item.get("地点")),
            notes=item.get("notes", item.get("备注"))
        )
    
    def _parse_thresholds(self, data: Union[Dict, List]) -> Dict[int, Optional[int]]:
        thresholds: Dict[int, Optional[int]] = {}
        
        if isinstance(data, dict):
            for key, value in data.items():
                freq = self._parse_frequency(key)
                if freq is not None:
                    thresholds[freq] = self._parse_threshold_value(value)
            
            freq_map = {
                500: ["500", "500Hz", "五百"],
                1000: ["1000", "1000Hz", "1k", "一千"],
                2000: ["2000", "2000Hz", "2k", "两千"],
                4000: ["4000", "4000Hz", "4k", "四千"],
                8000: ["8000", "8000Hz", "8k", "八千"],
            }
            
            for freq, aliases in freq_map.items():
                for alias in aliases:
                    if alias in data and freq not in thresholds:
                        thresholds[freq] = self._parse_threshold_value(data[alias])
        
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    freq = item.get("frequency", item.get("freq"))
                    if freq is not None:
                        freq_int = self._parse_frequency(str(freq))
                        if freq_int is not None:
                            thresholds[freq_int] = self._parse_threshold_value(
                                item.get("threshold", item.get("值"))
                            )
        
        return thresholds
    
    def _parse_frequency(self, value: str) -> Optional[int]:
        if not value:
            return None
        
        s = str(value).lower().strip()
        
        freq_map = {
            "500": 500, "500hz": 500,
            "1000": 1000, "1000hz": 1000, "1k": 1000, "1khz": 1000,
            "2000": 2000, "2000hz": 2000, "2k": 2000, "2khz": 2000,
            "4000": 4000, "4000hz": 4000, "4k": 4000, "4khz": 4000,
            "8000": 8000, "8000hz": 8000, "8k": 8000, "8khz": 8000,
        }
        
        if s in freq_map:
            return freq_map[s]
        
        try:
            num = int(s.replace("hz", "").replace("k", "000").strip())
            if num in [500, 1000, 2000, 4000, 8000]:
                return num
        except ValueError:
            pass
        
        return None
    
    def _parse_threshold_value(self, value: Any) -> Optional[int]:
        if value is None or value == "":
            return None
        
        if isinstance(value, int):
            return value
        
        if isinstance(value, float):
            return int(value)
        
        s = str(value).strip()
        
        if s.lower() in ["none", "null", "无", "缺失", "未测", "-", "--"]:
            return None
        
        try:
            return int(float(s))
        except ValueError:
            return None
    
    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        
        if isinstance(value, datetime):
            return value
        
        s = str(value).strip()
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%Y年%m月%d日 %H:%M:%S",
            "%Y年%m月%d日 %H:%M",
            "%Y年%m月%d日",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            pass
        
        return None
    
    def _parse_screening_status(self, value: Any) -> ScreeningStatus:
        if isinstance(value, ScreeningStatus):
            return value
        
        s = str(value).strip().lower()
        
        status_map = {
            "normal": ScreeningStatus.NORMAL,
            "通过": ScreeningStatus.NORMAL,
            "正常": ScreeningStatus.NORMAL,
            "pass": ScreeningStatus.NORMAL,
            "ok": ScreeningStatus.NORMAL,
            
            "refer": ScreeningStatus.REFER,
            "转诊": ScreeningStatus.REFER,
            "复查": ScreeningStatus.REFER,
            "未通过": ScreeningStatus.REFER,
            "异常": ScreeningStatus.REFER,
            "fail": ScreeningStatus.REFER,
            
            "invalid": ScreeningStatus.INVALID,
            "无效": ScreeningStatus.INVALID,
            
            "incomplete": ScreeningStatus.INCOMPLETE,
            "未完成": ScreeningStatus.INCOMPLETE,
            "部分": ScreeningStatus.INCOMPLETE,
        }
        
        return status_map.get(s, ScreeningStatus.NORMAL)
    
    def parse_device_logs(self, file_path: Path) -> List[DeviceLog]:
        self.errors.clear()
        logs: List[DeviceLog] = []
        
        if not file_path.exists():
            raise JSONParseError(f"文件不存在: {file_path}")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise JSONParseError(f"JSON解析错误: {e}")
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    data = json.load(f)
            except Exception as e:
                raise JSONParseError(f"无法读取文件: {e}")
        
        if isinstance(data, dict):
            items = self._extract_logs_from_dict(data)
        elif isinstance(data, list):
            items = data
        else:
            raise JSONParseError("JSON格式不支持，需要是数组或包含日志的对象")
        
        for idx, item in enumerate(items):
            try:
                log = self._parse_single_log(item)
                log.source_file = str(file_path)
                logs.append(log)
            except Exception as e:
                self.errors.append(f"第{idx}条日志解析失败: {e}")
        
        return logs
    
    def _extract_logs_from_dict(self, data: Dict) -> List[Dict]:
        possible_keys = [
            "logs", "device_logs", "entries",
            "events", "records", "log"
        ]
        
        for key in possible_keys:
            if key in data and isinstance(data[key], list):
                return data[key]
        
        return [data]
    
    def _parse_single_log(self, item: Dict) -> DeviceLog:
        log_id = item.get("log_id", item.get("id", item.get("entry_id", str(uuid4()))))
        device_id = item.get("device_id", item.get("设备ID", item.get("device", "")))
        
        if not device_id:
            raise ValueError("缺少设备ID")
        
        log_timestamp = None
        ts = item.get("timestamp", item.get("time", item.get("时间", item.get("log_time"))))
        if ts:
            log_timestamp = self._parse_datetime(ts)
        
        if log_timestamp is None:
            log_timestamp = datetime.now()
        
        level = LogLevel.INFO
        level_str = item.get("level", item.get("级别", item.get("日志级别")))
        if level_str:
            level = self._parse_log_level(level_str)
        
        event_type = None
        event_str = item.get("event_type", item.get("事件类型", item.get("type")))
        if event_str:
            event_type = self._parse_log_event_type(event_str)
        
        return DeviceLog(
            log_id=str(log_id),
            device_id=str(device_id),
            log_timestamp=log_timestamp,
            level=level,
            event_type=event_type,
            message=item.get("message", item.get("消息", item.get("内容", ""))),
            details=item.get("details", item.get("详细信息", {})),
            screening_id=item.get("screening_id", item.get("筛查ID")),
            student_id=item.get("student_id", item.get("学生ID"))
        )
    
    def _parse_log_level(self, value: Any) -> LogLevel:
        if isinstance(value, LogLevel):
            return value
        
        s = str(value).strip().lower()
        
        level_map = {
            "debug": LogLevel.DEBUG,
            "调试": LogLevel.DEBUG,
            "info": LogLevel.INFO,
            "信息": LogLevel.INFO,
            "warning": LogLevel.WARNING,
            "warn": LogLevel.WARNING,
            "警告": LogLevel.WARNING,
            "error": LogLevel.ERROR,
            "错误": LogLevel.ERROR,
            "critical": LogLevel.CRITICAL,
            "严重": LogLevel.CRITICAL,
            "致命": LogLevel.CRITICAL,
        }
        
        return level_map.get(s, LogLevel.INFO)
    
    def _parse_log_event_type(self, value: Any) -> Optional[LogEventType]:
        if isinstance(value, LogEventType):
            return value
        
        s = str(value).strip().lower()
        
        type_map = {
            "device_start": LogEventType.DEVICE_START,
            "设备启动": LogEventType.DEVICE_START,
            "开机": LogEventType.DEVICE_START,
            
            "device_stop": LogEventType.DEVICE_STOP,
            "设备停止": LogEventType.DEVICE_STOP,
            "关机": LogEventType.DEVICE_STOP,
            
            "screening_start": LogEventType.SCREENING_START,
            "筛查开始": LogEventType.SCREENING_START,
            "开始筛查": LogEventType.SCREENING_START,
            
            "screening_complete": LogEventType.SCREENING_COMPLETE,
            "筛查完成": LogEventType.SCREENING_COMPLETE,
            "完成筛查": LogEventType.SCREENING_COMPLETE,
            
            "screening_abort": LogEventType.SCREENING_ABORT,
            "筛查中止": LogEventType.SCREENING_ABORT,
            "中止筛查": LogEventType.SCREENING_ABORT,
            "取消": LogEventType.SCREENING_ABORT,
            
            "calibration_check": LogEventType.CALIBRATION_CHECK,
            "校准检查": LogEventType.CALIBRATION_CHECK,
            
            "error_occurred": LogEventType.ERROR_OCCURRED,
            "错误发生": LogEventType.ERROR_OCCURRED,
            "出现错误": LogEventType.ERROR_OCCURRED,
            
            "user_action": LogEventType.USER_ACTION,
            "用户操作": LogEventType.USER_ACTION,
            
            "system_event": LogEventType.SYSTEM_EVENT,
            "系统事件": LogEventType.SYSTEM_EVENT,
        }
        
        return type_map.get(s)


def parse_screening_results_json(file_path: Path) -> tuple[List[ScreeningResult], List[str]]:
    parser = JSONParser()
    try:
        results = parser.parse_screening_results(file_path)
        return results, parser.errors
    except JSONParseError as e:
        return [], [str(e)]


def parse_device_logs_json(file_path: Path) -> tuple[List[DeviceLog], List[str]]:
    parser = JSONParser()
    try:
        logs = parser.parse_device_logs(file_path)
        return logs, parser.errors
    except JSONParseError as e:
        return [], [str(e)]
