from sqlalchemy.orm import Session
from typing import List

from app.models import Package, PackageProject, CheckProject
from app.errors import ResourceNotFoundError, DuplicateResourceError, InvalidDataError
from app.schemas import PackageCreate


class PackageService:
    def __init__(self, db: Session):
        self.db = db

    def create_package(self, data: PackageCreate) -> Package:
        existing = self.db.query(Package).filter(Package.code == data.code).first()
        if existing:
            raise DuplicateResourceError("套餐", data.code)

        if not data.projects:
            raise InvalidDataError(
                "套餐必须包含至少一个检查项目",
                detail={"package_name": data.name}
            )

        project_ids = [p.project_id for p in data.projects]
        if len(project_ids) != len(set(project_ids)):
            raise InvalidDataError(
                "套餐中不能包含重复的检查项目",
                detail={"duplicate_project_ids": project_ids}
            )

        for item in data.projects:
            project = self.db.query(CheckProject).filter(
                CheckProject.id == item.project_id
            ).first()
            if not project:
                raise ResourceNotFoundError("检查项目", item.project_id)

        package = Package(
            name=data.name,
            code=data.code,
            description=data.description,
        )

        self.db.add(package)
        self.db.flush()

        for item in data.projects:
            pp = PackageProject(
                package_id=package.id,
                project_id=item.project_id,
                sort_order=item.sort_order,
            )
            self.db.add(pp)

        self.db.commit()
        self.db.refresh(package)
        return package

    def get_package(self, package_id: int) -> Package:
        package = self.db.query(Package).filter(Package.id == package_id).first()
        if not package:
            raise ResourceNotFoundError("套餐", package_id)
        return package

    def list_packages(self) -> List[Package]:
        return self.db.query(Package).all()

    def get_package_projects(self, package_id: int):
        package_projects = self.db.query(PackageProject).filter(
            PackageProject.package_id == package_id
        ).order_by(PackageProject.sort_order).all()

        result = []
        for pp in package_projects:
            project = self.db.query(CheckProject).filter(
                CheckProject.id == pp.project_id
            ).first()
            if project:
                result.append({
                    "project_id": project.id,
                    "project_code": project.code,
                    "project_name": project.name,
                    "project_type": project.project_type,
                    "sort_order": pp.sort_order,
                })

        return result
