from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import uuid

from .models import AuditReport, Batch, Sample, RecheckRecord, SamplingRule
from .sampling import SamplingEngine
from .processor import BatchProcessor
from .data_cleaner import DataCleaner
from .io_handler import IOHandler, HistoryManager
from .reporting import ReportExporter


class AuditEngine:
    def __init__(self, work_dir: Path = None, history_dir: Path = None):
        self.work_dir = work_dir or Path.cwd()
        self.history_dir = history_dir or self.work_dir / ".qc-history"
        self.cleaner = DataCleaner()
        self.io = IOHandler(self.cleaner)
        self.history = HistoryManager(self.history_dir)

    def _generate_run_id(self) -> str:
        return datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]

    def load_rules(self, rules_path: Path) -> List[SamplingRule]:
        return self.io.load_sampling_rules(rules_path)

    def load_data(self, batches_path: Path, samples_path: Optional[Path] = None,
                  rechecks_path: Optional[Path] = None) -> List[Batch]:
        return self.io.load_batches(batches_path, samples_path, rechecks_path)

    def run_audit(self, rules: List[SamplingRule], batches: List[Batch],
                  declared_data: Optional[Dict[str, Dict]] = None,
                  run_id: Optional[str] = None,
                  command: str = "audit") -> AuditReport:
        run_id = run_id or self._generate_run_id()
        sampling_engine = SamplingEngine(rules)
        processor = BatchProcessor(sampling_engine)

        all_discrepancies: List[Dict] = []
        all_warnings: List[Dict] = []
        all_failed_samples: List[Dict] = []

        for batch in batches:
            declared = (declared_data or {}).get(batch.batch_id, {})
            result = processor.recalculate_from_scratch(
                batch,
                declared_pass_rate=declared.get("pass_rate"),
                declared_conclusion=declared.get("conclusion"),
            )
            all_discrepancies.extend(result["discrepancies"])
            all_warnings.extend(result["warnings"])
            all_failed_samples.extend(result["failed_samples"])

        total_samples = sum(len(b.samples) for b in batches)
        total_rechecks = sum(len(b.rechecks) for b in batches)
        total_defective = sum(b.defective_count for b in batches)
        overall_pass_rate = (total_samples - total_defective) / total_samples if total_samples > 0 else 1.0

        summary = {
            "run_id": run_id,
            "total_batches": len(batches),
            "total_samples": total_samples,
            "total_rechecks": total_rechecks,
            "total_defective": total_defective,
            "total_discrepancies": len(all_discrepancies),
            "total_warnings": len(all_warnings),
            "overall_pass_rate": overall_pass_rate,
            "failed_samples_count": len(all_failed_samples),
        }

        report = AuditReport(
            report_id=run_id,
            created_at=datetime.now(),
            batches=batches,
            rules=rules,
            discrepancies=all_discrepancies,
            summary=summary,
            dirty_data_warnings=all_warnings,
        )

        return report

    def export_report(self, report: AuditReport, output_dir: Path,
                      formats: List[str] = None) -> List[Path]:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        formats = formats or ["json", "text", "csv"]
        exported: List[Path] = []

        if "json" in formats:
            json_path = output_dir / f"report_{report.report_id}.json"
            self.io.save_json(ReportExporter.to_dict(report), json_path)
            exported.append(json_path)

        if "text" in formats:
            text_path = output_dir / f"report_{report.report_id}.txt"
            self.io.save_text(ReportExporter.to_text(report), text_path)
            exported.append(text_path)

        if "csv" in formats:
            csv_files = ReportExporter.to_csv(report)
            csv_dir = output_dir / f"csv_{report.report_id}"
            csv_dir.mkdir(exist_ok=True)
            for name, content in csv_files.items():
                csv_path = csv_dir / name
                self.io.save_csv(content, csv_path)
                exported.append(csv_path)

        return exported

    def run_full_audit(self, rules_path: Path, batches_path: Path,
                       samples_path: Optional[Path] = None,
                       rechecks_path: Optional[Path] = None,
                       declared_path: Optional[Path] = None,
                       output_dir: Optional[Path] = None,
                       formats: Optional[List[str]] = None,
                       save_history: bool = True) -> Dict[str, Any]:
        run_id = self._generate_run_id()
        output_dir = output_dir or self.work_dir / "output"

        self.cleaner.warnings = []
        rules = self.load_rules(rules_path)
        batches = self.load_data(batches_path, samples_path, rechecks_path)
        load_warnings = list(self.cleaner.warnings)

        declared_data = None
        if declared_path:
            declared_raw = self.io.load_file(declared_path)
            if isinstance(declared_raw, dict):
                if "declarations" in declared_raw:
                    declared_data = {d["batch_id"]: d for d in declared_raw["declarations"]}
                else:
                    declared_data = {str(k): v for k, v in declared_raw.items()}

        report = self.run_audit(rules, batches, declared_data, run_id, "audit")
        report.dirty_data_warnings = load_warnings + report.dirty_data_warnings
        report.summary["total_warnings"] = len(report.dirty_data_warnings)
        exported = self.export_report(report, output_dir, formats)

        if save_history:
            input_files = [str(rules_path), str(batches_path)]
            if samples_path:
                input_files.append(str(samples_path))
            if rechecks_path:
                input_files.append(str(rechecks_path))
            if declared_path:
                input_files.append(str(declared_path))
            
            self.history.record_run(
                run_id=run_id,
                command="audit",
                input_files=input_files,
                output_files=[str(p) for p in exported],
                summary=report.summary,
            )
            self.history.save_run_data(run_id, "report", ReportExporter.to_dict(report))

        return {
            "run_id": run_id,
            "report": report,
            "exported_files": exported,
            "summary": report.summary,
        }

    def recalculate_run(self, run_id: str, output_dir: Optional[Path] = None,
                        formats: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
        run_data = self.history.load_run_data(run_id, "report")
        if not run_data:
            return None

        rules_data = run_data.get("rules", [])
        batches_data = run_data.get("batches", [])

        rules = []
        for r in rules_data:
            bs_range = None
            if r.get("batch_size_range"):
                bs_range = tuple(r["batch_size_range"])
            rules.append(SamplingRule(
                rule_id=r["rule_id"],
                name=r["name"],
                description=r.get("description", ""),
                sample_size=r["sample_size"],
                pass_threshold=r["pass_threshold"],
                batch_size_range=bs_range,
            ))

        batches = []
        for b in batches_data:
            samples = []
            for s in b.get("samples", []):
                insp_time = None
                if s.get("inspection_time"):
                    insp_time = datetime.fromisoformat(s["inspection_time"])
                samples.append(Sample(
                    sample_id=s["sample_id"],
                    batch_id=b["batch_id"],
                    is_defective=s["is_defective"],
                    inspection_time=insp_time,
                    inspector=s.get("inspector"),
                    remark=s.get("remark"),
                    rework_count=s.get("rework_count", 0),
                ))
            
            rechecks = []
            for r in b.get("rechecks", []):
                rc_time = None
                if r.get("recheck_time"):
                    rc_time = datetime.fromisoformat(r["recheck_time"])
                rechecks.append(RecheckRecord(
                    sample_id=r["sample_id"],
                    original_result=r["original_result"],
                    recheck_result=r["recheck_result"],
                    recheck_time=rc_time or datetime.now(),
                    rechecker=r.get("rechecker"),
                    reason=r.get("reason"),
                ))
            
            prod_date = None
            if b.get("production_date"):
                prod_date = datetime.fromisoformat(b["production_date"])
            
            batches.append(Batch(
                batch_id=b["batch_id"],
                product=b["product"],
                total_quantity=b["total_quantity"],
                sample_quantity=b["sample_quantity"],
                production_date=prod_date,
                line=b.get("line"),
                samples=samples,
                rechecks=rechecks,
                merged_from=b.get("merged_from", []),
            ))

        new_run_id = self._generate_run_id() + "_recalc"
        report = self.run_audit(rules, batches, None, new_run_id, f"recalculate:{run_id}")
        
        output_dir = output_dir or self.work_dir / "output" / "recalculated"
        exported = self.export_report(report, output_dir, formats)

        return {
            "original_run_id": run_id,
            "new_run_id": new_run_id,
            "report": report,
            "exported_files": exported,
            "summary": report.summary,
        }

    def merge_and_audit(self, rules_path: Path, batches_path: Path,
                        merge_specs: List[Dict[str, Any]],
                        samples_path: Optional[Path] = None,
                        output_dir: Optional[Path] = None,
                        formats: Optional[List[str]] = None,
                        save_history: bool = True) -> Dict[str, Any]:
        run_id = self._generate_run_id()
        output_dir = output_dir or self.work_dir / "output"

        rules = self.load_rules(rules_path)
        batches = self.load_data(batches_path, samples_path)
        
        batch_map = {b.batch_id: b for b in batches}
        sampling_engine = SamplingEngine(rules)
        processor = BatchProcessor(sampling_engine)

        new_batches = []
        batch_ids_used = set()

        for spec in merge_specs:
            source_ids = spec.get("from", [])
            new_id = spec.get("to")
            
            if not new_id:
                new_id = "MERGED_" + "_".join(source_ids)
            
            source_batches = []
            for bid in source_ids:
                if bid in batch_map:
                    source_batches.append(batch_map[bid])
                    batch_ids_used.add(bid)
            
            if source_batches:
                merged = processor.merge_batches(source_batches, new_id)
                new_batches.append(merged)

        for batch in batches:
            if batch.batch_id not in batch_ids_used:
                new_batches.append(batch)

        all_warnings = list(self.cleaner.warnings) + list(processor.warnings)

        report = self.run_audit(rules, new_batches, None, run_id, "merge")
        report.dirty_data_warnings = all_warnings
        
        exported = self.export_report(report, output_dir, formats)

        if save_history:
            self.history.record_run(
                run_id=run_id,
                command="merge",
                input_files=[str(rules_path), str(batches_path)],
                output_files=[str(p) for p in exported],
                summary=report.summary,
            )
            self.history.save_run_data(run_id, "report", ReportExporter.to_dict(report))

        return {
            "run_id": run_id,
            "report": report,
            "exported_files": exported,
            "summary": report.summary,
            "merge_warnings": [w for w in all_warnings if "duplicate_sample_id" in w.get("code", "")],
        }
