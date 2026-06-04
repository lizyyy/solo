from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .engine import ThermalRunawayEngine
from .models import ProcessingStatus
from .result_store import ResultStore


class Workflow:
    def __init__(self, engine: ThermalRunawayEngine, store: ResultStore):
        self.engine = engine
        self.store = store
        self.workflow_log: List[Dict[str, Any]] = []

    def _log_step(self, step: str, detail: str, data: Any = None) -> None:
        entry = {
            "step": step,
            "detail": detail,
            "timestamp": datetime.now().isoformat(),
        }
        if data is not None:
            entry["data"] = data
        self.workflow_log.append(entry)
        self.store.invalidate()

    def step1_import(
        self,
        rows: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        imported, skipped = self.engine.import_records(rows)
        over_threshold_sensors = set(
            r.sensor_id for r in imported if r.status == ProcessingStatus.THRESHOLD_EXCEEDED
        )

        suppression_findings: List[Dict[str, Any]] = []
        for sid in over_threshold_sensors:
            findings = self.engine.compute_average_suppression_check(sid)
            suppression_findings.extend(findings)

        result = {
            "imported_count": len(imported),
            "skipped_count": len(skipped),
            "skipped_reasons": skipped,
            "over_threshold_sensors": list(over_threshold_sensors),
            "suppression_findings": suppression_findings,
        }
        self._log_step("首次导入", f"导入{len(imported)}条，跳过{len(skipped)}条", result)
        return result

    def step2_attach_photos(
        self,
        photo_attachments: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        attached: List[Dict[str, str]] = []
        for item in photo_attachments:
            sensor_id = item["sensor_id"]
            path = item["photo_path"]
            desc = item.get("description", "")
            by = item.get("attached_by", "")
            self.engine.attach_photo(sensor_id, path, desc, by)
            attached.append({"sensor_id": sensor_id, "photo_path": path})

        over_threshold_results = self.store.get_over_threshold_results()
        unreviewed = [
            r.sensor_id
            for r in over_threshold_results
            if r.status
            in (
                ProcessingStatus.THRESHOLD_EXCEEDED,
                ProcessingStatus.SUPPRESSED_BY_AVERAGE,
            )
        ]

        result = {
            "attached_count": len(attached),
            "attachments": attached,
            "unreviewed_over_threshold_sensors": list(set(unreviewed)),
            "note": "超阈值记录未自动归正常，需维修师傅复核",
        }
        self._log_step("补看工况照片", f"关联{len(attached)}张照片", result)
        return result

    def step3_update_unit_conversion(
        self,
        conversions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        updated: List[Dict[str, str]] = []
        for conv in conversions:
            note = self.engine.update_unit_conversion(
                from_unit=conv["from_unit"],
                to_unit=conv["to_unit"],
                factor=conv["factor"],
                description=conv.get("description", ""),
                updated_by=conv.get("updated_by", ""),
            )
            updated.append({"from": note.from_unit, "to": note.to_unit, "factor": note.factor})

        suppression_findings: List[Dict[str, Any]] = []
        all_sensor_ids = set(r.sensor_id for r in self.engine.records)
        for sid in all_sensor_ids:
            findings = self.engine.compute_average_suppression_check(sid)
            suppression_findings.extend(findings)

        result = {
            "updated_conversions": updated,
            "suppression_findings_after_conversion": suppression_findings,
        }
        self._log_step("单位换算说明更新", f"更新{len(updated)}条换算规则", result)
        return result

    def run_full_workflow(
        self,
        initial_rows: List[Dict[str, Any]],
        photo_attachments: Optional[List[Dict[str, str]]] = None,
        unit_conversions: Optional[List[Dict[str, Any]]] = None,
        supplement_rows: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        step1 = self.step1_import(initial_rows)

        step2 = self.step2_attach_photos(photo_attachments or [])

        step3 = self.step3_update_unit_conversion(unit_conversions or [])

        supplement_result = None
        if supplement_rows:
            imported, events = self.engine.recalculate_after_supplement(supplement_rows)
            self.store.invalidate()
            supplement_result = {
                "supplemented_count": len(imported),
                "new_events_count": len(events),
            }
            self._log_step("补录后重算", f"补录{len(imported)}条", supplement_result)

        api_response = self.store.to_api_response()

        return {
            "step1_import": step1,
            "step2_photos": step2,
            "step3_unit_conversion": step3,
            "supplement": supplement_result,
            "final_result": api_response,
            "workflow_log": self.workflow_log,
        }
