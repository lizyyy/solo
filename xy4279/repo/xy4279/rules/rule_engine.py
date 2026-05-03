from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from enum import Enum
from config import (
    Operation, SettingVersion, SettingValue, Topology, TopologyNode, TopologyRelation,
    PlateStatus, PlateState, ApprovalTicket, ApprovalSignature, CheckResult
)


class CheckType(str, Enum):
    VERSION_CONSISTENCY = "version_consistency"
    PLATE_SEQUENCE = "plate_sequence"
    APPROVAL_COMPLETENESS = "approval_completeness"
    TOPOLOGY_INTERLOCK = "topology_interlock"
    SETTING_RANGE = "setting_range"
    PLATE_DEPENDENCY = "plate_dependency"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InterlockRuleEngine:
    def __init__(self):
        self.rules = self._load_rules()
        self.setting_ranges = self._load_setting_ranges()
        self.plate_dependencies = self._load_plate_dependencies()

    def _load_rules(self) -> Dict[str, Any]:
        return {
            "version_consistency": {
                "enabled": True,
                "description": "检查定值版本一致性，防止同一间隔拿错版本",
                "check_same_bay": True,
                "check_version_format": True,
                "check_effective_date": True
            },
            "plate_sequence": {
                "enabled": True,
                "description": "检查压板投退顺序是否正确",
                "check_function_first": True,
                "check_exit_last": True,
                "check_dependency": True
            },
            "approval_completeness": {
                "enabled": True,
                "description": "检查审批票是否完整签字",
                "check_all_signed": True,
                "check_sequence": True,
                "check_signatory_match": True
            },
            "topology_interlock": {
                "enabled": True,
                "description": "检查一次拓扑联锁条件",
                "check_breaker_state": True,
                "check_disconnector_state": True,
                "check_ground_switch": True
            },
            "setting_range": {
                "enabled": True,
                "description": "检查定值是否在合理范围内",
                "check_numeric_range": True,
                "check_dependency": True
            }
        }

    def _load_setting_ranges(self) -> Dict[str, Dict[str, Any]]:
        return {
            "动作电流": {"min": 0.1, "max": 100.0, "unit": "A"},
            "动作时间": {"min": 0.0, "max": 10.0, "unit": "s"},
            "过流定值": {"min": 0.1, "max": 50.0, "unit": "A"},
            "零序电流": {"min": 0.01, "max": 10.0, "unit": "A"},
            "电压定值": {"min": 0.1, "max": 500.0, "unit": "V"},
            "阻抗定值": {"min": 0.1, "max": 1000.0, "unit": "Ω"},
            "频率定值": {"min": 45.0, "max": 55.0, "unit": "Hz"},
            "时间定值": {"min": 0.0, "max": 100.0, "unit": "s"}
        }

    def _load_plate_dependencies(self) -> Dict[str, Dict[str, Any]]:
        return {
            "保护功能压板": {
                "must_before": ["出口压板"],
                "must_after": [],
                "description": "保护功能压板必须在出口压板之前投入"
            },
            "出口压板": {
                "must_before": [],
                "must_after": ["保护功能压板"],
                "description": "出口压板必须在保护功能压板之后投入"
            },
            "检修压板": {
                "must_before": ["保护功能压板", "出口压板"],
                "must_after": [],
                "description": "检修时应先投入检修压板"
            }
        }

    def check_all(self, operation: Operation, db_session) -> List[CheckResult]:
        results = []
        
        results.extend(self.check_version_consistency(operation, db_session))
        results.extend(self.check_plate_sequence(operation, db_session))
        results.extend(self.check_approval_completeness(operation, db_session))
        results.extend(self.check_topology_interlock(operation, db_session))
        results.extend(self.check_setting_range(operation, db_session))
        
        return results

    def check_version_consistency(self, operation: Operation, db_session) -> List[CheckResult]:
        results = []
        
        if operation.current_version_id and operation.target_version_id:
            current_ver = db_session.query(SettingVersion).filter(
                SettingVersion.id == operation.current_version_id
            ).first()
            target_ver = db_session.query(SettingVersion).filter(
                SettingVersion.id == operation.target_version_id
            ).first()
            
            if current_ver and target_ver:
                if current_ver.bay_id != target_ver.bay_id:
                    results.append(CheckResult(
                        operation_id=operation.id,
                        check_type=CheckType.VERSION_CONSISTENCY.value,
                        passed=False,
                        message=f"定值版本间隔不一致：当前版本间隔 {current_ver.bay_id}，目标版本间隔 {target_ver.bay_id}",
                        details={
                            "current_bay_id": current_ver.bay_id,
                            "target_bay_id": target_ver.bay_id,
                            "current_version": current_ver.version,
                            "target_version": target_ver.version
                        },
                        risk_level=RiskLevel.CRITICAL.value
                    ))
                elif current_ver.version == target_ver.version:
                    results.append(CheckResult(
                        operation_id=operation.id,
                        check_type=CheckType.VERSION_CONSISTENCY.value,
                        passed=True,
                        message=f"定值版本一致：当前版本和目标版本均为 {current_ver.version}",
                        details={
                            "bay_id": current_ver.bay_id,
                            "version": current_ver.version
                        },
                        risk_level=RiskLevel.LOW.value
                    ))
                else:
                    results.append(CheckResult(
                        operation_id=operation.id,
                        check_type=CheckType.VERSION_CONSISTENCY.value,
                        passed=True,
                        message=f"定值版本升级：当前版本 {current_ver.version} → 目标版本 {target_ver.version}",
                        details={
                            "bay_id": current_ver.bay_id,
                            "current_version": current_ver.version,
                            "target_version": target_ver.version
                        },
                        risk_level=RiskLevel.LOW.value
                    ))
        
        other_versions = db_session.query(SettingVersion).filter(
            SettingVersion.bay_id == operation.bay_id
        ).all()
        
        version_names = set()
        for ver in other_versions:
            if ver.version in version_names:
                results.append(CheckResult(
                    operation_id=operation.id,
                    check_type=CheckType.VERSION_CONSISTENCY.value,
                    passed=False,
                    message=f"间隔 {operation.bay_id} 存在重复版本号：{ver.version}",
                    details={
                        "bay_id": operation.bay_id,
                        "duplicate_version": ver.version
                    },
                    risk_level=RiskLevel.HIGH.value
                ))
            version_names.add(ver.version)
        
        if not any(r.check_type == CheckType.VERSION_CONSISTENCY.value for r in results):
            results.append(CheckResult(
                operation_id=operation.id,
                check_type=CheckType.VERSION_CONSISTENCY.value,
                passed=True,
                message="版本一致性检查通过",
                details={"bay_id": operation.bay_id},
                risk_level=RiskLevel.LOW.value
            ))
        
        return results

    def check_plate_sequence(self, operation: Operation, db_session) -> List[CheckResult]:
        results = []
        
        if operation.plate_status_id:
            plate_status = db_session.query(PlateStatus).filter(
                PlateStatus.id == operation.plate_status_id
            ).first()
            
            if plate_status:
                plates = db_session.query(PlateState).filter(
                    PlateState.plate_status_id == plate_status.id
                ).order_by(PlateState.sequence).all()
                
                function_plates = [p for p in plates if "功能" in str(p.plate_type)]
                exit_plates = [p for p in plates if "出口" in str(p.plate_type)]
                
                for func_plate in function_plates:
                    for exit_plate in exit_plates:
                        if func_plate.target_state == "投入" and exit_plate.target_state == "投入":
                            if func_plate.sequence is not None and exit_plate.sequence is not None:
                                if func_plate.sequence > exit_plate.sequence:
                                    results.append(CheckResult(
                                        operation_id=operation.id,
                                        check_type=CheckType.PLATE_SEQUENCE.value,
                                        passed=False,
                                        message=f"压板顺序错误：功能压板 {func_plate.plate_name} 应在出口压板 {exit_plate.plate_name} 之前投入",
                                        details={
                                            "function_plate": func_plate.plate_name,
                                            "function_sequence": func_plate.sequence,
                                            "exit_plate": exit_plate.plate_name,
                                            "exit_sequence": exit_plate.sequence
                                        },
                                        risk_level=RiskLevel.HIGH.value
                                    ))
                
                for plate in plates:
                    if plate.target_state and plate.target_state != plate.current_state:
                        if "出口" in str(plate.plate_type) and plate.target_state == "投入":
                            has_function_enabled = any(
                                "功能" in str(p.plate_type) and p.target_state == "投入"
                                for p in plates
                            )
                            if not has_function_enabled:
                                results.append(CheckResult(
                                    operation_id=operation.id,
                                    check_type=CheckType.PLATE_SEQUENCE.value,
                                    passed=False,
                                    message=f"出口压板 {plate.plate_name} 投入前必须先投入相应功能压板",
                                    details={
                                        "plate_name": plate.plate_name,
                                        "plate_type": plate.plate_type,
                                        "target_state": plate.target_state
                                    },
                                    risk_level=RiskLevel.HIGH.value
                                ))
        
        if not any(r.check_type == CheckType.PLATE_SEQUENCE.value for r in results):
            results.append(CheckResult(
                operation_id=operation.id,
                check_type=CheckType.PLATE_SEQUENCE.value,
                passed=True,
                message="压板投退顺序检查通过",
                details={},
                risk_level=RiskLevel.LOW.value
            ))
        
        return results

    def check_approval_completeness(self, operation: Operation, db_session) -> List[CheckResult]:
        results = []
        
        if operation.approval_ticket_id:
            ticket = db_session.query(ApprovalTicket).filter(
                ApprovalTicket.id == operation.approval_ticket_id
            ).first()
            
            if ticket:
                signatures = db_session.query(ApprovalSignature).filter(
                    ApprovalSignature.ticket_id == ticket.id
                ).order_by(ApprovalSignature.sequence).all()
                
                unsigned = [s for s in signatures if not s.signed]
                
                if unsigned:
                    results.append(CheckResult(
                        operation_id=operation.id,
                        check_type=CheckType.APPROVAL_COMPLETENESS.value,
                        passed=False,
                        message=f"审批票存在未签字项：{len(unsigned)} 项未签字",
                        details={
                            "ticket_no": ticket.ticket_no,
                            "total_signatures": len(signatures),
                            "signed_count": len(signatures) - len(unsigned),
                            "unsigned_roles": [s.role for s in unsigned]
                        },
                        risk_level=RiskLevel.HIGH.value
                    ))
                
                for i in range(1, len(signatures)):
                    if signatures[i].signed and not signatures[i-1].signed:
                        results.append(CheckResult(
                            operation_id=operation.id,
                            check_type=CheckType.APPROVAL_COMPLETENESS.value,
                            passed=False,
                            message=f"签字顺序错误：{signatures[i].role} 在 {signatures[i-1].role} 之前签字",
                            details={
                                "current_role": signatures[i].role,
                                "current_sequence": signatures[i].sequence,
                                "previous_role": signatures[i-1].role,
                                "previous_sequence": signatures[i-1].sequence
                            },
                            risk_level=RiskLevel.MEDIUM.value
                        ))
        
        if not any(r.check_type == CheckType.APPROVAL_COMPLETENESS.value for r in results):
            results.append(CheckResult(
                operation_id=operation.id,
                check_type=CheckType.APPROVAL_COMPLETENESS.value,
                passed=True,
                message="审批票完整性检查通过",
                details={},
                risk_level=RiskLevel.LOW.value
            ))
        
        return results

    def check_topology_interlock(self, operation: Operation, db_session) -> List[CheckResult]:
        results = []
        
        if operation.topology_id:
            topology = db_session.query(Topology).filter(
                Topology.id == operation.topology_id
            ).first()
            
            if topology:
                nodes = db_session.query(TopologyNode).filter(
                    TopologyNode.topology_id == topology.id
                ).all()
                
                relations = db_session.query(TopologyRelation).filter(
                    TopologyRelation.topology_id == topology.id
                ).all()
                
                bay_nodes = [n for n in nodes if n.node_id == operation.bay_id or operation.bay_id in str(n.name)]
                
                if bay_nodes:
                    bay_node = bay_nodes[0]
                    if bay_node.properties:
                        breaker_state = bay_node.properties.get("breaker_state", "未知")
                        disconnector_state = bay_node.properties.get("disconnector_state", "未知")
                        ground_switch_state = bay_node.properties.get("ground_switch_state", "未知")
                        
                        if breaker_state == "合闸" and ground_switch_state == "合闸":
                            results.append(CheckResult(
                                operation_id=operation.id,
                                check_type=CheckType.TOPOLOGY_INTERLOCK.value,
                                passed=False,
                                message=f"间隔 {operation.bay_id} 存在接地刀闸与断路器同时合闸的风险",
                                details={
                                    "bay_id": operation.bay_id,
                                    "breaker_state": breaker_state,
                                    "ground_switch_state": ground_switch_state
                                },
                                risk_level=RiskLevel.CRITICAL.value
                            ))
                        
                        if breaker_state == "分闸" and disconnector_state == "合闸":
                            results.append(CheckResult(
                                operation_id=operation.id,
                                check_type=CheckType.TOPOLOGY_INTERLOCK.value,
                                passed=False,
                                message=f"间隔 {operation.bay_id} 断路器分闸但隔离开关仍合闸",
                                details={
                                    "bay_id": operation.bay_id,
                                    "breaker_state": breaker_state,
                                    "disconnector_state": disconnector_state
                                },
                                risk_level=RiskLevel.MEDIUM.value
                            ))
        
        if not any(r.check_type == CheckType.TOPOLOGY_INTERLOCK.value for r in results):
            results.append(CheckResult(
                operation_id=operation.id,
                check_type=CheckType.TOPOLOGY_INTERLOCK.value,
                passed=True,
                message="一次拓扑联锁检查通过",
                details={},
                risk_level=RiskLevel.LOW.value
            ))
        
        return results

    def check_setting_range(self, operation: Operation, db_session) -> List[CheckResult]:
        results = []
        
        if operation.target_version_id:
            target_ver = db_session.query(SettingVersion).filter(
                SettingVersion.id == operation.target_version_id
            ).first()
            
            if target_ver:
                values = db_session.query(SettingValue).filter(
                    SettingValue.version_id == target_ver.id
                ).all()
                
                for val in values:
                    for setting_name, range_info in self.setting_ranges.items():
                        if setting_name in val.name:
                            try:
                                num_value = float(val.value)
                                if num_value < range_info["min"] or num_value > range_info["max"]:
                                    results.append(CheckResult(
                                        operation_id=operation.id,
                                        check_type=CheckType.SETTING_RANGE.value,
                                        passed=False,
                                        message=f"定值 {val.name} = {val.value} {range_info['unit']} 超出合理范围 [{range_info['min']}, {range_info['max']}]",
                                        details={
                                            "setting_name": val.name,
                                            "current_value": val.value,
                                            "min_value": range_info["min"],
                                            "max_value": range_info["max"],
                                            "unit": range_info["unit"]
                                        },
                                        risk_level=RiskLevel.HIGH.value
                                    ))
                            except (ValueError, TypeError):
                                pass
        
        if not any(r.check_type == CheckType.SETTING_RANGE.value for r in results):
            results.append(CheckResult(
                operation_id=operation.id,
                check_type=CheckType.SETTING_RANGE.value,
                passed=True,
                message="定值范围检查通过",
                details={},
                risk_level=RiskLevel.LOW.value
            ))
        
        return results

    def compare_versions(self, version1: SettingVersion, version2: SettingVersion, 
                         values1: List[SettingValue], values2: List[SettingValue]) -> Dict[str, Any]:
        result = {
            "version_current": version1.version,
            "version_target": version2.version,
            "bay_id": version1.bay_id,
            "bay_name": version1.bay_name,
            "total_values": 0,
            "changed_values": 0,
            "unchanged_values": 0,
            "added_values": 0,
            "removed_values": 0,
            "changes": [],
            "additions": [],
            "removals": []
        }
        
        values1_dict = {v.name: v for v in values1}
        values2_dict = {v.name: v for v in values2}
        
        all_names = set(values1_dict.keys()) | set(values2_dict.keys())
        
        for name in all_names:
            val1 = values1_dict.get(name)
            val2 = values2_dict.get(name)
            
            if val1 and val2:
                result["total_values"] += 1
                if val1.value != val2.value:
                    result["changed_values"] += 1
                    result["changes"].append({
                        "name": name,
                        "old_value": val1.value,
                        "new_value": val2.value,
                        "unit": val1.unit or val2.unit,
                        "category": val1.category or val2.category
                    })
                else:
                    result["unchanged_values"] += 1
            elif val2 and not val1:
                result["added_values"] += 1
                result["additions"].append({
                    "name": name,
                    "value": val2.value,
                    "unit": val2.unit,
                    "category": val2.category
                })
            elif val1 and not val2:
                result["removed_values"] += 1
                result["removals"].append({
                    "name": name,
                    "value": val1.value,
                    "unit": val1.unit,
                    "category": val1.category
                })
        
        return result
