from models import BuildingSetbackRecord, RecordStatus, CorrectionSource, ProcessingResult
from typing import Optional


class ScoringEngine:
    SCORE_THRESHOLD_NORMAL = 85.0
    SCORE_THRESHOLD_WARNING = 60.0

    @classmethod
    def calculate_initial_score(cls, record: BuildingSetbackRecord) -> float:
        return record.initial_score

    @classmethod
    def recalculate_after_ramp(cls, record: BuildingSetbackRecord) -> float:
        base_score = record.initial_score
        if record.ramp_supplemented:
            score_adjustment = 0.0
            for corr in record.corrections:
                if corr["source"] == CorrectionSource.RAMP_SUPPLEMENT.value:
                    if "无障碍坡道" in corr["content"]:
                        score_adjustment += 0.0
            return base_score + score_adjustment
        return base_score

    @classmethod
    def recalculate_after_redline(cls, record: BuildingSetbackRecord) -> float:
        base_score = record.current_score
        if record.redline_note:
            if "旧口径" in record.redline_note:
                return base_score - 15.0
            if "历史遗留" in record.redline_note:
                return base_score - 10.0
        return base_score

    @classmethod
    def generate_suggestion(cls, record: BuildingSetbackRecord) -> str:
        score = record.current_score
        status = record.status

        if status == RecordStatus.OLD_STANDARD:
            return "该记录按旧口径核算，请查阅红线图备注，确认是否需要按新标准重新评估"
        if status == RecordStatus.NEEDS_REVIEW:
            return "坡道补录后评分未发生变化，请交通协管现场复核确认实际情况"
        if score >= cls.SCORE_THRESHOLD_NORMAL:
            return "退线空间合规，无整改要求"
        elif score >= cls.SCORE_THRESHOLD_WARNING:
            return "退线空间存在轻微占用，建议7个工作日内清理完毕"
        else:
            return "退线空间严重占用，请立即整改并提交整改报告"

    @classmethod
    def generate_display_message(cls, record: BuildingSetbackRecord) -> str:
        status = record.status
        if status == RecordStatus.OLD_STANDARD:
            return f"【旧口径】{record.building_name} - 注意：此条记录按历史红线图备注的旧口径处理"
        if status == RecordStatus.NEEDS_REVIEW:
            return f"【待复核】{record.building_name} - 坡道补录后评分没变，需要交通协管去现场看"
        if status == RecordStatus.NORMAL:
            if record.current_score >= cls.SCORE_THRESHOLD_NORMAL:
                return f"【正常】{record.building_name} - 退线空间合规，评分{record.current_score:.1f}分"
            else:
                return f"【待整改】{record.building_name} - 退线空间有问题，评分{record.current_score:.1f}分"
        return f"{record.building_name} - 状态: {status.value}, 评分: {record.current_score:.1f}分"


class RecordProcessor:
    def __init__(self):
        self.scoring = ScoringEngine()

    def step1_import_bus_data(self, record: BuildingSetbackRecord, operator: str) -> BuildingSetbackRecord:
        record.current_score = self.scoring.calculate_initial_score(record)
        record.add_history(
            action="导入公交刷卡数据",
            operator=operator,
            detail=f"导入时段: {record.bus_card_time}, 初始评分: {record.current_score:.1f}分"
        )
        if record.current_score < ScoringEngine.SCORE_THRESHOLD_NORMAL:
            record.status = RecordStatus.PENDING_CORRECTION
        record.suggestion = self.scoring.generate_suggestion(record)
        return record

    def step2_ramp_supplement(self, record: BuildingSetbackRecord, supplement_content: str, operator: str) -> BuildingSetbackRecord:
        record.ramp_supplemented = True
        record.add_correction(
            source=CorrectionSource.RAMP_SUPPLEMENT,
            content=supplement_content,
            operator=operator
        )
        old_score = record.current_score
        record.current_score = self.scoring.recalculate_after_ramp(record)
        
        if abs(record.current_score - old_score) < 0.01:
            record.status = RecordStatus.NEEDS_REVIEW
            record.add_history(
                action="坡道补录后评分未变",
                operator=operator,
                detail=f"补录前后评分均为 {old_score:.1f} 分，已转交通协管复核"
            )
        else:
            record.add_history(
                action="坡道补录完成",
                operator=operator,
                detail=f"评分从 {old_score:.1f} 分调整为 {record.current_score:.1f} 分"
            )
        
        record.suggestion = self.scoring.generate_suggestion(record)
        return record

    def step3_check_redline_note(self, record: BuildingSetbackRecord, redline_note: str, operator: str) -> BuildingSetbackRecord:
        record.redline_note = redline_note
        record.add_correction(
            source=CorrectionSource.REDLINE_NOTE,
            content=redline_note,
            operator=operator
        )
        old_score = record.current_score
        record.current_score = self.scoring.recalculate_after_redline(record)
        
        if "旧口径" in redline_note:
            record.status = RecordStatus.OLD_STANDARD
            record.add_history(
                action="红线图备注处理",
                operator=operator,
                detail=f"发现旧口径备注，评分从 {old_score:.1f} 分调整为 {record.current_score:.1f} 分，标记为旧口径"
            )
        else:
            record.add_history(
                action="红线图备注处理",
                operator=operator,
                detail=f"补充红线图备注，评分从 {old_score:.1f} 分调整为 {record.current_score:.1f} 分"
            )
        
        record.suggestion = self.scoring.generate_suggestion(record)
        return record

    def step4_manual_correction(self, record: BuildingSetbackRecord, new_score: float, reason: str, operator: str) -> BuildingSetbackRecord:
        old_score = record.current_score
        record.current_score = new_score
        record.add_correction(
            source=CorrectionSource.MANUAL,
            content=f"人工修正评分: {old_score:.1f} -> {new_score:.1f}, 原因: {reason}",
            operator=operator
        )
        record.add_history(
            action="人工修正",
            operator=operator,
            detail=f"评分从 {old_score:.1f} 分修正为 {new_score:.1f} 分，原因: {reason}"
        )
        if record.status == RecordStatus.NEEDS_REVIEW:
            record.status = RecordStatus.NORMAL
        record.suggestion = self.scoring.generate_suggestion(record)
        return record

    def rerun(self, record: BuildingSetbackRecord, operator: str) -> BuildingSetbackRecord:
        record.add_history(
            action="重新计算",
            operator=operator,
            detail=f"重跑前评分: {record.current_score:.1f}分, 状态: {record.status.value}"
        )
        record.current_score = self.scoring.calculate_initial_score(record)
        if record.ramp_supplemented:
            record.current_score = self.scoring.recalculate_after_ramp(record)
        if record.redline_note:
            record.current_score = self.scoring.recalculate_after_redline(record)

        has_manual_correction = any(c["source"] == "人工修正" for c in record.corrections)
        if record.redline_note and "旧口径" in record.redline_note:
            record.status = RecordStatus.OLD_STANDARD
        elif record.ramp_supplemented and not has_manual_correction:
            old_score = self.scoring.calculate_initial_score(record)
            new_score = self.scoring.recalculate_after_ramp(record)
            if abs(new_score - old_score) < 0.01:
                record.status = RecordStatus.NEEDS_REVIEW
            else:
                record.status = RecordStatus.NORMAL if record.current_score >= ScoringEngine.SCORE_THRESHOLD_NORMAL else RecordStatus.PENDING_CORRECTION
        else:
            record.status = RecordStatus.NORMAL if record.current_score >= ScoringEngine.SCORE_THRESHOLD_NORMAL else RecordStatus.PENDING_CORRECTION

        record.suggestion = self.scoring.generate_suggestion(record)
        record.add_history(
            action="重新计算完成",
            operator=operator,
            detail=f"重跑后评分: {record.current_score:.1f}分, 状态: {record.status.value}"
        )
        return record

    def get_result(self, record: BuildingSetbackRecord) -> ProcessingResult:
        return ProcessingResult(
            record_id=record.record_id,
            building_name=record.building_name,
            final_score=record.current_score,
            status=record.status,
            suggestion=record.suggestion,
            history_count=len(record.history),
            correction_count=len(record.corrections),
            display_message=ScoringEngine.generate_display_message(record)
        )
