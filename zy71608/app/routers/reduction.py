from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import ReductionApplication, StoreClosureProof, SupplementaryAgreement
from app.schemas.reduction import (
    ReductionApplicationCreate,
    ReductionApplicationUpdate,
    ReductionApplicationInfo,
    ReductionTrialCalcRequest,
    ReductionTrialCalcResult,
    AnomalyFlagInfo,
    AnomalyResolveRequest,
    StoreClosureProofCreate,
    StoreClosureProofUpdate,
    StoreClosureProofInfo,
    SupplementaryAgreementCreate,
    SupplementaryAgreementUpdate,
    SupplementaryAgreementInfo,
)
from app.schemas.common import ResponseModel, PaginatedResponse, AuditLogInfo
from app.services.calculation_service import CalculationService
from app.services.anomaly_service import AnomalyService
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService
from app.models import OperationType

router = APIRouter(prefix="/reductions", tags=["减免申请"])


@router.get("", response_model=PaginatedResponse[ReductionApplicationInfo])
def get_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    has_anomaly: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ReductionApplication).filter(ReductionApplication.is_active == True)

    if keyword:
        query = query.filter(
            or_(
                ReductionApplication.application_no.like(f"%{keyword}%"),
                ReductionApplication.tenant_name.like(f"%{keyword}%"),
                ReductionApplication.store_code.like(f"%{keyword}%"),
            )
        )
    if status:
        query = query.filter(ReductionApplication.status == status)
    if start_date:
        query = query.filter(ReductionApplication.closure_start_date >= start_date)
    if end_date:
        query = query.filter(ReductionApplication.closure_end_date <= end_date)
    if has_anomaly is not None:
        query = query.filter(ReductionApplication.has_anomaly == has_anomaly)

    total = query.count()
    applications = query.order_by(ReductionApplication.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        data=[ReductionApplicationInfo.model_validate(a) for a in applications],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{application_id}", response_model=ResponseModel[ReductionApplicationInfo])
def get_application(application_id: int, db: Session = Depends(get_db)):
    application = db.query(ReductionApplication).filter(ReductionApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"减免申请 {application_id} 不存在")
    return ResponseModel(data=ReductionApplicationInfo.model_validate(application))


@router.post("", response_model=ResponseModel[ReductionApplicationInfo])
def create_application(
    application_data: ReductionApplicationCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    existing = db.query(ReductionApplication).filter(
        ReductionApplication.application_no == application_data.application_no
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail=f"申请编号 {application_data.application_no} 已存在")

    application = ReductionApplication(
        **application_data.model_dump(),
        created_by=operator,
        updated_by=operator,
    )
    db.add(application)
    db.flush()

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.CREATE.value,
        operator=operator,
        table_name="reduction_applications",
        record_id=application.id,
        new_values=application_data.model_dump(mode="json"),
        change_reason="创建减免申请",
        application_id=application.id,
    )

    db.commit()
    db.refresh(application)

    return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="减免申请创建成功")


@router.put("/{application_id}", response_model=ResponseModel[ReductionApplicationInfo])
def update_application(
    application_id: int,
    update_data: ReductionApplicationUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    application = db.query(ReductionApplication).filter(ReductionApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"减免申请 {application_id} 不存在")

    old_values = {c.name: getattr(application, c.name) for c in ReductionApplication.__table__.columns}

    update_dict = update_data.model_dump(exclude_unset=True)

    changed_fields = {}
    for field, value in update_dict.items():
        old_value = getattr(application, field)
        if old_value != value:
            changed_fields[field] = {"old": old_value, "new": value}
            setattr(application, field, value)

    if changed_fields:
        application.manual_override = True
        application.manual_override_by = operator
        if update_data.manual_override_reason:
            application.manual_override_reason = update_data.manual_override_reason
        else:
            application.manual_override_reason = f"修改字段: {', '.join(changed_fields.keys())}"

        application.updated_by = operator

        audit_service = AuditService(db)
        audit_service.log_manual_override(
            application_id=application_id,
            old_values={k: str(v["old"]) for k, v in changed_fields.items()},
            new_values={k: str(v["new"]) for k, v in changed_fields.items()},
            operator=operator,
            reason=application.manual_override_reason,
        )

    db.commit()
    db.refresh(application)

    return ResponseModel(data=ReductionApplicationInfo.model_validate(application), message="减免申请更新成功")


@router.delete("/{application_id}", response_model=ResponseModel)
def delete_application(
    application_id: int,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    application = db.query(ReductionApplication).filter(ReductionApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"减免申请 {application_id} 不存在")

    application.is_active = False
    application.updated_by = operator

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.DELETE.value,
        operator=operator,
        table_name="reduction_applications",
        record_id=application_id,
        change_reason=f"删除减免申请 {application.application_no}",
        application_id=application_id,
    )

    db.commit()

    return ResponseModel(message="减免申请删除成功")


@router.post("/{application_id}/calculate", response_model=ResponseModel[ReductionTrialCalcResult])
def calculate_reduction(
    application_id: int,
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db),
):
    calc_service = CalculationService(db)
    try:
        result = calc_service.calculate_reduction(application_id, operator)
        return ResponseModel(data=result, message="减免试算完成")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{application_id}/calculation-history", response_model=ResponseModel[List[dict]])
def get_calculation_history(application_id: int, db: Session = Depends(get_db)):
    calc_service = CalculationService(db)
    history = calc_service.get_calculation_history(application_id)
    return ResponseModel(data=history)


@router.post("/{application_id}/recalculate", response_model=ResponseModel[ReductionTrialCalcResult])
def recalculate_with_override(
    application_id: int,
    override_fields: dict = Body(..., description="覆盖的字段"),
    reason: str = Body(..., description="修改原因"),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db),
):
    calc_service = CalculationService(db)
    try:
        result = calc_service.recalculate_with_override(
            application_id, override_fields, operator, reason
        )
        return ResponseModel(data=result, message="人工修改后重新计算完成")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{application_id}/detect-anomalies", response_model=ResponseModel[dict])
def detect_anomalies(
    application_id: int,
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db),
):
    anomaly_service = AnomalyService(db)
    try:
        anomalies = anomaly_service.detect_all_anomalies(application_id)
        result = {
            "anomalies": [AnomalyFlagInfo.model_validate(a).model_dump() for a in anomalies],
            "count": len(anomalies)
        }
        return ResponseModel(data=result, message=f"异常检测完成，共发现{len(anomalies)}个异常")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{application_id}/anomalies", response_model=ResponseModel[List[AnomalyFlagInfo]])
def get_application_anomalies(
    application_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    anomaly_service = AnomalyService(db)
    anomalies = anomaly_service.get_application_anomalies(application_id, status)
    return ResponseModel(data=[AnomalyFlagInfo.model_validate(a) for a in anomalies])


@router.post("/anomalies/{anomaly_id}/resolve", response_model=ResponseModel[AnomalyFlagInfo])
def resolve_anomaly(
    anomaly_id: int,
    resolve_data: AnomalyResolveRequest,
    db: Session = Depends(get_db),
):
    anomaly_service = AnomalyService(db)
    anomaly = anomaly_service.resolve_anomaly(
        anomaly_id=anomaly_id,
        resolution=resolve_data.resolution,
        resolved_by=resolve_data.resolved_by,
        new_value=resolve_data.new_value,
        status=resolve_data.status,
    )

    if not anomaly:
        raise HTTPException(status_code=404, detail=f"异常记录 {anomaly_id} 不存在")

    return ResponseModel(data=AnomalyFlagInfo.model_validate(anomaly), message="异常处理完成")


@router.post("/anomalies/{anomaly_id}/acknowledge", response_model=ResponseModel[AnomalyFlagInfo])
def acknowledge_anomaly(
    anomaly_id: int,
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db),
):
    anomaly_service = AnomalyService(db)
    anomaly = anomaly_service.acknowledge_anomaly(anomaly_id, operator)

    if not anomaly:
        raise HTTPException(status_code=404, detail=f"异常记录 {anomaly_id} 不存在")

    return ResponseModel(data=AnomalyFlagInfo.model_validate(anomaly), message="异常已确认")


@router.post("/anomalies/{anomaly_id}/ignore", response_model=ResponseModel[AnomalyFlagInfo])
def ignore_anomaly(
    anomaly_id: int,
    reason: str = Body(..., description="忽略原因"),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db),
):
    anomaly_service = AnomalyService(db)
    anomaly = anomaly_service.ignore_anomaly(anomaly_id, operator, reason)

    if not anomaly:
        raise HTTPException(status_code=404, detail=f"异常记录 {anomaly_id} 不存在")

    return ResponseModel(data=AnomalyFlagInfo.model_validate(anomaly), message="异常已忽略")


@router.get("/{application_id}/closure-proofs", response_model=ResponseModel[List[StoreClosureProofInfo]])
def get_closure_proofs(application_id: int, db: Session = Depends(get_db)):
    application = db.query(ReductionApplication).filter(ReductionApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"减免申请 {application_id} 不存在")

    proofs = db.query(StoreClosureProof).filter(StoreClosureProof.application_id == application_id).all()
    return ResponseModel(data=[StoreClosureProofInfo.model_validate(p) for p in proofs])


@router.post("/{application_id}/closure-proofs", response_model=ResponseModel[StoreClosureProofInfo])
def create_closure_proof(
    application_id: int,
    proof_data: StoreClosureProofCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    application = db.query(ReductionApplication).filter(ReductionApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"减免申请 {application_id} 不存在")

    proof = StoreClosureProof(**proof_data.model_dump(), created_by=operator, updated_by=operator)
    db.add(proof)
    db.flush()

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.CREATE.value,
        operator=operator,
        table_name="store_closure_proofs",
        record_id=proof.id,
        new_values=proof_data.model_dump(mode="json"),
        change_reason="添加闭店证明",
        application_id=application_id,
    )

    db.commit()
    db.refresh(proof)

    return ResponseModel(data=StoreClosureProofInfo.model_validate(proof), message="闭店证明添加成功")


@router.put("/closure-proofs/{proof_id}", response_model=ResponseModel[StoreClosureProofInfo])
def update_closure_proof(
    proof_id: int,
    update_data: StoreClosureProofUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    proof = db.query(StoreClosureProof).filter(StoreClosureProof.id == proof_id).first()
    if not proof:
        raise HTTPException(status_code=404, detail=f"闭店证明 {proof_id} 不存在")

    old_values = {c.name: getattr(proof, c.name) for c in StoreClosureProof.__table__.columns}

    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(proof, field, value)

    proof.updated_by = operator

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.UPDATE.value,
        operator=operator,
        table_name="store_closure_proofs",
        record_id=proof_id,
        old_values=old_values,
        new_values=update_dict,
        change_reason="更新闭店证明",
        application_id=proof.application_id,
    )

    db.commit()
    db.refresh(proof)

    return ResponseModel(data=StoreClosureProofInfo.model_validate(proof), message="闭店证明更新成功")


@router.get("/{application_id}/supplementary-agreements", response_model=ResponseModel[List[SupplementaryAgreementInfo]])
def get_supplementary_agreements(application_id: int, db: Session = Depends(get_db)):
    application = db.query(ReductionApplication).filter(ReductionApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"减免申请 {application_id} 不存在")

    agreements = db.query(SupplementaryAgreement).filter(
        SupplementaryAgreement.application_id == application_id
    ).all()

    return ResponseModel(data=[SupplementaryAgreementInfo.model_validate(a) for a in agreements])


@router.post("/{application_id}/supplementary-agreements", response_model=ResponseModel[SupplementaryAgreementInfo])
def create_supplementary_agreement(
    application_id: int,
    agreement_data: SupplementaryAgreementCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    application = db.query(ReductionApplication).filter(ReductionApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"减免申请 {application_id} 不存在")

    existing = db.query(SupplementaryAgreement).filter(
        SupplementaryAgreement.agreement_no == agreement_data.agreement_no
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"补充协议编号 {agreement_data.agreement_no} 已存在")

    agreement = SupplementaryAgreement(**agreement_data.model_dump(), created_by=operator, updated_by=operator)
    db.add(agreement)
    db.flush()

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.CREATE.value,
        operator=operator,
        table_name="supplementary_agreements",
        record_id=agreement.id,
        new_values=agreement_data.model_dump(mode="json"),
        change_reason="添加补充协议",
        application_id=application_id,
    )

    db.commit()
    db.refresh(agreement)

    return ResponseModel(data=SupplementaryAgreementInfo.model_validate(agreement), message="补充协议添加成功")


@router.put("/supplementary-agreements/{agreement_id}", response_model=ResponseModel[SupplementaryAgreementInfo])
def update_supplementary_agreement(
    agreement_id: int,
    update_data: SupplementaryAgreementUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    agreement = db.query(SupplementaryAgreement).filter(SupplementaryAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail=f"补充协议 {agreement_id} 不存在")

    old_values = {c.name: getattr(agreement, c.name) for c in SupplementaryAgreement.__table__.columns}

    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(agreement, field, value)

    agreement.updated_by = operator

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.UPDATE.value,
        operator=operator,
        table_name="supplementary_agreements",
        record_id=agreement_id,
        old_values=old_values,
        new_values=update_dict,
        change_reason="更新补充协议",
        application_id=agreement.application_id,
    )

    db.commit()
    db.refresh(agreement)

    return ResponseModel(data=SupplementaryAgreementInfo.model_validate(agreement), message="补充协议更新成功")


@router.get("/{application_id}/audit-logs", response_model=ResponseModel[List[AuditLogInfo]])
def get_application_audit_logs(
    application_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    application = db.query(ReductionApplication).filter(ReductionApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail=f"减免申请 {application_id} 不存在")

    audit_service = AuditService(db)
    logs = audit_service.get_application_audit_logs(application_id, skip, limit)

    return ResponseModel(data=logs)


@router.get("/{application_id}/field-history", response_model=ResponseModel[List[dict]])
def get_field_modification_history(
    application_id: int,
    field_name: str = Query(..., description="字段名"),
    db: Session = Depends(get_db),
):
    audit_service = AuditService(db)
    history = audit_service.get_field_modification_history(application_id, field_name)
    return ResponseModel(data=history)


@router.get("/{application_id}/compare-versions", response_model=ResponseModel[dict])
def compare_versions(
    application_id: int,
    version_1_log_id: int = Query(..., description="版本1的日志ID"),
    version_2_log_id: int = Query(..., description="版本2的日志ID"),
    db: Session = Depends(get_db),
):
    audit_service = AuditService(db)
    result = audit_service.compare_versions(application_id, version_1_log_id, version_2_log_id)
    return ResponseModel(data=result)
