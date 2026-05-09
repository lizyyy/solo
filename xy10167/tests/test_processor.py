from datetime import datetime
from qc_audit.models import Batch, Sample, RecheckRecord, SamplingRule
from qc_audit.sampling import SamplingEngine
from qc_audit.processor import BatchProcessor


class TestBatchProcessor:
    def setup_method(self):
        self.rule = SamplingRule("R001", "标准规则", "测试", 5, 0.8, (1, 10000))
        self.engine = SamplingEngine([self.rule])
        self.processor = BatchProcessor(self.engine)

    def test_merge_batches(self):
        batch1 = Batch(
            "B001", "产品A", 100, 3,
            samples=[
                Sample("S1", "B001", is_defective=False),
                Sample("S2", "B001", is_defective=True),
            ],
            rechecks=[
                RecheckRecord("S2", True, False, datetime.now()),
            ],
        )
        batch2 = Batch(
            "B002", "产品A", 200, 2,
            samples=[
                Sample("S3", "B002", is_defective=False),
                Sample("S4", "B002", is_defective=False),
            ],
        )

        merged = self.processor.merge_batches([batch1, batch2], "MERGED_001")
        
        assert merged.batch_id == "MERGED_001"
        assert merged.total_quantity == 300
        assert len(merged.samples) == 4
        assert len(merged.rechecks) == 1
        assert merged.merged_from == ["B001", "B002"]

    def test_apply_recheck_updates_result(self):
        batch = Batch(
            "B001", "产品A", 100, 3,
            samples=[
                Sample("S1", "B001", is_defective=True),
                Sample("S2", "B001", is_defective=False),
            ],
        )
        
        recheck = RecheckRecord(
            sample_id="S1",
            original_result=True,
            recheck_result=False,
            recheck_time=datetime.now(),
            reason="复检通过",
        )
        
        self.processor.apply_recheck(batch, recheck)
        
        assert len(batch.rechecks) == 1
        assert batch.defective_count == 0

    def test_apply_recheck_nonexistent_sample(self):
        batch = Batch("B001", "产品A", 100, 1, samples=[])
        
        recheck = RecheckRecord(
            sample_id="NONEXISTENT",
            original_result=True,
            recheck_result=False,
            recheck_time=datetime.now(),
        )
        
        self.processor.apply_recheck(batch, recheck)
        warnings = self.processor.warnings
        assert any(w["code"] == "sample_not_found" for w in warnings)

    def test_detect_pass_rate_discrepancy(self):
        batch = Batch(
            "B001", "产品A", 100, 5,
            samples=[Sample(f"S{i}", "B001", is_defective=False) for i in range(4)] +
                    [Sample("S4", "B001", is_defective=True)],
        )
        
        discrepancies = self.processor.detect_discrepancies(batch, declared_pass_rate=1.0)
        
        assert len(discrepancies) >= 1
        pass_rate_mismatch = [d for d in discrepancies if d["type"] == "pass_rate_mismatch"]
        assert len(pass_rate_mismatch) == 1

    def test_detect_conclusion_discrepancy(self):
        batch = Batch(
            "B001", "产品A", 100, 5,
            samples=[Sample(f"S{i}", "B001", is_defective=False) for i in range(3)] +
                    [Sample(f"S{i}", "B001", is_defective=True) for i in range(3, 5)],
        )
        
        discrepancies = self.processor.detect_discrepancies(batch, declared_conclusion="PASS")
        
        conclusion_mismatch = [d for d in discrepancies if d["type"] == "conclusion_mismatch"]
        assert len(conclusion_mismatch) == 1
        assert conclusion_mismatch[0]["calculated"] == "FAIL"

    def test_get_failed_samples_with_trace(self):
        batch = Batch(
            "B001", "产品A", 100, 3,
            samples=[
                Sample("S1", "B001", is_defective=True, rework_count=1),
                Sample("S2", "B001", is_defective=False),
                Sample("S3", "B001", is_defective=True),
            ],
            rechecks=[
                RecheckRecord("S3", True, False, datetime.now()),
            ],
        )
        
        failed = self.processor.get_failed_samples_with_trace(batch)
        
        assert len(failed) == 1
        assert failed[0]["sample_id"] == "S1"
        assert failed[0]["has_recheck"] is False

    def test_recalculate_from_scratch(self):
        batch = Batch(
            "B001", "产品A", 100, 5,
            samples=[
                Sample("S1", "B001", is_defective=False),
                Sample("S2", "B001", is_defective=True),
                Sample("S3", "B001", is_defective=False),
                Sample("S4", "B001", is_defective=False),
                Sample("S5", "B001", is_defective=True),
            ],
            rechecks=[
                RecheckRecord("S2", True, False, datetime.now()),
            ],
        )
        
        result = self.processor.recalculate_from_scratch(batch)
        
        assert result["statistics"]["original_pass_rate"] == 0.6
        assert result["statistics"]["rechecked_pass_rate"] == 0.8
        assert result["statistics"]["defective_after_recheck"] == 1
        assert result["statistics"]["recheck_count"] == 1
