from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict
from datetime import datetime
import json

import models
import schemas
from exceptions import (
    NotFoundException,
    InvalidStatusException,
    AlreadyProcessedException,
    ManualReviewRequiredException,
    ValidationException
)


class ScoreService:
    @staticmethod
    def calculate_raw_time(db: Session, participant_id: int) -> float:
        time_records = db.query(models.TimeRecord).filter(
            and_(
                models.TimeRecord.participant_id == participant_id,
                models.TimeRecord.is_valid == True
            )
        ).all()

        if not time_records:
            raise ValidationException(
                message=f"No valid time records found for participant {participant_id}",
                details={"participant_id": participant_id}
            )

        checkpoints = set(tr.checkpoint for tr in time_records)
        if "finish" not in checkpoints:
            raise ValidationException(
                message=f"No finish checkpoint recorded for participant {participant_id}",
                details={"participant_id": participant_id, "checkpoints": list(checkpoints)}
            )

        finish_record = next(tr for tr in time_records if tr.checkpoint == "finish")
        return finish_record.time_seconds

    @staticmethod
    def calculate_total_penalty(db: Session, participant_id: int, apply_only: bool = True) -> float:
        query = db.query(models.Penalty).filter(
            models.Penalty.participant_id == participant_id
        )
        if apply_only:
            query = query.filter(models.Penalty.applied == True)

        penalties = query.all()
        return sum(p.time_penalty_seconds for p in penalties)

    @staticmethod
    def recalculate_scores(
        db: Session,
        participant_ids: Optional[List[int]] = None,
        age_group_ids: Optional[List[int]] = None,
        apply_penalties: bool = True
    ) -> List[models.Score]:
        query = db.query(models.Participant)

        if participant_ids:
            query = query.filter(models.Participant.id.in_(participant_ids))
        if age_group_ids:
            query = query.filter(models.Participant.age_group_id.in_(age_group_ids))

        participants = query.all()
        if not participants:
            raise NotFoundException(message="No participants found for recalculation")

        scores = []
        for participant in participants:
            try:
                raw_time = ScoreService.calculate_raw_time(db, participant.id)
            except ValidationException:
                continue

            penalty_time = ScoreService.calculate_total_penalty(
                db, participant.id, apply_only=apply_penalties
            ) if apply_penalties else 0.0

            final_time = raw_time + penalty_time

            existing_score = db.query(models.Score).filter(
                models.Score.participant_id == participant.id
            ).first()

            if existing_score:
                existing_score.raw_time_seconds = raw_time
                existing_score.penalty_time_seconds = penalty_time
                existing_score.final_time_seconds = final_time
                existing_score.age_group_id = participant.age_group_id
                scores.append(existing_score)
            else:
                score = models.Score(
                    participant_id=participant.id,
                    raw_time_seconds=raw_time,
                    penalty_time_seconds=penalty_time,
                    final_time_seconds=final_time,
                    age_group_id=participant.age_group_id,
                    is_verified=False
                )
                db.add(score)
                scores.append(score)

        db.flush()
        return scores

    @staticmethod
    def update_ranks(db: Session, age_group_ids: Optional[List[int]] = None) -> None:
        all_scores = db.query(models.Score).join(models.Participant)
        if age_group_ids:
            all_scores = all_scores.filter(models.Score.age_group_id.in_(age_group_ids))
        all_scores = all_scores.order_by(models.Score.final_time_seconds).all()

        for idx, score in enumerate(all_scores, start=1):
            score.overall_rank = idx

        age_groups = db.query(models.AgeGroup).all()
        if age_group_ids:
            age_groups = [ag for ag in age_groups if ag.id in age_group_ids]

        for age_group in age_groups:
            group_scores = db.query(models.Score).filter(
                models.Score.age_group_id == age_group.id
            ).order_by(models.Score.final_time_seconds).all()

            for idx, score in enumerate(group_scores, start=1):
                score.group_rank = idx

        db.flush()

    @staticmethod
    def get_scores_by_group(db: Session, age_group_id: Optional[int] = None) -> List[models.Score]:
        query = db.query(models.Score).join(models.Participant)
        if age_group_id:
            query = query.filter(models.Score.age_group_id == age_group_id)
        return query.order_by(models.Score.final_time_seconds).all()


class AppealService:
    @staticmethod
    def create_appeal(db: Session, appeal_data: schemas.AppealCreate) -> models.Appeal:
        participant = db.query(models.Participant).filter(
            models.Participant.id == appeal_data.participant_id
        ).first()

        if not participant:
            raise NotFoundException(
                message=f"Participant {appeal_data.participant_id} not found",
                details={"participant_id": appeal_data.participant_id}
            )

        existing_appeal = db.query(models.Appeal).filter(
            models.Appeal.appeal_number == appeal_data.appeal_number
        ).first()

        if existing_appeal:
            raise AlreadyProcessedException(
                message=f"Appeal number {appeal_data.appeal_number} already exists",
                details={"appeal_number": appeal_data.appeal_number}
            )

        appeal = models.Appeal(**appeal_data.model_dump())
        db.add(appeal)
        db.flush()

        score = db.query(models.Score).filter(
            models.Score.participant_id == appeal_data.participant_id
        ).first()

        if score:
            score.has_appeal = True

        db.flush()
        return appeal

    @staticmethod
    def review_appeal(
        db: Session,
        appeal_id: int,
        review_data: schemas.AppealReview
    ) -> models.Appeal:
        appeal = db.query(models.Appeal).filter(models.Appeal.id == appeal_id).first()

        if not appeal:
            raise NotFoundException(
                message=f"Appeal {appeal_id} not found",
                details={"appeal_id": appeal_id}
            )

        if appeal.status not in ["pending", "under_review"]:
            raise InvalidStatusException(
                message=f"Cannot review appeal with status {appeal.status}",
                details={"appeal_id": appeal_id, "current_status": appeal.status}
            )

        appeal.status = review_data.status
        appeal.decision = review_data.decision
        appeal.decision_notes = review_data.decision_notes
        appeal.reviewer = review_data.reviewer
        appeal.reviewed_at = datetime.utcnow()

        db.flush()
        return appeal

    @staticmethod
    def process_appeal_decision(db: Session, appeal_id: int) -> Dict:
        appeal = db.query(models.Appeal).filter(models.Appeal.id == appeal_id).first()

        if not appeal:
            raise NotFoundException(message=f"Appeal {appeal_id} not found")

        if appeal.status == "processed":
            raise AlreadyProcessedException(
                message=f"Appeal {appeal_id} has already been processed"
            )

        if not appeal.decision:
            raise InvalidStatusException(
                message=f"Appeal {appeal_id} has no decision yet"
            )

        result = {
            "appeal_id": appeal_id,
            "appeal_number": appeal.appeal_number,
            "decision": appeal.decision,
            "actions_taken": []
        }

        if appeal.decision == "penalty_removed":
            penalties = db.query(models.Penalty).filter(
                models.Penalty.participant_id == appeal.participant_id
            ).all()

            for penalty in penalties:
                penalty.applied = False
                result["actions_taken"].append(f"Penalty {penalty.id} marked as not applied")

            db.flush()
            ScoreService.recalculate_scores(db, participant_ids=[appeal.participant_id])
            ScoreService.update_ranks(db)
            result["actions_taken"].append("Scores recalculated and ranks updated")

        elif appeal.decision == "time_adjusted":
            ScoreService.recalculate_scores(db, participant_ids=[appeal.participant_id])
            ScoreService.update_ranks(db)
            result["actions_taken"].append("Scores recalculated and ranks updated")

        elif appeal.decision == "requires_manual_review":
            raise ManualReviewRequiredException(
                message="This appeal requires manual review by chief referee",
                details={"appeal_id": appeal_id, "appeal_number": appeal.appeal_number}
            )

        appeal.status = "processed"
        db.flush()
        return result

    @staticmethod
    def get_appeals_by_status(db: Session, status: Optional[str] = None) -> List[models.Appeal]:
        query = db.query(models.Appeal)
        if status:
            query = query.filter(models.Appeal.status == status)
        return query.all()


class PenaltyService:
    @staticmethod
    def add_penalty(db: Session, penalty_data: schemas.PenaltyCreate) -> models.Penalty:
        participant = db.query(models.Participant).filter(
            models.Participant.id == penalty_data.participant_id
        ).first()

        if not participant:
            raise NotFoundException(
                message=f"Participant {penalty_data.participant_id} not found"
            )

        penalty = models.Penalty(**penalty_data.model_dump(), applied=True)
        db.add(penalty)
        db.flush()
        return penalty

    @staticmethod
    def apply_penalty(db: Session, penalty_id: int) -> models.Penalty:
        penalty = db.query(models.Penalty).filter(models.Penalty.id == penalty_id).first()

        if not penalty:
            raise NotFoundException(message=f"Penalty {penalty_id} not found")

        if penalty.applied:
            raise AlreadyProcessedException(
                message=f"Penalty {penalty_id} is already applied"
            )

        penalty.applied = True
        db.flush()
        return penalty


class ReportService:
    @staticmethod
    def generate_review_report(
        db: Session,
        appeal_id: int,
        include_raw_data: bool = True
    ) -> Dict:
        appeal = db.query(models.Appeal).filter(models.Appeal.id == appeal_id).first()

        if not appeal:
            raise NotFoundException(message=f"Appeal {appeal_id} not found")

        participant = db.query(models.Participant).filter(
            models.Participant.id == appeal.participant_id
        ).first()

        score = db.query(models.Score).filter(
            models.Score.participant_id == appeal.participant_id
        ).first()

        time_records = db.query(models.TimeRecord).filter(
            models.TimeRecord.participant_id == appeal.participant_id
        ).all()

        penalties = db.query(models.Penalty).filter(
            models.Penalty.participant_id == appeal.participant_id
        ).all()

        report = {
            "appeal_info": {
                "id": appeal.id,
                "appeal_number": appeal.appeal_number,
                "status": appeal.status,
                "reason": appeal.reason,
                "submitted_at": appeal.submitted_at.isoformat() if appeal.submitted_at else None,
                "reviewed_at": appeal.reviewed_at.isoformat() if appeal.reviewed_at else None,
                "reviewer": appeal.reviewer,
                "decision": appeal.decision,
                "decision_notes": appeal.decision_notes
            },
            "participant_info": {
                "id": participant.id,
                "bib_number": participant.bib_number,
                "name": participant.name,
                "age": participant.age
            } if participant else None,
            "score_info": {
                "raw_time_seconds": score.raw_time_seconds,
                "penalty_time_seconds": score.penalty_time_seconds,
                "final_time_seconds": score.final_time_seconds,
                "overall_rank": score.overall_rank,
                "group_rank": score.group_rank,
                "is_verified": score.is_verified
            } if score else None
        }

        if include_raw_data:
            report["raw_data"] = {
                "time_records": [
                    {
                        "checkpoint": tr.checkpoint,
                        "time_seconds": tr.time_seconds,
                        "is_valid": tr.is_valid,
                        "notes": tr.notes
                    }
                    for tr in time_records
                ],
                "penalties": [
                    {
                        "penalty_type": p.penalty_type,
                        "time_penalty_seconds": p.time_penalty_seconds,
                        "description": p.description,
                        "applied": p.applied
                    }
                    for p in penalties
                ]
            }

        return report

    @staticmethod
    def save_report(
        db: Session,
        appeal_id: int,
        report_content: Dict,
        generated_by: str = "system",
        export_format: str = "json"
    ) -> models.ReviewReport:
        report = models.ReviewReport(
            appeal_id=appeal_id,
            report_content=json.dumps(report_content, ensure_ascii=False, indent=2),
            generated_by=generated_by,
            export_format=export_format
        )
        db.add(report)
        db.flush()
        return report

    @staticmethod
    def export_report(db: Session, report_id: int, format: str = "json"):
        report = db.query(models.ReviewReport).filter(
            models.ReviewReport.id == report_id
        ).first()

        if not report:
            raise NotFoundException(message=f"Report {report_id} not found")

        if format == "json":
            return json.loads(report.report_content)
        elif format == "text":
            return ReportService._format_report_as_text(json.loads(report.report_content))
        else:
            raise ValidationException(
                message=f"Unsupported export format: {format}",
                details={"supported_formats": ["json", "text"]}
            )

    @staticmethod
    def _format_report_as_text(report: Dict) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("APPEAL REVIEW REPORT")
        lines.append("=" * 60)

        appeal = report.get("appeal_info", {})
        lines.append(f"\nAppeal Number: {appeal.get('appeal_number')}")
        lines.append(f"Status: {appeal.get('status')}")
        lines.append(f"Submitted At: {appeal.get('submitted_at')}")
        lines.append(f"Reason: {appeal.get('reason')}")
        lines.append(f"Decision: {appeal.get('decision')}")
        lines.append(f"Decision Notes: {appeal.get('decision_notes')}")
        lines.append(f"Reviewer: {appeal.get('reviewer')}")

        participant = report.get("participant_info", {})
        if participant:
            lines.append(f"\nParticipant: {participant.get('name')}")
            lines.append(f"Bib Number: {participant.get('bib_number')}")

        score = report.get("score_info", {})
        if score:
            lines.append(f"\nFinal Time: {score.get('final_time_seconds')}s")
            lines.append(f"Overall Rank: {score.get('overall_rank')}")
            lines.append(f"Group Rank: {score.get('group_rank')}")

        if "raw_data" in report:
            lines.append("\n--- Time Records ---")
            for tr in report["raw_data"]["time_records"]:
                lines.append(f"  {tr['checkpoint']}: {tr['time_seconds']}s (valid: {tr['is_valid']})")

            lines.append("\n--- Penalties ---")
            for p in report["raw_data"]["penalties"]:
                lines.append(f"  {p['penalty_type']}: +{p['time_penalty_seconds']}s (applied: {p['applied']})")

        lines.append("\n" + "=" * 60)
        return "\n".join(lines)
