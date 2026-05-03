from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class ProtectionStatus(Enum):
    COMPLIANT = "符合定值"
    NON_COMPLIANT = "不符合定值"
    NO_SETTING = "无对应定值"
    INSUFFICIENT_DATA = "数据不足"
    UNCERTAIN = "无法判断"


@dataclass
class EvaluationResult:
    event_id: str
    device_name: str
    protection_type: str
    action_value: float
    setting_value: float
    setting_unit: str
    status: ProtectionStatus
    details: str = ""
    setting_name: str = ""
    tolerance: float = 0.05


class ProtectionEvaluator:
    """
    保护动作评估器
    判断过流/接地/母联联跳是否符合定值
    """
    
    def __init__(self, tolerance: float = 0.05):
        """
        :param tolerance: 定值允许的误差百分比（默认5%）
        """
        self.tolerance = tolerance
        self.results: List[EvaluationResult] = []
    
    def evaluate_overcurrent(self, 
                            action_value: float,
                            setting_value: float,
                            event: Dict[str, Any] = None) -> EvaluationResult:
        """
        评估过流保护动作
        过流保护：动作值 > 定值时应该动作
        """
        if setting_value <= 0:
            return EvaluationResult(
                event_id=event.get('id', 'unknown') if event else 'unknown',
                device_name=event.get('device_name', '') if event else '',
                protection_type='过流保护',
                action_value=action_value,
                setting_value=setting_value,
                setting_unit='A',
                status=ProtectionStatus.NO_SETTING,
                details='定值为0或无效',
            )
        
        min_trigger_value = setting_value * (1 - self.tolerance)
        
        if action_value >= min_trigger_value:
            status = ProtectionStatus.COMPLIANT
            details = f"动作值 {action_value}A >= 定值 {setting_value}A (允许误差 {self.tolerance*100}%)"
        else:
            status = ProtectionStatus.NON_COMPLIANT
            details = f"动作值 {action_value}A < 定值 {setting_value}A，不应动作"
        
        return EvaluationResult(
            event_id=event.get('id', 'unknown') if event else 'unknown',
            device_name=event.get('device_name', '') if event else '',
            protection_type='过流保护',
            action_value=action_value,
            setting_value=setting_value,
            setting_unit='A',
            status=status,
            details=details,
            setting_name='过流定值',
            tolerance=self.tolerance,
        )
    
    def evaluate_ground_fault(self,
                              action_value: float,
                              setting_value: float,
                              event: Dict[str, Any] = None) -> EvaluationResult:
        """
        评估接地保护动作
        """
        if setting_value <= 0:
            return EvaluationResult(
                event_id=event.get('id', 'unknown') if event else 'unknown',
                device_name=event.get('device_name', '') if event else '',
                protection_type='接地保护',
                action_value=action_value,
                setting_value=setting_value,
                setting_unit='A',
                status=ProtectionStatus.NO_SETTING,
                details='定值为0或无效',
            )
        
        min_trigger_value = setting_value * (1 - self.tolerance)
        
        if action_value >= min_trigger_value:
            status = ProtectionStatus.COMPLIANT
            details = f"动作值 {action_value}A >= 接地定值 {setting_value}A (允许误差 {self.tolerance*100}%)"
        else:
            status = ProtectionStatus.NON_COMPLIANT
            details = f"动作值 {action_value}A < 接地定值 {setting_value}A，不应动作"
        
        return EvaluationResult(
            event_id=event.get('id', 'unknown') if event else 'unknown',
            device_name=event.get('device_name', '') if event else '',
            protection_type='接地保护',
            action_value=action_value,
            setting_value=setting_value,
            setting_unit='A',
            status=status,
            details=details,
            setting_name='接地定值',
            tolerance=self.tolerance,
        )
    
    def evaluate_bus_tie_trip(self,
                              triggering_event: Dict[str, Any],
                              bus_tie_event: Dict[str, Any],
                              settings_data: Dict[str, Any],
                              inventory_data: Dict[str, Any]) -> EvaluationResult:
        """
        评估母联联跳动作
        检查母联联跳是否符合逻辑
        """
        triggering_device = triggering_event.get('device_name', '')
        bus_tie_device = bus_tie_event.get('device_name', '')
        
        related_devices = self._find_related_devices(
            triggering_device, inventory_data, settings_data
        )
        
        is_valid_trip = bus_tie_device in related_devices or self._is_bus_tie_relation(
            triggering_device, bus_tie_device, settings_data
        )
        
        triggering_value = triggering_event.get('action_value', 0)
        bus_tie_value = bus_tie_event.get('action_value', 0)
        
        if is_valid_trip:
            status = ProtectionStatus.COMPLIANT
            details = f"母联联跳符合逻辑: {triggering_device} 触发 {bus_tie_device}"
        else:
            status = ProtectionStatus.UNCERTAIN
            details = f"无法确认母联联跳逻辑: {triggering_device} -> {bus_tie_device}"
        
        return EvaluationResult(
            event_id=bus_tie_event.get('id', 'unknown'),
            device_name=bus_tie_device,
            protection_type='母联联跳',
            action_value=bus_tie_value,
            setting_value=0,
            setting_unit='',
            status=status,
            details=details,
            setting_name='母联联跳逻辑',
            tolerance=self.tolerance,
        )
    
    def _find_related_devices(self, 
                              device_name: str,
                              inventory_data: Dict[str, Any],
                              settings_data: Dict[str, Any]) -> List[str]:
        """
        查找与设备相关的其他设备（如母联开关）
        """
        related = []
        
        devices_by_name = inventory_data.get('devices_by_name', {})
        device = devices_by_name.get(device_name)
        
        if device:
            for bus in device.get('related_buses', []):
                for other_dev_name, other_dev in devices_by_name.items():
                    if other_dev_name == device_name:
                        continue
                    if bus in other_dev.get('related_buses', []):
                        if '母联' in other_dev_name or 'bus' in other_dev_name.lower():
                            related.append(other_dev_name)
        
        return related
    
    def _is_bus_tie_relation(self,
                             triggering_device: str,
                             bus_tie_device: str,
                             settings_data: Dict[str, Any]) -> bool:
        """
        检查两个设备之间是否存在母联联跳关系
        """
        triggering_lower = triggering_device.lower()
        bus_tie_lower = bus_tie_device.lower()
        
        if '母联' in bus_tie_lower or 'bus-tie' in bus_tie_lower or 'bus_tie' in bus_tie_lower:
            triggering_id = ''.join([c for c in triggering_lower if c.isdigit() or c == '#'])
            bus_tie_id = ''.join([c for c in bus_tie_lower if c.isdigit() or c == '#'])
            
            if triggering_id and triggering_id in bus_tie_id:
                return True
            
            if 'i段' in triggering_lower and ('i段' in bus_tie_lower or '1段' in bus_tie_lower):
                return True
            if 'ii段' in triggering_lower and ('ii段' in bus_tie_lower or '2段' in bus_tie_lower):
                return True
        
        return False
    
    def evaluate_event(self,
                      event: Dict[str, Any],
                      settings_data: Dict[str, Any],
                      inventory_data: Dict[str, Any] = None) -> EvaluationResult:
        """
        评估单个事件
        """
        from metro_power_analyzer.parser.yaml_parser import find_setting_for_protection_action
        
        action_type = event.get('action_type', '').lower()
        protection_type = event.get('protection_type', '').lower()
        action_value = event.get('action_value', 0)
        
        if '启动' in action_type or 'start' in action_type:
            return EvaluationResult(
                event_id=event.get('id', 'unknown'),
                device_name=event.get('device_name', ''),
                protection_type=event.get('protection_type', '未知'),
                action_value=action_value,
                setting_value=0,
                setting_unit='',
                status=ProtectionStatus.UNCERTAIN,
                details='保护启动事件，不评估定值符合性',
                setting_name='',
                tolerance=self.tolerance,
            )
        
        if '返回' in action_type or 'return' in action_type:
            return EvaluationResult(
                event_id=event.get('id', 'unknown'),
                device_name=event.get('device_name', ''),
                protection_type=event.get('protection_type', '未知'),
                action_value=action_value,
                setting_value=0,
                setting_unit='',
                status=ProtectionStatus.UNCERTAIN,
                details='保护返回事件，不评估定值符合性',
                setting_name='',
                tolerance=self.tolerance,
            )
        
        setting = find_setting_for_protection_action(
            settings_data, event, event.get('timestamp')
        )
        
        if not setting:
            return EvaluationResult(
                event_id=event.get('id', 'unknown'),
                device_name=event.get('device_name', ''),
                protection_type=event.get('protection_type', '未知'),
                action_value=action_value,
                setting_value=0,
                setting_unit='',
                status=ProtectionStatus.NO_SETTING,
                details='未找到对应定值',
            )
        
        setting_value = setting.get('value', 0)
        setting_unit = setting.get('unit', '')
        
        if '过流' in protection_type or 'oc' in protection_type or 'overcurrent' in protection_type:
            return self.evaluate_overcurrent(action_value, setting_value, event)
        
        if '接地' in protection_type or 'ground' in protection_type or 'earth' in protection_type or '零序' in protection_type:
            return self.evaluate_ground_fault(action_value, setting_value, event)
        
        if '母联' in protection_type or 'bus-tie' in protection_type or 'bus_tie' in protection_type:
            return EvaluationResult(
                event_id=event.get('id', 'unknown'),
                device_name=event.get('device_name', ''),
                protection_type=event.get('protection_type', '母联联跳'),
                action_value=action_value,
                setting_value=setting_value,
                setting_unit=setting_unit,
                status=ProtectionStatus.UNCERTAIN,
                details='母联联跳需要结合上下文判断',
                setting_name=setting.get('name', ''),
                tolerance=self.tolerance,
            )
        
        return EvaluationResult(
            event_id=event.get('id', 'unknown'),
            device_name=event.get('device_name', ''),
            protection_type=event.get('protection_type', '未知'),
            action_value=action_value,
            setting_value=setting_value,
            setting_unit=setting_unit,
            status=ProtectionStatus.UNCERTAIN,
            details=f'未知保护类型: {protection_type}',
            setting_name=setting.get('name', ''),
            tolerance=self.tolerance,
        )
    
    def evaluate_all_events(self,
                           events: List[Dict[str, Any]],
                           settings_data: Dict[str, Any],
                           inventory_data: Dict[str, Any] = None) -> List[EvaluationResult]:
        """
        评估所有事件
        """
        self.results = []
        
        for event in events:
            result = self.evaluate_event(event, settings_data, inventory_data)
            self.results.append(result)
        
        return self.results
    
    def get_evaluation_summary(self) -> Dict[str, Any]:
        """
        获取评估摘要
        """
        if not self.results:
            return {
                'total': 0,
                'compliant': 0,
                'non_compliant': 0,
                'no_setting': 0,
                'uncertain': 0,
            }
        
        summary = {
            'total': len(self.results),
            'compliant': 0,
            'non_compliant': 0,
            'no_setting': 0,
            'insufficient_data': 0,
            'uncertain': 0,
        }
        
        for result in self.results:
            if result.status == ProtectionStatus.COMPLIANT:
                summary['compliant'] += 1
            elif result.status == ProtectionStatus.NON_COMPLIANT:
                summary['non_compliant'] += 1
            elif result.status == ProtectionStatus.NO_SETTING:
                summary['no_setting'] += 1
            elif result.status == ProtectionStatus.INSUFFICIENT_DATA:
                summary['insufficient_data'] += 1
            else:
                summary['uncertain'] += 1
        
        return summary
