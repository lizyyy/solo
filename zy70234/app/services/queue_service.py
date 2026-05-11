from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models import (
    CheckProject, Package, PackageProject, Patient, QueueNumber,
    ProblemRecord, ProjectDependency, ProjectType, QueueStatus
)
from app.errors import (
    InvalidOrderError, FastingRuleViolationError, DependencyNotMetError,
    ResourceNotFoundError, InvalidStatusTransitionError, InvalidDataError
)
from app.schemas import QueueNumberCreate, QueueNumberBatchCreate


VALID_STATUS_TRANSITIONS = {
    QueueStatus.PENDING: [QueueStatus.IN_PROGRESS, QueueStatus.CANCELLED, QueueStatus.RESCHEDULED, QueueStatus.INVALID],
    QueueStatus.IN_PROGRESS: [QueueStatus.COMPLETED, QueueStatus.CANCELLED, QueueStatus.RESCHEDULED],
    QueueStatus.COMPLETED: [],
    QueueStatus.RESCHEDULED: [QueueStatus.PENDING],
    QueueStatus.CANCELLED: [],
    QueueStatus.INVALID: [],
}


class QueueService:
    def __init__(self, db: Session):
        self.db = db

    def _record_problem(self, endpoint: str, source_data: dict, error_message: str, error_type: str):
        problem = ProblemRecord(
            source_endpoint=endpoint,
            source_data=source_data,
            error_message=error_message,
            error_type=error_type,
        )
        self.db.add(problem)
        self.db.commit()
        return problem

    def _generate_queue_number(self, project_type: str) -> str:
        prefix_map = {
            ProjectType.FASTING: "F",
            ProjectType.POST_MEAL: "P",
            ProjectType.UNRESTRICTED: "U",
        }
        prefix = prefix_map.get(project_type, "U")
        today = datetime.now().strftime("%Y%m%d")
        
        count = self.db.query(QueueNumber).filter(
            QueueNumber.queue_number.like(f"{prefix}{today}%")
        ).count() + 1
        
        return f"{prefix}{today}{count:04d}"

    def _get_patient(self, patient_id: int) -> Patient:
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ResourceNotFoundError("患者", patient_id)
        return patient

    def _get_package(self, package_id: int) -> Package:
        package = self.db.query(Package).filter(Package.id == package_id).first()
        if not package:
            raise ResourceNotFoundError("套餐", package_id)
        return package

    def _get_project(self, project_id: int) -> CheckProject:
        project = self.db.query(CheckProject).filter(CheckProject.id == project_id).first()
        if not project:
            raise ResourceNotFoundError("检查项目", project_id)
        return project

    def _get_package_projects(self, package_id: int) -> List[Tuple[CheckProject, int]]:
        package_projects = self.db.query(PackageProject).filter(
            PackageProject.package_id == package_id
        ).order_by(PackageProject.sort_order).all()
        
        result = []
        for pp in package_projects:
            project = self.db.query(CheckProject).filter(
                CheckProject.id == pp.project_id
            ).first()
            if project:
                result.append((project, pp.sort_order))
        return result

    def _get_project_dependencies(self, project_id: int) -> List[CheckProject]:
        dependencies = self.db.query(ProjectDependency).filter(
            ProjectDependency.dependent_project_id == project_id
        ).all()
        
        result = []
        for dep in dependencies:
            dep_project = self.db.query(CheckProject).filter(
                CheckProject.id == dep.dependency_project_id
            ).first()
            if dep_project:
                result.append(dep_project)
        return result

    def _get_patient_completed_projects(self, patient_id: int, package_id: int) -> List[int]:
        completed = self.db.query(QueueNumber).filter(
            QueueNumber.patient_id == patient_id,
            QueueNumber.package_id == package_id,
            QueueNumber.status == QueueStatus.COMPLETED
        ).all()
        return [q.project_id for q in completed]

    def _validate_project_order(
        self,
        project: CheckProject,
        patient_id: int,
        package_id: int,
        package_projects: List[Tuple[CheckProject, int]]
    ):
        completed_projects = self._get_patient_completed_projects(patient_id, package_id)
        package_project_map = {p.id: order for p, order in package_projects}
        
        dependencies = self._get_project_dependencies(project.id)
        
        for dep in dependencies:
            if dep.id not in completed_projects:
                raise DependencyNotMetError(
                    f"项目[{project.name}] 依赖项目[{dep.name}] 尚未完成",
                    detail={
                        "current_project": {"id": project.id, "name": project.name},
                        "missing_dependency": {"id": dep.id, "name": dep.name}
                    }
                )
        
        if project.project_type == ProjectType.POST_MEAL:
            has_fasting_project_in_package = any(
                p.project_type == ProjectType.FASTING for p, _ in package_projects
            )
            
            if has_fasting_project_in_package:
                fasting_completed = any(
                    p.id in completed_projects and p.project_type == ProjectType.FASTING
                    for p, _ in package_projects
                )
                
                if not fasting_completed:
                    raise FastingRuleViolationError(
                        f"餐后项目[{project.name}] 必须在所有空腹项目完成后才能进行，否则会影响检查结果",
                        detail={
                            "current_project": {"id": project.id, "name": project.name, "type": "post_meal"},
                            "rule": "餐后项目必须在空腹项目之后"
                        }
                    )
        
        if project.project_type == ProjectType.FASTING:
            post_meal_completed = any(
                p.id in completed_projects and p.project_type == ProjectType.POST_MEAL
                for p, _ in package_projects
            )
            
            if post_meal_completed:
                raise InvalidOrderError(
                    f"空腹项目[{project.name}] 不能在餐后项目完成后进行，顺序错误会影响检查结果",
                    detail={
                        "current_project": {"id": project.id, "name": project.name, "type": "fasting"},
                        "problem": "已有餐后项目完成",
                        "consequence": "会影响检查结果准确性"
                    }
                )

    def _validate_status_transition(self, current_status: str, target_status: str):
        allowed_transitions = VALID_STATUS_TRANSITIONS.get(current_status, [])
        if target_status not in allowed_transitions:
            raise InvalidStatusTransitionError(
                current_status=current_status,
                target_status=target_status,
                detail={
                    "allowed_transitions": allowed_transitions
                }
            )

    def create_queue_number(self, data: QueueNumberCreate) -> QueueNumber:
        patient = self._get_patient(data.patient_id)
        package = self._get_package(data.package_id)
        project = self._get_project(data.project_id)
        package_projects = self._get_package_projects(data.package_id)

        try:
            self._validate_project_order(
                project=project,
                patient_id=data.patient_id,
                package_id=data.package_id,
                package_projects=package_projects
            )
            
            existing = self.db.query(QueueNumber).filter(
                QueueNumber.patient_id == data.patient_id,
                QueueNumber.package_id == data.package_id,
                QueueNumber.project_id == data.project_id,
                QueueNumber.status.in_([QueueStatus.PENDING, QueueStatus.IN_PROGRESS])
            ).first()
            
            if existing:
                raise InvalidDataError(
                    f"患者[{patient.name}] 在套餐[{package.name}] 中的项目[{project.name}] 已有未完成的排队号",
                    detail={"existing_queue_number": existing.queue_number}
                )
            
            queue_number = QueueNumber(
                queue_number=self._generate_queue_number(project.project_type),
                patient_id=data.patient_id,
                package_id=data.package_id,
                project_id=data.project_id,
                status=QueueStatus.PENDING,
                source=data.source,
            )
            
            self.db.add(queue_number)
            self.db.commit()
            self.db.refresh(queue_number)
            
            return queue_number
            
        except (InvalidOrderError, FastingRuleViolationError, DependencyNotMetError, InvalidDataError) as e:
            self._record_problem(
                endpoint="POST /api/queue-numbers",
                source_data=data.dict(),
                error_message=e.error_message,
                error_type=e.error_code,
            )
            raise

    def create_batch_queue_numbers(self, data: QueueNumberBatchCreate) -> dict:
        patient = self._get_patient(data.patient_id)
        package = self._get_package(data.package_id)
        package_projects = self._get_package_projects(data.package_id)

        if not package_projects:
            raise InvalidDataError(
                f"套餐[{package.name}] 没有包含任何检查项目",
                detail={"package_id": data.package_id}
            )

        results = {
            "success": [],
            "failed": []
        }

        for project, order in package_projects:
            try:
                self._validate_project_order(
                    project=project,
                    patient_id=data.patient_id,
                    package_id=data.package_id,
                    package_projects=package_projects
                )
                
                existing = self.db.query(QueueNumber).filter(
                    QueueNumber.patient_id == data.patient_id,
                    QueueNumber.package_id == data.package_id,
                    QueueNumber.project_id == project.id,
                    QueueNumber.status.in_([QueueStatus.PENDING, QueueStatus.IN_PROGRESS])
                ).first()
                
                if existing:
                    results["failed"].append({
                        "project_id": project.id,
                        "project_name": project.name,
                        "error_code": "DUPLICATE_QUEUE",
                        "error_message": f"项目[{project.name}] 已有未完成的排队号: {existing.queue_number}",
                    })
                    continue
                
                queue_number = QueueNumber(
                    queue_number=self._generate_queue_number(project.project_type),
                    patient_id=data.patient_id,
                    package_id=data.package_id,
                    project_id=project.id,
                    status=QueueStatus.PENDING,
                    source=data.source,
                )
                
                self.db.add(queue_number)
                self.db.flush()
                self.db.refresh(queue_number)
                results["success"].append({
                    "queue_number": queue_number.queue_number,
                    "project_id": project.id,
                    "project_name": project.name,
                    "sort_order": order,
                })
                
            except (InvalidOrderError, FastingRuleViolationError, DependencyNotMetError) as e:
                self._record_problem(
                    endpoint="POST /api/queue-numbers/batch",
                    source_data={
                        **data.dict(),
                        "project_id": project.id,
                        "project_name": project.name
                    },
                    error_message=e.error_message,
                    error_type=e.error_code,
                )
                
                results["failed"].append({
                    "project_id": project.id,
                    "project_name": project.name,
                    "error_code": e.error_code,
                    "error_message": e.error_message,
                    "detail": e.detail,
                })

        self.db.commit()
        return results

    def update_queue_status(self, queue_number_id: int, new_status: str) -> QueueNumber:
        queue = self.db.query(QueueNumber).filter(QueueNumber.id == queue_number_id).first()
        if not queue:
            raise ResourceNotFoundError("排队号", queue_number_id)

        self._validate_status_transition(queue.status, new_status)

        old_status = queue.status
        queue.status = new_status

        now = datetime.utcnow()
        if new_status == QueueStatus.IN_PROGRESS:
            queue.actual_start_time = now
        elif new_status == QueueStatus.COMPLETED:
            queue.actual_end_time = now
        elif new_status == QueueStatus.RESCHEDULED:
            queue.estimated_start_time = None

        self.db.commit()
        self.db.refresh(queue)
        return queue

    def reschedule_queue(self, queue_number_id: int) -> QueueNumber:
        return self.update_queue_status(queue_number_id, QueueStatus.RESCHEDULED)

    def reactivate_rescheduled_queue(self, queue_number_id: int) -> QueueNumber:
        return self.update_queue_status(queue_number_id, QueueStatus.PENDING)

    def get_queue_number(self, queue_number_id: int) -> QueueNumber:
        queue = self.db.query(QueueNumber).filter(QueueNumber.id == queue_number_id).first()
        if not queue:
            raise ResourceNotFoundError("排队号", queue_number_id)
        return queue

    def list_queue_numbers(
        self,
        patient_id: Optional[int] = None,
        package_id: Optional[int] = None,
        status: Optional[str] = None,
        project_type: Optional[str] = None,
    ) -> List[QueueNumber]:
        query = self.db.query(QueueNumber)

        if patient_id:
            query = query.filter(QueueNumber.patient_id == patient_id)
        if package_id:
            query = query.filter(QueueNumber.package_id == package_id)
        if status:
            query = query.filter(QueueNumber.status == status)
        if project_type:
            query = query.join(CheckProject).filter(CheckProject.project_type == project_type)

        return query.order_by(QueueNumber.created_at.desc()).all()

    def get_problem_records(self, limit: int = 100) -> List[ProblemRecord]:
        return self.db.query(ProblemRecord).order_by(
            ProblemRecord.created_at.desc()
        ).limit(limit).all()

    def get_queue_validation_rules(self) -> dict:
        return {
            "project_types": {
                ProjectType.FASTING: "空腹项目 - 必须在餐后项目之前进行",
                ProjectType.POST_MEAL: "餐后项目 - 必须在空腹项目完成后进行",
                ProjectType.UNRESTRICTED: "无限制项目 - 不受空腹/餐后限制",
            },
            "status_transitions": VALID_STATUS_TRANSITIONS,
            "core_rules": [
                "餐后项目必须在所有空腹项目完成后才能开始",
                "空腹项目不能在餐后项目完成后进行",
                "项目依赖必须按顺序完成",
                "同一患者同一套餐同一项目不能同时存在多个待处理排队号",
            ],
            "consequences": [
                "顺序错误会影响检查结果准确性",
                "违反规则的请求会被拒绝并记录到问题列表",
            ],
        }
