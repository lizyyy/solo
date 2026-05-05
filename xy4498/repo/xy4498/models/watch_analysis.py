import uuid
import math
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from collections import defaultdict

from models import (
    WorkOrder, TimingLog, TimingMeasurement,
    ServiceStep, PartReplacement, WaterproofTest,
    RateDriftAnalysis, AmplitudeAnomaly, PositionVariation,
    ReworkRiskAssessment, WatchAnalysisResult
)


class WatchAnalyzer:
    """钟表维修走时分析器"""
    
    RATE_NORMAL_MIN = -10.0
    RATE_NORMAL_MAX = 10.0
    RATE_MILD_THRESHOLD = 15.0
    RATE_MODERATE_THRESHOLD = 30.0
    RATE_SEVERE_THRESHOLD = 60.0
    
    AMPLITUDE_NORMAL_MIN = 220.0
    AMPLITUDE_NORMAL_MAX = 320.0
    AMPLITUDE_LOW_THRESHOLD = 200.0
    AMPLITUDE_VERY_LOW_THRESHOLD = 150.0
    
    BEAT_ERROR_NORMAL_MAX = 0.5
    BEAT_ERROR_MILD_THRESHOLD = 1.0
    BEAT_ERROR_SEVERE_THRESHOLD = 2.0
    
    POSITION_VARIATION_RATE_NORMAL = 15.0
    POSITION_VARIATION_RATE_MILD = 30.0
    POSITION_VARIATION_RATE_MODERATE = 50.0
    
    POSITION_VARIATION_AMPLITUDE_NORMAL = 40.0
    POSITION_VARIATION_AMPLITUDE_MILD = 60.0
    POSITION_VARIATION_AMPLITUDE_MODERATE = 80.0
    
    def __init__(self):
        pass
    
    def analyze_work_order(self, work_order: WorkOrder) -> WatchAnalysisResult:
        """
        分析工单的走时数据
        
        Args:
            work_order: 工单对象
            
        Returns:
            综合分析结果
        """
        result = WatchAnalysisResult(
            work_order_id=work_order.id
        )
        
        latest_log = work_order.get_latest_timing_log()
        
        if latest_log and latest_log.measurements:
            result.rate_drifts = self._analyze_rate_drift(work_order)
            result.amplitude_anomalies = self._analyze_amplitude_anomalies(latest_log, work_order.id)
            result.position_variations = self._analyze_position_variations(latest_log, work_order.id)
        
        result.rework_risk = self._assess_rework_risk(work_order, result)
        result.summary = self._generate_summary(work_order, result)
        
        return result
    
    def _analyze_rate_drift(self, work_order: WorkOrder) -> List[RateDriftAnalysis]:
        """
        分析日差漂移
        
        日差漂移检测：
        1. 如果有多个校表仪日志，比较同一方位在不同时间的日差
        2. 如果只有一个日志，检查日差是否在正常范围内
        """
        drifts: List[RateDriftAnalysis] = []
        
        timing_logs = work_order.timing_logs
        if not timing_logs:
            return drifts
        
        timing_logs_sorted = sorted(timing_logs, key=lambda x: x.test_date)
        
        if len(timing_logs_sorted) >= 2:
            first_log = timing_logs_sorted[0]
            last_log = timing_logs_sorted[-1]
            
            time_elapsed = (last_log.test_date - first_log.test_date).total_seconds() / 3600.0
            
            first_positions = {m.position: m for m in first_log.measurements}
            last_positions = {m.position: m for m in last_log.measurements}
            
            common_positions = set(first_positions.keys()) & set(last_positions.keys())
            
            for position in common_positions:
                initial_rate = first_positions[position].rate
                final_rate = last_positions[position].rate
                drift_amount = final_rate - initial_rate
                
                drift = self._create_rate_drift_analysis(
                    work_order.id, position, initial_rate, final_rate,
                    drift_amount, time_elapsed
                )
                drifts.append(drift)
        elif len(timing_logs_sorted) == 1:
            log = timing_logs_sorted[0]
            for measurement in log.measurements:
                drift_amount = measurement.rate
                drift = self._create_rate_drift_analysis(
                    work_order.id, measurement.position,
                    measurement.rate, measurement.rate,
                    drift_amount, None
                )
                drifts.append(drift)
        
        return drifts
    
    def _create_rate_drift_analysis(self, work_order_id: str, position: str,
                                     initial_rate: float, final_rate: float,
                                     drift_amount: float,
                                     time_elapsed_hours: Optional[float]) -> RateDriftAnalysis:
        """创建日差漂移分析结果"""
        abs_drift = abs(drift_amount)
        
        if drift_amount > 0:
            drift_direction = "positive"
        elif drift_amount < 0:
            drift_direction = "negative"
        else:
            drift_direction = "stable"
        
        if abs_drift <= self.RATE_NORMAL_MAX - self.RATE_NORMAL_MIN:
            drift_severity = "normal"
            is_concerning = False
        elif abs_drift <= self.RATE_MILD_THRESHOLD:
            drift_severity = "mild"
            is_concerning = False
        elif abs_drift <= self.RATE_MODERATE_THRESHOLD:
            drift_severity = "moderate"
            is_concerning = True
        else:
            drift_severity = "severe"
            is_concerning = True
        
        drift_rate_per_hour = None
        if time_elapsed_hours and time_elapsed_hours > 0:
            drift_rate_per_hour = drift_amount / time_elapsed_hours
        
        possible_causes = self._get_rate_drift_causes(drift_amount, drift_severity)
        
        return RateDriftAnalysis(
            id=str(uuid.uuid4()),
            work_order_id=work_order_id,
            position=position,
            initial_rate=initial_rate,
            final_rate=final_rate,
            drift_amount=drift_amount,
            drift_direction=drift_direction,
            drift_severity=drift_severity,
            drift_rate_per_hour=drift_rate_per_hour,
            time_elapsed_hours=time_elapsed_hours,
            is_concerning=is_concerning,
            possible_causes=possible_causes
        )
    
    def _get_rate_drift_causes(self, drift_amount: float, severity: str) -> List[str]:
        """获取日差漂移的可能原因"""
        causes = []
        
        if severity == "normal":
            return causes
        
        if drift_amount > 0:
            causes.append("走时偏快，可能原因：润滑油干涸或变质")
            causes.append("摆轮游丝受磁")
            causes.append("快慢针位置偏移")
            if severity in ["moderate", "severe"]:
                causes.append("游丝粘连或变形")
                causes.append("摆轮轴承磨损")
        else:
            causes.append("走时偏慢，可能原因：润滑油过多或粘稠")
            causes.append("摆轮游丝松驰")
            causes.append("擒纵机构磨损")
            if severity in ["moderate", "severe"]:
                causes.append("轮系传动阻力过大")
                causes.append("发条力矩不足")
        
        return causes
    
    def _analyze_amplitude_anomalies(self, timing_log: TimingLog,
                                       work_order_id: str) -> List[AmplitudeAnomaly]:
        """分析摆幅异常"""
        anomalies: List[AmplitudeAnomaly] = []
        
        for measurement in timing_log.measurements:
            amplitude = measurement.amplitude
            
            if amplitude < self.AMPLITUDE_NORMAL_MIN or amplitude > self.AMPLITUDE_NORMAL_MAX:
                anomaly = self._create_amplitude_anomaly(
                    work_order_id, measurement.position, amplitude
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def _create_amplitude_anomaly(self, work_order_id: str, position: str,
                                   measured_amplitude: float) -> AmplitudeAnomaly:
        """创建摆幅异常分析结果"""
        expected_min = self.AMPLITUDE_NORMAL_MIN
        expected_max = self.AMPLITUDE_NORMAL_MAX
        
        if measured_amplitude < expected_min:
            anomaly_type = "too_low"
            deviation = measured_amplitude - expected_min
        elif measured_amplitude > expected_max:
            anomaly_type = "too_high"
            deviation = measured_amplitude - expected_max
        else:
            anomaly_type = "inconsistent"
            deviation = 0.0
        
        deviation_percent = abs(deviation) / ((expected_min + expected_max) / 2) * 100
        
        if anomaly_type == "too_low":
            if measured_amplitude >= self.AMPLITUDE_LOW_THRESHOLD:
                severity = "mild"
            elif measured_amplitude >= self.AMPLITUDE_VERY_LOW_THRESHOLD:
                severity = "moderate"
            else:
                severity = "severe"
        else:
            if abs(deviation) <= 20:
                severity = "mild"
            elif abs(deviation) <= 40:
                severity = "moderate"
            else:
                severity = "severe"
        
        is_concerning = severity in ["moderate", "severe"]
        
        possible_causes = self._get_amplitude_anomaly_causes(anomaly_type, measured_amplitude)
        recommendations = self._get_amplitude_anomaly_recommendations(anomaly_type, severity)
        
        return AmplitudeAnomaly(
            id=str(uuid.uuid4()),
            work_order_id=work_order_id,
            position=position,
            measured_amplitude=measured_amplitude,
            expected_min=expected_min,
            expected_max=expected_max,
            deviation=deviation,
            deviation_percent=deviation_percent,
            anomaly_type=anomaly_type,
            severity=severity,
            is_concerning=is_concerning,
            possible_causes=possible_causes,
            recommendations=recommendations
        )
    
    def _get_amplitude_anomaly_causes(self, anomaly_type: str, amplitude: float) -> List[str]:
        """获取摆幅异常的可能原因"""
        causes = []
        
        if anomaly_type == "too_low":
            causes.append("摆幅偏低，可能原因：发条力矩不足")
            causes.append("轮系传动阻力过大")
            causes.append("润滑油干涸或变质")
            causes.append("擒纵机构磨损")
            if amplitude < self.AMPLITUDE_VERY_LOW_THRESHOLD:
                causes.append("摆轮轴承严重磨损")
                causes.append("游丝严重变形或粘连")
        else:
            causes.append("摆幅偏高，可能原因：发条上链过满")
            causes.append("润滑油过多")
            causes.append("摆轮惯量不匹配")
        
        return causes
    
    def _get_amplitude_anomaly_recommendations(self, anomaly_type: str, severity: str) -> List[str]:
        """获取摆幅异常的建议"""
        recommendations = []
        
        if anomaly_type == "too_low":
            recommendations.append("检查发条状态和力矩")
            recommendations.append("检查轮系传动是否顺畅")
            if severity in ["moderate", "severe"]:
                recommendations.append("检查摆轮轴承是否需要更换")
                recommendations.append("检查游丝状态是否正常")
        else:
            recommendations.append("检查发条上链情况")
            recommendations.append("检查润滑油是否过量")
        
        return recommendations
    
    def _analyze_position_variations(self, timing_log: TimingLog,
                                       work_order_id: str) -> List[PositionVariation]:
        """分析位差波动"""
        variations: List[PositionVariation] = []
        
        if len(timing_log.measurements) < 2:
            return variations
        
        rate_variation = self._analyze_single_position_variation(
            work_order_id, "rate", timing_log.measurements,
            lambda m: m.rate,
            self.POSITION_VARIATION_RATE_NORMAL,
            self.POSITION_VARIATION_RATE_MILD,
            self.POSITION_VARIATION_RATE_MODERATE
        )
        if rate_variation:
            variations.append(rate_variation)
        
        amplitude_variation = self._analyze_single_position_variation(
            work_order_id, "amplitude", timing_log.measurements,
            lambda m: m.amplitude,
            self.POSITION_VARIATION_AMPLITUDE_NORMAL,
            self.POSITION_VARIATION_AMPLITUDE_MILD,
            self.POSITION_VARIATION_AMPLITUDE_MODERATE
        )
        if amplitude_variation:
            variations.append(amplitude_variation)
        
        beat_error_variation = self._analyze_single_position_variation(
            work_order_id, "beat_error", timing_log.measurements,
            lambda m: m.beat_error,
            self.BEAT_ERROR_NORMAL_MAX,
            self.BEAT_ERROR_MILD_THRESHOLD,
            self.BEAT_ERROR_SEVERE_THRESHOLD
        )
        if beat_error_variation:
            variations.append(beat_error_variation)
        
        return variations
    
    def _analyze_single_position_variation(self, work_order_id: str,
                                             metric_type: str,
                                             measurements: List[TimingMeasurement],
                                             value_extractor,
                                             normal_threshold: float,
                                             mild_threshold: float,
                                             moderate_threshold: float) -> Optional[PositionVariation]:
        """分析单个指标的位差波动"""
        positions = []
        values: Dict[str, float] = {}
        
        for m in measurements:
            positions.append(m.position)
            values[m.position] = value_extractor(m)
        
        if not values:
            return None
        
        value_list = list(values.values())
        min_value = min(value_list)
        max_value = max(value_list)
        range_value = max_value - min_value
        average_value = sum(value_list) / len(value_list)
        
        variance = sum((v - average_value) ** 2 for v in value_list) / len(value_list)
        standard_deviation = math.sqrt(variance) if variance > 0 else 0.0
        
        if range_value <= normal_threshold:
            variation_severity = "normal"
            is_concerning = False
        elif range_value <= mild_threshold:
            variation_severity = "mild"
            is_concerning = False
        elif range_value <= moderate_threshold:
            variation_severity = "moderate"
            is_concerning = True
        else:
            variation_severity = "severe"
            is_concerning = True
        
        worst_position = None
        best_position = None
        
        if metric_type == "rate":
            worst_position = max(values.keys(), key=lambda k: abs(values[k]))
            best_position = min(values.keys(), key=lambda k: abs(values[k]))
        elif metric_type == "amplitude":
            worst_position = min(values.keys(), key=lambda k: values[k])
            best_position = max(values.keys(), key=lambda k: values[k])
        else:
            worst_position = max(values.keys(), key=lambda k: values[k])
            best_position = min(values.keys(), key=lambda k: values[k])
        
        possible_causes = self._get_position_variation_causes(metric_type, variation_severity)
        
        return PositionVariation(
            id=str(uuid.uuid4()),
            work_order_id=work_order_id,
            metric_type=metric_type,
            positions=positions,
            values=values,
            min_value=min_value,
            max_value=max_value,
            range_value=range_value,
            average_value=average_value,
            standard_deviation=standard_deviation,
            variation_severity=variation_severity,
            is_concerning=is_concerning,
            worst_position=worst_position,
            best_position=best_position,
            possible_causes=possible_causes
        )
    
    def _get_position_variation_causes(self, metric_type: str, severity: str) -> List[str]:
        """获取位差波动的可能原因"""
        causes = []
        
        if severity == "normal":
            return causes
        
        causes.append("位差异常，可能原因：摆轮静不平衡")
        causes.append("游丝外桩位置偏差")
        
        if metric_type == "rate":
            causes.append("方位误差过大，可能需要调整快慢针")
        elif metric_type == "amplitude":
            causes.append("摆幅位差大，可能是润滑油分布不均")
        else:
            causes.append("偏振位差大，需要调整擒纵机构")
        
        if severity in ["moderate", "severe"]:
            causes.append("建议进行摆轮平衡调校")
            causes.append("检查游丝状态是否正常")
        
        return causes
    
    def _assess_rework_risk(self, work_order: WorkOrder,
                             analysis_result: WatchAnalysisResult) -> ReworkRiskAssessment:
        """评估返修风险"""
        risk_score = 0.0
        risk_factors: List[Dict[str, Any]] = []
        contributing_issues: List[str] = []
        
        concerning_drifts = [d for d in analysis_result.rate_drifts if d.is_concerning]
        if concerning_drifts:
            for drift in concerning_drifts:
                if drift.drift_severity == "severe":
                    risk_score += 25
                elif drift.drift_severity == "moderate":
                    risk_score += 15
                risk_factors.append({
                    'factor': f'日差漂移 - {drift.position}',
                    'severity': drift.drift_severity,
                    'drift_amount': drift.drift_amount
                })
            contributing_issues.append(f"日差漂移异常 ({len(concerning_drifts)}个方位)")
        
        severe_anomalies = [a for a in analysis_result.amplitude_anomalies if a.severity in ["moderate", "severe"]]
        if severe_anomalies:
            for anomaly in severe_anomalies:
                if anomaly.severity == "severe":
                    risk_score += 30
                else:
                    risk_score += 20
                risk_factors.append({
                    'factor': f'摆幅异常 - {anomaly.position}',
                    'severity': anomaly.severity,
                    'amplitude': anomaly.measured_amplitude
                })
            contributing_issues.append(f"摆幅异常 ({len(severe_anomalies)}个方位)")
        
        concerning_variations = [v for v in analysis_result.position_variations if v.is_concerning]
        if concerning_variations:
            for variation in concerning_variations:
                if variation.variation_severity == "severe":
                    risk_score += 20
                else:
                    risk_score += 10
                risk_factors.append({
                    'factor': f'位差波动 - {variation.metric_type}',
                    'severity': variation.variation_severity,
                    'range': variation.range_value
                })
            contributing_issues.append(f"位差波动异常 ({len(concerning_variations)}项指标)")
        
        latest_waterproof = work_order.get_latest_waterproof_test()
        if latest_waterproof:
            if latest_waterproof.result == "fail":
                risk_score += 35
                risk_factors.append({
                    'factor': '防水测试失败',
                    'severity': 'critical',
                    'leak_detected': latest_waterproof.leak_detected
                })
                contributing_issues.append("防水测试失败")
            elif latest_waterproof.result == "conditional":
                risk_score += 15
                risk_factors.append({
                    'factor': '防水测试有条件通过',
                    'severity': 'moderate'
                })
                contributing_issues.append("防水测试有条件通过")
        
        completed_steps = work_order.get_completed_steps()
        steps_with_issues = [s for s in completed_steps if s.issues_found]
        if steps_with_issues:
            risk_score += len(steps_with_issues) * 5
            for step in steps_with_issues:
                risk_factors.append({
                    'factor': f'步骤发现问题 - {step.step_name}',
                    'severity': 'moderate',
                    'issues': step.issues_found
                })
            contributing_issues.append(f"拆洗步骤发现问题 ({len(steps_with_issues)}个步骤)")
        
        part_replacements = work_order.part_replacements
        if part_replacements:
            critical_parts = ['发条', '摆轮', '游丝', '擒纵轮', '马仔', '轴承']
            critical_replacements = [
                p for p in part_replacements
                if any(cp in p.part_name for cp in critical_parts)
            ]
            if critical_replacements:
                risk_score += 10
                risk_factors.append({
                    'factor': '关键零件更换',
                    'severity': 'mild',
                    'parts': [p.part_name for p in critical_replacements]
                })
                contributing_issues.append(f"关键零件更换 ({len(critical_replacements)}个)")
        
        latest_review = work_order.get_latest_review()
        if latest_review:
            if latest_review.rework_needed:
                risk_score += 40
                risk_factors.append({
                    'factor': '人工复核判定需返修',
                    'severity': 'critical',
                    'reason': latest_review.rework_reason
                })
                contributing_issues.append("人工复核判定需返修")
        
        risk_score = min(100, max(0, risk_score))
        
        if risk_score < 20:
            overall_risk_level = "low"
            probability_of_rework = 0.1
            priority_level = "low"
        elif risk_score < 40:
            overall_risk_level = "medium"
            probability_of_rework = 0.3
            priority_level = "normal"
        elif risk_score < 70:
            overall_risk_level = "high"
            probability_of_rework = 0.6
            priority_level = "high"
        else:
            overall_risk_level = "critical"
            probability_of_rework = 0.9
            priority_level = "urgent"
        
        recommended_actions = self._generate_recommended_actions(risk_score, risk_factors, work_order)
        
        return ReworkRiskAssessment(
            id=str(uuid.uuid4()),
            work_order_id=work_order.id,
            overall_risk_level=overall_risk_level,
            risk_score=risk_score,
            risk_factors=risk_factors,
            contributing_issues=contributing_issues,
            probability_of_rework=probability_of_rework,
            priority_level=priority_level,
            recommended_actions=recommended_actions
        )
    
    def _generate_recommended_actions(self, risk_score: float,
                                        risk_factors: List[Dict[str, Any]],
                                        work_order: WorkOrder) -> List[str]:
        """生成建议措施"""
        actions = []
        
        if risk_score >= 70:
            actions.append("立即进行全面复检")
            actions.append("优先安排资深技师复查")
        elif risk_score >= 40:
            actions.append("建议进行针对性复检")
        
        factor_types = [f.get('factor', '') for f in risk_factors]
        
        if any('日差漂移' in f for f in factor_types):
            actions.append("重新调校快慢针")
            actions.append("检查游丝是否受磁")
        
        if any('摆幅异常' in f for f in factor_types):
            actions.append("检查发条力矩")
            actions.append("检查轮系传动阻力")
        
        if any('位差波动' in f for f in factor_types):
            actions.append("进行摆轮平衡调校")
            actions.append("检查游丝外桩位置")
        
        if any('防水测试失败' in f for f in factor_types):
            actions.append("检查表壳密封圈")
            actions.append("检查表冠防水结构")
            actions.append("重新进行防水测试")
        
        if any('步骤发现问题' in f for f in factor_types):
            actions.append("复查发现问题的步骤")
        
        return actions
    
    def _generate_summary(self, work_order: WorkOrder,
                           analysis_result: WatchAnalysisResult) -> Dict[str, Any]:
        """生成分析摘要"""
        summary: Dict[str, Any] = {}
        
        latest_log = work_order.get_latest_timing_log()
        
        if latest_log and latest_log.measurements:
            rates = [m.rate for m in latest_log.measurements]
            amplitudes = [m.amplitude for m in latest_log.measurements]
            beat_errors = [m.beat_error for m in latest_log.measurements]
            
            summary['timing'] = {
                'avg_rate': sum(rates) / len(rates),
                'min_rate': min(rates),
                'max_rate': max(rates),
                'avg_amplitude': sum(amplitudes) / len(amplitudes),
                'min_amplitude': min(amplitudes),
                'max_amplitude': max(amplitudes),
                'avg_beat_error': sum(beat_errors) / len(beat_errors),
                'position_count': len(latest_log.measurements)
            }
        
        if analysis_result.rate_drifts:
            concerning = [d for d in analysis_result.rate_drifts if d.is_concerning]
            summary['rate_drift'] = {
                'total': len(analysis_result.rate_drifts),
                'concerning_count': len(concerning),
                'max_drift': max(abs(d.drift_amount) for d in analysis_result.rate_drifts)
            }
        
        if analysis_result.amplitude_anomalies:
            summary['amplitude_anomalies'] = {
                'total': len(analysis_result.amplitude_anomalies),
                'severe_count': len([a for a in analysis_result.amplitude_anomalies if a.severity == 'severe']),
                'lowest_amplitude': min(a.measured_amplitude for a in analysis_result.amplitude_anomalies)
            }
        
        if analysis_result.position_variations:
            concerning = [v for v in analysis_result.position_variations if v.is_concerning]
            summary['position_variation'] = {
                'total': len(analysis_result.position_variations),
                'concerning_count': len(concerning)
            }
        
        if analysis_result.rework_risk:
            summary['rework_risk'] = {
                'level': analysis_result.rework_risk.overall_risk_level,
                'score': analysis_result.rework_risk.risk_score,
                'probability': analysis_result.rework_risk.probability_of_rework,
                'issue_count': len(analysis_result.rework_risk.contributing_issues)
            }
        
        latest_waterproof = work_order.get_latest_waterproof_test()
        if latest_waterproof:
            summary['waterproof_test'] = {
                'result': latest_waterproof.result,
                'leak_detected': latest_waterproof.leak_detected,
                'test_date': latest_waterproof.test_date.isoformat()
            }
        
        if work_order.part_replacements:
            summary['parts'] = {
                'replacement_count': len(work_order.part_replacements),
                'total_parts': sum(p.quantity for p in work_order.part_replacements)
            }
        
        latest_review = work_order.get_latest_review()
        if latest_review:
            summary['review'] = {
                'overall_status': latest_review.overall_status,
                'rework_needed': latest_review.rework_needed,
                'reviewer': latest_review.reviewer
            }
        
        return summary
