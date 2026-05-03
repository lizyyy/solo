import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from metro_power_analyzer.parser import (
    parse_protection_csv,
    parse_sampling_jsonl,
    parse_settings_yaml,
    parse_inventory_yaml,
)
from metro_power_analyzer.rules import EventChainBuilder, ProtectionEvaluator
from metro_power_analyzer.exporter import (
    export_events_csv,
    export_review_report,
    export_timeline_html,
)


def get_sample_data_dir() -> str:
    """获取sample数据目录"""
    package_dir = Path(__file__).parent
    sample_dir = package_dir / 'sample_data'
    return str(sample_dir)


def run_analysis(
    protection_csv: Optional[str] = None,
    sampling_jsonl: Optional[str] = None,
    settings_yaml: Optional[str] = None,
    inventory_yaml: Optional[str] = None,
    output_dir: str = '.',
    tolerance: float = 0.05,
) -> int:
    """
    运行分析流程
    """
    print("=" * 60)
    print("地铁供电检修事件分析工具")
    print("=" * 60)
    print()
    
    os.makedirs(output_dir, exist_ok=True)
    
    protection_actions = []
    sampling_data = None
    settings_data = None
    inventory_data = None
    
    if protection_csv and os.path.exists(protection_csv):
        print(f"[1/6] 读取保护动作CSV: {protection_csv}")
        protection_actions = parse_protection_csv(protection_csv)
        print(f"      解析到 {len(protection_actions)} 条保护动作记录")
    else:
        print("[1/6] 警告: 未提供保护动作CSV文件或文件不存在")
    
    if sampling_jsonl and os.path.exists(sampling_jsonl):
        print(f"[2/6] 读取录波采样JSONL: {sampling_jsonl}")
        sampling_data = parse_sampling_jsonl(sampling_jsonl)
        metadata = sampling_data.get('metadata', {})
        print(f"      解析到 {metadata.get('sample_count', 0)} 个采样点")
        print(f"      通道: {', '.join(metadata.get('channels', []))}")
        gaps = metadata.get('gaps', [])
        if gaps:
            print(f"      ⚠️ 检测到 {len(gaps)} 个采样缺口")
    else:
        print("[2/6] 未提供录波采样JSONL文件，跳过采样数据分析")
    
    if settings_yaml and os.path.exists(settings_yaml):
        print(f"[3/6] 读取保护定值YAML: {settings_yaml}")
        settings_data = parse_settings_yaml(settings_yaml)
        devices = settings_data.get('devices', [])
        print(f"      解析到 {len(devices)} 个装置的定值")
    else:
        print("[3/6] 警告: 未提供保护定值YAML文件或文件不存在")
    
    if inventory_yaml and os.path.exists(inventory_yaml):
        print(f"[4/6] 读取设备台账YAML: {inventory_yaml}")
        inventory_data = parse_inventory_yaml(inventory_yaml)
        devices = inventory_data.get('devices', [])
        print(f"      解析到 {len(devices)} 个设备")
    else:
        print("[4/6] 未提供设备台账YAML文件，跳过台账分析")
    
    print()
    print("[5/6] 构建事件链...")
    
    chain_builder = EventChainBuilder()
    chain_builder.add_protection_actions(protection_actions)
    event_chain = chain_builder.build_event_chain()
    event_summary = chain_builder.get_event_summary()
    
    print(f"      事件总数: {event_summary.get('total_events', 0)}")
    if event_summary.get('out_of_order_count', 0) > 0:
        print(f"      ⚠️ 检测到 {event_summary['out_of_order_count']} 个乱序事件")
    
    print()
    print("[6/6] 定值符合性评估...")
    
    evaluator = ProtectionEvaluator(tolerance=tolerance)
    evaluation_results = evaluator.evaluate_all_events(
        protection_actions, 
        settings_data or {}, 
        inventory_data
    )
    evaluation_summary = evaluator.get_evaluation_summary()
    
    print(f"      已评估 {evaluation_summary.get('total', 0)} 个事件")
    print(f"      符合定值: {evaluation_summary.get('compliant', 0)}")
    print(f"      不符合定值: {evaluation_summary.get('non_compliant', 0)}")
    print(f"      无对应定值: {evaluation_summary.get('no_setting', 0)}")
    
    print()
    print("-" * 60)
    print("导出结果...")
    
    events_csv_path = os.path.join(output_dir, 'events.csv')
    export_events_csv(events_csv_path, event_chain, evaluation_results)
    print(f"  ✓ events.csv -> {events_csv_path}")
    
    report_path = os.path.join(output_dir, 'review_report.md')
    export_review_report(
        report_path,
        event_summary,
        evaluation_summary,
        event_chain,
        evaluation_results,
        sampling_metadata=sampling_data.get('metadata') if sampling_data else None,
        inventory_data=inventory_data,
        settings_data=settings_data,
    )
    print(f"  ✓ review_report.md -> {report_path}")
    
    timeline_path = os.path.join(output_dir, 'timeline.html')
    export_timeline_html(
        timeline_path,
        event_chain,
        evaluation_results,
        sampling_data,
    )
    print(f"  ✓ timeline.html -> {timeline_path}")
    
    print()
    print("=" * 60)
    print("分析完成!")
    print("=" * 60)
    
    return 0


def run_sample_demo(output_dir: str = '.') -> int:
    """
    使用内置sample数据运行演示
    """
    sample_dir = get_sample_data_dir()
    
    protection_csv = os.path.join(sample_dir, 'protection_actions.csv')
    sampling_jsonl = os.path.join(sample_dir, 'sampling_data.jsonl')
    settings_yaml = os.path.join(sample_dir, 'protection_settings.yaml')
    inventory_yaml = os.path.join(sample_dir, 'device_inventory.yaml')
    
    print("=" * 60)
    print("地铁供电检修事件分析工具 - Sample演示")
    print("=" * 60)
    print()
    print(f"Sample数据目录: {sample_dir}")
    print()
    
    return run_analysis(
        protection_csv=protection_csv,
        sampling_jsonl=sampling_jsonl,
        settings_yaml=settings_yaml,
        inventory_yaml=inventory_yaml,
        output_dir=output_dir,
    )


def main():
    """
    主入口函数
    """
    parser = argparse.ArgumentParser(
        prog='metro-power-analyzer',
        description='地铁供电检修事件分析工具 - 分析牵引变电所保护动作事件',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 使用sample数据运行演示
  metro-power-analyzer sample
  
  # 使用自定义数据文件
  metro-power-analyzer analyze \\
    --protection-csv ./data/protection.csv \\
    --sampling-jsonl ./data/sampling.jsonl \\
    --settings-yaml ./data/settings.yaml \\
    --inventory-yaml ./data/inventory.yaml \\
    --output ./result
        """,
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    sample_parser = subparsers.add_parser('sample', help='使用内置sample数据运行演示')
    sample_parser.add_argument(
        '--output', '-o',
        default='.',
        help='输出目录 (默认: 当前目录)',
    )
    
    analyze_parser = subparsers.add_parser('analyze', help='分析自定义数据')
    analyze_parser.add_argument(
        '--protection-csv', '-p',
        required=True,
        help='保护动作CSV文件路径',
    )
    analyze_parser.add_argument(
        '--sampling-jsonl', '-s',
        help='录波采样JSONL文件路径 (可选)',
    )
    analyze_parser.add_argument(
        '--settings-yaml', '-t',
        required=True,
        help='保护定值YAML文件路径',
    )
    analyze_parser.add_argument(
        '--inventory-yaml', '-i',
        help='设备台账YAML文件路径 (可选)',
    )
    analyze_parser.add_argument(
        '--output', '-o',
        default='.',
        help='输出目录 (默认: 当前目录)',
    )
    analyze_parser.add_argument(
        '--tolerance',
        type=float,
        default=0.05,
        help='定值允许误差百分比 (默认: 0.05 = 5%%)',
    )
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    try:
        if args.command == 'sample':
            return run_sample_demo(output_dir=args.output)
        elif args.command == 'analyze':
            return run_analysis(
                protection_csv=args.protection_csv,
                sampling_jsonl=args.sampling_jsonl,
                settings_yaml=args.settings_yaml,
                inventory_yaml=args.inventory_yaml,
                output_dir=args.output,
                tolerance=args.tolerance,
            )
        else:
            parser.print_help()
            return 1
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
