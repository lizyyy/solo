from typing import Dict, List, Optional
from datetime import datetime
import uuid
from .schemas import (
    ClaimRecord,
    FlightInfo,
    PhotoIndex,
    CompensationRule,
    ComparisonResult,
    ReviewRecord,
    ReconciliationSummary,
    ReviewStatus,
)


class DataStore:
    def __init__(self):
        self.claims: Dict[str, ClaimRecord] = {}
        self.flights: Dict[str, FlightInfo] = {}
        self.photos: Dict[str, PhotoIndex] = {}
        self.rules: Dict[str, CompensationRule] = {}
        self.comparison_results: Dict[str, ComparisonResult] = {}
        self.batch_id: str = str(uuid.uuid4())[:8]

    def add_claim(self, claim: ClaimRecord) -> None:
        self.claims[claim.claim_id] = claim

    def add_flight(self, flight: FlightInfo) -> None:
        key = f"{flight.flight_no}_{flight.flight_date.isoformat()}"
        self.flights[key] = flight

    def add_photo(self, photo: PhotoIndex) -> None:
        self.photos[photo.photo_id] = photo

    def add_rule(self, rule: CompensationRule) -> None:
        self.rules[rule.rule_id] = rule

    def get_flight(self, flight_no: str, flight_date) -> Optional[FlightInfo]:
        key = f"{flight_no}_{flight_date.isoformat()}"
        return self.flights.get(key)

    def get_photos_for_claim(self, claim_id: str) -> List[PhotoIndex]:
        return [p for p in self.photos.values() if p.claim_id == claim_id]

    def add_comparison_result(self, result: ComparisonResult) -> None:
        self.comparison_results[result.claim_id] = result

    def get_comparison_result(self, claim_id: str) -> Optional[ComparisonResult]:
        return self.comparison_results.get(claim_id)

    def update_comparison_result(self, claim_id: str, result: ComparisonResult) -> None:
        result.updated_at = datetime.now()
        self.comparison_results[claim_id] = result

    def add_review(self, claim_id: str, review: ReviewRecord) -> None:
        if claim_id in self.comparison_results:
            self.comparison_results[claim_id].review_record = review
            self.comparison_results[claim_id].final_amount = review.reviewed_amount
            self.comparison_results[claim_id].updated_at = datetime.now()

    def generate_summary(self) -> ReconciliationSummary:
        summary = ReconciliationSummary(batch_id=self.batch_id)
        summary.total_claims = len(self.comparison_results)

        for result in self.comparison_results.values():
            summary.total_claimed_amount += result.claimed_amount
            summary.total_suggested_amount += result.suggested_amount
            summary.total_approved_amount += result.final_amount

            status = result.review_record.status if result.review_record else result.auto_status

            if status == ReviewStatus.APPROVED:
                summary.approved_count += 1
            elif status == ReviewStatus.REJECTED:
                summary.rejected_count += 1
            elif status == ReviewStatus.NEED_MORE_INFO:
                summary.need_more_info_count += 1
            else:
                summary.pending_count += 1

            for disc in result.discrepancies:
                key = disc.type.value
                summary.discrepancy_breakdown[key] = summary.discrepancy_breakdown.get(key, 0) + 1

        return summary

    def get_all_results(self) -> List[ComparisonResult]:
        return list(self.comparison_results.values())

    def get_results_by_status(self, status: ReviewStatus) -> List[ComparisonResult]:
        results = []
        for result in self.comparison_results.values():
            current_status = result.review_record.status if result.review_record else result.auto_status
            if current_status == status:
                results.append(result)
        return results
