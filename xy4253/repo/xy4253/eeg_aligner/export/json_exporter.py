import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from eeg_aligner.models import (
    ProjectData,
    StimulusEvent,
    SleepStageEpoch,
    EEGChannelSummary,
    ClockCalibration,
    AlignmentResult,
    CheckResult,
)

logger = logging.getLogger(__name__)


class JSONExporter:
    def export_project(self, project_data: ProjectData, output_path: Path) -> Path:
        logger.info(f"Exporting full project to JSON: {output_path}")
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "project_id": project_data.project_id,
            "created_at": project_data.created_at.isoformat() if project_data.created_at else None,
            "updated_at": project_data.updated_at.isoformat() if project_data.updated_at else None,
            "exported_at": datetime.now().isoformat(),
            "eeg_summaries": self._summaries_to_dict(project_data.eeg_summaries),
            "events": self._events_to_dict(project_data.events),
            "sleep_stages": self._stages_to_dict(project_data.sleep_stages),
            "clock_calibrations": self._calibrations_to_dict(project_data.clock_calibrations),
            "metadata": project_data.metadata,
        }
        
        if project_data.alignment_result:
            data["alignment_result"] = self._alignment_to_dict(project_data.alignment_result)
        
        if project_data.check_result:
            data["check_result"] = self._check_to_dict(project_data.check_result)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        
        logger.info(f"Project exported to {output_path}")
        return output_path

    def export_events(self, events: List[StimulusEvent], output_path: Path) -> Path:
        logger.info(f"Exporting {len(events)} events to JSONL: {output_path}")
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            for event in events:
                event_dict = self._event_to_dict(event)
                f.write(json.dumps(event_dict, default=str) + "\n")
        
        logger.info(f"Events exported to {output_path}")
        return output_path

    def _summaries_to_dict(self, summaries: List[EEGChannelSummary]) -> List[Dict]:
        result = []
        for summary in summaries:
            result.append({
                "channel_name": summary.channel_name,
                "sampling_rate": summary.sampling_rate,
                "start_time": summary.start_time.isoformat() if summary.start_time else None,
                "end_time": summary.end_time.isoformat() if summary.end_time else None,
                "total_samples": summary.total_samples,
                "valid_samples": summary.valid_samples,
                "artifact_percentage": summary.artifact_percentage,
                "quality_metrics": summary.quality_metrics,
            })
        return result

    def _events_to_dict(self, events: List[StimulusEvent]) -> List[Dict]:
        return [self._event_to_dict(e) for e in events]

    def _event_to_dict(self, event: StimulusEvent) -> Dict:
        return {
            "event_id": event.event_id,
            "event_code": event.event_code,
            "event_type": event.event_type.value if hasattr(event.event_type, 'value') else str(event.event_type),
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
            "eeg_timestamp": event.eeg_timestamp.isoformat() if event.eeg_timestamp else None,
            "aligned_timestamp": event.aligned_timestamp.isoformat() if event.aligned_timestamp else None,
            "duration_ms": event.duration_ms,
            "description": event.description,
            "metadata": event.metadata,
            "is_artifact": event.is_artifact,
            "is_valid": event.is_valid,
        }

    def _stages_to_dict(self, stages: List[SleepStageEpoch]) -> List[Dict]:
        result = []
        for stage in stages:
            result.append({
                "epoch_number": stage.epoch_number,
                "stage": stage.stage.value if hasattr(stage.stage, 'value') else str(stage.stage),
                "start_time": stage.start_time.isoformat() if stage.start_time else None,
                "end_time": stage.end_time.isoformat() if stage.end_time else None,
                "duration_seconds": stage.duration_seconds,
                "confidence": stage.confidence,
                "is_manual": stage.is_manual,
                "notes": stage.notes,
            })
        return result

    def _calibrations_to_dict(self, calibrations: List[ClockCalibration]) -> List[Dict]:
        result = []
        for calib in calibrations:
            result.append({
                "calibration_id": calib.calibration_id,
                "calibration_time": calib.calibration_time.isoformat() if calib.calibration_time else None,
                "eeg_clock_time": calib.eeg_clock_time.isoformat() if calib.eeg_clock_time else None,
                "stimulus_clock_time": calib.stimulus_clock_time.isoformat() if calib.stimulus_clock_time else None,
                "drift_ms": calib.drift_ms,
                "sync_event_code": calib.sync_event_code,
                "notes": calib.notes,
            })
        return result

    def _alignment_to_dict(self, alignment: AlignmentResult) -> Dict:
        return {
            "drift_estimate_ms": alignment.drift_estimate_ms,
            "drift_confidence": alignment.drift_confidence,
            "alignment_method": alignment.alignment_method,
            "sync_points": alignment.sync_points,
            "aligned_events_count": alignment.aligned_events_count,
        }

    def _check_to_dict(self, check: CheckResult) -> Dict:
        issues = []
        for issue in check.issues:
            issues.append({
                "issue_id": issue.issue_id,
                "issue_type": issue.issue_type.value if hasattr(issue.issue_type, 'value') else str(issue.issue_type),
                "severity": issue.severity.value if hasattr(issue.severity, 'value') else str(issue.severity),
                "message": issue.message,
                "related_event": issue.related_event,
                "related_epoch": issue.related_epoch,
                "timestamp": issue.timestamp.isoformat() if issue.timestamp else None,
                "details": issue.details,
                "suggestion": issue.suggestion,
            })
        
        return {
            "total_events": check.total_events,
            "valid_events": check.valid_events,
            "total_epochs": check.total_epochs,
            "issues": issues,
            "missing_codes": check.missing_codes,
            "duplicate_codes": check.duplicate_codes,
            "stage_conflicts": check.stage_conflicts,
            "artifact_overlaps": check.artifact_overlaps,
            "critical_issue_count": check.critical_issue_count,
            "warning_issue_count": check.warning_issue_count,
            "info_issue_count": check.info_issue_count,
        }
