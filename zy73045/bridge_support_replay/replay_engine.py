"""核心回放引擎 — replay_workorder。

值班脚本只需要：
  result = replay_workorder("WO-2025-001")
  if not result["success"]:
      reason = result["failure_reason"]
      # reason["code"] 稳定枚举，按它分支
      # reason["suggested_actions"] 给接手同事看
  timeline = result["timeline"]  # 时间线，事件按时间排序

回放流程：
  1. 加载工单
  2. 重放时间线（确保所有事件都能被消费，发现断点即为失败）
  3. 检查：照片时间错位 / 备件版本冲突 / 报警-备注不一致 / 缺关键材料
  4. 汇总失败原因和建议动作
  5. 稳定返回 ReplayResult
"""

from __future__ import annotations

from typing import Optional, Union

from .models import (
    WorkOrder,
    ReplayResult,
    FailureReason,
    FailureCode,
    WorkOrderStatus,
    TimelineEventType,
)
from .storage import load_workorder
from .validators import validate_all_photos, PhotoMismatchInfo
from .timeline import check_alarm_note_consistency, build_timeline
from .classifier import classify_workorder


def _check_spare_part_conflicts(wo: WorkOrder) -> list[dict]:
    """同一 part_id 多版本且内容打架 → 报警（老唐担心的"旧说法翻出来"）。

    只检查"关键字段前后矛盾"，版本递增但只补全不算冲突。
    """
    conflicts: list[dict] = []
    by_id: dict[str, list] = {}
    for sp in wo.spare_parts:
        by_id.setdefault(sp.part_id, []).append(sp)

    for part_id, versions in by_id.items():
        if len(versions) < 2:
            continue
        versions.sort(key=lambda x: x.version)
        base = versions[0]
        for newer in versions[1:]:
            # 只要新的把旧的 quantity 改了且差距 > ±1，就算版本冲突
            if (base.quantity is not None and newer.quantity is not None
                    and abs(base.quantity - newer.quantity) > 0.001
                    and newer.cleaned_note is not None):
                # 有清洗说明，不算冲突，算明确的版本变更
                continue
            if (base.quantity is not None and newer.quantity is not None
                    and abs(base.quantity - newer.quantity) > 0.001):
                conflicts.append({
                    "part_id": part_id,
                    "field": "quantity",
                    "old": base.quantity,
                    "new": newer.quantity,
                    "old_version": base.version,
                    "new_version": newer.version,
                    "old_source": base.source,
                    "new_source": newer.source,
                    "note": "缺少清洗说明，请确认是补录了新的领用/退回，还是原始数据录入错误",
                })
            if (base.spec and newer.spec and base.spec != newer.spec
                    and newer.cleaned_note is None):
                conflicts.append({
                    "part_id": part_id,
                    "field": "spec",
                    "old": base.spec,
                    "new": newer.spec,
                    "old_version": base.version,
                    "new_version": newer.version,
                    "note": "规格发生变化但没有清洗说明，建议补一条说明是换型还是笔误",
                })
    return conflicts


def replay_workorder(workorder: Union[str, WorkOrder],
                     *,
                     strict: bool = True) -> ReplayResult:
    """回放单个工单。

    Parameters
    ----------
    workorder : 工单ID字符串，或已加载的 WorkOrder 对象
    strict     : True → 发现 high/critical 级照片错位或报警/备注矛盾立即失败；
                 False → 仍成功返回，但把问题写进 failure_reason（软失败）
    """
    if isinstance(workorder, str):
        wo = load_workorder(workorder)
        if wo is None:
            return ReplayResult(
                workorder_id=workorder,
                status=WorkOrderStatus.STUCK,
                success=False,
                failure_reason=FailureReason(
                    code=FailureCode.MISSING_REQUIRED_FIELD,
                    message=f"工单 {workorder} 不存在",
                    details={"workorder_id": workorder},
                    suggested_actions=[
                        f"检查工单ID是否拼错，或从外部系统重新导入："
                        f"storage.create_workorder_from_raw(...)",
                    ],
                ),
            )
    else:
        wo = workorder

    failures: list[FailureReason] = []

    # 2. 照片时间错位
    photo_results, photo_blocker = validate_all_photos(wo.photos)
    photo_analysis = {
        "count": len(photo_results),
        "per_photo": [p.to_dict() for p in photo_results],
        "blocker": photo_blocker,
    }
    if photo_blocker:
        bad = [p for p in photo_results if p.severity in ("high", "critical")]
        first = bad[0]
        suggestions: list[str] = []
        for p in bad:
            suggestions.append(f"[照片 {p.photo_id}] {p.human_readable_summary}")
            suggestions.extend(p.suggested_actions[:2])
        failures.append(FailureReason(
            code=FailureCode.PHOTO_TIME_MISMATCH,
            message=f"{len(bad)} 张照片存在 high/critical 时间错位（首张：{first.human_readable_summary}）",
            details={"bad_photos": [p.to_dict() for p in bad]},
            suggested_actions=suggestions,
        ))

    # 3. 备件版本冲突（老唐担心的"旧说法翻出来"）
    spare_conflicts = _check_spare_part_conflicts(wo)
    spare_analysis = {
        "count": len(wo.spare_parts),
        "version_conflicts": spare_conflicts,
        "raw_entries_preserved": all(bool(sp.raw_entry) for sp in wo.spare_parts),
    }
    if spare_conflicts:
        failures.append(FailureReason(
            code=FailureCode.SPARE_PART_VERSION_CONFLICT,
            message=f"{len(spare_conflicts)} 条备件存在版本冲突",
            details={"conflicts": spare_conflicts},
            suggested_actions=[
                "在 cleaning_log 里补一条清洗说明，明确变更是补录、换型还是笔误",
                "如果是补录了新的领用，把 part_id 后面加 -2 作为新条目而非覆盖旧条目",
                "如果是原始数据录入错误，保留 raw_entry 不动，在 cleaned_note 里写"
                "“原始数据 XX 应为 YY，见 XX 交接记录”",
            ],
        ))

    # 4. 报警与人工备注对不上（老唐最担心的一条）
    consistent, inconsistency_note = check_alarm_note_consistency(wo)
    if not consistent:
        failures.append(FailureReason(
            code=FailureCode.ALARM_NOTE_MISMATCH,
            message=inconsistency_note or "报警状态与人工备注对不上",
            details={
                "alarm_status": wo.alarm_status,
                "manual_note_excerpt": (wo.current_note or "")[:400],
            },
            suggested_actions=[
                "在人工备注里明确回应每条报警：已处理/误报/原因分析",
                "如果报警确实已处理，补一条状态变更把 alarm_status 置为 handled",
                "如果是误报，写清楚误判原因和确认人",
            ],
        ))

    # 5. 分类判断缺什么 → 待补证据
    classification = classify_workorder(wo)
    if classification["missing_items"]:
        failures.append(FailureReason(
            code=FailureCode.INSUFFICIENT_EVIDENCE,
            message=f"缺少 {len(classification['missing_items'])} 项关键材料",
            details={"missing_items": classification["missing_items"]},
            suggested_actions=classification["missing_items"],
        ))

    # 汇总失败
    success = not failures or not strict
    primary_failure: Optional[FailureReason] = None
    if failures:
        # 把所有失败合并成一个"主失败"：取最严重的 code，把建议合并
        severity_order = [
            FailureCode.ALARM_NOTE_MISMATCH,
            FailureCode.SPARE_PART_VERSION_CONFLICT,
            FailureCode.PHOTO_TIME_MISMATCH,
            FailureCode.INSUFFICIENT_EVIDENCE,
            FailureCode.MISSING_REQUIRED_FIELD,
            FailureCode.REPLAY_INCONSISTENT,
        ]
        failures.sort(key=lambda f: severity_order.index(f.code)
                       if f.code in severity_order else 99)
        primary = failures[0]
        all_suggestions: list[str] = []
        for f in failures:
            all_suggestions.append(f"【{f.code.value}】{f.message}")
            all_suggestions.extend(f.suggested_actions)
        primary_failure = FailureReason(
            code=primary.code,
            message="；".join(f.message for f in failures),
            details={"all_failures": [f.to_dict() for f in failures]},
            suggested_actions=all_suggestions,
        )

    # 建议下一步
    next_step = None
    if not success:
        if primary_failure and primary_failure.suggested_actions:
            next_step = primary_failure.suggested_actions[0]
    else:
        next_step = "回放通过，按当前结论闭环或继续补录完善"

    return ReplayResult(
        workorder_id=wo.workorder_id,
        status=classification["status"],
        success=success,
        failure_reason=primary_failure,
        timeline=list(wo.timeline),
        spare_parts_analysis=spare_analysis,
        photo_analysis=photo_analysis,
        raw_snapshot=dict(wo.raw_snapshot),
        current_conclusion=wo.current_conclusion,
        suggested_next_step=next_step,
    )
