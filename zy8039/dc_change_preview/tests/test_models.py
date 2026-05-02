import pytest
from pathlib import Path
import tempfile
import json
import csv

from dc_change_preview.models import (
    Device, DeviceType, Rack, PDU, PDUCircuit, SwitchPort,
    ChangeStep, ChangePlan, ChangeType, PowerPhase,
    ValidationIssue, SimulationResult, RollbackSuggestion
)


class TestModels:
    def test_device_creation(self):
        device = Device(
            device_id="srv-001",
            name="Test Server",
            device_type=DeviceType.SERVER,
            rack_id="RACK-A01",
            u_start=1,
            u_end=2,
        )
        assert device.device_id == "srv-001"
        assert device.device_type == DeviceType.SERVER

    def test_pdu_circuit_available_amps(self):
        circuit = PDUCircuit(
            circuit_id="circuit-A1",
            pdu_id="PDU-A01",
            phase=PowerPhase.A,
            max_amps=20.0,
            used_amps=8.0,
        )
        assert circuit.available_amps == 12.0

    def test_change_step_move(self):
        step = ChangeStep(
            step_id="STEP-001",
            change_type=ChangeType.MOVE,
            device_id="srv-001",
            target_rack_id="RACK-A02",
            target_u_start=10,
            target_u_end=11,
        )
        assert step.change_type == ChangeType.MOVE

    def test_validation_issue(self):
        issue = ValidationIssue(
            severity="critical",
            issue_type="U_POSITION_CONFLICT",
            description="U位置冲突",
            device_id="srv-001",
            location="RACK-A01",
        )
        assert issue.severity == "critical"
        assert issue.issue_type == "U_POSITION_CONFLICT"
