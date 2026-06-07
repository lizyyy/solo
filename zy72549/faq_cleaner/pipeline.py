import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from .models import (
    FAQRecord,
    ManualCorrection,
    EvaluationReport,
    RecordStatus,
    RecordSource,
)
from .cleaner import FAQCleaner


class CleaningPipeline:
    def __init__(self, output_dir: str = "./output"):
        self.cleaner = FAQCleaner()
        self.output_dir = output_dir
        self.batch_records: Dict[str, List[FAQRecord]] = {}
        self.reports: Dict[str, EvaluationReport] = {}
        os.makedirs(output_dir, exist_ok=True)

    def step1_import_model_output(
        self,
        records: List[FAQRecord],
        batch_id: str,
        manual_corrections: Optional[List[ManualCorrection]] = None,
    ) -> Dict[str, Any]:
        if manual_corrections:
            self.cleaner.load_manual_corrections(manual_corrections)

        processed_records = []
        all_conflicts = []

        for record in records:
            processed, conflicts = self.cleaner.process_record(record, batch_id)
            processed_records.append(processed)
            if conflicts:
                all_conflicts.extend(conflicts)
            self.cleaner.processed_records[processed.faq_id] = processed

        self.batch_records[batch_id] = processed_records

        result = {
            "step": "step1_import_model_output",
            "batch_id": batch_id,
            "timestamp": datetime.now().isoformat(),
            "total_processed": len(processed_records),
            "conflict_count": len(all_conflicts),
            "conflicts": [
                {
                    "faq_id": c.faq_id,
                    "field": c.field_name,
                    "model_value": c.model_value,
                    "manual_value": c.manual_value,
                    "description": c.description,
                }
                for c in all_conflicts
            ],
        }

        self._save_step_result(batch_id, "step1_import", result)
        return result

    def step2_review_manual_corrections(
        self,
        batch_id: str,
        reviewer: str = "老唐",
        conflict_resolutions: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        records = self.batch_records.get(batch_id, [])
        conflict_resolutions = conflict_resolutions or {}

        reviewed_records = []
        resolved_count = 0
        pending_count = 0

        for record in records:
            if record.status == RecordStatus.CONFLICT:
                if record.faq_id in conflict_resolutions:
                    resolution = conflict_resolutions[record.faq_id]
                    self.cleaner.resolve_conflict(
                        faq_id=record.faq_id,
                        operator=reviewer,
                        accept_manual=resolution.get("accept_manual", True),
                        resolution_note=resolution.get("note", ""),
                    )
                    resolved_count += 1
                else:
                    pending_count += 1
            reviewed_records.append(record)

        self.batch_records[batch_id] = reviewed_records

        result = {
            "step": "step2_review_manual_corrections",
            "batch_id": batch_id,
            "timestamp": datetime.now().isoformat(),
            "reviewer": reviewer,
            "resolved_conflicts": resolved_count,
            "pending_conflicts": pending_count,
            "records_summary": self._get_records_summary(reviewed_records),
        }

        self._save_step_result(batch_id, "step2_review", result)
        return result

    def step3_generate_evaluation_report(
        self, batch_id: str
    ) -> Dict[str, Any]:
        records = self.batch_records.get(batch_id, [])

        report_id = f"report_{batch_id}_{uuid.uuid4().hex[:8]}"
        report = EvaluationReport(
            report_id=report_id,
            batch_id=batch_id,
            generate_time=datetime.now(),
        )

        report.total_records = len(records)
        details = []

        for record in records:
            detail = {
                "faq_id": record.faq_id,
                "question": record.question,
                "status": record.status.value,
                "source": record.source.value,
                "remarks": record.remarks,
                "history": record.history,
                "has_manual_correction": record.manual_correction is not None,
                "review_required": record.review_required,
            }
            details.append(detail)

            if record.status == RecordStatus.NORMAL:
                report.normal_count += 1
            elif record.status == RecordStatus.MANUAL_CORRECTED:
                report.manual_corrected_count += 1
            elif record.status == RecordStatus.OVERWRITTEN:
                report.overwritten_count += 1
            elif record.status == RecordStatus.SUPPLEMENTED:
                report.supplemented_count += 1
            elif record.status == RecordStatus.CONFLICT:
                report.conflict_count += 1

            if record.review_required:
                report.pending_review_count += 1

        report.details = details
        report.summary = self._generate_summary(report)

        self.reports[batch_id] = report

        result = {
            "step": "step3_generate_evaluation_report",
            "batch_id": batch_id,
            "timestamp": datetime.now().isoformat(),
            "report": report.to_dict(),
        }

        self._save_step_result(batch_id, "step3_report", result)
        self._save_report(report)
        return result

    def supplement_records(
        self,
        batch_id: str,
        supplement_records: List[FAQRecord],
    ) -> Dict[str, Any]:
        processed = []
        for record in supplement_records:
            processed_record, _ = self.cleaner.process_record(
                record, batch_id, is_supplement=True
            )
            processed.append(processed_record)
            self.cleaner.processed_records[processed_record.faq_id] = processed_record

        if batch_id in self.batch_records:
            self.batch_records[batch_id].extend(processed)
        else:
            self.batch_records[batch_id] = processed

        result = {
            "step": "supplement_records",
            "batch_id": batch_id,
            "timestamp": datetime.now().isoformat(),
            "supplemented_count": len(processed),
            "supplemented_faq_ids": [r.faq_id for r in processed],
        }

        self._save_step_result(batch_id, "supplement", result)
        return result

    def _get_records_summary(self, records: List[FAQRecord]) -> Dict[str, int]:
        summary = {}
        for status in RecordStatus:
            summary[status.value] = sum(
                1 for r in records if r.status == status
            )
        return summary

    def _generate_summary(self, report: EvaluationReport) -> str:
        parts = [
            f"批次 {report.batch_id} 评测报告",
            f"共处理 {report.total_records} 条记录",
            f"- 正常记录：{report.normal_count} 条",
            f"- 人工改判：{report.manual_corrected_count} 条",
            f"- 被覆盖待复核：{report.overwritten_count} 条",
            f"- 补录旧口径：{report.supplemented_count} 条",
            f"- 待解决冲突：{report.conflict_count} 条",
            f"- 待安全审核：{report.pending_review_count} 条",
        ]
        if report.overwritten_count > 0:
            parts.append(f"⚠️  有 {report.overwritten_count} 条人工改判被覆盖，需安全审核同事复核")
        if report.conflict_count > 0:
            parts.append(f"⚠️  有 {report.conflict_count} 条冲突待算法运营确认")
        return "\n".join(parts)

    def _save_step_result(self, batch_id: str, step_name: str, result: Dict[str, Any]):
        path = os.path.join(
            self.output_dir, f"{batch_id}_{step_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

    def _save_report(self, report: EvaluationReport):
        path = os.path.join(
            self.output_dir, f"{report.report_id}.json"
        )
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)

    def get_replay_command(self, batch_id: str) -> str:
        return (
            f"python -m faq_cleaner.cli run "
            f"--batch-id {batch_id} "
            f"--output-dir {self.output_dir}"
        )

    def get_history(self, faq_id: str) -> Optional[Dict[str, Any]]:
        record = self.cleaner.processed_records.get(faq_id)
        if not record:
            return None
        return {
            "faq_id": record.faq_id,
            "current_status": record.status.value,
            "remarks": record.remarks,
            "history": record.history,
        }
