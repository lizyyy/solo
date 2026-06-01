from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import re

from data_models import (
    AirExchangeRecord,
    ValidationResult,
    Direction,
    DataSource,
    VerificationStatus,
)


VALID_UNITS = {"m³/h", "m3/h", "m³/min", "m3/min", "L/s", "l/s", "CMH", "CFM"}
VALID_DIRECTION_SYMBOLS = {"↑", "↓", "↺", "→", "←", "送风", "排风", "回风", "进风", "出风"}
DIRECTION_MAP = {
    "↑": Direction.SUPPLY,
    "→": Direction.SUPPLY,
    "←": Direction.SUPPLY,
    "送风": Direction.SUPPLY,
    "进风": Direction.SUPPLY,
    "↓": Direction.EXHAUST,
    "排风": Direction.EXHAUST,
    "出风": Direction.EXHAUST,
    "↺": Direction.RECIRCULATE,
    "回风": Direction.RECIRCULATE,
}
NORMAL_TIME_INTERVALS = {15, 30, 60}
MIN_TIME_INTERVAL = 5
MAX_TIME_INTERVAL = 180
MIN_AIR_VOLUME = 50.0
MAX_AIR_VOLUME = 50000.0


class DataValidator:
    def __init__(self):
        self.seen_record_ids = set()
        self.seen_time_location = set()

    def validate_record(
        self, record: AirExchangeRecord, all_records: List[AirExchangeRecord]
    ) -> ValidationResult:
        errors = []
        warnings = []
        suggestions = []

        self._validate_record_id(record, errors, warnings)
        self._validate_direction(record, errors, warnings, suggestions)
        self._validate_unit(record, errors, warnings, suggestions)
        self._validate_time_interval(record, errors, warnings, suggestions)
        self._validate_air_volume(record, errors, warnings, suggestions)
        self._validate_measure_time(record, errors, warnings, suggestions)
        self._validate_wechat_notes_preserved(record, warnings, suggestions)
        self._check_duplicates(record, all_records, errors, warnings)
        self._check_empty_values(record, errors, warnings, suggestions)
        self._check_boundary_values(record, warnings, suggestions)

        is_valid = len(errors) == 0
        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions,
        )

    def _validate_record_id(
        self, record: AirExchangeRecord, errors: List[str], warnings: List[str]
    ):
        if not record.record_id or not record.record_id.strip():
            errors.append("记录ID为空")
        elif record.record_id in self.seen_record_ids:
            warnings.append(f"记录ID {record.record_id} 重复出现，请检查是否为同一条记录")
        else:
            self.seen_record_ids.add(record.record_id)

    def _validate_direction(
        self,
        record: AirExchangeRecord,
        errors: List[str],
        warnings: List[str],
        suggestions: List[str],
    ):
        direction_value = record.direction.value if isinstance(record.direction, Direction) else str(record.direction)

        if not direction_value or direction_value == "方向未明":
            errors.append("气流方向未标注")
            suggestions.append("请检查实验表或照片说明，补充气流方向（↑送风/↓排风/↺回风）")
            return

        if direction_value in VALID_DIRECTION_SYMBOLS:
            if direction_value in DIRECTION_MAP:
                if record.direction != DIRECTION_MAP[direction_value]:
                    suggestions.append(
                        f"方向符号 {direction_value} 对应 {DIRECTION_MAP[direction_value].value}，已自动映射"
                    )
        else:
            warnings.append(f"方向标注 '{direction_value}' 不规范，建议使用标准符号：↑送风 ↓排风 ↺回风")
            suggestions.append("方向符号规范：送风用↑或→，排风用↓，回风用↺")

    def _validate_unit(
        self,
        record: AirExchangeRecord,
        errors: List[str],
        warnings: List[str],
        suggestions: List[str],
    ):
        unit = record.unit.strip() if record.unit else ""

        if not unit:
            errors.append("风量单位为空")
            suggestions.append("常用单位：m³/h（立方米/小时）、m³/min（立方米/分钟）、L/s（升/秒）")
            return

        unit_normalized = unit.replace("³", "3").lower()
        valid_normalized = {u.replace("³", "3").lower() for u in VALID_UNITS}

        if unit_normalized not in valid_normalized:
            warnings.append(f"单位 '{unit}' 不常见，请确认")
            suggestions.append(f"标准单位：m³/h、m³/min、L/s。当前单位：{unit}")
        else:
            preferred_units = {
                "m3/h": "m³/h",
                "m3/min": "m³/min",
                "l/s": "L/s",
            }
            if unit in preferred_units:
                suggestions.append(f"单位可标准化为：{preferred_units[unit]}（使用上标³更规范）")
            elif unit not in VALID_UNITS:
                matched = [u for u in VALID_UNITS if u.replace("³", "3").lower() == unit_normalized]
                if matched:
                    suggestions.append(f"单位可标准化为：{matched[0]}")

    def _validate_time_interval(
        self,
        record: AirExchangeRecord,
        errors: List[str],
        warnings: List[str],
        suggestions: List[str],
    ):
        interval = record.time_interval_min

        if interval is None:
            errors.append("测量时间间隔为空")
            suggestions.append("请补充两次测量之间的时间间隔（分钟）")
            return

        if interval <= 0:
            errors.append(f"时间间隔 {interval} 分钟无效，必须大于0")
        elif interval < MIN_TIME_INTERVAL:
            warnings.append(f"时间间隔 {interval} 分钟过短，建议不少于 {MIN_TIME_INTERVAL} 分钟")
            suggestions.append("间隔过短可能导致数据波动大，建议延长测量间隔")
        elif interval > MAX_TIME_INTERVAL:
            warnings.append(f"时间间隔 {interval} 分钟过长，建议不超过 {MAX_TIME_INTERVAL} 分钟")
            suggestions.append("间隔过长可能错过变化趋势，建议缩短测量间隔")

        if interval not in NORMAL_TIME_INTERVALS and 0 < interval <= MAX_TIME_INTERVAL:
            suggestions.append(
                f"非标准时间间隔 {interval} 分钟，常用间隔：{sorted(NORMAL_TIME_INTERVALS)} 分钟"
            )

    def _validate_air_volume(
        self,
        record: AirExchangeRecord,
        errors: List[str],
        warnings: List[str],
        suggestions: List[str],
    ):
        volume = record.air_volume

        if volume is None:
            errors.append("风量值为空")
            suggestions.append("请补充风量测量值")
            return

        if volume <= 0:
            errors.append(f"风量值 {volume} 无效，必须大于0")
        elif volume < MIN_AIR_VOLUME:
            warnings.append(f"风量值 {volume} 偏低，接近下限 {MIN_AIR_VOLUME}")
            suggestions.append("请确认设备是否正常运行，或检查测量方法")
        elif volume > MAX_AIR_VOLUME:
            warnings.append(f"风量值 {volume} 偏高，接近上限 {MAX_AIR_VOLUME}")
            suggestions.append("请确认量程是否正确，或检查设备是否过载")

    def _validate_measure_time(
        self,
        record: AirExchangeRecord,
        errors: List[str],
        warnings: List[str],
        suggestions: List[str],
    ):
        if not record.measure_time:
            errors.append("测量时间为空")
            suggestions.append("请补充测量时间，格式：YYYY-MM-DD HH:MM")
            return

        now = datetime.now()
        if record.measure_time > now + timedelta(hours=1):
            warnings.append("测量时间在未来，请确认")
        elif record.measure_time < now - timedelta(days=365 * 3):
            warnings.append("测量时间超过3年前，注意数据时效性")

    def _validate_wechat_notes_preserved(
        self,
        record: AirExchangeRecord,
        warnings: List[str],
        suggestions: List[str],
    ):
        if record.source == DataSource.WECHAT_GROUP:
            if not record.raw_wechat_content:
                warnings.append("微信群来源记录缺少原始微信内容备份")
                suggestions.append("为保留证据链，请保存微信群原始消息内容到 raw_wechat_content 字段")
            if not record.wechat_notes:
                suggestions.append("建议补充微信群备注的结构化摘要到 wechat_notes 字段")

    def _check_duplicates(
        self,
        record: AirExchangeRecord,
        all_records: List[AirExchangeRecord],
        errors: List[str],
        warnings: List[str],
    ):
        key = (record.measure_time.isoformat(), record.location)
        if key in self.seen_time_location:
            duplicate = [
                r for r in all_records
                if r.measure_time == record.measure_time and r.location == record.location and r.record_id != record.record_id
            ]
            if duplicate:
                warnings.append(
                    f"{record.location} 在 {record.measure_time.strftime('%Y-%m-%d %H:%M')} 存在重复测量记录"
                )
        else:
            self.seen_time_location.add(key)

    def _check_empty_values(
        self,
        record: AirExchangeRecord,
        errors: List[str],
        warnings: List[str],
        suggestions: List[str],
    ):
        empty_fields = []
        if not record.location:
            empty_fields.append("location（测量位置）")
        if not record.source:
            empty_fields.append("source（数据来源）")

        if empty_fields:
            errors.append(f"必填字段为空：{', '.join(empty_fields)}")

        optional_empty = []
        if record.source == DataSource.PHOTO_NOTE and not record.photo_desc:
            optional_empty.append("photo_desc（照片说明）")
        if record.source == DataSource.WORKING_CONDITION and not record.working_condition:
            optional_empty.append("working_condition（工况记录）")

        if optional_empty:
            suggestions.append(f"建议补充来源对应的说明字段：{', '.join(optional_empty)}")

    def _check_boundary_values(
        self,
        record: AirExchangeRecord,
        warnings: List[str],
        suggestions: List[str],
    ):
        volume = record.air_volume
        if volume is not None and volume > 0:
            if volume < MIN_AIR_VOLUME * 1.2 or volume > MAX_AIR_VOLUME * 0.8:
                warnings.append(f"风量值 {volume} 处于量程边界区域（{MIN_AIR_VOLUME}-{MAX_AIR_VOLUME}）")
                suggestions.append("边界值需重点复核，建议重复测量确认")

        interval = record.time_interval_min
        if interval in (MIN_TIME_INTERVAL, MAX_TIME_INTERVAL):
            warnings.append(f"时间间隔 {interval} 分钟为边界值")
            suggestions.append("边界时间间隔需确认测量方案合理性")

    def batch_validate(
        self, records: List[AirExchangeRecord]
    ) -> Dict[str, ValidationResult]:
        self.seen_record_ids.clear()
        self.seen_time_location.clear()
        results = {}
        for record in records:
            results[record.record_id] = self.validate_record(record, records)
        return results
