import pytest

from dc_change_preview.models import (
    Device, DeviceType, Rack, PDU, PDUCircuit, SwitchPort,
    ChangeStep, ChangePlan, ChangeType, PowerPhase
)
from dc_change_preview.simulator import Simulator


class TestSimulator:
    @pytest.fixture
    def setup_scenario(self):
        racks = [
            Rack(rack_id="RACK-A01", name="RACK-A01"),
        ]
        device1 = Device(
            device_id="srv-001",
            name="Server 1",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=1,
            u_end=2,
            power_circuits=["circuit-A1", "circuit-B1"],
            primary_switch_port="port-001",
        )
        racks[0].devices.append(device1)

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
                    PDUCircuit(
                        circuit_id="circuit-B1",
                        pdu_id="PDU-A01",
                        phase=PowerPhase.B,
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

    def test_simulate_add_success(self, setup_scenario):
        racks, pdus, switch_ports = setup_scenario
        simulator = Simulator(racks, pdus, switch_ports)

        device2 = Device(
            device_id="srv-002",
            name="Server 2",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=10,
            u_end=11,
            power_circuits=["circuit-A1"],
            primary_switch_port="port-002",
        )
        racks.append(Rack(rack_id="RACK-A01", name="RACK-A01"))
        racks[1].devices.append(device2)

        step = ChangeStep(
            step_id="STEP-001",
            change_type=ChangeType.ADD,
            device_id="srv-002",
            target_rack_id="RACK-A01",
            target_u_start=10,
            target_u_end=11,
            target_switch_port="port-002",
        )

        plan = ChangePlan(plan_id="PLAN-001", description="Test", steps=[step])

        result = simulator.simulate(plan)

        assert result.success is True

    def test_simulate_add_device_not_found(self, setup_scenario):
        racks, pdus, switch_ports = setup_scenario
        simulator = Simulator(racks, pdus, switch_ports)

        step = ChangeStep(
            step_id="STEP-001",
            change_type=ChangeType.ADD,
            device_id="non-existent-device",
            target_rack_id="RACK-A01",
            target_u_start=10,
            target_u_end=11,
        )

        plan = ChangePlan(plan_id="PLAN-001", description="Test", steps=[step])

        result = simulator.simulate(plan)

        assert result.success is False
        critical_issues = [i for i in result.issues if i.severity == "critical"]
        assert len(critical_issues) > 0
        assert any("non-existent-device" in i.description for i in critical_issues)

    def test_simulate_move_port_release(self, setup_scenario):
        racks, pdus, switch_ports = setup_scenario
        simulator = Simulator(racks, pdus, switch_ports)

        step = ChangeStep(
            step_id="STEP-001",
            change_type=ChangeType.MOVE,
            device_id="srv-001",
            target_rack_id="RACK-A01",
            target_u_start=20,
            target_u_end=21,
            target_switch_port="port-002",
        )

        plan = ChangePlan(plan_id="PLAN-001", description="Test", steps=[step])

        result = simulator.simulate(plan)

        snapshot_ports = result.state_snapshot["switch_ports"]
        port001 = next(p for p in snapshot_ports if p.port_id == "port-001")
        assert port001.status == "free"

    def test_generate_rollback_suggestions_add(self):
        racks = [Rack(rack_id="RACK-A01", name="RACK-A01")]
        pdus = []
        switch_ports = []

        simulator = Simulator(racks, pdus, switch_ports)

        step = ChangeStep(
            step_id="STEP-001",
            change_type=ChangeType.ADD,
            device_id="srv-001",
        )

        plan = ChangePlan(plan_id="PLAN-001", description="Test", steps=[step])

        suggestions = simulator.generate_rollback_suggestions(plan, [step])

        assert len(suggestions) == 1
        assert suggestions[0].action == "REMOVE"
        assert suggestions[0].target_device_id == "srv-001"

    def test_generate_rollback_suggestions_move(self):
        racks = [Rack(rack_id="RACK-A01", name="RACK-A01")]
        racks[0].devices.append(
            Device(
                device_id="srv-001",
                name="Server 1",
                device_type=DeviceType.SERVER,
                rack_id="RACK-A01",
                u_start=1,
                u_end=2,
            )
        )
        pdus = []
        switch_ports = []

        simulator = Simulator(racks, pdus, switch_ports)

        step = ChangeStep(
            step_id="STEP-001",
            change_type=ChangeType.MOVE,
            device_id="srv-001",
            target_rack_id="RACK-A02",
            target_u_start=10,
            target_u_end=11,
        )

        plan = ChangePlan(plan_id="PLAN-001", description="Test", steps=[step])

        suggestions = simulator.generate_rollback_suggestions(plan, [step])

        assert len(suggestions) == 1
        assert suggestions[0].action == "MOVE"
