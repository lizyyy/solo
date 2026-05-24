import json
import os
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass


@dataclass
class RiskLevel:
    CRITICAL = "critical"
    WARNING = "warning"
    LOW = "low"


class ThresholdManager:
    def __init__(self, config):
        self.config = config
        self.history_thresholds = self._load_history_thresholds()
        self.history_report = self._load_history_report()
    
    def _load_history_thresholds(self) -> Dict[str, Any]:
        if not self.config.history_path:
            return {}
        
        try:
            with open(self.config.history_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            if self.config.verbose:
                print(f"警告: 无法加载历史阈值文件: {e}")
            return {}
    
    def _load_history_report(self) -> Dict[str, Any]:
        if not self.config.report_path:
            return {}
        
        try:
            with open(self.config.report_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            if self.config.verbose:
                print(f"警告: 无法加载历史基数报告: {e}")
            return {}
    
    def evaluate_risk(self, cardinality_results: Dict[str, Any]) -> Dict[str, Any]:
        evaluated_combinations = []
        
        for combo in cardinality_results['label_combinations']:
            evaluated = self._evaluate_combination_risk(combo, cardinality_results)
            evaluated_combinations.append(evaluated)
        
        evaluated_combinations.sort(key=lambda x: (-x['risk_score'], -x['estimated_cardinality'], x['metric_name'], str(x['labels'])))
        
        critical_count = sum(1 for c in evaluated_combinations if c['risk_level'] == RiskLevel.CRITICAL)
        warning_count = sum(1 for c in evaluated_combinations if c['risk_level'] == RiskLevel.WARNING)
        
        return {
            'service_name': self.config.service_name or 'unknown',
            'summary': {
                'total_combinations': len(evaluated_combinations),
                'critical_count': critical_count,
                'warning_count': warning_count,
                'low_count': len(evaluated_combinations) - critical_count - warning_count,
                'base_threshold': self.config.base_threshold,
                'top_n': self.config.top_n
            },
            'combinations': evaluated_combinations,
            'masked_high_cardinality': self._sort_masked(cardinality_results.get('masked_high_cardinality', [])),
            'empty_label_analysis': self._sort_empty_labels(cardinality_results.get('empty_label_analysis', {})),
            'single_label_cardinality': cardinality_results.get('single_label_cardinality', {}),
            'metrics': cardinality_results.get('metrics', {}),
            'history_comparison': self._compare_with_history(cardinality_results)
        }
    
    def _evaluate_combination_risk(
        self,
        combo: Dict[str, Any],
        cardinality_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        metric_name = combo['metric_name']
        cardinality = combo['estimated_cardinality']
        
        threshold = self.config.get_threshold_for_metric(metric_name)
        
        history_threshold = self._get_history_threshold(metric_name, combo['labels'])
        effective_threshold = history_threshold or threshold
        
        risk_score, risk_level, risk_reasons = self._calculate_risk(
            cardinality,
            effective_threshold,
            combo
        )
        
        growth_rate = self._calculate_growth_rate(metric_name, combo['labels'], cardinality)
        
        result = combo.copy()
        result.update({
            'threshold': effective_threshold,
            'threshold_source': 'history' if history_threshold else 'config',
            'ratio_to_threshold': round(cardinality / effective_threshold * 100, 2) if effective_threshold > 0 else 0,
            'risk_score': risk_score,
            'risk_level': risk_level,
            'risk_reasons': risk_reasons,
            'growth_rate_percent': growth_rate,
            'recommendation': self._generate_recommendation(risk_level, combo, effective_threshold)
        })
        
        return result
    
    def _get_history_threshold(self, metric_name: str, labels: List[str]) -> Optional[int]:
        sources = [self.history_thresholds, self.history_report]
        
        for source in sources:
            if not source:
                continue
            
            metric_history = source.get('metrics', {}).get(metric_name, {})
            
            label_key = ','.join(sorted(labels))
            if 'label_thresholds' in metric_history and label_key in metric_history['label_thresholds']:
                return metric_history['label_thresholds'][label_key]
            
            if 'threshold' in metric_history:
                return metric_history['threshold']
        
        return None
    
    def _calculate_risk(
        self,
        cardinality: int,
        threshold: int,
        combo: Dict[str, Any]
    ) -> Tuple[int, str, List[str]]:
        risk_score = 0
        reasons = []
        
        ratio = cardinality / threshold if threshold > 0 else float('inf')
        
        if ratio >= 2.0:
            risk_score += 100
            reasons.append(f"基数远超阈值 ({cardinality} >= {threshold} * 2)")
        elif ratio >= 1.0:
            risk_score += 75
            reasons.append(f"基数超过阈值 ({cardinality} >= {threshold})")
        elif ratio >= 0.8:
            risk_score += 50
            reasons.append(f"基数接近阈值 ({cardinality} >= {threshold} * 0.8)")
        elif ratio >= 0.5:
            risk_score += 25
            reasons.append(f"基数达到阈值的 50%")
        
        label_count = len(combo['labels'])
        if label_count >= 4:
            risk_score += 20
            reasons.append(f"组合 label 数量较多 ({label_count} 个)")
        
        utilization = combo.get('utilization_percent', 0)
        if utilization > 80:
            risk_score += 15
            reasons.append(f"label 组合利用率高 ({utilization}%)")
        
        theoretical_max = combo.get('theoretical_max', 0)
        if theoretical_max > threshold * 10:
            risk_score += 10
            reasons.append(f"理论最大基数极高 (可能爆炸增长)")
        
        if risk_score >= 75:
            risk_level = RiskLevel.CRITICAL
        elif risk_score >= 25:
            risk_level = RiskLevel.WARNING
        else:
            risk_level = RiskLevel.LOW
        
        return risk_score, risk_level, reasons
    
    def _calculate_growth_rate(
        self,
        metric_name: str,
        labels: List[str],
        current_cardinality: int
    ) -> Optional[float]:
        historical_cardinality = self._get_historical_cardinality(metric_name, labels)
        
        if historical_cardinality and historical_cardinality > 0:
            growth = ((current_cardinality - historical_cardinality) / historical_cardinality) * 100
            return round(growth, 2)
        
        return None
    
    def _get_historical_cardinality(self, metric_name: str, labels: List[str]) -> Optional[int]:
        sources = [self.history_thresholds, self.history_report]
        
        for source in sources:
            if not source:
                continue
            
            metric_history = source.get('metrics', {}).get(metric_name, {})
            
            label_key = ','.join(sorted(labels))
            if 'label_cardinality' in metric_history and label_key in metric_history['label_cardinality']:
                return metric_history['label_cardinality'][label_key]
            
            if 'combinations' in metric_history:
                for combo in metric_history['combinations']:
                    if sorted(combo.get('labels', [])) == sorted(labels):
                        return combo.get('estimated_cardinality')
        
        if 'combinations' in self.history_report:
            for combo in self.history_report.get('combinations', []):
                if combo.get('metric_name') == metric_name and sorted(combo.get('labels', [])) == sorted(labels):
                    return combo.get('estimated_cardinality')
        
        return None
    
    def _generate_recommendation(self, risk_level: str, combo: Dict[str, Any], threshold: int) -> str:
        cardinality = combo['estimated_cardinality']
        labels = combo['labels']
        
        if risk_level == RiskLevel.CRITICAL:
            if cardinality > threshold * 2:
                return (
                    f"紧急: 建议立即移除或聚合高基数 label: {', '.join(labels)}. "
                    f"当前基数 {cardinality} 是阈值 {threshold} 的 {cardinality/threshold:.1f} 倍。"
                )
            else:
                return (
                    f"严重: label 组合 {', '.join(labels)} 基数已达 {cardinality}, "
                    f"超过阈值 {threshold}。建议下周内优化。"
                )
        elif risk_level == RiskLevel.WARNING:
            return (
                f"警告: label 组合 {', '.join(labels)} 基数 {cardinality} 接近阈值 {threshold}。"
                f"建议监控增长趋势。"
            )
        else:
            return (
                f"正常: label 组合 {', '.join(labels)} 基数 {cardinality} 在安全范围内 "
                f"(阈值 {threshold})。"
            )
    
    def _compare_with_history(self, cardinality_results: Dict[str, Any]) -> Dict[str, Any]:
        has_history = bool(self.history_thresholds or self.history_report)
        
        if not has_history:
            return {
                'has_history': False,
                'message': '未提供历史阈值或历史报告, 跳过历史对比'
            }
        
        comparison = {
            'has_history': True,
            'new_high_cardinality_labels': [],
            'significant_growth': [],
            'improved': [],
            'disappeared_combinations': [],
            'history_source': []
        }
        
        if self.history_thresholds:
            comparison['history_source'].append('history_thresholds')
        if self.history_report:
            comparison['history_source'].append('history_report')
        
        seen_combinations = set()
        
        for metric_name, metric_data in sorted(cardinality_results['metrics'].items()):
            current_combinations = metric_data.get('combinations', [])
            history_threshold = self._get_history_threshold(metric_name, []) or self.config.base_threshold
            
            for combo in current_combinations:
                combo_key = (metric_name, ','.join(sorted(combo['labels'])))
                seen_combinations.add(combo_key)
                
                hist_card = self._get_historical_cardinality(metric_name, combo['labels'])
                
                if hist_card is None or hist_card == 0:
                    if combo['estimated_cardinality'] > history_threshold:
                        comparison['new_high_cardinality_labels'].append({
                            'metric_name': metric_name,
                            'labels': sorted(combo['labels']),
                            'current_cardinality': combo['estimated_cardinality'],
                            'threshold': history_threshold
                        })
                else:
                    growth = ((combo['estimated_cardinality'] - hist_card) / hist_card) * 100
                    if growth > 50:
                        comparison['significant_growth'].append({
                            'metric_name': metric_name,
                            'labels': sorted(combo['labels']),
                            'historical_cardinality': hist_card,
                            'current_cardinality': combo['estimated_cardinality'],
                            'growth_percent': round(growth, 2)
                        })
                    elif growth < -20:
                        comparison['improved'].append({
                            'metric_name': metric_name,
                            'labels': sorted(combo['labels']),
                            'historical_cardinality': hist_card,
                            'current_cardinality': combo['estimated_cardinality'],
                            'reduction_percent': round(-growth, 2)
                        })
        
        disappeared = self._find_disappeared_combinations(cardinality_results, seen_combinations)
        comparison['disappeared_combinations'] = disappeared
        
        comparison['new_high_cardinality_labels'].sort(
            key=lambda x: (-x['current_cardinality'], x['metric_name'], str(x['labels']))
        )
        comparison['significant_growth'].sort(
            key=lambda x: (-x['growth_percent'], x['metric_name'], str(x['labels']))
        )
        comparison['improved'].sort(
            key=lambda x: (-x['reduction_percent'], x['metric_name'], str(x['labels']))
        )
        comparison['disappeared_combinations'].sort(
            key=lambda x: (-x['historical_cardinality'], x['metric_name'], str(x['labels']))
        )
        
        return comparison
    
    def _find_disappeared_combinations(self, cardinality_results, seen_combinations):
        disappeared = []
        sources = [self.history_thresholds, self.history_report]
        
        for source in sources:
            if not source:
                continue
            
            for metric_name, metric_data in source.get('metrics', {}).items():
                for combo in metric_data.get('combinations', []):
                    combo_key = (metric_name, ','.join(sorted(combo.get('labels', []))))
                    if combo_key not in seen_combinations:
                        hist_card = combo.get('estimated_cardinality', 0)
                        if hist_card > 0:
                            disappeared.append({
                                'metric_name': metric_name,
                                'labels': sorted(combo.get('labels', [])),
                                'historical_cardinality': hist_card
                            })
        
        if 'combinations' in self.history_report:
            for combo in self.history_report.get('combinations', []):
                metric_name = combo.get('metric_name', '')
                combo_key = (metric_name, ','.join(sorted(combo.get('labels', []))))
                if combo_key not in seen_combinations:
                    hist_card = combo.get('estimated_cardinality', 0)
                    if hist_card > 0:
                        disappeared.append({
                            'metric_name': metric_name,
                            'labels': sorted(combo.get('labels', [])),
                            'historical_cardinality': hist_card
                        })
        
        return disappeared
    
    def _sort_masked(self, masked_list):
        return sorted(
            masked_list,
            key=lambda x: (
                -x.get('masking_ratio', 0),
                -x.get('masked_label_cardinality', 0),
                x.get('metric_name', ''),
                x.get('masked_label', '')
            )
        )
    
    def _sort_empty_labels(self, empty_dict):
        sorted_items = sorted(
            empty_dict.items(),
            key=lambda x: (-x[1].get('empty_count', 0), x[0])
        )
        return dict(sorted_items)
