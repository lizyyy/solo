from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime

from ..models import (
    ConfigItem,
    ExemptionRecord,
    DriftRecord,
    ReviewStatus,
    AuditResult,
    AuditSummary,
    SourceTracker,
)
from ..parsers import ParseResult


@dataclass
class RuleEngineResult:
    audit_result: AuditResult
    exemption_map: Dict[str, ExemptionRecord]


class RuleEngine:
    def __init__(self, check_date: Optional[datetime] = None):
        self.check_date = check_date or datetime.now()

    def process(
        self,
        config_items: ParseResult[ConfigItem],
        exemptions: ParseResult[ExemptionRecord],
    ) -> RuleEngineResult:
        exemption_map = self._build_exemption_map(exemptions.items)
        drift_records = self._match_exemptions(config_items.items, exemption_map)

        source_tracker = SourceTracker()
        source_tracker.locations.update(config_items.source_tracker.locations)
        source_tracker.locations.update(exemptions.source_tracker.locations)
        source_tracker.bad_rows.extend(config_items.source_tracker.bad_rows)
        source_tracker.bad_rows.extend(exemptions.source_tracker.bad_rows)

        summary = self._compute_summary(drift_records, source_tracker)

        audit_result = AuditResult(
            drift_records=drift_records,
            source_tracker=source_tracker,
            summary=summary,
        )
        audit_result.sort_records()

        return RuleEngineResult(
            audit_result=audit_result,
            exemption_map=exemption_map,
        )

    def _build_exemption_map(self, exemptions: List[ExemptionRecord]) -> Dict[str, ExemptionRecord]:
        exemption_map: Dict[str, ExemptionRecord] = {}
        for exemption in exemptions:
            key = f"{exemption.service_name}:{exemption.config_key}"
            exemption_map[key] = exemption
        return exemption_map

    def _match_exemptions(
        self,
        config_items: List[ConfigItem],
        exemption_map: Dict[str, ExemptionRecord],
    ) -> List[DriftRecord]:
        drift_records: List[DriftRecord] = []

        for item in config_items:
            if not item.has_drift():
                continue

            key = f"{item.service_name}:{item.config_key}"
            exemption = exemption_map.get(key)

            if exemption is None:
                review_status = ReviewStatus.NO_EXEMPTION
                is_expired = False
            else:
                is_expired = exemption.is_expired(self.check_date)
                if is_expired:
                    review_status = ReviewStatus.EXPIRED
                else:
                    review_status = exemption.status

            drift_record = DriftRecord(
                config_item=item,
                exemption=exemption,
                review_status=review_status,
                is_exemption_expired=is_expired,
            )
            drift_records.append(drift_record)

        return drift_records

    def _compute_summary(
        self,
        drift_records: List[DriftRecord],
        source_tracker: SourceTracker,
    ) -> AuditSummary:
        summary = AuditSummary(
            total_records=len(drift_records),
            bad_rows_count=len(source_tracker.bad_rows),
        )

        for record in drift_records:
            summary.drifted_records += 1

            if record.exemption is not None:
                summary.exempted_records += 1

            if record.is_exemption_expired:
                summary.expired_exemptions += 1

            if record.review_status == ReviewStatus.PENDING:
                summary.pending_review += 1
            elif record.review_status == ReviewStatus.APPROVED:
                summary.approved_exemptions += 1
            elif record.review_status == ReviewStatus.REJECTED:
                summary.rejected_exemptions += 1
            elif record.review_status == ReviewStatus.NO_EXEMPTION:
                summary.no_exemption += 1

        return summary
