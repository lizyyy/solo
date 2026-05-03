#!/usr/bin/env python3
import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

from amhs_analyzer.topology import load_topology
from amhs_analyzer.state_machine import load_events, build_state_machines
from amhs_analyzer.analysis import load_downtime_windows, analyze_all
from amhs_analyzer.exporters import export_issues_csv, export_report_md, export_timeline_html

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(
        description='AMHS 天车/FOUP 搬运日志堵塞复盘分析工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  python main.py analyze \\
    --topology samples/topology.yaml \\
    --events samples/events.jsonl \\
    --downtime samples/downtime.csv \\
    --output output/

  python main.py demo
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    analyze_parser = subparsers.add_parser('analyze', help='运行完整分析')
    analyze_parser.add_argument('--topology', '-t', required=True, help='轨道拓扑 YAML 文件路径')
    analyze_parser.add_argument('--events', '-e', required=True, help='搬运事件 JSONL 文件路径')
    analyze_parser.add_argument('--downtime', '-d', required=True, help='设备停机窗口 CSV 文件路径')
    analyze_parser.add_argument('--output', '-o', default='output', help='输出目录 (默认: output)')
    analyze_parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')
    
    demo_parser = subparsers.add_parser('demo', help='使用示例数据运行演示')
    
    return parser.parse_args()


def run_analysis(topology_path: Path, events_path: Path, downtime_path: Path, output_dir: Path) -> int:
    logger.info("=== AMHS 堵塞复盘分析 ===")
    logger.info(f"拓扑文件: {topology_path}")
    logger.info(f"事件文件: {events_path}")
    logger.info(f"停机窗口: {downtime_path}")
    logger.info(f"输出目录: {output_dir}")
    
    if not topology_path.exists():
        logger.error(f"拓扑文件不存在: {topology_path}")
        return 1
    
    if not events_path.exists():
        logger.error(f"事件文件不存在: {events_path}")
        return 1
    
    if not downtime_path.exists():
        logger.error(f"停机窗口文件不存在: {downtime_path}")
        return 1
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("\n[1/5] 加载轨道拓扑...")
    topology = load_topology(topology_path)
    validation_errors = topology.validate()
    if validation_errors:
        logger.warning(f"拓扑验证发现 {len(validation_errors)} 个警告:")
        for err in validation_errors[:5]:
            logger.warning(f"  - {err}")
        if len(validation_errors) > 5:
            logger.warning(f"  ... 还有 {len(validation_errors) - 5} 个")
    logger.info(f"  节点数: {len(topology.nodes)}")
    logger.info(f"  边数: {len(topology.edges)}")
    logger.info(f"  设备数: {len(topology.equipments)}")
    
    logger.info("\n[2/5] 加载设备停机窗口...")
    downtime_windows = load_downtime_windows(downtime_path, topology)
    logger.info(f"  停机窗口数: {len(downtime_windows)}")
    
    logger.info("\n[3/5] 加载并解析搬运事件...")
    events = load_events(events_path)
    if not events:
        logger.error("未加载到任何事件!")
        return 1
    logger.info(f"  事件总数: {len(events)}")
    logger.info(f"  时间范围: {events[0].timestamp} 至 {events[-1].timestamp}")
    
    logger.info("\n[4/5] 构建状态机并分析...")
    machines = build_state_machines(events)
    logger.info(f"  FOUP 数量: {len(machines)}")
    
    analyses, summary = analyze_all(topology, machines, downtime_windows)
    logger.info(f"  总问题数: {summary.total_issues}")
    
    logger.info("\n[5/5] 导出结果...")
    gen_time = datetime.now()
    
    issues_path = output_dir / "issues.csv"
    export_issues_csv(analyses, issues_path)
    logger.info(f"  ✓ 导出问题列表: {issues_path}")
    
    report_path = output_dir / "amhs_report.md"
    export_report_md(summary, analyses, report_path, gen_time)
    logger.info(f"  ✓ 导出分析报告: {report_path}")
    
    timeline_path = output_dir / "timeline.html"
    export_timeline_html(analyses, summary, timeline_path, gen_time)
    logger.info(f"  ✓ 导出时间线: {timeline_path}")
    
    logger.info("\n=== 分析完成 ===")
    logger.info(f"\n摘要:")
    logger.info(f"  总搬运任务: {summary.total_transfers}")
    logger.info(f"  已完成: {summary.completed_transfers}")
    logger.info(f"  失败: {summary.failed_transfers}")
    logger.info(f"  总排队时间: {summary.total_queue_time_seconds:.1f}s")
    logger.info(f"  发现问题: {summary.total_issues}")
    if summary.node_queue_issues > 0:
        logger.info(f"    - 节点排队: {summary.node_queue_issues}")
    if summary.reroute_failures > 0:
        logger.info(f"    - 绕行失败: {summary.reroute_failures}")
    if summary.equipment_occupation_issues > 0:
        logger.info(f"    - 设备占用超时: {summary.equipment_occupation_issues}")
    if summary.missing_arrival_issues > 0:
        logger.info(f"    - 缺少到达事件: {summary.missing_arrival_issues}")
    logger.info(f"  受停机影响: {summary.affected_by_downtime}")
    logger.info(f"  乱序事件: {summary.out_of_order_events}")
    
    logger.info(f"\n输出文件:")
    logger.info(f"  {issues_path}")
    logger.info(f"  {report_path}")
    logger.info(f"  {timeline_path}")
    
    return 0


def run_demo() -> int:
    script_dir = Path(__file__).parent
    samples_dir = script_dir / "samples"
    output_dir = script_dir / "output"
    
    if not samples_dir.exists():
        logger.error(f"示例数据目录不存在: {samples_dir}")
        logger.info("请确保项目包含 samples/ 目录")
        return 1
    
    topology_path = samples_dir / "topology.yaml"
    events_path = samples_dir / "events.jsonl"
    downtime_path = samples_dir / "downtime.csv"
    
    return run_analysis(topology_path, events_path, downtime_path, output_dir)


def main():
    args = parse_args()
    
    if getattr(args, 'verbose', False):
        logging.getLogger().setLevel(logging.DEBUG)
    
    if args.command == 'demo':
        sys.exit(run_demo())
    elif args.command == 'analyze':
        sys.exit(run_analysis(
            topology_path=Path(args.topology),
            events_path=Path(args.events),
            downtime_path=Path(args.downtime),
            output_dir=Path(args.output)
        ))
    else:
        print("使用 --help 查看帮助")
        sys.exit(1)


if __name__ == '__main__':
    main()
