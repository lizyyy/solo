import argparse
import os
import sys
from .loader import load_inventory, load_vessel_demands, load_truck_slots, load_strategy
from .engine import SimulationEngine, get_strategy_by_name
from .output import write_moves_csv, write_summary_md


def run_simulation(
    inventory_path: str,
    vessels_path: str,
    slots_path: str,
    strategy_path: str,
    output_dir: str,
    strategy_name: str
):
    yards, inventory = load_inventory(inventory_path)
    vessels = load_vessel_demands(vessels_path)
    slots = load_truck_slots(slots_path)
    strategy_config = load_strategy(strategy_path)
    
    strategy = get_strategy_by_name(strategy_name)
    
    engine = SimulationEngine(yards, inventory, vessels, slots, strategy, strategy_config)
    result = engine.run()
    
    os.makedirs(output_dir, exist_ok=True)
    write_moves_csv(result.moves, os.path.join(output_dir, "moves.csv"))
    write_summary_md(result, os.path.join(output_dir, "summary.md"))
    
    print(f"✅ 策略 {strategy_name} 模拟完成！")
    print(f"   - 输出目录: {output_dir}")
    print(f"   - 调箱次数: {len(result.moves)}")
    print(f"   - 风险数: {len(result.risks)}")
    
    return result


def compare_strategies(
    inventory_path: str,
    vessels_path: str,
    slots_path: str,
    strategy_path: str,
    output_dir: str
):
    print("=== 开始对比两种策略 ===")
    
    result1 = run_simulation(
        inventory_path, vessels_path, slots_path, strategy_path,
        os.path.join(output_dir, "nearest_first"), "nearest_first"
    )
    
    result2 = run_simulation(
        inventory_path, vessels_path, slots_path, strategy_path,
        os.path.join(output_dir, "preserve_reefer"), "preserve_reefer"
    )
    
    print("\n=== 策略对比 ===")
    print(f"| 指标 | 就近优先 | 保留冷柜 |")
    print(f"|------|----------|----------|")
    print(f"| 调箱次数 | {len(result1.moves)} | {len(result2.moves)} |")
    print(f"| 总调箱数 | {sum(m.quantity for m in result1.moves)} | {sum(m.quantity for m in result2.moves)} |")
    print(f"| 风险数 | {len(result1.risks)} | {len(result2.risks)} |")


def main():
    parser = argparse.ArgumentParser(
        description="空箱调箱策略模拟工具"
    )
    
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    sim_parser = subparsers.add_parser("sim", help="运行单次模拟")
    sim_parser.add_argument("--inventory", required=True, help="堆场箱量 CSV")
    sim_parser.add_argument("--vessels", required=True, help="船期需求 JSON")
    sim_parser.add_argument("--slots", required=True, help="拖车班次 CSV")
    sim_parser.add_argument("--strategy-config", required=True, help="策略配置 YAML")
    sim_parser.add_argument("--strategy", default="nearest_first", 
                          choices=["nearest_first", "preserve_reefer"],
                          help="策略名称 (默认: nearest_first)")
    sim_parser.add_argument("--output", default="output", help="输出目录 (默认: output)")
    
    comp_parser = subparsers.add_parser("compare", help="对比两种策略")
    comp_parser.add_argument("--inventory", required=True, help="堆场箱量 CSV")
    comp_parser.add_argument("--vessels", required=True, help="船期需求 JSON")
    comp_parser.add_argument("--slots", required=True, help="拖车班次 CSV")
    comp_parser.add_argument("--strategy-config", required=True, help="策略配置 YAML")
    comp_parser.add_argument("--output", default="compare_output", help="输出目录 (默认: compare_output)")
    
    args = parser.parse_args()
    
    if args.command == "sim":
        run_simulation(
            args.inventory, args.vessels, args.slots, args.strategy_config,
            args.output, args.strategy
        )
    elif args.command == "compare":
        compare_strategies(
            args.inventory, args.vessels, args.slots, args.strategy_config,
            args.output
        )


if __name__ == "__main__":
    main()
