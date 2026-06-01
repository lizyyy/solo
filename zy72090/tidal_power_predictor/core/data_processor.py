from dataclasses import dataclass, field
from typing import List, Dict, Tuple
from collections import defaultdict
from .calculator import (
    TidalPredictionInput,
    TidalPredictionResult,
    TidalPowerCalculator,
    ValidationIssue,
)


@dataclass
class DuplicateRecord:
    primary_record_id: str
    duplicate_record_ids: List[str]
    similarity_score: float
    fields_compared: List[str]


@dataclass
class ProcessingSummary:
    total_records: int = 0
    success_count: int = 0
    needs_review_count: int = 0
    failed_count: int = 0
    old_portal_count: int = 0
    duplicate_count: int = 0
    duplicates: List[DuplicateRecord] = field(default_factory=list)
    total_power_kwh: float = 0.0
    avg_confidence: float = 0.0


class TidalDataProcessor:
    def __init__(self):
        self.calculator = TidalPowerCalculator()

    def _check_duplicates(self, records: List[TidalPredictionInput]) -> List[DuplicateRecord]:
        duplicates = []
        groups = defaultdict(list)

        for record in records:
            key = (
                record.station_name,
                record.tidal_range,
                record.tidal_range_unit,
                record.flow_rate,
                record.flow_rate_unit,
            )
            groups[key].append(record)

        for key, group_records in groups.items():
            if len(group_records) > 1 and key[0] and key[1] is not None:
                duplicates.append(DuplicateRecord(
                    primary_record_id=group_records[0].record_id,
                    duplicate_record_ids=[r.record_id for r in group_records[1:]],
                    similarity_score=1.0,
                    fields_compared=["station_name", "tidal_range", "tidal_range_unit", "flow_rate", "flow_rate_unit"]
                ))

        return duplicates

    def _add_duplicate_warnings(
        self,
        results: Dict[str, TidalPredictionResult],
        duplicates: List[DuplicateRecord]
    ) -> None:
        for dup in duplicates:
            for dup_id in dup.duplicate_record_ids:
                if dup_id in results:
                    results[dup_id].issues.append(ValidationIssue(
                        level="warning",
                        field="duplicate_check",
                        message=f"疑似重复记录，与 {dup.primary_record_id} 高度相似",
                        suggestion="请确认是否为重复录入，删除冗余数据"
                    ))
                    if results[dup_id].status == "success":
                        results[dup_id].status = "needs_review"
                        results[dup_id].processing_notes += " | 存在重复记录嫌疑，需人工确认"

    def process_batch(
        self,
        records: List[TidalPredictionInput]
    ) -> Tuple[List[TidalPredictionResult], ProcessingSummary]:
        results = []
        result_map = {}
        summary = ProcessingSummary(total_records=len(records))

        for record in records:
            result = self.calculator.calculate_power(record)
            results.append(result)
            result_map[result.record_id] = result

        duplicates = self._check_duplicates(records)
        summary.duplicates = duplicates
        summary.duplicate_count = len(duplicates)
        self._add_duplicate_warnings(result_map, duplicates)

        results.sort(key=lambda x: x.timestamp)

        success_power = []
        confidence_scores = []
        for result in results:
            if result.status == "success":
                summary.success_count += 1
            elif result.status == "needs_review":
                summary.needs_review_count += 1
            elif result.status == "failed":
                summary.failed_count += 1

            if result.input.data_source == "old_portal":
                summary.old_portal_count += 1

            if result.predicted_power is not None:
                success_power.append(result.predicted_power)
                confidence_scores.append(result.confidence_score)

        if success_power:
            summary.total_power_kwh = sum(success_power)
        if confidence_scores:
            summary.avg_confidence = sum(confidence_scores) / len(confidence_scores)

        return results, summary

    def export_to_csv(self, results: List[TidalPredictionResult], filepath: str) -> None:
        import csv

        headers = [
            "记录ID",
            "时间",
            "测站名称",
            "潮差",
            "潮差单位",
            "流量",
            "流量单位",
            "水轮机效率",
            "数据来源",
            "预测功率(kW)",
            "计算方法",
            "状态",
            "置信度",
            "问题数",
            "警告信息",
            "处理备注",
            "原始备注"
        ]

        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for result in results:
                warnings = "; ".join([
                    f"[{issue.level}] {issue.message}"
                    for issue in result.issues
                ])

                writer.writerow([
                    result.record_id,
                    result.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    result.station_name,
                    result.input.tidal_range if result.input.tidal_range is not None else "",
                    result.input.tidal_range_unit,
                    result.input.flow_rate if result.input.flow_rate is not None else "",
                    result.input.flow_rate_unit,
                    f"{result.input.turbine_efficiency:.2%}" if result.input.turbine_efficiency else "",
                    result.input.data_source,
                    f"{result.predicted_power:.2f}" if result.predicted_power is not None else "",
                    result.calculation_method,
                    self._get_status_text(result.status),
                    f"{result.confidence_score:.1%}" if result.confidence_score > 0 else "",
                    len(result.issues),
                    warnings,
                    result.processing_notes,
                    result.input.notes
                ])

    def _get_status_text(self, status: str) -> str:
        status_map = {
            "success": "计算成功",
            "needs_review": "待人工确认",
            "failed": "计算失败",
            "pending": "待处理"
        }
        return status_map.get(status, status)
