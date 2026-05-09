from qc_audit.models import Batch, Sample, SamplingRule
from qc_audit.sampling import SamplingEngine


class TestSamplingEngine:
    def setup_method(self):
        self.rules = [
            SamplingRule("R_SMALL", "小批量", "1-500", 5, 0.95, (1, 500)),
            SamplingRule("R_MEDIUM", "中批量", "501-2000", 13, 0.95, (501, 2000)),
            SamplingRule("R_LARGE", "大批量", "2001+", 20, 0.98, (2001, 10000)),
        ]
        self.engine = SamplingEngine(self.rules)

    def test_select_rule_by_batch_size(self):
        small_batch = Batch("B1", "P1", 300, 5)
        medium_batch = Batch("B2", "P1", 1500, 13)
        large_batch = Batch("B3", "P1", 3000, 20)

        assert self.engine.select_rule(small_batch).rule_id == "R_SMALL"
        assert self.engine.select_rule(medium_batch).rule_id == "R_MEDIUM"
        assert self.engine.select_rule(large_batch).rule_id == "R_LARGE"

    def test_calculate_required_sample_size(self):
        batch = Batch("B1", "P1", 1500, 13)
        assert self.engine.calculate_required_sample_size(batch) == 13

    def test_validate_sampling_pass(self):
        batch = Batch(
            "B1", "P1", 1000, 5,
            samples=[
                Sample(f"S{i}", "B1", is_defective=False) for i in range(13)
            ],
        )
        result = self.engine.validate_sampling(batch)
        assert result["valid"] is True
        assert result["reason"] == "ok"

    def test_validate_sampling_insufficient_samples(self):
        batch = Batch(
            "B1", "P1", 1000, 5,
            samples=[Sample(f"S{i}", "B1", is_defective=False) for i in range(5)],
        )
        result = self.engine.validate_sampling(batch)
        assert result["valid"] is False
        assert result["reason"] == "insufficient_samples"

    def test_validate_sampling_below_threshold(self):
        samples = [Sample(f"S{i}", "B1", is_defective=False) for i in range(10)]
        samples.extend([Sample(f"S{i}", "B1", is_defective=True) for i in range(10, 13)])
        batch = Batch("B1", "P1", 1000, 13, samples=samples)
        
        result = self.engine.validate_sampling(batch)
        assert result["valid"] is False
        assert result["reason"] == "below_pass_threshold"

    def test_generate_sampling_plan(self):
        plan = self.engine.generate_sampling_plan(1500, "产品A")
        assert plan["rule"] == "R_MEDIUM"
        assert plan["sample_size"] == 13
        assert plan["pass_threshold"] == 0.95

    def test_no_matching_rule(self):
        engine = SamplingEngine([self.rules[0]])
        batch = Batch("B1", "P1", 100000, 100)
        result = engine.validate_sampling(batch)
        assert result["valid"] is False
        assert result["reason"] == "no_matching_rule"
