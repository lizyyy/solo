from typing import Dict, List, Any, Tuple
from ..core.models import REQUIRED_FIELDS, TagIssue, TagIssueType, BillRecord


def validate_required_fields(data: Dict[str, Any]) -> Tuple[List[str], List[TagIssue]]:
    missing_fields = []
    issues = []

    for field in REQUIRED_FIELDS:
        value = data.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing_fields.append(field)
            issues.append(TagIssue(
                field_name=field,
                issue_type=TagIssueType.MISSING,
                original_value=str(value) if value is not None else None,
                message=f"Required field '{field}' is missing or empty",
            ))

    return missing_fields, issues


def validate_tags(
    data: Dict[str, Any],
    required_tags: List[str],
    tag_field_prefix: str = "tag:",
) -> List[TagIssue]:
    issues = []

    for tag in required_tags:
        possible_keys = [
            f"{tag_field_prefix}{tag}",
            f"user:{tag}",
            tag,
            tag.capitalize(),
            tag.upper(),
        ]

        found_value = None
        found_key = None
        for key in possible_keys:
            if key in data:
                found_value = data[key]
                found_key = key
                break

        if found_value is None or (isinstance(found_value, str) and not found_value.strip()):
            issues.append(TagIssue(
                field_name=tag,
                issue_type=TagIssueType.MISSING,
                original_value=None,
                message=f"Required tag '{tag}' is missing",
            ))
        elif isinstance(found_value, str) and len(found_value.strip()) < 2:
            issues.append(TagIssue(
                field_name=tag,
                issue_type=TagIssueType.INVALID_VALUE,
                original_value=found_value,
                message=f"Tag '{tag}' value '{found_value}' is too short",
            ))

    return issues


def validate_bill_record(
    raw_data: Dict[str, Any],
    required_tags: List[str],
    tag_field_prefix: str = "tag:",
) -> Tuple[List[str], List[TagIssue]]:
    missing_fields, field_issues = validate_required_fields(raw_data)
    tag_issues = validate_tags(raw_data, required_tags, tag_field_prefix)
    return missing_fields, field_issues + tag_issues
