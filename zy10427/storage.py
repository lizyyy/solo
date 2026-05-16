import json
import os
from dataclasses import asdict
from typing import List, Optional, Dict, Any
from models import (
    RegionEvacuationPlan, TenantBinding, LocalDependency,
    EvacuationStep, ExecutionLog, EvacuationStatus,
    generate_id, current_time
)

STORAGE_DIR = "data"
PLANS_FILE = os.path.join(STORAGE_DIR, "evacuation_plans.json")


def ensure_storage_dir():
    if not os.path.exists(STORAGE_DIR):
        os.makedirs(STORAGE_DIR)


def plan_to_dict(plan: RegionEvacuationPlan) -> Dict[str, Any]:
    return {
        "plan_id": plan.plan_id,
        "region_name": plan.region_name,
        "created_at": plan.created_at,
        "created_by": plan.created_by,
        "status": plan.status.value if isinstance(plan.status, EvacuationStatus) else plan.status,
        "tenant_bindings": [asdict(tb) for tb in plan.tenant_bindings],
        "local_dependencies": [asdict(ld) for ld in plan.local_dependencies],
        "evacuation_steps": [asdict(es) for es in plan.evacuation_steps],
        "execution_logs": [asdict(el) for el in plan.execution_logs],
        "current_step_index": plan.current_step_index,
        "overall_traffic_percentage": plan.overall_traffic_percentage,
        "block_reason": plan.block_reason,
        "updated_at": plan.updated_at,
        "completed_at": plan.completed_at
    }


def dict_to_plan(data: Dict[str, Any]) -> RegionEvacuationPlan:
    return RegionEvacuationPlan(
        plan_id=data["plan_id"],
        region_name=data["region_name"],
        created_at=data["created_at"],
        created_by=data["created_by"],
        status=EvacuationStatus(data["status"]),
        tenant_bindings=[TenantBinding(**tb) for tb in data["tenant_bindings"]],
        local_dependencies=[LocalDependency(**ld) for ld in data["local_dependencies"]],
        evacuation_steps=[EvacuationStep(**es) for es in data["evacuation_steps"]],
        execution_logs=[ExecutionLog(**el) for el in data["execution_logs"]],
        current_step_index=data["current_step_index"],
        overall_traffic_percentage=data["overall_traffic_percentage"],
        block_reason=data.get("block_reason"),
        updated_at=data.get("updated_at"),
        completed_at=data.get("completed_at")
    )


def load_all_plans() -> Dict[str, RegionEvacuationPlan]:
    ensure_storage_dir()
    if not os.path.exists(PLANS_FILE):
        return {}
    with open(PLANS_FILE, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    plans = {}
    for plan_id, plan_data in raw_data.items():
        plans[plan_id] = dict_to_plan(plan_data)
    return plans


def save_all_plans(plans: Dict[str, RegionEvacuationPlan]) -> None:
    ensure_storage_dir()
    raw_data = {}
    for plan_id, plan in plans.items():
        raw_data[plan_id] = plan_to_dict(plan)
    with open(PLANS_FILE, "w", encoding="utf-8") as f:
        json.dump(raw_data, f, indent=2, ensure_ascii=False)


def save_plan(plan: RegionEvacuationPlan) -> None:
    plans = load_all_plans()
    plans[plan.plan_id] = plan
    save_all_plans(plans)


def get_plan(plan_id: str) -> Optional[RegionEvacuationPlan]:
    plans = load_all_plans()
    return plans.get(plan_id)


def get_plans_by_region(region_name: str) -> List[RegionEvacuationPlan]:
    plans = load_all_plans()
    return [p for p in plans.values() if p.region_name == region_name]


def get_all_plans_list() -> List[RegionEvacuationPlan]:
    plans = load_all_plans()
    return list(plans.values())


def delete_plan(plan_id: str) -> bool:
    plans = load_all_plans()
    if plan_id in plans:
        del plans[plan_id]
        save_all_plans(plans)
        return True
    return False


def add_execution_log(plan_id: str, action: str, operator: str,
                      original_input: Dict[str, Any],
                      processing_result: Dict[str, Any],
                      conclusion: str) -> None:
    plan = get_plan(plan_id)
    if plan:
        log = ExecutionLog(
            log_id=generate_id(),
            timestamp=current_time(),
            action=action,
            operator=operator,
            original_input=original_input,
            processing_result=processing_result,
            conclusion=conclusion
        )
        plan.execution_logs.append(log)
        plan.updated_at = current_time()
        save_plan(plan)
