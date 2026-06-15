import uuid
from datetime import datetime
from typing import List, Optional
from .models import (
    CheckSession,
    FeatureRecord,
    CheckStep,
    RecordStatus,
    ConflictResolution,
    ConflictEvidence,
    CheckParameters,
    StatusChangeEvent,
)
from .checker import process_all_records, process_record_status
from .self_check import run_all_self_checks
from .result_store import UnifiedResultStore


class WorkflowManager:
    def __init__(self):
        self.sessions: dict = {}

    def create_session(self, created_by: str = "xiaomeng") -> CheckSession:
        session_id = str(uuid.uuid4())[:8]
        session = CheckSession(
            session_id=session_id,
            created_at=datetime.now(),
            created_by=created_by,
            current_step=CheckStep.STEP1_IMPORT,
        )
        session.operation_log.append(
            StatusChangeEvent(
                event_time=datetime.now(),
                from_status=None,
                to_status="session_created",
                triggered_by=created_by,
                trigger_step="init",
                reason=f"评测运营{created_by}创建时间窗特征穿越检查会话",
            )
        )
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[CheckSession]:
        return self.sessions.get(session_id)

    def get_result_store(self, session_id: str) -> Optional[UnifiedResultStore]:
        session = self.get_session(session_id)
        if session is None:
            return None
        return UnifiedResultStore(session)

    def _log_operation(
        self,
        session: CheckSession,
        to_status: str,
        reason: str,
        triggered_by: str = None,
        parameter_version: str = None,
    ) -> None:
        prev_step = session.current_step.value if session.current_step else None
        session.operation_log.append(
            StatusChangeEvent(
                event_time=datetime.now(),
                from_status=prev_step,
                to_status=to_status,
                triggered_by=triggered_by or session.created_by,
                trigger_step=session.current_step.value,
                reason=reason,
                parameter_version=parameter_version,
            )
        )

    def _mark_feature_missing_pending(
        self,
        records: List[FeatureRecord],
        parameters: CheckParameters,
        trigger_step: str,
        triggered_by: str,
        extra: str = "",
    ) -> None:
        for r in records:
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                old = r.status
                r.status_history.append(
                    StatusChangeEvent(
                        event_time=datetime.now(),
                        from_status=old.value,
                        to_status=RecordStatus.PENDING_REVIEW.value,
                        triggered_by=triggered_by,
                        trigger_step=trigger_step,
                        reason="线上特征缺失给默认分→留待推荐负责人复核，系统不自动归正常",
                        parameter_version=parameters.parameter_version,
                        extra_info=extra,
                    )
                )
                r.status = RecordStatus.PENDING_REVIEW
                if r.result_explanation:
                    r.result_explanation = (
                        r.result_explanation
                        + f"【流程标记】已进入{trigger_step}，该记录状态为待推荐负责人复核，未自动归为正常。{extra}"
                    )

    def step1_import_bucket(
        self,
        session_id: str,
        bucket_records: List[FeatureRecord],
        parameters: Optional[CheckParameters] = None,
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        if session.current_step != CheckStep.STEP1_IMPORT:
            raise ValueError(f"当前步骤不是导入步骤，当前为{session.current_step}")

        if parameters:
            session.parameters = parameters

        from .checker import process_record_status

        processed_bucket = [
            process_record_status(
                r, session.parameters,
                triggered_by=session.created_by,
                trigger_step="step1_import_bucket",
            ) for r in bucket_records
        ]
        session.bucket_records = processed_bucket

        for r in session.self_check_results:
            r.checked_at = datetime.now()
        session.self_check_results = run_all_self_checks(
            session.bucket_records, session.negative_records
        )
        for r in session.self_check_results:
            r.checked_at = datetime.now()

        missing_before = sum(
            1 for r in session.bucket_records
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT
        )
        self._mark_feature_missing_pending(
            session.bucket_records, session.parameters,
            trigger_step="步骤1(导入线上实验桶)",
            triggered_by=session.created_by,
            extra=f"该批共{missing_before}条特征缺失默认分记录，全部标记为待推荐负责人复核。",
        )

        self._log_operation(
            session,
            to_status=CheckStep.STEP1_IMPORT.value + "_done",
            reason=f"步骤1完成：导入{len(bucket_records)}条线上实验桶记录，参数版本{session.parameters.parameter_version}。"
                   f"自检发现：{sum(r.found_issues for r in session.self_check_results)}个问题，"
                   f"其中特征缺失默认分{missing_before}条，已转待复核状态。",
            parameter_version=session.parameters.parameter_version,
        )

        return session

    def step2_review_negatives(
        self,
        session_id: str,
        negative_records: List[FeatureRecord],
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        if session.current_step != CheckStep.STEP1_IMPORT and session.current_step != CheckStep.STEP2_REVIEW_NEGATIVES:
            raise ValueError(f"需先完成步骤1，当前为{session.current_step}")

        session.current_step = CheckStep.STEP2_REVIEW_NEGATIVES

        processed_bucket, processed_negative, conflicts = process_all_records(
            session.bucket_records, negative_records, session.parameters,
            triggered_by=session.created_by,
            trigger_step="step2_review_negatives",
        )
        session.bucket_records = processed_bucket
        session.negative_records = processed_negative
        session.conflicts = conflicts

        for r in session.self_check_results:
            r.checked_at = datetime.now()
        session.self_check_results = run_all_self_checks(
            session.bucket_records, session.negative_records
        )
        for r in session.self_check_results:
            r.checked_at = datetime.now()

        missing_bucket = sum(
            1 for r in session.bucket_records
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT
        )
        missing_negative = sum(
            1 for r in session.negative_records
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT
        )
        self._mark_feature_missing_pending(
            session.bucket_records, session.parameters,
            trigger_step="步骤2(补看负样本列表)",
            triggered_by=session.created_by,
            extra=f"线上桶侧特征缺失默认分{missing_bucket}条。",
        )
        self._mark_feature_missing_pending(
            session.negative_records, session.parameters,
            trigger_step="步骤2(补看负样本列表)",
            triggered_by=session.created_by,
            extra=f"负样本侧特征缺失默认分{missing_negative}条。",
        )

        for conflict in session.conflicts:
            conflict.status_history.append(
                StatusChangeEvent(
                    event_time=datetime.now(),
                    from_status=None,
                    to_status=ConflictResolution.PENDING.value,
                    triggered_by=session.created_by,
                    trigger_step="step2_conflict_detected",
                    reason=conflict.description,
                    parameter_version=session.parameters.parameter_version,
                    extra_info="系统仅列出冲突证据，不自动拍板，请评测运营选择确认或驳回",
                )
            )

        self._log_operation(
            session,
            to_status=CheckStep.STEP2_REVIEW_NEGATIVES.value + "_done",
            reason=f"步骤2完成：导入{len(negative_records)}条负样本记录，检测到{len(conflicts)}个冲突。"
                   f"冲突证据已列出，需人工选择确认/驳回，系统不替业务同事自动拍板。"
                   f"特征缺失默认分记录(线上{missing_bucket}条/负样本{missing_negative}条)仍维持待推荐负责人复核状态。",
            parameter_version=session.parameters.parameter_version,
        )

        return session

    def resolve_conflict(
        self,
        session_id: str,
        record_id: str,
        resolution: ConflictResolution,
        resolved_by: str,
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        for conflict in session.conflicts:
            if conflict.record_id == record_id:
                old_resolution = conflict.resolution
                conflict.resolution = resolution
                conflict.resolved_by = resolved_by
                conflict.resolved_at = datetime.now()
                conflict.status_history.append(
                    StatusChangeEvent(
                        event_time=datetime.now(),
                        from_status=old_resolution.value,
                        to_status=resolution.value,
                        triggered_by=resolved_by,
                        trigger_step="conflict_resolution",
                        reason=f"{'评测运营选择以线上实验桶为准（确认冲突）' if resolution == ConflictResolution.CONFIRM else '评测运营判定数据异常（驳回冲突）'}：{conflict.description}",
                        parameter_version=session.parameters.parameter_version,
                    )
                )

                for rec in session.bucket_records:
                    if rec.sample_id == record_id:
                        old_status = rec.status
                        if rec.feature_value is None or rec.default_value_used:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=RecordStatus.PENDING_REVIEW.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution_bucket",
                                    reason=f"冲突已处理（{resolution.value}），但因线上特征缺失给默认分→继续留待推荐负责人复核，不自动归正常",
                                    parameter_version=session.parameters.parameter_version,
                                )
                            )
                            rec.status = RecordStatus.PENDING_REVIEW
                            if rec.result_explanation:
                                rec.result_explanation += f"【冲突处理】{resolution.value} by {resolved_by}。线上特征缺失默认分，继续待推荐负责人复核。"
                        elif resolution == ConflictResolution.CONFIRM:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=RecordStatus.NORMAL.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution_bucket",
                                    reason=f"冲突已确认并解决（以线上为准）：{conflict.description}",
                                    parameter_version=session.parameters.parameter_version,
                                )
                            )
                            rec.status = RecordStatus.NORMAL
                            if rec.result_explanation:
                                rec.result_explanation += f"【冲突解决-确认】{resolution.value} by {resolved_by}。"
                        elif resolution == ConflictResolution.REJECT:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=RecordStatus.ABNORMAL.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution_bucket",
                                    reason=f"冲突已驳回（判定异常）：{conflict.description}",
                                    parameter_version=session.parameters.parameter_version,
                                )
                            )
                            rec.status = RecordStatus.ABNORMAL
                            if rec.result_explanation:
                                rec.result_explanation += f"【冲突解决-驳回】{resolution.value} by {resolved_by}。"

                for rec in session.negative_records:
                    if rec.sample_id == record_id:
                        old_status = rec.status
                        if rec.feature_value is None or rec.default_value_used:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=RecordStatus.PENDING_REVIEW.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution_negative",
                                    reason=f"冲突已处理（{resolution.value}），但因负样本侧特征缺失给默认分→继续留待推荐负责人复核，不自动归正常",
                                    parameter_version=session.parameters.parameter_version,
                                )
                            )
                            rec.status = RecordStatus.PENDING_REVIEW
                            if rec.result_explanation:
                                rec.result_explanation += f"【冲突处理】{resolution.value} by {resolved_by}。负样本特征缺失默认分，继续待推荐负责人复核。"
                        elif resolution == ConflictResolution.CONFIRM:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=RecordStatus.NORMAL.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution_negative",
                                    reason=f"冲突已确认并解决（以线上为准）：{conflict.description}",
                                    parameter_version=session.parameters.parameter_version,
                                )
                            )
                            rec.status = RecordStatus.NORMAL
                            if rec.result_explanation:
                                rec.result_explanation += f"【冲突解决-确认】{resolution.value} by {resolved_by}。"
                        elif resolution == ConflictResolution.REJECT:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=RecordStatus.ABNORMAL.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution_negative",
                                    reason=f"冲突已驳回（判定异常）：{conflict.description}",
                                    parameter_version=session.parameters.parameter_version,
                                )
                            )
                            rec.status = RecordStatus.ABNORMAL
                            if rec.result_explanation:
                                rec.result_explanation += f"【冲突解决-驳回】{resolution.value} by {resolved_by}。"
                break

        self._log_operation(
            session,
            to_status=f"conflict_{record_id}_{resolution.value}",
            reason=f"样本{record_id}冲突由{resolved_by}选择「{'确认' if resolution == ConflictResolution.CONFIRM else '驳回'}」：{conflict.description}",
            triggered_by=resolved_by,
            parameter_version=session.parameters.parameter_version,
        )

        return session

    def step3_update_summary(
        self,
        session_id: str,
        summary: str,
        reviewer: Optional[str] = None,
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        pending_conflicts = [
            c for c in session.conflicts
            if c.resolution == ConflictResolution.PENDING
        ]
        if pending_conflicts:
            raise ValueError(
                f"还有{len(pending_conflicts)}个冲突未解决，请先处理冲突。"
                f"涉及样本: {', '.join(c.record_id for c in pending_conflicts[:5])}"
            )

        pending_review = [
            r for r in session.bucket_records + session.negative_records
            if r.status == RecordStatus.PENDING_REVIEW
        ]
        if pending_review and not reviewer:
            sample_ids = list({r.sample_id for r in pending_review})
            raise ValueError(
                f"还有{len(pending_review)}条线上特征缺失给默认分的记录待推荐负责人复核，"
                f"涉及样本: {', '.join(sample_ids[:5])}。请填写推荐负责人reviewer字段后再提交。"
            )

        session.current_step = CheckStep.STEP3_UPDATE_SUMMARY
        session.summary = summary
        session.reviewer = reviewer

        if reviewer:
            all_records = session.bucket_records + session.negative_records
            for r in all_records:
                if r.status == RecordStatus.PENDING_REVIEW:
                    old = r.status
                    r.status_history.append(
                        StatusChangeEvent(
                            event_time=datetime.now(),
                            from_status=old.value,
                            to_status=RecordStatus.FEATURE_MISSING_DEFAULT.value,
                            triggered_by=reviewer,
                            trigger_step="step3_reviewer_confirm",
                            reason=f"推荐负责人{reviewer}已复核该特征缺失默认分记录，同意以默认分进入结论",
                            parameter_version=session.parameters.parameter_version,
                            extra_info=f"原始值={r.original_feature_value}, 填充值={r.default_filled_value}, 策略={session.parameters.default_fill_strategy}",
                        )
                    )
                    r.status = RecordStatus.FEATURE_MISSING_DEFAULT
                    if r.result_explanation:
                        r.result_explanation += f"【推荐负责人复核完成】by {reviewer}，以默认分计入结论。"

        session.is_locked = True

        self._log_operation(
            session,
            to_status="step3_done_locked",
            reason=f"步骤3完成：检查流程锁定。摘要：{summary[:80]}{'...' if len(summary) > 80 else ''}。"
                   + (f"推荐负责人{reviewer}完成特征缺失默认分记录复核。" if reviewer else "无待复核记录。"),
            triggered_by=session.created_by,
            parameter_version=session.parameters.parameter_version,
        )

        return session

    def resupplement_and_recalculate(
        self,
        session_id: str,
        updated_records: List[FeatureRecord],
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        session.is_locked = False

        for updated in updated_records:
            for i, orig in enumerate(session.bucket_records):
                if orig.sample_id == updated.sample_id and orig.feature_id == updated.feature_id:
                    session.bucket_records[i] = updated
                    break
            for i, orig in enumerate(session.negative_records):
                if orig.sample_id == updated.sample_id and orig.feature_id == updated.feature_id:
                    session.negative_records[i] = updated
                    break

        processed_bucket, processed_negative, conflicts = process_all_records(
            session.bucket_records, session.negative_records, session.parameters,
            triggered_by=session.created_by,
            trigger_step="resupplement_recalculate",
        )
        session.bucket_records = processed_bucket
        session.negative_records = processed_negative
        session.conflicts = conflicts

        for r in session.self_check_results:
            r.checked_at = datetime.now()
        session.self_check_results = run_all_self_checks(
            session.bucket_records, session.negative_records
        )
        for r in session.self_check_results:
            r.checked_at = datetime.now()

        self._mark_feature_missing_pending(
            session.bucket_records, session.parameters,
            trigger_step="补录后重算(线上桶侧)",
            triggered_by=session.created_by,
            extra="补录后重算仍存在特征缺失默认分→待推荐负责人复核",
        )
        self._mark_feature_missing_pending(
            session.negative_records, session.parameters,
            trigger_step="补录后重算(负样本侧)",
            triggered_by=session.created_by,
            extra="补录后重算仍存在特征缺失默认分→待推荐负责人复核",
        )

        self._log_operation(
            session,
            to_status="resupplemented_recalculated",
            reason=f"补录并重算{len(updated_records)}条记录，流程解锁，可再次进入步骤2/3。",
            parameter_version=session.parameters.parameter_version,
        )

        return session


workflow_manager = WorkflowManager()
