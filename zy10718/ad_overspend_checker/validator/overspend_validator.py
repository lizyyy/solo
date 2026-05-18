from datetime import datetime
from typing import List, Dict, Any, Tuple

from ..constants import OVERSPEND_THRESHOLD, ValidationType


class OverspendValidator:
    def __init__(self, threshold: float = None):
        self.threshold = threshold or OVERSPEND_THRESHOLD

    def validate(
        self, records: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        overspend_records = []
        normal_records = []

        for record in records:
            validation_result = self._check_overspend(record)
            if validation_result:
                overspend_records.append(validation_result)
            else:
                normal_records.append(record)

        return normal_records, overspend_records

    def _check_overspend(self, record: Dict[str, Any]) -> Dict[str, Any]:
        cost = record.get("cost", 0) or 0
        budget = record.get("budget", 0) or 0

        if budget <= 0:
            return None

        ratio = cost / budget if budget > 0 else 0

        if ratio >= self.threshold:
            return {
                **record,
                "_validation_type": ValidationType.OVERSPEND.value,
                "_overspend_ratio": round(ratio, 2),
                "_overspend_amount": round(cost - budget, 2),
                "_threshold": self.threshold,
                "_validation_note": f"消耗超预算 {round((ratio - 1) * 100, 1)}%",
            }

        return None

    def validate_grouped(
        self, records: List[Dict[str, Any]], group_by: str = "plan_id"
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        from collections import defaultdict

        grouped = defaultdict(list)
        for record in records:
            key = record.get(group_by, "unknown")
            grouped[key].append(record)

        all_overspend = []
        all_normal = []

        for key, group_records in grouped.items():
            total_cost = sum(r.get("cost", 0) or 0 for r in group_records)
            total_budget = sum(r.get("budget", 0) or 0 for r in group_records)

            if total_budget > 0:
                ratio = total_cost / total_budget
                if ratio >= self.threshold:
                    for record in group_records:
                        record["_group_overspend"] = {
                            "group_key": key,
                            "total_cost": round(total_cost, 2),
                            "total_budget": round(total_budget, 2),
                            "ratio": round(ratio, 2),
                        }
                    all_overspend.extend(group_records)
                else:
                    all_normal.extend(group_records)
            else:
                all_normal.extend(group_records)

        return all_normal, all_overspend
