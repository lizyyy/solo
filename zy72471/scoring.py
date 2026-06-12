from models import (
    BuildingSetbackRecord, RecordStatus, CorrectionSource, ProcessingResult
)
from errors import InputValidator, UserFriendlyError, ErrorMessages
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
            for corr in record.correction_details:
                if corr.source == CorrectionSource.RAMP_SUPPLEMENT.value:
                    if "无障碍坡道" in corr.content:
                        score_adjustment += 0.0
            return base_score + score_adjustment
        return base_score

    @classmethod
    def recalculate_after_redline(cls, record: BuildingSetbackRecord) -> float:
        base_score = record.initial_score
        if record.ramp_supplemented:
            base_score = cls.recalculate_after_ramp(record)
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
        if status == RecordStatus.PENDING_CORRECTION:
            return f"【待整改】{record.building_name} - 退线空间有问题，评分{record.current_score:.1f}分"
        return f"{record.building_name} - 状态: {status.value}, 评分: {record.current_score:.1f}分"


class RecordProcessor:
    def __init__(self):
        self.scoring = ScoringEngine()

    def step1_import_bus_data(self, record: BuildingSetbackRecord, operator: str) -> BuildingSetbackRecord:
        InputValidator.validate_bus_card_time(record.bus_card_time)
        InputValidator.validate_operator(operator)

        record.take_snapshot("导入公交刷卡数据", operator, before=True,
                             detail=f"导入时段: {record.bus_card_time}")

        record.current_score = self.scoring.calculate_initial_score(record)
        if record.current_score < ScoringEngine.SCORE_THRESHOLD_NORMAL:
            record.status = RecordStatus.PENDING_CORRECTION
        else:
            record.status = RecordStatus.NORMAL
        record.suggestion = self.scoring.generate_suggestion(record)

        record.add_history(
            action="导入公交刷卡数据",
            operator=operator,
            detail=f"导入时段: {record.bus_card_time}, 初始评分: {record.current_score:.1f}分, 状态: {record.status.value}"
        )
        record.take_snapshot("导入公交刷卡数据", operator, before=False)
        return record

    def step2_ramp_supplement(self, record: BuildingSetbackRecord, supplement_content: str, operator: str) -> BuildingSetbackRecord:
        InputValidator.validate_operator(operator)
        if not supplement_content or not supplement_content.strip():
            raise ErrorMessages.empty_supplement_content()
        if record.ramp_supplemented:
            raise ErrorMessages.ramp_already_supplemented()

        old_score = record.current_score
        old_status = record.status.value

        record.take_snapshot("坡道补录", operator, before=True,
                             detail=f"补录内容: {supplement_content}")

        record.ramp_supplemented = True
        record.add_correction(
            source=CorrectionSource.RAMP_SUPPLEMENT,
            content=supplement_content,
            operator=operator,
            before_score=old_score,
            before_status=old_status,
        )
        record.current_score = self.scoring.recalculate_after_ramp(record)

        if abs(record.current_score - old_score) < 0.01:
            record.status = RecordStatus.NEEDS_REVIEW
            record.add_history(
                action="坡道补录后评分未变",
                operator=operator,
                detail=f"补录前后评分均为 {old_score:.1f} 分，已转交通协管复核，不自动归为正常"
            )
        else:
            if record.current_score >= ScoringEngine.SCORE_THRESHOLD_NORMAL:
                record.status = RecordStatus.NORMAL
            else:
                record.status = RecordStatus.PENDING_CORRECTION
            record.add_history(
                action="坡道补录完成",
                operator=operator,
                detail=f"评分从 {old_score:.1f} 分调整为 {record.current_score:.1f} 分"
            )

        record.suggestion = self.scoring.generate_suggestion(record)

        for c in record.correction_details:
            if c.source == CorrectionSource.RAMP_SUPPLEMENT.value and c.after_score is None:
                c.after_score = record.current_score
                c.after_status = record.status.value
                c.content = supplement_content

        record.take_snapshot("坡道补录", operator, before=False)
        return record

    def step3_check_redline_note(self, record: BuildingSetbackRecord, redline_note: str, operator: str,
                                  change_reason: str = "初次补充红线图备注") -> BuildingSetbackRecord:
        InputValidator.validate_operator(operator)
        if not redline_note or not redline_note.strip():
            raise ErrorMessages.empty_redline_note()

        old_score = record.current_score
        old_status = record.status.value
        old_redline = record.redline_note

        is_update = old_redline is not None
        action_name = "更新红线图备注" if is_update else "补充红线图备注"

        record.take_snapshot(action_name, operator, before=True,
                             change_reason=change_reason,
                             detail=f"改前备注: {old_redline if old_redline else '无'}")

        record.add_redline_note_change(old_redline, redline_note, change_reason, operator)
        record.redline_note = redline_note

        record.add_correction(
            source=CorrectionSource.REDLINE_NOTE,
            content=redline_note,
            operator=operator,
            before_score=old_score,
            before_status=old_status,
            before_redline=old_redline,
            after_redline=redline_note,
            change_reason=change_reason,
        )
        record.current_score = self.scoring.recalculate_after_redline(record)

        if "旧口径" in redline_note:
            record.status = RecordStatus.OLD_STANDARD
            record.add_history(
                action="红线图备注处理",
                operator=operator,
                detail=f"发现旧口径备注，评分从 {old_score:.1f} 分调整为 {record.current_score:.1f} 分，标记为旧口径。原因: {change_reason}"
            )
        else:
            if record.current_score >= ScoringEngine.SCORE_THRESHOLD_NORMAL:
                record.status = RecordStatus.NORMAL
            else:
                record.status = RecordStatus.PENDING_CORRECTION
            record.add_history(
                action="红线图备注处理",
                operator=operator,
                detail=f"补充红线图备注，评分从 {old_score:.1f} 分调整为 {record.current_score:.1f} 分。原因: {change_reason}"
            )

        record.suggestion = self.scoring.generate_suggestion(record)

        for c in record.correction_details:
            if c.source == CorrectionSource.REDLINE_NOTE.value and c.after_score is None:
                c.after_score = record.current_score
                c.after_status = record.status.value

        record.take_snapshot(action_name, operator, before=False, change_reason=change_reason)
        return record

    def step4_manual_correction(self, record: BuildingSetbackRecord, new_score: float, reason: str, operator: str,
                                 new_status: Optional[RecordStatus] = None) -> BuildingSetbackRecord:
        InputValidator.validate_operator(operator)
        InputValidator.validate_score(new_score)
        if not reason or not reason.strip():
            raise UserFriendlyError(
                message="人工修正必须填写原因",
                suggestion="请说明为什么要改这个评分，比如交通协管现场复核后的结论"
            )

        old_score = record.current_score
        old_status = record.status.value

        record.take_snapshot("人工修正", operator, before=True,
                             change_reason=reason,
                             detail=f"计划将评分从 {old_score:.1f} 改为 {new_score:.1f}")

        record.current_score = new_score
        if new_status:
            record.status = new_status
        else:
            if record.status == RecordStatus.NEEDS_REVIEW:
                record.status = RecordStatus.NORMAL if new_score >= ScoringEngine.SCORE_THRESHOLD_NORMAL else RecordStatus.PENDING_CORRECTION
            elif new_score >= ScoringEngine.SCORE_THRESHOLD_NORMAL:
                record.status = RecordStatus.NORMAL
            else:
                record.status = RecordStatus.PENDING_CORRECTION

        record.last_manual_score = new_score
        record.last_manual_status = record.status.value
        record.manual_correction_applied = True
        record.manual_correction_reason = reason

        record.add_correction(
            source=CorrectionSource.MANUAL,
            content=f"人工修正评分: {old_score:.1f} → {new_score:.1f}",
            operator=operator,
            before_score=old_score,
            after_score=new_score,
            before_status=old_status,
            after_status=record.status.value,
            change_reason=reason,
        )
        record.add_history(
            action="人工修正",
            operator=operator,
            detail=f"评分从 {old_score:.1f} 分修正为 {new_score:.1f} 分，状态从 {old_status} 变为 {record.status.value}。原因: {reason}"
        )
        record.suggestion = self.scoring.generate_suggestion(record)
        record.take_snapshot("人工修正", operator, before=False, change_reason=reason)
        return record

    def rerun(self, record: BuildingSetbackRecord, operator: str) -> BuildingSetbackRecord:
        InputValidator.validate_operator(operator)

        score_before = record.current_score
        status_before = record.status.value
        had_manual = record.manual_correction_applied
        manual_score = record.last_manual_score
        manual_status = record.last_manual_status
        manual_reason = record.manual_correction_reason

        record.take_snapshot("重跑验证", operator, before=True,
                             detail=f"重跑前有人工修正: {'是' if had_manual else '否'}"
                                    + (f", 人工确认评分: {manual_score:.1f}, 状态: {manual_status}" if had_manual else ""))

        record.add_history(
            action="重新计算(重跑前)",
            operator=operator,
            detail=f"重跑前: 评分 {score_before:.1f}分, 状态 {status_before}"
                   + (f", 已有人工修正(评分{manual_score:.1f},状态{manual_status})将被保留" if had_manual else "")
        )

        base_score = self.scoring.calculate_initial_score(record)
        if record.ramp_supplemented:
            base_score = self.scoring.recalculate_after_ramp(record)
        if record.redline_note:
            ramp_score = base_score
            base_score = self.scoring.recalculate_after_redline(record)
            base_from = f"红线图调整前:{ramp_score:.1f}→调整后:{base_score:.1f}"
        else:
            base_from = f"基础计算值:{base_score:.1f}"

        if had_manual and manual_score is not None and manual_status is not None:
            record.current_score = manual_score
            record.status = RecordStatus(manual_status)
            preserve_msg = (f"重跑检测到人工修正结果已保留 - 不覆盖交通协管复核结论。"
                           f"重算基础分: {base_score:.1f}, 保留人工确认分: {manual_score:.1f}, "
                           f"保留状态: {manual_status}。人工修正原因: {manual_reason}")
            record.add_history(
                action="重跑验证(保留人工修正)",
                operator=operator,
                detail=preserve_msg
            )
        else:
            record.current_score = base_score
            if record.redline_note and "旧口径" in record.redline_note:
                record.status = RecordStatus.OLD_STANDARD
            elif record.ramp_supplemented:
                init_score = self.scoring.calculate_initial_score(record)
                ramp_score = self.scoring.recalculate_after_ramp(record)
                if abs(ramp_score - init_score) < 0.01:
                    record.status = RecordStatus.NEEDS_REVIEW
                else:
                    record.status = RecordStatus.NORMAL if base_score >= ScoringEngine.SCORE_THRESHOLD_NORMAL else RecordStatus.PENDING_CORRECTION
            else:
                record.status = RecordStatus.NORMAL if base_score >= ScoringEngine.SCORE_THRESHOLD_NORMAL else RecordStatus.PENDING_CORRECTION

            record.add_history(
                action="重新计算(无人工修正)",
                operator=operator,
                detail=f"重跑计算路径: {base_from}, 最终评分: {record.current_score:.1f}, 状态: {record.status.value}"
            )

        record.suggestion = self.scoring.generate_suggestion(record)

        record.add_correction(
            source=CorrectionSource.RERUN,
            content=f"重跑验证完成 - {'人工修正结果已保留' if had_manual else '按规则自动重算'}",
            operator=operator,
            before_score=score_before,
            after_score=record.current_score,
            before_status=status_before,
            after_status=record.status.value,
            change_reason=f"重跑验证({base_from})" + (" - 保留人工修正" if had_manual else ""),
        )
        record.take_snapshot("重跑验证", operator, before=False,
                             change_reason=f"基础分{base_score:.1f}" + (" - 已保留人工修正不覆盖" if had_manual else ""),
                             detail=("✅ 人工修正结果已保留，不被重跑覆盖" if had_manual else "按基础规则重算")
                                    + f" | 评分: {score_before:.1f}→{record.current_score:.1f}"
                                    + f" | 状态: {status_before}→{record.status.value}")
        return record

    def get_result(self, record: BuildingSetbackRecord) -> ProcessingResult:
        traceback = record.get_traceback()
        corrections_trace = record.get_corrections_traceback()

        verification_parts = []
        if record.manual_correction_applied and record.last_manual_score is not None:
            if abs(record.current_score - record.last_manual_score) < 0.01:
                verification_parts.append(
                    f"✅ 人工修正结果一致：交通协管确认评分 {record.last_manual_score:.1f} 分，"
                    f"重跑后仍为 {record.current_score:.1f} 分，未被覆盖"
                )
            else:
                verification_parts.append(
                    f"❌ 不一致警告：人工确认分 {record.last_manual_score:.1f}，"
                    f"当前分 {record.current_score:.1f}"
                )
        else:
            verification_parts.append(f"当前评分 {record.current_score:.1f} 分，状态 {record.status.value}")

        if record.status == RecordStatus.NEEDS_REVIEW:
            verification_parts.append("⚠️  状态为待复核，需交通协管确认后才能转为正常")
        if record.status == RecordStatus.OLD_STANDARD:
            verification_parts.append("📌 按旧口径处理，请核对红线图备注")

        verification = " | ".join(verification_parts)

        return ProcessingResult(
            record_id=record.record_id,
            building_name=record.building_name,
            final_score=record.current_score,
            status=record.status,
            suggestion=record.suggestion,
            history_count=len(record.history),
            correction_count=len(record.corrections),
            display_message=ScoringEngine.generate_display_message(record),
            state_traceback=traceback,
            corrections_traceback=corrections_trace,
            manual_score_preserved=record.manual_correction_applied and abs(
                record.current_score - (record.last_manual_score or -1)
            ) < 0.01,
            final_verification=verification,
        )
