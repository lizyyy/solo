from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .database import Dependency, LicenseException, ExceptionStatus, License as DBLicense
from .schemas import LicenseExceptionCreate, LicenseExceptionUpdate
from . import schemas


class LicenseMerger:
    LICENSE_NORMALIZATION = {
        "Apache 2.0": "Apache-2.0",
        "Apache License 2.0": "Apache-2.0",
        "Apache-2.0": "Apache-2.0",
        "MIT License": "MIT",
        "MIT": "MIT",
        "GPLv2": "GPL-2.0",
        "GPLv3": "GPL-3.0",
        "GPL-2.0": "GPL-2.0",
        "GPL-3.0": "GPL-3.0",
        "LGPLv2.1": "LGPL-2.1",
        "LGPLv3": "LGPL-3.0",
        "BSD 2-Clause": "BSD-2-Clause",
        "BSD 3-Clause": "BSD-3-Clause",
        "BSD": "BSD-3-Clause",
        "MPL 2.0": "MPL-2.0",
        "CDDL 1.1": "CDDL-1.1",
        "EPL 2.0": "EPL-2.0",
    }

    @classmethod
    def normalize_license(cls, license_name: Optional[str]) -> Optional[str]:
        if not license_name:
            return None
        return cls.LICENSE_NORMALIZATION.get(license_name, license_name)

    @classmethod
    def merge_licenses(cls, dependencies: List[Dependency]) -> Dict[str, List[Dependency]]:
        merged = {}
        for dep in dependencies:
            normalized = cls.normalize_license(dep.license_name)
            if normalized not in merged:
                merged[normalized] = []
            merged[normalized].append(dep)
        return merged


class ExceptionService:
    @staticmethod
    def create_exception(db: Session, exception: LicenseExceptionCreate) -> LicenseException:
        from .schemas import MissingField

        if not exception.reason:
            raise MissingField("reason")
        if not exception.requested_by:
            raise MissingField("requested_by")
        if not exception.expires_at:
            raise MissingField("expires_at")

        db_exception = LicenseException(
            dependency_id=exception.dependency_id,
            dependency_name=exception.dependency_name,
            license_name=exception.license_name,
            reason=exception.reason,
            requested_by=exception.requested_by,
            expires_at=exception.expires_at,
            status=ExceptionStatus.PENDING_REVIEW,
            requires_manual_review=exception.requires_manual_review,
        )
        db.add(db_exception)
        db.commit()
        db.refresh(db_exception)
        return db_exception

    @staticmethod
    def update_exception_status(
        db: Session,
        exception_id: int,
        update: LicenseExceptionUpdate,
        reviewer: str
    ) -> LicenseException:
        from .schemas import LicenseExceptionNotFound, InvalidStatusTransition, AlreadyProcessed, NeedsManualReview

        exception = db.query(LicenseException).filter(LicenseException.id == exception_id).first()
        if not exception:
            raise LicenseExceptionNotFound(f"Exception {exception_id} not found")

        if exception.status in [ExceptionStatus.REJECTED, ExceptionStatus.EXPIRED]:
            raise AlreadyProcessed(f"Exception {exception_id} is already {exception.status}")

        if exception.requires_manual_review and update.status != ExceptionStatus.NEEDS_MANUAL_REVIEW:
            raise NeedsManualReview(f"Exception {exception_id} requires manual review")

        if update.status:
            valid_transitions = {
                ExceptionStatus.PENDING_REVIEW: [ExceptionStatus.APPROVED, ExceptionStatus.REJECTED, ExceptionStatus.NEEDS_MANUAL_REVIEW],
                ExceptionStatus.NEEDS_MANUAL_REVIEW: [ExceptionStatus.APPROVED, ExceptionStatus.REJECTED],
                ExceptionStatus.APPROVED: [ExceptionStatus.EXPIRED],
            }
            current_status = ExceptionStatus(exception.status)
            if update.status not in valid_transitions.get(current_status, []):
                raise InvalidStatusTransition(
                    f"Cannot transition from {current_status} to {update.status}"
                )

            exception.status = update.status

        if update.approved_by:
            exception.approved_by = update.approved_by
        if update.review_notes:
            exception.review_notes = update.review_notes
        if update.expires_at:
            exception.expires_at = update.expires_at
        if update.reason:
            exception.reason = update.reason

        exception.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(exception)
        return exception

    @staticmethod
    def get_expiring_exceptions(db: Session, days: int = 30) -> List[LicenseException]:
        cutoff_date = datetime.utcnow() + timedelta(days=days)
        return db.query(LicenseException).filter(
            LicenseException.status == ExceptionStatus.APPROVED,
            LicenseException.expires_at <= cutoff_date,
            LicenseException.expires_at >= datetime.utcnow()
        ).all()

    @staticmethod
    def get_exceptions_by_status(db: Session, status: ExceptionStatus) -> List[LicenseException]:
        return db.query(LicenseException).filter(LicenseException.status == status).all()

    @staticmethod
    def mark_expired_exceptions(db: Session) -> int:
        now = datetime.utcnow()
        expired = db.query(LicenseException).filter(
            LicenseException.status == ExceptionStatus.APPROVED,
            LicenseException.expires_at < now
        ).all()

        count = 0
        for exc in expired:
            exc.status = ExceptionStatus.EXPIRED
            count += 1

        db.commit()
        return count


class PathTracker:
    @staticmethod
    def track_imports(project_path: str, dependency_name: str) -> List[Dict[str, any]]:
        import os
        import ast
        paths = []

        for root, _, files in os.walk(project_path):
            for file in files:
                if not file.endswith('.py'):
                    continue
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        tree = ast.parse(content, filename=file_path)

                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                if alias.name == dependency_name or alias.name.startswith(dependency_name + '.'):
                                    paths.append({
                                        'file_path': file_path,
                                        'import_line': f"import {alias.name}",
                                        'line_number': node.lineno,
                                        'module_name': alias.name,
                                    })
                        elif isinstance(node, ast.ImportFrom):
                            if node.module and (node.module == dependency_name or node.module.startswith(dependency_name + '.')):
                                for alias in node.names:
                                    paths.append({
                                        'file_path': file_path,
                                        'import_line': f"from {node.module} import {alias.name}",
                                        'line_number': node.lineno,
                                        'module_name': node.module,
                                    })
                except Exception:
                    continue

        return paths
