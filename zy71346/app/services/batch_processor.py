import random
import time
from typing import List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import (
    ComparisonTask, TaskStatus, DenoiseParams,
    AudioSegment, ProcessingResult, ListeningRecord
)
from ..schemas import (
    ProcessingResultCreate, BatchProcessRequest, BatchProcessResponse
)
from .anomaly_detector import AnomalyDetector


class BatchProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.anomaly_detector = AnomalyDetector(db)

    def _simulate_denoise_processing(
        self,
        params: DenoiseParams,
        audio: AudioSegment
    ) -> ProcessingResultCreate:
        params_json = params.params_json or {}
        noise_reduction = params_json.get("noise_reduction", 60)
        voice_protection = params_json.get("voice_protection", 70)
        aggressiveness = params_json.get("aggressiveness", 0.5)

        base_snr = 15 + random.uniform(-5, 5)
        snr_improvement = min(noise_reduction * 0.3, 25) + random.uniform(-3, 3)
        snr_after = base_snr + snr_improvement

        noise_reduction_rate = min(noise_reduction + random.uniform(-8, 5), 99)
        voice_preservation_rate = max(
            voice_protection * (1 - aggressiveness * 0.3) + random.uniform(-10, 5),
            20
        )

        duration = audio.duration or 30.0
        processing_time = duration * (0.8 + random.uniform(-0.3, 0.5))

        metrics = {
            "spectral_distortion": random.uniform(0.01, 0.1),
            "noise_leakage": random.uniform(0.05, 0.2),
            "artifacts_level": random.uniform(0, 0.3),
            "processing_latency_ms": random.randint(50, 200),
            "cpu_usage_percent": random.randint(30, 80)
        }

        return ProcessingResultCreate(
            audio_segment_id=audio.id,
            params_id=params.id,
            output_file_path=f"/output/{params.task_id}/{params.id}_{audio.id}_denoised.wav",
            snr_before=round(base_snr, 2),
            snr_after=round(snr_after, 2),
            snr_improvement=round(snr_improvement, 2),
            voice_preservation_rate=round(voice_preservation_rate, 1),
            noise_reduction_rate=round(noise_reduction_rate, 1),
            duration=round(duration, 2),
            processing_time=round(processing_time, 2),
            metrics=metrics
        )

    def process_batch(
        self,
        request: BatchProcessRequest
    ) -> BatchProcessResponse:
        task = self.db.query(ComparisonTask).filter(
            ComparisonTask.id == request.task_id
        ).first()

        if task is None:
            raise ValueError(f"Task {request.task_id} not found")

        task.status = TaskStatus.PROCESSING
        self.db.flush()

        active_params = [p for p in task.params if p.is_active]
        if request.params_ids:
            active_params = [p for p in active_params if p.id in request.params_ids]

        voice_segments = [
            a for a in task.audio_segments
            if a.audio_type in ("original", "voice_segment")
        ]
        if request.audio_segment_ids:
            voice_segments = [a for a in voice_segments if a.id in request.audio_segment_ids]

        total_combinations = len(active_params) * len(voice_segments)
        processed_count = 0
        anomalies_detected = []

        for params in active_params:
            for audio in voice_segments:
                existing = self.db.query(ProcessingResult).filter(
                    ProcessingResult.task_id == task.id,
                    ProcessingResult.params_id == params.id,
                    ProcessingResult.audio_segment_id == audio.id
                ).first()

                if existing:
                    processed_count += 1
                    continue

                result_data = self._simulate_denoise_processing(params, audio)
                result = ProcessingResult(
                    task_id=task.id,
                    **result_data.model_dump()
                )
                self.db.add(result)
                self.db.flush()

                over_denoise = self.anomaly_detector.detect_over_denoise(
                    task.id, result, params
                )
                if over_denoise:
                    anomalies_detected.append(over_denoise)

                silence_misjudge = self.anomaly_detector.detect_silence_misjudge(
                    task.id, result, params
                )
                if silence_misjudge:
                    anomalies_detected.append(silence_misjudge)

                listening = next(
                    (l for l in task.listening_records
                     if l.audio_segment_id == audio.id and l.params_id == params.id),
                    None
                )
                quality_issue = self.anomaly_detector.detect_audio_quality_issue(
                    task.id, result, listening
                )
                if quality_issue:
                    anomalies_detected.append(quality_issue)

                processed_count += 1
                time.sleep(0.01)

        if processed_count == total_combinations:
            task.status = TaskStatus.REVIEWING
        self.db.flush()

        return BatchProcessResponse(
            task_id=task.id,
            total_combinations=total_combinations,
            processed_count=processed_count,
            anomalies_detected=anomalies_detected
        )

    def add_listening_record(
        self,
        task_id: int,
        listener_name: str,
        audio_segment_id: int,
        params_id: int,
        naturalness: int,
        noise_reduction: int,
        overall: int,
        has_artifacts: bool = False,
        has_echo: bool = False,
        has_muffled: bool = False,
        comments: Optional[str] = None
    ) -> ListeningRecord:
        task = self.db.query(ComparisonTask).filter(
            ComparisonTask.id == task_id
        ).first()
        if task is None:
            raise ValueError(f"Task {task_id} not found")

        record = ListeningRecord(
            task_id=task_id,
            audio_segment_id=audio_segment_id,
            params_id=params_id,
            listener=listener_name,
            naturalness_score=naturalness,
            noise_reduction_score=noise_reduction,
            overall_score=overall,
            has_artifacts=has_artifacts,
            has_echo=has_echo,
            has_muffled=has_muffled,
            comments=comments
        )
        self.db.add(record)
        self.db.flush()

        result = self.db.query(ProcessingResult).filter(
            ProcessingResult.task_id == task_id,
            ProcessingResult.audio_segment_id == audio_segment_id,
            ProcessingResult.params_id == params_id
        ).first()

        if result:
            params = self.db.query(DenoiseParams).filter(
                DenoiseParams.id == params_id
            ).first()
            if params:
                self.anomaly_detector.detect_audio_quality_issue(
                    task_id, result, record
                )

        return record

    def get_segment_preview_url(
        self,
        task_id: int,
        audio_segment_id: int,
        params_id: Optional[int] = None
    ) -> Optional[str]:
        if params_id:
            result = self.db.query(ProcessingResult).filter(
                ProcessingResult.task_id == task_id,
                ProcessingResult.audio_segment_id == audio_segment_id,
                ProcessingResult.params_id == params_id
            ).first()
            if result and result.output_file_path:
                return result.output_file_path

        audio = self.db.query(AudioSegment).filter(
            AudioSegment.id == audio_segment_id,
            AudioSegment.task_id == task_id
        ).first()
        if audio:
            return audio.file_path

        return None
