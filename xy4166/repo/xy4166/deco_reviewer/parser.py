import csv
from datetime import datetime
from typing import List, Optional, Dict
from pathlib import Path

from .models import (
    DiveLog,
    DiveProfilePoint,
    GasMix,
    GasType,
    SafetyStop,
)


class CSVParser:
    """潜水日志CSV解析器"""

    COLUMN_MAPPING: Dict[str, List[str]] = {
        "dive_id": ["dive_id", "潜水id", "潜水编号", "diveid"],
        "diver_name": ["diver_name", "潜水员", "姓名", "diver", "name"],
        "dive_date": ["dive_date", "潜水日期", "日期", "date"],
        "surface_interval_minutes": ["surface_interval_minutes", "水面间隔", "间隔时间", "surface_interval"],
        "gas_type": ["gas_type", "气体类型", "混合气", "gastype", "gas"],
        "o2_percent": ["o2_percent", "氧气百分比", "o2%", "氧气", "o2"],
        "n2_percent": ["n2_percent", "氮气百分比", "n2%", "氮气", "n2"],
        "he_percent": ["he_percent", "氦气百分比", "he%", "氦气", "he"],
        "safety_stop_depth": ["safety_stop_depth", "安全停留深度", "停留深度"],
        "safety_stop_duration": ["safety_stop_duration", "安全停留时间", "停留时间"],
        "time": ["time", "时间", "minute", "min"],
        "depth": ["depth", "深度", "meter", "m"],
        "temperature": ["temperature", "温度", "temp", "水温"],
    }

    def __init__(self):
        self.dive_log = None

    def parse(self, csv_path: Path) -> DiveLog:
        """解析CSV文件"""
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV文件不存在: {csv_path}")

        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        dive_log = self._extract_dive_info(rows)
        dive_log.profile = self._extract_profile(rows)
        dive_log.gas_mix = self._extract_gas_mix(rows)
        dive_log.safety_stops = self._extract_safety_stops(rows)

        self.dive_log = dive_log
        return dive_log

    def _extract_dive_info(self, rows: List[dict]) -> DiveLog:
        """提取潜水基本信息"""
        dive_id = self._get_field(rows, "dive_id", default=f"DIVE_{datetime.now().strftime('%Y%m%d%H%M%S')}")
        diver_name = self._get_field(rows, "diver_name", default="未知潜水员")
        
        dive_date_str = self._get_field(rows, "dive_date", default=datetime.now().strftime("%Y-%m-%d"))
        dive_date = datetime.strptime(dive_date_str, "%Y-%m-%d")

        surface_interval = self._get_field(rows, "surface_interval_minutes", default=None)
        surface_interval_minutes = int(surface_interval) if surface_interval else None

        return DiveLog(
            dive_id=dive_id,
            diver_name=diver_name,
            dive_date=dive_date,
            surface_interval_minutes=surface_interval_minutes,
        )

    def _extract_profile(self, rows: List[dict]) -> List[DiveProfilePoint]:
        """提取潜水剖面数据"""
        profile = []
        
        for row in rows:
            time_str = self._get_value_from_row(row, "time")
            depth_str = self._get_value_from_row(row, "depth")
            
            if time_str is None or depth_str is None:
                continue
            
            try:
                time = int(float(time_str))
                depth = float(depth_str)
            except (ValueError, TypeError):
                continue
            
            temp_str = self._get_value_from_row(row, "temperature")
            temperature = float(temp_str) if temp_str else None
            
            exists = any(p.time == time and abs(p.depth - depth) < 0.01 for p in profile)
            if not exists:
                profile.append(DiveProfilePoint(
                    time=time,
                    depth=depth,
                    temperature=temperature,
                ))

        profile.sort(key=lambda p: p.time)
        return profile

    def _extract_gas_mix(self, rows: List[dict]) -> GasMix:
        """提取气瓶混合气信息"""
        gas_type_str = (self._get_field(rows, "gas_type", default="air") or "air").lower()
        o2_str = self._get_field(rows, "o2_percent", default="21")
        n2_str = self._get_field(rows, "n2_percent", default="79")
        he_str = self._get_field(rows, "he_percent", default="0")

        try:
            o2_percent = float(o2_str)
            n2_percent = float(n2_str)
            he_percent = float(he_str)
        except ValueError:
            o2_percent = 21.0
            n2_percent = 79.0
            he_percent = 0.0

        if gas_type_str == "nitrox" or o2_percent > 21:
            gas_type = GasType.NITROX
        elif gas_type_str == "trimix" or he_percent > 0:
            gas_type = GasType.TRIMIX
        else:
            gas_type = GasType.AIR

        return GasMix(
            gas_type=gas_type,
            o2_percent=o2_percent,
            n2_percent=n2_percent,
            he_percent=he_percent,
        )

    def _extract_safety_stops(self, rows: List[dict]) -> List[SafetyStop]:
        """提取安全停留记录"""
        stops = []
        
        stop_depth_str = self._get_field(rows, "safety_stop_depth", default=None)
        stop_duration_str = self._get_field(rows, "safety_stop_duration", default=None)
        
        if stop_depth_str and stop_duration_str:
            try:
                depth = float(stop_depth_str)
                duration = int(stop_duration_str)
                stops.append(SafetyStop(depth=depth, duration=duration))
            except ValueError:
                pass

        for i in range(1, 5):
            depth_str = self._get_field(rows, f"safety_stop_{i}_depth", default=None)
            duration_str = self._get_field(rows, f"safety_stop_{i}_duration", default=None)
            
            if depth_str and duration_str:
                try:
                    depth = float(depth_str)
                    duration = int(duration_str)
                    stops.append(SafetyStop(depth=depth, duration=duration))
                except ValueError:
                    pass

        return stops

    def _get_value_from_row(self, row: dict, field_name: str) -> Optional[str]:
        """从单行中获取字段值（支持中英文列名）"""
        variants = self.COLUMN_MAPPING.get(field_name, [field_name.lower()])
        
        for key, value in row.items():
            if key:
                key_lower = key.strip().lower()
                if key_lower in variants:
                    if value is not None and value.strip():
                        return value.strip()
        return None

    def _get_field(self, rows: List[dict], field_name: str, default=None) -> Optional[str]:
        """从所有行中获取字段值"""
        variants = self.COLUMN_MAPPING.get(field_name, [field_name.lower()])
        
        for row in rows:
            for key, value in row.items():
                if key:
                    key_lower = key.strip().lower()
                    if key_lower in variants:
                        if value is not None and value.strip():
                            return value.strip()
        return default
