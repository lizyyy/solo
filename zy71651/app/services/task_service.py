from typing import Optional, List, Tuple
from sqlalchemy.orm import Session

from ..models import (
    EstimationTask,
    TaskStatus,
    Student,
    Material,
    SupportEstimation,
    Anomaly,
    AnomalySeverity,
)
from ..schemas import (
    TaskCreate,
    TaskUpdate,
    TaskSummary,
    TaskDetailResponse,
    TaskStatusLogResponse,
    PaginationParams,
    PaginatedResponse,
    ParamsMergeRequest,
)
from .status_service import StatusService
from .anomaly_service import AnomalyService
from .params_service import ParamsService
from ..models.enums import TaskStatusCategory


class TaskService:
    @staticmethod
    def create_task(
        db: Session,
        task_data: TaskCreate,
    ) -> EstimationTask:
        task = EstimationTask(
            **task_data.model_dump(exclude_unset=True),
            status=TaskStatus.CREATED.value,
        )
        db.add(task)
        db.flush()

        params = ParamsService.get_effective_params(db, task.id)
        ParamsService.merge_params(
            db=db,
            task=task,
            request=ParamsMergeRequest(
                task_id=task.id,
                params=params,
                source="system_init",
                create_new_version=True,
                notes="系统初始化默认参数",
            ),
        )

        return task

    @staticmethod
    def get_task(
        db: Session,
        task_id: int,
    ) -> Optional[EstimationTask]:
        return db.query(EstimationTask).filter(EstimationTask.id == task_id).first()

    @staticmethod
    def list_tasks(
        db: Session,
        pagination: PaginationParams,
        status: Optional[TaskStatus] = None,
        status_category: Optional[TaskStatusCategory] = None,
        student_id: Optional[int] = None,
        has_anomalies: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[TaskSummary]:
        query = db.query(EstimationTask)

        if status:
            query = query.filter(EstimationTask.status == status.value)
        if status_category:
            from ..models import STATUS_CATEGORY_MAP
            statuses = [s.value for s, cat in STATUS_CATEGORY_MAP.items() if cat == status_category]
            query = query.filter(EstimationTask.status.in_(statuses))
        if student_id:
            query = query.filter(EstimationTask.student_id == student_id)
        if search:
            query = query.filter(EstimationTask.project_name.contains(search))

        total = query.count()
        items = (
            query.order_by(EstimationTask.updated_at.desc())
            .offset((pagination.page - 1) * pagination.page_size)
            .limit(pagination.page_size)
            .all()
        )

        summaries = [TaskService._to_summary(db, task) for task in items]

        return PaginatedResponse(
            items=summaries,
            page=pagination.page,
            page_size=pagination.page_size,
            total=total,
            total_pages=(total + pagination.page_size - 1) // pagination.page_size,
        )

    @staticmethod
    def _to_summary(
        db: Session,
        task: EstimationTask,
    ) -> TaskSummary:
        status_info = StatusService.get_current_status_info(task)

        student = task.student
        has_model = len(task.model_files) > 0
        has_analysis = len(task.analysis_results) > 0
        has_estimation = task.active_estimation_id is not None
        has_report = len([r for r in task.reports if r.is_latest]) > 0

        anomalies = [a for a in task.anomalies if not a.is_resolved]
        anomaly_count = len(anomalies)
        critical_count = sum(
            1 for a in anomalies
            if a.severity in [AnomalySeverity.CRITICAL.value, AnomalySeverity.ERROR.value]
        )

        active_estimation = None
        if task.active_estimation_id:
            active_estimation = (
                db.query(SupportEstimation)
                .filter(SupportEstimation.id == task.active_estimation_id)
                .first()
            )

        return TaskSummary(
            id=task.id,
            project_name=task.project_name,
            description=task.description,
            student_id=task.student_id,
            student_name=student.name if student else None,
            status=TaskStatus(task.status),
            status_category=status_info["status_category"],
            status_display=status_info["status_display"],
            current_params_version=task.current_params_version or 1,
            tags=task.tags or [],
            has_model=has_model,
            has_analysis=has_analysis,
            has_estimation=has_estimation,
            has_report=has_report,
            anomaly_count=anomaly_count,
            critical_anomaly_count=critical_count,
            total_mass_g=active_estimation.total_mass_g if active_estimation else None,
            print_time_hours=active_estimation.print_time_hours if active_estimation else None,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )

    @staticmethod
    def get_task_detail(
        db: Session,
        task: EstimationTask,
    ) -> TaskDetailResponse:
        summary = TaskService._to_summary(db, task)

        model_files = [
            {
                "id": mf.id,
                "file_name": mf.file_name,
                "file_type": mf.file_type,
                "file_size": mf.file_size,
                "is_processed": mf.is_processed,
                "created_at": mf.created_at,
            }
            for mf in task.model_files
        ]

        params_versions = [
            {
                "id": pv.id,
                "version": pv.version,
                "layer_height": pv.layer_height,
                "nozzle_diameter": pv.nozzle_diameter,
                "print_speed": pv.print_speed,
                "infill_density": pv.infill_density,
                "source": pv.source,
                "notes": pv.notes,
                "created_at": pv.created_at,
            }
            for pv in task.params_versions
        ]

        status_history = [
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
            for log in task.status_logs
        ]

        active_estimation = None
        if task.active_estimation_id:
            est = (
                db.query(SupportEstimation)
                .filter(SupportEstimation.id == task.active_estimation_id)
                .first()
            )
            if est:
                active_estimation = {
                    "id": est.id,
                    "params_version": est.params_version,
                    "total_mass_g": est.total_mass_g,
                    "support_mass_g": est.support_mass_g,
                    "support_material_ratio": est.support_material_ratio,
                    "print_time_hours": est.print_time_hours,
                    "print_time_minutes": est.print_time_minutes,
                    "filament_length_m": est.filament_length_m,
                    "confidence_score": est.confidence_score,
                    "is_time_underestimated": est.is_time_underestimated,
                    "created_at": est.created_at,
                }

        anomalies = [
            AnomalyService.to_response(a).model_dump()
            for a in task.anomalies
            if not a.is_resolved
        ]

        latest_analysis = None
        if task.analysis_results:
            analysis = task.analysis_results[-1]
            latest_analysis = {
                "id": analysis.id,
                "quality_score": analysis.quality_score,
                "is_watertight": analysis.is_watertight,
                "broken_face_count": analysis.broken_face_count,
                "overhang_area": analysis.overhang_area,
                "overhang_count": analysis.overhang_count,
                "created_at": analysis.created_at,
            }

        latest_report = None
        latest_reports = [r for r in task.reports if r.is_latest]
        if latest_reports:
            report = latest_reports[0]
            latest_report = {
                "id": report.id,
                "report_type": report.report_type,
                "format": report.format,
                "file_name": report.file_name,
                "created_at": report.created_at,
            }

        return TaskDetailResponse(
            **summary.model_dump(),
            model_files=model_files,
            params_versions=params_versions,
            status_history=status_history,
            active_estimation=active_estimation,
            anomalies=anomalies,
            latest_analysis=latest_analysis,
            latest_report=latest_report,
        )

    @staticmethod
    def update_task(
        db: Session,
        task: EstimationTask,
        update_data: TaskUpdate,
    ) -> EstimationTask:
        for field, value in update_data.model_dump(exclude_unset=True).items():
            setattr(task, field, value)
        db.flush()
        return task

    @staticmethod
    def delete_task(
        db: Session,
        task_id: int,
    ) -> bool:
        task = TaskService.get_task(db, task_id)
        if task:
            db.delete(task)
            db.flush()
            return True
        return False
