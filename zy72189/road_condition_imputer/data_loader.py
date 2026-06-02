import copy
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .models import (
    RoadConditionRecord,
    ValidationIssue,
    Severity,
    MissingType,
    AuditEntry,
)


class DataLoader:
    def __init__(self, audit_log: Optional[List[AuditEntry]] = None, run_id: str = ""):
        self.audit_log = audit_log if audit_log is not None else []
        self.run_id = run_id

    def _log(self, record_id: str, action: str, details: Dict):
        self.audit_log.append(
            AuditEntry(
                run_id=self.run_id,
                record_id=record_id,
                action=action,
                actor="DataLoader",
                details=details,
                timestamp=datetime.now().isoformat(),
            )
        )

    def load_records(self, raw_data: List[Dict]) -> List[RoadConditionRecord]:
        records = []
        for item in raw_data:
            record = RoadConditionRecord(
                record_id=item.get("record_id", ""),
                timestamp=item.get("timestamp"),
                road_segment=item.get("road_segment"),
                congestion_level=item.get("congestion_level"),
                weather=item.get("weather"),
                temperature=item.get("temperature"),
                surface_condition=item.get("surface_condition"),
                traffic_volume=item.get("traffic_volume"),
                source=item.get("source", "unknown"),
                loaded_at=datetime.now().isoformat(),
            )
            records.append(record)
            self._log(record.record_id, "loaded", {"source": record.source, "raw_keys": list(item.keys())})
        return records

    def validate(self, records: List[RoadConditionRecord]) -> Tuple[List[RoadConditionRecord], List[ValidationIssue]]:
        issues = []
        clean = []
        seen_ids = set()

        for rec in records:
            rec_issues = []

            if not rec.record_id:
                issue = ValidationIssue(
                    record_id="UNKNOWN",
                    severity=Severity.ERROR,
                    issue_type="missing_id",
                    description="记录缺少 record_id，无法追踪",
                    suggestion="请补全 record_id 后重新提交",
                )
                rec_issues.append(issue)
                self._log("UNKNOWN", "validation_error", {"issue": "missing_id"})
                continue

            if rec.record_id in seen_ids:
                issue = ValidationIssue(
                    record_id=rec.record_id,
                    severity=Severity.WARNING,
                    issue_type="duplicate_id",
                    description=f"record_id={rec.record_id} 重复出现，已去重保留第一条",
                    original_value=rec.record_id,
                    suggestion="检查数据源是否重复导出，确认后可删除重复项",
                )
                rec_issues.append(issue)
                self._log(rec.record_id, "duplicate_detected", {"duplicate_of": rec.record_id})
                continue
            seen_ids.add(rec.record_id)

            non_none_fields = [
                k for k in ["timestamp", "road_segment", "congestion_level", "weather",
                            "temperature", "surface_condition", "traffic_volume"]
                if getattr(rec, k) is not None
            ]
            if len(non_none_fields) == 0:
                issue = ValidationIssue(
                    record_id=rec.record_id,
                    severity=Severity.ERROR,
                    issue_type="full_row_missing",
                    description="整行所有业务字段均为空，无法修补",
                    suggestion="确认该记录是否为误导入，若真实存在请从原始来源补全至少一个字段",
                )
                rec_issues.append(issue)
                self._log(rec.record_id, "validation_error", {"issue": "full_row_missing"})
                continue

            if rec.congestion_level is not None:
                try:
                    val = float(rec.congestion_level)
                    if val < 0 or val > 10:
                        issue = ValidationIssue(
                            record_id=rec.record_id,
                            severity=Severity.WARNING,
                            issue_type="out_of_range",
                            description=f"congestion_level={rec.congestion_level} 超出合理范围 [0, 10]",
                            original_value=rec.congestion_level,
                            suggestion="检查数据采集设备是否异常，确认后手动修正或标记异常",
                        )
                        rec_issues.append(issue)
                except (ValueError, TypeError):
                    issue = ValidationIssue(
                        record_id=rec.record_id,
                        severity=Severity.WARNING,
                        issue_type="type_error",
                        description=f"congestion_level={rec.congestion_level} 不是有效数值",
                        original_value=rec.congestion_level,
                        suggestion="请修正为 0-10 之间的数值",
                    )
                    rec_issues.append(issue)

            if rec.traffic_volume is not None:
                try:
                    val = int(rec.traffic_volume)
                    if val < 0:
                        issue = ValidationIssue(
                            record_id=rec.record_id,
                            severity=Severity.WARNING,
                            issue_type="out_of_range",
                            description=f"traffic_volume={rec.traffic_volume} 为负数",
                            original_value=rec.traffic_volume,
                            suggestion="交通流量不应为负，请核实原始数据",
                        )
                        rec_issues.append(issue)
                except (ValueError, TypeError):
                    issue = ValidationIssue(
                        record_id=rec.record_id,
                        severity=Severity.WARNING,
                        issue_type="type_error",
                        description=f"traffic_volume={rec.traffic_volume} 不是有效整数",
                        original_value=rec.traffic_volume,
                        suggestion="请修正为非负整数",
                    )
                    rec_issues.append(issue)

            missing_fields = [
                k for k in ["timestamp", "road_segment", "congestion_level", "weather",
                            "temperature", "surface_condition", "traffic_volume"]
                if getattr(rec, k) is None
            ]
            if missing_fields:
                issue = ValidationIssue(
                    record_id=rec.record_id,
                    severity=Severity.INFO,
                    issue_type="partial_missing",
                    description=f"缺失字段: {', '.join(missing_fields)}",
                    suggestion="模型将根据同路段历史数据修补缺失字段",
                )
                rec_issues.append(issue)

            issues.extend(rec_issues)
            clean.append(rec)
            self._log(rec.record_id, "validated", {"issue_count": len(rec_issues)})

        return clean, issues

    def classify_missing(self, record: RoadConditionRecord) -> MissingType:
        missing = [
            k for k in ["timestamp", "road_segment", "congestion_level", "weather",
                        "temperature", "surface_condition", "traffic_volume"]
            if getattr(record, k) is None
        ]
        if len(missing) == 0:
            return MissingType.NONE
        elif len(missing) == 1:
            return MissingType.SINGLE_FIELD
        elif len(missing) < len([
            "timestamp", "road_segment", "congestion_level", "weather",
            "temperature", "surface_condition", "traffic_volume"
        ]):
            return MissingType.MULTI_FIELD
        else:
            return MissingType.FULL_ROW
