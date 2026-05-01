import pytest

from dc_change_preview.models import (
    Device, DeviceType, Rack, PDU, PDUCircuit, SwitchPort,
    ChangeStep, ChangeType, PowerPhase, ValidationIssue
)
from dc_change_preview.rule_engine import RuleEngine


class TestRuleEngine:
    @pytest.fixture
    def setup_racks_and_pdus(self):
        racks = [
            Rack(rack_id="RACK-A01", name="RACK-A01"),
        ]
        racks[0].devices = [
            Device(
                device_id="srv-001",
                name="Existing Server",
                device_type=DeviceType.SERVER,
                rack_id="RACK-A01",
                u_start=1,
                u_end=2,
                power_circuits=["circuit-A1"],
            ),
        ]

        pdus = [
            PDU(
                pdu_id="PDU-A01",
                rack_id="RACK-A01",
                circuits=[
                    PDUCircuit(
                        circuit_id="circuit-A1",
                        pdu_id="PDU-A01",
                        phase=PowerPhase.A,
                        max_amps=20.0,
                        used_amps=8.0,
                    ),
                ],
            ),
        ]

        switch_ports = [
            SwitchPort(
                port_id="port-001",
                switch_id="sw-001",
                port_name="Gi0/1",
                vlan="vlan100",
                status="occupied",
                connected_device_id="srv-001",
            ),
            SwitchPort(
                port_id="port-002",
                switch_id="sw-001",
                port_name="Gi0/2",
                vlan="vlan100",
                status="free",
            ),
        ]

        return racks, pdus, switch_ports

    def test_u_position_conflict_detected(
        self, setup_racks_and_pdus
    ):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        device = Device(
            device_id="srv-002",
            name="New Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=1,
            u_end=3,
        )

        issues = engine.check_u_position_conflict(
            device, "RACK-A01", 1, 3, exclude_device_id="srv-002"
        )

        assert len(issues) == 1
        assert issues[0].issue_type == "U_POSITION_CONFLICT"
        assert issues[0].severity == "critical"

    def test_u_position_no_conflict(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        device = Device(
            device_id="srv-002",
            name="New Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=5,
            u_end=6,
        )

        issues = engine.check_u_position_conflict(
            device, "RACK-A01", 5, 6, exclude_device_id="srv-002"
        )

        assert len(issues) == 0

    def test_circuit_margin_low(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        device = Device(
            device_id="srv-002",
            name="New Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=10,
            u_end=11,
            power_circuits=["circuit-A1"],
        )

        issues = engine.check_circuit_margin(device, required_amps=15.0)

        assert len(issues) == 1
        assert issues[0].issue_type == "CIRCUIT_MARGIN_LOW"
        assert issues[0].severity == "warning"

    def test_circuit_not_found(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        device = Device(
            device_id="srv-002",
            name="New Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=10,
            u_end=11,
            power_circuits=["non-existent-circuit"],
        )

        issues = engine.check_circuit_margin(device)

        assert len(issues) == 1
        assert issues[0].issue_type == "CIRCUIT_NOT_FOUND"

    def test_dual_power_same_circuit(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        device = Device(
            device_id="srv-002",
            name="New Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=10,
            u_end=11,
            power_circuits=["circuit-A1", "circuit-A1"],
        )

        issues = engine.check_dual_power_same_circuit(device)

        assert len(issues) == 1
        assert issues[0].issue_type == "DUAL_POWER_SAME_CIRCUIT"
        assert issues[0].severity == "critical"

    def test_dual_power_different_circuits(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        pdus[0].circuits.append(
            PDUCircuit(
                circuit_id="circuit-B1",
                pdu_id="PDU-A01",
                phase=PowerPhase.B,
                max_amps=20.0,
                used_amps=5.0,
            )
        )
        engine = RuleEngine(racks, pdus, switch_ports)

        device = Device(
            device_id="srv-002",
            name="New Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=10,
            u_end=11,
            power_circuits=["circuit-A1", "circuit-B1"],
        )

        issues = engine.check_dual_power_same_circuit(device)

        assert len(issues) == 0

    def test_port_vlan_mismatch(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        device = Device(
            device_id="srv-002",
            name="New Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=10,
            u_end=11,
            primary_switch_port="port-002",
        )

        issues = engine.check_port_vlan_mismatch(
            device, target_switch_port_id="port-002", target_vlan="vlan200"
        )

        assert len(issues) == 1
        assert issues[0].issue_type == "VLAN_MISMATCH"
        assert issues[0].severity == "warning"

    def test_port_already_occupied(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        device = Device(
            device_id="srv-002",
            name="New Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=10,
            u_end=11,
        )

        issues = engine.check_port_vlan_mismatch(
            device, target_switch_port_id="port-001", target_vlan="vlan100"
        )

        assert len(issues) == 1
        assert issues[0].issue_type == "PORT_ALREADY_OCCUPIED"
        assert issues[0].severity == "critical"

    def test_device_not_found(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        issues = engine.check_device_exists(
            "non-existent-device",
            available_devices={"srv-001", "srv-002"}
        )

        assert len(issues) == 1
        assert issues[0].issue_type == "DEVICE_NOT_FOUND"
        assert issues[0].severity == "critical"

    def test_port_release_after_migration(self, setup_racks_and_pdus):
        racks, pdus, switch_ports = setup_racks_and_pdus
        engine = RuleEngine(racks, pdus, switch_ports)

        migration_plan = [
            ChangeStep(
                step_id="STEP-001",
                change_type=ChangeType.MOVE,
                device_id="srv-001",
                target_switch_port="port-002",
            )
        ]

        issues = engine.check_port_release_after_migration(
            "srv-001", "port-001", migration_plan
        )

        assert len(issues) == 0
