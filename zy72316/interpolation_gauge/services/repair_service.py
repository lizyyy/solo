import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from interpolation_gauge.models.schemas import (
    ScoringWeightRow, AuditTrail, RepairRecord, WorkflowState,
    ProcessingStatus, ImportPhase, BoundaryJudgment, ErrorType,
)
from interpolation_gauge.models.payloads import (
    WeightRowImportItem, WeightRowResponse, AuditTrailResponse,
    RepairRecordResponse, WorkflowStateResponse, ExportDetailResponse,
    BatchSummaryResponse,
)
from interpolation_gauge.services.interpolation import judge_boundary, piecewise_linear_interpolate


DEFAULT_BREAKPOINTS_FACTOR = [(0.0, 0.0), (0.5, 0.5), (1.0, 1.0), (1.5, 1.5)]


def _default_breakpoints(threshold: float) -> list:
    return [(t * threshold, v) for t, v in DEFAULT_BREAKPOINTS_FACTOR]


def _record_audit(
    db: Session,
    row_id: int,
    original_row_number: int,
    field_name: str,
    old_value: Optional[str],
    new_value: Optional[str],
    change_reason: str,
    changed_by: str = "system",
) -> AuditTrail:
    trail = AuditTrail(
        row_id=row_id,
        original_row_number=original_row_number,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        change_reason=change_reason,
        changed_by=changed_by,
        changed_at=datetime.utcnow(),
    )
    db.add(trail)
    db.flush()
    return trail


def _record_repair(
    db: Session,
    row: ScoringWeightRow,
    phase: ImportPhase,
    action_type: str,
    change_reason: Optional[str] = None,
    changed_by: str = "system",
    next_action_owner: Optional[str] = None,
    old_formula_screenshot_ref: Optional[str] = None,
    counterexample_note: Optional[str] = None,
    rollback_reason: Optional[str] = None,
    interpolated_curve_data: Optional[dict] = None,
    original_value_before: Optional[float] = None,
    original_value_after: Optional[float] = None,
    interpolated_value_before: Optional[float] = None,
    interpolated_value_after: Optional[float] = None,
    threshold_before: Optional[float] = None,
    threshold_after: Optional[float] = None,
    instructor_reviewed: Optional[int] = None,
) -> RepairRecord:
    is_boundary = row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD
    ir = instructor_reviewed
    if ir is None:
        ir = 0 if is_boundary else 1
        if is_boundary and phase == ImportPhase.COUNTEREXAMPLE_UPDATED and action_type == "counterexample_update":
            ir = 0
    repair = RepairRecord(
        row_id=row.id,
        import_batch_id=row.import_batch_id,
        phase=phase,
        boundary_judgment=row.boundary_judgment,
        interpolated_curve_data=interpolated_curve_data,
        old_formula_screenshot_ref=old_formula_screenshot_ref,
        counterexample_note=counterexample_note,
        is_boundary_equal_threshold=1 if is_boundary else 0,
        instructor_reviewed=ir,
        rollback_reason=rollback_reason,
        original_value_before=original_value_before,
        original_value_after=original_value_after,
        interpolated_value_before=interpolated_value_before,
        interpolated_value_after=interpolated_value_after,
        threshold_before=threshold_before,
        threshold_after=threshold_after,
        action_type=action_type,
        change_reason=change_reason,
        changed_by=changed_by,
        next_action_owner=next_action_owner,
        created_at=datetime.utcnow(),
    )
    db.add(repair)
    db.flush()
    return repair


def _recompute_value_and_status(
    row: ScoringWeightRow,
    new_original_value: Optional[float],
    new_threshold: Optional[float] = None,
) -> dict:
    """
    改值重算：重新计算边界判定 + 插值 + 状态初判。
    返回改动前后快照。
    """
    old_original = row.original_value
    old_interpolated = row.interpolated_value
    old_threshold = row.threshold

    if new_threshold is not None:
        row.threshold = new_threshold
    if new_original_value is not None:
        row.original_value = new_original_value

    if row.original_value is not None and row.threshold is not None:
        bps = _default_breakpoints(row.threshold)
        row.interpolated_value = piecewise_linear_interpolate(row.original_value, bps)
        row.boundary_judgment = judge_boundary(row.original_value, row.threshold)
    else:
        row.interpolated_value = None
        row.boundary_judgment = None

    return {
        "original_value_before": old_original,
        "original_value_after": row.original_value,
        "interpolated_value_before": old_interpolated,
        "interpolated_value_after": row.interpolated_value,
        "threshold_before": old_threshold,
        "threshold_after": row.threshold,
        "interpolated_curve_data": {
            "breakpoints_used": "default",
            "breakpoints": [list(x) for x in _default_breakpoints(row.threshold)] if row.threshold else [],
        },
    }


def _refresh_workflow_counts(db: Session, import_batch_id: str) -> WorkflowState:
    """
    每次改动后重新统计工作流计数，确保摘要/列表/导出一致。
    """
    workflow = db.query(WorkflowState).filter(WorkflowState.import_batch_id == import_batch_id).first()
    if not workflow:
        raise ValueError(f"import_batch_id={import_batch_id} 不存在")

    rows = db.query(ScoringWeightRow).filter(ScoringWeightRow.import_batch_id == import_batch_id).all()
    workflow.total_rows = len(rows)
    workflow.boundary_equal_threshold_count = sum(
        1 for r in rows if r.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD
        and r.processing_status != ProcessingStatus.ROLLED_BACK
    )
    workflow.wrong_caliber_count = sum(1 for r in rows if r.error_type == ErrorType.WRONG_CALIBER)
    workflow.supplementary_rework_count = sum(1 for r in rows if r.error_type == ErrorType.SUPPLEMENTARY_REWORK)
    workflow.updated_at = datetime.utcnow()
    db.flush()
    return workflow


def _determine_phase_after_action(db: Session, import_batch_id: str, action_type: str) -> None:
    """
    阶段推进规则（链路稳定关键）：
    - 所有行都有 OLD_FORMULA_REVIEWED 阶段的修补记录 → 批次推进到 old_formula_reviewed
    - 所有行都有 COUNTEREXAMPLE_UPDATED 阶段的修补记录 → 批次推进到 counterexample_updated
    """
    workflow = db.query(WorkflowState).filter(WorkflowState.import_batch_id == import_batch_id).first()
    if not workflow:
        return

    rows = db.query(ScoringWeightRow).filter(ScoringWeightRow.import_batch_id == import_batch_id).all()
    if not rows:
        return
    row_ids = {r.id for r in rows}

    records = db.query(RepairRecord).filter(
        RepairRecord.import_batch_id == import_batch_id,
        RepairRecord.row_id.in_(row_ids),
    ).all()
    by_row_phase = {}
    for r in records:
        by_row_phase.setdefault(r.row_id, set()).add(r.phase)

    all_done_formula = all(ImportPhase.OLD_FORMULA_REVIEWED in by_row_phase.get(rid, set()) for rid in row_ids)
    all_done_counter = all(ImportPhase.COUNTEREXAMPLE_UPDATED in by_row_phase.get(rid, set()) for rid in row_ids)

    if all_done_counter and workflow.current_phase != ImportPhase.COUNTEREXAMPLE_UPDATED:
        workflow.current_phase = ImportPhase.COUNTEREXAMPLE_UPDATED
        workflow.updated_at = datetime.utcnow()
    elif all_done_formula and workflow.current_phase == ImportPhase.WEIGHT_TABLE_IMPORTED:
        workflow.current_phase = ImportPhase.OLD_FORMULA_REVIEWED
        workflow.updated_at = datetime.utcnow()
    db.flush()


def _next_owner_after(row: ScoringWeightRow) -> Optional[str]:
    if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD and \
       row.processing_status in (ProcessingStatus.BOUNDARY_PENDING_REVIEW, ProcessingStatus.PENDING):
        return "instructor"
    if row.processing_status in (ProcessingStatus.PENDING, ProcessingStatus.REVIEWING):
        return "analyst_qi"
    return None


def _check_phase_allowed(
    db: Session,
    import_batch_id: str,
    target_phase: ImportPhase,
    operation_type: str = "advance",
) -> None:
    """
    阶段校验：禁止跳步。
    operation_type:
      - "advance": 阶段推进操作（review_old_formula, update_counterexample）
                   必须按顺序：target_idx == current_idx + 1 或 target_idx == current_idx
      - "modify":  修改操作（manual_override, quick_fix, rollback, boundary_review）
                   要求当前阶段 >= 目标阶段（必须先完成前置步骤才能修改）
    """
    workflow = db.query(WorkflowState).filter(WorkflowState.import_batch_id == import_batch_id).first()
    if not workflow:
        raise ValueError(f"import_batch_id={import_batch_id} 不存在")

    current = workflow.current_phase
    phase_order = [
        ImportPhase.WEIGHT_TABLE_IMPORTED,
        ImportPhase.OLD_FORMULA_REVIEWED,
        ImportPhase.COUNTEREXAMPLE_UPDATED,
    ]
    try:
        current_idx = phase_order.index(current)
        target_idx = phase_order.index(target_phase)
    except ValueError:
        raise ValueError(f"无效的阶段: current={current}, target={target_phase}")

    phase_map = {
        ImportPhase.WEIGHT_TABLE_IMPORTED: "第一步：评分权重表导入",
        ImportPhase.OLD_FORMULA_REVIEWED: "第二步：补看旧公式截图",
        ImportPhase.COUNTEREXAMPLE_UPDATED: "第三步：反例列表更新",
    }

    if operation_type == "advance":
        if target_idx != current_idx + 1 and target_idx != current_idx:
            raise ValueError(
                f"禁止跳步！当前批次阶段为「{phase_map[current]}」，"
                f"不能直接执行「{phase_map[target_phase]}」。"
                f"请先完成「{phase_map[phase_order[current_idx]]}」"
            )
    elif operation_type == "modify":
        if current_idx < target_idx:
            raise ValueError(
                f"禁止跳步修改！当前批次阶段为「{phase_map[current]}」，"
                f"必须先完成「{phase_map[target_phase]}」才能执行此修改操作。"
                f"请按顺序完成「{phase_map[phase_order[current_idx]]}」→「{phase_map[target_phase]}」"
            )
    else:
        raise ValueError(f"无效的 operation_type: {operation_type}")


def import_weight_table(db: Session, rows: List[WeightRowImportItem]) -> WorkflowStateResponse:
    batch_id = str(uuid.uuid4())[:8]
    boundary_count = 0

    for item in rows:
        boundary_judgment = None
        processing_status = ProcessingStatus.PENDING
        interpolated_value = None

        if item.original_value is not None:
            boundary_judgment = judge_boundary(item.original_value, item.threshold)
            if boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD:
                processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
                boundary_count += 1
            bps = _default_breakpoints(item.threshold)
            interpolated_value = piecewise_linear_interpolate(item.original_value, bps)

        row = ScoringWeightRow(
            import_batch_id=batch_id,
            original_row_number=item.original_row_number,
            indicator_name=item.indicator_name,
            threshold=item.threshold,
            weight=item.weight,
            original_value=item.original_value,
            interpolated_value=interpolated_value,
            boundary_judgment=boundary_judgment,
            processing_status=processing_status,
        )
        db.add(row)
        db.flush()

        _record_audit(
            db=db, row_id=row.id, original_row_number=row.original_row_number,
            field_name="import", old_value=None,
            new_value=f"row={item.original_row_number}, indicator={item.indicator_name}, val={item.original_value}, th={item.threshold}",
            change_reason="评分权重表首次导入",
        )

        is_boundary = boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD
        _record_repair(
            db=db, row=row, phase=ImportPhase.WEIGHT_TABLE_IMPORTED,
            action_type="import",
            change_reason="评分权重表首次导入",
            changed_by="system",
            next_action_owner="instructor" if is_boundary else "analyst_qi",
            interpolated_curve_data={
                "breakpoints_used": "default",
                "breakpoints": [list(x) for x in _default_breakpoints(item.threshold)],
            },
            original_value_before=None,
            original_value_after=item.original_value,
            interpolated_value_before=None,
            interpolated_value_after=interpolated_value,
            threshold_before=None,
            threshold_after=item.threshold,
            instructor_reviewed=0 if is_boundary else 1,
        )

    workflow = WorkflowState(
        import_batch_id=batch_id,
        current_phase=ImportPhase.WEIGHT_TABLE_IMPORTED,
        total_rows=len(rows),
        boundary_equal_threshold_count=boundary_count,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return WorkflowStateResponse.model_validate(workflow)


def review_old_formula(
    db: Session,
    import_batch_id: str,
    row_id: int,
    screenshot_ref: str,
    note: Optional[str] = None,
    changed_by: str = "analyst_qi",
) -> RepairRecordResponse:
    _check_phase_allowed(db, import_batch_id, ImportPhase.OLD_FORMULA_REVIEWED, operation_type="advance")
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    if row.processing_status == ProcessingStatus.PENDING:
        row.processing_status = ProcessingStatus.REVIEWING

    row.updated_at = datetime.utcnow()
    db.flush()

    reason = f"补看旧公式截图{f'，备注：{note}' if note else ''}"
    repair = _record_repair(
        db=db, row=row, phase=ImportPhase.OLD_FORMULA_REVIEWED,
        action_type="old_formula_review",
        change_reason=reason,
        changed_by=changed_by,
        next_action_owner=_next_owner_after(row),
        old_formula_screenshot_ref=screenshot_ref,
        counterexample_note=note,
        original_value_before=row.original_value,
        original_value_after=row.original_value,
        interpolated_value_before=row.interpolated_value,
        interpolated_value_after=row.interpolated_value,
        threshold_before=row.threshold,
        threshold_after=row.threshold,
    )

    _record_audit(
        db=db, row_id=row_id, original_row_number=row.original_row_number,
        field_name="old_formula_screenshot_ref", old_value=None, new_value=screenshot_ref,
        change_reason=reason, changed_by=changed_by,
    )

    _refresh_workflow_counts(db, import_batch_id)
    _determine_phase_after_action(db, import_batch_id, "old_formula_review")
    db.commit()
    db.refresh(repair)
    return RepairRecordResponse.from_orm_with_bool(repair)


def update_counterexample(
    db: Session,
    import_batch_id: str,
    row_id: int,
    counterexample_note: str,
    changed_by: str = "analyst_qi",
) -> RepairRecordResponse:
    _check_phase_allowed(db, import_batch_id, ImportPhase.COUNTEREXAMPLE_UPDATED, operation_type="advance")
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    is_boundary = row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD
    if is_boundary:
        row.processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
        reason_prefix = "反例列表更新，边界值等于阈值，留待任课老师复核"
        next_owner = "instructor"
    else:
        row.processing_status = ProcessingStatus.CONFIRMED
        reason_prefix = "反例列表更新，无边界问题"
        next_owner = None
    row.updated_at = datetime.utcnow()
    db.flush()

    repair = _record_repair(
        db=db, row=row, phase=ImportPhase.COUNTEREXAMPLE_UPDATED,
        action_type="counterexample_update",
        change_reason=f"{reason_prefix}：{counterexample_note}",
        changed_by=changed_by,
        next_action_owner=next_owner,
        counterexample_note=counterexample_note,
        original_value_before=row.original_value,
        original_value_after=row.original_value,
        interpolated_value_before=row.interpolated_value,
        interpolated_value_after=row.interpolated_value,
        threshold_before=row.threshold,
        threshold_after=row.threshold,
        instructor_reviewed=0 if is_boundary else 1,
    )

    _record_audit(
        db=db, row_id=row_id, original_row_number=row.original_row_number,
        field_name="counterexample_note", old_value=None, new_value=counterexample_note,
        change_reason=f"{reason_prefix}：{counterexample_note}", changed_by=changed_by,
    )

    _refresh_workflow_counts(db, import_batch_id)
    _determine_phase_after_action(db, import_batch_id, "counterexample_update")
    db.commit()
    db.refresh(repair)
    return RepairRecordResponse.from_orm_with_bool(repair)


def manual_override(
    db: Session,
    row_id: int,
    field_name: str,
    new_value: str,
    change_reason: str,
    changed_by: str = "analyst_qi",
) -> AuditTrailResponse:
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")
    _check_phase_allowed(db, row.import_batch_id, ImportPhase.OLD_FORMULA_REVIEWED, operation_type="modify")

    old_val_raw = getattr(row, field_name, None)
    old_val = str(old_val_raw) if old_val_raw is not None else None

    recompute_snapshot = None
    if field_name in ("original_value", "threshold"):
        try:
            if field_name == "original_value":
                new_float = float(new_value) if new_value != "" else None
                recompute_snapshot = _recompute_value_and_status(row, new_original_value=new_float)
            elif field_name == "threshold":
                new_float = float(new_value) if new_value != "" else None
                recompute_snapshot = _recompute_value_and_status(row, new_original_value=row.original_value, new_threshold=new_float)
        except ValueError:
            setattr(row, field_name, new_value)
    else:
        setattr(row, field_name, new_value)

    if field_name in ("original_value", "threshold") and row.boundary_judgment is not None:
        if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD and \
           row.processing_status != ProcessingStatus.ROLLED_BACK:
            row.processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
        elif row.boundary_judgment != BoundaryJudgment.EQUAL_THRESHOLD and \
             row.processing_status in (
                 ProcessingStatus.BOUNDARY_PENDING_REVIEW,
                 ProcessingStatus.REVIEWING,
                 ProcessingStatus.PENDING,
             ):
            row.processing_status = ProcessingStatus.CONFIRMED

    row.updated_at = datetime.utcnow()
    db.flush()

    if recompute_snapshot is not None:
        phase = ImportPhase.COUNTEREXAMPLE_UPDATED
        _record_repair(
            db=db, row=row, phase=phase,
            action_type=f"manual_override:{field_name}",
            change_reason=change_reason,
            changed_by=changed_by,
            next_action_owner=_next_owner_after(row),
            interpolated_curve_data=recompute_snapshot["interpolated_curve_data"],
            original_value_before=recompute_snapshot["original_value_before"],
            original_value_after=recompute_snapshot["original_value_after"],
            interpolated_value_before=recompute_snapshot["interpolated_value_before"],
            interpolated_value_after=recompute_snapshot["interpolated_value_after"],
            threshold_before=recompute_snapshot["threshold_before"],
            threshold_after=recompute_snapshot["threshold_after"],
            instructor_reviewed=0 if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD else 1,
        )

    trail = _record_audit(
        db=db, row_id=row_id, original_row_number=row.original_row_number,
        field_name=field_name, old_value=old_val, new_value=new_value,
        change_reason=change_reason, changed_by=changed_by,
    )

    _refresh_workflow_counts(db, row.import_batch_id)
    db.commit()
    db.refresh(trail)
    return AuditTrailResponse.model_validate(trail)


def review_boundary(
    db: Session,
    row_id: int,
    confirmed_normal: bool,
    reviewer: str = "instructor",
    reason: Optional[str] = None,
) -> WeightRowResponse:
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")
    if row.boundary_judgment != BoundaryJudgment.EQUAL_THRESHOLD:
        raise ValueError(f"row_id={row_id} 非边界等于阈值，无需复核")
    _check_phase_allowed(db, row.import_batch_id, ImportPhase.COUNTEREXAMPLE_UPDATED, operation_type="modify")

    old_status = row.processing_status
    reason_text = f"任课老师复核：{'确认正常' if confirmed_normal else '继续审核'}{f'，理由：{reason}' if reason else ''}"

    if confirmed_normal:
        row.processing_status = ProcessingStatus.CONFIRMED
        next_owner = None
    else:
        row.processing_status = ProcessingStatus.REVIEWING
        next_owner = "analyst_qi"
    row.updated_at = datetime.utcnow()
    db.flush()

    _record_repair(
        db=db, row=row, phase=ImportPhase.COUNTEREXAMPLE_UPDATED,
        action_type="boundary_instructor_review",
        change_reason=reason_text,
        changed_by=reviewer,
        next_action_owner=next_owner,
        original_value_before=row.original_value,
        original_value_after=row.original_value,
        interpolated_value_before=row.interpolated_value,
        interpolated_value_after=row.interpolated_value,
        threshold_before=row.threshold,
        threshold_after=row.threshold,
        instructor_reviewed=1 if confirmed_normal else 0,
    )

    _record_audit(
        db=db, row_id=row_id, original_row_number=row.original_row_number,
        field_name="processing_status",
        old_value=old_status.value if old_status else None,
        new_value=row.processing_status.value,
        change_reason=reason_text, changed_by=reviewer,
    )

    _refresh_workflow_counts(db, row.import_batch_id)
    db.commit()
    db.refresh(row)
    return WeightRowResponse.model_validate(row)


def rollback_row(
    db: Session,
    row_id: int,
    rollback_reason: str,
    changed_by: str = "analyst_qi",
) -> WeightRowResponse:
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")
    _check_phase_allowed(db, row.import_batch_id, ImportPhase.OLD_FORMULA_REVIEWED, operation_type="modify")

    old_status = row.processing_status
    row.processing_status = ProcessingStatus.ROLLED_BACK
    row.updated_at = datetime.utcnow()
    db.flush()

    _record_repair(
        db=db, row=row, phase=ImportPhase.COUNTEREXAMPLE_UPDATED,
        action_type="rollback",
        change_reason=f"回滚：{rollback_reason}",
        changed_by=changed_by,
        next_action_owner="analyst_qi",
        rollback_reason=rollback_reason,
        original_value_before=row.original_value,
        original_value_after=row.original_value,
        interpolated_value_before=row.interpolated_value,
        interpolated_value_after=row.interpolated_value,
        threshold_before=row.threshold,
        threshold_after=row.threshold,
    )

    _record_audit(
        db=db, row_id=row_id, original_row_number=row.original_row_number,
        field_name="processing_status",
        old_value=old_status.value if old_status else None,
        new_value=ProcessingStatus.ROLLED_BACK.value,
        change_reason=f"回滚：{rollback_reason}", changed_by=changed_by,
    )

    _refresh_workflow_counts(db, row.import_batch_id)
    db.commit()
    db.refresh(row)
    return WeightRowResponse.model_validate(row)


def _quick_fix_impl(
    db: Session,
    row_id: int,
    error_type: ErrorType,
    fix_value: Optional[float],
    fix_reason: str,
    changed_by: str,
    action_type: str,
) -> WeightRowResponse:
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")
    _check_phase_allowed(db, row.import_batch_id, ImportPhase.OLD_FORMULA_REVIEWED, operation_type="modify")

    snap = _recompute_value_and_status(row, new_original_value=fix_value)

    if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD:
        row.processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
    else:
        row.processing_status = ProcessingStatus.CONFIRMED
    row.error_type = error_type
    row.updated_at = datetime.utcnow()
    db.flush()

    _record_repair(
        db=db, row=row, phase=ImportPhase.COUNTEREXAMPLE_UPDATED,
        action_type=action_type,
        change_reason=f"{action_type}: {fix_reason}",
        changed_by=changed_by,
        next_action_owner=_next_owner_after(row),
        interpolated_curve_data=snap["interpolated_curve_data"],
        original_value_before=snap["original_value_before"],
        original_value_after=snap["original_value_after"],
        interpolated_value_before=snap["interpolated_value_before"],
        interpolated_value_after=snap["interpolated_value_after"],
        threshold_before=snap["threshold_before"],
        threshold_after=snap["threshold_after"],
        instructor_reviewed=0 if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD else 1,
    )

    _record_audit(
        db=db, row_id=row_id, original_row_number=row.original_row_number,
        field_name="original_value",
        old_value=str(snap["original_value_before"]) if snap["original_value_before"] is not None else None,
        new_value=str(snap["original_value_after"]) if snap["original_value_after"] is not None else None,
        change_reason=f"{action_type}: {fix_reason}", changed_by=changed_by,
    )

    _refresh_workflow_counts(db, row.import_batch_id)
    db.commit()
    db.refresh(row)
    return WeightRowResponse.model_validate(row)


def quick_fix_wrong_caliber(
    db: Session, row_id: int, fix_value: Optional[float],
    fix_reason: str, changed_by: str = "analyst_qi",
) -> WeightRowResponse:
    return _quick_fix_impl(db, row_id, ErrorType.WRONG_CALIBER, fix_value, fix_reason, changed_by, "quick_fix_wrong_caliber")


def quick_fix_supplementary_rework(
    db: Session, row_id: int, fix_value: Optional[float],
    fix_reason: str, changed_by: str = "analyst_qi",
) -> WeightRowResponse:
    return _quick_fix_impl(db, row_id, ErrorType.SUPPLEMENTARY_REWORK, fix_value, fix_reason, changed_by, "quick_fix_supplementary_rework")


def get_export_detail(db: Session, row_id: int) -> ExportDetailResponse:
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    audit_trails = db.query(AuditTrail).filter(AuditTrail.row_id == row_id).order_by(AuditTrail.changed_at).all()
    repair_records = db.query(RepairRecord).filter(RepairRecord.row_id == row_id).order_by(RepairRecord.created_at).all()

    return ExportDetailResponse(
        row=WeightRowResponse.model_validate(row),
        audit_trails=[AuditTrailResponse.model_validate(t) for t in audit_trails],
        repair_records=[RepairRecordResponse.from_orm_with_bool(r) for r in repair_records],
    )


def get_batch_export_details(db: Session, import_batch_id: str) -> List[ExportDetailResponse]:
    rows = db.query(ScoringWeightRow).filter(ScoringWeightRow.import_batch_id == import_batch_id).all()
    return [get_export_detail(db, r.id) for r in rows]


def get_workflow_state(db: Session, import_batch_id: str) -> Optional[WorkflowStateResponse]:
    workflow = _refresh_workflow_counts(db, import_batch_id)
    db.commit()
    db.refresh(workflow)
    return WorkflowStateResponse.model_validate(workflow)


def list_boundary_pending_review(db: Session, import_batch_id: str) -> List[WeightRowResponse]:
    rows = db.query(ScoringWeightRow).filter(
        ScoringWeightRow.import_batch_id == import_batch_id,
        ScoringWeightRow.processing_status == ProcessingStatus.BOUNDARY_PENDING_REVIEW,
    ).all()
    return [WeightRowResponse.model_validate(r) for r in rows]


def get_batch_summary(db: Session, import_batch_id: str) -> BatchSummaryResponse:
    """
    批次摘要（列表/详情/导出之外的统一汇总视图，与 detail/batch 读取同一份数据）
    """
    workflow = _refresh_workflow_counts(db, import_batch_id)
    rows = db.query(ScoringWeightRow).filter(ScoringWeightRow.import_batch_id == import_batch_id).all()

    counts = {s: 0 for s in ProcessingStatus}
    for r in rows:
        counts[r.processing_status] = counts.get(r.processing_status, 0) + 1

    db.commit()
    db.refresh(workflow)
    return BatchSummaryResponse(
        import_batch_id=workflow.import_batch_id,
        current_phase=workflow.current_phase,
        total_rows=workflow.total_rows,
        boundary_equal_threshold_count=workflow.boundary_equal_threshold_count,
        wrong_caliber_count=workflow.wrong_caliber_count,
        supplementary_rework_count=workflow.supplementary_rework_count,
        pending_count=counts.get(ProcessingStatus.PENDING, 0),
        reviewing_count=counts.get(ProcessingStatus.REVIEWING, 0),
        boundary_pending_review_count=counts.get(ProcessingStatus.BOUNDARY_PENDING_REVIEW, 0),
        confirmed_count=counts.get(ProcessingStatus.CONFIRMED, 0),
        rolled_back_count=counts.get(ProcessingStatus.ROLLED_BACK, 0),
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


def export_batch_json(db: Session, import_batch_id: str) -> dict:
    """
    导出批次全部明细为 JSON（读取同一份最新数据）。
    """
    _check_phase_allowed(db, import_batch_id, ImportPhase.COUNTEREXAMPLE_UPDATED, operation_type="modify")
    details = get_batch_export_details(db, import_batch_id)
    summary = get_batch_summary(db, import_batch_id)
    workflow = get_workflow_state(db, import_batch_id)
    return {
        "export_metadata": {
            "export_at": datetime.utcnow().isoformat() + "Z",
            "import_batch_id": import_batch_id,
            "export_source": "single_source_of_truth (ScoringWeightRow + AuditTrail + RepairRecord)",
        },
        "summary": summary.model_dump(),
        "workflow": workflow.model_dump() if workflow else None,
        "details": [d.model_dump() for d in details],
    }


def export_batch_csv(db: Session, import_batch_id: str) -> str:
    """
    导出批次全部明细为 CSV（读取同一份最新数据）。
    包含：行数据 + 最新修补记录摘要 + 处理状态 + 下一步找谁。
    """
    _check_phase_allowed(db, import_batch_id, ImportPhase.COUNTEREXAMPLE_UPDATED, operation_type="modify")
    details = get_batch_export_details(db, import_batch_id)
    summary = get_batch_summary(db, import_batch_id)

    headers = [
        "batch_id", "original_row_number", "indicator_name", "threshold", "weight",
        "original_value", "interpolated_value", "boundary_judgment", "processing_status",
        "error_type", "next_action_owner", "instructor_reviewed",
        "latest_repair_action", "latest_change_reason", "latest_repair_at",
        "original_value_before", "original_value_after", "interpolated_value_before", "interpolated_value_after",
        "old_formula_screenshot_ref", "counterexample_note", "rollback_reason",
        "row_created_at", "row_updated_at",
    ]

    lines = [",".join(headers)]
    for d in details:
        row = d.row
        latest_rr = d.repair_records[-1] if d.repair_records else None
        fields = [
            import_batch_id,
            str(row.original_row_number),
            row.indicator_name,
            f"{row.threshold}",
            f"{row.weight}",
            f"{row.original_value}" if row.original_value is not None else "",
            f"{row.interpolated_value}" if row.interpolated_value is not None else "",
            row.boundary_judgment.value if row.boundary_judgment else "",
            row.processing_status.value,
            row.error_type.value if row.error_type else "",
            latest_rr.next_action_owner if latest_rr and latest_rr.next_action_owner else "",
            "1" if latest_rr and latest_rr.instructor_reviewed else "0",
            latest_rr.action_type if latest_rr and latest_rr.action_type else "",
            (latest_rr.change_reason if latest_rr and latest_rr.change_reason else "").replace(",", "，").replace("\n", " "),
            latest_rr.created_at.isoformat() if latest_rr else "",
            f"{latest_rr.original_value_before}" if latest_rr and latest_rr.original_value_before is not None else "",
            f"{latest_rr.original_value_after}" if latest_rr and latest_rr.original_value_after is not None else "",
            f"{latest_rr.interpolated_value_before}" if latest_rr and latest_rr.interpolated_value_before is not None else "",
            f"{latest_rr.interpolated_value_after}" if latest_rr and latest_rr.interpolated_value_after is not None else "",
            latest_rr.old_formula_screenshot_ref if latest_rr and latest_rr.old_formula_screenshot_ref else "",
            (latest_rr.counterexample_note if latest_rr and latest_rr.counterexample_note else "").replace(",", "，").replace("\n", " "),
            (latest_rr.rollback_reason if latest_rr and latest_rr.rollback_reason else "").replace(",", "，").replace("\n", " "),
            row.created_at.isoformat(),
            row.updated_at.isoformat(),
        ]
        lines.append(",".join(fields))

    # 末尾追加摘要信息
    lines.append("")
    lines.append("=== BATCH SUMMARY (同一份数据源生成) ===")
    lines.append(f"current_phase,{summary.current_phase.value}")
    lines.append(f"total_rows,{summary.total_rows}")
    lines.append(f"boundary_equal_threshold_count,{summary.boundary_equal_threshold_count}")
    lines.append(f"wrong_caliber_count,{summary.wrong_caliber_count}")
    lines.append(f"supplementary_rework_count,{summary.supplementary_rework_count}")
    lines.append(f"pending_count,{summary.pending_count}")
    lines.append(f"reviewing_count,{summary.reviewing_count}")
    lines.append(f"boundary_pending_review_count,{summary.boundary_pending_review_count}")
    lines.append(f"confirmed_count,{summary.confirmed_count}")
    lines.append(f"rolled_back_count,{summary.rolled_back_count}")
    lines.append(f"export_at,{datetime.utcnow().isoformat()}Z")

    return "\n".join(lines)
