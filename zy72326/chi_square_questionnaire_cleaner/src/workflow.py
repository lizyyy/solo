import json
from datetime import datetime
from .evidence import EvidenceChain, ProcessingStatus
from .result_store import ResultStore
from .chi_square_cleaner import ChiSquareCleaner
from .self_check import SelfChecker


class Workflow:
    def __init__(self):
        self.evidence = EvidenceChain()
        self.store = ResultStore()
        self.cleaner = ChiSquareCleaner(self.evidence, self.store)
        self.checker = SelfChecker(self.store, self.evidence)
        self._log: list[dict] = []

    def _add_log(self, step: str, action: str, detail: str = ""):
        self._log.append({
            "step": step,
            "action": action,
            "detail": detail,
            "timestamp": datetime.now().isoformat(),
        })

    def step1_import(self, filepath_or_rows, denominator_fields: list[str], count_fields: list[str], encoding: str = "utf-8") -> dict:
        self._add_log("step1_import", "start", f"denom_fields={denominator_fields}, count_fields={count_fields}")
        self.cleaner.configure(denominator_fields, count_fields)

        if isinstance(filepath_or_rows, str):
            import_result = self.cleaner.import_csv(filepath_or_rows, encoding)
        else:
            import_result = self.cleaner.import_rows(filepath_or_rows)

        self._add_log("step1_import", "complete", json.dumps(import_result, ensure_ascii=False))

        pending = self.evidence.get_by_anomaly_type("denominator_zero_empty_string")
        if pending:
            pending_ids = [r.evidence_id for r in pending]
            self._add_log(
                "step1_import", "flagged_for_review",
                f"分母为0却被填成空字符串的记录共{len(pending)}条，证据ID: {pending_ids}，已留待数据复核人复核，不自动归正常",
            )

        return import_result

    def step2_review_original_rows(self) -> dict:
        self._add_log("step2_review", "start")
        anomaly_rows = self.cleaner.list_anomaly_rows_for_review()
        pending_evidence = self.evidence.pending_review_records()

        review_data = []
        for ev in pending_evidence:
            original_row_data = self.cleaner.view_original_row(ev.original_row)
            review_data.append({
                "evidence_id": ev.evidence_id,
                "original_row": ev.original_row,
                "anomaly_type": ev.anomaly_type,
                "detail": ev.detail,
                "original_value": ev.original_value,
                "field_name": ev.field_name,
                "current_status": ev.current_status.value,
                "row_snapshot": original_row_data,
            })

        self._add_log("step2_review", "complete", f"Reviewed {len(review_data)} pending record(s)")
        return {
            "pending_count": len(review_data),
            "records": review_data,
        }

    def step2_supplement(self, evidence_id: str, new_values: dict) -> dict:
        self._add_log("step2_supplement", "start", f"evidence_id={evidence_id}, new_values={new_values}")

        rec = self.evidence.get_by_id(evidence_id)
        if rec is None:
            return {"error": f"Evidence {evidence_id} not found"}

        if rec.current_status not in (ProcessingStatus.PENDING_REVIEW, ProcessingStatus.AUTO_FLAGGED):
            return {"error": f"Evidence {evidence_id} status is {rec.current_status.value}, not pending review"}

        if rec.anomaly_type == "denominator_zero_empty_string":
            self._add_log(
                "step2_supplement", "note",
                f"分母为0空字符串记录(evidence_id={evidence_id})，补录后不自动归正常，仍留给数据复核人复核",
            )

        result = self.cleaner.supplement_row(evidence_id, new_values, self.evidence)
        self._add_log("step2_supplement", "complete", json.dumps(result, ensure_ascii=False))
        return result

    def step3_update_demo(self) -> dict:
        self._add_log("step3_demo_update", "start")

        self.cleaner._recalculate_chi_square()

        chi_result = self.store.get_chi_square_result()
        summary = self.store.get_summary()
        check_results = self.checker.run_all()

        self._add_log("step3_demo_update", "complete", json.dumps({
            "chi_square": chi_result,
            "summary": summary,
        }, ensure_ascii=False, default=str))

        return {
            "chi_square_result": chi_result,
            "summary": summary,
            "self_check": check_results,
        }

    def get_workflow_log(self) -> list[dict]:
        return list(self._log)

    def get_evidence_summary(self) -> dict:
        all_records = self.evidence.all_records()
        by_status = {}
        for r in all_records:
            by_status.setdefault(r.current_status.value, []).append(r.evidence_id)
        return {
            "total_evidence": len(all_records),
            "by_status": by_status,
        }

    def reviewer_confirm(self, evidence_id: str, confirmed: bool, note: str = "") -> dict:
        rec = self.evidence.get_by_id(evidence_id)
        if rec is None:
            return {"error": f"Evidence {evidence_id} not found"}
        new_status = ProcessingStatus.CONFIRMED_NORMAL if confirmed else ProcessingStatus.CONFIRMED_ANOMALY
        self.evidence.update_status(evidence_id, new_status, manual_change=note or f"Reviewer confirmed: {'normal' if confirmed else 'anomaly'}")
        self._add_log("reviewer_confirm", "complete", f"evidence_id={evidence_id}, status={new_status.value}")
        return {"evidence_id": evidence_id, "new_status": new_status.value}
