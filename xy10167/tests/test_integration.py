import json
import tempfile
from pathlib import Path
from datetime import datetime

from qc_audit.audit_engine import AuditEngine
from qc_audit.examples import generate_examples


class TestIntegration:
    def setup_method(self):
        self.tmp_dir = Path(tempfile.mkdtemp())
        self.work_dir = self.tmp_dir / "work"
        self.history_dir = self.tmp_dir / "history"
        self.engine = AuditEngine(self.work_dir, self.history_dir)

    def test_generate_and_load_examples(self):
        examples_dir = self.tmp_dir / "examples"
        count = generate_examples(examples_dir)
        assert count >= 10
        assert (examples_dir / "rules.yaml").exists()
        assert (examples_dir / "batches.json").exists()
        assert (examples_dir / "declared.json").exists()

    def test_full_audit_workflow(self):
        examples_dir = self.tmp_dir / "examples"
        generate_examples(examples_dir)

        result = self.engine.run_full_audit(
            rules_path=examples_dir / "rules.yaml",
            batches_path=examples_dir / "batches.json",
            declared_path=examples_dir / "declared.json",
            output_dir=self.tmp_dir / "output",
            formats=["json", "text"],
            save_history=True,
        )

        assert result["run_id"] is not None
        assert result["summary"]["total_batches"] == 3
        assert result["summary"]["total_samples"] == 31
        assert result["summary"]["total_rechecks"] == 1
        assert len(result["exported_files"]) >= 2

        runs = self.engine.history.list_runs()
        assert len(runs) == 1

    def test_audit_detects_discrepancies(self):
        examples_dir = self.tmp_dir / "examples"
        generate_examples(examples_dir)

        result = self.engine.run_full_audit(
            rules_path=examples_dir / "rules.yaml",
            batches_path=examples_dir / "batches.json",
            declared_path=examples_dir / "declared.json",
            output_dir=self.tmp_dir / "output",
            formats=["json"],
            save_history=False,
        )

        discrepancies = result["report"].discrepancies
        assert len(discrepancies) > 0
        
        pass_rate_mismatches = [d for d in discrepancies if d["type"] == "pass_rate_mismatch"]
        assert len(pass_rate_mismatches) > 0

    def test_merge_and_audit(self):
        examples_dir = self.tmp_dir / "examples"
        generate_examples(examples_dir)

        merge_spec = [
            {
                "from": ["B20260501-001", "B20260501-002"],
                "to": "MERGED_BATCH",
            }
        ]

        result = self.engine.merge_and_audit(
            rules_path=examples_dir / "rules.yaml",
            batches_path=examples_dir / "batches.json",
            merge_specs=merge_spec,
            output_dir=self.tmp_dir / "output_merge",
            formats=["json"],
            save_history=False,
        )

        batch_ids = [b.batch_id for b in result["report"].batches]
        assert "MERGED_BATCH" in batch_ids
        assert "B20260502-001" in batch_ids

        merged = next(b for b in result["report"].batches if b.batch_id == "MERGED_BATCH")
        assert len(merged.samples) == 26
        assert merged.total_quantity == 2700

    def test_recalculate_from_history(self):
        examples_dir = self.tmp_dir / "examples"
        generate_examples(examples_dir)

        result1 = self.engine.run_full_audit(
            rules_path=examples_dir / "rules.yaml",
            batches_path=examples_dir / "batches.json",
            output_dir=self.tmp_dir / "output1",
            formats=["json"],
            save_history=True,
        )

        original_run_id = result1["run_id"]

        result2 = self.engine.recalculate_run(
            run_id=original_run_id,
            output_dir=self.tmp_dir / "output_recalc",
            formats=["json"],
        )

        assert result2 is not None
        assert result2["original_run_id"] == original_run_id
        assert result2["summary"]["total_batches"] == result1["summary"]["total_batches"]
        assert result2["summary"]["total_samples"] == result1["summary"]["total_samples"]
        assert abs(result2["summary"]["overall_pass_rate"] - result1["summary"]["overall_pass_rate"]) < 1e-6

    def test_dirty_data_handling(self):
        examples_dir = self.tmp_dir / "examples"
        generate_examples(examples_dir)

        result = self.engine.run_full_audit(
            rules_path=examples_dir / "rules.yaml",
            batches_path=examples_dir / "dirty_data_example.json",
            output_dir=self.tmp_dir / "output_dirty",
            formats=["json"],
            save_history=False,
        )

        warnings = result["report"].dirty_data_warnings
        assert len(warnings) > 0

    def test_report_export_formats(self):
        examples_dir = self.tmp_dir / "examples"
        generate_examples(examples_dir)

        result = self.engine.run_full_audit(
            rules_path=examples_dir / "rules.yaml",
            batches_path=examples_dir / "batches.json",
            output_dir=self.tmp_dir / "output_all",
            formats=["json", "text", "csv"],
            save_history=False,
        )

        exported = result["exported_files"]
        
        json_files = [f for f in exported if str(f).endswith(".json")]
        text_files = [f for f in exported if str(f).endswith(".txt")]
        csv_files = [f for f in exported if str(f).endswith(".csv")]

        assert len(json_files) == 1
        assert len(text_files) == 1
        assert len(csv_files) == 5

        with open(json_files[0], "r", encoding="utf-8") as f:
            data = json.load(f)
            assert "report_id" in data
            assert "summary" in data
            assert "batches" in data
