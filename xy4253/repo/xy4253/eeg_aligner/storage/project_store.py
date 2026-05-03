import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import logging
import uuid

from eeg_aligner.models import (
    ProjectData,
    EEGChannelSummary,
    StimulusEvent,
    SleepStageEpoch,
    ClockCalibration,
    AlignmentResult,
    CheckResult,
    EventType,
    SleepStage,
)

logger = logging.getLogger(__name__)


class ProjectStore:
    PROJECT_FILE = "project.json"
    EVENTS_FILE = "events.jsonl"
    STAGES_FILE = "sleep_stages.json"
    CALIBRATIONS_FILE = "calibrations.json"
    EEG_SUMMARIES_FILE = "eeg_summaries.json"
    ALIGNMENT_FILE = "alignment_result.json"
    CHECK_FILE = "check_result.json"
    METADATA_FILE = "metadata.json"

    def __init__(self, project_dir: Path):
        self.project_dir = Path(project_dir)
        self.project_dir.mkdir(parents=True, exist_ok=True)

    def save(self, data: ProjectData) -> None:
        logger.info(f"Saving project to {self.project_dir}")
        
        self._save_metadata(data)
        self._save_eeg_summaries(data.eeg_summaries)
        self._save_events(data.events)
        self._save_sleep_stages(data.sleep_stages)
        self._save_calibrations(data.clock_calibrations)
        
        if data.alignment_result:
            self._save_alignment_result(data.alignment_result)
        
        if data.check_result:
            self._save_check_result(data.check_result)
        
        self._save_project_file(data)

    def load(self) -> ProjectData:
        logger.info(f"Loading project from {self.project_dir}")
        
        project_file = self.project_dir / self.PROJECT_FILE
        if not project_file.exists():
            raise FileNotFoundError(f"Project file not found: {project_file}")
        
        with open(project_file, "r", encoding="utf-8") as f:
            project_data = json.load(f)
        
        project_id = project_data.get("project_id", str(uuid.uuid4()))
        created_at = self._parse_datetime(project_data.get("created_at")) or datetime.now()
        updated_at = self._parse_datetime(project_data.get("updated_at")) or datetime.now()
        
        eeg_summaries = self._load_eeg_summaries()
        events = self._load_events()
        sleep_stages = self._load_sleep_stages()
        calibrations = self._load_calibrations()
        alignment_result = self._load_alignment_result()
        check_result = self._load_check_result()
        metadata = self._load_metadata()
        
        return ProjectData(
            project_id=project_id,
            created_at=created_at,
            updated_at=updated_at,
            eeg_summaries=eeg_summaries,
            events=events,
            sleep_stages=sleep_stages,
            clock_calibrations=calibrations,
            alignment_result=alignment_result,
            check_result=check_result,
            metadata=metadata,
        )

    def _save_metadata(self, data: ProjectData) -> None:
        metadata = {
            "project_id": data.project_id,
            "created_at": data.created_at.isoformat() if data.created_at else None,
            "updated_at": data.updated_at.isoformat() if data.updated_at else None,
            "eeg_summaries_count": len(data.eeg_summaries),
            "events_count": len(data.events),
            "sleep_stages_count": len(data.sleep_stages),
            "calibrations_count": len(data.clock_calibrations),
            "has_alignment": data.alignment_result is not None,
            "has_check": data.check_result is not None,
        }
        
        if data.metadata:
            metadata["custom_metadata"] = data.metadata
        
        with open(self.project_dir / self.METADATA_FILE, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, default=str)

    def _load_metadata(self) -> Dict[str, Any]:
        metadata_file = self.project_dir / self.METADATA_FILE
        if not metadata_file.exists():
            return {}
        
        with open(metadata_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return data.get("custom_metadata", {})

    def _save_project_file(self, data: ProjectData) -> None:
        project_data = {
            "project_id": data.project_id,
            "created_at": data.created_at.isoformat() if data.created_at else None,
            "updated_at": data.updated_at.isoformat() if data.updated_at else None,
            "version": "0.1.0",
        }
        
        with open(self.project_dir / self.PROJECT_FILE, "w", encoding="utf-8") as f:
            json.dump(project_data, f, indent=2)

    def _save_eeg_summaries(self, summaries: list) -> None:
        if not summaries:
            return
        
        summaries_data = []
        for summary in summaries:
            summaries_data.append({
                "channel_name": summary.channel_name,
                "sampling_rate": summary.sampling_rate,
                "start_time": summary.start_time.isoformat(),
                "end_time": summary.end_time.isoformat(),
                "total_samples": summary.total_samples,
                "valid_samples": summary.valid_samples,
                "artifact_percentage": summary.artifact_percentage,
                "quality_metrics": summary.quality_metrics,
            })
        
        with open(self.project_dir / self.EEG_SUMMARIES_FILE, "w", encoding="utf-8") as f:
            json.dump(summaries_data, f, indent=2)

    def _load_eeg_summaries(self) -> list:
        file_path = self.project_dir / self.EEG_SUMMARIES_FILE
        if not file_path.exists():
            return []
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        summaries = []
        for item in data:
            summary = EEGChannelSummary(
                channel_name=item["channel_name"],
                sampling_rate=item["sampling_rate"],
                start_time=self._parse_datetime(item["start_time"]) or datetime.now(),
                end_time=self._parse_datetime(item["end_time"]) or datetime.now(),
                total_samples=item["total_samples"],
                valid_samples=item["valid_samples"],
                artifact_percentage=item["artifact_percentage"],
                quality_metrics=item.get("quality_metrics", {}),
            )
            summaries.append(summary)
        
        return summaries

    def _save_events(self, events: list) -> None:
        if not events:
            return
        
        with open(self.project_dir / self.EVENTS_FILE, "w", encoding="utf-8") as f:
            for event in events:
                event_data = {
                    "event_id": event.event_id,
                    "event_code": event.event_code,
                    "event_type": event.event_type.value if hasattr(event.event_type, 'value') else str(event.event_type),
                    "timestamp": event.timestamp.isoformat(),
                    "eeg_timestamp": event.eeg_timestamp.isoformat() if event.eeg_timestamp else None,
                    "aligned_timestamp": event.aligned_timestamp.isoformat() if event.aligned_timestamp else None,
                    "duration_ms": event.duration_ms,
                    "description": event.description,
                    "metadata": event.metadata,
                    "is_artifact": event.is_artifact,
                    "is_valid": event.is_valid,
                }
                f.write(json.dumps(event_data, default=str) + "\n")

    def _load_events(self) -> list:
        file_path = self.project_dir / self.EVENTS_FILE
        if not file_path.exists():
            return []
        
        events = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                data = json.loads(line)
                
                event_type = self._parse_event_type(data.get("event_type"))
                
                event = StimulusEvent(
                    event_id=data["event_id"],
                    event_code=data["event_code"],
                    event_type=event_type,
                    timestamp=self._parse_datetime(data["timestamp"]) or datetime.now(),
                    eeg_timestamp=self._parse_datetime(data.get("eeg_timestamp")),
                    aligned_timestamp=self._parse_datetime(data.get("aligned_timestamp")),
                    duration_ms=data.get("duration_ms"),
                    description=data.get("description", ""),
                    metadata=data.get("metadata", {}),
                    is_artifact=data.get("is_artifact", False),
                    is_valid=data.get("is_valid", True),
                )
                events.append(event)
        
        return events

    def _save_sleep_stages(self, stages: list) -> None:
        if not stages:
            return
        
        stages_data = []
        for stage in stages:
            stages_data.append({
                "epoch_number": stage.epoch_number,
                "stage": stage.stage.value if hasattr(stage.stage, 'value') else str(stage.stage),
                "start_time": stage.start_time.isoformat(),
                "end_time": stage.end_time.isoformat(),
                "duration_seconds": stage.duration_seconds,
                "confidence": stage.confidence,
                "is_manual": stage.is_manual,
                "notes": stage.notes,
            })
        
        with open(self.project_dir / self.STAGES_FILE, "w", encoding="utf-8") as f:
            json.dump(stages_data, f, indent=2)

    def _load_sleep_stages(self) -> list:
        file_path = self.project_dir / self.STAGES_FILE
        if not file_path.exists():
            return []
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        stages = []
        for item in data:
            stage = SleepStageEpoch(
                epoch_number=item["epoch_number"],
                stage=self._parse_sleep_stage(item["stage"]),
                start_time=self._parse_datetime(item["start_time"]) or datetime.now(),
                end_time=self._parse_datetime(item["end_time"]) or datetime.now(),
                duration_seconds=item.get("duration_seconds", 30.0),
                confidence=item.get("confidence", 1.0),
                is_manual=item.get("is_manual", True),
                notes=item.get("notes", ""),
            )
            stages.append(stage)
        
        return stages

    def _save_calibrations(self, calibrations: list) -> None:
        if not calibrations:
            return
        
        calib_data = []
        for calib in calibrations:
            calib_data.append({
                "calibration_id": calib.calibration_id,
                "calibration_time": calib.calibration_time.isoformat(),
                "eeg_clock_time": calib.eeg_clock_time.isoformat(),
                "stimulus_clock_time": calib.stimulus_clock_time.isoformat(),
                "drift_ms": calib.drift_ms,
                "sync_event_code": calib.sync_event_code,
                "notes": calib.notes,
            })
        
        with open(self.project_dir / self.CALIBRATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(calib_data, f, indent=2)

    def _load_calibrations(self) -> list:
        file_path = self.project_dir / self.CALIBRATIONS_FILE
        if not file_path.exists():
            return []
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        calibrations = []
        for item in data:
            calib = ClockCalibration(
                calibration_id=item["calibration_id"],
                calibration_time=self._parse_datetime(item["calibration_time"]) or datetime.now(),
                eeg_clock_time=self._parse_datetime(item["eeg_clock_time"]) or datetime.now(),
                stimulus_clock_time=self._parse_datetime(item["stimulus_clock_time"]) or datetime.now(),
                drift_ms=item["drift_ms"],
                sync_event_code=item.get("sync_event_code"),
                notes=item.get("notes", ""),
            )
            calibrations.append(calib)
        
        return calibrations

    def _save_alignment_result(self, result: AlignmentResult) -> None:
        data = {
            "drift_estimate_ms": result.drift_estimate_ms,
            "drift_confidence": result.drift_confidence,
            "alignment_method": result.alignment_method,
            "sync_points": result.sync_points,
            "aligned_events_count": result.aligned_events_count,
        }
        
        with open(self.project_dir / self.ALIGNMENT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def _load_alignment_result(self) -> Optional[AlignmentResult]:
        file_path = self.project_dir / self.ALIGNMENT_FILE
        if not file_path.exists():
            return None
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return AlignmentResult(
            drift_estimate_ms=data["drift_estimate_ms"],
            drift_confidence=data["drift_confidence"],
            alignment_method=data["alignment_method"],
            sync_points=data.get("sync_points", []),
            aligned_events_count=data.get("aligned_events_count", 0),
        )

    def _save_check_result(self, result: CheckResult) -> None:
        data = {
            "total_events": result.total_events,
            "valid_events": result.valid_events,
            "total_epochs": result.total_epochs,
            "missing_codes": result.missing_codes,
            "duplicate_codes": result.duplicate_codes,
            "stage_conflicts": result.stage_conflicts,
            "artifact_overlaps": result.artifact_overlaps,
            "critical_issue_count": result.critical_issue_count,
            "warning_issue_count": result.warning_issue_count,
            "info_issue_count": result.info_issue_count,
        }
        
        with open(self.project_dir / self.CHECK_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def _load_check_result(self) -> Optional[CheckResult]:
        file_path = self.project_dir / self.CHECK_FILE
        if not file_path.exists():
            return None
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return CheckResult(
            total_events=data["total_events"],
            valid_events=data["valid_events"],
            total_epochs=data["total_epochs"],
            missing_codes=data.get("missing_codes", []),
            duplicate_codes=data.get("duplicate_codes", []),
            stage_conflicts=data.get("stage_conflicts", []),
            artifact_overlaps=data.get("artifact_overlaps", []),
            critical_issue_count=data.get("critical_issue_count", 0),
            warning_issue_count=data.get("warning_issue_count", 0),
            info_issue_count=data.get("info_issue_count", 0),
        )

    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        
        if isinstance(value, datetime):
            return value
        
        value = str(value).strip()
        formats = [
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        try:
            from dateutil import parser
            return parser.parse(value)
        except ImportError:
            pass
        except ValueError:
            pass
        
        return None

    def _parse_event_type(self, value: Any) -> EventType:
        if isinstance(value, EventType):
            return value
        
        value = str(value).lower()
        type_map = {
            "stimulus": EventType.STIMULUS,
            "response": EventType.RESPONSE,
            "artifact": EventType.ARTIFACT,
            "system": EventType.SYSTEM,
            "sync": EventType.SYNC,
        }
        
        return type_map.get(value, EventType.STIMULUS)

    def _parse_sleep_stage(self, value: Any) -> SleepStage:
        if isinstance(value, SleepStage):
            return value
        
        value = str(value).upper()
        stage_map = {
            "W": SleepStage.WAKE,
            "WAKE": SleepStage.WAKE,
            "0": SleepStage.WAKE,
            "N1": SleepStage.N1,
            "1": SleepStage.N1,
            "S1": SleepStage.N1,
            "N2": SleepStage.N2,
            "2": SleepStage.N2,
            "S2": SleepStage.N2,
            "N3": SleepStage.N3,
            "3": SleepStage.N3,
            "S3": SleepStage.N3,
            "S4": SleepStage.N3,
            "4": SleepStage.N3,
            "REM": SleepStage.REM,
            "R": SleepStage.REM,
            "5": SleepStage.REM,
            "M": SleepStage.MOVEMENT,
            "MOVEMENT": SleepStage.MOVEMENT,
            "MVT": SleepStage.MOVEMENT,
            "?": SleepStage.UNKNOWN,
            "UNKNOWN": SleepStage.UNKNOWN,
            "X": SleepStage.UNKNOWN,
        }
        
        return stage_map.get(value, SleepStage.UNKNOWN)

    def get_project_info(self) -> Dict[str, Any]:
        metadata_file = self.project_dir / self.METADATA_FILE
        if not metadata_file.exists():
            return {"exists": False}
        
        with open(metadata_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        data["exists"] = True
        return data
