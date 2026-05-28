#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基金申赎排队模型 - 模拟脚本
用于模拟巨额赎回时的排队和比例确认
"""

import sys
from datetime import datetime, date

from models import (
    FundPool, ConfirmationRule, CustomerLevel,
    ApplicationType
)
from calendar_utils import CalendarManager
from simulator import FundRedemptionSimulator, ScenarioSimulator


def demo_mass_redemption():
    """演示巨额赎回场景"""
    print("=" * 60)
    print("【场景1】巨额赎回模拟")
    print("=" * 60)

    scenario_sim = ScenarioSimulator()
    scenario = scenario_sim.create_mass_redemption_scenario()
    
    print(f"\n场景描述：{scenario['description']}")
    print(f"基金总资产：{scenario['simulator'].fund_pool.total_asset:,.2f} 元")
    print(f"巨额赎回阈值：{scenario['simulator'].fund_pool.mass_redemption_ratio*100:.1f}%")
    print(f"申请笔数：{len(scenario['applications'])} 笔")
    print(f"总申请金额：{sum(a.amount for a in scenario['applications']):,.2f} 元")

    result = scenario['simulator'].run_simulation(
        "巨额赎回模拟演示",
        scenario['applications']
    )

    print(f"\n处理结果：")
    print(f"  - 全额确认：{result.confirmed_count} 笔")
    print(f"  - 部分确认：{result.partial_confirmed_count} 笔")
    print(f"  - 申请被拒：{result.rejected_count} 笔")

    reports = scenario['simulator'].export_reports(result)
    print(f"\n报告已生成：")
    for fmt, path in reports.items():
        print(f"  - {fmt.upper()}: {path}")

    print("\n各申请明细：")
    for app in result.applications:
        print(f"  [{app.queue_position:2d}] {app.customer_name:12s} "
              f"{app.customer_level.value:12s} "
              f"申请:{app.amount:>12,.2f} "
              f"确认:{app.confirmed_amount:>12,.2f} "
              f"({app.confirm_ratio*100:6.2f}%) "
              f"{app.status.value}")


def demo_holiday_scenario():
    """演示节假日漏算场景"""
    print("\n" + "=" * 60)
    print("【场景2】节假日漏算对比")
    print("=" * 60)

    scenario_sim = ScenarioSimulator()
    comparison = scenario_sim.run_scenario_comparison(
        scenario_sim.create_holiday_missing_scenario,
        "节假日漏算测试"
    )

    print(f"\n场景描述：{comparison['scenario_description']}")
    print(f"差异数量：{comparison['comparison']['total_differences']}")

    print("\n对比明细：")
    for diff in comparison['comparison']['details']:
        print(f"\n  客户：{diff['customer']}")
        print(f"    正确配置 - 比例：{diff['correct_ratio']} 队列：{diff['correct_queue']}")
        print(f"    错误配置 - 比例：{diff['wrong_ratio']} 队列：{diff['wrong_queue']}")
        print(f"    正确解释：{diff['correct_explanation']}")
        print(f"    错误解释：{diff['wrong_explanation']}")

    print(f"\n复盘步骤：")
    for step in comparison['comparison']['replay_steps']:
        print(f"  {step}")


def demo_ratio_error_scenario():
    """演示比例确认错误场景"""
    print("\n" + "=" * 60)
    print("【场景3】比例确认错误对比")
    print("=" * 60)

    scenario_sim = ScenarioSimulator()
    comparison = scenario_sim.run_scenario_comparison(
        scenario_sim.create_ratio_calculation_error_scenario,
        "比例确认测试"
    )

    print(f"\n场景描述：{comparison['scenario_description']}")
    print(f"差异数量：{comparison['comparison']['total_differences']}")

    print("\n对比明细：")
    for diff in comparison['comparison']['details']:
        print(f"\n  客户：{diff['customer']}")
        print(f"    正确比例：{diff['correct_ratio']} vs 错误比例：{diff['wrong_ratio']}")

    print(f"\n复盘步骤：")
    for step in comparison['comparison']['replay_steps']:
        print(f"  {step}")


def demo_level_abuse_scenario():
    """演示客户等级越权场景"""
    print("\n" + "=" * 60)
    print("【场景4】客户等级越权对比")
    print("=" * 60)

    scenario_sim = ScenarioSimulator()
    comparison = scenario_sim.run_scenario_comparison(
        scenario_sim.create_customer_level_abuse_scenario,
        "客户等级测试"
    )

    print(f"\n场景描述：{comparison['scenario_description']}")
    print(f"差异数量：{comparison['comparison']['total_differences']}")

    print("\n队列顺序对比（数字越小优先级越高）：")
    for diff in comparison['comparison']['details']:
        print(f"  {diff['customer']:15s} - 正确队列:{diff['correct_queue']:2d} "
              f"vs 越权队列:{diff['wrong_queue']:2d}")

    print(f"\n复盘步骤：")
    for step in comparison['comparison']['replay_steps']:
        print(f"  {step}")


def custom_simulation():
    """自定义模拟"""
    print("\n" + "=" * 60)
    print("【自定义模拟】")
    print("=" * 60)

    fund_pool = FundPool(
        fund_id="F001",
        fund_name="自定义测试基金",
        total_shares=5_000_000,
        available_cash=10_000_000,
        total_asset=50_000_000,
        daily_redeem_limit=10_000_000,
        mass_redemption_ratio=0.10
    )

    rule = ConfirmationRule(
        rule_id="R001",
        rule_name="标准规则"
    )

    calendar_manager = CalendarManager()
    calendar = calendar_manager.get_calendar(2026)

    simulator = FundRedemptionSimulator(fund_pool, rule, calendar)

    applications = []
    base_time = datetime(2026, 6, 1, 9, 30, 0)

    print("\n输入申请数据（输入'q'结束）：")
    while True:
        try:
            print("\n新申请：")
            customer_name = input("  客户名称：").strip()
            if customer_name.lower() == 'q':
                break
            
            level_input = input("  客户等级(1=普通,2=VIP,3=SVIP,4=机构)：").strip()
            level_map = {
                '1': CustomerLevel.NORMAL,
                '2': CustomerLevel.VIP,
                '3': CustomerLevel.SVIP,
                '4': CustomerLevel.INSTITUTION
            }
            customer_level = level_map.get(level_input, CustomerLevel.NORMAL)

            amount = float(input("  赎回金额：").strip())
            minutes_offset = int(input("  提交时间偏移（分钟）：").strip())

            applications.append(simulator.create_application(
                f"C{len(applications)+1:03d}",
                customer_name,
                customer_level,
                ApplicationType.REDEEM,
                amount,
                base_time
            ))

            print(f"  已添加：{customer_name} - {amount:,.2f}元")
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"  输入错误：{e}")
            continue

    if applications:
        result = simulator.run_simulation("自定义模拟", applications)
        print(f"\n模拟完成，结果：")
        print(f"  总申请：{result.total_applications}")
        print(f"  全额确认：{result.confirmed_count}")
        print(f"  部分确认：{result.partial_confirmed_count}")
        print(f"  被拒：{result.rejected_count}")

        reports = simulator.export_reports(result)
        print(f"\n报告：")
        for fmt, path in reports.items():
            print(f"  {fmt}: {path}")
    else:
        print("未添加任何申请")


def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 15 + "基金申赎排队模型模拟系统" + " " * 17 + "║")
    print("╚" + "═" * 58 + "╝")

    while True:
        print("\n" + "─" * 60)
        print("请选择模拟场景：")
        print("  1. 巨额赎回场景演示")
        print("  2. 节假日漏算对比")
        print("  3. 比例确认错误对比")
        print("  4. 客户等级越权对比")
        print("  5. 运行全部演示")
        print("  6. 自定义模拟")
        print("  0. 退出")
        print("─" * 60)

        choice = input("\n请输入选项 (0-6): ").strip()

        if choice == '1':
            demo_mass_redemption()
        elif choice == '2':
            demo_holiday_scenario()
        elif choice == '3':
            demo_ratio_error_scenario()
        elif choice == '4':
            demo_level_abuse_scenario()
        elif choice == '5':
            demo_mass_redemption()
            demo_holiday_scenario()
            demo_ratio_error_scenario()
            demo_level_abuse_scenario()
            print("\n" + "=" * 60)
            print("全部演示完成！请查看reports目录下的报告文件。")
            print("=" * 60)
        elif choice == '6':
            custom_simulation()
        elif choice == '0':
            print("\n感谢使用，再见！")
            sys.exit(0)
        else:
            print("无效选项，请重新选择！")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n程序已中断，再见！")
        sys.exit(0)
