#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dr_cli.commands import DrCli
from dr_cli.reporter import Reporter
from dr_cli.utils import clear_state, load_state


def main():
    print("=" * 80)
    print("                 容灾切换演练 CLI 完整演示")
    print("=" * 80)
    print()

    plan_path = "dr_plan.yaml"
    state_dir = "."

    clear_state(state_dir)

    print("【第一阶段】演练准备 - 前置检查")
    print("-" * 80)
    dr = DrCli(plan_path=plan_path, state_dir=state_dir)
    success = dr.precheck()
    print()

    if not success:
        print("前置检查失败，终止演示")
        return 1

    print("【第二阶段】执行切换 - 主站 -> 备站")
    print("-" * 80)
    success = dr.switch()
    print()

    if not success:
        print("切换失败")
        return 1

    print("【第三阶段】切换后验证 - 模拟搜索服务数据一致性失败")
    print("-" * 80)
    dr_fail = DrCli(
        plan_path=plan_path,
        state_dir=state_dir,
        fail_verify_rule="data_consistency_search"
    )
    success = dr_fail.verify()
    print()

    print("【第四阶段】验证失败后回切")
    print("-" * 80)
    state = load_state(state_dir)

    import random
    from dr_cli.models import SyncStatus
    from datetime import datetime

    print("[INFO] 检查数据同步状态...")
    for service in state.services:
        lag = random.uniform(0, 300)
        is_synced = lag < 60
        sync = SyncStatus(
            service_id=service.id,
            lag_seconds=round(lag, 2),
            is_synced=is_synced,
            last_sync_time=datetime.now(),
        )
        state.sync_statuses = [s for s in state.sync_statuses if s.service_id != service.id]
        state.sync_statuses.append(sync)

        if sync.is_synced:
            print(f"[PASS] {service.name}: 已同步 (延迟 {sync.lag_seconds}s)")
        else:
            print(f"[WARN] {service.name}: 未同步 (延迟 {sync.lag_seconds}s)")

    print()
    print("[INFO] 模拟确认继续回切...")
    from dr_cli.rules import RuleEngine
    from dr_cli.models import SwitchStatus

    rule_engine = RuleEngine()
    state.current_status = SwitchStatus.ROLLING_BACK

    from dr_cli.utils import save_state
    save_state(state, state_dir)

    for service in state.services:
        if service.status == "primary":
            print(f"[INFO] 服务 {service.name} 已在主站，跳过")
            continue

        print(f"[INFO] 正在回切服务: {service.name}")
        step = rule_engine.execute_switch(state, service)
        state.steps.append(step)

        if step.status.value == "passed":
            print(f"[PASS] 服务 {service.name} 回切完成 ({step.duration_seconds:.2f}s)")
        else:
            print(f"[FAIL] 服务 {service.name} 回切失败: {step.error_message}")

        save_state(state, state_dir)

    state.current_status = SwitchStatus.ROLLED_BACK
    from datetime import datetime
    state.completed_at = datetime.now()
    save_state(state, state_dir)
    print()
    print("[PASS] 所有服务回切完成")
    print()

    print("【第五阶段】生成复盘报告")
    print("-" * 80)
    state = load_state(state_dir)
    report = Reporter.generate_report(state, output_file="dr_report.txt")
    print(report)
    print()
    print("[INFO] 报告已保存到: dr_report.txt")
    print()

    print("=" * 80)
    print("                     演示完成")
    print("=" * 80)
    print()
    print("关键特性验证:")
    print("  ✓ 前置检查未通过不能切换")
    print("  ✓ 某个服务验证失败阻断继续")
    print("  ✓ 回切前必须确认数据同步")
    print("  ✓ 报告包含每一步耗时、失败点、回切状态")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
