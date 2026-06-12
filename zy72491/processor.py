from typing import List, Tuple
from datetime import datetime
from copy import deepcopy
from models import (
    EvaluationRecord, SamplingPoint, RampRecord, RecordStatus,
    DataSource, ProcessLog, VersionHistory, ChangeType
)


class ScoringEngine:
    PERMEABILITY_THRESHOLD = 0.5
    FULL_SCORE = 100.0
    RAMP_DEDUCTION = 10.0

    def calculate_score(self, sampling_points: List[SamplingPoint], ramp: RampRecord = None) -> float:
        if not sampling_points:
            return 0.0
        
        avg_permeability = sum(p.permeability_rate for p in sampling_points) / len(sampling_points)
        score = avg_permeability * 100
        
        if ramp and not ramp.has_ramp:
            score -= self.RAMP_DEDUCTION
        
        return max(0.0, min(score, self.FULL_SCORE))

    def generate_suggestions(self, record: EvaluationRecord) -> List[str]:
        suggestions = []
        low_points = [p for p in record.sampling_points if p.permeability_rate < self.PERMEABILITY_THRESHOLD]
        
        if low_points:
            point_names = "、".join([p.name for p in low_points])
            suggestions.append(f"透水率偏低点位（{point_names}）需检查铺装层堵塞情况")
        
        if record.ramp:
            if not record.ramp.has_ramp:
                suggestions.append("该路段缺少无障碍坡道，需补充建设")
            elif record.ramp.is_incomplete:
                suggestions.append("无障碍坡道信息不完整，需现场补录")
        
        night_points_with_remarks = [
            p for p in record.sampling_points 
            if p.data_source == DataSource.NIGHT_SAMPLING and p.remarks
        ]
        for p in night_points_with_remarks:
            suggestions.append(f"【夜间采样备注】{p.name}：{p.remarks}")
        
        return suggestions


class RecordProcessor:
    def __init__(self):
        self.scoring_engine = ScoringEngine()
        self.process_logs: List[ProcessLog] = []

    def _log(self, record_id: str, action: str, details: str = "", operator: str = "系统"):
        log = ProcessLog(
            record_id=record_id,
            action=action,
            operator=operator,
            details=details
        )
        self.process_logs.append(log)

    def _save_version(self, record: EvaluationRecord, change_type: ChangeType, 
                      operator: str, change_reason: str, 
                      previous_ramp_remarks: str = None,
                      night_added: List[str] = None):
        version = VersionHistory(
            version=record.version,
            change_type=change_type,
            operator=operator,
            change_reason=change_reason,
            timestamp=datetime.now(),
            score=record.score,
            previous_score=record.previous_score,
            status=record.status,
            rectification_suggestions=deepcopy(record.rectification_suggestions),
            ramp_remarks=record.ramp.ramp_remarks if record.ramp else None,
            previous_ramp_remarks=previous_ramp_remarks,
            sampling_point_count=len(record.sampling_points),
            night_sampling_added=night_added or []
        )
        record.version_history.append(version)
        record.last_operator = operator
        record.last_change_reason = change_reason

    def initial_import(self, record: EvaluationRecord) -> EvaluationRecord:
        record.score = self.scoring_engine.calculate_score(
            record.sampling_points, record.ramp
        )
        record.rectification_suggestions = self.scoring_engine.generate_suggestions(record)
        
        if record.ramp and record.ramp.is_incomplete:
            record.status = RecordStatus.RAMP_PENDING
            reason = "坡道信息不完整，待现场补录"
        else:
            record.status = RecordStatus.SMOOTH
            reason = "数据完整，导入顺利"
        
        record.updated_at = datetime.now()
        record.last_operator = "系统"
        record.last_change_reason = reason
        
        self._save_version(
            record, 
            ChangeType.INITIAL, 
            "系统", 
            reason
        )
        
        sources = set(p.data_source.value for p in record.sampling_points)
        self._log(
            record.id,
            "首次导入",
            f"导入完成，得分{record.score:.1f}分，状态：{record.status.value}，数据源：{', '.join(sources)}"
        )
        return record

    def supplement_ramp(self, record: EvaluationRecord, new_ramp: RampRecord,
                        operator: str = "城更项目经理阿宁",
                        reason: str = "现场踏勘后补录坡道信息") -> EvaluationRecord:
        old_score = record.score
        old_ramp_remarks = record.ramp.ramp_remarks if record.ramp else None
        record.previous_score = old_score
        record.previous_suggestions = deepcopy(record.rectification_suggestions)
        record.ramp = new_ramp
        record.data_source_notes[DataSource.RAMP_SUPPLEMENT] = f"坡道补录：{new_ramp.location}"
        record.version += 1
        
        new_score = self.scoring_engine.calculate_score(
            record.sampling_points, record.ramp
        )
        record.score = new_score
        record.rectification_suggestions = self.scoring_engine.generate_suggestions(record)
        record.updated_at = datetime.now()
        
        if abs(new_score - old_score) < 0.01:
            record.status = RecordStatus.RAMP_NO_CHANGE
            change_reason = f"{reason}，补录后评分未变化（{old_score:.1f} → {new_score:.1f}），待交通协管复核"
            self._log(
                record.id,
                "坡道补录",
                f"补录坡道后评分未变化（{old_score:.1f} → {new_score:.1f}），待交通协管复核",
                operator=operator
            )
        else:
            diff = new_score - old_score
            record.status = RecordStatus.SMOOTH
            change_reason = f"{reason}，补录后评分变化（{old_score:.1f} → {new_score:.1f}，{diff:+.1f}）"
            self._log(
                record.id,
                "坡道补录",
                f"补录坡道后评分变化（{old_score:.1f} → {new_score:.1f}）",
                operator=operator
            )
        
        self._save_version(
            record,
            ChangeType.RAMP_SUPPLEMENT,
            operator,
            change_reason,
            previous_ramp_remarks=old_ramp_remarks
        )
        
        return record

    def supplement_night_sampling(self, record: EvaluationRecord, night_points: List[SamplingPoint],
                                  operator: str = "城更项目经理阿宁",
                                  reason: str = "夜间采样点数据回收") -> EvaluationRecord:
        old_score = record.score
        record.previous_score = old_score
        record.previous_suggestions = deepcopy(record.rectification_suggestions)
        
        night_point_names = []
        for point in night_points:
            record.sampling_points.append(point)
            night_point_names.append(point.name)
            if point.remarks:
                record.data_source_notes[DataSource.NIGHT_SAMPLING] = f"含夜间采样备注：{point.name}"
        
        record.review_night_supplemented = True
        record.version += 1
        
        record.score = self.scoring_engine.calculate_score(
            record.sampling_points, record.ramp
        )
        record.rectification_suggestions = self.scoring_engine.generate_suggestions(record)
        record.status = RecordStatus.NIGHT_SUPPLEMENT
        record.updated_at = datetime.now()
        
        change_reason = (
            f"{reason}，新增{len(night_points)}个夜间测点：{', '.join(night_point_names)}。"
            f"评分由{old_score:.1f}→{record.score:.1f}，整改建议已同步更新"
        )
        
        self._save_version(
            record,
            ChangeType.NIGHT_SUPPLEMENT,
            operator,
            change_reason,
            night_added=night_point_names
        )
        
        point_names = "、".join([p.name for p in night_points])
        self._log(
            record.id,
            "夜间采样补录",
            f"补录夜间采样点：{point_names}，整改建议已更新，评分{old_score:.1f}→{record.score:.1f}",
            operator=operator
        )
        return record

    def manual_correct(self, record: EvaluationRecord, new_score: float, new_suggestions: List[str],
                       operator: str = "城更项目经理阿宁",
                       reason: str = "现场情况特殊，人工调整") -> EvaluationRecord:
        old_score = record.score
        record.previous_score = old_score
        record.previous_suggestions = deepcopy(record.rectification_suggestions)
        record.score = new_score
        record.rectification_suggestions = new_suggestions
        record.has_manual_correction = True
        record.version += 1
        record.updated_at = datetime.now()
        
        change_reason = f"{reason}，评分{old_score:.1f}→{new_score:.1f}"
        
        self._save_version(
            record,
            ChangeType.MANUAL,
            operator,
            change_reason
        )
        
        self._log(
            record.id,
            "人工修正",
            f"人工修正：{old_score:.1f} → {new_score:.1f}分，原因：{reason}",
            operator=operator
        )
        return record

    def rerun_evaluation(self, record: EvaluationRecord,
                         operator: str = "系统",
                         reason: str = "数据复核重跑") -> EvaluationRecord:
        old_score = record.score
        record.previous_score = old_score
        record.previous_suggestions = deepcopy(record.rectification_suggestions)
        record.score = self.scoring_engine.calculate_score(
            record.sampling_points, record.ramp
        )
        record.rectification_suggestions = self.scoring_engine.generate_suggestions(record)
        record.is_rerun = True
        record.version += 1
        record.updated_at = datetime.now()
        
        change_reason = f"{reason}，评分{old_score:.1f}→{record.score:.1f}"
        
        self._save_version(
            record,
            ChangeType.RERUN,
            operator,
            change_reason
        )
        
        self._log(
            record.id,
            "重跑",
            f"重跑完成：{old_score:.1f} → {record.score:.1f}分",
            operator=operator
        )
        return record

    def confirm_ramp_review(self, record: EvaluationRecord,
                            operator: str = "交通协管",
                            reason: str = "现场复核确认坡道信息无误") -> EvaluationRecord:
        if record.status == RecordStatus.RAMP_NO_CHANGE:
            old_status = record.status.value
            record.status = RecordStatus.NORMAL
            record.version += 1
            record.updated_at = datetime.now()
            
            change_reason = f"{reason}，状态由「{old_status}」改为「正常」"
            
            self._save_version(
                record,
                ChangeType.REVIEW_CONFIRM,
                operator,
                change_reason
            )
            
            self._log(
                record.id,
                "复核通过",
                f"交通协管复核通过，坡道补录评分无变化确认为正常",
                operator=operator
            )
        record.updated_at = datetime.now()
        return record
