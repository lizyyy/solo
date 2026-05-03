"""
数据加载器 - 负责加载各种格式的数据文件
"""

import csv
import json
from datetime import datetime, date, time
from pathlib import Path
from typing import Dict, List, Optional, Any
from uuid import uuid4

import yaml

from cinema_review.models import (
    Screening,
    ProjectorLog,
    LampHours,
    HallRules
)


class DataLoader:
    """数据加载器类"""
    
    def __init__(self, data_dir: Path):
        """
        初始化数据加载器
        
        Args:
            data_dir: 数据目录路径
        """
        self.data_dir = data_dir
        self.cache: Dict[str, Any] = {}
    
    def load_all(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """
        加载所有数据文件
        
        Args:
            target_date: 目标日期，用于筛选数据
            
        Returns:
            包含所有数据的字典
        """
        if target_date is None:
            target_date = date.today()
        
        return {
            "screenings": self.load_screenings(target_date),
            "projector_logs": self.load_projector_logs(target_date),
            "lamp_hours": self.load_lamp_hours(target_date),
            "hall_rules": self.load_hall_rules()
        }
    
    def load_screenings(self, target_date: Optional[date] = None) -> List[Screening]:
        """
        加载排片数据
        
        Args:
            target_date: 目标日期，用于筛选
            
        Returns:
            排片列表
        """
        screenings_file = self._find_file("screenings.csv")
        if not screenings_file:
            return []
        
        screenings: List[Screening] = []
        
        with open(screenings_file, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    screening = self._parse_screening(row)
                    if target_date is None or screening.date == target_date:
                        screenings.append(screening)
                except (ValueError, KeyError) as e:
                    print(f"解析排片数据行失败: {row}, 错误: {e}")
        
        # 按影厅和开始时间排序
        screenings.sort(key=lambda s: (s.hall_id, s.start_time))
        
        return screenings
    
    def load_projector_logs(self, target_date: Optional[date] = None) -> List[ProjectorLog]:
        """
        加载放映机日志
        
        Args:
            target_date: 目标日期
            
        Returns:
            放映机日志列表
        """
        logs_file = self._find_file("projector_logs.jsonl")
        if not logs_file:
            return []
        
        logs: List[ProjectorLog] = []
        
        with open(logs_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    log = self._parse_projector_log(data)
                    if target_date is None or log.event_time.date() == target_date:
                        logs.append(log)
                except (json.JSONDecodeError, ValueError, KeyError) as e:
                    print(f"解析放映机日志行失败: {line[:100]}, 错误: {e}")
        
        # 按时间排序
        logs.sort(key=lambda l: l.event_time)
        
        return logs
    
    def load_lamp_hours(self, target_date: Optional[date] = None) -> Dict[str, LampHours]:
        """
        加载灯泡小时数记录
        
        Args:
            target_date: 目标日期
            
        Returns:
            影厅ID到灯泡记录的映射
        """
        lamp_file = self._find_file("lamp_hours.csv")
        if not lamp_file:
            return {}
        
        lamp_records: Dict[str, LampHours] = {}
        
        with open(lamp_file, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    record = self._parse_lamp_hours(row)
                    if target_date is None or record.date == target_date:
                        lamp_records[record.hall_id] = record
                except (ValueError, KeyError) as e:
                    print(f"解析灯泡数据行失败: {row}, 错误: {e}")
        
        return lamp_records
    
    def load_hall_rules(self) -> Dict[str, HallRules]:
        """
        加载影厅规则配置
        
        Returns:
            影厅ID到规则配置的映射
        """
        rules_file = self._find_file("hall_rules.yaml")
        if not rules_file:
            return self._get_default_rules()
        
        with open(rules_file, "r", encoding="utf-8") as f:
            try:
                data = yaml.safe_load(f)
            except yaml.YAMLError as e:
                print(f"解析YAML文件失败: {e}")
                return self._get_default_rules()
        
        rules: Dict[str, HallRules] = {}
        
        # 支持列表格式或字典格式
        if isinstance(data, list):
            for item in data:
                rule = self._parse_hall_rule(item)
                rules[rule.hall_id] = rule
        elif isinstance(data, dict) and "halls" in data:
            for item in data.get("halls", []):
                rule = self._parse_hall_rule(item)
                rules[rule.hall_id] = rule
        
        return rules
    
    def _find_file(self, filename: str) -> Optional[Path]:
        """
        在数据目录中查找文件
        
        Args:
            filename: 文件名
            
        Returns:
            文件路径，如果未找到则返回None
        """
        # 先在直接目录查找
        direct_path = self.data_dir / filename
        if direct_path.exists():
            return direct_path
        
        # 再在sample子目录查找
        sample_path = self.data_dir / "sample" / filename
        if sample_path.exists():
            return sample_path
        
        return None
    
    def _parse_screening(self, row: Dict[str, str]) -> Screening:
        """
        解析单行排片数据
        
        Args:
            row: CSV行数据
            
        Returns:
            Screening对象
        """
        # 必需字段
        hall_id = row.get("hall_id", row.get("影厅ID", ""))
        hall_name = row.get("hall_name", row.get("影厅名称", hall_id))
        film_name = row.get("film_name", row.get("影片名称", ""))
        
        # 解析时间
        start_time_str = row.get("start_time", row.get("开始时间", ""))
        end_time_str = row.get("end_time", row.get("结束时间", ""))
        date_str = row.get("date", row.get("日期", ""))
        
        # 尝试多种时间格式
        start_time = self._parse_datetime(start_time_str)
        end_time = self._parse_datetime(end_time_str)
        
        # 解析日期
        screening_date = date.today()
        if date_str:
            screening_date = self._parse_date(date_str)
        else:
            # 从开始时间获取日期
            screening_date = start_time.date()
        
        # 时长
        duration_str = row.get("duration_minutes", row.get("时长(分钟)", ""))
        if duration_str:
            duration_minutes = int(float(duration_str))
        else:
            # 从结束时间计算
            duration_minutes = int((end_time - start_time).total_seconds() / 60)
        
        # 生成ID（如果没有）
        screening_id = row.get("id", row.get("排片ID", ""))
        if not screening_id:
            screening_id = f"SCR-{hall_id}-{start_time.strftime('%Y%m%d%H%M')}"
        
        # 可选字段
        film_id = row.get("film_id", row.get("影片ID"))
        language = row.get("language", row.get("语言"))
        format_3d = row.get("format_3d", row.get("3D格式", "false")).lower() in ("true", "1", "是")
        is_midnight = row.get("is_midnight", row.get("午夜场", "false")).lower() in ("true", "1", "是")
        
        return Screening(
            id=screening_id,
            hall_id=hall_id,
            hall_name=hall_name,
            film_name=film_name,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration_minutes,
            date=screening_date,
            film_id=film_id,
            language=language,
            format_3d=format_3d,
            is_midnight=is_midnight
        )
    
    def _parse_projector_log(self, data: Dict[str, Any]) -> ProjectorLog:
        """
        解析放映机日志
        
        Args:
            data: JSON数据
            
        Returns:
            ProjectorLog对象
        """
        # 必需字段
        hall_id = data.get("hall_id", data.get("影厅ID", ""))
        event_time_str = data.get("event_time", data.get("事件时间", ""))
        event_type = data.get("event_type", data.get("事件类型", ""))
        status = data.get("status", data.get("状态", ""))
        
        # 解析时间
        event_time = self._parse_datetime(event_time_str)
        
        # 生成ID
        log_id = data.get("id", str(uuid4()))
        
        # 可选字段
        lamp_hours = data.get("lamp_hours", data.get("灯泡小时数"))
        if lamp_hours is not None:
            lamp_hours = float(lamp_hours)
        
        temperature = data.get("temperature", data.get("温度"))
        if temperature is not None:
            temperature = float(temperature)
        
        message = data.get("message", data.get("消息"))
        
        return ProjectorLog(
            id=log_id,
            hall_id=hall_id,
            event_time=event_time,
            event_type=event_type,
            status=status,
            lamp_hours=lamp_hours,
            temperature=temperature,
            message=message
        )
    
    def _parse_lamp_hours(self, row: Dict[str, str]) -> LampHours:
        """
        解析灯泡小时数记录
        
        Args:
            row: CSV行数据
            
        Returns:
            LampHours对象
        """
        # 必需字段
        hall_id = row.get("hall_id", row.get("影厅ID", ""))
        date_str = row.get("date", row.get("日期", ""))
        
        # 解析日期
        record_date = self._parse_date(date_str) if date_str else date.today()
        
        # 小时数
        start_hours = float(row.get("start_hours", row.get("开始小时数", 0)))
        end_hours = float(row.get("end_hours", row.get("结束小时数", start_hours)))
        used_hours = float(row.get("used_hours", row.get("使用小时数", end_hours - start_hours)))
        
        # 可选字段
        projector_model = row.get("projector_model", row.get("放映机型号"))
        lamp_model = row.get("lamp_model", row.get("灯泡型号"))
        
        max_lamp_hours = row.get("max_lamp_hours", row.get("最大灯泡小时数"))
        if max_lamp_hours is not None:
            max_lamp_hours = float(max_lamp_hours)
        
        return LampHours(
            hall_id=hall_id,
            date=record_date,
            start_hours=start_hours,
            end_hours=end_hours,
            used_hours=used_hours,
            projector_model=projector_model,
            lamp_model=lamp_model,
            max_lamp_hours=max_lamp_hours
        )
    
    def _parse_hall_rule(self, data: Dict[str, Any]) -> HallRules:
        """
        解析影厅规则
        
        Args:
            data: YAML解析后的数据
            
        Returns:
            HallRules对象
        """
        # 必需字段
        hall_id = data.get("hall_id", data.get("影厅ID", ""))
        hall_name = data.get("hall_name", data.get("影厅名称", hall_id))
        
        # 时间规则
        warmup_minutes = int(data.get("warmup_minutes", data.get("预热分钟数", 15)))
        cooldown_minutes = int(data.get("cooldown_minutes", data.get("冷却分钟数", 5)))
        cleanup_minutes = int(data.get("cleanup_minutes", data.get("清场分钟数", 10)))
        
        # 设备规则
        max_lamp_hours = float(data.get("max_lamp_hours", data.get("最大灯泡小时数", 2000.0)))
        lamp_warning_threshold = float(data.get("lamp_warning_threshold", data.get("灯泡警告阈值", 1800.0)))
        
        # 其他配置
        capacity = data.get("capacity", data.get("座位数"))
        if capacity is not None:
            capacity = int(capacity)
        
        projector_id = data.get("projector_id", data.get("放映机ID"))
        audio_system = data.get("audio_system", data.get("音响系统"))
        
        return HallRules(
            hall_id=hall_id,
            hall_name=hall_name,
            warmup_minutes=warmup_minutes,
            cooldown_minutes=cooldown_minutes,
            cleanup_minutes=cleanup_minutes,
            max_lamp_hours=max_lamp_hours,
            lamp_warning_threshold=lamp_warning_threshold,
            capacity=capacity,
            projector_id=projector_id,
            audio_system=audio_system
        )
    
    def _get_default_rules(self) -> Dict[str, HallRules]:
        """
        获取默认规则（当没有配置文件时）
        
        Returns:
            默认规则映射
        """
        # 返回一些常见的默认配置
        defaults = {}
        for i in range(1, 11):
            hall_id = f"H{i}"
            defaults[hall_id] = HallRules(
                hall_id=hall_id,
                hall_name=f"{i}号厅"
            )
        return defaults
    
    @staticmethod
    def _parse_datetime(dt_str: str) -> datetime:
        """
        解析日期时间字符串，支持多种格式
        
        Args:
            dt_str: 日期时间字符串
            
        Returns:
            datetime对象
            
        Raises:
            ValueError: 当无法解析时
        """
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str.strip(), fmt)
            except ValueError:
                continue
        
        # 尝试只带时间的情况（假设今天）
        time_formats = ["%H:%M:%S", "%H:%M", "%H:%M %p", "%I:%M %p"]
        for fmt in time_formats:
            try:
                t = datetime.strptime(dt_str.strip(), fmt).time()
                return datetime.combine(date.today(), t)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期时间: {dt_str}")
    
    @staticmethod
    def _parse_date(date_str: str) -> date:
        """
        解析日期字符串
        
        Args:
            date_str: 日期字符串
            
        Returns:
            date对象
            
        Raises:
            ValueError: 当无法解析时
        """
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y%m%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期: {date_str}")
