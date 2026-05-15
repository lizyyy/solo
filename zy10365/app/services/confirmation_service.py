from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime
from app.models import (
    GrayVersion, Confirmer, ReleaseConclusion,
    HistoryRequest, ResponseDiff, VerificationStatus,
    DiffLevel, Timeline
)


class ConfirmationService:
    def __init__(self, db: Session):
        self.db = db

    def add_confirmers(
        self,
        gray_version_id: int,
        confirmers: List[Dict[str, str]]
    ) -> List[Confirmer]:
        existing = self.db.query(Confirmer).filter(
            Confirmer.gray_version_id == gray_version_id
        ).all()
        existing_user_ids = {c.user_id for c in existing}

        new_confirmers = []
        for confirmer_data in confirmers:
            if confirmer_data["user_id"] not in existing_user_ids:
                confirmer = Confirmer(
                    gray_version_id=gray_version_id,
                    user_id=confirmer_data["user_id"],
                    user_name=confirmer_data["user_name"],
                    role=confirmer_data.get("role")
                )
                self.db.add(confirmer)
                new_confirmers.append(confirmer)

        self.db.commit()

        for confirmer in new_confirmers:
            self._add_timeline(
                gray_version_id=gray_version_id,
                action="confirmer_added",
                actor="system",
                details={
                    "user_id": confirmer.user_id,
                    "user_name": confirmer.user_name,
                    "role": confirmer.role
                }
            )

        return new_confirmers

    def confirm(
        self,
        gray_version_id: int,
        user_id: str,
        confirmed: bool,
        comment: str = None
    ) -> Dict[str, Any]:
        confirmer = self.db.query(Confirmer).filter(
            Confirmer.gray_version_id == gray_version_id,
            Confirmer.user_id == user_id
        ).first()

        if not confirmer:
            raise ValueError(f"Confirmer {user_id} not found")

        confirmer.confirmed = confirmed
        confirmer.confirmed_at = datetime.now()
        confirmer.comment = comment
        self.db.commit()

        gray_version = self.db.query(GrayVersion).filter(
            GrayVersion.id == gray_version_id
        ).first()

        self._add_timeline(
            gray_version_id=gray_version_id,
            action="confirmation_submitted",
            actor=user_id,
            details={
                "confirmed": confirmed,
                "comment": comment
            }
        )

        all_confirmed = self._check_all_confirmed(gray_version_id)
        if all_confirmed:
            gray_version.status = VerificationStatus.CONFIRMED
            self.db.commit()

            self._add_timeline(
                gray_version_id=gray_version_id,
                action="all_confirmed",
                actor="system",
                details={}
            )
        elif not confirmed:
            gray_version.status = VerificationStatus.REJECTED
            self.db.commit()

            self._add_timeline(
                gray_version_id=gray_version_id,
                action="verification_rejected",
                actor=user_id,
                details={"comment": comment}
            )

        return {
            "success": True,
            "all_confirmed": all_confirmed,
            "status": gray_version.status
        }

    def _check_all_confirmed(self, gray_version_id: int) -> bool:
        confirmers = self.db.query(Confirmer).filter(
            Confirmer.gray_version_id == gray_version_id
        ).all()

        if not confirmers:
            return True

        return all(c.confirmed for c in confirmers)

    def get_confirmation_status(self, gray_version_id: int) -> Dict[str, Any]:
        confirmers = self.db.query(Confirmer).filter(
            Confirmer.gray_version_id == gray_version_id
        ).all()

        confirmed_count = sum(1 for c in confirmers if c.confirmed)

        return {
            "total": len(confirmers),
            "confirmed": confirmed_count,
            "pending": len(confirmers) - confirmed_count,
            "all_confirmed": self._check_all_confirmed(gray_version_id),
            "confirmers": [
                {
                    "user_id": c.user_id,
                    "user_name": c.user_name,
                    "role": c.role,
                    "confirmed": c.confirmed,
                    "confirmed_at": c.confirmed_at,
                    "comment": c.comment
                }
                for c in confirmers
            ]
        }

    def _add_timeline(
        self,
        action: str,
        actor: str,
        details: Dict[str, Any],
        gray_version_id: int
    ):
        timeline = Timeline(
            gray_version_id=gray_version_id,
            action=action,
            actor=actor,
            details=details
        )
        self.db.add(timeline)
        self.db.commit()


class ReleaseService:
    def __init__(self, db: Session):
        self.db = db

    def create_release_conclusion(
        self,
        gray_version_id: int,
        conclusion_type: str,
        summary: str,
        released_by: str
    ) -> ReleaseConclusion:
        gray_version = self.db.query(GrayVersion).filter(
            GrayVersion.id == gray_version_id
        ).first()

        if not gray_version:
            raise ValueError(f"Gray version {gray_version_id} not found")

        stats = self._calculate_statistics(gray_version_id)

        conclusion = ReleaseConclusion(
            gray_version_id=gray_version_id,
            conclusion_type=conclusion_type,
            summary=summary,
            total_requests=stats["total_requests"],
            success_requests=stats["success_requests"],
            failed_requests=stats["failed_requests"],
            total_diffs=stats["total_diffs"],
            critical_diffs=stats["critical_diffs"],
            error_diffs=stats["error_diffs"],
            warning_diffs=stats["warning_diffs"],
            tolerated_diffs=stats["tolerated_diffs"],
            released_by=released_by,
            released_at=datetime.now()
        )

        self.db.add(conclusion)
        gray_version.status = VerificationStatus.RELEASED
        self.db.commit()

        self._add_timeline(
            gray_version_id=gray_version_id,
            action="release_conclusion_created",
            actor=released_by,
            details={
                "conclusion_type": conclusion_type,
                "summary": summary,
                "statistics": stats
            }
        )

        return conclusion

    def _calculate_statistics(self, gray_version_id: int) -> Dict[str, Any]:
        requests = self.db.query(HistoryRequest).filter(
            HistoryRequest.gray_version_id == gray_version_id
        ).all()

        diffs = self.db.query(ResponseDiff).join(HistoryRequest).filter(
            HistoryRequest.gray_version_id == gray_version_id
        ).all()

        total_requests = len(requests)
        success_requests = sum(
            1 for r in requests
            if r.gray_status_code and 200 <= r.gray_status_code < 300
        )
        failed_requests = total_requests - success_requests

        total_diffs = len(diffs)
        critical_diffs = sum(1 for d in diffs if d.level == DiffLevel.CRITICAL)
        error_diffs = sum(1 for d in diffs if d.level == DiffLevel.ERROR)
        warning_diffs = sum(1 for d in diffs if d.level == DiffLevel.WARNING)
        tolerated_diffs = sum(1 for d in diffs if d.is_tolerated)

        return {
            "total_requests": total_requests,
            "success_requests": success_requests,
            "failed_requests": failed_requests,
            "total_diffs": total_diffs,
            "critical_diffs": critical_diffs,
            "error_diffs": error_diffs,
            "warning_diffs": warning_diffs,
            "tolerated_diffs": tolerated_diffs
        }

    def _add_timeline(
        self,
        action: str,
        actor: str,
        details: Dict[str, Any],
        gray_version_id: int
    ):
        timeline = Timeline(
            gray_version_id=gray_version_id,
            action=action,
            actor=actor,
            details=details
        )
        self.db.add(timeline)
        self.db.commit()
