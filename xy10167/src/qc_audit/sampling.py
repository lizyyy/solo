from typing import List, Optional
from .models import Batch, Sample, SamplingRule


class SamplingEngine:
    def __init__(self, rules: List[SamplingRule]):
        self.rules = rules

    def select_rule(self, batch: Batch) -> Optional[SamplingRule]:
        matching = []
        for rule in self.rules:
            if rule.batch_size_range:
                min_size, max_size = rule.batch_size_range
                if min_size <= batch.total_quantity <= max_size:
                    matching.append(rule)
            else:
                matching.append(rule)
        return matching[0] if matching else None

    def calculate_required_sample_size(self, batch: Batch) -> Optional[int]:
        rule = self.select_rule(batch)
        return rule.sample_size if rule else None

    def validate_sampling(self, batch: Batch) -> dict:
        rule = self.select_rule(batch)
        if not rule:
            return {
                "valid": False,
                "reason": "no_matching_rule",
                "rule": None,
                "required_size": None,
                "actual_size": len(batch.samples),
            }
        
        actual_sample_count = len(batch.samples)
        expected_count = rule.sample_size

        size_valid = actual_sample_count >= expected_count
        pass_rate = batch.pass_rate
        passes_threshold = pass_rate >= rule.pass_threshold

        return {
            "valid": size_valid and passes_threshold,
            "reason": "ok" if (size_valid and passes_threshold) else 
                      ("insufficient_samples" if not size_valid else "below_pass_threshold"),
            "rule": rule.rule_id,
            "required_size": expected_count,
            "actual_size": actual_sample_count,
            "pass_rate": pass_rate,
            "pass_threshold": rule.pass_threshold,
        }

    def generate_sampling_plan(self, total_quantity: int, product: Optional[str] = None) -> dict:
        temp_batch = Batch(
            batch_id="_temp",
            product=product or "unknown",
            total_quantity=total_quantity,
            sample_quantity=0,
        )
        rule = self.select_rule(temp_batch)
        if not rule:
            return {
                "rule": None,
                "sample_size": 0,
                "pass_threshold": 1.0,
            }
        
        return {
            "rule": rule.rule_id,
            "sample_size": rule.sample_size,
            "pass_threshold": rule.pass_threshold,
            "rule_name": rule.name,
            "rule_description": rule.description,
        }
