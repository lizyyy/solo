from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
from datetime import datetime
from .models import (
    SamplePosition, ScanLogEntry, TemperatureReading,
    TransferForm, ValidationIssue, ValidationRule, ValidationSeverity
)


def check_duplicate_barcodes(sample_positions: List[SamplePosition]) -> List[ValidationIssue]:
    issues = []
    barcode_counts = defaultdict(int)
    barcode_locations = defaultdict(list)
    
    for pos in sample_positions:
        barcode = pos.barcode
        barcode_counts[barcode] += 1
        barcode_locations[barcode].append(
            f"盒{pos.box_id}孔{pos.position_str}"
        )
    
    for barcode, count in barcode_counts.items():
        if count > 1:
            issue = ValidationIssue(
                rule=ValidationRule.DUPLICATE_BARCODE,
                severity=ValidationSeverity.ERROR,
                message=f"条码 {barcode} 重复出现 {count} 次",
                affected_samples=[barcode],
                details={
                    "locations": barcode_locations[barcode],
                    "duplicate_count": count
                }
            )
            issues.append(issue)
    
    return issues


def check_invalid_positions(sample_positions: List[SamplePosition], 
                            max_rows: int = 10, max_cols: int = 10) -> List[ValidationIssue]:
    issues = []
    
    for pos in sample_positions:
        if pos.row < 0 or pos.row >= max_rows:
            issue = ValidationIssue(
                rule=ValidationRule.INVALID_POSITION,
                severity=ValidationSeverity.ERROR,
                message=f"条码 {pos.barcode} 的行位置 {pos.position_str[0]} 超出范围",
                affected_samples=[pos.barcode],
                details={
                    "box_id": pos.box_id,
                    "position": pos.position_str,
                    "row_index": pos.row,
                    "max_rows": max_rows
                }
            )
            issues.append(issue)
        
        if pos.col < 0 or pos.col >= max_cols:
            issue = ValidationIssue(
                rule=ValidationRule.INVALID_POSITION,
                severity=ValidationSeverity.ERROR,
                message=f"条码 {pos.barcode} 的列位置 {pos.position_str[1:]} 超出范围",
                affected_samples=[pos.barcode],
                details={
                    "box_id": pos.box_id,
                    "position": pos.position_str,
                    "col_index": pos.col,
                    "max_cols": max_cols
                }
            )
            issues.append(issue)
    
    return issues


def check_scan_vs_position(sample_positions: List[SamplePosition],
                            scan_logs: List[ScanLogEntry]) -> List[ValidationIssue]:
    issues = []
    
    position_barcodes = {p.barcode for p in sample_positions}
    scanned_barcodes = {s.barcode for s in scan_logs}
    
    missing_scans = position_barcodes - scanned_barcodes
    unexpected_scans = scanned_barcodes - position_barcodes
    
    if missing_scans:
        issue = ValidationIssue(
            rule=ValidationRule.MISSING_SCAN,
            severity=ValidationSeverity.ERROR,
            message=f"有 {len(missing_scans)} 个样本在位置表中但未被扫描",
            affected_samples=list(missing_scans)[:10],
            details={
                "count": len(missing_scans),
                "all_missing": list(missing_scans)
            }
        )
        issues.append(issue)
    
    if unexpected_scans:
        issue = ValidationIssue(
            rule=ValidationRule.UNEXPECTED_SCAN,
            severity=ValidationSeverity.WARNING,
            message=f"有 {len(unexpected_scans)} 个条码被扫描但不在位置表中",
            affected_samples=list(unexpected_scans)[:10],
            details={
                "count": len(unexpected_scans),
                "all_unexpected": list(unexpected_scans)
            }
        )
        issues.append(issue)
    
    return issues


def check_temperature_alerts(readings: List[TemperatureReading],
                              min_temp: float = -85.0,
                              max_temp: float = -70.0) -> List[ValidationIssue]:
    issues = []
    
    exceeded_readings = [
        r for r in readings
        if r.temperature < min_temp or r.temperature > max_temp
    ]
    
    unmarked_alerts = [
        r for r in exceeded_readings
        if not r.alert_marked
    ]
    
    if exceeded_readings:
        issue = ValidationIssue(
            rule=ValidationRule.TEMPERATURE_EXCEEDED,
            severity=ValidationSeverity.WARNING,
            message=f"检测到 {len(exceeded_readings)} 次温度超限",
            details={
                "count": len(exceeded_readings),
                "min_threshold": min_temp,
                "max_threshold": max_temp,
                "readings": [
                    {"time": r.timestamp.isoformat(), "temp": r.temperature}
                    for r in exceeded_readings[:10]
                ]
            }
        )
        issues.append(issue)
    
    if unmarked_alerts:
        issue = ValidationIssue(
            rule=ValidationRule.TEMPERATURE_NOT_MARKED,
            severity=ValidationSeverity.ERROR,
            message=f"有 {len(unmarked_alerts)} 次温度超限未被人工标记确认",
            details={
                "count": len(unmarked_alerts),
                "unmarked_readings": [
                    {"time": r.timestamp.isoformat(), "temp": r.temperature}
                    for r in unmarked_alerts[:10]
                ]
            }
        )
        issues.append(issue)
    
    return issues


def check_signatures(transfer_form: Optional[TransferForm]) -> List[ValidationIssue]:
    issues = []
    
    if not transfer_form:
        issue = ValidationIssue(
            rule=ValidationRule.MISSING_SIGNATURE,
            severity=ValidationSeverity.WARNING,
            message="未提供交接单信息",
            details={"issue": "transfer_form_not_provided"}
        )
        issues.append(issue)
        return issues
    
    missing_sigs = []
    if not transfer_form.sender_signature:
        missing_sigs.append("发送方")
    if not transfer_form.receiver_signature:
        missing_sigs.append("接收方")
    
    if missing_sigs:
        issue = ValidationIssue(
            rule=ValidationRule.MISSING_SIGNATURE,
            severity=ValidationSeverity.ERROR,
            message=f"缺少签字: {', '.join(missing_sigs)}",
            details={
                "transfer_id": transfer_form.transfer_id,
                "missing": missing_sigs,
                "sender": transfer_form.sender_name,
                "receiver": transfer_form.receiver_name
            }
        )
        issues.append(issue)
    
    return issues


def check_box_transfer_chain(sample_positions: List[SamplePosition],
                              transfer_form: Optional[TransferForm]) -> List[ValidationIssue]:
    issues = []
    
    if not transfer_form:
        return issues
    
    position_boxes = {p.box_id for p in sample_positions}
    form_boxes = set(transfer_form.box_ids)
    
    if not form_boxes:
        issue = ValidationIssue(
            rule=ValidationRule.INCOMPLETE_TRANSFER_CHAIN,
            severity=ValidationSeverity.WARNING,
            message="交接单中未包含任何冻存盒编号",
            details={"transfer_id": transfer_form.transfer_id}
        )
        issues.append(issue)
        return issues
    
    missing_from_form = position_boxes - form_boxes
    missing_from_positions = form_boxes - position_boxes
    
    if missing_from_form:
        issue = ValidationIssue(
            rule=ValidationRule.INCOMPLETE_TRANSFER_CHAIN,
            severity=ValidationSeverity.ERROR,
            message=f"有 {len(missing_from_form)} 个冻存盒在位置表中但未在交接单中",
            details={
                "transfer_id": transfer_form.transfer_id,
                "missing_boxes": list(missing_from_form)
            }
        )
        issues.append(issue)
    
    if missing_from_positions:
        issue = ValidationIssue(
            rule=ValidationRule.INCOMPLETE_TRANSFER_CHAIN,
            severity=ValidationSeverity.WARNING,
            message=f"有 {len(missing_from_positions)} 个冻存盒在交接单中但未在位置表中",
            details={
                "transfer_id": transfer_form.transfer_id,
                "extra_boxes": list(missing_from_positions)
            }
        )
        issues.append(issue)
    
    return issues


def check_batch_consistency(sample_positions: List[SamplePosition]) -> List[ValidationIssue]:
    issues = []
    
    batch_to_boxes = defaultdict(set)
    for pos in sample_positions:
        if pos.batch_id:
            batch_to_boxes[pos.batch_id].add(pos.box_id)
    
    for batch_id, boxes in batch_to_boxes.items():
        if len(boxes) > 1:
            issue = ValidationIssue(
                rule=ValidationRule.POSITION_MISMATCH,
                severity=ValidationSeverity.INFO,
                message=f"批次 {batch_id} 分布在 {len(boxes)} 个冻存盒中",
                details={
                    "batch_id": batch_id,
                    "boxes": list(boxes)
                }
            )
            issues.append(issue)
    
    return issues


def run_all_rules(sample_positions: List[SamplePosition],
                  scan_logs: List[ScanLogEntry],
                  temperature_readings: List[TemperatureReading],
                  transfer_form: Optional[TransferForm],
                  config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
    config = config or {}
    
    all_issues = []
    
    all_issues.extend(check_duplicate_barcodes(sample_positions))
    
    max_rows = config.get("max_rows", 10)
    max_cols = config.get("max_cols", 10)
    all_issues.extend(check_invalid_positions(sample_positions, max_rows, max_cols))
    
    all_issues.extend(check_scan_vs_position(sample_positions, scan_logs))
    
    min_temp = config.get("min_temp", -85.0)
    max_temp = config.get("max_temp", -70.0)
    all_issues.extend(check_temperature_alerts(temperature_readings, min_temp, max_temp))
    
    all_issues.extend(check_signatures(transfer_form))
    
    all_issues.extend(check_box_transfer_chain(sample_positions, transfer_form))
    
    all_issues.extend(check_batch_consistency(sample_positions))
    
    all_issues.sort(key=lambda x: {
        ValidationSeverity.ERROR: 0,
        ValidationSeverity.WARNING: 1,
        ValidationSeverity.INFO: 2
    }[x.severity])
    
    return all_issues
