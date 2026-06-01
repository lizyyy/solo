import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict

from .models.models import (
    SensorRecord,
    ThresholdConfig,
    CalculationResult,
    AuditEntry,
    DataGap,
    UnitIssue,
    NoteSupplement,
    ProcessingSession,
)
from .ingestion.parser import SensorLogParser
from .ingestion.gap_detector import GapDetector
from .ingestion.unit_checker import UnitChecker
from .calc.calculator import LiftDragCalculator
from .calc.threshold_manager import ThresholdManager


class SessionCoordinator:
    def __init__(self, output_dir: str = "./output"):
        self.session = ProcessingSession()
        self.parser = SensorLogParser()
        self.gap_detector = GapDetector()
        self.unit_checker = UnitChecker()
        self.calculator = LiftDragCalculator()
        self.threshold_mgr = ThresholdManager()
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._records: List[SensorRecord] = []
        self._results: List[CalculationResult] = []

    def init_threshold(self, config: ThresholdConfig):
        self.threshold_mgr.add_config(config)
        self.session.threshold_configs.append(config.to_dict())
        self.session.active_threshold_id = config.config_id
        self._log_audit("session_init", "system", f"初始化阈值配置 {config.config_id}")

    def run_batch(self, filepaths: List[str], batch_label: str = "") -> Dict:
        self.session.batch_label = batch_label or f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.session.source_files = filepaths

        all_records = []
        for fp in filepaths:
            recs = self.parser.parse_file(fp)
            all_records.extend(recs)

        self._log_audit("data_loaded", "system", f"加载 {len(filepaths)} 个文件, 共 {len(all_records)} 条记录")

        gaps = self.gap_detector.detect(all_records)
        self.session.data_gaps = self.gap_detector.gap_summary()
        self._log_audit("gap_detected", "system", f"检测到 {len(gaps)} 处采样缺口")

        normalized = self.unit_checker.normalize_all(all_records)
        self.session.unit_issues = self.unit_checker.issues_summary()
        self._log_audit("unit_normalized", "system", f"单位转换 {len(self.unit_checker.issues)} 处")

        threshold = self.threshold_mgr.get_active()
        if threshold is None:
            threshold = ThresholdConfig(reason="auto_default")
            self.init_threshold(threshold)

        results = self.calculator.compute_batch(normalized, threshold)
        self._results = results
        self._records = normalized

        for r in results:
            matching_gaps = [g for g in gaps if g.start_time <= r.timestamp <= g.end_time]
            r.data_gap_ids = [g.gap_id for g in matching_gaps]

            matching_issues = [
                ui for ui in self.unit_checker.issues
                if ui.record_id == r.record_id
            ]
            r.unit_issue_ids = [ui.issue_id for ui in matching_issues]

        self.session.results = [r.to_dict() for r in results]

        violations = [r for r in results if r.exceeds_threshold]
        self._log_audit(
            "calculation_complete",
            "system",
            f"计算完成: {len(results)} 条结果, {len(violations)} 条超阈值, 阈值版本: {threshold.config_id[:6]}",
        )

        self.session.finished_at = datetime.now()
        return self._build_summary(results, gaps, violations)

    def add_note_supplement(
        self,
        note_text: str,
        affected_record_ids: List[str],
        new_values: Dict,
        author: str = "manual",
    ) -> NoteSupplement:
        previous_values = {}
        for r in self._results:
            if r.record_id in affected_record_ids:
                previous_values[r.record_id] = {
                    "cl": r.cl,
                    "cd": r.cd,
                    "ld_ratio": r.ld_ratio,
                }

        supplement = NoteSupplement(
            author=author,
            note_text=note_text,
            affected_record_ids=affected_record_ids,
            previous_values=previous_values,
            new_values=new_values,
        )
        supplement.compute_diff()

        self.session.note_supplements.append(supplement.to_dict())
        self._log_audit(
            "note_supplement",
            author,
            f"补录备注: {note_text[:50]}, 影响 {len(affected_record_ids)} 条, 差异: {supplement.diff_description}",
        )

        return supplement

    def override_threshold(
        self, field_name: str, new_value: float, reason: str, actor: str = "manual"
    ) -> Optional[ThresholdConfig]:
        new_config = self.threshold_mgr.override_threshold(field_name, new_value, reason, actor)
        if new_config is None:
            return None

        self.session.threshold_configs.append(new_config.to_dict())
        self.session.active_threshold_id = new_config.config_id

        threshold = self.threshold_mgr.get_active()
        recompute = self.calculator.compute_batch(self._records, threshold)

        for r in recompute:
            matching_gaps = [g for g in self.gap_detector.gaps if g.start_time <= r.timestamp <= g.end_time]
            r.data_gap_ids = [g.gap_id for g in matching_gaps]
            matching_issues = [
                ui for ui in self.unit_checker.issues if ui.record_id == r.record_id
            ]
            r.unit_issue_ids = [ui.issue_id for ui in matching_issues]

        self._results = recompute
        self.session.results = [r.to_dict() for r in recompute]

        self._log_audit(
            "recompute_after_override",
            actor,
            f"阈值修改后重新计算, 新阈值版本: {new_config.config_id[:6]}, 结果数: {len(recompute)}",
            threshold_config_id=new_config.config_id,
        )

        return new_config

    def get_results(self) -> List[CalculationResult]:
        return self._results

    def get_records(self) -> List[SensorRecord]:
        return self._records

    def save_session(self, filename: str = None):
        fname = filename or f"session_{self.session.session_id}.json"
        path = self.output_dir / fname
        data = {
            "session_id": self.session.session_id,
            "started_at": self.session.started_at.isoformat(),
            "finished_at": self.session.finished_at.isoformat() if self.session.finished_at else None,
            "batch_label": self.session.batch_label,
            "source_files": self.session.source_files,
            "active_threshold_id": self.session.active_threshold_id,
            "threshold_version_chain": self.threshold_mgr.get_version_chain(),
            "data_gaps": self.session.data_gaps,
            "unit_issues": self.session.unit_issues,
            "results": self.session.results,
            "audit_log": self.threshold_mgr.audit_summary(),
            "note_supplements": self.session.note_supplements,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        return str(path)

    def _build_summary(self, results, gaps, violations) -> Dict:
        return {
            "total_records": len(self._records),
            "total_results": len(results),
            "data_gaps": len(gaps),
            "unit_issues": len(self.unit_checker.issues),
            "threshold_violations": len(violations),
            "violation_details": [
                {
                    "record_id": v.record_id,
                    "aoa": v.angle_of_attack,
                    "cl": round(v.cl, 4),
                    "cd": round(v.cd, 4),
                    "ld_ratio": round(v.ld_ratio, 2),
                    "detail": v.threshold_violation_detail,
                    "threshold_version": v.threshold_version,
                }
                for v in violations
            ],
            "active_threshold": self.threshold_mgr.get_active().to_dict() if self.threshold_mgr.get_active() else None,
        }

    def _log_audit(self, action: str, actor: str, details: str, **kwargs):
        entry = AuditEntry(
            action=action,
            actor=actor,
            details=details,
            threshold_config_id=kwargs.get("threshold_config_id", ""),
        )
        self.session.audit_log.append(entry.to_dict())
