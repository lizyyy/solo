from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

from .calculator import CoordinationCheck, FaultAnalysis, ProtectionAction


@dataclass
class Issue:
    """问题项"""
    issue_id: str
    rule_name: str
    severity: str
    category: str
    description: str
    affected_devices: List[str]
    fault_location: Optional[str] = None
    fault_type: Optional[str] = None
    details: Dict[str, Any] = None
    recommendation: str = ""


class BaseRule(ABC):
    """规则基类"""
    
    rule_name: str = ""
    category: str = ""
    description: str = ""
    
    @abstractmethod
    def evaluate(self, coordination_results: Dict[str, Any], 
                 input_data: Dict[str, Any]) -> List[Issue]:
        """评估规则"""
        pass


class CTInconsistencyRule(BaseRule):
    """CT变比不一致规则"""
    
    rule_name = "CT变比不一致"
    category = "配置问题"
    description = "检查上下级保护的CT变比是否一致"
    
    def __init__(self, warn_ratio_diff: float = 0.2):
        self.warn_ratio_diff = warn_ratio_diff
    
    def evaluate(self, coordination_results: Dict[str, Any], 
                 input_data: Dict[str, Any]) -> List[Issue]:
        issues = []
        
        settings = input_data.get('settings', [])
        devices = input_data.get('devices', [])
        
        device_to_ct = {}
        
        for setting in settings:
            device_id = setting.get('device_id', '')
            if device_id and setting.get('ct_ratio'):
                device_to_ct[device_id] = {
                    'ct_ratio': setting.get('ct_ratio'),
                    'source': 'settings'
                }
        
        for device in devices:
            device_id = device.get('device_id', '')
            ct_primary = device.get('ct_ratio_primary')
            ct_secondary = device.get('ct_ratio_secondary', 5.0)
            
            if device_id and ct_primary and ct_secondary:
                ct_ratio = ct_primary / ct_secondary
                if device_id not in device_to_ct:
                    device_to_ct[device_id] = {
                        'ct_ratio': ct_ratio,
                        'source': 'devices'
                    }
        
        coordination_pairs = self._get_coordination_pairs(coordination_results)
        
        for upstream_id, downstream_id in coordination_pairs:
            upstream_ct = device_to_ct.get(upstream_id, {}).get('ct_ratio')
            downstream_ct = device_to_ct.get(downstream_id, {}).get('ct_ratio')
            
            if upstream_ct is None or downstream_ct is None:
                continue
            
            if upstream_ct != downstream_ct:
                diff_percent = abs(upstream_ct - downstream_ct) / min(upstream_ct, downstream_ct)
                
                severity = 'low'
                if diff_percent > self.warn_ratio_diff:
                    severity = 'medium'
                    if diff_percent > 0.5:
                        severity = 'high'
                
                issue = Issue(
                    issue_id=f"CT_INCONSISTENCY_{upstream_id}_{downstream_id}",
                    rule_name=self.rule_name,
                    severity=severity,
                    category=self.category,
                    description=f"上下级保护CT变比不一致: {upstream_id}({upstream_ct}) vs {downstream_id}({downstream_ct})",
                    affected_devices=[upstream_id, downstream_id],
                    details={
                        'upstream_device': upstream_id,
                        'upstream_ct_ratio': upstream_ct,
                        'downstream_device': downstream_id,
                        'downstream_ct_ratio': downstream_ct,
                        'difference_percent': diff_percent
                    },
                    recommendation="建议核对CT变比配置，确保配合关系正确。如确需使用不同变比，需验证灵敏度配合。"
                )
                issues.append(issue)
        
        return issues
    
    def _get_coordination_pairs(self, results: Dict[str, Any]) -> List[tuple]:
        """获取配合对"""
        pairs = set()
        
        fault_analyses = results.get('fault_analyses', {})
        for fault_id, analysis in fault_analyses.items():
            if hasattr(analysis, 'coordination_checks'):
                for check in analysis.coordination_checks:
                    pairs.add((check.upstream_device, check.downstream_device))
        
        return list(pairs)


class TimeMarginRule(BaseRule):
    """时间级差不足规则"""
    
    rule_name = "时间级差不足"
    category = "配合问题"
    description = "检查上下级保护的时间级差是否满足要求"
    
    def __init__(self, required_margin: float = 0.3, warn_margin: float = 0.5):
        self.required_margin = required_margin
        self.warn_margin = warn_margin
    
    def evaluate(self, coordination_results: Dict[str, Any], 
                 input_data: Dict[str, Any]) -> List[Issue]:
        issues = []
        
        fault_analyses = coordination_results.get('fault_analyses', {})
        
        for fault_id, analysis in fault_analyses.items():
            if not hasattr(analysis, 'coordination_checks'):
                continue
            
            for check in analysis.coordination_checks:
                if check.time_margin < self.required_margin:
                    severity = 'high'
                    if check.time_margin <= 0:
                        severity = 'critical'
                    
                    issue = Issue(
                        issue_id=f"TIME_MARGIN_{fault_id}_{check.upstream_device}_{check.downstream_device}",
                        rule_name=self.rule_name,
                        severity=severity,
                        category=self.category,
                        description=f"故障位置{analysis.fault_location}({analysis.fault_type})下，"
                                   f"{check.upstream_device}与{check.downstream_device}时间级差不足: "
                                   f"{check.time_margin:.3f}s(要求≥{self.required_margin}s)",
                        affected_devices=[check.upstream_device, check.downstream_device],
                        fault_location=analysis.fault_location,
                        fault_type=analysis.fault_type,
                        details={
                            'fault_id': fault_id,
                            'upstream_device': check.upstream_device,
                            'upstream_time': check.upstream_operating_time,
                            'upstream_stage': check.upstream_stage,
                            'downstream_device': check.downstream_device,
                            'downstream_time': check.downstream_operating_time,
                            'downstream_stage': check.downstream_stage,
                            'time_margin': check.time_margin,
                            'required_margin': self.required_margin
                        },
                        recommendation=f"建议调整保护定值，确保时间级差≥{self.required_margin}s。"
                                      f"可考虑增加上级保护动作时间或降低下级保护动作时间。"
                    )
                    issues.append(issue)
                elif check.time_margin < self.warn_margin:
                    issue = Issue(
                        issue_id=f"TIME_MARGIN_WARN_{fault_id}_{check.upstream_device}_{check.downstream_device}",
                        rule_name="时间级差偏小",
                        severity='low',
                        category=self.category,
                        description=f"故障位置{analysis.fault_location}({analysis.fault_type})下，"
                                   f"{check.upstream_device}与{check.downstream_device}时间级差偏小: "
                                   f"{check.time_margin:.3f}s",
                        affected_devices=[check.upstream_device, check.downstream_device],
                        fault_location=analysis.fault_location,
                        fault_type=analysis.fault_type,
                        details={
                            'fault_id': fault_id,
                            'time_margin': check.time_margin,
                            'warn_margin': self.warn_margin
                        },
                        recommendation="时间级差接近阈值，建议关注运行情况，必要时进行调整。"
                    )
                    issues.append(issue)
        
        return issues


class EndFaultRule(BaseRule):
    """末端故障拒动规则"""
    
    rule_name = "末端故障拒动风险"
    category = "灵敏度问题"
    description = "检查末端保护在故障时是否能可靠动作"
    
    def __init__(self, min_sensitivity: float = 1.5):
        self.min_sensitivity = min_sensitivity
    
    def evaluate(self, coordination_results: Dict[str, Any], 
                 input_data: Dict[str, Any]) -> List[Issue]:
        issues = []
        
        fault_analyses = coordination_results.get('fault_analyses', {})
        
        for fault_id, analysis in fault_analyses.items():
            if not hasattr(analysis, 'protection_actions'):
                continue
            
            actions_by_device = {}
            for action in analysis.protection_actions:
                if action.device_id not in actions_by_device:
                    actions_by_device[action.device_id] = []
                actions_by_device[action.device_id].append(action)
            
            for device_id, actions in actions_by_device.items():
                if not actions:
                    continue
                
                is_end_device = self._is_end_device(device_id, coordination_results)
                
                has_operation = any(a.is_operated for a in actions)
                
                if not has_operation:
                    severity = 'high' if is_end_device else 'medium'
                    
                    min_pickup = min(a.pickup_current for a in actions)
                    
                    issue = Issue(
                        issue_id=f"FAULT_MISS_{fault_id}_{device_id}",
                        rule_name="保护拒动风险",
                        severity=severity,
                        category="动作可靠性",
                        description=f"故障位置{analysis.fault_location}({analysis.fault_type})下，"
                                   f"{device_id}保护未检测到故障电流{analysis.fault_current}A，"
                                   f"最小动作电流{min_pickup}A",
                        affected_devices=[device_id],
                        fault_location=analysis.fault_location,
                        fault_type=analysis.fault_type,
                        details={
                            'fault_id': fault_id,
                            'device_id': device_id,
                            'fault_current': analysis.fault_current,
                            'min_pickup_current': min_pickup,
                            'is_end_device': is_end_device
                        },
                        recommendation="建议降低保护动作电流整定值，确保故障时能可靠动作。"
                    )
                    issues.append(issue)
                else:
                    for action in actions:
                        if action.is_operated and action.sensitivity:
                            if action.sensitivity < self.min_sensitivity:
                                severity = 'medium'
                                if action.sensitivity < 1.2:
                                    severity = 'high'
                                
                                issue = Issue(
                                    issue_id=f"SENSITIVITY_{fault_id}_{device_id}_STAGE{action.stage}",
                                    rule_name="灵敏度不足",
                                    severity=severity,
                                    category=self.category,
                                    description=f"故障位置{analysis.fault_location}({analysis.fault_type})下，"
                                               f"{device_id}第{action.stage}段保护灵敏度不足: "
                                               f"{action.sensitivity:.2f}(要求≥{self.min_sensitivity})",
                                    affected_devices=[device_id],
                                    fault_location=analysis.fault_location,
                                    fault_type=analysis.fault_type,
                                    details={
                                        'fault_id': fault_id,
                                        'device_id': device_id,
                                        'stage': action.stage,
                                        'sensitivity': action.sensitivity,
                                        'fault_current': analysis.fault_current,
                                        'pickup_current': action.pickup_current,
                                        'required_sensitivity': self.min_sensitivity
                                    },
                                    recommendation=f"建议降低保护动作电流整定值，"
                                                  f"确保灵敏度≥{self.min_sensitivity}。"
                                )
                                issues.append(issue)
        
        return issues
    
    def _is_end_device(self, device_id: str, results: Dict[str, Any]) -> bool:
        """判断是否为末端保护"""
        summary = results.get('coordination_summary', {})
        
        if 'end_devices' in summary:
            return device_id in summary['end_devices']
        
        return False


class SelectivityRule(BaseRule):
    """选择性规则 - 检查是否存在越级跳闸风险"""
    
    rule_name = "越级跳闸风险"
    category = "选择性问题"
    description = "检查是否存在上级保护先于下级保护动作的情况"
    
    def __init__(self, margin_threshold: float = 0.0):
        self.margin_threshold = margin_threshold
    
    def evaluate(self, coordination_results: Dict[str, Any], 
                 input_data: Dict[str, Any]) -> List[Issue]:
        issues = []
        
        fault_analyses = coordination_results.get('fault_analyses', {})
        
        for fault_id, analysis in fault_analyses.items():
            if not hasattr(analysis, 'coordination_checks'):
                continue
            
            for check in analysis.coordination_checks:
                if check.time_margin <= self.margin_threshold:
                    issue = Issue(
                        issue_id=f"SELECTIVITY_{fault_id}_{check.upstream_device}_{check.downstream_device}",
                        rule_name=self.rule_name,
                        severity='critical',
                        category=self.category,
                        description=f"故障位置{analysis.fault_location}({analysis.fault_type})下，"
                                   f"存在越级跳闸风险: {check.upstream_device}动作时间{check.upstream_operating_time:.3f}s "
                                   f"≤ {check.downstream_device}动作时间{check.downstream_operating_time:.3f}s",
                        affected_devices=[check.upstream_device, check.downstream_device],
                        fault_location=analysis.fault_location,
                        fault_type=analysis.fault_type,
                        details={
                            'fault_id': fault_id,
                            'upstream_device': check.upstream_device,
                            'upstream_time': check.upstream_operating_time,
                            'downstream_device': check.downstream_device,
                            'downstream_time': check.downstream_operating_time,
                            'time_margin': check.time_margin
                        },
                        recommendation="存在严重选择性问题！必须立即调整保护定值，"
                                      "确保上级保护动作时间大于下级保护。"
                    )
                    issues.append(issue)
        
        return issues


class SettingMissingRule(BaseRule):
    """定值缺失规则"""
    
    rule_name = "定值缺失"
    category = "配置问题"
    description = "检查保护定值是否完整"
    
    def evaluate(self, coordination_results: Dict[str, Any], 
                 input_data: Dict[str, Any]) -> List[Issue]:
        issues = []
        
        settings = input_data.get('settings', [])
        devices = input_data.get('devices', [])
        
        device_ids_in_settings = {s.get('device_id', '') for s in settings if s.get('device_id')}
        device_ids_in_devices = {d.get('device_id', '') for d in devices if d.get('device_id')}
        
        all_device_ids = device_ids_in_settings.union(device_ids_in_devices)
        
        for device_id in all_device_ids:
            if not device_id:
                continue
            
            setting = next((s for s in settings if s.get('device_id') == device_id), None)
            
            if not setting:
                issue = Issue(
                    issue_id=f"SETTING_MISSING_{device_id}",
                    rule_name="保护定值缺失",
                    severity='high',
                    category=self.category,
                    description=f"设备{device_id}缺少保护定值配置",
                    affected_devices=[device_id],
                    details={'device_id': device_id},
                    recommendation="请补充该设备的保护定值配置。"
                )
                issues.append(issue)
                continue
            
            phase_oc1 = setting.get('phase_oc1_current')
            if phase_oc1 is None or phase_oc1 <= 0:
                issue = Issue(
                    issue_id=f"PHASE_OC1_MISSING_{device_id}",
                    rule_name="相间过流I段定值缺失",
                    severity='medium',
                    category=self.category,
                    description=f"设备{device_id}缺少相间过流I段动作电流定值",
                    affected_devices=[device_id],
                    details={'device_id': device_id, 'setting_type': 'phase_oc1_current'},
                    recommendation="请补充相间过流I段动作电流定值。"
                )
                issues.append(issue)
            
            phase_oc2 = setting.get('phase_oc2_current')
            phase_oc2_time = setting.get('phase_oc2_time')
            if phase_oc2 is None or phase_oc2 <= 0 or phase_oc2_time is None or phase_oc2_time < 0:
                issue = Issue(
                    issue_id=f"PHASE_OC2_MISSING_{device_id}",
                    rule_name="相间过流II段定值缺失",
                    severity='medium',
                    category=self.category,
                    description=f"设备{device_id}缺少相间过流II段完整定值",
                    affected_devices=[device_id],
                    details={'device_id': device_id, 'setting_type': 'phase_oc2'},
                    recommendation="请补充相间过流II段动作电流和时间定值。"
                )
                issues.append(issue)
        
        return issues


class RuleEngine:
    """规则引擎"""
    
    def __init__(self, rules: Optional[List[BaseRule]] = None):
        self._rules = rules or []
        self._default_rules = [
            CTInconsistencyRule(),
            TimeMarginRule(),
            EndFaultRule(),
            SelectivityRule(),
            SettingMissingRule()
        ]
    
    def add_rule(self, rule: BaseRule):
        """添加规则"""
        self._rules.append(rule)
    
    def evaluate_all(self, coordination_results: Dict[str, Any], 
                    input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """执行所有规则评估"""
        all_issues = []
        
        rules_to_run = self._rules if self._rules else self._default_rules
        
        for rule in rules_to_run:
            issues = rule.evaluate(coordination_results, input_data)
            all_issues.extend(issues)
        
        all_issues.sort(key=lambda x: {
            'critical': 0,
            'high': 1,
            'medium': 2,
            'low': 3
        }.get(x.severity, 4))
        
        return [self._issue_to_dict(issue) for issue in all_issues]
    
    def _issue_to_dict(self, issue: Issue) -> Dict[str, Any]:
        """将Issue转换为字典"""
        return {
            'issue_id': issue.issue_id,
            'rule_name': issue.rule_name,
            'severity': issue.severity,
            'category': issue.category,
            'description': issue.description,
            'affected_devices': issue.affected_devices,
            'fault_location': issue.fault_location,
            'fault_type': issue.fault_type,
            'details': issue.details or {},
            'recommendation': issue.recommendation
        }
    
    def evaluate_by_category(self, coordination_results: Dict[str, Any],
                            input_data: Dict[str, Any], category: str) -> List[Dict[str, Any]]:
        """按类别评估规则"""
        all_issues = self.evaluate_all(coordination_results, input_data)
        return [issue for issue in all_issues if issue.get('category') == category]
    
    def evaluate_by_severity(self, coordination_results: Dict[str, Any],
                             input_data: Dict[str, Any], severity: str) -> List[Dict[str, Any]]:
        """按严重程度评估规则"""
        all_issues = self.evaluate_all(coordination_results, input_data)
        return [issue for issue in all_issues if issue.get('severity') == severity]
