from typing import List, Dict, Any
from collections import defaultdict
from datetime import datetime
from .models import (
    MatchedResult,
    ReconciliationResult,
    AbnormalType,
    ReviewStatus,
)


class Analyzer:
    def __init__(self, matched_results: List[MatchedResult]):
        self.matched_results = matched_results

    def reconcile(self) -> ReconciliationResult:
        total_amount = 0.0
        abnormal_amount = 0.0
        normal_amount = 0.0
        abnormal_records = 0
        normal_records = 0

        pending_by_driver: Dict[str, List[MatchedResult]] = defaultdict(list)
        abnormal_type_counts: Dict[str, int] = defaultdict(int)

        for result in self.matched_results:
            fuel = result.fuel_record
            total_amount += fuel.fuel_amount

            if result.is_normal:
                normal_records += 1
                normal_amount += fuel.fuel_amount
            else:
                abnormal_records += 1
                abnormal_amount += fuel.fuel_amount

            for at in result.abnormal_types:
                if at != AbnormalType.NORMAL:
                    abnormal_type_counts[at.value] += 1

            driver = result.driver_name or "未匹配"
            if result.review_note:
                if result.review_note.status == ReviewStatus.PENDING:
                    pending_by_driver[driver].append(result)
            else:
                if not result.is_normal:
                    pending_by_driver[driver].append(result)

        summary = {
            "total_amount": total_amount,
            "abnormal_amount": abnormal_amount,
            "normal_amount": normal_amount,
            "total_records": len(self.matched_results),
            "abnormal_records": abnormal_records,
            "normal_records": normal_records,
            "abnormal_rate": round(abnormal_records / len(self.matched_results) * 100, 2) if self.matched_results else 0,
            "abnormal_type_counts": dict(abnormal_type_counts),
            "pending_review_count": sum(len(v) for v in pending_by_driver.values()),
            "reconciled_at": datetime.now().isoformat(),
        }

        return ReconciliationResult(
            total_amount=total_amount,
            abnormal_amount=abnormal_amount,
            normal_amount=normal_amount,
            total_records=len(self.matched_results),
            abnormal_records=abnormal_records,
            normal_records=normal_records,
            pending_review_drivers=dict(pending_by_driver),
            matched_results=self.matched_results,
            summary=summary,
        )

    def get_results_by_plate(self, plate_number: str) -> List[MatchedResult]:
        return [r for r in self.matched_results if r.fuel_record.plate_number == plate_number]

    def get_results_by_driver(self, driver_name: str) -> List[MatchedResult]:
        return [r for r in self.matched_results if r.driver_name == driver_name]

    def get_results_by_abnormal_type(self, abnormal_type: AbnormalType) -> List[MatchedResult]:
        return [r for r in self.matched_results if abnormal_type in r.abnormal_types]
