from typing import Optional, List, Dict
from copy import deepcopy

from .models import (
    Device,
    Rack,
    PDU,
    PDUCircuit,
    SwitchPort,
    ChangeStep,
    ChangePlan,
    ChangeType,
    ValidationIssue,
    SimulationResult,
    RollbackSuggestion,
)
from .rule_engine import RuleEngine


class Simulator:
    def __init__(
        self,
        racks: List[Rack],
        pdus: List[PDU],
        switch_ports: List[SwitchPort],
    ):
        self.initial_racks = racks
        self.initial_pdus = pdus
        self.initial_switch_ports = switch_ports
        self.rule_engine = RuleEngine(racks, pdus, switch_ports)
        self.racks = racks
        self.pdus = pdus
        self.switch_ports = switch_ports

    def _get_device_by_id(self, device_id: str) -> Optional[Device]:
        for rack in self.racks:
            for device in rack.devices:
                if device.device_id == device_id:
                    return device
        return None

    def _get_port_by_id(self, port_id: str) -> Optional[SwitchPort]:
        for port in self.switch_ports:
            if port.port_id == port_id:
                return port
        return None

    def _build_state_snapshot(self) -> Dict:
        return {
            "racks": deepcopy(self.racks),
            "pdus": deepcopy(self.pdus),
            "switch_ports": deepcopy(self.switch_ports),
        }

    def _release_port(self, device_id: str):
        for port in self.switch_ports:
            if port.connected_device_id == device_id:
                port.status = "free"
                port.connected_device_id = None

    def _occupy_port(self, port_id: str, device_id: str):
        port = self._get_port_by_id(port_id)
        if port:
            port.status = "occupied"
            port.connected_device_id = device_id

    def _update_device_location(
        self,
        device: Device,
        target_rack_id: Optional[str],
        target_u_start: Optional[int],
        target_u_end: Optional[int],
    ):
        if target_rack_id:
            for rack in self.racks:
                rack.devices = [d for d in rack.devices if d.device_id != device.device_id]
            target_rack = next((r for r in self.racks if r.rack_id == target_rack_id), None)
            if target_rack:
                device.rack_id = target_rack_id
                if target_u_start is not None:
                    device.u_start = target_u_start
                if target_u_end is not None:
                    device.u_end = target_u_end
                target_rack.devices.append(device)

    def _update_device_switch_port(
        self,
        device: Device,
        new_switch_port: Optional[str],
        new_vlan: Optional[str],
    ):
        old_port = device.primary_switch_port
        self._release_port(device.device_id)

        if new_switch_port:
            device.primary_switch_port = new_switch_port
            self._occupy_port(new_switch_port, device.device_id)
            if new_vlan:
                port = self._get_port_by_id(new_switch_port)
                if port:
                    port.vlan = new_vlan

        return old_port

    def simulate_add(self, step: ChangeStep) -> List[ValidationIssue]:
        issues = []
        device = self._get_device_by_id(step.device_id)

        if not device:
            issues.append(
                ValidationIssue(
                    severity="critical",
                    issue_type="DEVICE_NOT_FOUND",
                    description=f"ADD 步骤 {step.step_id}: 设备 {step.device_id} 不存在",
                    device_id=step.device_id,
                    details={"step_id": step.step_id},
                )
            )
            return issues

        available_devices = {d.device_id for rack in self.racks for d in rack.devices}
        issues.extend(
            self.rule_engine.validate_add_or_move_step(step, device, available_devices)
        )

        if all(issue.severity != "critical" for issue in issues):
            self._update_device_location(
                device, step.target_rack_id, step.target_u_start, step.target_u_end
            )
            self._update_device_switch_port(device, step.target_switch_port, step.target_vlan)

        return issues

    def simulate_remove(self, step: ChangeStep, migration_plan: List[ChangeStep]) -> List[ValidationIssue]:
        issues = []
        device = self._get_device_by_id(step.device_id)

        if not device:
            issues.append(
                ValidationIssue(
                    severity="critical",
                    issue_type="DEVICE_NOT_FOUND",
                    description=f"REMOVE 步骤 {step.step_id}: 设备 {step.device_id} 不存在",
                    device_id=step.device_id,
                    details={"step_id": step.step_id},
                )
            )
            return issues

        issues.extend(self.rule_engine.validate_remove_step(step, device, migration_plan))

        if all(issue.severity != "critical" for issue in issues):
            self._release_port(device.device_id)
            for rack in self.racks:
                rack.devices = [d for d in rack.devices if d.device_id != device.device_id]

        return issues

    def simulate_move(self, step: ChangeStep, migration_plan: List[ChangeStep]) -> List[ValidationIssue]:
        issues = []
        device = self._get_device_by_id(step.device_id)

        if not device:
            issues.append(
                ValidationIssue(
                    severity="critical",
                    issue_type="DEVICE_NOT_FOUND",
                    description=f"MOVE 步骤 {step.step_id}: 设备 {step.device_id} 不存在",
                    device_id=step.device_id,
                    details={"step_id": step.step_id},
                )
            )
            return issues

        available_devices = {d.device_id for rack in self.racks for d in rack.devices}

        old_switch_port = device.primary_switch_port
        old_rack_id = device.rack_id
        old_u_start = device.u_start
        old_u_end = device.u_end

        issues.extend(
            self.rule_engine.validate_add_or_move_step(step, device, available_devices)
        )

        if old_switch_port and step.target_switch_port and old_switch_port != step.target_switch_port:
            issues.extend(
                self.rule_engine.check_port_release_after_migration(
                    device.device_id, old_switch_port, migration_plan
                )
            )

        if all(issue.severity != "critical" for issue in issues):
            self._update_device_location(
                device, step.target_rack_id, step.target_u_start, step.target_u_end
            )
            self._update_device_switch_port(device, step.target_switch_port, step.target_vlan)
        else:
            device.rack_id = old_rack_id
            device.u_start = old_u_start
            device.u_end = old_u_end

        return issues

    def simulate(self, change_plan: ChangePlan) -> SimulationResult:
        self.racks = deepcopy(self.initial_racks)
        self.pdus = deepcopy(self.initial_pdus)
        self.switch_ports = deepcopy(self.initial_switch_ports)

        all_issues: List[ValidationIssue] = []
        executed_steps: List[ChangeStep] = []

        available_devices = {d.device_id for rack in self.racks for d in rack.devices}
        for step in change_plan.steps:
            issues: List[ValidationIssue] = []

            if step.change_type == ChangeType.ADD:
                issues = self.simulate_add(step)
            elif step.change_type == ChangeType.REMOVE:
                issues = self.simulate_remove(step, change_plan.steps)
            elif step.change_type == ChangeType.MOVE:
                issues = self.simulate_move(step, change_plan.steps)

            all_issues.extend(issues)
            if all(issue.severity != "critical" for issue in issues):
                executed_steps.append(step)

        return SimulationResult(
            success=len([i for i in all_issues if i.severity == "critical"]) == 0,
            issues=all_issues,
            executed_steps=executed_steps,
            state_snapshot=self._build_state_snapshot(),
        )

    def generate_rollback_suggestions(
        self,
        change_plan: ChangePlan,
        executed_steps: List[ChangeStep],
    ) -> List[RollbackSuggestion]:
        suggestions: List[RollbackSuggestion] = []
        executed_step_ids = {s.step_id for s in executed_steps}

        for step in reversed(change_plan.steps):
            if step.step_id not in executed_step_ids:
                continue

            if step.change_type == ChangeType.ADD:
                suggestions.append(
                    RollbackSuggestion(
                        step_id=f"rollback_{step.step_id}",
                        action="REMOVE",
                        target_device_id=step.device_id,
                        description=f"移除新增的设备 {step.device_id}",
                    )
                )
            elif step.change_type == ChangeType.REMOVE:
                suggestions.append(
                    RollbackSuggestion(
                        step_id=f"rollback_{step.step_id}",
                        action="ADD",
                        target_device_id=step.device_id,
                        description=f"重新上架设备 {step.device_id}",
                    )
                )
            elif step.change_type == ChangeType.MOVE:
                device = self._get_device_by_id(step.device_id)
                if device:
                    old_location = f"{device.rack_id} U{device.u_start}-{device.u_end}"
                    suggestions.append(
                        RollbackSuggestion(
                            step_id=f"rollback_{step.step_id}",
                            action="MOVE",
                            target_device_id=step.device_id,
                            description=f"将设备 {step.device_id} 移回 {old_location}",
                        )
                    )

        return suggestions
