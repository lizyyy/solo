
import os
import ast

TARGET_SC = os.path.join("app", "self_check.py")

SC_CONTENT = r'''from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict
from .models import (
    FeatureRecord,
    SelfCheckResult,
    RecordStatus,
    CheckSession,
    ConflictEvidence,
)
from .result_store import UnifiedResultStore


def check_duplicate_imports(records: List[FeatureRecord]) -> SelfCheckResult:
    seen = set()
    duplicates = []
    for rec in records:
        key = (rec.feature_id, rec.bucket_id, rec.sample_id)
        if key in seen:
            duplicates.append("特征" + str(rec.feature_id) + "-桶" + str(rec.bucket_id) + "-样本" + str(rec.sample_id))
        seen.add(key)
    if duplicates:
        return SelfCheckResult(
            check_type="重复导入检查",
            passed=False,
            details="发现" + str(len(duplicates)) + "条重复记录: " + ", ".join(duplicates[:5]) + ("..." if len(duplicates) > 5 else ""),
            found_issues=len(duplicates),
        )
    return SelfCheckResult(
        check_type="重复导入检查", passed=True, details="无重复记录", found_issues=0
    )


def check_feature_missing_default(records: List[FeatureRecord]) -> SelfCheckResult:
    missing_records = [r for r in records if r.status == RecordStatus.FEATURE_MISSING_DEFAULT]
    if missing_records:
        sample_ids = [r.sample_id for r in missing_records]
        return SelfCheckResult(
            check_type="特征缺失默认分检查", passed=False,
            details=("发现" + str(len(missing_records)) + "条记录特征缺失使用默认值填充: "
                     + ", ".join(sample_ids[:5]) + ("..." if len(sample_ids) > 5 else "")
                     + ".这些记录需要推荐负责人复核，暂不归为正常"),
            found_issues=len(missing_records),
        )
    return SelfCheckResult(
        check_type="特征缺失默认分检查", passed=True, details="无特征缺失记录", found_issues=0
    )


def check_resupplement_recalculation(original_records, resupplemented_records):
    omap = {(r.feature_id, r.sample_id): r for r in original_records}
    issues = []
    for nr in resupplemented_records:
        k = (nr.feature_id, nr.sample_id)
        if k in omap:
            orr = omap[k]
            if orr.status == RecordStatus.FEATURE_MISSING_DEFAULT and nr.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                if orr.feature_value == nr.feature_value:
                    issues.append("样本" + nr.sample_id + "补录后仍为默认值，未更新")
    if issues:
        return SelfCheckResult(
            check_type="补录后重算检查", passed=False,
            details="发现" + str(len(issues)) + "条补录后未正确重算: " + ", ".join(issues[:5]),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="补录后重算检查", passed=True, details="补录记录均已正确重算", found_issues=0
    )


def check_export_internal_consistency(
    bucket_records,
    negative_records,
    conflicts,
) -> SelfCheckResult:
    issues = []
    br_map = {(r.sample_id, r.feature_id): r for r in bucket_records}
    nr_map = {(r.sample_id, r.feature_id): r for r in negative_records}
    for c in conflicts:
        k = (c.sample_id, c.feature_id)
        if k not in br_map and k not in nr_map:
            issues.append("冲突" + c.record_id + "在桶和负样本中均未找到记录")
    if issues:
        return SelfCheckResult(
            check_type="导出数据一致性检查", passed=False,
            details="发现" + str(len(issues)) + "处不一致: " + ", ".join(issues[:5]),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="导出数据一致性检查", passed=True, details="导出数据三端一致", found_issues=0
    )


def check_page_api_export_consistency(
    page_data,
    api_data,
    detail_data,
) -> SelfCheckResult:
    issues = []
    if len(page_data) != len(api_data) or len(page_data) != len(detail_data):
        issues.append(
            "数据条数不一致: 页面" + str(len(page_data)) + "条, 接口" + str(len(api_data)) + "条, 明细" + str(len(detail_data)) + "条"
        )
    page_keys = {str(sorted(d.items())) for d in page_data}
    api_keys = {str(sorted(d.items())) for d in api_data}
    detail_keys = {str(sorted(d.items())) for d in detail_data}
    if page_keys != api_keys:
        issues.append("页面展示与接口返回数据不一致")
    if page_keys != detail_keys:
        issues.append("页面展示与导出明细数据不一致")
    if issues:
        return SelfCheckResult(
            check_type="三端数据一致性自检",
            passed=False,
            details="; ".join(issues),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="三端数据一致性自检",
        passed=True,
        details="页面、接口、明细数据完全一致",
        found_issues=0,
    )


def check_resupplement_pending_status(pre_snapshot, current_records) -> SelfCheckResult:
    issues = []
    if pre_snapshot is None:
        return SelfCheckResult(
            check_type="补录后重算正确性自检", passed=True,
            details="无补录快照(非补录触发)，跳过检查", found_issues=0
        )
    pre_map = {(r.sample_id, r.feature_id): r for r in pre_snapshot}
    curr_map = {(r.sample_id, r.feature_id): r for r in current_records}
    for k, pre_rec in pre_map.items():
        if pre_rec.status != RecordStatus.FEATURE_MISSING_DEFAULT:
            continue
        if k not in curr_map:
            continue
        curr_rec = curr_map[k]
        pre_missing = (pre_rec.feature_value is None or str(pre_rec.feature_value) == "nan" or str(pre_rec.feature_value) == "")
        curr_missing = (curr_rec.feature_value is None or str(curr_rec.feature_value) == "nan" or str(curr_rec.feature_value) == "")
        if not pre_missing:
            continue
        if not curr_missing and curr_rec.status == RecordStatus.FEATURE_MISSING_DEFAULT:
            issues.append("样本" + curr_rec.sample_id + "特征" + curr_rec.feature_id + "原始值已补全但仍为FEATURE_MISSING_DEFAULT/pending状态")
        elif curr_missing and curr_rec.status != RecordStatus.FEATURE_MISSING_DEFAULT:
            issues.append("样本" + curr_rec.sample_id + "特征" + curr_rec.feature_id + "仍缺失但pending状态被误取消")
    if issues:
        return SelfCheckResult(
            check_type="补录后重算正确性自检", passed=False,
            details="发现" + str(len(issues)) + "项pending状态错误: " + "; ".join(issues[:3]),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="补录后重算正确性自检", passed=True,
        details="补录后所有特征pending状态均正确", found_issues=0
    )


def check_three_way_consistency(session: CheckSession) -> SelfCheckResult:
    store = UnifiedResultStore(session)
    issues = []
    try:
        pr = store.get_all_records_for_page()
        ar = store.get_all_records_for_api()
        er = store.get_all_records_for_export()
        if len(pr) != len(ar):
            issues.append("页面记录数" + str(len(pr)) + " != API记录数" + str(len(ar)))
        if len(ar) != len(er):
            issues.append("API记录数" + str(len(ar)) + " != 导出记录数" + str(len(er)))
        page_keys = {(r["样本ID"], r["特征ID"]) for r in pr}
        api_keys = {(r["样本ID"], r["特征ID"]) for r in ar}
        if page_keys != api_keys:
            issues.append("页面与API样本-特征键集合不一致")
        if not issues:
            for r in pr:
                k = (r["样本ID"], r["特征ID"])
                page_val = r.get("最终状态(英文)")
                api_rec = next((x for x in ar if (x["样本ID"], x["特征ID"]) == k), None)
                if api_rec and api_rec.get("最终状态(英文)") != page_val:
                    issues.append("记录" + str(k) + "页面状态=" + str(page_val) + " vs API状态=" + str(api_rec.get("status")))
                    if len(issues) >= 3:
                        break
    except Exception as e:
        return SelfCheckResult(
            check_type="三端数据一致性自检", passed=False,
            details="自检执行异常: " + str(e), found_issues=1
        )
    if issues:
        return SelfCheckResult(
            check_type="三端数据一致性自检", passed=False,
            details="发现" + str(len(issues)) + "处三端不一致: " + "; ".join(issues[:5]),
            found_issues=len(issues),
        )
    return SelfCheckResult(
        check_type="三端数据一致性自检", passed=True,
        details="页面/API/导出三端数据完全一致", found_issues=0
    )


def run_all_self_checks(
    bucket_records,
    negative_records,
    conflicts,
    session: Optional[CheckSession] = None,
    pre_resupplement_snapshot=None,
) -> List[SelfCheckResult]:
    results = []
    all_records = list(bucket_records) + list(negative_records)
    results.append(check_duplicate_imports(all_records))
    results.append(check_feature_missing_default(bucket_records))
    if pre_resupplement_snapshot is not None:
        results.append(check_resupplement_recalculation(pre_resupplement_snapshot, bucket_records))
        results.append(check_resupplement_pending_status(pre_resupplement_snapshot, bucket_records))
    results.append(check_export_internal_consistency(bucket_records, negative_records, conflicts))
    if session is not None:
        results.append(check_three_way_consistency(session))
    return results
'''

with open(TARGET_SC, "w", encoding="utf-8") as f:
    f.write(SC_CONTENT)
ast.parse(SC_CONTENT)
print("Wrote", TARGET_SC, "size:", len(SC_CONTENT))

TARGET_WF = os.path.join("app", "workflow.py")
WF_CONTENT = r'''import uuid
import copy
from datetime import datetime
from typing import List, Dict, Optional
from .models import (
    FeatureRecord,
    ConflictEvidence,
    CheckSession,
    CheckParameters,
    RecordStatus,
    ConflictResolution,
    CheckStep,
    StatusChangeEvent,
    SelfCheckResult,
)
from .checker import (
    process_record_status,
    process_all_records,
    detect_conflicts,
)
from .self_check import run_all_self_checks


class WorkflowManager:
    def __init__(self):
        self.sessions: Dict[str, CheckSession] = {}

    def create_session(self, created_by: str = "xiaomeng") -> CheckSession:
        session_id = str(uuid.uuid4())[:8]
        session = CheckSession(
            session_id=session_id,
            created_at=datetime.now(),
            created_by=created_by,
            current_step=CheckStep.STEP1_IMPORT,
        )
        session.operation_log.append(StatusChangeEvent(
            event_time=session.created_at,
            from_status=None,
            to_status="created",
            triggered_by=created_by,
            trigger_step="system_init",
            reason="创建检查会话",
            parameter_version=session.parameters.parameter_version,
        ))
        self.sessions[session_id] = session
        return session

    def _get_session(self, session_id: str) -> CheckSession:
        if session_id not in self.sessions:
            raise ValueError("会话" + session_id + "不存在")
        return self.sessions[session_id]

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
                        + "【流程标记】已进入" + trigger_step + "，该记录状态为待推荐负责人复核，未自动归为正常。" + extra
                    )
                else:
                    r.result_explanation = (
                        "【流程标记】已进入" + trigger_step + "，该记录状态为待推荐负责人复核，未自动归为正常。" + extra
                    )

    def get_session(self, session_id: str):
        return self.sessions.get(session_id)

    def get_result_store(self, session_id: str):
        session = self.get_session(session_id)
        if session is None:
            return None
        from .result_store import UnifiedResultStore
        return UnifiedResultStore(session)

    def step1_import_bucket(self, session_id: str, bucket_records: List[FeatureRecord], parameters: Optional[CheckParameters] = None) -> CheckSession:
        session = self._get_session(session_id)
        if session.is_locked:
            raise ValueError("会话已锁定，不能修改")
        if parameters is not None:
            session.parameters = parameters
        params = session.parameters
        processed = []
        for r in bucket_records:
            processed.append(process_record_status(r, params, triggered_by=session.created_by, trigger_step="step1_import"))
        session.bucket_records = processed
        session.current_step = CheckStep.STEP1_IMPORT

        missing_before = sum(
            1 for r in session.bucket_records
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT
        )
        self._mark_feature_missing_pending(
            session.bucket_records, params,
            trigger_step="步骤1(导入线上实验桶)",
            triggered_by=session.created_by,
            extra="该批共" + str(missing_before) + "条特征缺失默认分记录，全部标记为待推荐负责人复核。",
        )

        self_check_results = run_all_self_checks(
            session.bucket_records,
            session.negative_records,
            session.conflicts,
            session=session,
        )
        for r in self_check_results:
            r.checked_at = datetime.now()
        session.self_check_results = self_check_results
        session.operation_log.append(StatusChangeEvent(
            event_time=datetime.now(), from_status="created", to_status="step1_done",
            triggered_by=session.created_by, trigger_step="step1_import",
            reason="导入" + str(len(bucket_records)) + "条线上实验桶记录，参数版本" + params.parameter_version + "。自检发现" + str(sum(r.found_issues for r in self_check_results)) + "个问题，特征缺失默认分" + str(missing_before) + "条已转待复核状态。",
            parameter_version=params.parameter_version,
        ))
        return session

    def step2_review_negatives(self, session_id: str, negative_records: List[FeatureRecord]) -> CheckSession:
        session = self._get_session(session_id)
        if session.is_locked:
            raise ValueError("会话已锁定，不能修改")
        if not session.bucket_records:
            raise ValueError("请先完成步骤1：导入线上实验桶")
        params = session.parameters
        processed_bucket, processed_negative, conflicts = process_all_records(
            session.bucket_records,
            negative_records,
            params,
            triggered_by=session.created_by,
            trigger_step="step2_review",
        )
        session.bucket_records = processed_bucket
        session.negative_records = processed_negative
        session.conflicts = conflicts
        session.current_step = CheckStep.STEP2_REVIEW_NEGATIVES

        missing_bucket = sum(
            1 for r in session.bucket_records
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT
        )
        missing_negative = sum(
            1 for r in session.negative_records
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT
        )
        self._mark_feature_missing_pending(
            session.bucket_records, params,
            trigger_step="步骤2(补看负样本列表)",
            triggered_by=session.created_by,
            extra="线上桶侧特征缺失默认分" + str(missing_bucket) + "条。",
        )
        self._mark_feature_missing_pending(
            session.negative_records, params,
            trigger_step="步骤2(补看负样本列表)",
            triggered_by=session.created_by,
            extra="负样本侧特征缺失默认分" + str(missing_negative) + "条。",
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
                    parameter_version=params.parameter_version,
                    extra_info="系统仅列出冲突证据，不自动拍板，请评测运营选择确认或驳回",
                )
            )

        self_check_results = run_all_self_checks(
            session.bucket_records,
            session.negative_records,
            session.conflicts,
            session=session,
        )
        for r in self_check_results:
            r.checked_at = datetime.now()
        session.self_check_results = self_check_results
        session.operation_log.append(StatusChangeEvent(
            event_time=datetime.now(), from_status="step1_done", to_status="step2_done",
            triggered_by=session.created_by, trigger_step="step2_review",
            reason="上传" + str(len(negative_records)) + "条负样本，检测到" + str(len(conflicts)) + "个冲突。特征缺失(线上" + str(missing_bucket) + "条/负样本" + str(missing_negative) + "条)仍维持待推荐负责人复核状态。",
            parameter_version=params.parameter_version,
        ))
        return session

    def resolve_conflict(self, session_id: str, record_id: str, resolution: ConflictResolution, resolved_by: str) -> CheckSession:
        session = self._get_session(session_id)
        if session.is_locked:
            raise ValueError("会话已锁定，不能修改")
        parts = record_id.split(":")
        if len(parts) < 2:
            raise ValueError("冲突标识" + record_id + "格式错误，应为sample_id:feature_id")
        sample_id, feature_id = parts[0], ":".join(parts[1:])
        conflict = None
        for c in session.conflicts:
            if c.record_id == record_id:
                conflict = c
                break
        if conflict is None:
            raise ValueError("冲突" + record_id + "不存在")

        old_resolution = conflict.resolution
        conflict.resolution = resolution
        conflict.resolved_by = resolved_by
        conflict.resolved_at = datetime.now()
        reason_map = {
            ConflictResolution.CONFIRM: "评测运营选择以线上实验桶为准（确认冲突）",
            ConflictResolution.REJECT: "评测运营判定数据异常（驳回冲突）",
            ConflictResolution.PENDING: "冲突暂缓处理，待进一步核实",
        }
        reason = reason_map.get(resolution, "处理冲突") + "：" + conflict.description
        params = session.parameters

        conflict.status_history.append(
            StatusChangeEvent(
                event_time=datetime.now(),
                from_status=old_resolution.value,
                to_status=resolution.value,
                triggered_by=resolved_by,
                trigger_step="conflict_resolution",
                reason=reason,
                parameter_version=params.parameter_version,
            )
        )

        for rec_list in [session.bucket_records, session.negative_records]:
            for rec in rec_list:
                if rec.sample_id == sample_id and rec.feature_id == feature_id:
                    old_status = rec.status
                    is_missing_case = (
                        rec.default_value_used
                        or old_status in (RecordStatus.FEATURE_MISSING_DEFAULT, RecordStatus.PENDING_REVIEW)
                    )

                    if is_missing_case:
                        if old_status != RecordStatus.PENDING_REVIEW:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=RecordStatus.PENDING_REVIEW.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution",
                                    reason="冲突已处理（" + resolution.value + "），但因特征缺失给默认分→继续留待推荐负责人复核，不自动归正常",
                                    parameter_version=params.parameter_version,
                                )
                            )
                            rec.status = RecordStatus.PENDING_REVIEW
                        if rec.result_explanation:
                            rec.result_explanation += "【冲突处理】" + resolution.value + " by " + resolved_by + "。特征缺失默认分，继续待推荐负责人复核。"
                        else:
                            rec.result_explanation = "【冲突处理】" + resolution.value + " by " + resolved_by + "。特征缺失默认分，继续待推荐负责人复核。"
                    elif resolution == ConflictResolution.CONFIRM:
                        new_status = RecordStatus.ABNORMAL
                        if old_status != new_status:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=new_status.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution",
                                    reason="冲突已确认并解决（以线上为准）：" + conflict.description,
                                    parameter_version=params.parameter_version,
                                )
                            )
                            rec.status = new_status
                            if rec.result_explanation:
                                rec.result_explanation += "【冲突解决-确认】" + resolution.value + " by " + resolved_by + "。"
                    elif resolution == ConflictResolution.REJECT:
                        new_status = RecordStatus.NORMAL
                        if old_status != new_status:
                            rec.status_history.append(
                                StatusChangeEvent(
                                    event_time=datetime.now(),
                                    from_status=old_status.value,
                                    to_status=new_status.value,
                                    triggered_by=resolved_by,
                                    trigger_step="conflict_resolution",
                                    reason="冲突已驳回（判定异常）：" + conflict.description,
                                    parameter_version=params.parameter_version,
                                )
                            )
                            rec.status = new_status
                            if rec.result_explanation:
                                rec.result_explanation += "【冲突解决-驳回】" + resolution.value + " by " + resolved_by + "。"

        session.operation_log.append(StatusChangeEvent(
            event_time=datetime.now(), from_status="pending_resolution", to_status=resolution.value,
            triggered_by=resolved_by, trigger_step="resolve_conflict",
            reason="处理冲突" + record_id + ": " + reason, parameter_version=params.parameter_version,
        ))
        return session

    def step3_update_summary(self, session_id: str, summary: str, reviewer: Optional[str] = None) -> CheckSession:
        session = self._get_session(session_id)
        if session.is_locked:
            raise ValueError("会话已锁定，不能修改")
        unresolved = [c for c in session.conflicts if c.resolution == ConflictResolution.PENDING]
        if unresolved:
            raise ValueError("冲突未解决，还有" + str(len(unresolved)) + "条待处理")

        pending_review = [
            r for r in session.bucket_records + session.negative_records
            if r.status == RecordStatus.PENDING_REVIEW
        ]
        if pending_review and reviewer is None:
            raise ValueError("待推荐负责人复核的记录存在，必须指定reviewer")

        params = session.parameters
        if reviewer is not None and pending_review:
            for rec in pending_review:
                old = rec.status
                rec.status_history.append(
                    StatusChangeEvent(
                        event_time=datetime.now(),
                        from_status=old.value,
                        to_status=RecordStatus.FEATURE_MISSING_DEFAULT.value,
                        triggered_by=reviewer,
                        trigger_step="step3_reviewer_confirm",
                        reason="推荐负责人" + reviewer + "已复核该特征缺失默认分记录，同意以默认分进入结论",
                        parameter_version=params.parameter_version,
                        extra_info="原始值=" + str(rec.original_feature_value) + ", 填充值=" + str(rec.default_filled_value) + ", 策略=" + params.default_fill_strategy,
                    )
                )
                rec.status = RecordStatus.FEATURE_MISSING_DEFAULT
                if rec.result_explanation:
                    rec.result_explanation += "【推荐负责人复核完成】by " + reviewer + "，以默认分计入结论。"
                else:
                    rec.result_explanation = "【推荐负责人复核完成】by " + reviewer + "，以默认分计入结论。"

        session.summary = summary
        session.reviewer = reviewer
        session.is_locked = True
        session.current_step = CheckStep.STEP3_UPDATE_SUMMARY
        session.operation_log.append(StatusChangeEvent(
            event_time=datetime.now(), from_status="step2_done", to_status="step3_done",
            triggered_by=reviewer or session.created_by, trigger_step="step3_summary",
            reason="步骤3完成：检查流程锁定。摘要：" + summary[:80] + ("..." if len(summary) > 80 else "") + ("推荐负责人" + reviewer + "完成特征缺失默认分记录复核。" if reviewer else "无待复核记录。"),
            parameter_version=params.parameter_version,
        ))
        return session

    def resupplement_and_recalculate(self, session_id: str, resupplement_data: Dict[str, Dict[str, float]]) -> CheckSession:
        session = self._get_session(session_id)
        if session.is_locked:
            raise ValueError("会话已锁定，不能修改")
        params = session.parameters
        pre_bucket_snapshot = copy.deepcopy(session.bucket_records)
        pre_negative_snapshot = copy.deepcopy(session.negative_records)
        for sample_id, feat_map in resupplement_data.items():
            for feature_id, new_value in feat_map.items():
                for rec in session.bucket_records:
                    if rec.sample_id == sample_id and rec.feature_id == feature_id:
                        rec.feature_value = new_value
                        rec.original_feature_value = new_value
                        rec.default_value_used = False
                        rec.notes = (rec.notes or "") + "补录原始值=" + str(new_value) + "; "
        reprocessed_bucket = []
        for r in session.bucket_records:
            r.status_history = list(r.status_history)
            reprocessed_bucket.append(process_record_status(r, params, triggered_by=session.created_by, trigger_step="resupplement"))
        session.bucket_records = reprocessed_bucket
        if session.negative_records:
            pb, pn, cf = process_all_records(
                session.bucket_records, session.negative_records, params,
                triggered_by=session.created_by, trigger_step="resupplement",
            )
            session.bucket_records = pb
            session.negative_records = pn
            session.conflicts = cf

        self._mark_feature_missing_pending(
            session.bucket_records, params,
            trigger_step="补录后重算(线上桶侧)",
            triggered_by=session.created_by,
            extra="补录后重算仍存在特征缺失默认分→待推荐负责人复核",
        )
        self._mark_feature_missing_pending(
            session.negative_records, params,
            trigger_step="补录后重算(负样本侧)",
            triggered_by=session.created_by,
            extra="补录后重算仍存在特征缺失默认分→待推荐负责人复核",
        )

        pre_snapshot_merged = pre_bucket_snapshot + pre_negative_snapshot
        self_check_results = run_all_self_checks(
            session.bucket_records,
            session.negative_records,
            session.conflicts,
            session=session,
            pre_resupplement_snapshot=pre_snapshot_merged,
        )
        for r in self_check_results:
            r.checked_at = datetime.now()
        session.self_check_results = self_check_results
        session.operation_log.append(StatusChangeEvent(
            event_time=datetime.now(), from_status="resupplement_start", to_status="resupplement_done",
            triggered_by=session.created_by, trigger_step="resupplement_and_recalculate",
            reason="补录了" + str(len(resupplement_data)) + "个样本的特征原始值并重算", parameter_version=params.parameter_version,
        ))
        return session


workflow_manager = WorkflowManager()
'''

with open(TARGET_WF, "w", encoding="utf-8") as f:
    f.write(WF_CONTENT)
ast.parse(WF_CONTENT)
print("Wrote", TARGET_WF, "size:", len(WF_CONTENT))

print("All files written and syntax OK!")
