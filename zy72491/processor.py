from typing import List, Tuple
from datetime import datetime
from models import (
    EvaluationRecord, SamplingPoint, RampRecord, RecordStatus,
    DataSource, ProcessLog
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
        
        if record.ramp and not record.ramp.has_ramp:
            suggestions.append("该路段缺少无障碍坡道，需补充建设")
        
        night_points = [p for p in record.sampling_points if p.data_source == DataSource.NIGHT_SAMPLING]
        if night_points and not record.review_night_supplemented:
            for p in night_points:
                if p.remarks:
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

    def initial_import(self, record: EvaluationRecord) -> EvaluationRecord:
        record.score = self.scoring_engine.calculate_score(
            record.sampling_points, record.ramp
        )
        record.rectification_suggestions = self.scoring_engine.generate_suggestions(record)
        record.status = RecordStatus.SMOOTH
        record.updated_at = datetime.now()
        
        sources = set(p.data_source.value for p in record.sampling_points)
        self._log(
            record.id,
            "首次导入",
            f"导入完成，得分{record.score:.1f}分，数据源：{', '.join(sources)}"
        )
        return record

    def supplement_ramp(self, record: EvaluationRecord, new_ramp: RampRecord) -> EvaluationRecord:
        old_score = record.score
        record.previous_score = old_score
        record.previous_suggestions = record.rectification_suggestions.copy()
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
            self._log(
                record.id,
                "坡道补录",
                f"补录坡道后评分未变化（{old_score:.1f} → {new_score:.1f}），待交通协管复核",
                operator="城更项目经理阿宁"
            )
        else:
            record.status = RecordStatus.SMOOTH
            self._log(
                record.id,
                "坡道补录",
                f"补录坡道后评分变化（{old_score:.1f} → {new_score:.1f}）",
                operator="城更项目经理阿宁"
            )
        
        return record

    def supplement_night_sampling(self, record: EvaluationRecord, night_points: List[SamplingPoint]) -> EvaluationRecord:
        record.previous_score = record.score
        record.previous_suggestions = record.rectification_suggestions.copy()
        
        for point in night_points:
            record.sampling_points.append(point)
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
        
        point_names = "、".join([p.name for p in night_points])
        self._log(
            record.id,
            "夜间采样补录",
            f"补录夜间采样点：{point_names}，整改建议已更新",
            operator="城更项目经理阿宁"
        )
        return record

    def manual_correct(self, record: EvaluationRecord, new_score: float, new_suggestions: List[str]) -> EvaluationRecord:
        record.previous_score = record.score
        record.previous_suggestions = record.rectification_suggestions.copy()
        record.score = new_score
        record.rectification_suggestions = new_suggestions
        record.has_manual_correction = True
        record.version += 1
        record.updated_at = datetime.now()
        
        self._log(
            record.id,
            "人工修正",
            f"人工修正：{record.previous_score:.1f} → {new_score:.1f}分",
            operator="城更项目经理阿宁"
        )
        return record

    def rerun_evaluation(self, record: EvaluationRecord) -> EvaluationRecord:
        record.previous_score = record.score
        record.previous_suggestions = record.rectification_suggestions.copy()
        record.score = self.scoring_engine.calculate_score(
            record.sampling_points, record.ramp
        )
        record.rectification_suggestions = self.scoring_engine.generate_suggestions(record)
        record.is_rerun = True
        record.version += 1
        record.updated_at = datetime.now()
        
        self._log(
            record.id,
            "重跑",
            f"重跑完成：{record.previous_score:.1f} → {record.score:.1f}分"
        )
        return record

    def confirm_ramp_review(self, record: EvaluationRecord) -> EvaluationRecord:
        if record.status == RecordStatus.RAMP_NO_CHANGE:
            record.status = RecordStatus.NORMAL
            self._log(
                record.id,
                "复核通过",
                "交通协管复核通过，坡道补录评分无变化确认为正常",
                operator="交通协管"
            )
        record.updated_at = datetime.now()
        return record
