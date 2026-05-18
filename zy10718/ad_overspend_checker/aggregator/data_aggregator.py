from collections import defaultdict
from datetime import datetime
from typing import List, Dict, Any, Optional

from ..constants import ValidationType


class DataAggregator:
    def __init__(self):
        pass

    def aggregate_all(
        self,
        normal_records: List[Dict[str, Any]],
        overspend_records: List[Dict[str, Any]],
        delay_records: List[Dict[str, Any]],
        processing_issues: List[Dict[str, Any]],
        parse_warnings: Dict[str, List[str]],
    ) -> Dict[str, Any]:
        summary = {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_records": len(normal_records) + len(overspend_records) + len(delay_records),
            "normal_records": len(normal_records),
            "overspend_records": len(overspend_records),
            "delay_records": len(delay_records),
            "parse_warnings": parse_warnings,
            "processing_issues": processing_issues,
            "by_platform": self._aggregate_by_platform(
                normal_records + overspend_records + delay_records
            ),
            "by_date": self._aggregate_by_date(
                normal_records + overspend_records + delay_records
            ),
            "overspend_summary": self._summarize_overspend(overspend_records),
            "delay_summary": self._summarize_delay(delay_records),
            "top_overspend_plans": self._get_top_overspend_plans(overspend_records, top_n=10),
            "top_delay_plans": self._get_top_delay_plans(delay_records, top_n=10),
        }
        return summary

    def _aggregate_by_platform(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        by_platform = defaultdict(lambda: {"count": 0, "total_cost": 0.0, "total_budget": 0.0})

        for record in records:
            platform = record.get("platform", "unknown")
            by_platform[platform]["count"] += 1
            by_platform[platform]["total_cost"] += record.get("cost", 0) or 0
            by_platform[platform]["total_budget"] += record.get("budget", 0) or 0

        result = {}
        for platform, data in by_platform.items():
            avg_ratio = (
                data["total_cost"] / data["total_budget"]
                if data["total_budget"] > 0
                else 0
            )
            result[platform] = {
                "record_count": data["count"],
                "total_cost": round(data["total_cost"], 2),
                "total_budget": round(data["total_budget"], 2),
                "avg_cost_budget_ratio": round(avg_ratio, 2),
            }

        return result

    def _aggregate_by_date(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        by_date = defaultdict(lambda: {"count": 0, "total_cost": 0.0, "total_budget": 0.0})

        for record in records:
            date = record.get("date")
            if date:
                date_str = date.strftime("%Y-%m-%d")
                by_date[date_str]["count"] += 1
                by_date[date_str]["total_cost"] += record.get("cost", 0) or 0
                by_date[date_str]["total_budget"] += record.get("budget", 0) or 0

        result = {}
        for date_str in sorted(by_date.keys()):
            data = by_date[date_str]
            avg_ratio = (
                data["total_cost"] / data["total_budget"]
                if data["total_budget"] > 0
                else 0
            )
            result[date_str] = {
                "record_count": data["count"],
                "total_cost": round(data["total_cost"], 2),
                "total_budget": round(data["total_budget"], 2),
                "avg_cost_budget_ratio": round(avg_ratio, 2),
            }

        return result

    def _summarize_overspend(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not records:
            return {
                "total_overspend_amount": 0.0,
                "avg_overspend_ratio": 0.0,
                "max_overspend_ratio": 0.0,
                "affected_plans_count": 0,
                "affected_platforms": [],
            }

        total_overspend = sum(r.get("_overspend_amount", 0) or 0 for r in records)
        ratios = [r.get("_overspend_ratio", 0) or 0 for r in records]
        plan_ids = set(r.get("plan_id") for r in records if r.get("plan_id"))
        platforms = set(r.get("platform") for r in records if r.get("platform"))

        return {
            "total_overspend_amount": round(total_overspend, 2),
            "avg_overspend_ratio": round(sum(ratios) / len(ratios), 2) if ratios else 0,
            "max_overspend_ratio": round(max(ratios), 2) if ratios else 0,
            "affected_plans_count": len(plan_ids),
            "affected_platforms": list(platforms),
        }

    def _summarize_delay(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not records:
            return {
                "total_delay_hours": 0.0,
                "avg_delay_hours": 0.0,
                "max_delay_hours": 0.0,
                "affected_plans_count": 0,
                "affected_platforms": [],
            }

        delays = [r.get("_delay_hours", 0) or 0 for r in records]
        plan_ids = set(r.get("plan_id") for r in records if r.get("plan_id"))
        platforms = set(r.get("platform") for r in records if r.get("platform"))

        return {
            "total_delay_hours": round(sum(delays), 1),
            "avg_delay_hours": round(sum(delays) / len(delays), 1) if delays else 0,
            "max_delay_hours": round(max(delays), 1) if delays else 0,
            "affected_plans_count": len(plan_ids),
            "affected_platforms": list(platforms),
        }

    def _get_top_overspend_plans(
        self, records: List[Dict[str, Any]], top_n: int = 10
    ) -> List[Dict[str, Any]]:
        if not records:
            return []

        plan_overspend = defaultdict(lambda: {"total_overspend": 0.0, "max_ratio": 0.0, "records": []})

        for record in records:
            plan_id = record.get("plan_id", "unknown")
            plan_overspend[plan_id]["total_overspend"] += record.get("_overspend_amount", 0) or 0
            plan_overspend[plan_id]["max_ratio"] = max(
                plan_overspend[plan_id]["max_ratio"],
                record.get("_overspend_ratio", 0) or 0,
            )
            plan_overspend[plan_id]["records"].append(record)

        sorted_plans = sorted(
            plan_overspend.items(),
            key=lambda x: x[1]["total_overspend"],
            reverse=True,
        )

        result = []
        for plan_id, data in sorted_plans[:top_n]:
            sample_record = data["records"][0]
            result.append(
                {
                    "plan_id": plan_id,
                    "plan_name": sample_record.get("plan_name"),
                    "platform": sample_record.get("platform"),
                    "total_overspend": round(data["total_overspend"], 2),
                    "max_overspend_ratio": round(data["max_ratio"], 2),
                    "affected_days": len(data["records"]),
                }
            )

        return result

    def _get_top_delay_plans(
        self, records: List[Dict[str, Any]], top_n: int = 10
    ) -> List[Dict[str, Any]]:
        if not records:
            return []

        plan_delay = defaultdict(lambda: {"total_delay": 0.0, "max_delay": 0.0, "records": []})

        for record in records:
            plan_id = record.get("plan_id", "unknown")
            delay_hours = record.get("_delay_hours", 0) or 0
            plan_delay[plan_id]["total_delay"] += delay_hours
            plan_delay[plan_id]["max_delay"] = max(plan_delay[plan_id]["max_delay"], delay_hours)
            plan_delay[plan_id]["records"].append(record)

        sorted_plans = sorted(
            plan_delay.items(),
            key=lambda x: x[1]["total_delay"],
            reverse=True,
        )

        result = []
        for plan_id, data in sorted_plans[:top_n]:
            sample_record = data["records"][0]
            result.append(
                {
                    "plan_id": plan_id,
                    "plan_name": sample_record.get("plan_name"),
                    "platform": sample_record.get("platform"),
                    "total_delay_hours": round(data["total_delay"], 1),
                    "max_delay_hours": round(data["max_delay"], 1),
                    "affected_days": len(data["records"]),
                }
            )

        return result

    def export_details(self, records: List[Dict[str, Any]], record_type: str) -> List[Dict[str, Any]]:
        details = []
        for record in records:
            detail = {
                "type": record_type,
                "plan_id": record.get("plan_id"),
                "plan_name": record.get("plan_name"),
                "platform": record.get("platform"),
                "date": record.get("date").strftime("%Y-%m-%d") if record.get("date") else None,
                "cost": record.get("cost"),
                "budget": record.get("budget"),
                "source_file": record.get("_source_file"),
                "row_number": record.get("_row_num"),
            }

            if record_type == "overspend":
                detail.update(
                    {
                        "overspend_ratio": record.get("_overspend_ratio"),
                        "overspend_amount": record.get("_overspend_amount"),
                        "validation_note": record.get("_validation_note"),
                    }
                )
            elif record_type == "delay":
                detail.update(
                    {
                        "delay_hours": record.get("_delay_hours"),
                        "delay_days": record.get("_delay_days"),
                        "validation_note": record.get("_validation_note"),
                    }
                )

            details.append(detail)

        return details
