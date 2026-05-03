import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import random
import logging

from eeg_aligner.models import (
    EEGChannelSummary,
    StimulusEvent,
    SleepStageEpoch,
    ClockCalibration,
    SleepStage,
    EventType,
)

logger = logging.getLogger(__name__)


class SampleDataGenerator:
    def __init__(self, seed: Optional[int] = None):
        if seed is not None:
            random.seed(seed)
        
        self.channels = ["F3", "F4", "C3", "C4", "O1", "O2", "EOG-L", "EOG-R", "EMG"]
        self.event_codes = [1, 2, 3, 4, 5, 10, 11, 12]
        self.sync_code = 255
        
        self.drift_ms = random.uniform(-200, 200)
        self.drift_slope_ppm = random.uniform(-50, 50)

    def generate_eeg_summaries(
        self,
        start_time: datetime,
        duration_minutes: int = 30,
        sampling_rate: float = 250.0,
    ) -> List[EEGChannelSummary]:
        logger.info(f"Generating EEG summaries for {len(self.channels)} channels")
        
        end_time = start_time + timedelta(minutes=duration_minutes)
        total_samples = int(duration_minutes * 60 * sampling_rate)
        
        summaries = []
        
        for channel in self.channels:
            artifact_percentage = random.uniform(1.0, 15.0)
            valid_samples = int(total_samples * (1 - artifact_percentage / 100))
            
            summary = EEGChannelSummary(
                channel_name=channel,
                sampling_rate=sampling_rate,
                start_time=start_time,
                end_time=end_time,
                total_samples=total_samples,
                valid_samples=valid_samples,
                artifact_percentage=artifact_percentage,
                quality_metrics={
                    "rms_uv": random.uniform(5.0, 30.0),
                    "line_noise_db": random.uniform(-40.0, -20.0),
                },
            )
            summaries.append(summary)
        
        return summaries

    def generate_events(
        self,
        start_time: datetime,
        duration_minutes: int = 30,
        num_events: int = 50,
        include_artifacts: bool = True,
    ) -> List[StimulusEvent]:
        logger.info(f"Generating {num_events} events")
        
        events = []
        
        sync_event = StimulusEvent(
            event_id="evt_000000",
            event_code=self.sync_code,
            event_type=EventType.SYNC,
            timestamp=start_time,
            eeg_timestamp=start_time + timedelta(milliseconds=self.drift_ms),
            duration_ms=10.0,
            description="同步脉冲 (实验开始)",
            metadata={"sync_type": "start"},
            is_artifact=False,
            is_valid=True,
        )
        events.append(sync_event)
        
        end_time = start_time + timedelta(minutes=duration_minutes)
        total_seconds = (end_time - start_time).total_seconds()
        
        event_count = 0
        for i in range(num_events - 1):
            elapsed_seconds = random.uniform(5, total_seconds - 30)
            event_time = start_time + timedelta(seconds=elapsed_seconds)
            
            elapsed_for_drift = elapsed_seconds
            current_drift = self.drift_ms + (self.drift_slope_ppm * elapsed_for_drift / 1e6) * 1000
            eeg_time = event_time + timedelta(milliseconds=current_drift)
            
            event_code = random.choice(self.event_codes)
            
            is_artifact = False
            event_type = EventType.STIMULUS
            
            if include_artifacts and random.random() < 0.05:
                is_artifact = True
                event_type = EventType.ARTIFACT
            
            event_count += 1
            event = StimulusEvent(
                event_id=f"evt_{event_count:06d}",
                event_code=event_code,
                event_type=event_type,
                timestamp=event_time,
                eeg_timestamp=eeg_time,
                duration_ms=random.uniform(5.0, 100.0),
                description=f"刺激事件 {event_code}",
                metadata={
                    "trial": event_count,
                    "condition": random.choice(["A", "B", "C"]) if event_code in [1, 2, 3] else None,
                },
                is_artifact=is_artifact,
                is_valid=True,
            )
            events.append(event)
        
        end_sync_time = start_time + timedelta(minutes=duration_minutes - 1)
        end_drift = self.drift_ms + (self.drift_slope_ppm * (duration_minutes * 60 - 60) / 1e6) * 1000
        
        end_sync = StimulusEvent(
            event_id=f"evt_{event_count + 1:06d}",
            event_code=self.sync_code,
            event_type=EventType.SYNC,
            timestamp=end_sync_time,
            eeg_timestamp=end_sync_time + timedelta(milliseconds=end_drift),
            duration_ms=10.0,
            description="同步脉冲 (实验结束)",
            metadata={"sync_type": "end"},
            is_artifact=False,
            is_valid=True,
        )
        events.append(end_sync)
        
        events.sort(key=lambda e: e.timestamp)
        
        return events

    def generate_sleep_stages(
        self,
        start_time: datetime,
        epoch_duration_seconds: float = 30.0,
        num_epochs: int = 60,
    ) -> List[SleepStageEpoch]:
        logger.info(f"Generating {num_epochs} sleep stages")
        
        stages = []
        
        stage_sequence = self._generate_sleep_stage_sequence(num_epochs)
        
        for i in range(num_epochs):
            epoch_start = start_time + timedelta(seconds=i * epoch_duration_seconds)
            epoch_end = epoch_start + timedelta(seconds=epoch_duration_seconds)
            
            stage = SleepStageEpoch(
                epoch_number=i + 1,
                stage=stage_sequence[i],
                start_time=epoch_start,
                end_time=epoch_end,
                duration_seconds=epoch_duration_seconds,
                confidence=random.uniform(0.7, 1.0),
                is_manual=True,
                notes="",
            )
            stages.append(stage)
        
        return stages

    def _generate_sleep_stage_sequence(self, num_epochs: int) -> List[SleepStage]:
        stages = []
        
        current_stage = SleepStage.WAKE
        stage_counter = 0
        min_stay = {
            SleepStage.WAKE: 5,
            SleepStage.N1: 2,
            SleepStage.N2: 5,
            SleepStage.N3: 3,
            SleepStage.REM: 4,
            SleepStage.MOVEMENT: 1,
            SleepStage.UNKNOWN: 1,
        }
        
        for i in range(num_epochs):
            if stage_counter >= min_stay[current_stage]:
                if random.random() < 0.3:
                    if current_stage == SleepStage.WAKE:
                        current_stage = random.choice([SleepStage.N1, SleepStage.N1, SleepStage.N2])
                    elif current_stage == SleepStage.N1:
                        current_stage = random.choice([SleepStage.N2, SleepStage.WAKE, SleepStage.N2])
                    elif current_stage == SleepStage.N2:
                        current_stage = random.choice([SleepStage.N3, SleepStage.REM, SleepStage.WAKE, SleepStage.N2, SleepStage.N2])
                    elif current_stage == SleepStage.N3:
                        current_stage = random.choice([SleepStage.N2, SleepStage.WAKE, SleepStage.N2])
                    elif current_stage == SleepStage.REM:
                        current_stage = random.choice([SleepStage.WAKE, SleepStage.N1, SleepStage.N2])
                    
                    if random.random() < 0.05:
                        current_stage = random.choice([SleepStage.MOVEMENT, SleepStage.UNKNOWN])
                    
                    stage_counter = 0
            
            stages.append(current_stage)
            stage_counter += 1
        
        return stages

    def generate_clock_calibrations(
        self,
        start_time: datetime,
        num_calibrations: int = 3,
    ) -> List[ClockCalibration]:
        logger.info(f"Generating {num_calibrations} clock calibrations")
        
        calibrations = []
        
        for i in range(num_calibrations):
            calib_time = start_time + timedelta(minutes=i * 10)
            
            elapsed_seconds = i * 10 * 60
            current_drift = self.drift_ms + (self.drift_slope_ppm * elapsed_seconds / 1e6) * 1000
            current_drift += random.uniform(-5, 5)
            
            eeg_time = calib_time + timedelta(milliseconds=current_drift)
            
            calib = ClockCalibration(
                calibration_id=f"cal_{i+1:03d}",
                calibration_time=calib_time,
                eeg_clock_time=eeg_time,
                stimulus_clock_time=calib_time,
                drift_ms=current_drift,
                sync_event_code=self.sync_code,
                notes=f"校准点 {i+1}",
            )
            calibrations.append(calib)
        
        return calibrations

    def save_sample_data(
        self,
        output_dir: Path,
        start_time: Optional[datetime] = None,
    ) -> Dict[str, Path]:
        logger.info(f"Saving sample data to {output_dir}")
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if start_time is None:
            start_time = datetime.now().replace(hour=22, minute=0, second=0, microsecond=0)
        
        eeg_summaries = self.generate_eeg_summaries(start_time)
        events = self.generate_events(start_time)
        sleep_stages = self.generate_sleep_stages(start_time)
        calibrations = self.generate_clock_calibrations(start_time)
        
        files = {}
        
        eeg_csv = output_dir / "eeg_summary.csv"
        with open(eeg_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "channel_name", "sampling_rate", "start_time", "end_time",
                "total_samples", "valid_samples", "artifact_percentage",
                "rms_uv", "line_noise_db"
            ])
            writer.writeheader()
            for summary in eeg_summaries:
                row = {
                    "channel_name": summary.channel_name,
                    "sampling_rate": summary.sampling_rate,
                    "start_time": summary.start_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    "end_time": summary.end_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    "total_samples": summary.total_samples,
                    "valid_samples": summary.valid_samples,
                    "artifact_percentage": f"{summary.artifact_percentage:.2f}",
                    "rms_uv": f"{summary.quality_metrics.get('rms_uv', 0):.2f}",
                    "line_noise_db": f"{summary.quality_metrics.get('line_noise_db', 0):.2f}",
                }
                writer.writerow(row)
        files["eeg_csv"] = eeg_csv
        
        events_jsonl = output_dir / "events.jsonl"
        with open(events_jsonl, "w", encoding="utf-8") as f:
            for event in events:
                event_data = {
                    "event_id": event.event_id,
                    "event_code": event.event_code,
                    "event_type": event.event_type.value,
                    "timestamp": event.timestamp.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    "eeg_timestamp": event.eeg_timestamp.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] if event.eeg_timestamp else None,
                    "duration_ms": event.duration_ms,
                    "description": event.description,
                    "metadata": event.metadata,
                    "is_artifact": event.is_artifact,
                    "is_valid": event.is_valid,
                }
                f.write(json.dumps(event_data, ensure_ascii=False) + "\n")
        files["events_jsonl"] = events_jsonl
        
        stages_csv = output_dir / "sleep_stages.csv"
        with open(stages_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "epoch_number", "stage", "start_time", "end_time",
                "duration_seconds", "confidence", "is_manual", "notes"
            ])
            writer.writeheader()
            for stage in sleep_stages:
                row = {
                    "epoch_number": stage.epoch_number,
                    "stage": stage.stage.value,
                    "start_time": stage.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "end_time": stage.end_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "duration_seconds": stage.duration_seconds,
                    "confidence": f"{stage.confidence:.2f}",
                    "is_manual": "true" if stage.is_manual else "false",
                    "notes": stage.notes,
                }
                writer.writerow(row)
        files["stages_csv"] = stages_csv
        
        calibrations_csv = output_dir / "clock_calibration.csv"
        with open(calibrations_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "calibration_id", "calibration_time", "eeg_clock_time",
                "stimulus_clock_time", "drift_ms", "sync_event_code", "notes"
            ])
            writer.writeheader()
            for calib in calibrations:
                row = {
                    "calibration_id": calib.calibration_id,
                    "calibration_time": calib.calibration_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    "eeg_clock_time": calib.eeg_clock_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    "stimulus_clock_time": calib.stimulus_clock_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    "drift_ms": f"{calib.drift_ms:.2f}",
                    "sync_event_code": calib.sync_event_code if calib.sync_event_code else "",
                    "notes": calib.notes,
                }
                writer.writerow(row)
        files["calibrations_csv"] = calibrations_csv
        
        readme = output_dir / "README.txt"
        with open(readme, "w", encoding="utf-8") as f:
            f.write(f"""示例数据说明
============

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

文件列表:
- eeg_summary.csv       - EEG通道摘要数据
- events.jsonl          - 刺激事件数据 (含时钟漂移)
- sleep_stages.csv      - 睡眠分期数据
- clock_calibration.csv - 时钟校准记录

模拟参数:
- 初始漂移: {self.drift_ms:.2f} ms
- 漂移斜率: {self.drift_slope_ppm:.2f} ppm
- 事件码: {', '.join(map(str, self.event_codes))}
- 同步码: {self.sync_code}

使用方法:
1. eeg-aligner import --eeg eeg_summary.csv --events events.jsonl \\
   --stages sleep_stages.csv --calibration clock_calibration.csv
2. eeg-aligner align
3. eeg-aligner check
4. eeg-aligner report --output ./reports

注意: 此为模拟数据，仅用于演示工具功能。
""")
        files["readme"] = readme
        
        logger.info(f"Sample data saved to {output_dir}")
        return files
