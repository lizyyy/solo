#!/usr/bin/env python3
import argparse
import json
from datetime import datetime
from pathlib import Path

from models import RecordSource, ProcessingStatus
from scenarios import run_all_scenarios, scenario_1_smooth, scenario_2_temp_substitute, scenario_3_old_caliber
from processor import trace_by_sources, add_history


def print_divider(title: str = ""):
    width = 80
    if title:
        pad = (width - len(title) - 2) // 2
        print("\n" + "=" * pad + f" {title} " + "=" * pad)
    else:
        print("\n" + "=" * width)


def format_history_entry(entry) -> str:
    return f"[{entry.timestamp.strftime('%H:%M:%S')}] {entry.source.value} | {entry.operator} | {entry.action} - {entry.detail}"


def print_scenario_result(result: dict, show_trace: bool = False):
    print_divider(result["name"])
    print(f"记录ID: {result['steps'][0]['record_id']}")
    print(f"最终状态: {result['final_status']}")
    print(f"历史记录条数: {result['history_count']}")
    print()

    for i, step in enumerate(result["steps"], 1):
        print(f"  步骤{i}: {step['step']}")
        for k, v in step.items():
            if k != "step":
                if isinstance(v, list):
                    print(f"    - {k}:")
                    for item in v:
                        if isinstance(item, dict):
                            for ik, iv in item.items():
                                print(f"        * {ik}: {iv}")
                        else:
                            print(f"        * {item}")
                else:
                    print(f"    - {k}: {v}")
        print()

    if show_trace and "reminder" in result:
        print_three_source_trace(result["reminder"])

    reminder = result["reminder"]
    if reminder.split_details:
        print("  【分账明细】")
        for sd in reminder.split_details:
            caliber = "旧口径" if (reminder.contract and reminder.contract.old_caliber) else "标准口径"
            print(f"    - 版本v{sd.version}: 金额={sd.amount}, 比例={sd.split_ratio}, 收款人={sd.payee} ({caliber})")
        print()

    if reminder.conflicts:
        print("  【冲突证据列表】")
        for c in reminder.conflicts:
            print(f"    - {c.field_name}: 接龙='{c.jielong_value}' vs 截图='{c.screenshot_value}'")
            print(f"      {c.description}")
        print()


def print_three_source_trace(reminder):
    print_divider("三段式追溯查询")
    sources = trace_by_sources(reminder)

    print("\n【第一段：排练群接龙来源】")
    if sources[RecordSource.GROUP_JIELONG] or sources[RecordSource.TEMP_SUBSTITUTE]:
        for entry in sources[RecordSource.GROUP_JIELONG] + sources[RecordSource.TEMP_SUBSTITUTE]:
            print(f"  {format_history_entry(entry)}")
    else:
        print("  (无)")

    print("\n【第二段：合同页截图补录】")
    if sources[RecordSource.CONTRACT_SCREENSHOT]:
        for entry in sources[RecordSource.CONTRACT_SCREENSHOT]:
            print(f"  {format_history_entry(entry)}")
    else:
        print("  (无)")

    print("\n【第三段：人工确认/票务复核】")
    if sources[RecordSource.MANUAL_CONFIRM]:
        for entry in sources[RecordSource.MANUAL_CONFIRM]:
            print(f"  {format_history_entry(entry)}")
    else:
        print("  (无)")
    print()


def print_replay_commands(result: dict):
    print_divider("可重新跑的命令")
    scenario_map = {
        "场景一：顺利记录（正常流程）": "run --scenario smooth",
        "场景二：临时替补（待票务复核）": "run --scenario temp",
        "场景三：旧口径补录（合同截图补录）": "run --scenario old",
    }
    cmd = scenario_map.get(result["name"], "run --all")
    print(f"  重跑此场景: python main.py {cmd}")
    print(f"  带追溯详情: python main.py {cmd} --trace")
    print(f"  导出复盘记录: python main.py {cmd} --export replay_{result['steps'][0]['record_id']}.json")


def export_to_json(result: dict, filepath: str):
    export_data = {
        "scenario_name": result["name"],
        "export_time": datetime.now().isoformat(),
        "final_status": result["final_status"],
        "steps": result["steps"],
        "reminder": {
            "record_id": result["reminder"].record_id,
            "performer_name": result["reminder"].performer_name,
            "performance_date": result["reminder"].performance_date,
            "program_name": result["reminder"].program_name,
            "status": result["reminder"].status.value,
            "review_note": result["reminder"].review_note,
            "split_details": [
                {
                    "detail_id": sd.detail_id,
                    "amount": sd.amount,
                    "split_ratio": sd.split_ratio,
                    "payee": sd.payee,
                    "version": sd.version,
                }
                for sd in result["reminder"].split_details
            ],
            "conflicts": [
                {
                    "field_name": c.field_name,
                    "jielong_value": c.jielong_value,
                    "screenshot_value": c.screenshot_value,
                    "description": c.description,
                }
                for c in result["reminder"].conflicts
            ],
            "history": [
                {
                    "entry_id": h.entry_id,
                    "source": h.source.value,
                    "action": h.action,
                    "operator": h.operator,
                    "timestamp": h.timestamp.isoformat(),
                    "detail": h.detail,
                }
                for h in result["reminder"].history
            ],
        },
        "replay_commands": {
            "replay": f"python main.py run --scenario smooth",
            "replay_with_trace": f"python main.py run --scenario smooth --trace",
        },
    }

    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    print(f"\n复盘记录已导出至: {filepath}")


def main():
    parser = argparse.ArgumentParser(description="版权到期二次提醒 - 业务流程系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    run_parser = subparsers.add_parser("run", help="运行场景")
    run_parser.add_argument("--scenario", choices=["smooth", "temp", "old", "all"], default="all",
                           help="选择运行场景: smooth=顺利, temp=临时替补, old=旧口径, all=全部")
    run_parser.add_argument("--trace", action="store_true", help="显示三段式追溯")
    run_parser.add_argument("--export", type=str, help="导出复盘记录到JSON文件")

    subparsers.add_parser("list", help="列出所有可用场景")

    args = parser.parse_args()

    if args.command == "list":
        print_divider("可用场景列表")
        print("  smooth  - 场景一：顺利记录（正常流程）")
        print("  temp    - 场景二：临时替补（待票务复核）")
        print("  old     - 场景三：旧口径补录（合同截图补录）")
        print("  all     - 运行全部场景（默认）")
        print()
        print("示例:")
        print("  python main.py run --scenario smooth")
        print("  python main.py run --scenario temp --trace")
        print("  python main.py run --scenario old --export report.json")
        return

    if args.command == "run" or args.command is None:
        scenarios_map = {
            "smooth": [scenario_1_smooth],
            "temp": [scenario_2_temp_substitute],
            "old": [scenario_3_old_caliber],
            "all": [scenario_1_smooth, scenario_2_temp_substitute, scenario_3_old_caliber],
        }
        scenario_funcs = scenarios_map.get(args.scenario, scenarios_map["all"])

        print_divider("版权到期二次提醒 - 处理流程")
        print(f"运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"场景数量: {len(scenario_funcs)}")

        all_results = []
        for func in scenario_funcs:
            result = func()
            all_results.append(result)
            print_scenario_result(result, show_trace=args.trace)
            if args.trace:
                print_replay_commands(result)

        if len(all_results) == 1 and args.export:
            export_to_json(all_results[0], args.export)

        print_divider("处理结果汇总")
        for r in all_results:
            print(f"  {r['name']:40s} -> {r['final_status']} (历史{r['history_count']}条)")
        print()

        print("提示: 第二天复查时可运行:")
        print("  python main.py run --scenario temp --trace  # 按三段追溯临时替补记录")
        print()
        return

    parser.print_help()


if __name__ == "__main__":
    main()
