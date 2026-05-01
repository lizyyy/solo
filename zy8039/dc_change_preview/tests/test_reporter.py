import pytest
from pathlib import Path
import csv

from dc_change_preview.models import (
    ChangeStep, ChangePlan, ChangeType, ValidationIssue, RollbackSuggestion
)
from dc_change_preview.reporter import Reporter


class TestReporter:
    @pytest.fixture
    def setup_reporter(self, tmp_path):
        return Reporter(tmp_path)

    def test_generate_risk_csv(self, setup_reporter):
        issues = [
            ValidationIssue(
                severity="critical",
                issue_type="U_POSITION_CONFLICT",
                description="U位置冲突",
                device_id="srv-001",
                location="RACK-A01",
                details={"conflicting_device_id": "srv-002"},
            ),
            ValidationIssue(
                severity="warning",
                issue_type="CIRCUIT_MARGIN_LOW",
                description="回路余量不足",
                device_id="srv-002",
                location="RACK-A01",
                details={"available_amps": 5.0},
            ),
        ]

        output_path = setup_reporter.generate_risk_csv(issues)

        assert output_path.exists()

        with open(output_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) == 2
        assert rows[0]["severity"] == "critical"
        assert rows[0]["device_id"] == "srv-001"
        assert rows[1]["severity"] == "warning"

    def test_generate_executable_steps_md(self, setup_reporter):
        steps = [
            ChangeStep(
                step_id="STEP-001",
                change_type=ChangeType.ADD,
                device_id="srv-001",
                target_rack_id="RACK-A01",
                target_u_start=10,
                target_u_end=11,
                target_switch_port="port-005",
                notes="Test",
            ),
        ]

        plan = ChangePlan(
            plan_id="PLAN-001",
            description="Test Plan",
            steps=steps,
        )

        from dc_change_preview.models import SimulationResult
        result = SimulationResult(
            success=True,
            issues=[],
            executed_steps=steps,
            state_snapshot={},
        )

        output_path = setup_reporter.generate_executable_steps_md(plan, result)

        assert output_path.exists()
        content = output_path.read_text(encoding="utf-8")
        assert "PLAN-001" in content
        assert "STEP-001" in content
        assert "✅" in content or "成功" in content

    def test_generate_rollback_md(self, setup_reporter):
        suggestions = [
            RollbackSuggestion(
                step_id="rollback_step-001",
                action="REMOVE",
                target_device_id="srv-001",
                description="移除设备 srv-001",
            ),
            RollbackSuggestion(
                step_id="rollback_step-002",
                action="ADD",
                target_device_id="srv-002",
                description="重新上架设备 srv-002",
            ),
        ]

        output_path = setup_reporter.generate_rollback_md(suggestions)

        assert output_path.exists()
        content = output_path.read_text(encoding="utf-8")
        assert "srv-001" in content
        assert "srv-002" in content
        assert "REMOVE" in content

    def test_generate_summary_json(self, setup_reporter):
        plan = ChangePlan(
            plan_id="PLAN-001",
            description="Test",
            steps=[
                ChangeStep(
                    step_id="STEP-001",
                    change_type=ChangeType.ADD,
                    device_id="srv-001",
                ),
            ],
        )

        from dc_change_preview.models import SimulationResult
        result = SimulationResult(
            success=True,
            issues=[
                ValidationIssue(
                    severity="warning",
                    issue_type="TEST",
                    description="Test warning",
                ),
            ],
            executed_steps=plan.steps,
            state_snapshot={},
        )

        suggestions = [
            RollbackSuggestion(
                step_id="rb-001",
                action="REMOVE",
                target_device_id="srv-001",
                description="Rollback",
            ),
        ]

        output_path = setup_reporter.generate_summary_json(
            plan, result, suggestions
        )

        assert output_path.exists()
        import json
        with open(output_path, encoding="utf-8") as f:
            summary = json.load(f)

        assert summary["plan_id"] == "PLAN-001"
        assert summary["simulation_success"] is True
        assert summary["warning_count"] == 1
