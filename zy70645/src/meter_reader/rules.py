from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional
from enum import Enum
from .parser import Record, ParseResult


class AnomalyType(Enum):
    ZERO_USAGE = "零用量"
    NEGATIVE_USAGE = "负用量"
    HIGH_THRESHOLD = "用量超上限"
    LOW_THRESHOLD = "用量超下限"
    RATIO_EXCEEDED = "环比异常"
    MANUAL_LIST = "异常清单"
    MULTIPLIER_CHANGED = "倍率变动"


@dataclass
class Anomaly:
    record: Record
    anomaly_type: AnomalyType
    description: str
    value: float = 0.0
    threshold: Optional[float] = None


@dataclass
class RuleResult:
    records: List[Record] = field(default_factory=list)
    anomalies: List[Anomaly] = field(default_factory=list)
    statistics: Dict[str, int] = field(default_factory=dict)

    def get_anomalies_by_type(self, anomaly_type: AnomalyType) -> List[Anomaly]:
        return [a for a in self.anomalies if a.anomaly_type == anomaly_type]


class ValidationRules:
    def __init__(self, 
                 min_usage: float = 0.0,
                 max_usage: float = 10000.0,
                 ratio_threshold: float = 3.0,
                 manual_anomaly_list: Optional[Set[str]] = None,
                 allow_zero_usage: bool = True):
        self.min_usage = min_usage
        self.max_usage = max_usage
        self.ratio_threshold = ratio_threshold
        self.manual_anomaly_list = manual_anomaly_list or set()
        self.allow_zero_usage = allow_zero_usage

    def apply(self, records: List[Record], previous_records: Optional[List[Record]] = None) -> RuleResult:
        result = RuleResult()
        result.records = records.copy()
        
        record_map = {r.meter_number: r for r in records if r.is_valid}
        prev_map = {r.meter_number: r for r in (previous_records or []) if r.is_valid}

        for record in records:
            if not record.is_valid:
                continue

            anomalies = self._check_record(record, record_map, prev_map)
            result.anomalies.extend(anomalies)

        self._update_statistics(result)
        return result

    def _check_record(self, record: Record, record_map: Dict[str, Record], prev_map: Dict[str, Record]) -> List[Anomaly]:
        anomalies = []
        usage = record.usage

        if usage < 0:
            anomalies.append(Anomaly(
                record=record,
                anomaly_type=AnomalyType.NEGATIVE_USAGE,
                description=f"用量为负值: {usage:.2f}",
                value=usage
            ))

        if not self.allow_zero_usage and usage == 0:
            anomalies.append(Anomaly(
                record=record,
                anomaly_type=AnomalyType.ZERO_USAGE,
                description="用量为零",
                value=usage
            ))

        if usage > self.max_usage:
            anomalies.append(Anomaly(
                record=record,
                anomaly_type=AnomalyType.HIGH_THRESHOLD,
                description=f"用量({usage:.2f})超过上限({self.max_usage:.2f})",
                value=usage,
                threshold=self.max_usage
            ))

        if usage < self.min_usage and usage > 0:
            anomalies.append(Anomaly(
                record=record,
                anomaly_type=AnomalyType.LOW_THRESHOLD,
                description=f"用量({usage:.2f})低于下限({self.min_usage:.2f})",
                value=usage,
                threshold=self.min_usage
            ))

        if record.meter_number in prev_map:
            prev_record = prev_map[record.meter_number]
            prev_usage = prev_record.usage
            if prev_usage > 0 and usage > 0:
                ratio = usage / prev_usage
                if ratio > self.ratio_threshold or ratio < (1 / self.ratio_threshold):
                    direction = "上升" if ratio > 1 else "下降"
                    anomalies.append(Anomaly(
                        record=record,
                        anomaly_type=AnomalyType.RATIO_EXCEEDED,
                        description=f"用量环比{direction}超过阈值: {ratio:.2f}倍",
                        value=ratio,
                        threshold=self.ratio_threshold
                    ))

        if record.meter_number in self.manual_anomaly_list:
            anomalies.append(Anomaly(
                record=record,
                anomaly_type=AnomalyType.MANUAL_LIST,
                description="表号在异常清单中",
                value=1.0
            ))

        if record.meter_number in prev_map:
            prev_record = prev_map[record.meter_number]
            if record.multiplier != prev_record.multiplier:
                anomalies.append(Anomaly(
                    record=record,
                    anomaly_type=AnomalyType.MULTIPLIER_CHANGED,
                    description=f"倍率变动: {prev_record.multiplier} -> {record.multiplier}",
                    value=record.multiplier
                ))

        return anomalies

    def _update_statistics(self, result: RuleResult):
        for anomaly_type in AnomalyType:
            count = len(result.get_anomalies_by_type(anomaly_type))
            result.statistics[anomaly_type.value] = count

        result.statistics['总异常数'] = len(result.anomalies)
        result.statistics['有效记录数'] = len([r for r in result.records if r.is_valid])
        result.statistics['无效记录数'] = len([r for r in result.records if not r.is_valid])


class MissingMeterDetector:
    def __init__(self, expected_meters: Optional[Set[str]] = None):
        self.expected_meters = expected_meters or set()

    def detect(self, current_records: List[Record], previous_records: Optional[List[Record]] = None) -> List[str]:
        found_meters = {r.meter_number for r in current_records if r.is_valid and r.meter_number}
        missing = []

        if self.expected_meters:
            missing.extend(sorted(self.expected_meters - found_meters))

        if previous_records:
            prev_meters = {r.meter_number for r in previous_records if r.is_valid and r.meter_number}
            missing_from_prev = sorted(prev_meters - found_meters)
            missing.extend([m for m in missing_from_prev if m not in missing])

        return missing
