from typing import List, Dict, Set, Tuple, Any
from collections import defaultdict
from itertools import combinations
import hashlib

from .parser import MetricSample


class CardinalityEstimator:
    def __init__(self, config):
        self.config = config
    
    def estimate(self, samples: List[MetricSample]) -> Dict[str, Any]:
        metrics_by_name = self._group_by_metric(samples)
        
        results = {
            'metrics': {},
            'label_combinations': [],
            'single_label_cardinality': {},
            'empty_label_analysis': {},
            'masked_high_cardinality': [],
            'summary': {
                'total_samples': len(samples),
                'total_metrics': len(metrics_by_name),
                'total_label_combinations': 0
            }
        }
        
        for metric_name, metric_samples in sorted(metrics_by_name.items()):
            metric_result = self._analyze_metric(metric_name, metric_samples)
            results['metrics'][metric_name] = metric_result
            results['label_combinations'].extend(metric_result['combinations'])
        
        results['label_combinations'].sort(
            key=lambda x: (-x['estimated_cardinality'], x['metric_name'], str(x['labels']))
        )
        
        results['summary']['total_label_combinations'] = len(results['label_combinations'])
        
        results['single_label_cardinality'] = self._calculate_single_label_cardinality(samples)
        
        if self.config.include_empty_labels:
            results['empty_label_analysis'] = self._analyze_empty_labels(samples)
        
        if self.config.detect_masked_high_cardinality:
            results['masked_high_cardinality'] = self._detect_masked_high_cardinality(
                metrics_by_name, results
            )
        
        return results
    
    def _group_by_metric(self, samples: List[MetricSample]) -> Dict[str, List[MetricSample]]:
        grouped = defaultdict(list)
        for sample in samples:
            grouped[sample.name].append(sample)
        return dict(grouped)
    
    def _analyze_metric(self, metric_name: str, samples: List[MetricSample]) -> Dict[str, Any]:
        label_keys = self._get_all_label_keys(samples)
        label_value_counts = self._count_label_values(samples, label_keys)
        
        combinations_list = self._generate_cardinality_combinations(
            metric_name, samples, label_keys, label_value_counts
        )
        
        return {
            'metric_name': metric_name,
            'sample_count': len(samples),
            'label_keys': sorted(label_keys),
            'label_value_counts': label_value_counts,
            'combinations': combinations_list
        }
    
    def _get_all_label_keys(self, samples: List[MetricSample]) -> Set[str]:
        keys = set()
        for sample in samples:
            keys.update(sample.labels.keys())
        return keys
    
    def _count_label_values(self, samples: List[MetricSample], label_keys: Set[str]) -> Dict[str, int]:
        counts = defaultdict(set)
        for sample in samples:
            for key in label_keys:
                if key in sample.labels:
                    counts[key].add(sample.labels[key])
                else:
                    counts[key].add('__missing__')
        return {k: len(v) for k, v in counts.items()}
    
    def _generate_cardinality_combinations(
        self,
        metric_name: str,
        samples: List[MetricSample],
        label_keys: Set[str],
        label_value_counts: Dict[str, int]
    ) -> List[Dict[str, Any]]:
        combinations_list = []
        
        max_combination_size = min(len(label_keys), 5)
        sorted_label_list = sorted(label_keys)
        sorted_labels = sorted(sorted_label_list, key=lambda k: (-label_value_counts.get(k, 0), k))
        
        for size in range(1, max_combination_size + 1):
            for label_subset in combinations(sorted_labels, size):
                cardinality, examples = self._estimate_combination_cardinality(
                    samples, label_subset
                )
                
                theoretical_max = 1
                for label in label_subset:
                    theoretical_max *= label_value_counts.get(label, 1)
                
                utilization = (cardinality / theoretical_max * 100) if theoretical_max > 0 else 0
                
                combo = {
                    'metric_name': metric_name,
                    'labels': sorted(list(label_subset)),
                    'estimated_cardinality': cardinality,
                    'theoretical_max': theoretical_max,
                    'utilization_percent': round(utilization, 2),
                    'sample_count': len(samples),
                    'top_examples': examples[:5],
                    'combination_id': self._generate_combination_id(metric_name, label_subset)
                }
                
                combinations_list.append(combo)
        
        return combinations_list
    
    def _estimate_combination_cardinality(
        self,
        samples: List[MetricSample],
        label_subset: Tuple[str, ...]
    ) -> Tuple[int, List[Dict[str, str]]]:
        seen = set()
        all_unique = []
        
        for sample in samples:
            label_values = []
            for key in label_subset:
                value = sample.labels.get(key, '__missing__')
                label_values.append((key, value))
            
            value_tuple = tuple(label_values)
            
            if value_tuple not in seen:
                seen.add(value_tuple)
                all_unique.append(dict(sorted(label_values)))
        
        all_unique.sort(key=lambda x: sorted(x.items()))
        
        return len(seen), all_unique[:10]
    
    def _calculate_single_label_cardinality(self, samples: List[MetricSample]) -> Dict[str, Any]:
        label_cardinality = defaultdict(lambda: {
            'values': set(),
            'metrics': set(),
            'total_samples': 0
        })
        
        for sample in samples:
            for key, value in sample.labels.items():
                label_cardinality[key]['values'].add(value)
                label_cardinality[key]['metrics'].add(sample.name)
                label_cardinality[key]['total_samples'] += 1
        
        result = {}
        for key, data in sorted(label_cardinality.items()):
            result[key] = {
                'cardinality': len(data['values']),
                'metric_count': len(data['metrics']),
                'metrics': sorted(data['metrics']),
                'total_samples': data['total_samples']
            }
        
        return dict(sorted(result.items(), key=lambda x: -x[1]['cardinality']))
    
    def _analyze_empty_labels(self, samples: List[MetricSample]) -> Dict[str, Any]:
        empty_stats = defaultdict(lambda: {'count': 0, 'metrics': set()})
        
        for sample in samples:
            for key, value in sample.labels.items():
                if value == '' or value is None:
                    empty_stats[key]['count'] += 1
                    empty_stats[key]['metrics'].add(sample.name)
        
        result = {}
        for key, data in sorted(empty_stats.items()):
            if data['count'] > 0:
                result[key] = {
                    'empty_count': data['count'],
                    'affected_metrics': sorted(data['metrics'])
                }
        
        return result
    
    def _detect_masked_high_cardinality(
        self,
        metrics_by_name: Dict[str, List[MetricSample]],
        results: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        masked_cases = []
        
        for metric_name, samples in metrics_by_name.items():
            metric_result = results['metrics'].get(metric_name, {})
            label_value_counts = metric_result.get('label_value_counts', {})
            
            high_card_labels = [
                label for label, count in label_value_counts.items()
                if count >= self.config.base_threshold * 0.5
            ]
            
            if len(high_card_labels) > 1:
                for hc_label in high_card_labels:
                    other_labels = [l for l in high_card_labels if l != hc_label]
                    
                    for other_label in other_labels:
                        combined_key = tuple(sorted([hc_label, other_label]))
                        combined_card, _ = self._estimate_combination_cardinality(
                            samples, combined_key
                        )
                        
                        hc_count = label_value_counts[hc_label]
                        other_count = label_value_counts[other_label]
                        
                        if combined_card < min(hc_count, other_count) * 0.1:
                            masked_cases.append({
                                'metric_name': metric_name,
                                'masked_label': hc_label,
                                'masked_by_label': other_label,
                                'masked_label_cardinality': hc_count,
                                'masking_label_cardinality': other_count,
                                'combined_cardinality': combined_card,
                                'masking_ratio': round(combined_card / hc_count * 100, 2),
                                'description': (
                                    f"Label '{hc_label}' (基数 {hc_count}) 被 "
                                    f"'{other_label}' (基数 {other_count}) 掩盖, "
                                    f"实际组合基数仅 {combined_card} ({combined_card/hc_count*100:.1f}%)"
                                )
                            })
        
        return masked_cases
    
    def _generate_combination_id(self, metric_name: str, labels: Tuple[str, ...]) -> str:
        sorted_labels = sorted(labels)
        id_str = f"{metric_name}:{','.join(sorted_labels)}"
        return hashlib.md5(id_str.encode()).hexdigest()[:8]
