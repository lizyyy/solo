import yaml
from pathlib import Path
from typing import Any, Union

from .models import ChangeStep, ChangePlan, ChangeType


class YAMLReader:
    @staticmethod
    def read_change_plan(yaml_path: Union[str, Path]) -> ChangePlan:
        with open(yaml_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)

        steps = []
        for step_data in data.get("steps", []):
            step = ChangeStep(
                step_id=step_data["step_id"],
                change_type=ChangeType(step_data["change_type"]),
                device_id=step_data["device_id"],
                target_rack_id=step_data.get("target_rack_id"),
                target_u_start=step_data.get("target_u_start"),
                target_u_end=step_data.get("target_u_end"),
                target_switch_port=step_data.get("target_switch_port"),
                target_vlan=step_data.get("target_vlan"),
                notes=step_data.get("notes", ""),
            )
            steps.append(step)

        plan = ChangePlan(
            plan_id=data.get("plan_id", "unknown"),
            description=data.get("description", ""),
            steps=steps,
        )

        return plan

    @staticmethod
    def read_switch_vlan_config(yaml_path: Union[str, Path]) -> dict[str, Any]:
        with open(yaml_path, encoding="utf-8") as f:
            return yaml.safe_load(f)
