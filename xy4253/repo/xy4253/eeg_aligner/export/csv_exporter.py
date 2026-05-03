import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from eeg_aligner.models import (
    ProjectData,
    StimulusEvent,
    SleepStageEpoch,
    CheckResult,
    IssueSeverity,
)

logger = logging.getLogger(__name__)


class CSVExporter:
    def export_events(self, events: List[StimulusEvent], output_path: Path, include_aligned: bool = True) -> Path:
        logger.info(f"Exporting {len(events)} events to CSV: {output_path}")
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        fieldnames = [
            "event_id",
            "event_code",
            "event_type",
            "timestamp",
            "eeg_timestamp",
            "aligned_timestamp",
            "duration_ms",
            "description",
            "is_artifact",
            "is_valid",
        ]
        
        if not include_aligned:
            fieldnames.remove("aligned_timestamp")
        
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for event in events:
                row = {
                    "event_id": event.event_id,
                    "event_code": event.event_code,
                    "event_type": event.event_type.value if hasattr(event.event_type, 'value') else str(event.event_type),
                    "timestamp": event.timestamp.isoformat() if event.timestamp else "",
                    "eeg_timestamp": event.eeg_timestamp.isoformat() if event.eeg_timestamp else "",
                    "duration_ms": event.duration_ms if event.duration_ms else "",
                    "description": event.description,
                    "is_artifact": "true" if event.is_artifact else "false",
                    "is_valid": "true" if event.is_valid else "false",
                }
                
                if include_aligned and event.aligned_timestamp:
                    row["aligned_timestamp"] = event.aligned_timestamp.isoformat()
                elif include_aligned:
                    row["aligned_timestamp"] = ""
                
                writer.writerow(row)
        
        logger.info(f"Events exported to {output_path}")
        return output_path

    def export_stages(self, stages: List[SleepStageEpoch], output_path: Path) -> Path:
        logger.info(f"Exporting {len(stages)} sleep stages to CSV: {output_path}")
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        fieldnames = [
            "epoch_number",
            "stage",
            "start_time",
            "end_time",
            "duration_seconds",
            "confidence",
            "is_manual",
            "notes",
        ]
        
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for stage in stages:
                row = {
                    "epoch_number": stage.epoch_number,
                    "stage": stage.stage.value if hasattr(stage.stage, 'value') else str(stage.stage),
                    "start_time": stage.start_time.isoformat() if stage.start_time else "",
                    "end_time": stage.end_time.isoformat() if stage.end_time else "",
                    "duration_seconds": stage.duration_seconds,
                    "confidence": stage.confidence,
                    "is_manual": "true" if stage.is_manual else "false",
                    "notes": stage.notes,
                }
                writer.writerow(row)
        
        logger.info(f"Sleep stages exported to {output_path}")
        return output_path

    def export_issues(self, check_result: CheckResult, output_path: Path) -> Path:
        logger.info(f"Exporting issues to CSV: {output_path}")
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        fieldnames = [
            "issue_id",
            "issue_type",
            "severity",
            "message",
            "related_event",
            "related_epoch",
            "timestamp",
            "suggestion",
        ]
        
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for issue in check_result.issues:
                row = {
                    "issue_id": issue.issue_id,
                    "issue_type": issue.issue_type.value if hasattr(issue.issue_type, 'value') else str(issue.issue_type),
                    "severity": issue.severity.value if hasattr(issue.severity, 'value') else str(issue.severity),
                    "message": issue.message,
                    "related_event": issue.related_event or "",
                    "related_epoch": issue.related_epoch or "",
                    "timestamp": issue.timestamp.isoformat() if issue.timestamp else "",
                    "suggestion": issue.suggestion,
                }
                writer.writerow(row)
        
        logger.info(f"Issues exported to {output_path}")
        return output_path

    def export_summary(self, project_data: ProjectData, output_path: Path) -> Path:
        logger.info(f"Exporting summary to CSV: {output_path}")
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        fieldnames = [
            "metric",
            "value",
            "notes",
        ]
        
        check = project_data.check_result
        
        rows = [
            {"metric": "项目ID", "value": project_data.project_id, "notes": ""},
            {"metric": "EEG通道数", "value": str(len(project_data.eeg_summaries)), "notes": ""},
            {"metric": "事件总数", "value": str(len(project_data.events)), "notes": ""},
            {"metric": "睡眠分期数", "value": str(len(project_data.sleep_stages)), "notes": ""},
            {"metric": "时钟校准数", "value": str(len(project_data.clock_calibrations)), "notes": ""},
        ]
        
        if check:
            rows.extend([
                {"metric": "有效事件数", "value": str(check.valid_events), "notes": ""},
                {"metric": "严重问题数", "value": str(check.critical_issue_count), "notes": "需要立即处理"},
                {"metric": "警告问题数", "value": str(check.warning_issue_count), "notes": "建议检查"},
                {"metric": "信息提示数", "value": str(check.info_issue_count), "notes": "仅供参考"},
                {"metric": "缺失事件码", "value": ", ".join(map(str, check.missing_codes)) if check.missing_codes else "无", "notes": ""},
                {"metric": "重复事件码", "value": ", ".join(map(str, check.duplicate_codes)) if check.duplicate_codes else "无", "notes": ""},
            ])
        
        if project_data.alignment_result:
            rows.extend([
                {"metric": "对齐方法", "value": project_data.alignment_result.alignment_method, "notes": ""},
                {"metric": "估计漂移", "value": f"{project_data.alignment_result.drift_estimate_ms:.2f} ms", "notes": ""},
                {"metric": "对齐置信度", "value": f"{project_data.alignment_result.drift_confidence:.0%}", "notes": ""},
            ])
        
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        
        logger.info(f"Summary exported to {output_path}")
        return output_path
