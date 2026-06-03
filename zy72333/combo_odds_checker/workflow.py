from __future__ import annotations

from datetime import datetime

from combo_odds_checker.importer import import_weight_table, flag_negative_as_missing
from combo_odds_checker.models import (
    BoundarySampleReport,
    ManualCorrection,
    NextContact,
    OldFormulaScreenshot,
    RerunRecord,
    SampleStatus,
    ScoringWeightTable,
)
from combo_odds_checker.reporter import generate_boundary_report, format_report_human


class WorkflowEngine:
    def __init__(self) -> None:
        self.table: ScoringWeightTable | None = None
        self.screenshots: list[OldFormulaScreenshot] = []
        self.report: BoundarySampleReport | None = None
        self.corrections: list[ManualCorrection] = []
        self.reruns: list[RerunRecord] = []
        self._screenshot_map: dict[str, list[str]] = {}

    def step1_import_table(self, table_id: str, raw_rows: list[dict], source: str = "csv") -> ScoringWeightTable:
        self.table = import_weight_table(table_id, raw_rows, source)
        flagged = flag_negative_as_missing(self.table)
        self._refresh_report()
        return self.table

    def step2_add_screenshot(self, screenshot: OldFormulaScreenshot) -> None:
        self.screenshots.append(screenshot)
        cat = screenshot.related_category
        if cat not in self._screenshot_map:
            self._screenshot_map[cat] = []
        self._screenshot_map[cat].append(screenshot.screenshot_id)
        self._refresh_report()

    def step3_update_report_after_screenshot(self) -> BoundarySampleReport:
        self._refresh_report()
        return self.report

    def apply_manual_correction(
        self,
        sample_id: str,
        new_value: float,
        reason: str,
        corrected_by: str = "教研负责人吴老师",
    ) -> ManualCorrection:
        if self.report is None:
            raise ValueError("请先导入评分权重表并生成报告。")

        sample = None
        for s in self.report.samples:
            if s.sample_id == sample_id:
                sample = s
                break
        if sample is None:
            raise ValueError(f"找不到样本 {sample_id}")

        old_value = sample.entry.raw_value if sample.entry.raw_value is not None else 0.0
        correction = ManualCorrection(
            correction_id=f"COR-{len(self.corrections)+1:03d}",
            sample_id=sample_id,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            corrected_by=corrected_by,
            corrected_at=datetime.now(),
        )
        self.corrections.append(correction)

        sample.entry.raw_value = new_value
        sample.entry.is_negative = new_value < 0
        sample.entry.old_table_treats_as_missing = new_value < 0
        sample.status = SampleStatus.CORRECTED
        sample.corrected_at = correction.corrected_at

        self._refresh_report()
        return correction

    def rerun(self) -> RerunRecord:
        if self.report is None:
            raise ValueError("请先导入评分权重表。")

        report_before = format_report_human(self.report)
        self._refresh_report()
        report_after = format_report_human(self.report)

        rerun = RerunRecord(
            rerun_id=f"RERUN-{len(self.reruns)+1:03d}",
            triggered_at=datetime.now(),
            corrections_applied=[c.correction_id for c in self.corrections],
            report_before=report_before,
            report_after=report_after,
        )
        self.reruns.append(rerun)
        return rerun

    def _refresh_report(self) -> None:
        if self.table is None:
            return
        self.report = generate_boundary_report(self.table, self._screenshot_map)

    def get_human_report(self) -> str:
        if self.report is None:
            return "尚未导入评分权重表，无法生成报告。"
        return format_report_human(self.report)

    def get_negative_as_missing_samples(self) -> list[dict]:
        if self.report is None:
            return []
        result = []
        for s in self.report.samples:
            if s.status == SampleStatus.NEGATIVE_TREATED_AS_MISSING:
                result.append({
                    "sample_id": s.sample_id,
                    "category": s.entry.category,
                    "raw_value": s.entry.raw_value,
                    "reason_kept": s.reason_kept,
                    "missing_materials": s.missing_materials,
                    "next_contact": s.next_contact.value,
                })
        return result
