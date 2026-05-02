"""曲线解析模块 - 导入CSV温度记录、解析计划曲线配置"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
import numpy as np
import pandas as pd

from .models import (
    MeasuredCurve,
    TemperaturePoint,
    PlannedCurve,
    CurveSegment,
    SegmentType,
    FiringRecipe,
    KilnParameters,
    BodyProperties,
    GlazeProperties,
    FiringType,
)


class CSVParser:
    """CSV温度记录解析器"""

    SUPPORTED_TIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%H:%M:%S",
        "%M:%S",
    ]

    COMMON_TEMP_COLUMNS = ['温度', 'temperature', 'temp', 'T', '°C', 'Temp', 'Temperature']
    COMMON_TIME_COLUMNS = ['时间', 'time', 'Time', 'timestamp', 'Timestamp', 'datetime', 'DateTime']
    COMMON_SENSOR_COLUMNS = ['传感器', 'sensor', 'Sensor', '通道', 'channel', 'Channel']

    def __init__(self):
        self.encoding = 'utf-8'
        self.delimiter = ','

    def parse_file(self, file_path: Path, kiln_name: str = "Unknown") -> MeasuredCurve:
        """解析CSV文件为实测曲线"""
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        df = self._read_csv_with_detection(file_path)
        return self._parse_dataframe(df, kiln_name)

    def _read_csv_with_detection(self, file_path: Path) -> pd.DataFrame:
        """自动检测编码和分隔符读取CSV"""
        encodings = ['utf-8', 'gbk', 'gb2312', 'utf-8-sig', 'latin1']

        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    first_lines = [next(f) for _ in range(min(5, sum(1 for _ in open(file_path, encoding=encoding))))]

                delimiter = self._detect_delimiter(first_lines)

                df = pd.read_csv(
                    file_path,
                    encoding=encoding,
                    sep=delimiter,
                    skip_blank_lines=True,
                    on_bad_lines='skip'
                )

                self.encoding = encoding
                self.delimiter = delimiter
                return df

            except (UnicodeDecodeError, pd.errors.ParserError):
                continue

        raise ValueError(f"无法解析文件 {file_path}，尝试了多种编码和分隔符")

    def _detect_delimiter(self, lines: List[str]) -> str:
        """自动检测分隔符"""
        delimiters = [',', ';', '\t', '|', ' ']
        counts: Dict[str, int] = {}

        for line in lines:
            for delim in delimiters:
                count = line.count(delim)
                if count > 0:
                    counts[delim] = counts.get(delim, 0) + count

        if counts:
            return max(counts.keys(), key=lambda k: counts[k])

        return ','

    def _parse_dataframe(self, df: pd.DataFrame, kiln_name: str) -> MeasuredCurve:
        """解析DataFrame为实测曲线"""
        time_col = self._find_column(df.columns, self.COMMON_TIME_COLUMNS)
        temp_col = self._find_column(df.columns, self.COMMON_TEMP_COLUMNS)
        sensor_col = self._find_column(df.columns, self.COMMON_SENSOR_COLUMNS)

        if temp_col is None:
            raise ValueError("无法找到温度列，请确保CSV包含温度数据列")

        data_points: List[TemperaturePoint] = []
        start_time = None

        for idx, row in df.iterrows():
            try:
                temp = float(row[temp_col])

                if time_col is not None and pd.notna(row[time_col]):
                    timestamp = self._parse_time(str(row[time_col]))
                else:
                    timestamp = datetime.now()

                sensor_id = 0
                if sensor_col is not None and pd.notna(row[sensor_col]):
                    try:
                        sensor_id = int(row[sensor_col])
                    except ValueError:
                        sensor_id = 0

                if start_time is None:
                    start_time = timestamp

                data_points.append(TemperaturePoint(
                    timestamp=timestamp,
                    temperature=temp,
                    sensor_id=sensor_id,
                    is_valid=self._is_valid_temperature(temp)
                ))

            except (ValueError, TypeError):
                continue

        if not data_points:
            raise ValueError("CSV文件中没有有效的温度数据")

        sampling_interval = self._calculate_sampling_interval(data_points)

        return MeasuredCurve(
            kiln_name=kiln_name,
            start_time=start_time or datetime.now(),
            end_time=data_points[-1].timestamp if data_points else None,
            data_points=data_points,
            sampling_interval=sampling_interval,
            sensor_count=self._count_sensors(data_points)
        )

    def _find_column(self, columns: pd.Index, candidates: List[str]) -> Optional[str]:
        """在列名中查找匹配的列"""
        columns_lower = [str(c).lower().strip() for c in columns]

        for candidate in candidates:
            candidate_lower = candidate.lower().strip()
            for idx, col in enumerate(columns_lower):
                if candidate_lower in col or col in candidate_lower:
                    return str(columns[idx])

        return None

    def _parse_time(self, time_str: str) -> datetime:
        """解析时间字符串，支持多种格式"""
        time_str = time_str.strip()

        for fmt in self.SUPPORTED_TIME_FORMATS:
            try:
                return datetime.strptime(time_str, fmt)
            except ValueError:
                continue

        try:
            return pd.to_datetime(time_str).to_pydatetime()
        except (ValueError, TypeError):
            pass

        try:
            minutes = float(time_str)
            base_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            return base_time + pd.Timedelta(minutes=minutes).to_pytimedelta()
        except ValueError:
            pass

        return datetime.now()

    def _is_valid_temperature(self, temp: float) -> bool:
        """检查温度值是否有效"""
        return -50.0 <= temp <= 1800.0

    def _calculate_sampling_interval(self, points: List[TemperaturePoint]) -> Optional[float]:
        """计算平均采样间隔（分钟）"""
        if len(points) < 2:
            return None

        intervals = []
        for i in range(1, len(points)):
            delta = (points[i].timestamp - points[i-1].timestamp).total_seconds()
            if delta > 0:
                intervals.append(delta / 60.0)

        if intervals:
            return float(np.mean(intervals))
        return None

    def _count_sensors(self, points: List[TemperaturePoint]) -> int:
        """统计传感器数量"""
        sensor_ids = set(p.sensor_id for p in points)
        return len(sensor_ids)


class PlanCurveParser:
    """计划曲线解析器"""

    def parse_json_file(self, file_path: Path) -> PlannedCurve:
        """从JSON文件解析计划曲线"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return self.parse_json(data)

    def parse_json(self, data: Dict[str, Any]) -> PlannedCurve:
        """从字典解析计划曲线"""
        segments_data = data.get('segments', [])
        segments: List[CurveSegment] = []

        for seg_data in segments_data:
            seg_type = SegmentType(seg_data.get('segment_type', 'ramp'))
            segments.append(CurveSegment(
                segment_type=seg_type,
                start_temp=seg_data.get('start_temp', 0.0),
                end_temp=seg_data.get('end_temp', 0.0),
                duration=seg_data.get('duration', 0.0),
                rate=seg_data.get('rate')
            ))

        created_at = data.get('created_at')
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except ValueError:
                created_at = datetime.now()

        return PlannedCurve(
            recipe_name=data.get('recipe_name', 'Unknown'),
            kiln_name=data.get('kiln_name', 'Unknown'),
            created_at=created_at or datetime.now(),
            segments=segments,
            preheat_included=data.get('preheat_included', True)
        )

    def generate_default_curve(
        self,
        recipe: FiringRecipe,
        kiln: KilnParameters
    ) -> PlannedCurve:
        """根据配方和窑炉参数生成默认计划曲线"""
        segments: List[CurveSegment] = []
        current_temp = 25.0

        max_rate = min(
            recipe.max_allowed_heating_rate or 5.0,
            kiln.max_heating_rate
        )

        preheat_end_temp = 200.0
        if current_temp < preheat_end_temp:
            preheat_rate = min(max_rate * 0.6, 2.0)
            preheat_duration = (preheat_end_temp - current_temp) / preheat_rate
            segments.append(CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=current_temp,
                end_temp=preheat_end_temp,
                duration=preheat_duration,
                rate=preheat_rate
            ))
            current_temp = preheat_end_temp

        mid_temp = 600.0
        if current_temp < mid_temp:
            mid_duration = (mid_temp - current_temp) / max_rate
            segments.append(CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=current_temp,
                end_temp=mid_temp,
                duration=mid_duration,
                rate=max_rate
            ))
            current_temp = mid_temp

        if recipe.firing_type == FiringType.GLAZE:
            glaze_safe_rate = max_rate * 0.7
            glaze_safe_duration = (recipe.target_temperature - current_temp) / glaze_safe_rate
            segments.append(CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=current_temp,
                end_temp=recipe.target_temperature,
                duration=glaze_safe_duration,
                rate=glaze_safe_rate
            ))
        else:
            bisque_duration = (recipe.target_temperature - current_temp) / max_rate
            segments.append(CurveSegment(
                segment_type=SegmentType.RAMP,
                start_temp=current_temp,
                end_temp=recipe.target_temperature,
                duration=bisque_duration,
                rate=max_rate
            ))

        current_temp = recipe.target_temperature
        hold_time = 30.0
        if recipe.glaze and recipe.glaze.hold_time_recommended:
            hold_time = recipe.glaze.hold_time_recommended
        segments.append(CurveSegment(
            segment_type=SegmentType.HOLD,
            start_temp=current_temp,
            end_temp=current_temp,
            duration=hold_time,
            rate=0.0
        ))

        cool_start_temp = current_temp
        critical_temp = recipe.body.critical_cooling_rate
        safe_cool_rate = kiln.max_cooling_rate * 0.5

        cool_end_temp = 500.0
        if cool_start_temp > cool_end_temp:
            cool_duration = (cool_start_temp - cool_end_temp) / safe_cool_rate
            segments.append(CurveSegment(
                segment_type=SegmentType.COOL,
                start_temp=cool_start_temp,
                end_temp=cool_end_temp,
                duration=cool_duration,
                rate=-safe_cool_rate
            ))

        return PlannedCurve(
            recipe_name=recipe.name,
            kiln_name=kiln.name,
            segments=segments,
            preheat_included=True
        )


class ConfigurationLoader:
    """配置文件加载器"""

    @staticmethod
    def load_kiln_parameters(file_path: Path) -> KilnParameters:
        """加载窑炉参数配置"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return KilnParameters(**data)

    @staticmethod
    def load_recipe(file_path: Path) -> FiringRecipe:
        """加载烧成配方"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        body_data = data.get('body', {})
        glaze_data = data.get('glaze')

        body = BodyProperties(
            name=body_data.get('name', 'Unknown'),
            thickness_range=tuple(body_data.get('thickness_range', [0.5, 3.0])),
            thermal_conductivity=body_data.get('thermal_conductivity', 1.0),
            porosity=body_data.get('porosity', 0.3),
            recommended_bisque_temp=body_data.get('recommended_bisque_temp', 1000.0),
            critical_cooling_rate=body_data.get('critical_cooling_rate', 3.0)
        )

        glaze = None
        if glaze_data:
            glaze = GlazeProperties(
                name=glaze_data.get('name', 'Unknown'),
                maturing_temp_range=tuple(glaze_data.get('maturing_temp_range', [1180.0, 1280.0])),
                hold_time_recommended=glaze_data.get('hold_time_recommended', 30.0),
                expansion_coefficient=glaze_data.get('expansion_coefficient', 5.0),
                is_matte=glaze_data.get('is_matte', False)
            )

        return FiringRecipe(
            name=data.get('name', 'Unknown Recipe'),
            firing_type=FiringType(data.get('firing_type', 'bisque')),
            target_temperature=data.get('target_temperature', 1000.0),
            total_thickness=data.get('total_thickness', 1.5),
            body=body,
            glaze=glaze,
            max_allowed_heating_rate=data.get('max_allowed_heating_rate'),
            notes=data.get('notes')
        )
