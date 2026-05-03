"""
异常检测模块
"""

from typing import Dict, List, Any, Tuple
from collections import defaultdict
from datetime import datetime, timedelta

from .models import (
    InjectionRecord,
    SampleType,
    QCIssue,
    QCIssueType,
    ChainOfCustodyEntry,
    BatchData,
)


def detect_duplicate_sample_ids(
    batch_data: BatchData,
) -> List[QCIssue]:
    issues = []
    
    sample_id_counts = defaultdict(list)
    for idx, injection in enumerate(batch_data.run_sequence):
        sample_id_counts[injection.sample_id].append({
            "index": idx,
            "vial": injection.vial_position,
            "time": injection.injection_time,
            "type": injection.sample_type.value,
        })
    
    for sample_id, occurrences in sample_id_counts.items():
        if len(occurrences) > 1:
            issues.append(QCIssue(
                issue_type=QCIssueType.DUPLICATE_SAMPLE_ID,
                severity="high",
                sample_ids=[sample_id],
                description=f"样本编号重复: {sample_id} 出现 {len(occurrences)} 次",
                details={
                    "sample_id": sample_id,
                    "occurrences": len(occurrences),
                    "injections": [
                        {
                            "index": occ["index"],
                            "vial": occ["vial"],
                            "time": occ["time"].isoformat() if isinstance(occ["time"], datetime) else str(occ["time"]),
                            "type": occ["type"],
                        }
                        for occ in occurrences
                    ],
                },
            ))
    
    return issues


def detect_chain_of_custody_breaks(
    batch_data: BatchData,
    max_time_gap_hours: float = 24.0,
) -> List[QCIssue]:
    issues = []
    
    for sample_id, custody_entries in batch_data.chain_of_custody.items():
        if len(custody_entries) < 2:
            continue
        
        sorted_entries = sorted(custody_entries, key=lambda x: x.timestamp)
        
        for i in range(len(sorted_entries) - 1):
            current = sorted_entries[i]
            next_entry = sorted_entries[i + 1]
            
            time_diff = next_entry.timestamp - current.timestamp
            time_diff_hours = time_diff.total_seconds() / 3600.0
            
            if time_diff_hours > max_time_gap_hours:
                issues.append(QCIssue(
                    issue_type=QCIssueType.CHAIN_OF_CUSTODY_BREAK,
                    severity="critical",
                    sample_ids=[sample_id],
                    description=f"交接记录断链: {sample_id} 在 {current.timestamp} 和 {next_entry.timestamp} 之间间隔 {time_diff_hours:.1f} 小时",
                    details={
                        "sample_id": sample_id,
                        "gap_hours": time_diff_hours,
                        "max_allowed_hours": max_time_gap_hours,
                        "previous_entry": {
                            "timestamp": current.timestamp.isoformat(),
                            "action": current.action,
                            "actor": current.actor,
                            "location": current.location,
                        },
                        "next_entry": {
                            "timestamp": next_entry.timestamp.isoformat(),
                            "action": next_entry.action,
                            "actor": next_entry.actor,
                            "location": next_entry.location,
                        },
                    },
                ))
        
        for i in range(len(sorted_entries) - 1):
            current = sorted_entries[i]
            next_entry = sorted_entries[i + 1]
            
            valid_transitions = {
                ("收到样本", "前处理"),
                ("前处理", "进样分析"),
                ("进样分析", "数据审核"),
                ("数据审核", "报告出具"),
                ("收到样本", "存储"),
                ("存储", "前处理"),
                ("前处理", "存储"),
                ("存储", "复检"),
            }
            
            transition = (current.action, next_entry.action)
            reverse_transition = (next_entry.action, current.action)
            
            if transition not in valid_transitions and reverse_transition not in valid_transitions:
                if current.action != next_entry.action:
                    issues.append(QCIssue(
                        issue_type=QCIssueType.CHAIN_OF_CUSTODY_BREAK,
                        severity="high",
                        sample_ids=[sample_id],
                        description=f"交接记录顺序异常: {sample_id} 从 {current.action} 到 {next_entry.action}",
                        details={
                            "sample_id": sample_id,
                            "previous_action": current.action,
                            "next_action": next_entry.action,
                            "previous_time": current.timestamp.isoformat(),
                            "next_time": next_entry.timestamp.isoformat(),
                        },
                    ))
    
    sample_ids_in_run = set(inj.sample_id for inj in batch_data.run_sequence)
    sample_ids_in_custody = set(batch_data.chain_of_custody.keys())
    
    missing_custody = sample_ids_in_run - sample_ids_in_custody
    for sample_id in missing_custody:
        issues.append(QCIssue(
            issue_type=QCIssueType.CHAIN_OF_CUSTODY_BREAK,
            severity="critical",
            sample_ids=[sample_id],
            description=f"样本 {sample_id} 无交接记录",
            details={
                "sample_id": sample_id,
                "issue": "missing_chain_of_custody",
            },
        ))
    
    return issues


def detect_cross_midnight_injections(
    batch_data: BatchData,
    midnight_cutoff_hour: int = 0,
) -> List[QCIssue]:
    issues = []
    
    injections = batch_data.run_sequence
    if len(injections) < 2:
        return issues
    
    sorted_injections = sorted(injections, key=lambda x: x.injection_time)
    
    for i in range(len(sorted_injections) - 1):
        current = sorted_injections[i]
        next_inj = sorted_injections[i + 1]
        
        current_time = current.injection_time
        next_time = next_inj.injection_time
        
        current_date = current_time.date()
        next_date = next_time.date()
        
        if current_date != next_date:
            midnight = datetime.combine(next_date, datetime.min.time())
            hours_from_midnight = (next_time - midnight).total_seconds() / 3600.0
            
            if hours_from_midnight < 6:
                issues.append(QCIssue(
                    issue_type=QCIssueType.CROSS_MIDNIGHT_INJECTION,
                    severity="medium",
                    sample_ids=[next_inj.sample_id],
                    description=f"跨午夜进样归属可能错误: {next_inj.sample_id} 进样时间 {next_time} 距离午夜仅 {hours_from_midnight:.1f} 小时",
                    details={
                        "sample_id": next_inj.sample_id,
                        "injection_time": next_time.isoformat(),
                        "previous_injection": {
                            "sample_id": current.sample_id,
                            "time": current_time.isoformat(),
                        },
                        "hours_from_midnight": hours_from_midnight,
                        "date_difference": str(next_date - current_date),
                    },
                ))
    
    date_groups = defaultdict(list)
    for idx, inj in enumerate(sorted_injections):
        date_str = inj.injection_time.date().isoformat()
        date_groups[date_str].append({
            "index": idx,
            "sample_id": inj.sample_id,
            "time": inj.injection_time,
        })
    
    for date_str, date_injs in date_groups.items():
        if len(date_injs) < 2:
            continue
        
        for i in range(len(date_injs) - 1):
            current = date_injs[i]
            next_inj = date_injs[i + 1]
            
            time_diff = next_inj["time"] - current["time"]
            time_diff_hours = time_diff.total_seconds() / 3600.0
            
            if time_diff_hours > 12:
                issues.append(QCIssue(
                    issue_type=QCIssueType.CROSS_MIDNIGHT_INJECTION,
                    severity="medium",
                    sample_ids=[next_inj["sample_id"]],
                    description=f"同日进样间隔异常: {current['sample_id']} 与 {next_inj['sample_id']} 间隔 {time_diff_hours:.1f} 小时",
                    details={
                        "date": date_str,
                        "previous_sample": current["sample_id"],
                        "previous_time": current["time"].isoformat(),
                        "next_sample": next_inj["sample_id"],
                        "next_time": next_inj["time"].isoformat(),
                        "gap_hours": time_diff_hours,
                    },
                ))
    
    return issues


def detect_out_of_order_custody(
    batch_data: BatchData,
) -> List[QCIssue]:
    issues = []
    
    for sample_id, custody_entries in batch_data.chain_of_custody.items():
        for i in range(len(custody_entries) - 1):
            current = custody_entries[i]
            next_entry = custody_entries[i + 1]
            
            if current.timestamp > next_entry.timestamp:
                issues.append(QCIssue(
                    issue_type=QCIssueType.CHAIN_OF_CUSTODY_BREAK,
                    severity="high",
                    sample_ids=[sample_id],
                    description=f"交接记录时间顺序错误: {sample_id}",
                    details={
                        "sample_id": sample_id,
                        "issue": "timestamp_out_of_order",
                        "earlier_entry": {
                            "timestamp": current.timestamp.isoformat(),
                            "action": current.action,
                            "actor": current.actor,
                        },
                        "later_entry": {
                            "timestamp": next_entry.timestamp.isoformat(),
                            "action": next_entry.action,
                            "actor": next_entry.actor,
                        },
                    },
                ))
    
    return issues


def run_anomaly_detection(
    batch_data: BatchData,
    config: Dict[str, Any] = None,
) -> BatchData:
    config = config or {}
    
    max_custody_gap = config.get("max_chain_of_custody_gap_hours", 24.0)
    
    duplicate_issues = detect_duplicate_sample_ids(batch_data)
    batch_data.qc_issues.extend(duplicate_issues)
    
    custody_issues = detect_chain_of_custody_breaks(batch_data, max_custody_gap)
    batch_data.qc_issues.extend(custody_issues)
    
    order_issues = detect_out_of_order_custody(batch_data)
    batch_data.qc_issues.extend(order_issues)
    
    midnight_issues = detect_cross_midnight_injections(batch_data)
    batch_data.qc_issues.extend(midnight_issues)
    
    return batch_data
