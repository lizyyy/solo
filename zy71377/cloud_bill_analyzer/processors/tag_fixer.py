from typing import List, Dict, Tuple
from collections import Counter

from ..core.models import (
    NormalizedBill,
    TagIssue,
    TagIssueType,
    AnomalyRecord,
    AnomalyType,
)
from ..core.config import Config
from ..utils.security import get_masked_logger


def fix_and_validate_tags(
    bills: List[NormalizedBill],
    config: Config,
) -> Tuple[List[NormalizedBill], List[AnomalyRecord], Dict[str, int]]:
    logger = get_masked_logger(config, "tag_fixer")
    logger.info(f"Fixing and validating tags for {len(bills)} bills")

    anomalies: List[AnomalyRecord] = []
    tag_issues_counter: Counter = Counter()

    for bill in bills:
        bill_issues: List[TagIssue] = []

        for required_tag in config.required_tags:
            value = bill.tags.get(required_tag)
            has_issue = False
            issue_type = None
            message = ""

            if value is None:
                has_issue = True
                issue_type = TagIssueType.MISSING
                message = f"Required tag '{required_tag}' is missing"
            elif isinstance(value, str) and not value.strip():
                has_issue = True
                issue_type = TagIssueType.EMPTY
                message = f"Required tag '{required_tag}' is empty"
            elif isinstance(value, str) and len(value.strip()) < 2:
                has_issue = True
                issue_type = TagIssueType.INVALID_VALUE
                message = f"Required tag '{required_tag}' value '{value}' is too short"
            elif not isinstance(value, str):
                has_issue = True
                issue_type = TagIssueType.INVALID_FORMAT
                message = f"Required tag '{required_tag}' has invalid format: {type(value)}"

            if has_issue:
                issue = TagIssue(
                    field_name=required_tag,
                    issue_type=issue_type,
                    original_value=str(value) if value is not None else None,
                    message=message,
                )
                bill_issues.append(issue)
                tag_issues_counter[f"{required_tag}:{issue_type.value}"] += 1

                project_context = bill.project or "unknown"
                anomalies.append(AnomalyRecord(
                    anomaly_type=AnomalyType.MISSING_TAG
                    if issue_type == TagIssueType.MISSING
                    else AnomalyType.INVALID_TAG,
                    severity="medium",
                    message=message,
                    provider=bill.provider,
                    resource_id=bill.resource_id,
                    service=bill.service,
                    project=project_context,
                    period=bill.billing_period_start.strftime("%Y-%m")
                    if bill.billing_period_start.year > 1
                    else "unknown",
                    raw_data={
                        "tag_name": required_tag,
                        "tag_value": str(value) if value is not None else None,
                        "issue_type": issue_type.value,
                    },
                ))

        for key, value in bill.tags.items():
            if value is None:
                continue
            if isinstance(value, str):
                stripped = value.strip()
                if stripped != value:
                    bill.tags[key] = stripped

        if bill_issues:
            existing_issue_fields = {issue.field_name for issue in bill.issues}
            for issue in bill_issues:
                if issue.field_name not in existing_issue_fields:
                    bill.issues.append(issue)

    tag_issues_count = dict(tag_issues_counter)
    total_issues = sum(tag_issues_count.values())
    logger.info(
        f"Tag validation complete: {total_issues} issues found "
        f"across {len([b for b in bills if b.issues])} bills"
    )

    return bills, anomalies, tag_issues_count
