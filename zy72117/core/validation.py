from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import re
from .data_import import ImportedData, SensorRecord, OnSiteNote


@dataclass
class ValidationIssue:
    severity: str
    field: str
    message: str
    record_id: str
    suggested_action: str
    evidence: Dict[str, Any]


@dataclass
class DataConflict:
    conflict_type: str
    sensor_data: Dict[str, Any]
    wechat_data: Dict[str, Any]
    suggested_actions: List[str]


class DataValidator:
    VALID_DIRECTIONS = {'+', '-', '正', '负', 'up', 'down', 'in', 'out', '向上', '向下', '进', '出', '入口', '出口'}
    
    VALID_UNITS = {
        'temperature': ['°C', 'C', 'K', '°F'],
        'velocity': ['m/s', 'km/h', 'm s-1'],
        'concentration': ['ppm', 'mg/m3', 'mg/m^3'],
        'power': ['kW', 'MW', 'W'],
        'distance': ['m', 'km'],
    }

    def __init__(self):
        self.issues: List[ValidationIssue] = []
        self.conflicts: List[DataConflict] = []

    def validate_direction(self, direction: str, record_id: str) -> bool:
        if direction is None or direction == '':
            return True
        
        direction_norm = str(direction).strip().lower()
        
        if direction_norm not in {d.lower() for d in self.VALID_DIRECTIONS}:
            self.issues.append(ValidationIssue(
                severity="warning",
                field="wind_direction",
                message=f"风向符号不规范: '{direction}'",
                record_id=record_id,
                suggested_action="请使用标准符号: +/-, 正/负, 进/出, up/down, in/out",
                evidence={"provided": direction, "valid_options": list(self.VALID_DIRECTIONS)}
            ))
            return False
        return True

    def validate_unit(self, value: Any, unit_type: str, field: str, record_id: str) -> bool:
        if value is None:
            return True
        
        valid_units = self.VALID_UNITS.get(unit_type, [])
        
        if isinstance(value, str):
            has_unit = any(u in value for u in valid_units)
            if not has_unit and valid_units:
                self.issues.append(ValidationIssue(
                    severity="info",
                    field=field,
                    message=f"字段 '{field}' 缺少明确单位",
                    record_id=record_id,
                    suggested_action=f"建议添加单位，支持的单位: {', '.join(valid_units)}",
                    evidence={"value": value, "expected_units": valid_units}
                ))
                return False
        return True

    def validate_time_interval(self, timestamps: List[str], expected_interval: int = 60) -> Dict[str, Any]:
        if len(timestamps) < 2:
            return {"valid": True, "issues": []}
        
        issues = []
        prev_time = None
        
        for i, ts in enumerate(timestamps):
            try:
                current_time = self._parse_timestamp(ts)
            except (ValueError, TypeError):
                self.issues.append(ValidationIssue(
                    severity="error",
                    field="timestamp",
                    message=f"时间格式无法解析: {ts}",
                    record_id=f"record_{i}",
                    suggested_action="使用标准时间格式: YYYY-MM-DD HH:MM:SS 或 HH:MM:SS",
                    evidence={"timestamp": ts}
                ))
                continue
            
            if prev_time and current_time:
                interval = abs((current_time - prev_time).total_seconds())
                if interval > expected_interval * 1.5:
                    self.issues.append(ValidationIssue(
                        severity="warning",
                        field="timestamp",
                        message=f"时间间隔异常: {interval:.0f}秒 (预期约 {expected_interval}秒)",
                        record_id=f"record_{i}",
                        suggested_action="检查传感器是否掉线或数据丢失",
                        evidence={"interval_actual": interval, "interval_expected": expected_interval}
                    ))
                    issues.append({"index": i, "interval": interval})
            
            prev_time = current_time
        
        return {"valid": len(issues) == 0, "interval_issues": issues}

    def _parse_timestamp(self, ts: str) -> Optional[datetime]:
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M:%S',
            '%H:%M:%S',
            '%H:%M',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(ts, fmt)
            except ValueError:
                continue
        return None

    def validate_sensor_record(self, record: SensorRecord, record_index: int) -> None:
        record_id = f"{record.sensor_id}_{record_index}"
        
        self.validate_direction(record.wind_direction, record_id)
        
        if record.temperature is not None:
            if record.temperature < -50 or record.temperature > 1000:
                self.issues.append(ValidationIssue(
                    severity="warning",
                    field="temperature",
                    message=f"温度值异常: {record.temperature}°C",
                    record_id=record_id,
                    suggested_action="检查温度传感器是否正常工作",
                    evidence={"value": record.temperature, "reasonable_range": "(-50, 1000)"}
                ))
        
        if record.co_concentration is not None:
            if record.co_concentration < 0 or record.co_concentration > 5000:
                self.issues.append(ValidationIssue(
                    severity="warning",
                    field="co_concentration",
                    message=f"CO浓度异常: {record.co_concentration}ppm",
                    record_id=record_id,
                    suggested_action="检查CO传感器是否需要校准",
                    evidence={"value": record.co_concentration, "reasonable_range": "(0, 5000)"}
                ))
        
        if record.wind_speed is not None:
            if record.wind_speed < 0 or record.wind_speed > 30:
                self.issues.append(ValidationIssue(
                    severity="warning",
                    field="wind_speed",
                    message=f"风速值异常: {record.wind_speed}m/s",
                    record_id=record_id,
                    suggested_action="检查风速传感器",
                    evidence={"value": record.wind_speed, "reasonable_range": "(0, 30)"}
                ))

    def detect_conflicts(self, imported_data: ImportedData) -> List[DataConflict]:
        conflicts: List[DataConflict] = []
        
        sensor_map = {}
        for sensor in imported_data.sensor_records:
            if sensor.timestamp:
                key = sensor.timestamp[:16]
                if key not in sensor_map:
                    sensor_map[key] = []
                sensor_map[key].append(sensor)
        
        for note in imported_data.on_site_notes:
            if note.is_manual_correction and note.manual_corrections:
                note_time = note.timestamp[:16] if note.timestamp else ''
                
                matching_sensors = sensor_map.get(note_time, [])
                
                for sensor in matching_sensors:
                    for key, wechat_value in note.manual_corrections.items():
                        sensor_value = getattr(sensor, key, None)
                        
                        if sensor_value is not None and float(sensor_value) != float(wechat_value):
                            diff = abs(float(sensor_value) - float(wechat_value))
                            rel_diff = diff / max(abs(float(sensor_value)), 0.001)
                            
                            if rel_diff > 0.1:
                                conflicts.append(DataConflict(
                                    conflict_type=f"数据冲突 - {key}",
                                    sensor_data={
                                        "source": "sensor",
                                        "value": sensor_value,
                                        "sensor_id": sensor.sensor_id
                                    },
                                    wechat_data={
                                        "source": "wechat",
                                        "value": wechat_value,
                                        "author": note.author,
                                        "content": note.content
                                    },
                                    suggested_actions=[
                                        "确认哪个数据源更可靠",
                                        "考虑使用修正后的值",
                                        "现场核实实际情况",
                                        "保留两边数据供后续判断"
                                    ]
                                ))
        
        self.conflicts = conflicts
        return conflicts

    def validate_all(self, imported_data: ImportedData) -> Dict[str, Any]:
        self.issues = []
        self.conflicts = []
        
        for i, sensor in enumerate(imported_data.sensor_records):
            self.validate_sensor_record(sensor, i)
        
        timestamps = [s.timestamp for s in imported_data.sensor_records if s.timestamp]
        self.validate_time_interval(timestamps)
        
        self.detect_conflicts(imported_data)
        
        return {
            "total_issues": len(self.issues),
            "total_conflicts": len(self.conflicts),
            "issues_by_severity": self._get_issues_by_severity(),
            "conflicts": self.conflicts,
            "validation_report": self._generate_validation_report()
        }

    def _get_issues_by_severity(self) -> Dict[str, List[ValidationIssue]]:
        result = {"error": [], "warning": [], "info": []}
        for issue in self.issues:
            result.setdefault(issue.severity, []).append(issue)
        return result

    def _generate_validation_report(self) -> str:
        report = []
        report.append("=" * 60)
        report.append("数据验证报告")
        report.append("=" * 60)
        
        by_severity = self._get_issues_by_severity()
        
        if by_severity["error"]:
            report.append(f"\n❌ 错误 ({len(by_severity['error'])} 项:")
            for issue in by_severity["error"][:5]:
                report.append(f"  - [{issue.record_id}: {issue.message}")
                report.append(f"    建议: {issue.suggested_action}")
        
        if by_severity["warning"]:
            report.append(f"\n⚠️  警告 ({len(by_severity['warning'])} 项:")
            for issue in by_severity["warning"][:5]:
                report.append(f"  - [{issue.record_id}]: {issue.message}")
                report.append(f"    建议: {issue.suggested_action}")
        
        if self.conflicts:
            report.append(f"\n⚔️  数据冲突 ({len(self.conflicts)} 项):")
            for conflict in self.conflicts[:3]:
                report.append(f"  - {conflict.conflict_type}")
                report.append(f"    传感器数据: {conflict.sensor_data}")
                report.append(f"    微信群数据: {conflict.wechat_data}")
                report.append(f"    建议动作: {', '.join(conflict.suggested_actions)}")
        
        report.append("\n" + "=" * 60)
        return "\n".join(report)

    def get_issues_summary(self) -> str:
        return self._generate_validation_report()
