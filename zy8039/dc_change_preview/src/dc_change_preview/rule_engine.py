from typing import Optional

from .models import (
    Device,
    DeviceType,
    PDU,
    PDUCircuit,
    SwitchPort,
    ChangeStep,
    ChangeType,
    ValidationIssue,
    Rack,
)


class RuleEngine:
    def __init__(self, racks: list[Rack], pdus: list[PDU], switch_ports: list[SwitchPort]):
        self.racks = {r.rack_id: r for r in racks}
        self.pdus = {p.pdu_id: p for p in pdus}
        self.switch_ports = {sp.port_id: sp for sp in switch_ports}
        self.circuit_map: dict[str, PDUCircuit] = {}
        for pdu in pdus:
            for circuit in pdu.circuits:
                self.circuit_map[circuit.circuit_id] = circuit

    def check_u_position_conflict(
        self,
        device: Device,
        target_rack_id: str,
        target_u_start: int,
        target_u_end: int,
        exclude_device_id: Optional[str] = None,
    ) -> list[ValidationIssue]:
        issues = []
        rack = self.racks.get(target_rack_id)
        if not rack:
            return issues

        for existing_device in rack.devices:
            if exclude_device_id and existing_device.device_id == exclude_device_id:
                continue
            if self._is_u_overlap(
                target_u_start, target_u_end, existing_device.u_start, existing_device.u_end
            ):
                issues.append(
                    ValidationIssue(
                        severity="critical",
                        issue_type="U_POSITION_CONFLICT",
                        description=f"U位置冲突: {device.device_id} 计划占用 U{target_u_start}-U{target_u_end}，但 {existing_device.device_id} 已占用 U{existing_device.u_start}-U{existing_device.u_end}",
                        device_id=device.device_id,
                        location=f"{target_rack_id}",
                        details={
                            "conflicting_device_id": existing_device.device_id,
                            "target_u_start": target_u_start,
                            "target_u_end": target_u_end,
                            "existing_u_start": existing_device.u_start,
                            "existing_u_end": existing_device.u_end,
                        },
                    )
                )
        return issues

    def _is_u_overlap(self, start1: int, end1: int, start2: int, end2: int) -> bool:
        return not (end1 < start2 or end2 < start1)

    def check_circuit_margin(
        self, device: Device, required_amps: float = 10.0
    ) -> list[ValidationIssue]:
        issues = []
        for circuit_id in device.power_circuits:
            circuit = self.circuit_map.get(circuit_id)
            if not circuit:
                issues.append(
                    ValidationIssue(
                        severity="critical",
                        issue_type="CIRCUIT_NOT_FOUND",
                        description=f"回路 {circuit_id} 不存在",
                        device_id=device.device_id,
                        details={"circuit_id": circuit_id},
                    )
                )
                continue
            if circuit.available_amps < required_amps:
                issues.append(
                    ValidationIssue(
                        severity="warning",
                        issue_type="CIRCUIT_MARGIN_LOW",
                        description=f"回路 {circuit_id} 剩余容量不足: 需要 {required_amps}A，可用 {circuit.available_amps}A",
                        device_id=device.device_id,
                        details={
                            "circuit_id": circuit_id,
                            "required_amps": required_amps,
                            "available_amps": circuit.available_amps,
                        },
                    )
                )
        return issues

    def check_dual_power_same_circuit(self, device: Device) -> list[ValidationIssue]:
        issues = []
        if len(device.power_circuits) >= 2:
            if len(set(device.power_circuits)) == 1:
                issues.append(
                    ValidationIssue(
                        severity="critical",
                        issue_type="DUAL_POWER_SAME_CIRCUIT",
                        description=f"设备 {device.device_id} 的双电源在同一个回路上，失去冗余",
                        device_id=device.device_id,
                        details={"circuits": device.power_circuits},
                    )
                )
        return issues

    def check_port_vlan_mismatch(
        self,
        device: Device,
        target_switch_port_id: Optional[str] = None,
        target_vlan: Optional[str] = None,
    ) -> list[ValidationIssue]:
        issues = []

        check_port = target_switch_port_id or device.primary_switch_port
        if not check_port:
            return issues

        port = self.switch_ports.get(check_port)
        if not port:
            issues.append(
                ValidationIssue(
                    severity="critical",
                    issue_type="PORT_NOT_FOUND",
                    description=f"端口 {check_port} 不存在",
                    device_id=device.device_id,
                    details={"port_id": check_port},
                )
            )
            return issues

        if target_vlan and port.vlan != target_vlan:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    issue_type="VLAN_MISMATCH",
                    description=f"设备 {device.device_id} 目标 VLAN {target_vlan} 与端口 {port.port_name} 的 VLAN {port.vlan} 不匹配",
                    device_id=device.device_id,
                    details={
                        "port_id": check_port,
                        "target_vlan": target_vlan,
                        "actual_vlan": port.vlan,
                    },
                )
            )

        if port.status == "occupied" and port.connected_device_id != device.device_id:
            issues.append(
                ValidationIssue(
                    severity="critical",
                    issue_type="PORT_ALREADY_OCCUPIED",
                    description=f"端口 {port.port_name} 已被设备 {port.connected_device_id} 占用",
                    device_id=device.device_id,
                    details={
                        "port_id": check_port,
                        "occupied_by": port.connected_device_id,
                    },
                )
            )

        return issues

    def check_device_exists(self, device_id: str, available_devices: set[str]) -> list[ValidationIssue]:
        issues = []
        if device_id not in available_devices:
            issues.append(
                ValidationIssue(
                    severity="critical",
                    issue_type="DEVICE_NOT_FOUND",
                    description=f"变更步骤引用了不存在的设备: {device_id}",
                    device_id=device_id,
                    details={"referenced_device_id": device_id},
                )
            )
        return issues

    def check_port_release_after_migration(
        self,
        device_id: str,
        old_switch_port_id: Optional[str],
        migration_plan: list[ChangeStep],
    ) -> list[ValidationIssue]:
        issues = []
        if not old_switch_port_id:
            return issues

        port = self.switch_ports.get(old_switch_port_id)
        if not port:
            return issues

        if port.connected_device_id != device_id:
            return issues

        is_port_being_released = any(
            step.change_type == ChangeType.MOVE
            and step.device_id == device_id
            and step.target_switch_port is not None
            and step.target_switch_port != old_switch_port_id
            for step in migration_plan
        )

        if not is_port_being_released:
            is_old_port_in_plan = any(
                step.device_id == device_id and step.target_switch_port == old_switch_port_id
                for step in migration_plan
            )
            if not is_old_port_in_plan:
                issues.append(
                    ValidationIssue(
                        severity="warning",
                        issue_type="PORT_NOT_RELEASED",
                        description=f"设备 {device_id} 迁移后旧端口 {old_switch_port_id} 未释放，可能导致原端口被长期占用",
                        device_id=device_id,
                        details={
                            "old_port_id": old_switch_port_id,
                            "migration_plan": [s.step_id for s in migration_plan],
                        },
                    )
                )

        return issues

    def validate_add_or_move_step(
        self,
        step: ChangeStep,
        device: Device,
        available_devices: set[str],
    ) -> list[ValidationIssue]:
        issues = []

        if step.target_rack_id and step.target_u_start and step.target_u_end:
            issues.extend(
                self.check_u_position_conflict(
                    device, step.target_rack_id, step.target_u_start, step.target_u_end
                )
            )

        issues.extend(self.check_circuit_margin(device))

        issues.extend(self.check_dual_power_same_circuit(device))

        issues.extend(
            self.check_port_vlan_mismatch(device, step.target_switch_port, step.target_vlan)
        )

        return issues

    def validate_remove_step(
        self,
        step: ChangeStep,
        device: Device,
        migration_plan: list[ChangeStep],
    ) -> list[ValidationIssue]:
        issues = []

        issues.extend(
            self.check_port_release_after_migration(
                device.device_id, device.primary_switch_port, migration_plan
            )
        )

        return issues
