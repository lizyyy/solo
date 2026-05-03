from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

from models.case import Case
from models.risk import RiskType, RiskSeverity
from .rule_engine import BaseRule, RuleResult
from .rule_config import RuleConfig


class HypothermiaRule(BaseRule):
    """
    低体温检测规则
    检测体温低于正常阈值的情况
    """
    
    def __init__(self, config: RuleConfig = None):
        super().__init__(config)
        self.rule_description = "检测麻醉过程中的低体温风险"
    
    def execute(self, case: Case) -> RuleResult:
        """
        执行低体温检测
        """
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description
        )
        
        if not case.vital_signs or not case.vital_signs.records:
            result.warnings.append("没有生命体征数据，无法检测低体温")
            return result
        
        # 获取体温数据
        temp_series = case.vital_signs.get_parameter_series('temperature')
        
        if not temp_series:
            result.warnings.append("没有体温数据，无法检测低体温")
            return result
        
        # 按时间排序
        sorted_times = sorted(temp_series.keys())
        
        # 检测低体温片段
        hypothermia_segments = []
        severe_hypothermia_segments = []
        
        current_mild_segment = None
        current_severe_segment = None
        
        for time in sorted_times:
            temp = temp_series[time]
            
            # 检测严重低体温
            if temp <= self.config.hypothermia_threshold_severe:
                if current_severe_segment is None:
                    current_severe_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_temp': temp,
                        'max_temp': temp,
                        'sum_temp': temp,
                        'count': 1
                    }
                else:
                    current_severe_segment['end_time'] = time
                    current_severe_segment['min_temp'] = min(current_severe_segment['min_temp'], temp)
                    current_severe_segment['max_temp'] = max(current_severe_segment['max_temp'], temp)
                    current_severe_segment['sum_temp'] += temp
                    current_severe_segment['count'] += 1
                
                # 严重低体温也属于轻度低体温
                if current_mild_segment is None:
                    current_mild_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_temp': temp,
                        'max_temp': temp,
                        'sum_temp': temp,
                        'count': 1
                    }
                else:
                    current_mild_segment['end_time'] = time
                    current_mild_segment['min_temp'] = min(current_mild_segment['min_temp'], temp)
                    current_mild_segment['max_temp'] = max(current_mild_segment['max_temp'], temp)
                    current_mild_segment['sum_temp'] += temp
                    current_mild_segment['count'] += 1
            
            # 检测轻度低体温（但不是严重低体温）
            elif temp <= self.config.hypothermia_threshold_mild:
                # 结束严重低体温片段
                if current_severe_segment is not None:
                    severe_hypothermia_segments.append(current_severe_segment)
                    current_severe_segment = None
                
                if current_mild_segment is None:
                    current_mild_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_temp': temp,
                        'max_temp': temp,
                        'sum_temp': temp,
                        'count': 1
                    }
                else:
                    current_mild_segment['end_time'] = time
                    current_mild_segment['min_temp'] = min(current_mild_segment['min_temp'], temp)
                    current_mild_segment['max_temp'] = max(current_mild_segment['max_temp'], temp)
                    current_mild_segment['sum_temp'] += temp
                    current_mild_segment['count'] += 1
            
            # 体温恢复正常
            else:
                # 结束当前片段
                if current_severe_segment is not None:
                    severe_hypothermia_segments.append(current_severe_segment)
                    current_severe_segment = None
                
                if current_mild_segment is not None:
                    hypothermia_segments.append(current_mild_segment)
                    current_mild_segment = None
        
        # 检查最后是否有未结束的片段
        if current_severe_segment is not None:
            severe_hypothermia_segments.append(current_severe_segment)
        
        if current_mild_segment is not None:
            hypothermia_segments.append(current_mild_segment)
        
        # 处理严重低体温风险
        for seg_data in severe_hypothermia_segments:
            duration = seg_data['end_time'] - seg_data['start_time']
            duration_minutes = duration.total_seconds() / 60
            
            # 检查持续时间
            if duration_minutes >= self.config.hypothermia_duration_minutes:
                segments = [self._create_segment(
                    start_time=seg_data['start_time'],
                    end_time=seg_data['end_time'],
                    min_value=seg_data['min_temp'],
                    max_value=seg_data['max_temp'],
                    avg_value=seg_data['sum_temp'] / seg_data['count'],
                    trigger_value=self.config.hypothermia_threshold_severe,
                    parameter='temperature'
                )]
                
                risk = self._create_risk(
                    case=case,
                    risk_type=RiskType.HYPOTHERMIA_SEVERE,
                    severity=RiskSeverity.CRITICAL,
                    description=f"检测到严重低体温，持续时间: {duration_minutes:.1f}分钟，最低体温: {seg_data['min_temp']:.1f}°C",
                    recommendation="建议立即采取复温措施：使用加热毯、输液加温、提高环境温度等。密切监测体温变化。",
                    segments=segments
                )
                
                result.risks.append(risk)
        
        # 处理轻度低体温风险（排除已经被标记为严重低体温的）
        # 这里简化处理，只检测轻度低体温
        # 实际应用中可能需要更复杂的逻辑来避免重复
        
        return result


class SpO2DropRule(BaseRule):
    """
    血氧掉点检测规则
    检测血氧饱和度突然下降或持续偏低的情况
    """
    
    def __init__(self, config: RuleConfig = None):
        super().__init__(config)
        self.rule_description = "检测麻醉过程中的血氧掉点风险"
    
    def execute(self, case: Case) -> RuleResult:
        """
        执行血氧检测
        """
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description
        )
        
        if not case.vital_signs or not case.vital_signs.records:
            result.warnings.append("没有生命体征数据，无法检测血氧")
            return result
        
        # 获取血氧数据
        spo2_series = case.vital_signs.get_parameter_series('spo2')
        
        if not spo2_series:
            result.warnings.append("没有血氧数据，无法检测血氧风险")
            return result
        
        # 按时间排序
        sorted_times = sorted(spo2_series.keys())
        sorted_values = [spo2_series[t] for t in sorted_times]
        
        # 检测低血氧片段
        low_spo2_segments = []
        current_segment = None
        
        for i, (time, spo2) in enumerate(zip(sorted_times, sorted_values)):
            # 检测低血氧
            if spo2 <= self.config.spo2_critical_min:
                if current_segment is None:
                    current_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_spo2': spo2,
                        'max_spo2': spo2,
                        'sum_spo2': spo2,
                        'count': 1,
                        'is_critical': True
                    }
                else:
                    current_segment['end_time'] = time
                    current_segment['min_spo2'] = min(current_segment['min_spo2'], spo2)
                    current_segment['max_spo2'] = max(current_segment['max_spo2'], spo2)
                    current_segment['sum_spo2'] += spo2
                    current_segment['count'] += 1
            
            elif spo2 <= self.config.spo2_normal_min:
                # 血氧偏低但未到临界值
                if current_segment is None:
                    current_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_spo2': spo2,
                        'max_spo2': spo2,
                        'sum_spo2': spo2,
                        'count': 1,
                        'is_critical': False
                    }
                else:
                    current_segment['end_time'] = time
                    current_segment['min_spo2'] = min(current_segment['min_spo2'], spo2)
                    current_segment['max_spo2'] = max(current_segment['max_spo2'], spo2)
                    current_segment['sum_spo2'] += spo2
                    current_segment['count'] += 1
                    # 如果之前不是临界但现在变临界，标记为临界
                    if spo2 <= self.config.spo2_critical_min:
                        current_segment['is_critical'] = True
            
            else:
                # 血氧恢复正常
                if current_segment is not None:
                    low_spo2_segments.append(current_segment)
                    current_segment = None
        
        # 检查最后是否有未结束的片段
        if current_segment is not None:
            low_spo2_segments.append(current_segment)
        
        # 检测血氧掉点（突然下降）
        drop_segments = []
        window_minutes = self.config.spo2_drop_window_minutes
        
        for i in range(1, len(sorted_times)):
            current_time = sorted_times[i]
            current_spo2 = sorted_values[i]
            
            # 查找时间窗口内的前值
            window_start = current_time - timedelta(minutes=window_minutes)
            
            for j in range(i-1, -1, -1):
                prev_time = sorted_times[j]
                prev_spo2 = sorted_values[j]
                
                if prev_time >= window_start:
                    drop = prev_spo2 - current_spo2
                    
                    if drop >= self.config.spo2_drop_threshold:
                        # 检测到血氧掉点
                        drop_segments.append({
                            'start_time': prev_time,
                            'end_time': current_time,
                            'start_spo2': prev_spo2,
                            'end_spo2': current_spo2,
                            'drop_amount': drop
                        })
                        break
                else:
                    break
        
        # 创建低血氧风险
        for seg_data in low_spo2_segments:
            duration = seg_data['end_time'] - seg_data['start_time']
            duration_minutes = duration.total_seconds() / 60
            
            segments = [self._create_segment(
                start_time=seg_data['start_time'],
                end_time=seg_data['end_time'],
                min_value=seg_data['min_spo2'],
                max_value=seg_data['max_spo2'],
                avg_value=seg_data['sum_spo2'] / seg_data['count'],
                trigger_value=self.config.spo2_critical_min if seg_data['is_critical'] else self.config.spo2_normal_min,
                parameter='spo2'
            )]
            
            if seg_data['is_critical']:
                risk = self._create_risk(
                    case=case,
                    risk_type=RiskType.SPO2_LOW,
                    severity=RiskSeverity.CRITICAL,
                    description=f"检测到临界低血氧，持续时间: {duration_minutes:.1f}分钟，最低血氧: {seg_data['min_spo2']:.1f}%",
                    recommendation="建议立即检查气道通畅性，检查氧供，必要时进行人工通气或提高吸入氧浓度。",
                    segments=segments
                )
            else:
                risk = self._create_risk(
                    case=case,
                    risk_type=RiskType.SPO2_LOW,
                    severity=RiskSeverity.MODERATE,
                    description=f"检测到低血氧，持续时间: {duration_minutes:.1f}分钟，最低血氧: {seg_data['min_spo2']:.1f}%",
                    recommendation="建议检查血氧饱和度读数，确认传感器位置，评估呼吸功能。",
                    segments=segments
                )
            
            result.risks.append(risk)
        
        # 创建血氧掉点风险
        for drop_data in drop_segments:
            segments = [self._create_segment(
                start_time=drop_data['start_time'],
                end_time=drop_data['end_time'],
                min_value=drop_data['end_spo2'],
                max_value=drop_data['start_spo2'],
                trigger_value=self.config.spo2_drop_threshold,
                parameter='spo2'
            )]
            
            risk = self._create_risk(
                case=case,
                risk_type=RiskType.SPO2_DROP,
                severity=RiskSeverity.MODERATE,
                description=f"检测到血氧掉点: {drop_data['start_spo2']:.1f}% → {drop_data['end_spo2']:.1f}%，下降了{drop_data['drop_amount']:.1f}%",
                recommendation="建议评估掉点原因，检查是否存在呼吸抑制、气道问题或传感器移位。",
                segments=segments
            )
            
            result.risks.append(risk)
        
        return result


class MedicationOverdueRule(BaseRule):
    """
    追加用药超时检测规则
    检测是否超过建议时间间隔未追加用药
    """
    
    def __init__(self, config: RuleConfig = None):
        super().__init__(config)
        self.rule_description = "检测追加用药超时风险"
    
    def execute(self, case: Case) -> RuleResult:
        """
        执行用药超时检测
        """
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description
        )
        
        if not case.medication or not case.medication.records:
            result.warnings.append("没有给药记录，无法检测用药超时")
            return result
        
        # 按药物分组
        medication_groups = defaultdict(list)
        for record in case.medication.records:
            if record.timestamp:
                medication_groups[record.medication_name].append(record)
        
        # 检查每种药物的用药间隔
        for med_name, records in medication_groups.items():
            # 按时间排序
            records.sort(key=lambda x: x.timestamp)
            
            # 获取该药物的建议间隔
            expected_interval = self.config.get_medication_interval(med_name)
            
            # 检查相邻用药的间隔
            for i in range(1, len(records)):
                prev_record = records[i-1]
                curr_record = records[i]
                
                actual_interval = curr_record.timestamp - prev_record.timestamp
                actual_interval_minutes = actual_interval.total_seconds() / 60
                
                # 检查是否超时
                if actual_interval_minutes > expected_interval * 1.5:  # 允许1.5倍的缓冲
                    segments = [self._create_segment(
                        start_time=prev_record.timestamp + timedelta(minutes=expected_interval),
                        end_time=curr_record.timestamp,
                        trigger_value=expected_interval,
                        parameter='medication_interval'
                    )]
                    
                    risk = self._create_risk(
                        case=case,
                        risk_type=RiskType.MEDICATION_OVERDUE,
                        severity=RiskSeverity.MODERATE,
                        description=f"药物'{med_name}'追加用药超时: 建议间隔{expected_interval}分钟，实际间隔{actual_interval_minutes:.1f}分钟",
                        recommendation=f"建议评估用药间隔是否合理，确认是否存在遗忘给药或药物作用时间异常。",
                        segments=segments
                    )
                    
                    risk.metadata['medication_name'] = med_name
                    risk.metadata['expected_interval_minutes'] = expected_interval
                    risk.metadata['actual_interval_minutes'] = actual_interval_minutes
                    risk.metadata['previous_dose_time'] = prev_record.timestamp.isoformat()
                    risk.metadata['current_dose_time'] = curr_record.timestamp.isoformat()
                    
                    result.risks.append(risk)
        
        return result


class RecoveryScoreRule(BaseRule):
    """
    复苏评分检测规则
    检测复苏评分是否符合预期
    """
    
    def __init__(self, config: RuleConfig = None):
        super().__init__(config)
        self.rule_description = "检测复苏评分不符风险"
    
    def execute(self, case: Case) -> RuleResult:
        """
        执行复苏评分检测
        注意：此规则需要人工录入的复苏评分数据
        这里基于生命体征参数进行间接评估
        """
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description
        )
        
        if not case.vital_signs or not case.vital_signs.records:
            result.warnings.append("没有生命体征数据，无法评估复苏情况")
            return result
        
        # 获取时间范围
        start_time, end_time = case.get_time_range()
        
        if not start_time or not end_time:
            result.warnings.append("无法确定时间范围，无法评估复苏情况")
            return result
        
        # 检查复苏阶段的生命体征
        # 复苏阶段通常是手术结束后的一段时间
        # 这里简化处理：检查最后30分钟的生命体征
        
        recovery_start = end_time - timedelta(minutes=30)
        
        # 获取复苏阶段的记录
        recovery_records = case.vital_signs.get_records_in_range(recovery_start, end_time)
        
        if not recovery_records:
            result.warnings.append("没有复苏阶段的生命体征数据")
            return result
        
        # 评估复苏阶段的生命体征稳定性
        issues = []
        
        # 检查心率
        hr_values = [r.heart_rate for r in recovery_records if r.heart_rate is not None]
        if hr_values:
            species = case.species or "DOG"
            hr_min, hr_max = self.config.get_hr_range(species)
            
            avg_hr = sum(hr_values) / len(hr_values)
            min_hr = min(hr_values)
            max_hr = max(hr_values)
            
            if avg_hr < hr_min * 0.8:
                issues.append(f"复苏阶段心率偏低: 平均{avg_hr:.0f} bpm，正常范围{hr_min:.0f}-{hr_max:.0f} bpm")
            
            if avg_hr > hr_max * 1.2:
                issues.append(f"复苏阶段心率偏高: 平均{avg_hr:.0f} bpm，正常范围{hr_min:.0f}-{hr_max:.0f} bpm")
            
            # 心率波动大
            if max_hr - min_hr > 40:
                issues.append(f"复苏阶段心率波动大: {min_hr:.0f} - {max_hr:.0f} bpm")
        
        # 检查血压
        map_values = [r.mean_bp for r in recovery_records if r.mean_bp is not None]
        if map_values:
            avg_map = sum(map_values) / len(map_values)
            
            if avg_map < self.config.map_normal_min:
                issues.append(f"复苏阶段平均压偏低: 平均{avg_map:.0f} mmHg")
        
        # 检查血氧
        spo2_values = [r.spo2 for r in recovery_records if r.spo2 is not None]
        if spo2_values:
            min_spo2 = min(spo2_values)
            
            if min_spo2 < self.config.spo2_normal_min:
                issues.append(f"复苏阶段血氧偏低: 最低{min_spo2:.1f}%")
        
        # 检查体温
        temp_values = [r.temperature for r in recovery_records if r.temperature is not None]
        if temp_values:
            min_temp = min(temp_values)
            
            if min_temp < self.config.hypothermia_threshold_mild:
                issues.append(f"复苏阶段体温偏低: 最低{min_temp:.1f}°C")
        
        # 如果有问题，创建风险
        if issues:
            segments = [self._create_segment(
                start_time=recovery_start,
                end_time=end_time,
                parameter='recovery'
            )]
            
            description = "复苏阶段检测到以下问题:\n" + "\n".join(f"- {issue}" for issue in issues)
            
            risk = self._create_risk(
                case=case,
                risk_type=RiskType.RECOVERY_SCORE_MISMATCH,
                severity=RiskSeverity.MODERATE,
                description=description,
                recommendation="建议密切监测复苏阶段的生命体征，必要时采取干预措施。建议记录详细的复苏评分以便后续分析。",
                segments=segments
            )
            
            result.risks.append(risk)
        
        return result


class HypotensionRule(BaseRule):
    """
    低血压检测规则
    """
    
    def __init__(self, config: RuleConfig = None):
        super().__init__(config)
        self.rule_description = "检测麻醉过程中的低血压风险"
    
    def execute(self, case: Case) -> RuleResult:
        """
        执行低血压检测
        """
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description
        )
        
        if not case.vital_signs or not case.vital_signs.records:
            result.warnings.append("没有生命体征数据，无法检测低血压")
            return result
        
        # 获取血压数据
        map_series = case.vital_signs.get_parameter_series('mean_bp')
        
        if not map_series:
            # 尝试使用收缩压
            sbp_series = case.vital_signs.get_parameter_series('systolic_bp')
            if not sbp_series:
                result.warnings.append("没有血压数据，无法检测低血压")
                return result
            # 使用收缩压估算平均压
            map_series = {t: v * 0.6 for t, v in sbp_series.items()}
        
        # 按时间排序
        sorted_times = sorted(map_series.keys())
        
        # 检测低血压片段
        hypotension_segments = []
        current_segment = None
        
        for time in sorted_times:
            map_val = map_series[time]
            
            if map_val <= self.config.map_critical_min:
                if current_segment is None:
                    current_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_map': map_val,
                        'max_map': map_val,
                        'sum_map': map_val,
                        'count': 1,
                        'is_critical': True
                    }
                else:
                    current_segment['end_time'] = time
                    current_segment['min_map'] = min(current_segment['min_map'], map_val)
                    current_segment['max_map'] = max(current_segment['max_map'], map_val)
                    current_segment['sum_map'] += map_val
                    current_segment['count'] += 1
            
            elif map_val <= self.config.map_normal_min:
                if current_segment is None:
                    current_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_map': map_val,
                        'max_map': map_val,
                        'sum_map': map_val,
                        'count': 1,
                        'is_critical': False
                    }
                else:
                    current_segment['end_time'] = time
                    current_segment['min_map'] = min(current_segment['min_map'], map_val)
                    current_segment['max_map'] = max(current_segment['max_map'], map_val)
                    current_segment['sum_map'] += map_val
                    current_segment['count'] += 1
                    if map_val <= self.config.map_critical_min:
                        current_segment['is_critical'] = True
            
            else:
                if current_segment is not None:
                    hypotension_segments.append(current_segment)
                    current_segment = None
        
        if current_segment is not None:
            hypotension_segments.append(current_segment)
        
        # 创建风险
        for seg_data in hypotension_segments:
            duration = seg_data['end_time'] - seg_data['start_time']
            duration_minutes = duration.total_seconds() / 60
            
            # 只报告持续超过1分钟的低血压
            if duration_minutes >= 1:
                segments = [self._create_segment(
                    start_time=seg_data['start_time'],
                    end_time=seg_data['end_time'],
                    min_value=seg_data['min_map'],
                    max_value=seg_data['max_map'],
                    avg_value=seg_data['sum_map'] / seg_data['count'],
                    trigger_value=self.config.map_critical_min if seg_data['is_critical'] else self.config.map_normal_min,
                    parameter='mean_bp'
                )]
                
                if seg_data['is_critical']:
                    risk = self._create_risk(
                        case=case,
                        risk_type=RiskType.HYPOTENSION,
                        severity=RiskSeverity.CRITICAL,
                        description=f"检测到严重低血压，持续时间: {duration_minutes:.1f}分钟，最低平均压: {seg_data['min_map']:.1f} mmHg",
                        recommendation="建议立即评估低血压原因，考虑减少麻醉深度、扩容、使用血管活性药物等措施。",
                        segments=segments
                    )
                else:
                    risk = self._create_risk(
                        case=case,
                        risk_type=RiskType.HYPOTENSION,
                        severity=RiskSeverity.MODERATE,
                        description=f"检测到低血压，持续时间: {duration_minutes:.1f}分钟，最低平均压: {seg_data['min_map']:.1f} mmHg",
                        recommendation="建议监测血压变化，评估是否需要调整麻醉深度或补液。",
                        segments=segments
                    )
                
                result.risks.append(risk)
        
        return result


class HypertensionRule(BaseRule):
    """
    高血压检测规则
    """
    
    def __init__(self, config: RuleConfig = None):
        super().__init__(config)
        self.rule_description = "检测麻醉过程中的高血压风险"
    
    def execute(self, case: Case) -> RuleResult:
        """
        执行高血压检测
        """
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description
        )
        
        if not case.vital_signs or not case.vital_signs.records:
            result.warnings.append("没有生命体征数据，无法检测高血压")
            return result
        
        # 获取血压数据
        map_series = case.vital_signs.get_parameter_series('mean_bp')
        
        if not map_series:
            sbp_series = case.vital_signs.get_parameter_series('systolic_bp')
            if not sbp_series:
                result.warnings.append("没有血压数据，无法检测高血压")
                return result
            map_series = {t: v * 0.6 for t, v in sbp_series.items()}
        
        # 按时间排序
        sorted_times = sorted(map_series.keys())
        
        # 检测高血压片段
        hypertension_segments = []
        current_segment = None
        
        for time in sorted_times:
            map_val = map_series[time]
            
            if map_val >= self.config.map_critical_max:
                if current_segment is None:
                    current_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_map': map_val,
                        'max_map': map_val,
                        'sum_map': map_val,
                        'count': 1,
                        'is_critical': True
                    }
                else:
                    current_segment['end_time'] = time
                    current_segment['min_map'] = min(current_segment['min_map'], map_val)
                    current_segment['max_map'] = max(current_segment['max_map'], map_val)
                    current_segment['sum_map'] += map_val
                    current_segment['count'] += 1
            
            elif map_val >= self.config.map_normal_max:
                if current_segment is None:
                    current_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_map': map_val,
                        'max_map': map_val,
                        'sum_map': map_val,
                        'count': 1,
                        'is_critical': False
                    }
                else:
                    current_segment['end_time'] = time
                    current_segment['min_map'] = min(current_segment['min_map'], map_val)
                    current_segment['max_map'] = max(current_segment['max_map'], map_val)
                    current_segment['sum_map'] += map_val
                    current_segment['count'] += 1
                    if map_val >= self.config.map_critical_max:
                        current_segment['is_critical'] = True
            
            else:
                if current_segment is not None:
                    hypertension_segments.append(current_segment)
                    current_segment = None
        
        if current_segment is not None:
            hypertension_segments.append(current_segment)
        
        # 创建风险
        for seg_data in hypertension_segments:
            duration = seg_data['end_time'] - seg_data['start_time']
            duration_minutes = duration.total_seconds() / 60
            
            if duration_minutes >= 1:
                segments = [self._create_segment(
                    start_time=seg_data['start_time'],
                    end_time=seg_data['end_time'],
                    min_value=seg_data['min_map'],
                    max_value=seg_data['max_map'],
                    avg_value=seg_data['sum_map'] / seg_data['count'],
                    trigger_value=self.config.map_critical_max if seg_data['is_critical'] else self.config.map_normal_max,
                    parameter='mean_bp'
                )]
                
                if seg_data['is_critical']:
                    risk = self._create_risk(
                        case=case,
                        risk_type=RiskType.HYPERTENSION,
                        severity=RiskSeverity.CRITICAL,
                        description=f"检测到严重高血压，持续时间: {duration_minutes:.1f}分钟，最高平均压: {seg_data['max_map']:.1f} mmHg",
                        recommendation="建议立即评估高血压原因，考虑增加麻醉深度、使用降压药物等措施。",
                        segments=segments
                    )
                else:
                    risk = self._create_risk(
                        case=case,
                        risk_type=RiskType.HYPERTENSION,
                        severity=RiskSeverity.MODERATE,
                        description=f"检测到高血压，持续时间: {duration_minutes:.1f}分钟，最高平均压: {seg_data['max_map']:.1f} mmHg",
                        recommendation="建议监测血压变化，评估麻醉深度是否足够或是否存在疼痛刺激。",
                        segments=segments
                    )
                
                result.risks.append(risk)
        
        return result


class TachycardiaRule(BaseRule):
    """
    心动过速检测规则
    """
    
    def __init__(self, config: RuleConfig = None):
        super().__init__(config)
        self.rule_description = "检测麻醉过程中的心动过速风险"
    
    def execute(self, case: Case) -> RuleResult:
        """
        执行心动过速检测
        """
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description
        )
        
        if not case.vital_signs or not case.vital_signs.records:
            result.warnings.append("没有生命体征数据，无法检测心动过速")
            return result
        
        # 获取心率数据
        hr_series = case.vital_signs.get_parameter_series('heart_rate')
        
        if not hr_series:
            result.warnings.append("没有心率数据，无法检测心动过速")
            return result
        
        # 按时间排序
        sorted_times = sorted(hr_series.keys())
        
        # 获取物种特定的心率范围
        species = case.species or "DOG"
        hr_min, hr_max = self.config.get_hr_range(species)
        
        # 检测心动过速片段
        tachycardia_segments = []
        current_segment = None
        
        for time in sorted_times:
            hr_val = hr_series[time]
            
            # 超过正常上限的1.2倍视为心动过速
            if hr_val >= hr_max * 1.2:
                if current_segment is None:
                    current_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_hr': hr_val,
                        'max_hr': hr_val,
                        'sum_hr': hr_val,
                        'count': 1
                    }
                else:
                    current_segment['end_time'] = time
                    current_segment['min_hr'] = min(current_segment['min_hr'], hr_val)
                    current_segment['max_hr'] = max(current_segment['max_hr'], hr_val)
                    current_segment['sum_hr'] += hr_val
                    current_segment['count'] += 1
            else:
                if current_segment is not None:
                    tachycardia_segments.append(current_segment)
                    current_segment = None
        
        if current_segment is not None:
            tachycardia_segments.append(current_segment)
        
        # 创建风险
        for seg_data in tachycardia_segments:
            duration = seg_data['end_time'] - seg_data['start_time']
            duration_minutes = duration.total_seconds() / 60
            
            if duration_minutes >= 1:
                segments = [self._create_segment(
                    start_time=seg_data['start_time'],
                    end_time=seg_data['end_time'],
                    min_value=seg_data['min_hr'],
                    max_value=seg_data['max_hr'],
                    avg_value=seg_data['sum_hr'] / seg_data['count'],
                    trigger_value=hr_max * 1.2,
                    parameter='heart_rate'
                )]
                
                severity = RiskSeverity.MODERATE
                if seg_data['max_hr'] >= hr_max * 1.5:
                    severity = RiskSeverity.SEVERE
                
                risk = self._create_risk(
                    case=case,
                    risk_type=RiskType.TACHYCARDIA,
                    severity=severity,
                    description=f"检测到心动过速，持续时间: {duration_minutes:.1f}分钟，最高心率: {seg_data['max_hr']:.0f} bpm (正常上限: {hr_max:.0f} bpm)",
                    recommendation="建议评估心动过速原因：检查麻醉深度、是否存在疼痛、低血容量、缺氧或药物影响。",
                    segments=segments
                )
                
                result.risks.append(risk)
        
        return result


class BradycardiaRule(BaseRule):
    """
    心动过缓检测规则
    """
    
    def __init__(self, config: RuleConfig = None):
        super().__init__(config)
        self.rule_description = "检测麻醉过程中的心动过缓风险"
    
    def execute(self, case: Case) -> RuleResult:
        """
        执行心动过缓检测
        """
        result = RuleResult(
            rule_name=self.rule_name,
            rule_description=self.rule_description
        )
        
        if not case.vital_signs or not case.vital_signs.records:
            result.warnings.append("没有生命体征数据，无法检测心动过缓")
            return result
        
        # 获取心率数据
        hr_series = case.vital_signs.get_parameter_series('heart_rate')
        
        if not hr_series:
            result.warnings.append("没有心率数据，无法检测心动过缓")
            return result
        
        # 按时间排序
        sorted_times = sorted(hr_series.keys())
        
        # 获取物种特定的心率范围
        species = case.species or "DOG"
        hr_min, hr_max = self.config.get_hr_range(species)
        
        # 检测心动过缓片段
        bradycardia_segments = []
        current_segment = None
        
        for time in sorted_times:
            hr_val = hr_series[time]
            
            # 低于正常下限的0.8倍视为心动过缓
            if hr_val <= hr_min * 0.8:
                if current_segment is None:
                    current_segment = {
                        'start_time': time,
                        'end_time': time,
                        'min_hr': hr_val,
                        'max_hr': hr_val,
                        'sum_hr': hr_val,
                        'count': 1
                    }
                else:
                    current_segment['end_time'] = time
                    current_segment['min_hr'] = min(current_segment['min_hr'], hr_val)
                    current_segment['max_hr'] = max(current_segment['max_hr'], hr_val)
                    current_segment['sum_hr'] += hr_val
                    current_segment['count'] += 1
            else:
                if current_segment is not None:
                    bradycardia_segments.append(current_segment)
                    current_segment = None
        
        if current_segment is not None:
            bradycardia_segments.append(current_segment)
        
        # 创建风险
        for seg_data in bradycardia_segments:
            duration = seg_data['end_time'] - seg_data['start_time']
            duration_minutes = duration.total_seconds() / 60
            
            if duration_minutes >= 1:
                segments = [self._create_segment(
                    start_time=seg_data['start_time'],
                    end_time=seg_data['end_time'],
                    min_value=seg_data['min_hr'],
                    max_value=seg_data['max_hr'],
                    avg_value=seg_data['sum_hr'] / seg_data['count'],
                    trigger_value=hr_min * 0.8,
                    parameter='heart_rate'
                )]
                
                severity = RiskSeverity.MODERATE
                if seg_data['min_hr'] <= hr_min * 0.6:
                    severity = RiskSeverity.SEVERE
                
                risk = self._create_risk(
                    case=case,
                    risk_type=RiskType.BRADYCARDIA,
                    severity=severity,
                    description=f"检测到心动过缓，持续时间: {duration_minutes:.1f}分钟，最低心率: {seg_data['min_hr']:.0f} bpm (正常下限: {hr_min:.0f} bpm)",
                    recommendation="建议评估心动过缓原因：检查麻醉深度、是否存在迷走神经兴奋、缺氧或药物影响。必要时使用抗胆碱能药物。",
                    segments=segments
                )
                
                result.risks.append(risk)
        
        return result
