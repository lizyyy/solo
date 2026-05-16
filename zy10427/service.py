from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from models import (
    RegionEvacuationPlan, TenantBinding, LocalDependency,
    EvacuationStep, ExecutionSummary, EvacuationStatus, ExecutionResult,
    generate_id, current_time
)
from storage import save_plan, get_plan, add_execution_log, get_all_plans_list


def check_local_dependencies(dependencies: List[LocalDependency]) -> Tuple[bool, List[str]]:
    block_reasons = []
    for dep in dependencies:
        if dep.is_critical and dep.check_status != "PASS":
            block_reasons.append(f"关键依赖[{dep.resource_type}:{dep.resource_name}]检查失败: {dep.detail or '未知原因'}")
    return len(block_reasons) == 0, block_reasons


def check_tenant_dependencies(tenants: List[TenantBinding]) -> Tuple[bool, List[str]]:
    block_reasons = []
    for tenant in tenants:
        if tenant.dependency_check_passed is False:
            block_reasons.append(f"租户[{tenant.tenant_name}]依赖检查失败: {tenant.block_reason or '未知原因'}")
    return len(block_reasons) == 0, block_reasons


def create_evacuation_plan(
    region_name: str,
    created_by: str,
    tenant_bindings: List[Dict[str, Any]],
    local_dependencies: List[Dict[str, Any]],
    target_percentage: float = 0.0
) -> Tuple[Optional[RegionEvacuationPlan], ExecutionResult, str]:
    plan_id = generate_id()
    
    tenants = []
    for tb in tenant_bindings:
        tenant = TenantBinding(
            tenant_id=tb["tenant_id"],
            tenant_name=tb["tenant_name"],
            bind_time=tb.get("bind_time", current_time()),
            local_resources=tb.get("local_resources", []),
            traffic_percentage=tb.get("traffic_percentage", 100.0)
        )
        tenants.append(tenant)
    
    deps = []
    for ld in local_dependencies:
        dep = LocalDependency(
            resource_type=ld["resource_type"],
            resource_name=ld["resource_name"],
            is_critical=ld.get("is_critical", True),
            check_status=ld.get("check_status", "PENDING"),
            detail=ld.get("detail")
        )
        deps.append(dep)
    
    steps = create_evacuation_steps(target_percentage)
    
    plan = RegionEvacuationPlan(
        plan_id=plan_id,
        region_name=region_name,
        created_at=current_time(),
        created_by=created_by,
        status=EvacuationStatus.DRAFT,
        tenant_bindings=tenants,
        local_dependencies=deps,
        evacuation_steps=steps,
        execution_logs=[]
    )
    
    save_plan(plan)
    
    original_input = {
        "region_name": region_name,
        "created_by": created_by,
        "tenant_count": len(tenant_bindings),
        "dependency_count": len(local_dependencies),
        "target_percentage": target_percentage
    }
    add_execution_log(plan_id, "CREATE_PLAN", created_by, original_input, 
                     {"plan_id": plan_id}, "撤离计划创建成功")
    
    return plan, ExecutionResult.SUCCESS, "计划创建成功"


def create_evacuation_steps(target_percentage: float) -> List[EvacuationStep]:
    percentages = [75, 50, 25, 0]
    steps = []
    order = 1
    for pct in percentages:
        if pct >= target_percentage:
            step = EvacuationStep(
                step_id=generate_id(),
                step_order=order,
                target_percentage=pct,
                status="PENDING"
            )
            steps.append(step)
            order += 1
    return steps


def review_plan(plan_id: str, operator: str, approved: bool, 
                reason: str = "") -> Tuple[Optional[RegionEvacuationPlan], ExecutionResult, str]:
    plan = get_plan(plan_id)
    if not plan:
        return None, ExecutionResult.BLOCKED, "计划不存在"
    
    if plan.status not in [EvacuationStatus.DRAFT, EvacuationStatus.PENDING_REVIEW]:
        return plan, ExecutionResult.BLOCKED, f"当前状态[{plan.status}]不支持复核操作"
    
    if approved:
        dep_ok, dep_reasons = check_local_dependencies(plan.local_dependencies)
        tenant_ok, tenant_reasons = check_tenant_dependencies(plan.tenant_bindings)
        
        all_reasons = dep_reasons + tenant_reasons
        if all_reasons:
            plan.status = EvacuationStatus.BLOCKED
            plan.block_reason = "; ".join(all_reasons)
            save_plan(plan)
            add_execution_log(plan_id, "REVIEW_PLAN", operator, 
                             {"approved": approved, "reason": reason},
                             {"block_reasons": all_reasons}, "依赖检查失败，计划被拦截")
            return plan, ExecutionResult.BLOCKED, plan.block_reason
        
        plan.status = EvacuationStatus.IN_PROGRESS
        result_msg = "计划复核通过，进入执行中状态"
        result = ExecutionResult.SUCCESS
    else:
        plan.status = EvacuationStatus.PENDING_REVIEW
        plan.block_reason = reason
        result_msg = f"计划需待复核: {reason}"
        result = ExecutionResult.PENDING_REVIEW
    
    plan.updated_at = current_time()
    save_plan(plan)
    
    add_execution_log(plan_id, "REVIEW_PLAN", operator,
                     {"approved": approved, "reason": reason},
                     {"new_status": plan.status.value}, result_msg)
    
    return plan, result, result_msg


def advance_step(plan_id: str, operator: str, 
                 force: bool = False) -> Tuple[Optional[RegionEvacuationPlan], ExecutionResult, str]:
    plan = get_plan(plan_id)
    if not plan:
        return None, ExecutionResult.BLOCKED, "计划不存在"
    
    if plan.status == EvacuationStatus.COMPLETED:
        return plan, ExecutionResult.SUCCESS, "计划已完成，无需推进"
    
    if plan.status not in [EvacuationStatus.IN_PROGRESS, EvacuationStatus.PARTIAL]:
        return plan, ExecutionResult.BLOCKED, f"当前状态[{plan.status}]不支持推进操作"
    
    if plan.current_step_index >= len(plan.evacuation_steps):
        plan.status = EvacuationStatus.COMPLETED
        plan.completed_at = current_time()
        save_plan(plan)
        add_execution_log(plan_id, "ADVANCE_STEP", operator, {"force": force},
                         {"completed": True}, "所有步骤已执行完毕，撤离完成")
        return plan, ExecutionResult.SUCCESS, "所有步骤已执行完毕"
    
    current_step = plan.evacuation_steps[plan.current_step_index]
    
    if current_step.status == "COMPLETED" and not force:
        plan.current_step_index += 1
        save_plan(plan)
        return advance_step(plan_id, operator, force)
    
    if not force:
        dep_ok, dep_reasons = check_local_dependencies(plan.local_dependencies)
        if not dep_ok:
            plan.status = EvacuationStatus.BLOCKED
            plan.block_reason = "; ".join(dep_reasons)
            save_plan(plan)
            add_execution_log(plan_id, "ADVANCE_STEP", operator, {"force": force},
                             {"block_reasons": dep_reasons}, "依赖检查失败，推进被拦截")
            return plan, ExecutionResult.BLOCKED, plan.block_reason
    
    current_step.status = "EXECUTING"
    current_step.executed_at = current_time()
    
    plan.overall_traffic_percentage = current_step.target_percentage
    
    current_step.status = "COMPLETED"
    current_step.result = "SUCCESS"
    current_step.detail = f"流量已调整至{current_step.target_percentage}%"
    
    plan.current_step_index += 1
    
    if plan.current_step_index >= len(plan.evacuation_steps):
        plan.status = EvacuationStatus.COMPLETED
        plan.completed_at = current_time()
        result_msg = f"流量已成功撤离至目标值，最终流量: {current_step.target_percentage}%"
        result = ExecutionResult.SUCCESS
    else:
        plan.status = EvacuationStatus.PARTIAL
        result_msg = f"步骤{current_step.step_order}执行完成，当前流量: {current_step.target_percentage}%"
        result = ExecutionResult.SUCCESS
    
    plan.updated_at = current_time()
    save_plan(plan)
    
    add_execution_log(plan_id, "ADVANCE_STEP", operator, {"force": force},
                     {"step_index": plan.current_step_index - 1, 
                      "target_percentage": current_step.target_percentage},
                     result_msg)
    
    return plan, result, result_msg


def handle_exception(plan_id: str, operator: str, exception_type: str,
                     exception_detail: str, compensate: bool = False) -> Tuple[Optional[RegionEvacuationPlan], ExecutionResult, str]:
    plan = get_plan(plan_id)
    if not plan:
        return None, ExecutionResult.BLOCKED, "计划不存在"
    
    original_status = plan.status.value
    
    if compensate:
        plan.status = EvacuationStatus.COMPENSATED
        plan.block_reason = f"异常补偿: {exception_type} - {exception_detail}"
        result = ExecutionResult.COMPENSATED
        result_msg = f"已执行异常补偿，原状态[{original_status}]，现状态[COMPENSATED]"
    else:
        plan.status = EvacuationStatus.BLOCKED
        plan.block_reason = f"异常拦截: {exception_type} - {exception_detail}"
        result = ExecutionResult.BLOCKED
        result_msg = f"异常已拦截，原状态[{original_status}]，现状态[BLOCKED]"
    
    plan.updated_at = current_time()
    save_plan(plan)
    
    add_execution_log(plan_id, "HANDLE_EXCEPTION", operator,
                     {"exception_type": exception_type, 
                      "exception_detail": exception_detail,
                      "compensate": compensate},
                     {"original_status": original_status,
                      "new_status": plan.status.value},
                     result_msg)
    
    return plan, result, result_msg


def manual_correct(plan_id: str, operator: str, corrections: Dict[str, Any]) -> Tuple[Optional[RegionEvacuationPlan], ExecutionResult, str]:
    plan = get_plan(plan_id)
    if not plan:
        return None, ExecutionResult.BLOCKED, "计划不存在"
    
    original_status = plan.status.value
    changes_applied = []
    
    if "target_traffic_percentage" in corrections:
        plan.overall_traffic_percentage = corrections["target_traffic_percentage"]
        changes_applied.append(f"流量比例调整为{corrections['target_traffic_percentage']}%")
    
    if "status" in corrections:
        try:
            new_status = EvacuationStatus(corrections["status"])
            plan.status = new_status
            changes_applied.append(f"状态从[{original_status}]调整为[{new_status.value}]")
        except ValueError:
            return plan, ExecutionResult.BLOCKED, f"无效的状态值: {corrections['status']}"
    
    if "block_reason" in corrections:
        plan.block_reason = corrections["block_reason"]
        changes_applied.append("阻塞原因已更新")
    
    if "tenant_dependencies" in corrections:
        for tenant_correction in corrections["tenant_dependencies"]:
            for tenant in plan.tenant_bindings:
                if tenant.tenant_id == tenant_correction["tenant_id"]:
                    tenant.dependency_check_passed = tenant_correction.get("passed", True)
                    tenant.block_reason = tenant_correction.get("reason")
                    changes_applied.append(f"租户[{tenant.tenant_name}]依赖状态已更新")
    
    if "local_dependencies" in corrections:
        for dep_correction in corrections["local_dependencies"]:
            for dep in plan.local_dependencies:
                if (dep.resource_type == dep_correction["resource_type"] and 
                    dep.resource_name == dep_correction["resource_name"]):
                    dep.check_status = dep_correction.get("check_status", "PASS")
                    dep.detail = dep_correction.get("detail")
                    changes_applied.append(f"依赖[{dep.resource_type}:{dep.resource_name}]状态已更新")
    
    if not changes_applied:
        return plan, ExecutionResult.PENDING_REVIEW, "未指定任何修正内容"
    
    plan.updated_at = current_time()
    save_plan(plan)
    
    result_msg = "; ".join(changes_applied)
    add_execution_log(plan_id, "MANUAL_CORRECT", operator,
                     corrections, {"changes": changes_applied}, result_msg)
    
    return plan, ExecutionResult.SUCCESS, result_msg


def generate_execution_summary(plan_id: str) -> Tuple[Optional[ExecutionSummary], ExecutionResult, str]:
    plan = get_plan(plan_id)
    if not plan:
        return None, ExecutionResult.BLOCKED, "计划不存在"
    
    cleared_count = sum(1 for t in plan.tenant_bindings 
                       if t.dependency_check_passed is True or t.dependency_check_passed is None)
    blocked_count = sum(1 for t in plan.tenant_bindings 
                       if t.dependency_check_passed is False)
    
    block_reasons = []
    for t in plan.tenant_bindings:
        if t.block_reason:
            block_reasons.append(f"租户[{t.tenant_name}]: {t.block_reason}")
    if plan.block_reason:
        block_reasons.append(plan.block_reason)
    
    duration = None
    if plan.completed_at and plan.created_at:
        try:
            completed = datetime.fromisoformat(plan.completed_at)
            created = datetime.fromisoformat(plan.created_at)
            duration = int((completed - created).total_seconds())
        except:
            pass
    
    target_pct = 0.0
    if plan.evacuation_steps:
        target_pct = plan.evacuation_steps[-1].target_percentage
    
    summary = ExecutionSummary(
        plan_id=plan.plan_id,
        region_name=plan.region_name,
        total_tenants=len(plan.tenant_bindings),
        affected_tenants=len(plan.tenant_bindings),
        cleared_tenants=cleared_count,
        blocked_tenants=blocked_count,
        initial_traffic=100.0,
        current_traffic=plan.overall_traffic_percentage,
        target_traffic=target_pct,
        status=plan.status.value,
        created_at=plan.created_at,
        completed_at=plan.completed_at,
        duration_seconds=duration,
        block_reasons=block_reasons
    )
    
    return summary, ExecutionResult.SUCCESS, "摘要生成成功"


def list_all_plans() -> List[RegionEvacuationPlan]:
    return get_all_plans_list()


def get_plan_details(plan_id: str) -> Optional[RegionEvacuationPlan]:
    return get_plan(plan_id)
