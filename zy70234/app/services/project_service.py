from sqlalchemy.orm import Session
from typing import List

from app.models import CheckProject, ProjectDependency, ProjectType
from app.errors import ResourceNotFoundError, DuplicateResourceError, InvalidDataError
from app.schemas import CheckProjectCreate, ProjectDependencyCreate


class ProjectService:
    def __init__(self, db: Session):
        self.db = db

    def create_project(self, data: CheckProjectCreate) -> CheckProject:
        if data.project_type not in [ProjectType.FASTING, ProjectType.POST_MEAL, ProjectType.UNRESTRICTED]:
            raise InvalidDataError(
                f"无效的项目类型: {data.project_type}",
                detail={
                    "valid_types": [ProjectType.FASTING, ProjectType.POST_MEAL, ProjectType.UNRESTRICTED]
                }
            )

        existing = self.db.query(CheckProject).filter(CheckProject.code == data.code).first()
        if existing:
            raise DuplicateResourceError("检查项目", data.code)

        project = CheckProject(
            name=data.name,
            code=data.code,
            project_type=data.project_type,
            description=data.description,
            estimated_minutes=data.estimated_minutes,
        )

        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def get_project(self, project_id: int) -> CheckProject:
        project = self.db.query(CheckProject).filter(CheckProject.id == project_id).first()
        if not project:
            raise ResourceNotFoundError("检查项目", project_id)
        return project

    def get_project_by_code(self, code: str) -> CheckProject:
        project = self.db.query(CheckProject).filter(CheckProject.code == code).first()
        if not project:
            raise ResourceNotFoundError("检查项目", -1)
        return project

    def list_projects(self, project_type: str = None) -> List[CheckProject]:
        query = self.db.query(CheckProject)
        if project_type:
            query = query.filter(CheckProject.project_type == project_type)
        return query.all()

    def create_dependency(self, data: ProjectDependencyCreate) -> ProjectDependency:
        dependent = self.db.query(CheckProject).filter(
            CheckProject.id == data.dependent_project_id
        ).first()
        if not dependent:
            raise ResourceNotFoundError("检查项目", data.dependent_project_id)

        dependency = self.db.query(CheckProject).filter(
            CheckProject.id == data.dependency_project_id
        ).first()
        if not dependency:
            raise ResourceNotFoundError("检查项目", data.dependency_project_id)

        if data.dependent_project_id == data.dependency_project_id:
            raise InvalidDataError(
                "项目不能依赖自己",
                detail={"project_id": data.dependent_project_id}
            )

        existing = self.db.query(ProjectDependency).filter(
            ProjectDependency.dependent_project_id == data.dependent_project_id,
            ProjectDependency.dependency_project_id == data.dependency_project_id,
        ).first()

        if existing:
            raise DuplicateResourceError(
                "项目依赖",
                f"{data.dependent_project_id} -> {data.dependency_project_id}"
            )

        dep = ProjectDependency(
            dependent_project_id=data.dependent_project_id,
            dependency_project_id=data.dependency_project_id,
            dependency_type=data.dependency_type,
        )

        self.db.add(dep)
        self.db.commit()
        self.db.refresh(dep)
        return dep

    def get_project_dependencies(self, project_id: int) -> List[ProjectDependency]:
        return self.db.query(ProjectDependency).filter(
            ProjectDependency.dependent_project_id == project_id
        ).all()

    def get_project_dependents(self, project_id: int) -> List[ProjectDependency]:
        return self.db.query(ProjectDependency).filter(
            ProjectDependency.dependency_project_id == project_id
        ).all()
