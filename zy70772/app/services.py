import json
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import (
    FeatureFlag, CodeReference, AuditLog, CleanupReport,
    FlagStatus, RiskLevel, ExperimentStatus, DeletionSuggestion
)
from app import schemas


class FeatureFlagService:
    def __init__(self, db: Session):
        self.db = db

    def create_flag(self, flag_create: schemas.FeatureFlagCreate) -> FeatureFlag:
        db_flag = FeatureFlag(
            name=flag_create.name,
            description=flag_create.description,
            default_value=flag_create.default_value,
            owner=flag_create.owner,
            notes=flag_create.notes,
            experiment_status=flag_create.experiment_status or ExperimentStatus.UNKNOWN,
            status=FlagStatus.PENDING
        )
        self.db.add(db_flag)
        self.db.flush()

        if flag_create.code_references:
            for ref in flag_create.code_references:
                db_ref = CodeReference(
                    feature_flag_id=db_flag.id,
                    file_path=ref.file_path,
                    line_number=ref.line_number,
                    code_snippet=ref.code_snippet,
                    language=ref.language,
                    repository=ref.repository
                )
                self.db.add(db_ref)

        self._create_audit_log(
            flag_id=db_flag.id,
            action="CREATE",
            processed_by=flag_create.owner or "system",
            conclusion="Feature flag created",
            original_input=json.dumps(flag_create.model_dump())
        )

        self.db.commit()
        self.db.refresh(db_flag)
        return db_flag

    def get_flag(self, flag_id: int) -> Optional[FeatureFlag]:
        return self.db.query(FeatureFlag).filter(FeatureFlag.id == flag_id).first()

    def get_flags(self, skip: int = 0, limit: int = 100, status: Optional[FlagStatus] = None) -> List[FeatureFlag]:
        query = self.db.query(FeatureFlag)
        if status:
            query = query.filter(FeatureFlag.status == status)
        return query.offset(skip).limit(limit).all()

    def update_flag(self, flag_id: int, flag_update: schemas.FeatureFlagUpdate, processed_by: str) -> Optional[FeatureFlag]:
        db_flag = self.get_flag(flag_id)
        if not db_flag:
            return None

        old_data = {
            "description": db_flag.description,
            "default_value": db_flag.default_value,
            "owner": db_flag.owner,
            "notes": db_flag.notes,
            "experiment_status": db_flag.experiment_status,
            "risk_level": db_flag.risk_level,
            "deletion_suggestion": db_flag.deletion_suggestion
        }

        for field, value in flag_update.model_dump(exclude_unset=True).items():
            setattr(db_flag, field, value)

        self._create_audit_log(
            flag_id=flag_id,
            action="UPDATE",
            processed_by=processed_by,
            conclusion="Feature flag updated",
            original_input=json.dumps({"old": old_data, "new": flag_update.model_dump()})
        )

        self.db.commit()
        self.db.refresh(db_flag)
        return db_flag

    def update_status(self, flag_id: int, request: schemas.StatusUpdateRequest) -> Optional[FeatureFlag]:
        db_flag = self.get_flag(flag_id)
        if not db_flag:
            return None

        old_status = db_flag.status
        db_flag.status = request.new_status

        self._create_audit_log(
            flag_id=flag_id,
            action="STATUS_CHANGE",
            old_status=old_status,
            new_status=request.new_status,
            processed_by=request.processed_by,
            conclusion=request.conclusion or f"Status changed from {old_status} to {request.new_status}"
        )

        self.db.commit()
        self.db.refresh(db_flag)
        return db_flag

    def manual_correction(self, flag_id: int, request: schemas.ManualCorrectionRequest) -> Optional[FeatureFlag]:
        db_flag = self.get_flag(flag_id)
        if not db_flag:
            return None

        old_risk = db_flag.risk_level
        old_suggestion = db_flag.deletion_suggestion

        if request.risk_level:
            db_flag.risk_level = request.risk_level
        if request.deletion_suggestion:
            db_flag.deletion_suggestion = request.deletion_suggestion
        if request.notes:
            db_flag.notes = (db_flag.notes or "") + f"\n[{datetime.utcnow()}] {request.processed_by}: {request.notes}"

        self._create_audit_log(
            flag_id=flag_id,
            action="MANUAL_CORRECTION",
            processed_by=request.processed_by,
            conclusion=f"Manual correction: risk {old_risk}->{db_flag.risk_level}, suggestion {old_suggestion}->{db_flag.deletion_suggestion}",
            original_input=json.dumps(request.model_dump())
        )

        self.db.commit()
        self.db.refresh(db_flag)
        return db_flag

    def cancel_flag(self, flag_id: int, processed_by: str, reason: str) -> Optional[FeatureFlag]:
        db_flag = self.get_flag(flag_id)
        if not db_flag:
            return None

        old_status = db_flag.status
        db_flag.status = FlagStatus.CANCELLED

        self._create_audit_log(
            flag_id=flag_id,
            action="CANCEL",
            old_status=old_status,
            new_status=FlagStatus.CANCELLED,
            processed_by=processed_by,
            conclusion=reason
        )

        self.db.commit()
        self.db.refresh(db_flag)
        return db_flag

    def scan_and_analyze(self, flag_id: int) -> Optional[schemas.ScanResult]:
        db_flag = self.get_flag(flag_id)
        if not db_flag:
            return None

        old_status = db_flag.status
        db_flag.status = FlagStatus.SCANNING
        self.db.commit()

        ref_count = len(db_flag.code_references)
        risk_level = self._calculate_risk_level(db_flag, ref_count)
        deletion_suggestion = self._calculate_deletion_suggestion(db_flag, risk_level)

        db_flag.risk_level = risk_level
        db_flag.deletion_suggestion = deletion_suggestion
        db_flag.status = FlagStatus.ANALYZING
        self.db.commit()

        self._create_audit_log(
            flag_id=flag_id,
            action="SCAN_ANALYZE",
            old_status=old_status,
            new_status=FlagStatus.ANALYZING,
            processed_by="system",
            conclusion=f"Scan complete: {ref_count} references, risk={risk_level}, suggestion={deletion_suggestion}",
            original_input=json.dumps({"ref_count": ref_count, "default_value": db_flag.default_value})
        )

        self.db.refresh(db_flag)
        return schemas.ScanResult(
            flag_id=db_flag.id,
            flag_name=db_flag.name,
            reference_count=ref_count,
            risk_level=risk_level,
            deletion_suggestion=deletion_suggestion
        )

    def _calculate_risk_level(self, flag: FeatureFlag, ref_count: int) -> RiskLevel:
        risk_score = 0

        if ref_count == 0:
            risk_score += 1
        elif ref_count < 3:
            risk_score += 2
        elif ref_count < 10:
            risk_score += 3
        else:
            risk_score += 5

        if not flag.default_value:
            risk_score += 1

        if flag.experiment_status == ExperimentStatus.ACTIVE:
            risk_score += 4
        elif flag.experiment_status == ExperimentStatus.COMPLETED:
            risk_score += 1

        if risk_score <= 2:
            return RiskLevel.SAFE
        elif risk_score <= 4:
            return RiskLevel.LOW
        elif risk_score <= 6:
            return RiskLevel.MEDIUM
        elif risk_score <= 8:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL

    def _calculate_deletion_suggestion(self, flag: FeatureFlag, risk_level: RiskLevel) -> DeletionSuggestion:
        if risk_level in [RiskLevel.SAFE, RiskLevel.LOW]:
            if flag.experiment_status in [ExperimentStatus.COMPLETED, ExperimentStatus.CANCELLED]:
                return DeletionSuggestion.SAFE_TO_DELETE
        elif risk_level == RiskLevel.MEDIUM:
            return DeletionSuggestion.NEEDS_REVIEW
        return DeletionSuggestion.DO_NOT_DELETE

    def add_code_reference(self, flag_id: int, ref: schemas.CodeReferenceCreate) -> Optional[CodeReference]:
        db_flag = self.get_flag(flag_id)
        if not db_flag:
            return None

        db_ref = CodeReference(
            feature_flag_id=flag_id,
            file_path=ref.file_path,
            line_number=ref.line_number,
            code_snippet=ref.code_snippet,
            language=ref.language,
            repository=ref.repository
        )
        self.db.add(db_ref)
        self.db.commit()
        self.db.refresh(db_ref)
        return db_ref

    def _create_audit_log(self, flag_id: int, action: str, processed_by: str,
                          conclusion: str, original_input: Optional[str] = None,
                          old_status: Optional[FlagStatus] = None,
                          new_status: Optional[FlagStatus] = None):
        audit_log = AuditLog(
            feature_flag_id=flag_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            processed_by=processed_by,
            conclusion=conclusion,
            original_input=original_input
        )
        self.db.add(audit_log)


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_cleanup_report(self, generated_by: Optional[str] = None) -> CleanupReport:
        total = self.db.query(FeatureFlag).count()
        safe = self.db.query(FeatureFlag).filter(
            FeatureFlag.deletion_suggestion == DeletionSuggestion.SAFE_TO_DELETE
        ).count()
        review = self.db.query(FeatureFlag).filter(
            FeatureFlag.deletion_suggestion == DeletionSuggestion.NEEDS_REVIEW
        ).count()
        no_delete = self.db.query(FeatureFlag).filter(
            FeatureFlag.deletion_suggestion == DeletionSuggestion.DO_NOT_DELETE
        ).count()
        high_risk = self.db.query(FeatureFlag).filter(
            FeatureFlag.risk_level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL])
        ).count()

        report = CleanupReport(
            total_flags=total,
            safe_to_delete=safe,
            needs_review=review,
            do_not_delete=no_delete,
            high_risk=high_risk,
            generated_by=generated_by
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def get_report(self, report_id: int) -> Optional[CleanupReport]:
        return self.db.query(CleanupReport).filter(CleanupReport.id == report_id).first()

    def get_all_reports(self, skip: int = 0, limit: int = 50) -> List[CleanupReport]:
        return self.db.query(CleanupReport).order_by(CleanupReport.report_date.desc()).offset(skip).limit(limit).all()
