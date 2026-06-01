from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from collections import defaultdict
from .data_import import ImportedData, SensorRecord


@dataclass
class Anomaly:
    anomaly_type: str
    description: str
    severity: str
    records: List[Dict[str, Any]]
    suggested_action: str


class AnomalyDetector:
    def __init__(self):
        self.anomalies: List[Anomaly] = []

    def detect_null_values(self, records: List[SensorRecord]) -> List[Anomaly]:
        null_anomalies = []
        null_counts = defaultdict(list)

        for i, record in enumerate(records):
            for field in ['heat_release_rate', 'temperature', 'co_concentration', 'wind_speed']:
                value = getattr(record, field, None)
                if value is None or value == '':
                    null_counts[field].append({
                        'record_index': i,
                        'sensor_id': record.sensor_id,
                        'timestamp': record.timestamp
                    })

        for field, null_records in null_counts.items():
            if null_records:
                null_anomalies.append(Anomaly(
                    anomaly_type='null_value',
                    description=f"字段 '{field}' 存在空值 ({len(null_records)} 条记录)",
                    severity='warning',
                    records=null_records,
                    suggested_action=f"检查 '{field}' 传感器是否正常工作，或使用插值补全"
                ))

        self.anomalies.extend(null_anomalies)
        return null_anomalies

    def detect_duplicates(self, records: List[SensorRecord]) -> List[Anomaly]:
        seen = defaultdict(list)
        duplicates = []

        for i, record in enumerate(records):
            key = (record.timestamp, record.sensor_id)
            seen[key].append({
                'record_index': i,
                'record': record
            })

        duplicate_groups = []
        for key, group in seen.items():
            if len(group) > 1:
                duplicate_groups.append({
                    'key': key,
                    'count': len(group),
                    'records': [{'index': r['record_index']} for r in group]
                })

        if duplicate_groups:
            duplicates.append(Anomaly(
                anomaly_type='duplicate_record',
                description=f"发现 {len(duplicate_groups)} 组重复记录",
                severity='info',
                records=duplicate_groups,
                suggested_action="检查数据源，确认是否需要去重或保留所有记录"
            ))
            self.anomalies.extend(duplicates)

        return duplicates

    def detect_boundary_records(self, records: List[SensorRecord]) -> List[Anomaly]:
        boundary_anomalies = []

        hrr_values = [r.heat_release_rate for r in records if r.heat_release_rate is not None]
        co_values = [r.co_concentration for r in records if r.co_concentration is not None]
        temp_values = [r.temperature for r in records if r.temperature is not None]

        if hrr_values:
            hrr_min, hrr_max = min(hrr_values), max(hrr_values)
            hrr_range = hrr_max - hrr_min
            if hrr_range > 0:
                boundary_indices = [
                    {'value': v, 'sensor_id': r.sensor_id, 'timestamp': r.timestamp}
                    for r in records
                    for v in [r.heat_release_rate]
                    if v is not None and (v == hrr_min or v == hrr_max)
                ]
                if boundary_indices:
                    boundary_anomalies.append(Anomaly(
                        anomaly_type='boundary_hrr',
                        description=f"HRR边界记录 (min={hrr_min}, max={hrr_max})",
                        severity='info',
                        records=boundary_indices,
                        suggested_action="重点关注边界记录的准确性，可能代表极端工况"
                    ))

        if co_values:
            co_min, co_max = min(co_values), max(co_values)
            if co_max > 500:
                high_co = [
                    {'value': r.co_concentration, 'sensor_id': r.sensor_id, 'timestamp': r.timestamp}
                    for r in records
                    if r.co_concentration is not None and r.co_concentration > 500
                ]
                if high_co:
                    boundary_anomalies.append(Anomaly(
                        anomaly_type='high_co_concentration',
                        description=f"发现 {len(high_co)} 条高CO浓度记录 (>500ppm)",
                        severity='warning',
                        records=high_co,
                        suggested_action="高CO浓度可能代表危险工况，需重点关注"
                    ))

        self.anomalies.extend(boundary_anomalies)
        return boundary_anomalies

    def detect_extreme_values(self, records: List[SensorRecord]) -> List[Anomaly]:
        extreme_anomalies = []

        field_checks = [
            ('heat_release_rate', 5000, 'HRR过高'),
            ('temperature', 80, '温度过高'),
        ]

        for field, threshold, desc in field_checks:
            extreme_records = []
            for r in records:
                value = getattr(r, field, None)
                if value is not None and value > threshold:
                    extreme_records.append({
                        'value': value, 'sensor_id': r.sensor_id, 'timestamp': r.timestamp
                    })

            if extreme_records:
                extreme_anomalies.append(Anomaly(
                    anomaly_type=f'extreme_{field}',
                    description=f"{desc} ({len(extreme_records)} 条记录超过阈值 {threshold})",
                    severity='warning',
                    records=extreme_records,
                    suggested_action=f"检查传感器校准或现场核实极端值"
                ))

        self.anomalies.extend(extreme_anomalies)
        return extreme_anomalies

    def detect_all(self, imported_data: ImportedData) -> Dict[str, Any]:
        self.anomalies = []
        records = imported_data.sensor_records

        self.detect_null_values(records)
        self.detect_duplicates(records)
        self.detect_boundary_records(records)
        self.detect_extreme_values(records)

        return {
            'total_anomalies': len(self.anomalies),
            'anomalies': self.anomalies,
            'summary': self._get_summary()
        }

    def _get_summary(self) -> str:
        summary = []
        by_type = defaultdict(list)
        for a in self.anomalies:
            by_type[a.anomaly_type].append(a)

        summary.append("\n🔍 异常检测摘要:")
        for anomaly_type, anomalies in by_type.items():
            for a in anomalies:
                severity_icon = '⚠️' if a.severity == 'warning' else 'ℹ️'
                summary.append(f"  {severity_icon} [{anomaly_type}]: {a.description}")
                summary.append(f"     建议: {a.suggested_action}")

        return '\n'.join(summary)

    def get_anomalies_by_type(self, anomaly_type: str) -> List[Anomaly]:
        return [a for a in self.anomalies if a.anomaly_type == anomaly_type]
