from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import (
    AuditSummary,
    Tool,
    PermissionDeclaration,
    ActualCall,
    ExceptionRecord,
    MatchStatus,
    ExceptionStatus,
)
from app.schemas import (
    AuditSummaryCreate,
)


class AuditService:
    @staticmethod
    def generate_summary(
        db: Session, summary_create: AuditSummaryCreate
    ) -> AuditSummary:
        existing = db.query(AuditSummary).filter(
            AuditSummary.summary_id == summary_create.summary_id
        ).first()
        if existing:
            return existing

        start_date = summary_create.audit_period_start
        end_date = summary_create.audit_period_end

        total_tools = db.query(Tool).count()

        declarations_query = db.query(PermissionDeclaration).filter(
            PermissionDeclaration.created_at >= start_date,
            PermissionDeclaration.created_at <= end_date,
        )
        total_declarations = declarations_query.count()

        matched_declarations = declarations_query.filter(
            PermissionDeclaration.match_status == MatchStatus.MATCHED
        ).count()

        mismatched_declarations = declarations_query.filter(
            PermissionDeclaration.match_status == MatchStatus.MISMATCHED
        ).count()

        partial_declarations = declarations_query.filter(
            PermissionDeclaration.match_status == MatchStatus.PARTIAL
        ).count()

        total_calls = db.query(ActualCall).filter(
            ActualCall.call_time >= start_date,
            ActualCall.call_time <= end_date,
        ).count()

        exceptions_query = db.query(ExceptionRecord).filter(
            ExceptionRecord.created_at >= start_date,
            ExceptionRecord.created_at <= end_date,
        )
        total_exceptions = exceptions_query.count()
        resolved_exceptions = exceptions_query.filter(
            ExceptionRecord.status == ExceptionStatus.RESOLVED
        ).count()

        summary_data = {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "tools": {
                "total": total_tools,
            },
            "permissions": {
                "total": total_declarations,
                "matched": matched_declarations,
                "mismatched": mismatched_declarations,
                "partial": partial_declarations,
                "rate_matched": matched_declarations / total_declarations * 100 if total_declarations > 0 else 0,
            },
            "calls": {
                "total": total_calls,
            },
            "exceptions": {
                "total": total_exceptions,
                "resolved": resolved_exceptions,
                "resolution_rate": resolved_exceptions / total_exceptions * 100 if total_exceptions > 0 else 0,
            },
        }

        db_summary = AuditSummary(
            **summary_create.model_dump(),
            total_tools=total_tools,
            total_declarations=total_declarations,
            matched_declarations=matched_declarations,
            mismatched_declarations=mismatched_declarations,
            partial_declarations=partial_declarations,
            total_calls=total_calls,
            total_exceptions=total_exceptions,
            resolved_exceptions=resolved_exceptions,
            summary_data=summary_data,
        )

        db.add(db_summary)
        db.commit()
        db.refresh(db_summary)
        return db_summary

    @staticmethod
    def get_summary(db: Session, summary_id: str) -> Optional[AuditSummary]:
        return db.query(AuditSummary).filter(AuditSummary.summary_id == summary_id).first()

    @staticmethod
    def get_all_summaries(db: Session) -> List[AuditSummary]:
        return db.query(AuditSummary).order_by(AuditSummary.generated_at.desc()).all()

    @staticmethod
    def export_summary(db: Session, summary_id: str) -> Optional[Dict[str, Any]]:
        summary = AuditService.get_summary(db, summary_id)
        if not summary:
            return None

        summary.exported = True
        summary.exported_at = datetime.utcnow()
        db.commit()

        export_data = {
            "summary_id": summary.summary_id,
            "title": summary.title,
            "audit_period": {
                "start": summary.audit_period_start.isoformat(),
                "end": summary.audit_period_end.isoformat(),
            },
            "statistics": {
                "total_tools": summary.total_tools,
                "total_declarations": summary.total_declarations,
                "matched_declarations": summary.matched_declarations,
                "mismatched_declarations": summary.mismatched_declarations,
                "partial_declarations": summary.partial_declarations,
                "total_calls": summary.total_calls,
                "total_exceptions": summary.total_exceptions,
                "resolved_exceptions": summary.resolved_exceptions,
            },
            "summary_data": summary.summary_data,
            "generated_by": summary.generated_by,
            "generated_at": summary.generated_at.isoformat(),
            "exported_at": summary.exported_at.isoformat(),
        }

        return export_data
