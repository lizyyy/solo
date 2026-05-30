"""核心数据模型。

定义潮位、船舶、泊位、风速等核心数据结构，以及安全靠泊的计算公式。
所有单位在模块文档中明确标注，避免混用。
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import pytz

from .exceptions import (
    DraftExceedError,
    MissingDataError,
    TimeZoneError,
    UnitError,
    ValidationError,
    WindSpeedExceedError,
)


# ========== 单位定义 ==========
# 长度单位: 米 (m)
# 速度单位: 米/秒 (m/s) 或 节 (kn) - 内部统一使用 m/s
# 时间单位: 秒 (s)，展示用 ISO 格式
# 潮位基准: 理论最低潮面 (LAT)
# 水深基准: 理论最低潮面 (LAT)

UNIT_CONVERSIONS = {
    "m_to_ft": 3.28084,
    "ft_to_m": 1 / 3.28084,
    "mps_to_kn": 1.94384,
    "kn_to_mps": 1 / 1.94384,
    "cm_to_m": 0.01,
    "m_to_cm": 100,
}


def convert_unit(value: float, from_unit: str, to_unit: str) -> float:
    """单位转换函数。

    参数:
        value: 数值
        from_unit: 原单位 (m, ft, cm, m/s, kn)
        to_unit: 目标单位 (m, ft, cm, m/s, kn)
    """
    key = f"{from_unit}_to_{to_unit}"
    if key in UNIT_CONVERSIONS:
        return value * UNIT_CONVERSIONS[key]
    raise UnitError(
        f"不支持的单位转换: {from_unit} -> {to_unit}",
        expected_unit=to_unit,
        actual_unit=from_unit,
        details={"value": value},
    )


# ========== 数据版本管理 ==========

@dataclass
class DataVersion:
    """数据版本信息。

    用于追踪数据的来源、导入时间、版本号，确保不覆盖旧口径数据。
    """

    version_id: str
    source_file: str
    imported_at: datetime
    data_type: str  # "tide", "wind", "ship", "berth", "note"
    notes: str = ""
    is_active: bool = True  # 标记是否为当前生效版本

    def __str__(self) -> str:
        return f"{self.data_type} v{self.version_id} ({self.source_file})"


@dataclass
class VersionedData:
    """带版本标记的数据基类。

    所有导入的数据都保留版本信息，便于追溯和冲突检测。
    """

    version: DataVersion
    line_number: Optional[int] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


# ========== 潮位数据 ==========

@dataclass
class TideReading(VersionedData):
    """潮位读数。

    属性:
        time: 时间（带时区）
        tide_level: 潮位高度，单位：米 (m)，基准：理论最低潮面
        uncertainty: 预报不确定度，单位：米 (m)
    """

    time: datetime = field(default_factory=lambda: datetime.now(pytz.UTC))
    tide_level: float = 0.0
    uncertainty: float = 0.0

    def validate(self) -> None:
        """验证潮位数据有效性。"""
        if self.time.tzinfo is None:
            raise TimeZoneError(
                "潮位数据缺少时区信息",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"tide_{self.time.isoformat()}",
                expected_tz="Asia/Shanghai 或 UTC",
                details={"raw_time": self.time.isoformat()},
            )

        if not (-5.0 <= self.tide_level <= 10.0):
            raise ValidationError(
                f"潮位值超出合理范围: {self.tide_level}m",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"tide_{self.time.isoformat()}",
                field_name="tide_level",
                invalid_value=self.tide_level,
                expected_range="[-5.0, 10.0] 米",
            )


@dataclass
class TideCurve:
    """潮位曲线。

    包含一段时间内的潮位预报数据，支持插值查询。
    """

    readings: List[TideReading] = field(default_factory=list)

    def add_reading(self, reading: TideReading) -> None:
        """添加潮位读数，按时间排序。"""
        reading.validate()
        self.readings.append(reading)
        self.readings.sort(key=lambda r: r.time)

    def get_tide_at(self, time: datetime, interpolate: bool = True) -> Tuple[float, float]:
        """查询指定时间的潮位。

        参数:
            time: 查询时间
            interpolate: 是否线性插值

        返回:
            (潮位高度, 不确定度) 单位：米

        边界处理:
            - 时间早于所有数据: 返回最早点数据并标记外推
            - 时间晚于所有数据: 返回最晚点数据并标记外推
            - 时间在两点之间: 线性插值
        """
        if not self.readings:
            raise MissingDataError(
                "潮位数据为空，无法查询",
                missing_field="tide_readings",
                missing_time=time.isoformat(),
            )

        if time < self.readings[0].time:
            r = self.readings[0]
            return r.tide_level, r.uncertainty + abs((time - r.time).total_seconds()) / 3600 * 0.01

        if time > self.readings[-1].time:
            r = self.readings[-1]
            return r.tide_level, r.uncertainty + abs((time - r.time).total_seconds()) / 3600 * 0.01

        if interpolate:
            for i in range(len(self.readings) - 1):
                r1, r2 = self.readings[i], self.readings[i + 1]
                if r1.time <= time <= r2.time:
                    dt = (r2.time - r1.time).total_seconds()
                    if dt == 0:
                        return r1.tide_level, max(r1.uncertainty, r2.uncertainty)
                    t = (time - r1.time).total_seconds() / dt
                    level = r1.tide_level + t * (r2.tide_level - r1.tide_level)
                    uncertainty = max(r1.uncertainty, r2.uncertainty)
                    return level, uncertainty

        closest = min(self.readings, key=lambda r: abs((r.time - time).total_seconds()))
        return closest.tide_level, closest.uncertainty


# ========== 风速数据 ==========

@dataclass
class WindReading(VersionedData):
    """风速读数。

    属性:
        time: 时间（带时区）
        speed: 风速，单位：米/秒 (m/s)
        direction: 风向，单位：度 (0-360)，0度为正北
        gust: 阵风速度，单位：米/秒 (m/s)
        uncertainty: 预报不确定度
    """

    time: datetime = field(default_factory=lambda: datetime.now(pytz.UTC))
    speed: float = 0.0
    direction: Optional[float] = None
    gust: Optional[float] = None
    uncertainty: float = 0.0

    def validate(self) -> None:
        """验证风速数据有效性。"""
        if self.time.tzinfo is None:
            raise TimeZoneError(
                "风速数据缺少时区信息",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"wind_{self.time.isoformat()}",
                expected_tz="Asia/Shanghai 或 UTC",
                details={"raw_time": self.time.isoformat()},
            )

        if self.speed < 0 or self.speed > 80:
            raise ValidationError(
                f"风速值超出合理范围: {self.speed} m/s",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"wind_{self.time.isoformat()}",
                field_name="speed",
                invalid_value=self.speed,
                expected_range="[0, 80] 米/秒",
            )

        if self.gust is not None and self.gust < self.speed:
            raise ValidationError(
                f"阵风速度小于持续风速: 阵风 {self.gust} m/s < 持续 {self.speed} m/s",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"wind_{self.time.isoformat()}",
                field_name="gust",
                invalid_value=self.gust,
                expected_range=f">= {self.speed} 米/秒",
            )


@dataclass
class WindForecast:
    """风速预报序列。"""

    readings: List[WindReading] = field(default_factory=list)

    def add_reading(self, reading: WindReading) -> None:
        """添加风速读数。"""
        reading.validate()
        self.readings.append(reading)
        self.readings.sort(key=lambda r: r.time)

    def get_wind_at(self, time: datetime) -> Tuple[float, Optional[float], Optional[float], float]:
        """查询指定时间的风速。

        返回:
            (持续风速, 风向, 阵风, 不确定度)
        """
        if not self.readings:
            raise MissingDataError(
                "风速数据为空，无法查询",
                missing_field="wind_readings",
                missing_time=time.isoformat(),
            )

        if time < self.readings[0].time:
            r = self.readings[0]
            return r.speed, r.direction, r.gust, r.uncertainty + 2.0

        if time > self.readings[-1].time:
            r = self.readings[-1]
            return r.speed, r.direction, r.gust, r.uncertainty + 2.0

        for i in range(len(self.readings) - 1):
            r1, r2 = self.readings[i], self.readings[i + 1]
            if r1.time <= time <= r2.time:
                dt = (r2.time - r1.time).total_seconds()
                if dt == 0:
                    return r1.speed, r1.direction, r1.gust, max(r1.uncertainty, r2.uncertainty)
                t = (time - r1.time).total_seconds() / dt
                speed = r1.speed + t * (r2.speed - r1.speed)
                direction = r1.direction if r1.direction == r2.direction else None
                gust = None
                if r1.gust is not None and r2.gust is not None:
                    gust = r1.gust + t * (r2.gust - r1.gust)
                uncertainty = max(r1.uncertainty, r2.uncertainty)
                return speed, direction, gust, uncertainty

        closest = min(self.readings, key=lambda r: abs((r.time - time).total_seconds()))
        return closest.speed, closest.direction, closest.gust, closest.uncertainty


# ========== 船舶数据 ==========

@dataclass
class Ship(VersionedData):
    """船舶信息。

    属性:
        imo: IMO编号
        name: 船名
        draft: 船舶吃水，单位：米 (m)
        length: 船长，单位：米 (m)
        beam: 船宽，单位：米 (m)
        maneuverability: 操纵性评级 (1-5，5最好)
    """

    imo: str = ""
    name: str = ""
    draft: float = 0.0
    length: float = 0.0
    beam: float = 0.0
    maneuverability: int = 3

    def validate(self) -> None:
        """验证船舶数据有效性。"""
        if not self.imo and not self.name:
            raise ValidationError(
                "船舶IMO编号和船名不能同时为空",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"ship_{self.imo or self.name}",
                field_name="imo/name",
            )

        if self.draft <= 0 or self.draft > 30:
            raise ValidationError(
                f"船舶吃水超出合理范围: {self.draft}m",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"ship_{self.imo or self.name}",
                field_name="draft",
                invalid_value=self.draft,
                expected_range="(0, 30] 米",
            )

        if self.maneuverability < 1 or self.maneuverability > 5:
            raise ValidationError(
                f"操纵性评级超出范围: {self.maneuverability}",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"ship_{self.imo or self.name}",
                field_name="maneuverability",
                invalid_value=self.maneuverability,
                expected_range="[1, 5]",
            )


# ========== 泊位数据 ==========

@dataclass
class Berth(VersionedData):
    """泊位信息。

    属性:
        berth_id: 泊位编号
        name: 泊位名称
        design_depth: 设计水深，单位：米 (m)，基准：理论最低潮面
        max_length: 最大允许船长，单位：米 (m)
        max_beam: 最大允许船宽，单位：米 (m)
        wind_limit: 安全靠泊风速限制，单位：米/秒 (m/s)
        under_keel_margin: 要求的龙骨下最小富余水深，单位：米 (m)
        approach_channel_depth: 进港航道水深，单位：米 (m)
    """

    berth_id: str = ""
    name: str = ""
    design_depth: float = 0.0
    max_length: float = 0.0
    max_beam: float = 0.0
    wind_limit: float = 15.0
    under_keel_margin: float = 0.5
    approach_channel_depth: float = 0.0

    def validate(self) -> None:
        """验证泊位数据有效性。"""
        if not self.berth_id:
            raise ValidationError(
                "泊位编号不能为空",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"berth_{self.name}",
                field_name="berth_id",
            )

        if self.design_depth <= 0 or self.design_depth > 50:
            raise ValidationError(
                f"泊位设计水深超出合理范围: {self.design_depth}m",
                source_file=self.version.source_file,
                line_number=self.line_number,
                object_id=f"berth_{self.berth_id}",
                field_name="design_depth",
                invalid_value=self.design_depth,
                expected_range="(0, 50] 米",
            )


# ========== 调度备注 ==========

@dataclass
class ScheduleNote(VersionedData):
    """调度备注。

    用于记录临时补充信息、特殊限制等。
    """

    time: datetime = field(default_factory=lambda: datetime.now(pytz.UTC))
    content: str = ""
    priority: int = 1  # 1-普通, 2-重要, 3-紧急
    related_ship: Optional[str] = None
    related_berth: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None

    def is_effective(self, check_time: datetime) -> bool:
        """检查备注在指定时间是否生效。"""
        if self.effective_from and check_time < self.effective_from:
            return False
        if self.effective_to and check_time > self.effective_to:
            return False
        return True


# ========== 安全校验结果 ==========

@dataclass
class SafetyCheckResult:
    """安全校验结果。

    记录某一时间点的所有安全校验项结果。
    """

    time: datetime
    is_safe: bool
    tide_level: float
    tide_uncertainty: float
    available_depth: float
    required_depth: float
    depth_margin: float
    wind_speed: float
    wind_gust: Optional[float]
    wind_limit: float
    wind_margin: float
    draft_check: bool
    wind_check: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def explain(self) -> str:
        """生成人类可读的结果解释。"""
        lines = [
            f"时间: {self.time.strftime('%Y-%m-%d %H:%M %Z')}",
            f"状态: {'✅ 安全' if self.is_safe else '❌ 不安全'}",
            "",
            "吃水校验:",
            f"  潮位: {self.tide_level:.2f}m (±{self.tide_uncertainty:.2f}m)",
            f"  可用水深: {self.available_depth:.2f}m = 泊位水深 + 潮位",
            f"  要求水深: {self.required_depth:.2f}m = 船舶吃水 + 富余水深",
            f"  水深余量: {self.depth_margin:.2f}m {'✅' if self.depth_margin >= 0 else '❌'}",
            "",
            "风速校验:",
            f"  持续风速: {self.wind_speed:.1f} m/s",
            f"  阵风: {self.wind_gust:.1f} m/s" if self.wind_gust else "  阵风: 无数据",
            f"  风速限制: {self.wind_limit:.1f} m/s",
            f"  风速余量: {self.wind_margin:.1f} m/s {'✅' if self.wind_margin >= 0 else '❌'}",
        ]

        if self.errors:
            lines.append("")
            lines.append("错误:")
            for err in self.errors:
                lines.append(f"  ❌ {err}")

        if self.warnings:
            lines.append("")
            lines.append("警告:")
            for warn in self.warnings:
                lines.append(f"  ⚠️  {warn}")

        return "\n".join(lines)


# ========== 靠泊窗口 ==========

@dataclass
class BerthWindow:
    """靠泊窗口。

    表示一段连续的安全靠泊时间。
    """

    window_id: str
    ship: Ship
    berth: Berth
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    check_results: List[SafetyCheckResult] = field(default_factory=list)
    notes: List[ScheduleNote] = field(default_factory=list)
    confidence: float = 1.0  # 置信度 0-1

    @property
    def min_depth_margin(self) -> float:
        """窗口内最小水深余量。"""
        return min(r.depth_margin for r in self.check_results) if self.check_results else 0.0

    @property
    def max_wind_speed(self) -> float:
        """窗口内最大风速。"""
        return max(r.wind_speed for r in self.check_results) if self.check_results else 0.0

    def explain(self) -> str:
        """生成窗口解释。"""
        lines = [
            f"靠泊窗口: {self.window_id}",
            f"船舶: {self.ship.name} (IMO: {self.ship.imo})",
            f"泊位: {self.berth.name} ({self.berth.berth_id})",
            f"开始: {self.start_time.strftime('%Y-%m-%d %H:%M %Z')}",
            f"结束: {self.end_time.strftime('%Y-%m-%d %H:%M %Z')}",
            f"时长: {self.duration_minutes} 分钟",
            f"最小水深余量: {self.min_depth_margin:.2f}m",
            f"最大风速: {self.max_wind_speed:.1f} m/s",
            f"置信度: {self.confidence:.1%}",
        ]

        if self.notes:
            lines.append("")
            lines.append("相关备注:")
            for note in self.notes:
                priority = "🔴" if note.priority == 3 else "🟡" if note.priority == 2 else "⚪"
                lines.append(f"  {priority} {note.content}")

        return "\n".join(lines)
