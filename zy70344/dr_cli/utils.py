import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml
from colorama import Fore, Style

from .models import (
    DrPlan, ExecutionState, PrecheckRule, Service,
    StepExecution, StepStatus, SwitchStatus, SyncStatus, VerifyRule
)


STATE_FILE = ".dr_state.json"


def format_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.2f}s"
    minutes = seconds / 60
    if minutes < 60:
        return f"{minutes:.2f}m"
    hours = minutes / 60
    return f"{hours:.2f}h"


def print_step_header(text: str):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")


def print_info(text: str):
    print(f"{Fore.CYAN}[INFO]{Style.RESET_ALL} {text}")


def print_success(text: str):
    print(f"{Fore.GREEN}[PASS]{Style.RESET_ALL} {text}")


def print_warning(text: str):
    print(f"{Fore.YELLOW}[WARN]{Style.RESET_ALL} {text}")


def print_error(text: str):
    print(f"{Fore.RED}[FAIL]{Style.RESET_ALL} {text}")


def print_skip(text: str, reason: str):
    print(f"{Fore.MAGENTA}[SKIP]{Style.RESET_ALL} {text} (原因: {reason})")


def load_plan(plan_path: str) -> DrPlan:
    path = Path(plan_path)
    if not path.exists():
        raise FileNotFoundError(f"演练计划文件不存在: {plan_path}")

    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    services = [
        Service(
            id=s["id"],
            name=s["name"],
            primary_endpoint=s["primary_endpoint"],
            secondary_endpoint=s["secondary_endpoint"],
            status=s.get("status", "primary"),
            health_check_url=s.get("health_check_url"),
            database=s.get("database"),
        )
        for s in data.get("services", [])
    ]

    precheck_rules = [
        PrecheckRule(
            id=r["id"],
            name=r["name"],
            service_id=r.get("service_id"),
            description=r.get("description", ""),
            is_blocking=r.get("is_blocking", True),
        )
        for r in data.get("precheck_rules", [])
    ]

    verify_rules = [
        VerifyRule(
            id=r["id"],
            name=r["name"],
            service_id=r["service_id"],
            description=r.get("description", ""),
            is_blocking=r.get("is_blocking", True),
        )
        for r in data.get("verify_rules", [])
    ]

    return DrPlan(
        name=data["name"],
        version=data.get("version", "1.0"),
        description=data.get("description", ""),
        services=services,
        precheck_rules=precheck_rules,
        verify_rules=verify_rules,
        require_sync_before_rollback=data.get("require_sync_before_rollback", True),
    )


def save_state(state: ExecutionState, state_dir: str = "."):
    path = Path(state_dir) / STATE_FILE
    data = {
        "run_id": state.run_id,
        "plan_name": state.plan_name,
        "started_at": state.started_at.isoformat(),
        "current_status": state.current_status.value,
        "steps": [
            {
                "id": s.id,
                "name": s.name,
                "step_type": s.step_type,
                "service_id": s.service_id,
                "rule_id": s.rule_id,
                "status": s.status.value,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                "duration_seconds": s.duration_seconds,
                "error_message": s.error_message,
                "skip_reason": s.skip_reason,
                "details": s.details,
            }
            for s in state.steps
        ],
        "services": [
            {
                "id": s.id,
                "name": s.name,
                "primary_endpoint": s.primary_endpoint,
                "secondary_endpoint": s.secondary_endpoint,
                "status": s.status,
                "health_check_url": s.health_check_url,
                "database": s.database,
            }
            for s in state.services
        ],
        "sync_statuses": [
            {
                "service_id": s.service_id,
                "lag_seconds": s.lag_seconds,
                "is_synced": s.is_synced,
                "last_sync_time": s.last_sync_time.isoformat() if s.last_sync_time else None,
            }
            for s in state.sync_statuses
        ],
        "human_interventions": state.human_interventions,
        "completed_at": state.completed_at.isoformat() if state.completed_at else None,
    }

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_state(state_dir: str = ".") -> Optional[ExecutionState]:
    path = Path(state_dir) / STATE_FILE
    if not path.exists():
        return None

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return ExecutionState(
        run_id=data["run_id"],
        plan_name=data["plan_name"],
        started_at=datetime.fromisoformat(data["started_at"]),
        current_status=SwitchStatus(data["current_status"]),
        steps=[
            StepExecution(
                id=s["id"],
                name=s["name"],
                step_type=s["step_type"],
                service_id=s["service_id"],
                rule_id=s["rule_id"],
                status=StepStatus(s["status"]),
                started_at=datetime.fromisoformat(s["started_at"]) if s["started_at"] else None,
                completed_at=datetime.fromisoformat(s["completed_at"]) if s["completed_at"] else None,
                duration_seconds=s["duration_seconds"],
                error_message=s["error_message"],
                skip_reason=s["skip_reason"],
                details=s.get("details", {}),
            )
            for s in data["steps"]
        ],
        services=[
            Service(
                id=s["id"],
                name=s["name"],
                primary_endpoint=s["primary_endpoint"],
                secondary_endpoint=s["secondary_endpoint"],
                status=s["status"],
                health_check_url=s.get("health_check_url"),
                database=s.get("database"),
            )
            for s in data.get("services", [])
        ],
        sync_statuses=[
            SyncStatus(
                service_id=s["service_id"],
                lag_seconds=s["lag_seconds"],
                is_synced=s["is_synced"],
                last_sync_time=datetime.fromisoformat(s["last_sync_time"]) if s.get("last_sync_time") else None,
            )
            for s in data.get("sync_statuses", [])
        ],
        human_interventions=data.get("human_interventions", []),
        completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
    )


def clear_state(state_dir: str = "."):
    path = Path(state_dir) / STATE_FILE
    if path.exists():
        path.unlink()


def create_new_state(plan: DrPlan) -> ExecutionState:
    return ExecutionState(
        run_id=str(uuid.uuid4())[:8],
        plan_name=plan.name,
        started_at=datetime.now(),
        current_status=SwitchStatus.NOT_STARTED,
        services=[Service(**s.__dict__) for s in plan.services],
    )


def step_already_executed(state: ExecutionState, step_type: str, rule_id: Optional[str] = None) -> bool:
    for step in state.steps:
        if step.step_type == step_type and step.rule_id == rule_id:
            return step.status in [StepStatus.PASSED, StepStatus.SKIPPED, StepStatus.FAILED]
    return False


def get_service_by_id(state: ExecutionState, service_id: str) -> Optional[Service]:
    for s in state.services:
        if s.id == service_id:
            return s
    return None
