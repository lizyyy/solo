import random
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from collections import OrderedDict
from .reader import DeadLetterMessage
from .grouper import GroupResult, ErrorGroup


@dataclass
class SampleResult:
    samples: List[DeadLetterMessage] = field(default_factory=list)
    samples_by_reason: Dict[str, List[DeadLetterMessage]] = field(default_factory=OrderedDict)
    total_sampled: int = 0
    sample_summary: Dict[str, dict] = field(default_factory=dict)
    parse_errors: List[DeadLetterMessage] = field(default_factory=list)


class StratifiedSampler:
    def __init__(self, max_total_samples: int = 100, max_per_group: Optional[int] = None, 
                 min_per_group: int = 1, seed: Optional[int] = None):
        self.max_total_samples = max_total_samples
        self.max_per_group = max_per_group
        self.min_per_group = min_per_group
        self.seed = seed
        if seed is not None:
            random.seed(seed)

    def sample(self, group_result: GroupResult) -> SampleResult:
        result = SampleResult()

        if group_result.ungrouped and group_result.ungrouped.count > 0:
            result.parse_errors = group_result.ungrouped.messages

        groups = group_result.groups
        if not groups:
            return result

        allocations = self._calculate_allocations(groups)

        for idx, group in enumerate(groups):
            sample_size = allocations[idx]
            if sample_size <= 0:
                continue

            group_samples = self._sample_from_group(group, sample_size)
            result.samples.extend(group_samples)
            
            reason_key = group.reason or "UNKNOWN"
            result.samples_by_reason[reason_key] = group_samples
            result.sample_summary[reason_key] = {
                "total": group.count,
                "sampled": len(group_samples),
                "percentage": group.percentage
            }

        result.total_sampled = len(result.samples)
        return result

    def _calculate_allocations(self, groups: List[ErrorGroup]) -> List[int]:
        allocations = [0] * len(groups)
        remaining = self.max_total_samples

        for i in range(len(groups)):
            allocations[i] = self.min_per_group
            remaining -= self.min_per_group

        if remaining <= 0:
            return allocations

        total_size = sum(g.count for g in groups)
        for i, group in enumerate(groups):
            if remaining <= 0:
                break

            proportional = int((group.count / total_size) * self.max_total_samples) - self.min_per_group
            to_add = min(proportional, remaining)
            
            if self.max_per_group:
                max_additional = self.max_per_group - self.min_per_group
                to_add = min(to_add, max_additional)

            allocations[i] += to_add
            remaining -= to_add

        for i, group in enumerate(groups):
            allocations[i] = min(allocations[i], group.count)

        return allocations

    def _sample_from_group(self, group: ErrorGroup, sample_size: int) -> List[DeadLetterMessage]:
        if sample_size >= group.count:
            return group.messages.copy()

        return random.sample(group.messages, sample_size)
