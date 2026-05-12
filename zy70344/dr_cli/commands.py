import click
import uuid
from datetime import datetime
from typing import List, Optional

from .models import (
    DrPlan, ExecutionState, StepExecution, StepStatus, SwitchStatus
)
from .rules import RuleEngine
from .utils import (
    clear_state, create_new_state, format_duration, get_service_by_id,
    load_plan, load_state, print_error, print_info, print_skip,
    print_step_header, print_success, print_warning, save_state, step_already_executed
)


class DrCli:
    def __init__(self, plan_path: str, state_dir: str = ".", fail_verify_rule: str = None):
        self.plan_path = plan_path
        self.state_dir = state_dir
        self.plan = load_plan(plan_path)
        self.rule_engine = RuleEngine(fail_on_verify_rule_id=fail_verify_rule)

    def _get_or_create_state(self, force_new: bool = False) -> ExecutionState:
        if force_new:
            clear_state(self.state_dir)
            state = create_new_state(self.plan)
            save_state(state, self.state_dir)
            return state

        existing = load_state(self.state_dir)
        if existing:
            if existing.plan_name != self.plan.name:
                print_warning(f"检测到不同的演练计划，使用新计划: {self.plan.name}")
                clear_state(self.state_dir)
                state = create_new_state(self.plan)
                save_state(state, self.state_dir)
                return state
            return existing

        state = create_new_state(self.plan)
        save_state(state, self.state_dir)
        return state

    def _get_step_by_type(self, state: ExecutionState, step_type: str) -> List[StepExecution]:
        return [s for s in state.steps if s.step_type == step_type]

    def _confirm_human_skip(self, step_name: str) -> Optional[str]:
        print_warning(f"步骤可能需要人工确认...")
        try:
            skip = click.confirm(f"是否要跳过步骤: {step_name}?", default=False)
            if skip:
                reason = click.prompt("请输入跳过原因", type=str)
                return reason
            return None
        except click.Abort:
            return None

    def precheck(self, force: bool = False):
        state = self._get_or_create_state(force_new=force)
        print_step_header(f"开始前置检查 - 计划: {self.plan.name}")
        print_info(f"运行ID: {state.run_id}")
        print_info(f"开始时间: {state.started_at.strftime('%Y-%m-%d %H:%M:%S')}")

        if state.current_status not in [
            SwitchStatus.NOT_STARTED,
            SwitchStatus.PRECHECK_FAILED,
        ]:
            if state.current_status == SwitchStatus.READY_TO_SWITCH:
                print_warning("前置检查已通过，可以执行 switch")
                return True
            print_warning(f"当前状态不允许执行 precheck: {state.current_status.value}")
            return False

        state.current_status = SwitchStatus.PRECHECKING
        save_state(state, self.state_dir)

        all_passed = True
        blocking_failed = False

        for rule in self.plan.precheck_rules:
            service = None
            if rule.service_id:
                service = get_service_by_id(state, rule.service_id)
                if not service:
                    print_warning(f"服务不存在: {rule.service_id}")
                    continue

            if step_already_executed(state, "precheck", rule.id):
                print_info(f"跳过已执行的检查: {rule.name}")
                continue

            service_name = service.name if service else "全局"
            print_info(f"执行检查 [{rule.name}] - {service_name}")

            step = self.rule_engine.execute_precheck(state, rule, service)
            state.steps.append(step)

            if step.status == StepStatus.PASSED:
                print_success(f"{rule.name} - 通过 ({format_duration(step.duration_seconds)})")
            elif step.status == StepStatus.FAILED:
                print_error(f"{rule.name} - 失败: {step.error_message}")
                all_passed = False
                if rule.is_blocking:
                    blocking_failed = True
                    print_error("此检查为阻断性检查，停止后续检查")

            save_state(state, self.state_dir)

            if blocking_failed:
                break

        if all_passed:
            state.current_status = SwitchStatus.READY_TO_SWITCH
            print_success("所有前置检查通过，可以执行切换")
        else:
            state.current_status = SwitchStatus.PRECHECK_FAILED
            print_error("部分前置检查失败，请修复后重试或人工确认")

        save_state(state, self.state_dir)
        return all_passed

    def switch(self):
        state = self._get_or_create_state()
        print_step_header("开始执行服务切换")

        if state.current_status == SwitchStatus.SWITCHED:
            print_warning("服务已切换，无法重复执行")
            return False

        if state.current_status not in [
            SwitchStatus.READY_TO_SWITCH,
            SwitchStatus.SWITCHED,
        ]:
            print_error(f"当前状态不允许执行 switch: {state.current_status.value}")
            print_error("请先执行 precheck")
            return False

        state.current_status = SwitchStatus.SWITCHING
        save_state(state, self.state_dir)

        for service in state.services:
            if service.status == "secondary":
                print_info(f"服务 {service.name} 已在备站，跳过")
                continue

            print_info(f"正在切换服务: {service.name}")
            step = self.rule_engine.execute_switch(state, service)
            state.steps.append(step)

            if step.status == StepStatus.PASSED:
                print_success(f"服务 {service.name} 切换完成 ({format_duration(step.duration_seconds)})")
                print_info(f"  目标端点: {step.details.get('endpoint')}")
            else:
                print_error(f"服务 {service.name} 切换失败: {step.error_message}")

            save_state(state, self.state_dir)

        state.current_status = SwitchStatus.SWITCHED
        save_state(state, self.state_dir)

        print_success("所有服务切换完成")
        print_info("请执行 verify 进行验证")
        return True

    def verify(self, skip_rules: List[str] = None):
        state = self._get_or_create_state()
        print_step_header("开始执行服务验证")

        if state.current_status not in [
            SwitchStatus.SWITCHED,
            SwitchStatus.VERIFY_FAILED,
        ]:
            print_error(f"当前状态不允许执行 verify: {state.current_status.value}")
            return False

        state.current_status = SwitchStatus.VERIFYING
        save_state(state, self.state_dir)

        all_passed = True

        for rule in self.plan.verify_rules:
            service = get_service_by_id(state, rule.service_id)
            if not service:
                print_warning(f"服务不存在: {rule.service_id}")
                continue

            if step_already_executed(state, "verify", rule.id):
                print_info(f"跳过已执行的验证: {rule.name}")
                continue

            if skip_rules and rule.id in skip_rules:
                skip_reason = self._confirm_human_skip(rule.name)
                if skip_reason:
                    step = StepExecution(
                        id=str(uuid.uuid4())[:8],
                        name=rule.name,
                        step_type="verify",
                        service_id=service.id,
                        rule_id=rule.id,
                        status=StepStatus.SKIPPED,
                        started_at=datetime.now(),
                        completed_at=datetime.now(),
                        skip_reason=skip_reason,
                    )
                    state.steps.append(step)
                    state.human_interventions.append(f"人工跳过: {rule.name} - {skip_reason}")
                    print_skip(rule.name, skip_reason)
                    save_state(state, self.state_dir)
                    continue

            print_info(f"验证 [{rule.name}] - {service.name}")
            step = self.rule_engine.execute_verify(state, rule, service)
            state.steps.append(step)

            if step.status == StepStatus.PASSED:
                print_success(f"{rule.name} - 通过 ({format_duration(step.duration_seconds)})")
            elif step.status == StepStatus.FAILED:
                print_error(f"{rule.name} - 失败: {step.error_message}")
                all_passed = False
                if rule.is_blocking:
                    print_error("此验证为阻断性检查，停止后续验证")
                    print_warning("建议执行 rollback 回切")
                    state.current_status = SwitchStatus.VERIFY_FAILED
                    save_state(state, self.state_dir)
                    return False

            save_state(state, self.state_dir)

        if all_passed:
            state.current_status = SwitchStatus.COMPLETED
            state.completed_at = datetime.now()
            print_success("所有验证通过，演练成功!")
        else:
            state.current_status = SwitchStatus.VERIFY_FAILED

        save_state(state, self.state_dir)
        return all_passed

    def rollback(self):
        state = self._get_or_create_state()
        print_step_header("开始执行回切操作")

        if state.current_status not in [
            SwitchStatus.SWITCHED,
            SwitchStatus.VERIFY_FAILED,
            SwitchStatus.COMPLETED,
        ]:
            print_error(f"当前状态不允许执行 rollback: {state.current_status.value}")
            return False

        if self.plan.require_sync_before_rollback:
            print_info("检查数据同步状态...")
            all_synced = True
            for service in state.services:
                sync = self.rule_engine.check_sync_status(state, service)
                state.sync_statuses = [s for s in state.sync_statuses if s.service_id != service.id]
                state.sync_statuses.append(sync)
                if sync.is_synced:
                    print_success(f"{service.name}: 已同步 (延迟 {sync.lag_seconds}s)")
                else:
                    print_warning(f"{service.name}: 未同步 (延迟 {sync.lag_seconds}s)")
                    all_synced = False

            save_state(state, self.state_dir)

            if not all_synced:
                confirm = click.confirm("部分服务数据未同步，是否确认继续回切？", default=False)
                if not confirm:
                    print_warning("回切操作已取消")
                    return False

        state.current_status = SwitchStatus.ROLLING_BACK
        save_state(state, self.state_dir)

        for service in state.services:
            if service.status == "primary":
                print_info(f"服务 {service.name} 已在主站，跳过")
                continue

            print_info(f"正在回切服务: {service.name}")
            step = self.rule_engine.execute_switch(state, service)
            state.steps.append(step)

            if step.status == StepStatus.PASSED:
                print_success(f"服务 {service.name} 回切完成 ({format_duration(step.duration_seconds)})")
            else:
                print_error(f"服务 {service.name} 回切失败: {step.error_message}")

            save_state(state, self.state_dir)

        state.current_status = SwitchStatus.ROLLED_BACK
        state.completed_at = datetime.now()
        save_state(state, self.state_dir)

        print_success("所有服务回切完成")
        return True
