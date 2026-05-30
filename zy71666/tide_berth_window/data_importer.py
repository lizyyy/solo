"""数据导入模块。

支持多种数据格式，保留多版本数据，不覆盖旧口径。
导入时自动检测异常数据，报告来源文件和行号。
"""

from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd
import pytz
from dateutil import parser as date_parser

from .exceptions import (
    DataConflictError,
    MissingDataError,
    TideBerthException,
    TimeZoneError,
    ValidationError,
)
from .models import (
    Berth,
    DataVersion,
    ScheduleNote,
    Ship,
    TideCurve,
    TideReading,
    WindForecast,
    WindReading,
    convert_unit,
)


class DataImporter:
    """数据导入器。

    核心特性：
    1. 多格式支持：CSV, Excel, JSON
    2. 多版本管理：所有导入数据保留版本信息，不覆盖旧数据
    3. 冲突检测：同一时间点的多份数据全部保留，标记冲突
    4. 健壮性：坏数据不崩溃，报告错误位置
    5. 原始数据保留：所有导入的原始数据都保存在 raw_data 中
    """

    def __init__(self, default_timezone: str = "Asia/Shanghai") -> None:
        self.default_timezone = pytz.timezone(default_timezone)
        self.versions: List[DataVersion] = []
        self.import_errors: List[TideBerthException] = []
        self.data_conflicts: List[DataConflictError] = []

        # 存储多版本数据
        self._tide_readings: Dict[str, List[TideReading]] = {}  # version_id -> readings
        self._wind_readings: Dict[str, List[WindReading]] = {}
        self._ships: Dict[str, List[Ship]] = {}
        self._berths: Dict[str, List[Berth]] = {}
        self._notes: Dict[str, List[ScheduleNote]] = {}

        self._version_counter = 0

    def _create_version(self, source_file: str, data_type: str, notes: str = "") -> DataVersion:
        """创建新版本标记。"""
        self._version_counter += 1
        version = DataVersion(
            version_id=f"v{self._version_counter:03d}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            source_file=source_file,
            imported_at=datetime.now(pytz.UTC),
            data_type=data_type,
            notes=notes,
            is_active=True,
        )
        self.versions.append(version)
        return version

    def _parse_time(self, time_str: str, version: DataVersion, line_number: Optional[int] = None) -> datetime:
        """解析时间字符串，自动处理时区。"""
        try:
            dt = date_parser.parse(time_str)

            if dt.tzinfo is None:
                # 没有时区信息，使用默认时区
                dt = self.default_timezone.localize(dt)

                # 记录警告
                warn = TimeZoneError(
                    f"时间字符串 '{time_str}' 缺少时区信息，已默认使用 {self.default_timezone.zone}",
                    source_file=version.source_file,
                    line_number=line_number,
                    object_id=f"time_{time_str}",
                    expected_tz=self.default_timezone.zone,
                    details={"raw_time": time_str, "assumed_tz": self.default_timezone.zone},
                )
                self.import_errors.append(warn)

            return dt

        except Exception as e:
            raise ValidationError(
                f"无法解析时间字符串: '{time_str}'",
                source_file=version.source_file,
                line_number=line_number,
                object_id=f"time_{time_str}",
                field_name="time",
                invalid_value=time_str,
                details={"error": str(e)},
            ) from e

    def _parse_float(self, value_str: str, field_name: str, version: DataVersion,
                     line_number: Optional[int] = None, unit: Optional[str] = None) -> float:
        """解析浮点数值，支持单位转换。"""
        try:
            value = float(value_str)

            if unit and unit != "m" and unit != "m/s":
                target_unit = "m" if field_name in ["tide_level", "draft", "depth", "uncertainty"] else "m/s"
                value = convert_unit(value, unit, target_unit)

            return value
        except ValueError as e:
            raise ValidationError(
                f"无法解析数值: '{value_str}'",
                source_file=version.source_file,
                line_number=line_number,
                object_id=f"{field_name}_{value_str}",
                field_name=field_name,
                invalid_value=value_str,
                details={"error": str(e)},
            ) from e

    # ========== 潮位数据导入 ==========

    def import_tide_data(self, file_path: str, notes: str = "") -> Tuple[TideCurve, List[TideReading]]:
        """导入潮位数据。

        支持格式：
        - CSV: time,tide_level,uncertainty,unit
        - Excel: 同CSV列名
        - JSON: [{time, tide_level, uncertainty, unit}, ...]

        所有版本数据都会保留，不会覆盖旧版本。
        """
        if not os.path.exists(file_path):
            raise MissingDataError(
                f"潮位数据文件不存在: {file_path}",
                source_file=file_path,
                missing_field="tide_file",
            )

        version = self._create_version(file_path, "tide", notes)
        readings: List[TideReading] = []
        raw_data_list = self._read_file(file_path)

        for i, row in enumerate(raw_data_list, start=2):  # 行号从2开始（跳过表头）
            try:
                time_str = str(row.get("time") or row.get("Time") or row.get("TIME") or row.get("时间") or "")
                if not time_str:
                    raise MissingDataError(
                        "潮位数据缺少时间字段",
                        source_file=file_path,
                        line_number=i,
                        object_id=f"tide_row_{i}",
                        missing_field="time",
                        details={"row": row},
                    )

                time = self._parse_time(time_str, version, i)

                tide_level_str = str(row.get("tide_level") or row.get("level") or row.get("height") or row.get("潮位") or "0")
                unit = str(row.get("unit") or row.get("Unit") or row.get("单位") or "m").lower()

                tide_level = self._parse_float(tide_level_str, "tide_level", version, i, unit)
                uncertainty_str = str(row.get("uncertainty") or row.get("error") or row.get("不确定度") or "0.05")
                uncertainty = self._parse_float(uncertainty_str, "uncertainty", version, i)

                reading = TideReading(
                    version=version,
                    line_number=i,
                    raw_data=dict(row),
                    time=time,
                    tide_level=tide_level,
                    uncertainty=uncertainty,
                )
                reading.validate()

                # 检查与现有数据的冲突
                self._check_tide_conflict(reading, version)

                readings.append(reading)

            except TideBerthException as e:
                self.import_errors.append(e)
                continue
            except Exception as e:
                # 包装未知异常
                wrapped = TideBerthException(
                    f"导入潮位数据行时发生未知错误: {str(e)}",
                    source_file=file_path,
                    line_number=i,
                    object_id=f"tide_row_{i}",
                    details={"row": row, "error_type": type(e).__name__},
                )
                self.import_errors.append(wrapped)
                continue

        self._tide_readings[version.version_id] = readings

        # 创建潮位曲线（合并所有活跃版本）
        curve = self._build_tide_curve()

        return curve, readings

    def _check_tide_conflict(self, new_reading: TideReading, version: DataVersion) -> None:
        """检查潮位数据冲突。

        同一时间点如果已有数据，记录冲突但不覆盖。
        """
        for vid, readings in self._tide_readings.items():
            for existing in readings:
                if abs((existing.time - new_reading.time).total_seconds()) < 60:  # 1分钟内视为同一时间点
                    if abs(existing.tide_level - new_reading.tide_level) > 0.01:  # 差异超过1cm
                        conflict = DataConflictError(
                            f"潮位数据冲突: {new_reading.time} 时刻存在多个不同数值",
                            source_file=version.source_file,
                            line_number=new_reading.line_number,
                            object_id=f"tide_{new_reading.time.isoformat()}",
                            conflict_time=new_reading.time.isoformat(),
                            versions=[
                                {"version": vid, "value": existing.tide_level, "source": existing.version.source_file},
                                {"version": version.version_id, "value": new_reading.tide_level, "source": version.source_file},
                            ],
                            details={
                                "existing_value": existing.tide_level,
                                "new_value": new_reading.tide_level,
                                "difference": abs(existing.tide_level - new_reading.tide_level),
                            },
                        )
                        self.data_conflicts.append(conflict)

    def _build_tide_curve(self) -> TideCurve:
        """合并所有活跃版本的潮位数据构建曲线。

        对于冲突数据点，使用最新版本的数据。
        """
        curve = TideCurve()
        all_readings: Dict[datetime, TideReading] = {}

        # 按版本顺序处理，新版本覆盖旧版本的冲突点
        for version in sorted(self.versions, key=lambda v: v.imported_at):
            if not version.is_active or version.data_type != "tide":
                continue
            for reading in self._tide_readings.get(version.version_id, []):
                # 时间戳取整到分钟作为key
                key = reading.time.replace(second=0, microsecond=0)
                all_readings[key] = reading

        for reading in sorted(all_readings.values(), key=lambda r: r.time):
            curve.readings.append(reading)

        return curve

    # ========== 风速数据导入 ==========

    def import_wind_data(self, file_path: str, notes: str = "") -> Tuple[WindForecast, List[WindReading]]:
        """导入风速数据。

        支持格式：
        - CSV: time,speed,direction,gust,uncertainty,unit
        - Excel: 同CSV列名
        - JSON: [{time, speed, direction, gust, uncertainty, unit}, ...]
        """
        if not os.path.exists(file_path):
            raise MissingDataError(
                f"风速数据文件不存在: {file_path}",
                source_file=file_path,
                missing_field="wind_file",
            )

        version = self._create_version(file_path, "wind", notes)
        readings: List[WindReading] = []
        raw_data_list = self._read_file(file_path)

        for i, row in enumerate(raw_data_list, start=2):
            try:
                time_str = str(row.get("time") or row.get("Time") or row.get("TIME") or row.get("时间") or "")
                if not time_str:
                    raise MissingDataError(
                        "风速数据缺少时间字段",
                        source_file=file_path,
                        line_number=i,
                        object_id=f"wind_row_{i}",
                        missing_field="time",
                        details={"row": row},
                    )

                time = self._parse_time(time_str, version, i)

                speed_str = str(row.get("speed") or row.get("wind_speed") or row.get("风速") or "0")
                unit = str(row.get("unit") or row.get("Unit") or row.get("单位") or "m/s").lower()

                speed = self._parse_float(speed_str, "speed", version, i, unit)

                direction_str = row.get("direction") or row.get("风向")
                direction = self._parse_float(str(direction_str), "direction", version, i) if direction_str else None

                gust_str = row.get("gust") or row.get("阵风")
                gust = self._parse_float(str(gust_str), "gust", version, i, unit) if gust_str else None

                uncertainty_str = str(row.get("uncertainty") or row.get("error") or row.get("不确定度") or "1.0")
                uncertainty = self._parse_float(uncertainty_str, "uncertainty", version, i)

                reading = WindReading(
                    version=version,
                    line_number=i,
                    raw_data=dict(row),
                    time=time,
                    speed=speed,
                    direction=direction,
                    gust=gust,
                    uncertainty=uncertainty,
                )
                reading.validate()

                # 检查冲突
                self._check_wind_conflict(reading, version)

                readings.append(reading)

            except TideBerthException as e:
                self.import_errors.append(e)
                continue
            except Exception as e:
                wrapped = TideBerthException(
                    f"导入风速数据行时发生未知错误: {str(e)}",
                    source_file=file_path,
                    line_number=i,
                    object_id=f"wind_row_{i}",
                    details={"row": row, "error_type": type(e).__name__},
                )
                self.import_errors.append(wrapped)
                continue

        self._wind_readings[version.version_id] = readings
        forecast = self._build_wind_forecast()

        return forecast, readings

    def _check_wind_conflict(self, new_reading: WindReading, version: DataVersion) -> None:
        """检查风速数据冲突。"""
        for vid, readings in self._wind_readings.items():
            for existing in readings:
                if abs((existing.time - new_reading.time).total_seconds()) < 3600:  # 1小时内
                    if abs(existing.speed - new_reading.speed) > 0.5:  # 差异超过0.5 m/s
                        conflict = DataConflictError(
                            f"风速数据冲突: {new_reading.time} 时刻存在多个不同数值",
                            source_file=version.source_file,
                            line_number=new_reading.line_number,
                            object_id=f"wind_{new_reading.time.isoformat()}",
                            conflict_time=new_reading.time.isoformat(),
                            versions=[
                                {"version": vid, "value": existing.speed, "source": existing.version.source_file},
                                {"version": version.version_id, "value": new_reading.speed, "source": version.source_file},
                            ],
                            details={
                                "existing_value": existing.speed,
                                "new_value": new_reading.speed,
                                "difference": abs(existing.speed - new_reading.speed),
                            },
                        )
                        self.data_conflicts.append(conflict)

    def _build_wind_forecast(self) -> WindForecast:
        """合并所有活跃版本的风速数据。"""
        forecast = WindForecast()
        all_readings: Dict[datetime, WindReading] = {}

        for version in sorted(self.versions, key=lambda v: v.imported_at):
            if not version.is_active or version.data_type != "wind":
                continue
            for reading in self._wind_readings.get(version.version_id, []):
                key = reading.time.replace(second=0, microsecond=0)
                all_readings[key] = reading

        for reading in sorted(all_readings.values(), key=lambda r: r.time):
            forecast.readings.append(reading)

        return forecast

    # ========== 船舶数据导入 ==========

    def import_ship_data(self, file_path: str, notes: str = "") -> List[Ship]:
        """导入船舶数据。"""
        if not os.path.exists(file_path):
            raise MissingDataError(
                f"船舶数据文件不存在: {file_path}",
                source_file=file_path,
                missing_field="ship_file",
            )

        version = self._create_version(file_path, "ship", notes)
        ships: List[Ship] = []
        raw_data_list = self._read_file(file_path)

        for i, row in enumerate(raw_data_list, start=2):
            try:
                imo = str(row.get("imo") or row.get("IMO") or row.get("imo编号") or "")
                name = str(row.get("name") or row.get("ship_name") or row.get("船名") or "")
                draft_str = str(row.get("draft") or row.get("吃水") or "0")
                length_str = str(row.get("length") or row.get("船长") or "0")
                beam_str = str(row.get("beam") or row.get("船宽") or "0")
                maneuverability_str = str(row.get("maneuverability") or row.get("操纵性") or "3")

                draft = self._parse_float(draft_str, "draft", version, i, str(row.get("unit") or "m"))
                length = self._parse_float(length_str, "length", version, i, str(row.get("unit") or "m"))
                beam = self._parse_float(beam_str, "beam", version, i, str(row.get("unit") or "m"))
                maneuverability = int(float(maneuverability_str))

                ship = Ship(
                    version=version,
                    line_number=i,
                    raw_data=dict(row),
                    imo=imo,
                    name=name,
                    draft=draft,
                    length=length,
                    beam=beam,
                    maneuverability=maneuverability,
                )
                ship.validate()

                # 检查冲突（同一IMO编号的多版本数据）
                self._check_ship_conflict(ship, version)

                ships.append(ship)

            except TideBerthException as e:
                self.import_errors.append(e)
                continue
            except Exception as e:
                wrapped = TideBerthException(
                    f"导入船舶数据行时发生未知错误: {str(e)}",
                    source_file=file_path,
                    line_number=i,
                    object_id=f"ship_row_{i}",
                    details={"row": row, "error_type": type(e).__name__},
                )
                self.import_errors.append(wrapped)
                continue

        self._ships[version.version_id] = ships
        return ships

    def _check_ship_conflict(self, new_ship: Ship, version: DataVersion) -> None:
        """检查船舶数据冲突。"""
        if not new_ship.imo:
            return

        for vid, ships in self._ships.items():
            for existing in ships:
                if existing.imo == new_ship.imo:
                    if abs(existing.draft - new_ship.draft) > 0.01:
                        conflict = DataConflictError(
                            f"船舶数据冲突: IMO {new_ship.imo} 存在多个不同吃水数据",
                            source_file=version.source_file,
                            line_number=new_ship.line_number,
                            object_id=f"ship_{new_ship.imo}",
                            versions=[
                                {"version": vid, "draft": existing.draft, "source": existing.version.source_file},
                                {"version": version.version_id, "draft": new_ship.draft, "source": version.source_file},
                            ],
                            details={
                                "existing_draft": existing.draft,
                                "new_draft": new_ship.draft,
                                "difference": abs(existing.draft - new_ship.draft),
                            },
                        )
                        self.data_conflicts.append(conflict)

    def get_active_ships(self) -> List[Ship]:
        """获取所有活跃的船舶数据（最新版本优先）。"""
        ships_by_key: Dict[str, Ship] = {}

        for version in sorted(self.versions, key=lambda v: v.imported_at):
            if not version.is_active or version.data_type != "ship":
                continue
            for ship in self._ships.get(version.version_id, []):
                key = ship.imo or ship.name
                if key:
                    ships_by_key[key] = ship

        return list(ships_by_key.values())

    # ========== 泊位数据导入 ==========

    def import_berth_data(self, file_path: str, notes: str = "") -> List[Berth]:
        """导入泊位数据。"""
        if not os.path.exists(file_path):
            raise MissingDataError(
                f"泊位数据文件不存在: {file_path}",
                source_file=file_path,
                missing_field="berth_file",
            )

        version = self._create_version(file_path, "berth", notes)
        berths: List[Berth] = []
        raw_data_list = self._read_file(file_path)

        for i, row in enumerate(raw_data_list, start=2):
            try:
                berth_id = str(row.get("berth_id") or row.get("泊位编号") or "")
                name = str(row.get("name") or row.get("泊位名称") or "")
                design_depth_str = str(row.get("design_depth") or row.get("设计水深") or "0")
                max_length_str = str(row.get("max_length") or row.get("最大船长") or "0")
                max_beam_str = str(row.get("max_beam") or row.get("最大船宽") or "0")
                wind_limit_str = str(row.get("wind_limit") or row.get("风速限制") or "15")
                ukc_str = str(row.get("under_keel_margin") or row.get("富余水深") or "0.5")
                channel_depth_str = str(row.get("approach_channel_depth") or row.get("航道水深") or "0")

                design_depth = self._parse_float(design_depth_str, "design_depth", version, i, str(row.get("unit") or "m"))
                max_length = self._parse_float(max_length_str, "max_length", version, i, str(row.get("unit") or "m"))
                max_beam = self._parse_float(max_beam_str, "max_beam", version, i, str(row.get("unit") or "m"))
                wind_limit = self._parse_float(wind_limit_str, "wind_limit", version, i, str(row.get("wind_unit") or "m/s"))
                under_keel_margin = self._parse_float(ukc_str, "under_keel_margin", version, i, str(row.get("unit") or "m"))
                channel_depth = self._parse_float(channel_depth_str, "approach_channel_depth", version, i, str(row.get("unit") or "m"))

                berth = Berth(
                    version=version,
                    line_number=i,
                    raw_data=dict(row),
                    berth_id=berth_id,
                    name=name,
                    design_depth=design_depth,
                    max_length=max_length,
                    max_beam=max_beam,
                    wind_limit=wind_limit,
                    under_keel_margin=under_keel_margin,
                    approach_channel_depth=channel_depth,
                )
                berth.validate()

                berths.append(berth)

            except TideBerthException as e:
                self.import_errors.append(e)
                continue
            except Exception as e:
                wrapped = TideBerthException(
                    f"导入泊位数据行时发生未知错误: {str(e)}",
                    source_file=file_path,
                    line_number=i,
                    object_id=f"berth_row_{i}",
                    details={"row": row, "error_type": type(e).__name__},
                )
                self.import_errors.append(wrapped)
                continue

        self._berths[version.version_id] = berths
        return berths

    def get_active_berths(self) -> List[Berth]:
        """获取所有活跃的泊位数据（最新版本优先）。"""
        berths_by_id: Dict[str, Berth] = {}

        for version in sorted(self.versions, key=lambda v: v.imported_at):
            if not version.is_active or version.data_type != "berth":
                continue
            for berth in self._berths.get(version.version_id, []):
                if berth.berth_id:
                    berths_by_id[berth.berth_id] = berth

        return list(berths_by_id.values())

    # ========== 调度备注导入 ==========

    def import_note_data(self, file_path: str, notes: str = "") -> List[ScheduleNote]:
        """导入调度备注数据。"""
        if not os.path.exists(file_path):
            raise MissingDataError(
                f"调度备注文件不存在: {file_path}",
                source_file=file_path,
                missing_field="note_file",
            )

        version = self._create_version(file_path, "note", notes)
        note_list: List[ScheduleNote] = []
        raw_data_list = self._read_file(file_path)

        for i, row in enumerate(raw_data_list, start=2):
            try:
                time_str = str(row.get("time") or row.get("Time") or row.get("时间") or "")
                content = str(row.get("content") or row.get("备注") or row.get("内容") or "")
                priority_str = str(row.get("priority") or row.get("优先级") or "1")
                related_ship = str(row.get("related_ship") or row.get("相关船舶") or "") or None
                related_berth = str(row.get("related_berth") or row.get("相关泊位") or "") or None
                effective_from_str = row.get("effective_from") or row.get("生效时间")
                effective_to_str = row.get("effective_to") or row.get("失效时间")

                time = self._parse_time(time_str, version, i)
                priority = int(float(priority_str))

                effective_from = self._parse_time(str(effective_from_str), version, i) if effective_from_str else None
                effective_to = self._parse_time(str(effective_to_str), version, i) if effective_to_str else None

                note = ScheduleNote(
                    version=version,
                    line_number=i,
                    raw_data=dict(row),
                    time=time,
                    content=content,
                    priority=priority,
                    related_ship=related_ship,
                    related_berth=related_berth,
                    effective_from=effective_from,
                    effective_to=effective_to,
                )

                note_list.append(note)

            except TideBerthException as e:
                self.import_errors.append(e)
                continue
            except Exception as e:
                wrapped = TideBerthException(
                    f"导入调度备注行时发生未知错误: {str(e)}",
                    source_file=file_path,
                    line_number=i,
                    object_id=f"note_row_{i}",
                    details={"row": row, "error_type": type(e).__name__},
                )
                self.import_errors.append(wrapped)
                continue

        self._notes[version.version_id] = note_list
        return note_list

    def get_active_notes(self) -> List[ScheduleNote]:
        """获取所有活跃的调度备注。"""
        all_notes: List[ScheduleNote] = []

        for version in sorted(self.versions, key=lambda v: v.imported_at):
            if not version.is_active or version.data_type != "note":
                continue
            all_notes.extend(self._notes.get(version.version_id, []))

        return sorted(all_notes, key=lambda n: n.time)

    # ========== 文件读取 ==========

    def _read_file(self, file_path: str) -> List[Dict[str, Any]]:
        """读取文件，支持CSV、Excel、JSON格式。"""
        ext = os.path.splitext(file_path)[1].lower()

        try:
            if ext in [".csv"]:
                return self._read_csv(file_path)
            elif ext in [".xlsx", ".xls"]:
                return self._read_excel(file_path)
            elif ext in [".json"]:
                return self._read_json(file_path)
            else:
                # 尝试自动识别
                with open(file_path, "r", encoding="utf-8") as f:
                    first_char = f.read(1)
                    f.seek(0)
                    if first_char in "[{":
                        return self._read_json(file_path)
                    else:
                        return self._read_csv(file_path)
        except TideBerthException:
            raise
        except Exception as e:
            raise TideBerthException(
                f"读取文件失败: {file_path}, 错误: {str(e)}",
                source_file=file_path,
                details={"error_type": type(e).__name__},
            ) from e

    def _read_csv(self, file_path: str) -> List[Dict[str, Any]]:
        """读取CSV文件。"""
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                return [dict(row) for row in reader]
        except UnicodeDecodeError:
            # 尝试GBK编码（国内Excel导出的CSV常用GBK）
            with open(file_path, "r", encoding="gbk") as f:
                reader = csv.DictReader(f)
                return [dict(row) for row in reader]

    def _read_excel(self, file_path: str) -> List[Dict[str, Any]]:
        """读取Excel文件。"""
        df = pd.read_excel(file_path)
        return df.to_dict("records")

    def _read_json(self, file_path: str) -> List[Dict[str, Any]]:
        """读取JSON文件。"""
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            # 单条记录，包装为列表
            return [data]
        elif isinstance(data, list):
            return data
        else:
            raise ValidationError(
                "JSON文件格式不正确，应为对象或数组",
                source_file=file_path,
                details={"json_type": type(data).__name__},
            )

    # ========== 版本管理 ==========

    def list_versions(self) -> List[Dict[str, Any]]:
        """列出所有数据版本。"""
        return [
            {
                "version_id": v.version_id,
                "source_file": v.source_file,
                "imported_at": v.imported_at.isoformat(),
                "data_type": v.data_type,
                "notes": v.notes,
                "is_active": v.is_active,
            }
            for v in self.versions
        ]

    def deactivate_version(self, version_id: str) -> None:
        """停用某个版本的数据（不删除，仅标记为非活跃）。"""
        for v in self.versions:
            if v.version_id == version_id:
                v.is_active = False
                return

    def activate_version(self, version_id: str) -> None:
        """激活某个版本的数据。"""
        for v in self.versions:
            if v.version_id == version_id:
                v.is_active = True
                return

    # ========== 错误报告 ==========

    def get_import_report(self) -> str:
        """生成导入报告，列出所有错误和冲突。"""
        lines = ["=== 数据导入报告 ==="]
        lines.append(f"总版本数: {len(self.versions)}")
        lines.append(f"错误数: {len(self.import_errors)}")
        lines.append(f"冲突数: {len(self.data_conflicts)}")
        lines.append("")

        if self.import_errors:
            lines.append("--- 导入错误/警告 ---")
            for i, err in enumerate(self.import_errors, 1):
                lines.append(f"{i}. {type(err).__name__}:")
                lines.append(f"   {str(err).replace(chr(10), chr(10) + '   ')}")
                lines.append("")

        if self.data_conflicts:
            lines.append("--- 数据冲突 ---")
            for i, conflict in enumerate(self.data_conflicts, 1):
                lines.append(f"{i}. {conflict.message}")
                lines.append(f"   来源: {conflict.source_file}:{conflict.line_number}")
                lines.append(f"   对象: {conflict.object_id}")
                if conflict.versions:
                    lines.append(f"   冲突版本:")
                    for ver in conflict.versions:
                        lines.append(f"     - {ver['version']}: {ver.get('value')} ({ver['source']})")
                lines.append("")

        return "\n".join(lines)
