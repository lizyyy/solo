#!/usr/bin/env python3
"""设备固件灰度面板 - 演示脚本

运行方式：
    python demo.py              # 运行完整演示
    python demo.py --json       # 只输出JSON报告
    python demo.py --markdown   # 只输出Markdown报告
    python demo.py --replay     # 演示复盘功能
"""

import sys
import json
import argparse
from datetime import datetime

# 确保可以导入包
sys.path.insert(0, "/Users/lzy/pro/solo/workspaces/zy71379")

from iot_firmware_panel import (
    GrayscalePanel,
    Device, DeviceStatus,
    create_mock_upgrade_fn, create_mock_rollback_fn
)


def run_full_demo(save_files: bool = True):
    """运行完整灰度流程演示"""
    print("\n" + "=" * 70)
    print("  IoT 设备固件灰度面板 - 完整流程演示")
    print("=" * 70)
    print()

    # 1. 初始化面板
    panel = GrayscalePanel(
        parallel_per_batch=5,
        failure_threshold=0.3,
        auto_rollback=True
    )
    print("[1/5] 初始化面板完成")
    print(f"  - 每批并行数: 5")
    print(f"  - 失败率阈值: 30%")
    print(f"  - 自动回滚: 开启")
    print()

    # 2. 创建样例设备
    devices = GrayscalePanel.create_sample_devices()
    print(f"[2/5] 加载样例设备 {len(devices)} 台")
    print("  批次分布:")
    batch_count = {}
    for d in devices:
        batch_count[d.original_batch] = batch_count.get(d.original_batch, 0) + 1
    for batch, count in batch_count.items():
        print(f"    - {batch}: {count} 台")
    print()

    # 3. 预演安全检测结果
    print("[3/5] 安全检测预演（将触发待确认的设备）:")
    target_version = "2.0.0"
    for d in devices:
        check = panel.check_device_security(d, target_version)
        if check.needs_confirm:
            reasons = ", ".join([r.value for r in check.reasons])
            status_emoji = "🔴" if d.original_online_status == DeviceStatus.OFFLINE else "🟢"
            print(f"  ⚠️  {d.original_device_id} {status_emoji} "
                  f"{d.original_firmware_version} → {target_version}")
            print(f"     原因: {reasons}")
    print()

    # 4. 执行完整灰度工作流
    print("[4/5] 执行完整灰度工作流...")
    print("  这将执行: 安全检测 → 创建批次 → 升级 → 自动回滚 → 生成报告")
    print()

    result = panel.run_full_workflow(
        devices=devices,
        target_version=target_version,
        task_id=f"DEMO-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        task_name="演示-固件v2.0.0灰度发布",
        tags=["演示", "灰度v2.0"],
        notes="这是一个演示任务，包含各种测试场景"
    )

    print()
    print("[5/5] 生成报告...")
    print()

    # 5. 输出报告
    reports = result["reports"]

    print("-" * 70)
    print("  终端报告")
    print("-" * 70)
    print(reports["terminal"])
    print()

    # 6. 保存报告文件
    if save_files:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_file = f"grayscale_report_{timestamp}.json"
        md_file = f"grayscale_report_{timestamp}.md"

        with open(json_file, "w", encoding="utf-8") as f:
            f.write(reports["json"])
        print(f"📄 JSON报告已保存: {json_file}")

        with open(md_file, "w", encoding="utf-8") as f:
            f.write(reports["markdown"])
        print(f"📄 Markdown报告已保存: {md_file}")
        print()

    # 7. 展示待确认设备
    pending = result["pending_confirm_devices"]
    if pending:
        print("-" * 70)
        print(f"  待确认设备 ({len(pending)}) - 需要人工确认后才能继续")
        print("-" * 70)
        for d in pending:
            reasons = ", ".join([r.value for r in d.processed_confirm_reasons])
            print(f"  • {d.original_device_id} ({d.original_batch}): {reasons}")
        print()

    # 8. 展示失败日志聚合
    log_report = result["log_report"]
    if log_report["failure_summary"]:
        print("-" * 70)
        print("  失败原因聚合")
        print("-" * 70)
        for reason, dev_ids in log_report["failure_summary"].items():
            print(f"  {reason}: {len(dev_ids)} 台 ({', '.join(dev_ids[:5])}"
                  f"{'...' if len(dev_ids) > 5 else ''})")
        print()

    return result["task"].original_task_id


def run_json_only():
    """只输出JSON报告"""
    panel = GrayscalePanel()
    devices = GrayscalePanel.create_sample_devices()

    result = panel.run_full_workflow(
        devices=devices,
        target_version="2.0.0",
        task_id=f"JSON-DEMO-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        task_name="JSON演示任务",
        save_history=False
    )

    # 解析JSON再输出，确保是有效的JSON
    data = json.loads(result["reports"]["json"])
    print(json.dumps({
        "summary": data["summary"],
        "conclusion": data["conclusion"],
        "warnings": data["warnings"],
        "pending_confirm_devices": data["pending_confirm_devices"],
    }, ensure_ascii=False, indent=2))


def run_markdown_only():
    """只输出Markdown报告"""
    panel = GrayscalePanel()
    devices = GrayscalePanel.create_sample_devices()

    result = panel.run_full_workflow(
        devices=devices,
        target_version="2.0.0",
        task_id=f"MD-DEMO-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        task_name="Markdown演示任务",
        save_history=False
    )

    print(result["reports"]["markdown"])


def run_replay_demo():
    """演示复盘功能"""
    print("\n" + "=" * 70)
    print("  复盘功能演示")
    print("=" * 70)
    print()

    # 先运行一个任务并保存
    panel = GrayscalePanel()
    devices = GrayscalePanel.create_sample_devices()

    print("第一步: 运行灰度任务并保存到历史...")
    task_id = f"REPLAY-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    result = panel.run_full_workflow(
        devices=devices,
        target_version="2.0.0",
        task_id=task_id,
        task_name="复盘演示任务",
        save_history=True
    )
    print(f"✓ 任务 {task_id} 已保存")
    print()

    # 列出现有历史
    print("第二步: 查询历史记录...")
    history = panel.list_history()
    print(f"找到 {len(history)} 条历史记录:")
    for h in history[:5]:
        emoji = {"success": "✅", "warning": "⚠️", "error": "❌", "info": "ℹ️"}.get(h.conclusion_level, "•")
        print(f"  {emoji} {h.task_id} - {h.task_name} ({h.created_at.strftime('%Y-%m-%d %H:%M')})")
        print(f"     成功率: {h.success_count}/{h.total_devices}, 待确认: {h.pending_confirm_count}")
    print()

    # 复盘解释
    print("第三步: 复盘 - 解释决策过程...")
    print("-" * 70)
    explanation = panel.explain(task_id)
    if explanation:
        print(explanation)
    print()

    # 复盘 - 重新生成报告
    print("第四步: 复盘 - 重新生成Markdown报告...")
    replay_md = panel.replay(task_id, format_type="markdown")
    if replay_md:
        print("✓ Markdown报告已生成 (前500字符预览):")
        print(replay_md[:500] + "...")
    print()

    print("=" * 70)
    print("  复盘功能演示完成")
    print("=" * 70)
    print()
    print("关键能力:")
    print("  • panel.list_history() - 查询所有历史任务")
    print("  • panel.explain(task_id) - 解释历史决策过程")
    print("  • panel.replay(task_id, format='terminal') - 重新生成终端报告")
    print("  • panel.replay(task_id, format='json') - 重新生成JSON报告")
    print("  • panel.replay(task_id, format='markdown') - 重新生成Markdown报告")
    print("  • panel.compare_tasks(id1, id2) - 对比两个历史任务")
    print()

    return task_id


def run_step_by_step_demo():
    """分步操作演示 - 展示如何人工确认待确认设备"""
    print("\n" + "=" * 70)
    print("  分步操作 + 人工确认演示")
    print("=" * 70)
    print()

    panel = GrayscalePanel(parallel_per_batch=3, auto_rollback=False)
    devices = GrayscalePanel.create_sample_devices()

    # 1. 创建任务
    print("[1/6] 创建任务...")
    task = panel.create_task(
        task_id=f"STEP-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        task_name="分步演示-人工确认",
        target_version="2.0.0",
        description="演示如何分步处理和人工确认"
    )
    print(f"✓ 任务 {task.original_task_id} 已创建")
    print()

    # 2. 添加设备
    print("[2/6] 添加设备并创建批次...")
    batches = panel.add_devices(devices, batch_size=4)
    print(f"✓ 添加 {len(devices)} 台设备，创建 {len(batches)} 个批次")

    pending = panel.get_pending_confirm_devices()
    if pending:
        print(f"  ⚠️  发现 {len(pending)} 个待确认设备:")
        for d in pending:
            reasons = ", ".join([r.value for r in d.processed_confirm_reasons])
            print(f"     • {d.original_device_id}: {reasons}")
    print()

    # 3. 人工确认部分设备
    print("[3/6] 人工确认待确认设备...")
    pending = panel.get_pending_confirm_devices()
    for i, d in enumerate(pending):
        if i % 2 == 0:
            confirmed = True
            action = "确认继续"
        else:
            confirmed = False
            action = "取消(保持待确认)"
        panel.confirm_device(d.original_device_id, confirmed=confirmed)
        print(f"  • {d.original_device_id}: {action}")
    print()

    # 4. 执行升级
    print("[4/6] 执行升级 (3步)...")
    upgrade_fn = create_mock_upgrade_fn(success_rate=0.75)
    for step in range(3):
        result = panel.run_upgrade_step(upgrade_fn)
        pending_count = panel.current_task.processed_total_pending
        print(f"  步骤 {step + 1}: 处理了 {len(result['logs'])} 条日志，"
              f"剩余待处理 {pending_count} 台")
    print()

    # 5. 查看当前状态
    print("[5/6] 生成中期报告...")
    panel.print_report(format_type="terminal")
    print()

    # 6. 手动回滚
    print("[6/6] 手动回滚失败设备...")
    rollback_fn = create_mock_rollback_fn(success_rate=0.9)
    result = panel.run_rollback(rollback_fn, include_success=False)
    print(f"✓ 回滚完成，处理了 {len(result['logs'])} 条日志")
    print()

    # 最终报告
    print("最终报告:")
    panel.print_report(format_type="terminal")

    # 保存历史
    panel.save_current_history(tags=["分步演示", "人工确认"])
    print("✓ 已保存到历史记录")
    print()


def main():
    parser = argparse.ArgumentParser(description="IoT设备固件灰度面板 - 演示脚本")
    parser.add_argument("--json", action="store_true", help="只输出JSON报告")
    parser.add_argument("--markdown", action="store_true", help="只输出Markdown报告")
    parser.add_argument("--replay", action="store_true", help="演示复盘功能")
    parser.add_argument("--step", action="store_true", help="分步操作演示")
    parser.add_argument("--no-save", action="store_true", help="不保存报告文件")
    args = parser.parse_args()

    if args.json:
        run_json_only()
    elif args.markdown:
        run_markdown_only()
    elif args.replay:
        run_replay_demo()
    elif args.step:
        run_step_by_step_demo()
    else:
        task_id = run_full_demo(save_files=not args.no_save)
        print(f"\n💡 提示: 运行 `python demo.py --replay` 查看复盘功能演示")
        print(f"💡 提示: 运行 `python demo.py --step` 查看分步操作演示")
        print(f"💡 任务ID: {task_id}")


if __name__ == "__main__":
    main()
