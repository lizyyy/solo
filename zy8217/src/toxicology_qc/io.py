"""
文件读取和写入模块
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

import yaml

from .models import (
    InjectionRecord,
    SampleType,
    ChainOfCustodyEntry,
    QCIssue,
    BatchData,
)


def parse_datetime(dt_str: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
        "%d-%b-%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析日期时间格式: {dt_str}")


def parse_sample_type(type_str: str) -> SampleType:
    type_str = type_str.lower().strip()
    type_map = {
        "unknown": SampleType.UNKNOWN,
        "sample": SampleType.UNKNOWN,
        "unknown_sample": SampleType.UNKNOWN,
        "calibrator": SampleType.CALIBRATOR,
        "cal": SampleType.CALIBRATOR,
        "standard": SampleType.CALIBRATOR,
        "qc": SampleType.QC,
        "quality_control": SampleType.QC,
        "control": SampleType.QC,
        "blank": SampleType.BLANK,
        "solvent_blank": SampleType.BLANK,
        "matrix_blank": SampleType.BLANK,
        "internal_standard": SampleType.INTERNAL_STANDARD,
        "is": SampleType.INTERNAL_STANDARD,
    }
    return type_map.get(type_str, SampleType.UNKNOWN)


def read_run_sequence(file_path: str) -> List[InjectionRecord]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"进样序列文件不存在: {file_path}")
    
    injections = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sample_id = row.get("sample_id", row.get("SampleID", row.get("sample", ""))).strip()
            if not sample_id:
                continue
            
            vial = row.get("vial_position", row.get("Vial", row.get("vial", "A1"))).strip()
            
            time_str = row.get("injection_time", row.get("InjectionTime", row.get("time", ""))).strip()
            try:
                inj_time = parse_datetime(time_str) if time_str else datetime.now()
            except ValueError:
                inj_time = datetime.now()
            
            type_str = row.get("sample_type", row.get("SampleType", row.get("type", "unknown"))).strip()
            sample_type = parse_sample_type(type_str)
            
            metadata = {}
            for key, value in row.items():
                if key not in ["sample_id", "SampleID", "sample", "vial_position", "Vial", "vial", 
                              "injection_time", "InjectionTime", "time", "sample_type", "SampleType", "type"]:
                    if value and value.strip():
                        metadata[key] = value.strip()
            
            injection = InjectionRecord(
                sample_id=sample_id,
                vial_position=vial,
                injection_time=inj_time,
                sample_type=sample_type,
                metadata=metadata,
            )
            injections.append(injection)
    
    return injections


def read_calibration_config(file_path: str) -> Dict[str, Any]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"校准配置文件不存在: {file_path}")
    
    with open(path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    
    return config


def read_peak_table(file_path: str) -> Dict[str, Dict[str, float]]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"峰表文件不存在: {file_path}")
    
    peak_data = {}
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sample_id = row.get("sample_id", row.get("SampleID", "")).strip()
            if not sample_id:
                continue
            
            if sample_id not in peak_data:
                peak_data[sample_id] = {}
            
            for key, value in row.items():
                if key in ["sample_id", "SampleID"]:
                    continue
                try:
                    num_value = float(value)
                    peak_data[sample_id][key] = num_value
                except (ValueError, TypeError):
                    if value and value.strip():
                        peak_data[sample_id][key] = value
    
    return peak_data


def read_chain_of_custody(file_path: str) -> Dict[str, List[ChainOfCustodyEntry]]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"交接记录文件不存在: {file_path}")
    
    custody_data = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            try:
                entry_data = json.loads(line)
            except json.JSONDecodeError:
                continue
            
            sample_id = entry_data.get("sample_id", entry_data.get("SampleID", "")).strip()
            if not sample_id:
                continue
            
            timestamp_str = entry_data.get("timestamp", entry_data.get("Timestamp", entry_data.get("time", ""))).strip()
            try:
                timestamp = parse_datetime(timestamp_str) if timestamp_str else datetime.now()
            except ValueError:
                timestamp = datetime.now()
            
            entry = ChainOfCustodyEntry(
                sample_id=sample_id,
                timestamp=timestamp,
                action=entry_data.get("action", entry_data.get("Action", "unknown")).strip(),
                actor=entry_data.get("actor", entry_data.get("Actor", "unknown")).strip(),
                location=entry_data.get("location", entry_data.get("Location", "unknown")).strip(),
                metadata={k: v for k, v in entry_data.items() 
                         if k not in ["sample_id", "SampleID", "timestamp", "Timestamp", "time", "action", "Action", "actor", "Actor", "location", "Location"]},
            )
            
            if sample_id not in custody_data:
                custody_data[sample_id] = []
            custody_data[sample_id].append(entry)
    
    for sample_id in custody_data:
        custody_data[sample_id].sort(key=lambda x: x.timestamp)
    
    return custody_data


def read_all_files(
    run_sequence_path: str,
    calibration_path: str,
    peak_table_path: str,
    chain_of_custody_path: str,
) -> BatchData:
    run_sequence = read_run_sequence(run_sequence_path)
    calibration_config = read_calibration_config(calibration_path)
    peak_table = read_peak_table(peak_table_path)
    chain_of_custody = read_chain_of_custody(chain_of_custody_path)
    
    for injection in run_sequence:
        if injection.sample_id in peak_table:
            sample_peaks = peak_table[injection.sample_id]
            for key, value in sample_peaks.items():
                if isinstance(value, float):
                    if "is_" in key.lower() or "internal_standard" in key.lower():
                        injection.internal_standard_area[key] = value
                    else:
                        injection.peak_data[key] = value
    
    return BatchData(
        run_sequence=run_sequence,
        calibration_curves={},
        chain_of_custody=chain_of_custody,
        peak_table=peak_table,
    )


def write_qc_issues_csv(issues: List[QCIssue], output_path: str):
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "issue_type", "severity", "sample_ids", "description", "details"
        ])
        
        for issue in issues:
            writer.writerow([
                issue.issue_type.value,
                issue.severity,
                "; ".join(issue.sample_ids),
                issue.description,
                json.dumps(issue.details, ensure_ascii=False, default=str),
            ])
