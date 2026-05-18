from typing import List, Dict, Any
from dataclasses import dataclass
import hashlib
import random
from .attribution import AttributionResult


@dataclass
class SampleResult:
    sample_id: str
    ticket_id: str
    source_file: str
    source_row: int
    missing_reason: str
    missing_reason_code: str
    confidence: float
    has_recording: bool
    match_score: int
    recording_paths: str
    details: str
    random_seed: int


class SamplingEngine:
    def __init__(self, seed: int = 42, sample_size: int = 50):
        self.base_seed = seed
        self.sample_size = sample_size
        self.sample_results: List[SampleResult] = []
        self.sample_hash: str = ""

    def _generate_deterministic_seed(self, item: AttributionResult, global_seed: int) -> int:
        content = f"{item.ticket_id or ''}:{item.source_file}:{item.source_row}:{global_seed}"
        hash_result = hashlib.md5(content.encode()).hexdigest()
        return int(hash_result[:8], 16)

    def _stratified_sample(
        self,
        results: List[AttributionResult],
        strata_key: str,
        per_stratum_count: int
    ) -> List[AttributionResult]:
        groups: Dict[str, List[AttributionResult]] = {}
        
        problematic_results = [r for r in results if r.missing_reason_code != 'MATCH_OK']
        
        if not problematic_results:
            problematic_results = results
        
        for result in problematic_results:
            if strata_key == 'reason':
                key = result.missing_reason_code
            elif strata_key == 'confidence':
                if result.confidence >= 0.9:
                    key = 'high'
                elif result.confidence >= 0.7:
                    key = 'medium'
                else:
                    key = 'low'
            else:
                key = 'all'
            
            if key not in groups:
                groups[key] = []
            groups[key].append(result)
        
        sampled = []
        for group_key, group_items in groups.items():
            sorted_items = sorted(group_items, key=lambda x: x.ticket_id or "")
            count = min(max(1, per_stratum_count), len(sorted_items))
            
            indices = list(range(len(sorted_items)))
            deterministic_indices = sorted(
                indices,
                key=lambda x: self._generate_deterministic_seed(sorted_items[x], self.base_seed)
            )[:count]
            
            for idx in deterministic_indices:
                sampled.append(sorted_items[idx])
        
        return sampled

    def _weighted_sample(
        self,
        results: List[AttributionResult],
        sample_size: int
    ) -> List[AttributionResult]:
        weighted_items = []
        
        for result in results:
            weight = 1
            if not result.has_recording:
                weight += 2
            if result.confidence >= 0.9:
                weight += 1
            if result.match_score < 50:
                weight += 1
            
            for _ in range(weight):
                weighted_items.append(result)
        
        sorted_weighted = sorted(weighted_items, key=lambda x: x.ticket_id or "")
        
        selected: List[AttributionResult] = []
        seen_tickets = set()
        
        for idx, item in enumerate(sorted_weighted):
            if len(selected) >= sample_size:
                break
            
            ticket_key = f"{item.ticket_id or ''}:{item.source_file}:{item.source_row}"
            if ticket_key in seen_tickets:
                continue
            
            item_seed = self._generate_deterministic_seed(item, self.base_seed + idx)
            if item_seed % 100 < 70:
                selected.append(item)
                seen_tickets.add(ticket_key)
        
        if len(selected) < sample_size:
            for item in sorted(results, key=lambda x: x.ticket_id or ""):
                if len(selected) >= sample_size:
                    break
                ticket_key = f"{item.ticket_id or ''}:{item.source_file}:{item.source_row}"
                if ticket_key not in seen_tickets:
                    selected.append(item)
                    seen_tickets.add(ticket_key)
        
        return selected

    def sample(
        self,
        attribution_results: List[AttributionResult],
        method: str = "stratified",
        sample_size: int = None
    ) -> List[SampleResult]:
        if sample_size is None:
            sample_size = self.sample_size
        
        valid_results = [r for r in attribution_results if r.ticket_id]
        
        if method == "stratified":
            per_stratum = max(1, sample_size // 5)
            sampled_attributions = self._stratified_sample(valid_results, 'reason', per_stratum)
        elif method == "weighted":
            sampled_attributions = self._weighted_sample(valid_results, sample_size)
        else:
            sorted_attributions = sorted(valid_results, key=lambda x: x.ticket_id or "")
            sampled_attributions = sorted_attributions[:sample_size]
        
        if len(sampled_attributions) < sample_size:
            seen_tickets = {f"{r.ticket_id}:{r.source_file}:{r.source_row}" for r in sampled_attributions}
            remaining_needed = sample_size - len(sampled_attributions)
            
            problematic_results = [r for r in valid_results if r.missing_reason_code != 'MATCH_OK']
            sorted_problematic = sorted(problematic_results, key=lambda x: x.ticket_id or "")
            
            for result in sorted_problematic:
                if remaining_needed <= 0:
                    break
                ticket_key = f"{result.ticket_id}:{result.source_file}:{result.source_row}"
                if ticket_key not in seen_tickets:
                    sampled_attributions.append(result)
                    seen_tickets.add(ticket_key)
                    remaining_needed -= 1
        
        self.sample_results = []
        for attribution in sampled_attributions:
            details_str = " | ".join([f"{k}:{v}" for k, v in attribution.details.items()])
            
            sample = SampleResult(
                sample_id=f"SAMPLE-{len(self.sample_results) + 1:04d}",
                ticket_id=attribution.ticket_id or "",
                source_file=attribution.source_file,
                source_row=attribution.source_row,
                missing_reason=attribution.missing_reason_desc,
                missing_reason_code=attribution.missing_reason_code,
                confidence=attribution.confidence,
                has_recording=attribution.has_recording,
                match_score=attribution.match_score,
                recording_paths="; ".join(attribution.recording_files),
                details=details_str,
                random_seed=self._generate_deterministic_seed(attribution, self.base_seed)
            )
            self.sample_results.append(sample)
        
        self.sample_results.sort(key=lambda x: x.ticket_id)
        self._generate_sample_hash()
        return self.sample_results

    def _generate_sample_hash(self) -> None:
        content = "|".join(sorted(
            f"{s.sample_id}:{s.ticket_id}:{s.missing_reason_code}"
            for s in self.sample_results
        ))
        self.sample_hash = hashlib.md5(content.encode()).hexdigest()

    def get_sample_summary(self) -> Dict[str, Any]:
        summary = {
            'total_sampled': len(self.sample_results),
            'with_recording': sum(1 for s in self.sample_results if s.has_recording),
            'without_recording': sum(1 for s in self.sample_results if not s.has_recording),
            'by_reason': {},
            'avg_confidence': 0.0,
            'avg_match_score': 0.0
        }
        
        for sample in self.sample_results:
            reason = sample.missing_reason
            summary['by_reason'][reason] = summary['by_reason'].get(reason, 0) + 1
        
        if self.sample_results:
            summary['avg_confidence'] = sum(s.confidence for s in self.sample_results) / len(self.sample_results)
            summary['avg_match_score'] = sum(s.match_score for s in self.sample_results) / len(self.sample_results)
        
        return summary
