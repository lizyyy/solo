from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import (
    CleaningRecord,
    Photo,
    Issue,
    IssueType,
    DeductionStatus,
    RecordStatus,
)


@dataclass
class RuleCheckResult:
    passed: bool
    issue_type: Optional[IssueType] = None
    description: str = ""
    deduction_amount: float = 0.0


class CleaningRuleEngine:
    def __init__(self, db: Session):
        self.db = db

    def check_photo_requirement(self, record: CleaningRecord) -> RuleCheckResult:
        required_photos = 5
        photo_count = (
            self.db.query(Photo)
            .filter(Photo.cleaning_record_id == record.id, Photo.is_valid == True)
            .count()
        )

        if photo_count < required_photos:
            return RuleCheckResult(
                passed=False,
                issue_type=IssueType.PHOTO_MISSING,
                description=f"照片数量不足: 应有 {required_photos} 张，实有 {photo_count} 张",
                deduction_amount=20.0,
            )
        return RuleCheckResult(passed=True)

    def check_score_threshold(self, record: CleaningRecord) -> RuleCheckResult:
        min_score = 3.0
        if record.score is not None and record.score < min_score:
            return RuleCheckResult(
                passed=False,
                issue_type=IssueType.COMPLAINT,
                description=f"保洁评分过低: {record.score} 分 (最低要求 {min_score} 分)",
                deduction_amount=50.0,
            )
        return RuleCheckResult(passed=True)

    def check_duration(self, record: CleaningRecord) -> RuleCheckResult:
        min_duration = 30
        if record.duration_minutes is not None and record.duration_minutes < min_duration:
            return RuleCheckResult(
                passed=False,
                issue_type=IssueType.COMPLAINT,
                description=f"保洁时长过短: {record.duration_minutes} 分钟 (最低要求 {min_duration} 分钟)",
                deduction_amount=30.0,
            )
        return RuleCheckResult(passed=True)

    def run_all_rules(self, record: CleaningRecord) -> List[RuleCheckResult]:
        results = []
        results.append(self.check_photo_requirement(record))
        results.append(self.check_score_threshold(record))
        results.append(self.check_duration(record))
        return results

    def apply_rules_and_create_issues(self, record: CleaningRecord, operator: str = "system") -> List[Issue]:
        issues = []
        results = self.run_all_rules(record)

        for result in results:
            if not result.passed:
                existing_issue = (
                    self.db.query(Issue)
                    .filter(
                        Issue.cleaning_record_id == record.id,
                        Issue.issue_type == result.issue_type.value,
                        Issue.deduction_status != DeductionStatus.RESOLVED,
                    )
                    .first()
                )

                if not existing_issue:
                    issue = Issue(
                        cleaning_record_id=record.id,
                        issue_type=result.issue_type.value,
                        description=result.description,
                        deduction_amount=result.deduction_amount,
                        deduction_status=DeductionStatus.PENDING,
                        reported_by=operator,
                        reported_at=datetime.utcnow(),
                    )
                    self.db.add(issue)
                    issues.append(issue)

        self.db.commit()
        return issues

    def run_batch_rules(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        records = (
            self.db.query(CleaningRecord)
            .filter(
                CleaningRecord.cleaning_date >= start_date,
                CleaningRecord.cleaning_date <= end_date,
                CleaningRecord.status_record != RecordStatus.INVALID,
            )
            .all()
        )

        total_issues = 0
        processed_records = 0

        for record in records:
            issues = self.apply_rules_and_create_issues(record)
            total_issues += len(issues)
            processed_records += 1

        return {
            "processed_records": processed_records,
            "total_issues_created": total_issues,
        }
