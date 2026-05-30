from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

from .importer import DataImporter
from .engine import AuditEngine
from .withdrawal import WithdrawalService, WithdrawalError
from .reporter import Reporter
from .models import WithdrawalStatus


def print_banner():
    print()
    print("🚗 网约车司机提现审核系统")
    print("═" * 50)
    print()


def print_step(title: str):
    print()
    print(f"▶ {title}")
    print("─" * 50)


def print_success(msg: str):
    print(f"  ✅ {msg}")


def print_warning(msg: str):
    print(f"  ⚠️  {msg}")


def print_error(msg: str):
    print(f"  ❌ {msg}")


def print_info(msg: str):
    print(f"  ℹ️  {msg}")


def run_audit(
    drivers_path: str = "",
    orders_path: str = "",
    rewards_path: str = "",
    fines_path: str = "",
    freezes_path: str = "",
    output_dir: str = "./reports",
):
    print_banner()

    importer = DataImporter()

    print_step("第1步：导入司机账户数据")
    if drivers_path and Path(drivers_path).exists():
        drivers = importer.import_drivers(drivers_path)
        print_success(f"成功导入 {len(drivers)} 位司机账户")
        for d in drivers:
            print_info(f"  {d.display}")
    else:
        print_warning("未提供司机账户数据或文件不存在，跳过")

    print_step("第2步：导入订单收入数据")
    if orders_path and Path(orders_path).exists():
        orders = importer.import_orders(orders_path)
        print_success(f"成功导入 {len(orders)} 条订单收入")
    else:
        print_warning("未提供订单收入数据或文件不存在，跳过")

    print_step("第3步：导入奖励规则数据")
    if rewards_path and Path(rewards_path).exists():
        rewards = importer.import_rewards(rewards_path)
        print_success(f"成功导入 {len(rewards)} 条奖励")
    else:
        print_warning("未提供奖励数据或文件不存在，跳过")

    print_step("第4步：导入罚款单数据")
    if fines_path and Path(fines_path).exists():
        fines = importer.import_fines(fines_path)
        print_success(f"成功导入 {len(fines)} 条罚款")
    else:
        print_warning("未提供罚款数据或文件不存在，跳过")

    print_step("第5步：导入冻结记录数据")
    if freezes_path and Path(freezes_path).exists():
        freezes = importer.import_freezes(freezes_path)
        print_success(f"成功导入 {len(freezes)} 条冻结记录")
    else:
        print_warning("未提供冻结数据或文件不存在，跳过")

    if importer.warnings:
        print_step("数据导入警告")
        for w in importer.warnings:
            print_warning(str(w))

    print_step("第6步：执行余额计算和异常检测")
    engine = AuditEngine(importer)
    report = engine.run_audit()
    print_success("审核计算完成")

    print()
    print(engine.get_audit_summary_text())

    withdrawal_service = WithdrawalService()

    print_step("第7步：处理司机提现申请")
    for item in report.items:
        if item.withdrawable > 0:
            key = f"wd_{item.driver_id}_{report.audit_date}"
            try:
                record = withdrawal_service.request_withdrawal(
                    driver_id=item.driver_id,
                    amount=item.withdrawable,
                    idempotency_key=key,
                    audit_item=item,
                    reviewer="系统自动",
                )
                print()
                print(withdrawal_service.format_withdrawal_result(record, audit_item=item))
            except WithdrawalError as e:
                print_error(f"司机 {item.driver_id} 提现失败: {e}")

    print_step("第8步：导出审核报告")
    reporter = Reporter(report, withdrawal_service.records)
    md_path, json_path = reporter.save_all(output_dir)
    print_success(f"Markdown 报告已保存: {md_path}")
    print_success(f"JSON 报告已保存: {json_path}")

    print()
    print("═" * 50)
    print("🎉 审核流程全部完成！")
    print()
    print("📋 异常记录已包含在上方终端输出和导出报告中，")
    print("   业务同事可直接查看 Markdown 报告了解详情。")
    print()

    return report, withdrawal_service


def run_demo():
    base = Path(__file__).parent.parent / "sample_data"
    run_audit(
        drivers_path=str(base / "drivers.json"),
        orders_path=str(base / "orders.json"),
        rewards_path=str(base / "rewards.json"),
        fines_path=str(base / "fines.json"),
        freezes_path=str(base / "freezes.json"),
        output_dir=str(Path(__file__).parent.parent / "reports"),
    )


if __name__ == "__main__":
    run_demo()
