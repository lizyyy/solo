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
)
from interpolation_gauge.services.interpolation import judge_boundary, piecewise_linear_interpolate


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


def import_weight_table(db: Session, rows: List[WeightRowImportItem]) -> WorkflowStateResponse:
    """
    第一步：评分权重表导入。
    对每一行执行边界值判定，等于阈值时标记 boundary_pending_review。
    """
    batch_id = str(uuid.uuid4())[:8]
    boundary_count = 0
    created_rows = []

    for item in rows:
        boundary_judgment = None
        processing_status = ProcessingStatus.PENDING
        interpolated_value = None

        if item.original_value is not None:
            boundary_judgment = judge_boundary(item.original_value, item.threshold)
            if boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD:
                processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
                boundary_count += 1

            default_breakpoints = [
                (0.0, 0.0),
                (item.threshold * 0.5, 0.5),
                (item.threshold, 1.0),
                (item.threshold * 1.5, 1.5),
            ]
            interpolated_value = piecewise_linear_interpolate(item.original_value, default_breakpoints)

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
        created_rows.append(row)

        _record_audit(
            db=db,
            row_id=row.id,
            original_row_number=row.original_row_number,
            field_name="import",
            old_value=None,
            new_value=f"row={item.original_row_number}, indicator={item.indicator_name}",
            change_reason="评分权重表首次导入",
        )

        repair = RepairRecord(
            row_id=row.id,
            import_batch_id=batch_id,
            phase=ImportPhase.WEIGHT_TABLE_IMPORTED,
            boundary_judgment=boundary_judgment,
            interpolated_curve_data={"breakpoints_used": "default"},
            is_boundary_equal_threshold=1 if boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD else 0,
        )
        db.add(repair)

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
    """
    第二步：数据分析师小祁补看旧公式截图。
    在修补记录中留下截图引用和备注，审计轨迹记录操作。
    """
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    repair = RepairRecord(
        row_id=row_id,
        import_batch_id=import_batch_id,
        phase=ImportPhase.OLD_FORMULA_REVIEWED,
        boundary_judgment=row.boundary_judgment,
        old_formula_screenshot_ref=screenshot_ref,
        is_boundary_equal_threshold=1 if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD else 0,
        counterexample_note=note,
    )
    db.add(repair)

    if row.processing_status == ProcessingStatus.PENDING:
        row.processing_status = ProcessingStatus.REVIEWING
        row.updated_at = datetime.utcnow()

    _record_audit(
        db=db,
        row_id=row_id,
        original_row_number=row.original_row_number,
        field_name="old_formula_screenshot_ref",
        old_value=None,
        new_value=screenshot_ref,
        change_reason=f"补看旧公式截图{f'，备注：{note}' if note else ''}",
        changed_by=changed_by,
    )

    workflow = db.query(WorkflowState).filter(WorkflowState.import_batch_id == import_batch_id).first()
    if workflow and workflow.current_phase == ImportPhase.WEIGHT_TABLE_IMPORTED:
        workflow.current_phase = ImportPhase.OLD_FORMULA_REVIEWED
        workflow.updated_at = datetime.utcnow()

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
    """
    第三步：反例列表更新。
    如果该行边界值等于阈值，则 instructor_reviewed=0，等待任课老师复核。
    """
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    is_boundary = row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD

    repair = RepairRecord(
        row_id=row_id,
        import_batch_id=import_batch_id,
        phase=ImportPhase.COUNTEREXAMPLE_UPDATED,
        boundary_judgment=row.boundary_judgment,
        counterexample_note=counterexample_note,
        is_boundary_equal_threshold=1 if is_boundary else 0,
        instructor_reviewed=0 if is_boundary else 1,
    )
    db.add(repair)

    if is_boundary:
        row.processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
    else:
        row.processing_status = ProcessingStatus.CONFIRMED
    row.updated_at = datetime.utcnow()

    _record_audit(
        db=db,
        row_id=row_id,
        original_row_number=row.original_row_number,
        field_name="counterexample_note",
        old_value=None,
        new_value=counterexample_note,
        change_reason=f"反例列表更新{'，边界值等于阈值，留待任课老师复核' if is_boundary else ''}",
        changed_by=changed_by,
    )

    workflow = db.query(WorkflowState).filter(WorkflowState.import_batch_id == import_batch_id).first()
    if workflow and workflow.current_phase == ImportPhase.OLD_FORMULA_REVIEWED:
        workflow.current_phase = ImportPhase.COUNTEREXAMPLE_UPDATED
        workflow.updated_at = datetime.utcnow()

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
    """
    人工改动：修改某行某字段，记录审计轨迹。
    """
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    old_val = str(getattr(row, field_name, ""))
    setattr(row, field_name, new_value)

    if field_name == "original_value" and row.threshold is not None:
        try:
            new_float = float(new_value)
            boundary_judgment = judge_boundary(new_float, row.threshold)
            row.boundary_judgment = boundary_judgment
            if boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD:
                row.processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
        except ValueError:
            pass

    row.updated_at = datetime.utcnow()
    db.flush()

    trail = _record_audit(
        db=db,
        row_id=row_id,
        original_row_number=row.original_row_number,
        field_name=field_name,
        old_value=old_val,
        new_value=new_value,
        change_reason=change_reason,
        changed_by=changed_by,
    )
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
    """
    任课老师复核边界值等于阈值的记录。
    confirmed_normal=True → 归正常（CONFIRMED）
    confirmed_normal=False → 保持 BOUNDARY_PENDING_REVIEW 或回退
    """
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")
    if row.boundary_judgment != BoundaryJudgment.EQUAL_THRESHOLD:
        raise ValueError(f"row_id={row_id} 非边界等于阈值，无需复核")

    old_status = row.processing_status
    if confirmed_normal:
        row.processing_status = ProcessingStatus.CONFIRMED
        new_status = ProcessingStatus.CONFIRMED.value
    else:
        row.processing_status = ProcessingStatus.REVIEWING
        new_status = ProcessingStatus.REVIEWING.value

    row.updated_at = datetime.utcnow()

    repair = db.query(RepairRecord).filter(
        RepairRecord.row_id == row_id,
        RepairRecord.is_boundary_equal_threshold == 1,
        RepairRecord.instructor_reviewed == 0,
    ).first()
    if repair:
        repair.instructor_reviewed = 1 if confirmed_normal else 0

    _record_audit(
        db=db,
        row_id=row_id,
        original_row_number=row.original_row_number,
        field_name="processing_status",
        old_value=old_status.value if old_status else None,
        new_value=new_status,
        change_reason=f"任课老师复核：{'确认正常' if confirmed_normal else '继续审核'}{f'，理由：{reason}' if reason else ''}",
        changed_by=reviewer,
    )
    db.commit()
    db.refresh(row)
    return WeightRowResponse.model_validate(row)


def rollback_row(
    db: Session,
    row_id: int,
    rollback_reason: str,
    changed_by: str = "analyst_qi",
) -> WeightRowResponse:
    """
    回滚：将行状态标记为 ROLLED_BACK，审计轨迹记录回滚原因。
    """
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    old_status = row.processing_status
    row.processing_status = ProcessingStatus.ROLLED_BACK
    row.updated_at = datetime.utcnow()

    repair = RepairRecord(
        row_id=row_id,
        import_batch_id=row.import_batch_id,
        phase=ImportPhase.COUNTEREXAMPLE_UPDATED,
        boundary_judgment=row.boundary_judgment,
        rollback_reason=rollback_reason,
        is_boundary_equal_threshold=1 if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD else 0,
    )
    db.add(repair)

    _record_audit(
        db=db,
        row_id=row_id,
        original_row_number=row.original_row_number,
        field_name="processing_status",
        old_value=old_status.value if old_status else None,
        new_value=ProcessingStatus.ROLLED_BACK.value,
        change_reason=f"回滚：{rollback_reason}",
        changed_by=changed_by,
    )
    db.commit()
    db.refresh(row)
    return WeightRowResponse.model_validate(row)


def quick_fix_wrong_caliber(
    db: Session,
    row_id: int,
    fix_value: Optional[float],
    fix_reason: str,
    changed_by: str = "analyst_qi",
) -> WeightRowResponse:
    """
    常见错口径快捷修补：修正原始值并重新计算边界判定和插值。
    """
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    old_value = row.original_value
    if fix_value is not None:
        row.original_value = fix_value
        row.boundary_judgment = judge_boundary(fix_value, row.threshold)
        default_breakpoints = [
            (0.0, 0.0),
            (row.threshold * 0.5, 0.5),
            (row.threshold, 1.0),
            (row.threshold * 1.5, 1.5),
        ]
        row.interpolated_value = piecewise_linear_interpolate(fix_value, default_breakpoints)
        if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD:
            row.processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
        else:
            row.processing_status = ProcessingStatus.CONFIRMED

    row.error_type = ErrorType.WRONG_CALIBER
    row.updated_at = datetime.utcnow()

    _record_audit(
        db=db,
        row_id=row_id,
        original_row_number=row.original_row_number,
        field_name="original_value",
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(fix_value) if fix_value is not None else None,
        change_reason=f"错口径快捷修补：{fix_reason}",
        changed_by=changed_by,
    )
    db.commit()
    db.refresh(row)
    return WeightRowResponse.model_validate(row)


def quick_fix_supplementary_rework(
    db: Session,
    row_id: int,
    fix_value: Optional[float],
    fix_reason: str,
    changed_by: str = "analyst_qi",
) -> WeightRowResponse:
    """
    常见补录返工快捷修补。
    """
    row = db.query(ScoringWeightRow).filter(ScoringWeightRow.id == row_id).first()
    if not row:
        raise ValueError(f"row_id={row_id} 不存在")

    old_value = row.original_value
    if fix_value is not None:
        row.original_value = fix_value
        row.boundary_judgment = judge_boundary(fix_value, row.threshold)
        default_breakpoints = [
            (0.0, 0.0),
            (row.threshold * 0.5, 0.5),
            (row.threshold, 1.0),
            (row.threshold * 1.5, 1.5),
        ]
        row.interpolated_value = piecewise_linear_interpolate(fix_value, default_breakpoints)
        if row.boundary_judgment == BoundaryJudgment.EQUAL_THRESHOLD:
            row.processing_status = ProcessingStatus.BOUNDARY_PENDING_REVIEW
        else:
            row.processing_status = ProcessingStatus.CONFIRMED

    row.error_type = ErrorType.SUPPLEMENTARY_REWORK
    row.updated_at = datetime.utcnow()

    _record_audit(
        db=db,
        row_id=row_id,
        original_row_number=row.original_row_number,
        field_name="original_value",
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(fix_value) if fix_value is not None else None,
        change_reason=f"补录返工快捷修补：{fix_reason}",
        changed_by=changed_by,
    )
    db.commit()
    db.refresh(row)
    return WeightRowResponse.model_validate(row)


def get_export_detail(db: Session, row_id: int) -> ExportDetailResponse:
    """
    单数据源读取：导出明细、页面展示、接口返回都调用此方法。
    """
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
    """
    按批次导出所有行明细（单数据源）。
    """
    rows = db.query(ScoringWeightRow).filter(ScoringWeightRow.import_batch_id == import_batch_id).all()
    results = []
    for row in rows:
        results.append(get_export_detail(db, row.id))
    return results


def get_workflow_state(db: Session, import_batch_id: str) -> Optional[WorkflowStateResponse]:
    workflow = db.query(WorkflowState).filter(WorkflowState.import_batch_id == import_batch_id).first()
    if workflow:
        return WorkflowStateResponse.model_validate(workflow)
    return None


def list_boundary_pending_review(db: Session, import_batch_id: str) -> List[WeightRowResponse]:
    """
    列出所有边界值等于阈值、待任课老师复核的记录。
    """
    rows = db.query(ScoringWeightRow).filter(
        ScoringWeightRow.import_batch_id == import_batch_id,
        ScoringWeightRow.processing_status == ProcessingStatus.BOUNDARY_PENDING_REVIEW,
    ).all()
    return [WeightRowResponse.model_validate(r) for r in rows]
