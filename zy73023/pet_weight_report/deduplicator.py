from typing import Dict, List, Tuple
from collections import defaultdict

from .models import (
    PetRecord,
    FosteringRegistration,
    DuplicateAliasIssue,
    ProcessingStatus,
)


class DeduplicationEngine:
    def __init__(self, normalize: bool = True):
        self._alias_index: Dict[str, List[Tuple[str, int]]] = defaultdict(list)
        self._normalize = normalize
        self._found_issues: Dict[str, DuplicateAliasIssue] = {}

    @staticmethod
    def _normalize_alias(alias: str) -> str:
        return alias.strip().lower().replace(" ", "").replace("　", "")

    def _get_aliases(self, registration: FosteringRegistration) -> List[str]:
        aliases = []
        for alias in registration.pet_aliases:
            key = self._normalize_alias(alias) if self._normalize else alias
            aliases.append(key)
        return aliases

    def index_registration(
        self, registration: FosteringRegistration, row_index: int
    ) -> List[DuplicateAliasIssue]:
        issues_for_row = []
        aliases = self._get_aliases(registration)
        seen_aliases_for_row = set()

        for original_alias, norm_alias in zip(registration.pet_aliases, aliases):
            if norm_alias in seen_aliases_for_row:
                continue
            seen_aliases_for_row.add(norm_alias)

            existing = self._alias_index[norm_alias]
            if existing:
                first_row_idx = existing[0][1]
                related_ids = [reg_id for reg_id, _ in existing]
                if registration.registration_id not in related_ids:
                    related_ids.append(registration.registration_id)

                if norm_alias not in self._found_issues:
                    self._found_issues[norm_alias] = DuplicateAliasIssue(
                        alias=original_alias,
                        related_registration_ids=related_ids,
                        first_found_index=first_row_idx,
                        severity="high",
                    )
                else:
                    issue = self._found_issues[norm_alias]
                    issue.related_registration_ids = list(
                        set(issue.related_registration_ids + related_ids)
                    )

                issues_for_row.append(self._found_issues[norm_alias])

            self._alias_index[norm_alias].append(
                (registration.registration_id, row_index)
            )

        return issues_for_row

    def process_records(self, records: List[PetRecord]) -> List[DuplicateAliasIssue]:
        all_issues: List[DuplicateAliasIssue] = []
        for idx, record in enumerate(records, start=1):
            reg = record.fostering_registration
            row_issues = self.index_registration(reg, idx)
            for issue in row_issues:
                if issue not in record.duplicate_issues:
                    record.mark_duplicate_issue(issue)
                    if record.current_status != ProcessingStatus.ABNORMAL:
                        record.current_status = ProcessingStatus.ABNORMAL
            all_issues.extend(row_issues)

        unique_issues = list({v.alias: v for v in self._found_issues.values()}.values())
        return unique_issues

    def get_exit_messages(self) -> List[str]:
        messages = []
        for issue in self._found_issues.values():
            messages.append(issue.format_exit_message())
        return messages

    def get_all_issues(self) -> List[DuplicateAliasIssue]:
        return list(self._found_issues.values())

    def clear(self) -> None:
        self._alias_index.clear()
        self._found_issues.clear()
