"""本地查询接口模块"""
from datetime import date
from typing import Any, Optional

from roast_trace.checker import CheckEngine
from roast_trace.models import (
    BatchStatus,
    CheckResult,
    CuppingRecord,
    GreenBeanBatch,
    PackagingLabel,
    RoastLog,
    ShipmentRecord,
)
from roast_trace.state import StateManager


class QueryEngine:
    def __init__(self, check_engine: CheckEngine, state_manager: StateManager):
        self.check_engine = check_engine
        self.state_manager = state_manager

    def query_roast_batch(self, roast_batch_id: str) -> dict[str, Any]:
        roast_log = self.check_engine.roast_logs.get(roast_batch_id)
        if not roast_log:
            return {"error": f"烘焙批次 {roast_batch_id} 不存在"}

        green_batches: list[dict[str, Any]] = []
        for green_batch_id in roast_log.green_batch_ids:
            green_batch = self.check_engine.green_batches.get(green_batch_id)
            if green_batch:
                green_batches.append(green_batch.model_dump(mode="json"))
            else:
                green_batches.append({"batch_id": green_batch_id, "error": "未注册的生豆批次"})

        cupping_records = [
            r.model_dump(mode="json")
            for r in self.check_engine.cupping_records.get(roast_batch_id, [])
        ]

        labels = [
            l.model_dump(mode="json")
            for l in self.check_engine.labels.get(roast_batch_id, [])
        ]

        shipments = self._find_shipments_for_batch(roast_batch_id)

        check_results = self._find_check_results_for_batch(roast_batch_id)

        reviews = self.state_manager.get_reviews(roast_batch_id)
        effective_status = self.state_manager.get_effective_status(roast_batch_id)

        auto_status = self.check_engine.get_batch_status(roast_batch_id)

        return {
            "roast_batch_id": roast_batch_id,
            "roast_log": roast_log.model_dump(mode="json"),
            "green_batches": green_batches,
            "cupping_records": cupping_records,
            "labels": labels,
            "shipments": shipments,
            "check_results": check_results,
            "reviews": reviews,
            "status": {
                "auto_detection": auto_status.value,
                "human_reviewed": effective_status.value if effective_status else None,
                "combined": self._get_combined_status(auto_status, effective_status).value,
            }
        }

    def query_green_batch(self, green_batch_id: str) -> dict[str, Any]:
        green_batch = self.check_engine.green_batches.get(green_batch_id)
        if not green_batch:
            return {"error": f"生豆批次 {green_batch_id} 不存在"}

        used_in_roasts: list[dict[str, Any]] = []
        for roast_batch_id, roast_log in self.check_engine.roast_logs.items():
            if green_batch_id in roast_log.green_batch_ids:
                used_in_roasts.append({
                    "roast_batch_id": roast_batch_id,
                    "roast_date": str(roast_log.roast_date),
                    "green_weight_kg": roast_log.green_weight_kg,
                })

        return {
            "green_batch": green_batch.model_dump(mode="json"),
            "used_in_roasts": used_in_roasts,
        }

    def query_shipments(
        self,
        store_name: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        roast_batch_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []

        for shipment in self.check_engine.shipments:
            if store_name and store_name.lower() not in shipment.store_name.lower():
                continue
            if start_date and shipment.shipment_date < start_date:
                continue
            if end_date and shipment.shipment_date > end_date:
                continue

            if roast_batch_id:
                has_batch = any(
                    item.get("roast_batch_id") == roast_batch_id
                    for item in shipment.items
                )
                if not has_batch:
                    continue

            results.append(shipment.model_dump(mode="json"))

        return results

    def query_flagged_batches(self) -> dict[str, Any]:
        flagged = self.check_engine.get_all_flagged_batches()
        all_check_results = self.check_engine.run_all_checks()

        result: dict[str, Any] = {
            "hold": [],
            "recall": [],
            "summary": {
                "total_flagged": len(flagged),
                "hold_count": 0,
                "recall_count": 0,
            }
        }

        for batch_id, status in flagged.items():
            batch_checks = self._find_check_results_for_batch(batch_id, all_check_results)
            reviews = self.state_manager.get_reviews(batch_id)
            effective_status = self.state_manager.get_effective_status(batch_id)

            batch_info = {
                "roast_batch_id": batch_id,
                "auto_status": status.value,
                "reviewed_status": effective_status.value if effective_status else None,
                "check_results": batch_checks,
                "reviews": reviews,
            }

            if status == BatchStatus.RECALL:
                result["recall"].append(batch_info)
                result["summary"]["recall_count"] += 1
            else:
                result["hold"].append(batch_info)
                result["summary"]["hold_count"] += 1

        return result

    def query_by_date_range(
        self,
        start_date: date,
        end_date: date,
    ) -> dict[str, Any]:
        roast_batches: list[dict[str, Any]] = []
        for batch_id, roast_log in self.check_engine.roast_logs.items():
            if start_date <= roast_log.roast_date <= end_date:
                status = self.check_engine.get_batch_status(batch_id)
                roast_batches.append({
                    "roast_batch_id": batch_id,
                    "roast_date": str(roast_log.roast_date),
                    "roaster": roast_log.roaster,
                    "status": status.value,
                })

        shipments: list[dict[str, Any]] = []
        for shipment in self.check_engine.shipments:
            if start_date <= shipment.shipment_date <= end_date:
                shipments.append(shipment.model_dump(mode="json"))

        return {
            "date_range": {
                "start": str(start_date),
                "end": str(end_date),
            },
            "roast_batches": roast_batches,
            "shipments": shipments,
        }

    def query_cupping_history(
        self,
        roast_batch_id: Optional[str] = None,
        min_score: Optional[float] = None,
        max_defect_points: Optional[float] = None,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []

        for batch_id, records in self.check_engine.cupping_records.items():
            if roast_batch_id and batch_id != roast_batch_id:
                continue

            for record in records:
                if min_score and record.overall < min_score:
                    continue
                if max_defect_points is not None and record.total_defect_points > max_defect_points:
                    continue

                results.append(record.model_dump(mode="json"))

        return results

    def _find_shipments_for_batch(self, roast_batch_id: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for shipment in self.check_engine.shipments:
            for item in shipment.items:
                if item.get("roast_batch_id") == roast_batch_id:
                    results.append({
                        "shipment_id": shipment.shipment_id,
                        "shipment_date": str(shipment.shipment_date),
                        "store_name": shipment.store_name,
                        "quantity": item.get("quantity", 0),
                        "product_name": item.get("product_name", ""),
                        "status": shipment.status,
                        "tracking_number": shipment.tracking_number,
                    })
        return results

    def _find_check_results_for_batch(
        self,
        roast_batch_id: str,
        all_results: Optional[dict[str, list[CheckResult]]] = None,
    ) -> list[dict[str, Any]]:
        if all_results is None:
            all_results = self.check_engine.run_all_checks()

        results: list[dict[str, Any]] = []
        for check_type, check_results in all_results.items():
            for result in check_results:
                if result.roast_batch_id == roast_batch_id:
                    results.append(result.model_dump(mode="json"))
        return results

    def _get_combined_status(
        self,
        auto_status: BatchStatus,
        reviewed_status: Optional[BatchStatus],
    ) -> BatchStatus:
        if reviewed_status:
            return reviewed_status
        return auto_status
