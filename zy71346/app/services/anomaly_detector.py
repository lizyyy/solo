from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import (
    AnomalyRecord, AnomalyType, DenoiseParams,
    ProcessingResult, ListeningRecord, ComparisonTask
)
from ..schemas import AnomalyRecordCreate


OVER_DENOISE_THRESHOLD = 85
SILENCE_MISJUDGE_THRESHOLD = 0.5
VOICE_PRESERVATION_LOW_THRESHOLD = 60
NOISE_REDUCTION_HIGH_THRESHOLD = 95


class AnomalyDetector:
    def __init__(self, db: Session):
        self.db = db

    def detect_over_denoise(
        self,
        task_id: int,
        result: ProcessingResult,
        params: DenoiseParams
    ) -> Optional[AnomalyRecord]:
        if (result.noise_reduction_rate is not None and
                result.noise_reduction_rate >= NOISE_REDUCTION_HIGH_THRESHOLD and
                result.voice_preservation_rate is not None and
                result.voice_preservation_rate < VOICE_PRESERVATION_LOW_THRESHOLD):
            anomaly_data = AnomalyRecordCreate(
                anomaly_type=AnomalyType.OVER_DENOISE,
                severity="high",
                message=(f"检测到过度降噪：降噪率 {result.noise_reduction_rate:.1f}% 过高，"
                         f"同时人声保留率仅 {result.voice_preservation_rate:.1f}%，可能导致人声失真"),
                suggestion=("建议降低降噪强度：1) 降低噪声抑制阈值 10-15%；"
                           "2) 启用人声保护开关；3) 调整频谱平滑参数，保留高频细节"),
                params_id=params.id,
                audio_segment_id=result.audio_segment_id
            )
            return self._create_anomaly(task_id, anomaly_data)
        return None

    def detect_silence_misjudge(
        self,
        task_id: int,
        result: ProcessingResult,
        params: DenoiseParams
    ) -> Optional[AnomalyRecord]:
        if (result.duration is not None and
                result.processing_time is not None and
                result.processing_time < result.duration * SILENCE_MISJUDGE_THRESHOLD and
                result.snr_improvement is not None and
                result.snr_improvement > 20):
            anomaly_data = AnomalyRecordCreate(
                anomaly_type=AnomalyType.SILENCE_MISJUDGE,
                severity="medium",
                message=(f"疑似静音段误判：处理时长 {result.processing_time:.2f}s 显著短于音频时长 "
                         f"{result.duration:.2f}s，SNR提升 {result.snr_improvement:.1f}dB 异常偏高，"
                         f"可能将人声段误判为静音"),
                suggestion=("建议检查静音检测参数：1) 调高静音检测阈值；"
                           "2) 降低静音段衰减比例；3) 启用语音活动检测(VAD)辅助"),
                params_id=params.id,
                audio_segment_id=result.audio_segment_id
            )
            return self._create_anomaly(task_id, anomaly_data)
        return None

    def detect_param_override(
        self,
        task_id: int,
        new_params: DenoiseParams,
        existing_params: List[DenoiseParams]
    ) -> Optional[AnomalyRecord]:
        for existing in existing_params:
            if existing.id == new_params.id:
                continue
            if existing.name == new_params.name and existing.is_active:
                anomaly_data = AnomalyRecordCreate(
                    anomaly_type=AnomalyType.PARAM_OVERRIDE,
                    severity="warning",
                    message=(f"参数名称冲突：参数名称 '{new_params.name}' 已存在（ID: {existing.id}），"
                             f"旧版本 {existing.version} 已自动标记为非活动状态，新版本 {new_params.version} 已激活"),
                    suggestion=("建议：1) 如需保留旧参数请修改名称；2) 确认版本历史记录完整；"
                               "3) 在备注中说明参数变更原因"),
                    params_id=new_params.id
                )
                return self._create_anomaly(task_id, anomaly_data)
        return None

    def detect_audio_quality_issue(
        self,
        task_id: int,
        result: ProcessingResult,
        listening: Optional[ListeningRecord]
    ) -> Optional[AnomalyRecord]:
        if listening is None:
            return None
        issues = []
        if listening.has_artifacts:
            issues.append("有明显处理伪影")
        if listening.has_echo:
            issues.append("有回声残留")
        if listening.has_muffled:
            issues.append("声音发闷")
        if listening.naturalness_score is not None and listening.naturalness_score < 50:
            issues.append(f"人声自然度评分过低 ({listening.naturalness_score}/100)")

        if issues:
            anomaly_data = AnomalyRecordCreate(
                anomaly_type=AnomalyType.AUDIO_QUALITY,
                severity="medium",
                message=f"音频质量问题：{'; '.join(issues)}",
                suggestion=("建议：1) 检查降噪参数是否过于激进；2) 考虑使用自适应降噪模式；"
                           "3) 针对不同类型噪声调整参数组合"),
                params_id=result.params_id,
                audio_segment_id=result.audio_segment_id
            )
            return self._create_anomaly(task_id, anomaly_data)
        return None

    def check_all_anomalies(
        self,
        task: ComparisonTask
    ) -> List[AnomalyRecord]:
        detected = []
        for result in task.processing_results:
            params = next((p for p in task.params if p.id == result.params_id), None)
            if params is None:
                continue

            over_denoise = self.detect_over_denoise(task.id, result, params)
            if over_denoise:
                detected.append(over_denoise)

            silence_misjudge = self.detect_silence_misjudge(task.id, result, params)
            if silence_misjudge:
                detected.append(silence_misjudge)

            listening = next(
                (l for l in task.listening_records
                 if l.audio_segment_id == result.audio_segment_id and l.params_id == result.params_id),
                None
            )
            quality_issue = self.detect_audio_quality_issue(task.id, result, listening)
            if quality_issue:
                detected.append(quality_issue)

        return detected

    def _create_anomaly(
        self,
        task_id: int,
        anomaly_data: AnomalyRecordCreate
    ) -> AnomalyRecord:
        existing = self.db.query(AnomalyRecord).filter(
            AnomalyRecord.task_id == task_id,
            AnomalyRecord.anomaly_type == anomaly_data.anomaly_type,
            AnomalyRecord.params_id == anomaly_data.params_id,
            AnomalyRecord.audio_segment_id == anomaly_data.audio_segment_id,
            AnomalyRecord.resolved == False
        ).first()

        if existing:
            return existing

        anomaly = AnomalyRecord(
            task_id=task_id,
            **anomaly_data.model_dump()
        )
        self.db.add(anomaly)
        self.db.flush()
        return anomaly

    def resolve_anomaly(
        self,
        anomaly_id: int,
        resolved_by: Optional[str] = None,
        resolution_notes: Optional[str] = None
    ) -> Optional[AnomalyRecord]:
        anomaly = self.db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
        if anomaly is None:
            return None
        anomaly.resolved = True
        anomaly.resolved_by = resolved_by
        anomaly.resolved_at = datetime.utcnow()
        anomaly.resolution_notes = resolution_notes
        self.db.flush()
        return anomaly
