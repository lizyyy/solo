from collections import Counter
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from meeting_screen_inspector.models.models import (
    DeviceType,
    RiskLevel,
    RiskType,
    Risk,
    DeviceInspection,
    InspectionSession,
    DeviceStatus,
)


class BaseRule:
    rule_name: str = ""
    description: str = ""
    
    def execute(self, session: InspectionSession) -> List[Risk]:
        raise NotImplementedError


class VersionDriftRule(BaseRule):
    rule_name = "version_drift"
    description = "检测同一类型设备的固件版本是否不一致"
    
    def __init__(self, device_type: Optional[DeviceType] = None):
        self.device_type = device_type
    
    def execute(self, session: InspectionSession) -> List[Risk]:
        risks: List[Risk] = []
        versions_by_type: Dict[str, List[Tuple[str, str, Optional[str]]]] = {}
        
        for device in session.devices:
            if self.device_type and device.identity.device_type != self.device_type:
                continue
            
            ver = self._get_device_version(device)
            if ver:
                dtype = device.identity.device_type.value
                if dtype not in versions_by_type:
                    versions_by_type[dtype] = []
                versions_by_type[dtype].append(
                    (device.identity.device_id, ver, device.identity.location)
                )
        
        for dtype, device_versions in versions_by_type.items():
            version_counts = Counter(v for _, v, _ in device_versions)
            
            if len(version_counts) > 1:
                sorted_versions = version_counts.most_common()
                majority_version = sorted_versions[0][0]
                
                for device_id, ver, location in device_versions:
                    if ver != majority_version:
                        risk = Risk(
                            risk_type=RiskType.VERSION_DRIFT,
                            level=RiskLevel.HIGH if len(device_versions) > 2 else RiskLevel.MEDIUM,
                            description=f"设备版本不一致：当前版本 {ver}，主流版本 {majority_version}",
                            device_id=device_id,
                            device_type=DeviceType(dtype),
                            location=location,
                            details={
                                "current_version": ver,
                                "majority_version": majority_version,
                                "all_versions": dict(version_counts),
                            },
                            suggestion=f"考虑将设备升级到主流版本 {majority_version}，或确认版本差异原因",
                        )
                        risks.append(risk)
        
        return risks
    
    def _get_device_version(self, device: DeviceInspection) -> Optional[str]:
        if device.serial_log and device.serial_log.detected_version:
            return device.serial_log.detected_version
        if device.config and device.config.version:
            return device.config.version
        return None


class RebootLoopRule(BaseRule):
    rule_name = "reboot_loop"
    description = "检测设备是否存在重启循环"
    
    def __init__(self, reboot_threshold: int = 3, time_window_minutes: int = 60):
        self.reboot_threshold = reboot_threshold
        self.time_window_minutes = time_window_minutes
    
    def execute(self, session: InspectionSession) -> List[Risk]:
        risks: List[Risk] = []
        
        for device in session.devices:
            if device.serial_log and device.serial_log.reboot_count >= self.reboot_threshold:
                level = (
                    RiskLevel.CRITICAL 
                    if device.serial_log.reboot_count >= 5 
                    else RiskLevel.HIGH
                )
                
                risk = Risk(
                    risk_type=RiskType.REBOOT_LOOP,
                    level=level,
                    description=f"设备存在重启循环风险：检测到 {device.serial_log.reboot_count} 次重启",
                    device_id=device.identity.device_id,
                    device_type=device.identity.device_type,
                    location=device.identity.location,
                    details={
                        "reboot_count": device.serial_log.reboot_count,
                        "last_reboot_time": device.serial_log.last_reboot_time,
                        "threshold": self.reboot_threshold,
                    },
                    suggestion="检查设备电源稳定性、散热情况，或查看详细日志定位重启原因",
                )
                risks.append(risk)
        
        return risks


class AddressDuplicateRule(BaseRule):
    rule_name = "address_duplicate"
    description = "检测蓝牙地址是否重复（串台）"
    
    def execute(self, session: InspectionSession) -> List[Risk]:
        risks: List[Risk] = []
        address_to_devices: Dict[str, List[Tuple[str, DeviceType, Optional[str]]]] = {}
        
        for device in session.devices:
            if device.bluetooth_snapshot:
                for bt_device in device.bluetooth_snapshot.devices:
                    addr = bt_device.address.upper()
                    if addr not in address_to_devices:
                        address_to_devices[addr] = []
                    address_to_devices[addr].append(
                        (device.identity.device_id, device.identity.device_type, device.identity.location)
                    )
        
        for addr, devices_list in address_to_devices.items():
            if len(devices_list) > 1:
                unique_devices = list(set(d[0] for d in devices_list))
                
                if len(unique_devices) > 1:
                    for device_id, device_type, location in devices_list:
                        other_devices = [d for d in devices_list if d[0] != device_id]
                        other_device_ids = [d[0] for d in other_devices]
                        
                        risk = Risk(
                            risk_type=RiskType.ADDRESS_DUPLICATE,
                            level=RiskLevel.CRITICAL,
                            description=f"蓝牙地址串台：地址 {addr} 在多个设备中检测到",
                            device_id=device_id,
                            device_type=device_type,
                            location=location,
                            details={
                                "duplicate_address": addr,
                                "detected_in_devices": [d[0] for d in devices_list],
                                "conflicting_devices": other_device_ids,
                            },
                            suggestion="检查设备蓝牙配置，确认是否存在地址冲突或扫描错误",
                        )
                        risks.append(risk)
        
        return risks


class ConfigMissingRule(BaseRule):
    rule_name = "config_missing"
    description = "检测配置文件是否缺少必需项"
    
    DEFAULT_REQUIRED_KEYS = [
        "version", "device_id", "network", "wifi",
        "bluetooth", "ip", "dns", "gateway",
    ]
    
    def __init__(self, required_keys: Optional[List[str]] = None):
        self.required_keys = required_keys or self.DEFAULT_REQUIRED_KEYS
    
    def execute(self, session: InspectionSession) -> List[Risk]:
        risks: List[Risk] = []
        
        for device in session.devices:
            if device.config:
                missing_keys: List[str] = []
                
                for key in self.required_keys:
                    if key not in device.config.all_keys:
                        nested_found = False
                        for nested_key, value in device.config.raw_json.items():
                            if isinstance(value, dict) and key in value:
                                nested_found = True
                                break
                        if not nested_found:
                            missing_keys.append(key)
                
                if missing_keys:
                    level = (
                        RiskLevel.CRITICAL 
                        if len(missing_keys) >= 3 
                        else RiskLevel.HIGH if len(missing_keys) >= 2 
                        else RiskLevel.MEDIUM
                    )
                    
                    risk = Risk(
                        risk_type=RiskType.CONFIG_MISSING,
                        level=level,
                        description=f"配置文件缺少必需项：{', '.join(missing_keys)}",
                        device_id=device.identity.device_id,
                        device_type=device.identity.device_type,
                        location=device.identity.location,
                        details={
                            "missing_keys": missing_keys,
                            "total_missing": len(missing_keys),
                            "required_keys": self.required_keys,
                            "available_keys": list(device.config.all_keys),
                        },
                        suggestion="检查配置文件，补充缺失的配置项后再进行升级",
                    )
                    risks.append(risk)
        
        return risks


class RollbackRiskRule(BaseRule):
    rule_name = "rollback_risk"
    description = "检测升级后回滚风险"
    
    ROLLBACK_SAFE_KEYS = [
        "network_config", "wifi_config", "bluetooth_config",
        "ip_config", "static_ip", "device_name", "location",
        "保存的配置", "备份配置", "rollback_config",
    ]
    
    def execute(self, session: InspectionSession) -> List[Risk]:
        risks: List[Risk] = []
        
        for device in session.devices:
            risk_details: Dict[str, Any] = {}
            risk_level = RiskLevel.LOW
            
            if not device.config:
                risk_details["no_config"] = True
                risk_level = RiskLevel.HIGH
            
            if device.config:
                config_keys = set(k.lower() for k in device.config.all_keys)
                safe_keys_found = [k for k in self.ROLLBACK_SAFE_KEYS if k.lower() in config_keys]
                
                if not safe_keys_found:
                    risk_details["no_rollback_keys"] = True
                    risk_level = max(risk_level, RiskLevel.MEDIUM)
                
                network_keys = {'ip', 'dns', 'gateway', 'network', 'wifi', 'ethernet'}
                network_keys_found = [k for k in network_keys if k.lower() in config_keys]
                
                if not network_keys_found and device.config.network_config:
                    network_keys_found = list(device.config.network_config.keys())
                
                if not network_keys_found:
                    risk_details["no_network_config"] = True
                    risk_level = max(risk_level, RiskLevel.HIGH)
                
                bt_keys = {'bluetooth', 'bt', 'ble', 'mac_address'}
                bt_keys_found = [k for k in bt_keys if k.lower() in config_keys]
                
                if not bt_keys_found and device.config.bluetooth_config:
                    bt_keys_found = list(device.config.bluetooth_config.keys())
                
                if not bt_keys_found:
                    risk_details["no_bluetooth_config"] = True
                    risk_level = max(risk_level, RiskLevel.MEDIUM)
            
            if risk_level != RiskLevel.LOW or risk_details:
                description_parts = ["存在回滚风险："]
                if risk_details.get("no_config"):
                    description_parts.append("未找到设备配置文件")
                if risk_details.get("no_rollback_keys"):
                    description_parts.append("未发现明确的回滚配置标识")
                if risk_details.get("no_network_config"):
                    description_parts.append("缺少网络配置，升级后可能无法连接")
                if risk_details.get("no_bluetooth_config"):
                    description_parts.append("缺少蓝牙配置")
                
                risk = Risk(
                    risk_type=RiskType.ROLLBACK_RISK,
                    level=risk_level,
                    description=" ".join(description_parts),
                    device_id=device.identity.device_id,
                    device_type=device.identity.device_type,
                    location=device.identity.location,
                    details=risk_details,
                    suggestion="升级前请确认配置已完整备份，建议先导出当前配置作为回滚包",
                )
                risks.append(risk)
        
        return risks


class BaudrateErrorRule(BaseRule):
    rule_name = "baudrate_error"
    description = "检测串口波特率是否与预期不符"
    
    def __init__(self, expected_baudrate: int = 115200):
        self.expected_baudrate = expected_baudrate
    
    def execute(self, session: InspectionSession) -> List[Risk]:
        risks: List[Risk] = []
        
        for device in session.devices:
            if device.serial_log and device.serial_log.port_info:
                port_info = device.serial_log.port_info
                
                if port_info.detected_baud_rate:
                    if port_info.detected_baud_rate != self.expected_baudrate:
                        risk = Risk(
                            risk_type=RiskType.BAUDRATE_ERROR,
                            level=RiskLevel.MEDIUM,
                            description=f"波特率不一致：检测到 {port_info.detected_baud_rate}，预期 {self.expected_baudrate}",
                            device_id=device.identity.device_id,
                            device_type=device.identity.device_type,
                            location=device.identity.location,
                            details={
                                "detected_baudrate": port_info.detected_baud_rate,
                                "expected_baudrate": self.expected_baudrate,
                                "configured_baudrate": port_info.baud_rate,
                            },
                            suggestion="检查串口配置，确认波特率设置是否正确",
                        )
                        risks.append(risk)
        
        return risks


class RuleEngine:
    def __init__(self, rules: Optional[List[BaseRule]] = None):
        self.rules = rules or [
            VersionDriftRule(),
            RebootLoopRule(),
            AddressDuplicateRule(),
            ConfigMissingRule(),
            RollbackRiskRule(),
            BaudrateErrorRule(),
        ]
    
    def add_rule(self, rule: BaseRule):
        self.rules.append(rule)
    
    def run_all(self, session: InspectionSession) -> Dict[str, List[Risk]]:
        results: Dict[str, List[Risk]] = {}
        
        for rule in self.rules:
            risks = rule.execute(session)
            if risks:
                results[rule.rule_name] = risks
        
        return results
    
    def run_and_update_status(self, session: InspectionSession) -> InspectionSession:
        all_risks: List[Risk] = []
        
        for rule in self.rules:
            risks = rule.execute(session)
            all_risks.extend(risks)
        
        for risk in all_risks:
            device_id = risk.device_id
            if device_id not in session.device_statuses:
                device = next(
                    (d for d in session.devices if d.identity.device_id == device_id),
                    None
                )
                if device:
                    session.device_statuses[device_id] = DeviceStatus(
                        device_id=device_id,
                        device_type=device.identity.device_type,
                        location=device.identity.location,
                        version=self._get_version(device),
                        risks=[],
                    )
            
            if device_id in session.device_statuses:
                session.device_statuses[device_id].risks.append(risk)
        
        session.summary = self._generate_summary(session, all_risks)
        
        return session
    
    def _get_version(self, device: DeviceInspection) -> Optional[str]:
        if device.serial_log and device.serial_log.detected_version:
            return device.serial_log.detected_version
        if device.config and device.config.version:
            return device.config.version
        return None
    
    def _generate_summary(self, session: InspectionSession, all_risks: List[Risk]) -> Dict[str, Any]:
        risk_count_by_type: Dict[str, int] = {}
        risk_count_by_level: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for risk in all_risks:
            risk_type = risk.risk_type.value
            risk_count_by_type[risk_type] = risk_count_by_type.get(risk_type, 0) + 1
            risk_count_by_level[risk.level.value] += 1
        
        devices_with_risks = len(set(r.device_id for r in all_risks))
        total_devices = len(session.devices)
        
        return {
            "total_devices": total_devices,
            "devices_with_risks": devices_with_risks,
            "devices_clean": total_devices - devices_with_risks,
            "risk_count_by_type": risk_count_by_type,
            "risk_count_by_level": risk_count_by_level,
            "total_risks": len(all_risks),
            "has_critical_risks": risk_count_by_level["critical"] > 0,
        }
