from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Query,
    UploadFile,
    File,
    Form,
)
from sqlalchemy.orm import Session

from ..models import EstimationTask, TaskStatus, TaskStatusCategory
from ..schemas import (
    TaskCreate,
    TaskUpdate,
    TaskSummary,
    TaskDetailResponse,
    TaskStatusLogResponse,
    TaskStatusTransitionRequest,
    TaskStatusTransitionResponse,
    PaginationParams,
    PaginatedResponse,
    SuccessResponse,
    MeshAnalysisRequest,
    MeshAnalysisResponse,
    ModelFileUploadResponse,
    SupportEstimationRequest,
    SupportEstimationResponse,
    ParamsMergeRequest,
    ParamsMergeResponse,
    SliceParamsResponse,
    AnomalyResponse,
    AnomalyResolveRequest,
    EstimationReportRequest,
    EstimationReportResponse,
)
from ..api.deps import get_db_session, get_task
from ..services import (
    TaskService,
    StatusService,
    MeshService,
    EstimationService,
    ParamsService,
    AnomalyService,
    ReportService,
)
from ..models.enums import AnomalySeverity

router = APIRouter(prefix="/tasks", tags=["估算任务"])


@router.get("", response_model=SuccessResponse[PaginatedResponse[TaskSummary]])
def list_tasks(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: Optional[TaskStatus] = Query(None, description="按状态筛选"),
    status_category: Optional[TaskStatusCategory] = Query(None, description="按状态分类筛选"),
    student_id: Optional[int] = Query(None, description="按学生筛选"),
    search: Optional[str] = Query(None, description="搜索项目名称"),
    db: Session = Depends(get_db_session),
):
    pagination = PaginationParams(page=page, page_size=page_size)
    result = TaskService.list_tasks(
        db=db,
        pagination=pagination,
        status=status,
        status_category=status_category,
        student_id=student_id,
        search=search,
    )
    return SuccessResponse(data=result)


@router.post("", response_model=SuccessResponse[TaskDetailResponse], status_code=201)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db_session),
):
    task = TaskService.create_task(db, data)
    db.commit()
    db.refresh(task)
    detail = TaskService.get_task_detail(db, task)
    return SuccessResponse(data=detail)


@router.get("/{task_id}", response_model=SuccessResponse[TaskDetailResponse])
def get_task_detail(
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    detail = TaskService.get_task_detail(db, task)
    return SuccessResponse(data=detail)


@router.put("/{task_id}", response_model=SuccessResponse[TaskDetailResponse])
def update_task(
    data: TaskUpdate,
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    task = TaskService.update_task(db, task, data)
    db.commit()
    db.refresh(task)
    detail = TaskService.get_task_detail(db, task)
    return SuccessResponse(data=detail)


@router.delete("/{task_id}", response_model=SuccessResponse[dict])
def delete_task(
    task_id: int,
    db: Session = Depends(get_db_session),
):
    success = TaskService.delete_task(db, task_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 {task_id} 不存在",
        )
    db.commit()
    return SuccessResponse(data={"message": "删除成功"})


@router.get("/{task_id}/status-history", response_model=SuccessResponse[List[TaskStatusLogResponse]])
def get_status_history(
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    logs = StatusService.get_status_history(db, task.id)
    response = [
        TaskStatusLogResponse(
            id=log.id,
            task_id=log.task_id,
            previous_status=TaskStatus(log.previous_status) if log.previous_status else None,
            new_status=TaskStatus(log.new_status),
            message=log.message,
            triggered_by=log.triggered_by,
            metadata=log.meta_data or {},
            created_at=log.created_at,
            updated_at=log.updated_at,
        )
        for log in logs
    ]
    return SuccessResponse(data=response)


@router.post("/{task_id}/status-transition", response_model=SuccessResponse[TaskStatusTransitionResponse])
def transition_status(
    request: TaskStatusTransitionRequest,
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    allowed, reason = StatusService.can_transition(task.status, request.target_status.value)

    response = TaskStatusTransitionResponse(
        task_id=task.id,
        previous_status=TaskStatus(task.status),
        new_status=request.target_status,
        allowed=allowed,
        reason=reason,
    )

    if allowed:
        StatusService.transition(
            db=db,
            task=task,
            target_status=request.target_status.value,
            message=request.message,
            triggered_by=request.triggered_by,
            metadata=request.metadata,
        )
        db.commit()

    return SuccessResponse(data=response)


@router.post("/{task_id}/upload-model", response_model=SuccessResponse[ModelFileUploadResponse])
async def upload_model(
    file: UploadFile = File(..., description="模型文件 (STL, OBJ, 3MF)"),
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请上传有效的文件",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件内容为空",
        )

    model_file = await MeshService.upload_model_file(
        db=db,
        task=task,
        file_content=content,
        file_name=file.filename,
        uploaded_by="api",
    )
    db.commit()
    db.refresh(model_file)

    return SuccessResponse(data=MeshService.to_upload_response(model_file))


@router.post("/{task_id}/analyze", response_model=SuccessResponse[MeshAnalysisResponse])
def analyze_mesh(
    request: Optional[MeshAnalysisRequest] = None,
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    if request is None:
        request = MeshAnalysisRequest(task_id=task.id)
    else:
        request.task_id = task.id

    try:
        _, response = MeshService.analyze_mesh(db, task, request)
        db.commit()
        return SuccessResponse(data=response)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{task_id}/analysis", response_model=SuccessResponse[List[MeshAnalysisResponse]])
def get_analysis_history(
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    from ..models import MeshAnalysisResult
    from ..schemas import MeshQualityIssue, OverhangDetail

    results = (
        db.query(MeshAnalysisResult)
        .filter(MeshAnalysisResult.task_id == task.id)
        .order_by(MeshAnalysisResult.created_at.desc())
        .all()
    )

    response = []
    for r in results:
        analysis_details = r.analysis_details or {}
        quality_issues = analysis_details.get("quality_issues", [])
        overhang_details = analysis_details.get("overhang_details", [])

        response.append(MeshAnalysisResponse(
            id=r.id,
            task_id=r.task_id,
            model_file_id=r.model_file_id,
            params_version=r.params_version,
            is_watertight=r.is_watertight,
            is_manifold=r.is_manifold,
            broken_face_count=r.broken_face_count,
            non_manifold_edges=r.non_manifold_edges,
            self_intersections=r.self_intersections,
            duplicate_faces=r.duplicate_faces,
            inverted_normals=r.inverted_normals,
            overhang_area=r.overhang_area,
            overhang_count=r.overhang_count,
            min_support_angle=r.min_support_angle,
            max_support_height=r.max_support_height,
            support_volume=r.support_volume,
            support_contact_area=r.support_contact_area,
            support_material_volume=r.support_material_volume,
            total_volume=r.total_volume,
            part_volume=r.part_volume,
            bounding_box_volume=r.bounding_box_volume,
            quality_score=r.quality_score,
            processing_time_ms=r.processing_time_ms,
            quality_issues=[MeshQualityIssue(**qi) for qi in quality_issues],
            overhang_details=[OverhangDetail(**od) for od in overhang_details],
            analysis_details=analysis_details,
            notes=r.notes,
            created_at=r.created_at,
            updated_at=r.updated_at,
        ))

    return SuccessResponse(data=response)


@router.post("/{task_id}/estimate", response_model=SuccessResponse[SupportEstimationResponse])
def estimate_support(
    request: Optional[SupportEstimationRequest] = None,
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    if request is None:
        request = SupportEstimationRequest(task_id=task.id)
    else:
        request.task_id = task.id

    try:
        _, response = EstimationService.estimate_support(db, task, request)
        db.commit()
        return SuccessResponse(data=response)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{task_id}/estimations", response_model=SuccessResponse[List[SupportEstimationResponse]])
def get_estimation_history(
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    from ..models import SupportEstimation
    from ..schemas import CalculationStep, TimeBreakdown

    results = (
        db.query(SupportEstimation)
        .filter(SupportEstimation.task_id == task.id)
        .order_by(SupportEstimation.created_at.desc())
        .all()
    )

    response = []
    for e in results:
        calc_details = e.calculation_details or {}
        time_bd = e.time_breakdown or {}
        calc_steps = calc_details.get("calculation_steps", [])

        response.append(SupportEstimationResponse(
            id=e.id,
            task_id=e.task_id,
            params_version=e.params_version,
            material_id=e.material_id,
            analysis_result_id=e.analysis_result_id,
            part_mass_g=e.part_mass_g,
            part_volume_cm3=e.part_volume_cm3,
            support_mass_g=e.support_mass_g,
            support_volume_cm3=e.support_volume_cm3,
            support_material_ratio=e.support_material_ratio,
            total_mass_g=e.total_mass_g,
            total_volume_cm3=e.total_volume_cm3,
            filament_length_m=e.filament_length_m,
            filament_cost_estimate=e.filament_cost_estimate,
            print_time_hours=e.print_time_hours,
            print_time_minutes=e.print_time_minutes,
            time_breakdown=TimeBreakdown(**time_bd),
            layer_count=e.layer_count,
            total_lines=e.total_lines,
            time_correction_factor=e.time_correction_factor,
            is_time_underestimated=e.is_time_underestimated,
            confidence_score=e.confidence_score,
            calculation_steps=[CalculationStep(**cs) for cs in calc_steps],
            calculation_details=calc_details,
            notes=e.notes,
            created_at=e.created_at,
            updated_at=e.updated_at,
        ))

    return SuccessResponse(data=response)


@router.get("/{task_id}/params", response_model=SuccessResponse[List[SliceParamsResponse]])
def get_params_versions(
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    versions = ParamsService.get_all_versions(db, task.id)
    response = [ParamsService.to_response(db, v) for v in versions]
    return SuccessResponse(data=response)


@router.post("/{task_id}/params", response_model=SuccessResponse[ParamsMergeResponse])
def merge_params(
    request: ParamsMergeRequest,
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    request.task_id = task.id
    _, response = ParamsService.merge_params(db, task, request)
    db.commit()
    return SuccessResponse(data=response)


@router.get("/{task_id}/params/{version}", response_model=SuccessResponse[SliceParamsResponse])
def get_params_version(
    version: int,
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    params = ParamsService.get_version(db, task.id, version)
    if not params:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"参数版本 v{version} 不存在",
        )
    return SuccessResponse(data=ParamsService.to_response(db, params))


@router.get("/{task_id}/anomalies", response_model=SuccessResponse[List[AnomalyResponse]])
def get_anomalies(
    severity: Optional[AnomalySeverity] = Query(None, description="按严重程度筛选"),
    include_resolved: bool = Query(False, description="是否包含已解决的"),
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    anomalies = AnomalyService.get_task_anomalies(
        db=db,
        task_id=task.id,
        severity=severity,
        include_resolved=include_resolved,
    )
    response = [AnomalyService.to_response(a) for a in anomalies]
    return SuccessResponse(data=response)


@router.post("/{task_id}/anomalies/{anomaly_id}/resolve", response_model=SuccessResponse[AnomalyResponse])
def resolve_anomaly(
    anomaly_id: int,
    request: AnomalyResolveRequest,
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    from ..models import Anomaly

    anomaly = db.query(Anomaly).filter(
        Anomaly.id == anomaly_id,
        Anomaly.task_id == task.id,
    ).first()

    if not anomaly:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"异常记录 {anomaly_id} 不存在",
        )

    anomaly = AnomalyService.resolve_anomaly(db, anomaly_id, request.resolution_notes)
    db.commit()

    return SuccessResponse(data=AnomalyService.to_response(anomaly))


@router.post("/{task_id}/report", response_model=SuccessResponse[EstimationReportResponse])
def generate_report(
    request: Optional[EstimationReportRequest] = None,
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    if request is None:
        request = EstimationReportRequest(task_id=task.id)
    else:
        request.task_id = task.id

    try:
        _, response = ReportService.generate_report(db, task, request)
        db.commit()
        return SuccessResponse(data=response)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{task_id}/reports", response_model=SuccessResponse[List[EstimationReportResponse]])
def get_reports(
    task: EstimationTask = Depends(get_task),
    db: Session = Depends(get_db_session),
):
    from ..models import EstimationReport
    from ..schemas import (
        ReportSummary,
        ReportSection,
        ReportChart,
        ReportDetailItem,
    )

    reports = (
        db.query(EstimationReport)
        .filter(EstimationReport.task_id == task.id)
        .order_by(EstimationReport.created_at.desc())
        .all()
    )

    response = []
    for r in reports:
        content = r.content or {}
        summary = ReportSummary(**content.get("summary", {}))
        sections = [ReportSection(**s) for s in content.get("sections", [])]
        charts = [ReportChart(**c) for c in content.get("charts", [])]
        detail_items = [ReportDetailItem(**d) for d in content.get("detail_items", [])]
        anomalies = content.get("anomalies", [])

        response.append(EstimationReportResponse(
            id=r.id,
            task_id=r.task_id,
            params_version=r.params_version,
            estimation_id=r.estimation_id,
            report_type=r.report_type,
            format=r.format,
            file_path=r.file_path,
            file_name=r.file_name,
            summary=summary,
            sections=sections,
            charts=charts,
            detail_items=detail_items,
            anomalies=anomalies,
            generated_by=r.generated_by,
            generation_time_ms=r.generation_time_ms,
            is_latest=r.is_latest,
            notes=r.notes,
            created_at=r.created_at,
            updated_at=r.updated_at,
        ))

    return SuccessResponse(data=response)
