from sqlalchemy.orm import Session
from models import VersionRelease, LanguagePack, Translation, TranslationStatus, CoverageReport
from schemas import VersionReleaseCreate
from services.idempotency import IdempotencyService
from typing import List, Optional
from datetime import datetime
import json


class VersionService:
    @staticmethod
    def get_version(db: Session, version_id: int) -> Optional[VersionRelease]:
        return db.query(VersionRelease).filter(VersionRelease.id == version_id).first()

    @staticmethod
    def get_versions(db: Session, skip: int = 0, limit: int = 100,
                    language_pack_id: Optional[int] = None,
                    is_published: Optional[bool] = None) -> List[VersionRelease]:
        query = db.query(VersionRelease)
        if language_pack_id:
            query = query.filter(VersionRelease.language_pack_id == language_pack_id)
        if is_published is not None:
            query = query.filter(VersionRelease.is_published == is_published)
        return query.order_by(VersionRelease.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def create_version(db: Session, version: VersionReleaseCreate) -> VersionRelease:
        db_version = VersionRelease(**version.dict())
        db.add(db_version)
        db.commit()
        db.refresh(db_version)
        return db_version

    @staticmethod
    def publish_version(db: Session, version_id: int, operator: str,
                       idempotency_key: Optional[str] = None) -> Optional[VersionRelease]:
        if idempotency_key:
            existing_log = IdempotencyService.check_and_mark_operation(
                db, idempotency_key, "publish_version", operator
            )
            if existing_log:
                return db.query(VersionRelease).filter(VersionRelease.id == version_id).first()

        db_version = VersionService.get_version(db, version_id)
        if not db_version or db_version.is_published:
            return db_version

        db_version.is_published = True
        db_version.published_at = datetime.utcnow()
        db_version.published_by = operator

        db.commit()
        db.refresh(db_version)

        VersionService._generate_coverage_report(db, version_id)

        IdempotencyService.create_operation_log(
            db, None, "publish_version", operator,
            old_value=str(False), new_value=str(True),
            idempotency_key=idempotency_key
        )

        return db_version

    @staticmethod
    def _generate_coverage_report(db: Session, version_id: int) -> CoverageReport:
        version = db.query(VersionRelease).filter(VersionRelease.id == version_id).first()
        if not version:
            return None

        existing_report = db.query(CoverageReport).filter(
            CoverageReport.version_release_id == version_id
        ).first()
        
        if existing_report:
            db.delete(existing_report)
            db.commit()

        translations = db.query(Translation).filter(
            Translation.language_pack_id == version.language_pack_id
        ).all()

        total_keys = len(translations)
        translated_keys = len([t for t in translations if not t.is_missing and t.translated_text])
        missing_keys = total_keys - translated_keys
        coverage_rate = (translated_keys / total_keys * 100) if total_keys > 0 else 0.0
        placeholder_error_count = len([t for t in translations if not t.placeholder_valid])

        report_details = {
            "by_status": {},
            "placeholder_errors": []
        }
        
        for t in translations:
            status = t.status.value
            report_details["by_status"][status] = report_details["by_status"].get(status, 0) + 1
            if not t.placeholder_valid:
                report_details["placeholder_errors"].append({
                    "key_id": t.language_key_id,
                    "errors": t.placeholder_errors
                })

        report = CoverageReport(
            version_release_id=version_id,
            total_keys=total_keys,
            translated_keys=translated_keys,
            missing_keys=missing_keys,
            coverage_rate=coverage_rate,
            placeholder_error_count=placeholder_error_count,
            report_data=json.dumps(report_details, ensure_ascii=False)
        )

        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def regenerate_coverage_report(db: Session, version_id: int) -> Optional[CoverageReport]:
        return VersionService._generate_coverage_report(db, version_id)
