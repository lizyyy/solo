from typing import Dict, List, Any
from collections import Counter
import statistics
from .config import SAMPLING_RULES, GRADE_STANDARDS


class AnomalyDetector:
    def __init__(self):
        self.anomalies = []
        self.warnings = []
        self.alerts = []

    def detect_all(self, samples: List[Dict[str, Any]], classification_results: List[Dict[str, Any]],
                   batch_grade_info: Dict[str, Any], fruit_type: str) -> Dict[str, Any]:
        self.anomalies = []
        self.warnings = []
        self.alerts = []
        
        self._check_sample_count(len(samples))
        self._check_invalid_measurements(classification_results)
        self._check_sugar_outliers(samples, fruit_type)
        self._check_batch_mixing(samples, classification_results)
        self._check_grade_controversy(classification_results)
        self._check_boundary_samples(classification_results)
        self._check_confidence_level(batch_grade_info)
        
        return {
            'anomalies': self.anomalies,
            'warnings': self.warnings,
            'alerts': self.alerts,
            'interception_needed': len(self.alerts) > 0,
            'review_needed': len(self.warnings) > 0,
            'overall_status': self._determine_overall_status()
        }

    def _check_sample_count(self, count: int):
        rules = SAMPLING_RULES
        if count < rules['min_sample_count']:
            self.alerts.append({
                'type': 'sample_count_insufficient',
                'severity': 'high',
                'message': f'抽样数量不足: 实际 {count} 个，最低要求 {rules["min_sample_count"]} 个',
                'action_required': '建议增加抽样数量后重新检测'
            })
        elif count < rules['recommended_sample_count']:
            self.warnings.append({
                'type': 'sample_count_below_recommended',
                'severity': 'medium',
                'message': f'抽样数量低于推荐值: 实际 {count} 个，推荐 {rules["recommended_sample_count"]} 个',
                'action_required': '可考虑增加抽样以提高置信度'
            })

    def _check_invalid_measurements(self, results: List[Dict[str, Any]]):
        invalid_count = sum(1 for r in results if not r.get('is_valid', True))
        if invalid_count > 0:
            invalid_ratio = invalid_count / len(results) if results else 0
            self.anomalies.append({
                'type': 'invalid_measurements',
                'severity': 'medium',
                'count': invalid_count,
                'ratio': invalid_ratio,
                'message': f'发现 {invalid_count} 个无效测量值 ({invalid_ratio:.1%})',
                'sample_ids': [r['sample_id'] for r in results if not r.get('is_valid', True)]
            })

    def _check_sugar_outliers(self, samples: List[Dict[str, Any]], fruit_type: str):
        standards = GRADE_STANDARDS.get(fruit_type, {})
        valid_range = standards.get('valid_range', {'min': 0, 'max': 100})
        
        sugars = [s['sugar'] for s in samples]
        if len(sugars) < 4:
            return
        
        q1 = statistics.quantiles(sugars, n=4)[0]
        q3 = statistics.quantiles(sugars, n=4)[2]
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers = []
        for s in samples:
            sugar = s['sugar']
            if sugar < lower_bound or sugar > upper_bound:
                outliers.append({
                    'id': s.get('id', 'N/A'),
                    'sugar': sugar,
                    'position': 'low' if sugar < lower_bound else 'high',
                    'distance_from_valid_range': min(abs(sugar - valid_range['min']), abs(sugar - valid_range['max']))
                })
        
        if outliers:
            self.anomalies.append({
                'type': 'sugar_outliers',
                'severity': 'medium',
                'count': len(outliers),
                'outliers': outliers,
                'message': f'发现 {len(outliers)} 个糖度异常值（IQR方法检测）'
            })

    def _check_batch_mixing(self, samples: List[Dict[str, Any]], results: List[Dict[str, Any]]):
        rules = SAMPLING_RULES
        
        if len(results) < 5:
            return
        
        sugars = [s['sugar'] for s in samples]
        variance = statistics.variance(sugars) if len(sugars) > 1 else 0
        
        grades = [r['grade'] for r in results if r['grade'] is not None]
        grade_counter = Counter(grades)
        
        if len(grade_counter) >= 2:
            top_two = grade_counter.most_common(2)
            mix_ratio = top_two[1][1] / len(grades) if grades else 0
            
            if mix_ratio > rules['batch_mix_threshold']:
                self.alerts.append({
                    'type': 'batch_mixing',
                    'severity': 'high',
                    'mix_ratio': mix_ratio,
                    'threshold': rules['batch_mix_threshold'],
                    'grade_distribution': dict(grade_counter),
                    'variance': variance,
                    'message': f'检测到批次混入风险: 次要等级占比 {mix_ratio:.1%}，超过阈值 {rules["batch_mix_threshold"]:.0%}',
                    'action_required': '建议核查批次来源，确认是否存在混批情况'
                })
            elif mix_ratio > 0.08:
                self.warnings.append({
                    'type': 'potential_mixing',
                    'severity': 'medium',
                    'mix_ratio': mix_ratio,
                    'grade_distribution': dict(grade_counter),
                    'message': f'存在潜在批次混入可能: 次要等级占比 {mix_ratio:.1%}'
                })

    def _check_grade_controversy(self, results: List[Dict[str, Any]]):
        rules = SAMPLING_RULES
        boundary_samples = [r for r in results if r.get('near_boundary', {}).get('is_near', False)]
        
        if boundary_samples:
            controversy_ratio = len(boundary_samples) / len(results) if results else 0
            
            if controversy_ratio > rules['grade_controversy_threshold']:
                self.alerts.append({
                    'type': 'grade_controversy',
                    'severity': 'high',
                    'controversy_ratio': controversy_ratio,
                    'threshold': rules['grade_controversy_threshold'],
                    'count': len(boundary_samples),
                    'samples': [
                        {
                            'id': s['sample_id'],
                            'sugar': s['sugar'],
                            'grade': s['grade'],
                            'near_boundaries': s['near_boundary']['near_boundaries']
                        }
                        for s in boundary_samples
                    ],
                    'message': f'等级争议风险较高: {len(boundary_samples)} 个样本靠近分级边界 ({controversy_ratio:.1%})',
                    'action_required': '建议对边界样本进行复核检测'
                })
            else:
                self.warnings.append({
                    'type': 'near_boundary_samples',
                    'severity': 'low',
                    'count': len(boundary_samples),
                    'controversy_ratio': controversy_ratio,
                    'message': f'存在 {len(boundary_samples)} 个靠近分级边界的样本'
                })

    def _check_boundary_samples(self, results: List[Dict[str, Any]]):
        detailed_boundary = []
        for r in results:
            near = r.get('near_boundary', {})
            if near.get('is_near', False):
                detailed_boundary.append({
                    'sample_id': r['sample_id'],
                    'sugar': r['sugar'],
                    'current_grade': r['grade'],
                    'boundary_details': near.get('near_boundaries', [])
                })
        
        if detailed_boundary:
            self.anomalies.append({
                'type': 'boundary_samples_detail',
                'severity': 'low',
                'count': len(detailed_boundary),
                'samples': detailed_boundary,
                'message': f'详细边界样本信息'
            })

    def _check_confidence_level(self, batch_grade_info: Dict[str, Any]):
        rules = SAMPLING_RULES
        confidence = batch_grade_info.get('confidence', 0)
        
        if confidence < rules['confidence_threshold']:
            self.warnings.append({
                'type': 'confidence_low',
                'severity': 'medium',
                'confidence': confidence,
                'threshold': rules['confidence_threshold'],
                'message': f'分级置信度较低: {confidence:.1%}，建议增加抽样数量',
                'action_required': '建议增加抽样或复核'
            })

    def _determine_overall_status(self) -> str:
        if len(self.alerts) > 0:
            return 'intercepted'
        elif len(self.warnings) > 0:
            return 'needs_review'
        elif len(self.anomalies) > 0:
            return 'has_anomalies'
        else:
            return 'normal'
