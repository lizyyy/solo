from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .engine import ThermalRunawayEngine, normalize_row, parse_csv_to_rows
from .models import ProcessingStatus, ReviewDecision
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
        rows: Optional[List[Dict[str, Any]]] = None,
        csv_text: Optional[str] = None,
        source_name: str = "",
    ) -> Dict[str, Any]:
        if csv_text is not None:
            imported, skipped = self.engine.import_csv(csv_text, source_name=source_name or "csv_import")
        elif rows is not None:
            imported, skipped = self.engine.import_records(rows, source=source_name or "json_import")
        else:
            raise ValueError("rows 或 csv_text 至少传一个")

        all_suppression = self.engine.run_all_suppression_checks()

        self._engine_over = set()
        for r in self.engine.records:
            if r.status in (
                ProcessingStatus.THRESHOLD_EXCEEDED,
                ProcessingStatus.SUPPRESSED_BY_AVERAGE,
                ProcessingStatus.AWAITING_REVIEW,
                ProcessingStatus.CONFIRMED_ABNORMAL,
            ):
                self._engine_over.add(r.sensor_id)

        result = {
            "imported_count": len(imported),
            "skipped_count": len(skipped),
            "skipped_reasons": skipped,
            "over_threshold_sensors": sorted(self._engine_over),
            "suppression_findings": all_suppression,
            "source": source_name,
        }
        self._log_step("首次导入", f"导入{len(imported)}条，跳过{len(skipped)}条，覆盖{len(self._engine_over)}个传感器超阈值", result)
        return result

    def step2_attach_photos(
        self,
        photo_attachments: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        attached: List[Dict[str, Any]] = []
        for item in photo_attachments:
            sensor_id = item["sensor_id"]
            path = item["photo_path"]
            desc = item.get("description", "")
            by = item.get("attached_by", "")
            orig_row = item.get("original_row")
            if isinstance(orig_row, str) and orig_row == "":
                orig_row = None
            self.engine.attach_photo(sensor_id, path, desc, by, orig_row)
            attached.append({
                "sensor_id": sensor_id, "photo_path": path, "original_row": orig_row
            })

        over_threshold_results = self.store.get_over_threshold_results()
        unreviewed = sorted(set(
            r.sensor_id
            for r in over_threshold_results
            if r.status
            in (
                ProcessingStatus.THRESHOLD_EXCEEDED,
                ProcessingStatus.SUPPRESSED_BY_AVERAGE,
                ProcessingStatus.AWAITING_REVIEW,
            )
        ))

        result = {
            "attached_count": len(attached),
            "attachments": attached,
            "unreviewed_over_threshold_sensors": unreviewed,
            "note": "超阈值记录未自动归正常，需维修师傅复核",
        }
        self._log_step("补看工况照片", f"关联{len(attached)}张照片", result)
        return result

    def step3_update_unit_conversion(
        self,
        conversions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        updated: List[Dict[str, Any]] = []
        for conv in conversions:
            note = self.engine.update_unit_conversion(
                from_unit=conv["from_unit"],
                to_unit=conv["to_unit"],
                factor=float(conv["factor"]),
                description=conv.get("description", ""),
                updated_by=conv.get("updated_by", ""),
            )
            updated.append({"from": note.from_unit, "to": note.to_unit, "factor": note.factor})

        suppression_findings = self.engine.run_all_suppression_checks()

        result = {
            "updated_conversions": updated,
            "suppression_findings_after_conversion": suppression_findings,
        }
        self._log_step("单位换算说明更新", f"更新{len(updated)}条换算规则", result)
        return result

    def step4_he_gong_amendment(
        self,
        amendments: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        done: List[Dict[str, Any]] = []
        for am in amendments:
            sid = am["sensor_id"]
            row = int(am["original_row"])
            new_val = float(am["new_value"])
            note = am.get("amendment_note", "")
            ok = self.engine.amend_sensor_value(sid, row, new_val, note)
            if ok:
                done.append({"sensor_id": sid, "original_row": row, "ok": True})
        result = {"amended_count": len(done), "amendments": done}
        self.engine.run_all_suppression_checks()
        self._log_step("何工补录修正", f"何工完成{len(done)}条修正", result)
        return result

    def step5_manual_review(
        self,
        reviews: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        decisions: List[Dict[str, Any]] = []
        for rv in reviews:
            sid = rv["sensor_id"]
            row = int(rv["original_row"])
            final = ProcessingStatus(rv["final_status"]) if isinstance(rv["final_status"], str) else rv["final_status"]
            dec = self.engine.manual_review_decision(
                sensor_id=sid,
                original_row=row,
                final_status=final,
                original_statement=rv.get("original_statement", ""),
                amended_reason=rv.get("amended_reason", ""),
                reviewer=rv.get("reviewer", "维修师傅"),
                next_reviewer=rv.get("next_reviewer", ""),
                amended_value=rv.get("amended_value"),
            )
            if dec is not None:
                decisions.append(dec.to_dict())
        result = {"decisions_count": len(decisions), "decisions": decisions}
        self._log_step("人工复核", f"维修师傅复核完成{len(decisions)}条", result)
        return result

    def run_full_workflow(
        self,
        initial_rows: Optional[List[Dict[str, Any]]] = None,
        csv_text: Optional[str] = None,
        photo_attachments: Optional[List[Dict[str, Any]]] = None,
        unit_conversions: Optional[List[Dict[str, Any]]] = None,
        supplement_rows: Optional[List[Dict[str, Any]]] = None,
        amendments: Optional[List[Dict[str, Any]]] = None,
        manual_reviews: Optional[List[Dict[str, Any]]] = None,
        source_name: str = "",
    ) -> Dict[str, Any]:
        step1 = self.step1_import(rows=initial_rows, csv_text=csv_text, source_name=source_name)

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

        amendment_result = None
        if amendments:
            amendment_result = self.step4_he_gong_amendment(amendments)

        review_result = None
        if manual_reviews:
            review_result = self.step5_manual_review(manual_reviews)

        api_response = self.store.to_api_response()
        summary = self.store.to_summary()
        csv_output = self.store.to_csv()

        return {
            "step1_import": step1,
            "step2_photos": step2,
            "step3_unit_conversion": step3,
            "step4_amendment": amendment_result,
            "step5_review": review_result,
            "supplement": supplement_result,
            "final_result": api_response,
            "summary": summary,
            "csv_preview": "\n".join(csv_output.splitlines()[:5]) if csv_output else "",
            "workflow_log": self.workflow_log,
        }
