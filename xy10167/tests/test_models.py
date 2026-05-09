from datetime import datetime
from qc_audit.models import Batch, Sample, RecheckRecord, SamplingRule


class TestModels:
    def test_sample_creation(self):
        sample = Sample(
            sample_id="S001",
            batch_id="B001",
            is_defective=False,
        )
        assert sample.sample_id == "S001"
        assert sample.batch_id == "B001"
        assert sample.is_defective is False
        assert sample.rework_count == 0

    def test_batch_pass_rate_calculation(self):
        batch = Batch(
            batch_id="B001",
            product="测试产品",
            total_quantity=1000,
            sample_quantity=10,
            samples=[
                Sample(sample_id="S001", batch_id="B001", is_defective=False),
                Sample(sample_id="S002", batch_id="B001", is_defective=False),
                Sample(sample_id="S003", batch_id="B001", is_defective=True),
                Sample(sample_id="S004", batch_id="B001", is_defective=False),
                Sample(sample_id="S005", batch_id="B001", is_defective=False),
            ],
        )
        assert batch.pass_rate == 0.8
        assert batch.defective_count == 1

    def test_batch_recheck_override(self):
        batch = Batch(
            batch_id="B001",
            product="测试产品",
            total_quantity=1000,
            sample_quantity=3,
            samples=[
                Sample(sample_id="S001", batch_id="B001", is_defective=True),
                Sample(sample_id="S002", batch_id="B001", is_defective=False),
                Sample(sample_id="S003", batch_id="B001", is_defective=True),
            ],
            rechecks=[
                RecheckRecord(
                    sample_id="S001",
                    original_result=True,
                    recheck_result=False,
                    recheck_time=datetime.now(),
                ),
            ],
        )
        assert batch.defective_count == 1
        assert batch.pass_rate == 2/3

    def test_batch_multiple_rechecks_uses_latest(self):
        early = datetime(2026, 5, 1, 10, 0, 0)
        later = datetime(2026, 5, 2, 10, 0, 0)
        batch = Batch(
            batch_id="B001",
            product="测试产品",
            total_quantity=1000,
            sample_quantity=2,
            samples=[
                Sample(sample_id="S001", batch_id="B001", is_defective=True),
                Sample(sample_id="S002", batch_id="B001", is_defective=False),
            ],
            rechecks=[
                RecheckRecord(
                    sample_id="S001",
                    original_result=True,
                    recheck_result=False,
                    recheck_time=early,
                ),
                RecheckRecord(
                    sample_id="S001",
                    original_result=False,
                    recheck_result=True,
                    recheck_time=later,
                ),
            ],
        )
        assert batch._is_effectively_defective(batch.samples[0]) is True

    def test_sampling_rule_creation(self):
        rule = SamplingRule(
            rule_id="R001",
            name="测试规则",
            description="测试用规则",
            sample_size=10,
            pass_threshold=0.95,
            batch_size_range=(501, 2000),
        )
        assert rule.rule_id == "R001"
        assert rule.sample_size == 10
        assert rule.pass_threshold == 0.95
        assert rule.batch_size_range == (501, 2000)

    def test_empty_batch_pass_rate(self):
        batch = Batch(
            batch_id="EMPTY",
            product="空批次",
            total_quantity=0,
            sample_quantity=0,
        )
        assert batch.pass_rate == 1.0
        assert batch.defective_count == 0
