import math
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

from .topology import Topology


@dataclass
class ProtectionSetting:
    """保护定值"""
    device_id: str
    phase_oc1_current: Optional[float] = None
    phase_oc1_time: Optional[float] = None
    phase_oc2_current: Optional[float] = None
    phase_oc2_time: Optional[float] = None
    phase_oc3_current: Optional[float] = None
    phase_oc3_time: Optional[float] = None
    ground_oc1_current: Optional[float] = None
    ground_oc1_time: Optional[float] = None
    ground_oc2_current: Optional[float] = None
    ground_oc2_time: Optional[float] = None
    ct_ratio: float = 1.0
    inverse_time_curve: str = 'SI'
    inverse_time_alpha: float = 0.14
    inverse_time_p: float = 0.02


@dataclass
class FaultCase:
    """故障案例"""
    fault_id: str
    fault_location: str
    fault_type: str
    phase_fault_current: float
    ground_fault_current: Optional[float] = None
    fault_impedance: float = 0.0
    fault_resistance: float = 0.0


@dataclass
class DeviceInfo:
    """设备信息"""
    device_id: str
    ct_ratio_primary: Optional[float] = None
    ct_ratio_secondary: float = 5.0


@dataclass
class ProtectionAction:
    """保护动作情况"""
    device_id: str
    stage: int
    pickup_current: float
    operating_time: float
    is_operated: bool
    sensitivity: Optional[float] = None
    fault_current_seen: float = 0.0


@dataclass
class CoordinationCheck:
    """配合检查结果"""
    upstream_device: str
    downstream_device: str
    fault_location: str
    fault_type: str
    
    upstream_stage: int
    downstream_stage: int
    
    upstream_operating_time: float
    downstream_operating_time: float
    time_margin: float
    
    upstream_sensitivity: Optional[float]
    downstream_sensitivity: Optional[float]
    
    is_coordinated: bool


@dataclass
class FaultAnalysis:
    """故障分析结果"""
    fault_id: str
    fault_location: str
    fault_type: str
    fault_current: float
    
    protection_actions: List[ProtectionAction] = field(default_factory=list)
    coordination_checks: List[CoordinationCheck] = field(default_factory=list)
    
    issues: List[Dict[str, Any]] = field(default_factory=list)


class InverseTimeCurve:
    """反时限特性曲线"""
    
    CURVE_TYPES = {
        'SI': {'alpha': 0.14, 'p': 0.02},
        'VI': {'alpha': 13.5, 'p': 1.0},
        'EI': {'alpha': 80.0, 'p': 2.0},
        'IEC_SI': {'alpha': 0.14, 'p': 0.02},
        'IEC_VI': {'alpha': 13.5, 'p': 1.0},
        'IEC_EI': {'alpha': 80.0, 'p': 2.0},
    }
    
    @staticmethod
    def calculate_time(pickup_current: float, fault_current: float,
                        time_dial: float, curve_type: str = 'SI',
                        alpha: Optional[float] = None, p: Optional[float] = None) -> float:
        """
        计算反时限动作时间
        
        公式: t = alpha / ((I/Ip)^p - 1) * time_dial
        """
        if fault_current <= pickup_current:
            return float('inf')
        
        if alpha is None or p is None:
            if curve_type in InverseTimeCurve.CURVE_TYPES:
                params = InverseTimeCurve.CURVE_TYPES[curve_type]
                alpha = params['alpha']
                p = params['p']
            else:
                alpha = 0.14
                p = 0.02
        
        current_ratio = fault_current / pickup_current
        
        if current_ratio <= 1.0:
            return float('inf')
        
        denominator = math.pow(current_ratio, p) - 1.0
        if denominator <= 0:
            return float('inf')
        
        operating_time = (alpha / denominator) * time_dial
        
        return max(operating_time, 0.0)
    
    @staticmethod
    def get_curve_points(pickup_current: float, time_dial: float,
                         curve_type: str = 'SI',
                         alpha: Optional[float] = None, p: Optional[float] = None,
                         current_range: Tuple[float, float] = (1.1, 20.0),
                         points: int = 100) -> List[Tuple[float, float]]:
        """获取曲线上的点"""
        curve_points = []
        
        for i in range(points):
            current_ratio = current_range[0] + (current_range[1] - current_range[0]) * i / (points - 1)
            fault_current = pickup_current * current_ratio
            
            time = InverseTimeCurve.calculate_time(
                pickup_current=pickup_current,
                fault_current=fault_current,
                time_dial=time_dial,
                curve_type=curve_type,
                alpha=alpha,
                p=p
            )
            
            if time != float('inf'):
                curve_points.append((fault_current, time))
        
        return curve_points


class CoordinationCalculator:
    """保护配合计算器"""
    
    def __init__(self, topology: Topology, input_data: Dict[str, Any]):
        self.topology = topology
        self.input_data = input_data
        
        self._settings: Dict[str, ProtectionSetting] = {}
        self._devices: Dict[str, DeviceInfo] = {}
        self._fault_cases: List[FaultCase] = []
        
        self._load_settings()
        self._load_devices()
        self._load_fault_cases()
    
    def _load_settings(self):
        """加载保护定值"""
        settings_data = self.input_data.get('settings', [])
        
        for setting_data in settings_data:
            device_id = setting_data.get('device_id', '')
            if not device_id:
                continue
            
            setting = ProtectionSetting(
                device_id=device_id,
                phase_oc1_current=setting_data.get('phase_oc1_current'),
                phase_oc1_time=setting_data.get('phase_oc1_time'),
                phase_oc2_current=setting_data.get('phase_oc2_current'),
                phase_oc2_time=setting_data.get('phase_oc2_time'),
                phase_oc3_current=setting_data.get('phase_oc3_current'),
                phase_oc3_time=setting_data.get('phase_oc3_time'),
                ground_oc1_current=setting_data.get('ground_oc1_current'),
                ground_oc1_time=setting_data.get('ground_oc1_time'),
                ground_oc2_current=setting_data.get('ground_oc2_current'),
                ground_oc2_time=setting_data.get('ground_oc2_time'),
                ct_ratio=setting_data.get('ct_ratio', 1.0) or 1.0,
                inverse_time_curve=setting_data.get('inverse_time_curve', 'SI'),
                inverse_time_alpha=setting_data.get('inverse_time_alpha', 0.14) or 0.14,
                inverse_time_p=setting_data.get('inverse_time_p', 0.02) or 0.02
            )
            
            self._settings[device_id] = setting
    
    def _load_devices(self):
        """加载设备信息"""
        devices_data = self.input_data.get('devices', [])
        
        for device_data in devices_data:
            device_id = device_data.get('device_id', '')
            if not device_id:
                continue
            
            device = DeviceInfo(
                device_id=device_id,
                ct_ratio_primary=device_data.get('ct_ratio_primary'),
                ct_ratio_secondary=device_data.get('ct_ratio_secondary', 5.0) or 5.0
            )
            
            self._devices[device_id] = device
    
    def _load_fault_cases(self):
        """加载故障案例"""
        fault_data = self.input_data.get('fault_cases', [])
        
        for case_data in fault_data:
            fault_id = case_data.get('fault_id', '')
            if not fault_id:
                continue
            
            fault_case = FaultCase(
                fault_id=fault_id,
                fault_location=case_data.get('fault_location', ''),
                fault_type=case_data.get('fault_type', 'phase'),
                phase_fault_current=case_data.get('phase_fault_current', 0.0) or 0.0,
                ground_fault_current=case_data.get('ground_fault_current'),
                fault_impedance=case_data.get('fault_impedance', 0.0) or 0.0,
                fault_resistance=case_data.get('fault_resistance', 0.0) or 0.0
            )
            
            self._fault_cases.append(fault_case)
    
    def calculate_all(self) -> Dict[str, Any]:
        """计算所有故障案例的配合情况"""
        results = {}
        
        for fault_case in self._fault_cases:
            analysis = self._analyze_fault_case(fault_case)
            results[fault_case.fault_id] = analysis
        
        return {
            'fault_analyses': results,
            'coordination_summary': self._generate_summary(results),
            'protection_settings': self._settings,
            'device_info': self._devices
        }
    
    def _analyze_fault_case(self, fault_case: FaultCase) -> FaultAnalysis:
        """分析单个故障案例"""
        analysis = FaultAnalysis(
            fault_id=fault_case.fault_id,
            fault_location=fault_case.fault_location,
            fault_type=fault_case.fault_type,
            fault_current=fault_case.phase_fault_current if fault_case.fault_type == 'phase' 
                         else (fault_case.ground_fault_current or 0.0)
        )
        
        protections_on_path = self._get_protections_for_fault(fault_case)
        
        for device_id in protections_on_path:
            actions = self._calculate_protection_actions(device_id, fault_case)
            analysis.protection_actions.extend(actions)
        
        coordination_pairs = self._get_coordination_pairs_for_fault(fault_case, protections_on_path)
        
        for upstream, downstream in coordination_pairs:
            check = self._check_coordination(upstream, downstream, fault_case)
            if check:
                analysis.coordination_checks.append(check)
        
        return analysis
    
    def _get_protections_for_fault(self, fault_case: FaultCase) -> List[str]:
        """获取故障点上游的所有保护装置"""
        fault_location = fault_case.fault_location
        
        if self.topology.root_node is None:
            return []
        
        path = self.topology.get_path_from_root(fault_location)
        
        protections = self.topology.get_protections_on_path(path)
        
        return protections
    
    def _calculate_protection_actions(self, device_id: str, fault_case: FaultCase) -> List[ProtectionAction]:
        """计算保护装置的动作情况"""
        actions = []
        
        if device_id not in self._settings:
            return actions
        
        setting = self._settings[device_id]
        
        if fault_case.fault_type == 'phase':
            fault_current = fault_case.phase_fault_current
            
            if setting.phase_oc3_current and setting.phase_oc3_time:
                stage3_action = self._check_stage(
                    device_id=device_id,
                    stage=3,
                    pickup_current=setting.phase_oc3_current,
                    time_setting=setting.phase_oc3_time,
                    fault_current=fault_current,
                    is_inverse=False,
                    setting=setting
                )
                if stage3_action:
                    actions.append(stage3_action)
            
            if setting.phase_oc2_current and setting.phase_oc2_time:
                stage2_action = self._check_stage(
                    device_id=device_id,
                    stage=2,
                    pickup_current=setting.phase_oc2_current,
                    time_setting=setting.phase_oc2_time,
                    fault_current=fault_current,
                    is_inverse=False,
                    setting=setting
                )
                if stage2_action:
                    actions.append(stage2_action)
            
            if setting.phase_oc1_current:
                stage1_action = self._check_stage(
                    device_id=device_id,
                    stage=1,
                    pickup_current=setting.phase_oc1_current,
                    time_setting=setting.phase_oc1_time or 1.0,
                    fault_current=fault_current,
                    is_inverse=True,
                    setting=setting
                )
                if stage1_action:
                    actions.append(stage1_action)
        
        elif fault_case.fault_type == 'ground':
            fault_current = fault_case.ground_fault_current or 0.0
            
            if setting.ground_oc2_current and setting.ground_oc2_time:
                stage2_action = self._check_stage(
                    device_id=device_id,
                    stage=2,
                    pickup_current=setting.ground_oc2_current,
                    time_setting=setting.ground_oc2_time,
                    fault_current=fault_current,
                    is_inverse=False,
                    setting=setting
                )
                if stage2_action:
                    actions.append(stage2_action)
            
            if setting.ground_oc1_current:
                stage1_action = self._check_stage(
                    device_id=device_id,
                    stage=1,
                    pickup_current=setting.ground_oc1_current,
                    time_setting=setting.ground_oc1_time or 1.0,
                    fault_current=fault_current,
                    is_inverse=True,
                    setting=setting
                )
                if stage1_action:
                    actions.append(stage1_action)
        
        return actions
    
    def _check_stage(self, device_id: str, stage: int, pickup_current: float,
                     time_setting: float, fault_current: float,
                     is_inverse: bool, setting: ProtectionSetting) -> Optional[ProtectionAction]:
        """检查某一段保护是否动作"""
        if pickup_current is None:
            return None
        
        pickup_current_primary = pickup_current * setting.ct_ratio
        
        is_operated = fault_current >= pickup_current_primary
        
        if is_inverse and is_operated:
            operating_time = InverseTimeCurve.calculate_time(
                pickup_current=pickup_current_primary,
                fault_current=fault_current,
                time_dial=time_setting,
                curve_type=setting.inverse_time_curve,
                alpha=setting.inverse_time_alpha,
                p=setting.inverse_time_p
            )
        else:
            operating_time = time_setting if is_operated else float('inf')
        
        sensitivity = None
        if pickup_current_primary > 0:
            sensitivity = fault_current / pickup_current_primary
        
        return ProtectionAction(
            device_id=device_id,
            stage=stage,
            pickup_current=pickup_current_primary,
            operating_time=operating_time,
            is_operated=is_operated,
            sensitivity=sensitivity,
            fault_current_seen=fault_current
        )
    
    def _get_coordination_pairs_for_fault(self, fault_case: FaultCase,
                                           protections: List[str]) -> List[Tuple[str, str]]:
        """获取故障情况下的配合对"""
        pairs = []
        
        if len(protections) < 2:
            return pairs
        
        for i in range(len(protections) - 1):
            upstream = protections[i]
            downstream = protections[i + 1]
            pairs.append((upstream, downstream))
        
        return pairs
    
    def _check_coordination(self, upstream_id: str, downstream_id: str,
                           fault_case: FaultCase) -> Optional[CoordinationCheck]:
        """检查上下级保护配合"""
        if upstream_id not in self._settings or downstream_id not in self._settings:
            return None
        
        upstream_setting = self._settings[upstream_id]
        downstream_setting = self._settings[downstream_id]
        
        if fault_case.fault_type == 'phase':
            fault_current = fault_case.phase_fault_current
            
            upstream_stage, upstream_time, upstream_sensitivity = self._get_operating_info(
                upstream_setting, fault_current, 'phase'
            )
            downstream_stage, downstream_time, downstream_sensitivity = self._get_operating_info(
                downstream_setting, fault_current, 'phase'
            )
        else:
            fault_current = fault_case.ground_fault_current or 0.0
            
            upstream_stage, upstream_time, upstream_sensitivity = self._get_operating_info(
                upstream_setting, fault_current, 'ground'
            )
            downstream_stage, downstream_time, downstream_sensitivity = self._get_operating_info(
                downstream_setting, fault_current, 'ground'
            )
        
        if upstream_time == float('inf') or downstream_time == float('inf'):
            return None
        
        time_margin = upstream_time - downstream_time
        is_coordinated = time_margin >= 0.3
        
        return CoordinationCheck(
            upstream_device=upstream_id,
            downstream_device=downstream_id,
            fault_location=fault_case.fault_location,
            fault_type=fault_case.fault_type,
            upstream_stage=upstream_stage,
            downstream_stage=downstream_stage,
            upstream_operating_time=upstream_time,
            downstream_operating_time=downstream_time,
            time_margin=time_margin,
            upstream_sensitivity=upstream_sensitivity,
            downstream_sensitivity=downstream_sensitivity,
            is_coordinated=is_coordinated
        )
    
    def _get_operating_info(self, setting: ProtectionSetting, fault_current: float,
                            fault_type: str) -> Tuple[int, float, Optional[float]]:
        """获取保护动作信息"""
        if fault_type == 'phase':
            if setting.phase_oc3_current and setting.phase_oc3_time:
                pickup_3 = setting.phase_oc3_current * setting.ct_ratio
                if fault_current >= pickup_3:
                    sensitivity = fault_current / pickup_3 if pickup_3 > 0 else None
                    return (3, setting.phase_oc3_time, sensitivity)
            
            if setting.phase_oc2_current and setting.phase_oc2_time:
                pickup_2 = setting.phase_oc2_current * setting.ct_ratio
                if fault_current >= pickup_2:
                    sensitivity = fault_current / pickup_2 if pickup_2 > 0 else None
                    return (2, setting.phase_oc2_time, sensitivity)
            
            if setting.phase_oc1_current:
                pickup_1 = setting.phase_oc1_current * setting.ct_ratio
                if fault_current >= pickup_1:
                    sensitivity = fault_current / pickup_1 if pickup_1 > 0 else None
                    time = InverseTimeCurve.calculate_time(
                        pickup_current=pickup_1,
                        fault_current=fault_current,
                        time_dial=setting.phase_oc1_time or 1.0,
                        curve_type=setting.inverse_time_curve,
                        alpha=setting.inverse_time_alpha,
                        p=setting.inverse_time_p
                    )
                    return (1, time, sensitivity)
        else:
            if setting.ground_oc2_current and setting.ground_oc2_time:
                pickup_2 = setting.ground_oc2_current * setting.ct_ratio
                if fault_current >= pickup_2:
                    sensitivity = fault_current / pickup_2 if pickup_2 > 0 else None
                    return (2, setting.ground_oc2_time, sensitivity)
            
            if setting.ground_oc1_current:
                pickup_1 = setting.ground_oc1_current * setting.ct_ratio
                if fault_current >= pickup_1:
                    sensitivity = fault_current / pickup_1 if pickup_1 > 0 else None
                    time = InverseTimeCurve.calculate_time(
                        pickup_current=pickup_1,
                        fault_current=fault_current,
                        time_dial=setting.ground_oc1_time or 1.0,
                        curve_type=setting.inverse_time_curve,
                        alpha=setting.inverse_time_alpha,
                        p=setting.inverse_time_p
                    )
                    return (1, time, sensitivity)
        
        return (0, float('inf'), None)
    
    def _generate_summary(self, results: Dict[str, FaultAnalysis]) -> Dict[str, Any]:
        """生成配合摘要"""
        total_checks = 0
        coordinated_checks = 0
        time_margins = []
        
        for fault_id, analysis in results.items():
            for check in analysis.coordination_checks:
                total_checks += 1
                if check.is_coordinated:
                    coordinated_checks += 1
                time_margins.append(check.time_margin)
        
        return {
            'total_coordination_checks': total_checks,
            'coordinated_checks': coordinated_checks,
            'uncoordinated_checks': total_checks - coordinated_checks,
            'coordination_rate': coordinated_checks / total_checks if total_checks > 0 else 0.0,
            'min_time_margin': min(time_margins) if time_margins else None,
            'max_time_margin': max(time_margins) if time_margins else None,
            'avg_time_margin': sum(time_margins) / len(time_margins) if time_margins else None
        }
    
    def get_setting(self, device_id: str) -> Optional[ProtectionSetting]:
        """获取保护定值"""
        return self._settings.get(device_id)
    
    def get_device(self, device_id: str) -> Optional[DeviceInfo]:
        """获取设备信息"""
        return self._devices.get(device_id)
