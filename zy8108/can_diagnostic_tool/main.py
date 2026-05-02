"""
CAN总线诊断与回放工具 - CLI入口

用于硬件测试的CAN日志分析、信号解码和诊断报告生成

使用方法:
    python -m can_diagnostic_tool --signals signals.yaml --log candump.log --rules diagnostic_rules.yaml --devices devices.csv --output ./output
"""

import argparse
import sys
from pathlib import Path
from typing import Optional

from .log_parser import LogParser
from .signal_decoder import SignalDecoder, DeviceRegistry
from .rule_engine import RuleEngine, IssueType
from .state_aggregator import StateAggregator
from .report_generator import ReportGenerator


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='CAN总线诊断与回放工具 - 分析CAN日志并生成诊断报告',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    python -m can_diagnostic_tool \
        --signals sample_data/signals.yaml \
        --log sample_data/candump.log \
        --rules sample_data/diagnostic_rules.yaml \
        --devices sample_data/devices.csv \
        --output ./output

支持的问题检测:
    - 心跳丢失 (heartbeat_miss)
    - 信号越界 (signal_out_of_range)
    - 计数器回跳 (counter_jump_back)
    - ID冲突 (id_conflict)
    - 周期违规 (cycle_violation)
        """
    )
    
    parser.add_argument('--signals', '-s', required=True,
                        help='信号定义YAML文件路径 (signals.yaml)')
    parser.add_argument('--log', '-l', required=True,
                        help='candump日志文件路径')
    parser.add_argument('--rules', '-r', required=True,
                        help='诊断规则YAML文件路径')
    parser.add_argument('--devices', '-d', required=True,
                        help='设备台账CSV文件路径')
    parser.add_argument('--output', '-o', default='./output',
                        help='输出目录路径 (默认: ./output)')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='显示详细输出')
    
    args = parser.parse_args()
    
    # 验证输入文件
    signals_path = Path(args.signals)
    log_path = Path(args.log)
    rules_path = Path(args.rules)
    devices_path = Path(args.devices)
    
    for file_path, name in [
        (signals_path, '信号定义文件'),
        (log_path, 'CAN日志文件'),
        (rules_path, '诊断规则文件'),
        (devices_path, '设备台账文件')
    ]:
        if not file_path.exists():
            print(f"错误: {name}不存在: {file_path}", file=sys.stderr)
            sys.exit(1)
    
    # 创建输出目录
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    if args.verbose:
        print("=" * 60)
        print("CAN总线诊断工具")
        print("=" * 60)
        print(f"信号定义: {signals_path}")
        print(f"CAN日志: {log_path}")
        print(f"诊断规则: {rules_path}")
        print(f"设备台账: {devices_path}")
        print(f"输出目录: {output_path}")
        print("-" * 60)
    
    try:
        # 步骤1: 初始化组件
        if args.verbose:
            print("[1/6] 初始化组件...")
        
        signal_decoder = SignalDecoder()
        device_registry = DeviceRegistry()
        
        # 步骤2: 加载配置
        if args.verbose:
            print("[2/6] 加载配置文件...")
        
        signal_decoder.load_signals_config(str(signals_path))
        device_registry.load_from_csv(str(devices_path))
        
        if args.verbose:
            print(f"      已加载 {len(signal_decoder.get_known_can_ids())} 个CAN ID定义")
            print(f"      已加载 {len(device_registry.get_all_devices())} 个设备")
        
        # 步骤3: 初始化规则引擎和状态聚合器
        rule_engine = RuleEngine(signal_decoder, device_registry)
        state_aggregator = StateAggregator(signal_decoder, device_registry)
        
        rule_engine.load_rules(str(rules_path))
        state_aggregator.initialize_devices()
        
        # 步骤4: 解析日志并处理
        if args.verbose:
            print("[3/6] 解析CAN日志...")
        
        log_parser = LogParser()
        frame_count = 0
        decoded_count = 0
        
        for frame in log_parser.parse_file(str(log_path)):
            frame_count += 1
            
            # 解码帧
            decoded_frame = signal_decoder.decode_frame(frame)
            if decoded_frame:
                decoded_count += 1
            
            # 处理规则
            rule_engine.process_frame(frame, decoded_frame)
            
            # 聚合状态
            state_aggregator.process_frame(frame, decoded_frame)
            
            if args.verbose and frame_count % 1000 == 0:
                print(f"      已处理 {frame_count} 帧...")
        
        # 最终检查
        rule_engine.final_check()
        
        if args.verbose:
            print(f"      共处理 {frame_count} 帧")
            print(f"      成功解码 {decoded_count} 帧")
        
        # 步骤5: 获取检测结果
        if args.verbose:
            print("[4/6] 收集检测结果...")
        
        issues = rule_engine.get_issues()
        id_conflicts = state_aggregator.get_id_conflicts()
        unknown_ids = state_aggregator.get_unknown_ids(
            set(signal_decoder.get_known_can_ids())
        )
        
        # 同时检查信号解码器遇到的未知ID
        decoder_unknown = signal_decoder.get_unknown_can_ids_encountered()
        for cid in decoder_unknown:
            if cid not in unknown_ids:
                unknown_ids.append(cid)
        
        if args.verbose:
            print(f"      检测到 {len(issues)} 个问题")
            print(f"      检测到 {len(id_conflicts)} 个ID冲突")
            print(f"      发现 {len(unknown_ids)} 个未知CAN ID")
        
        # 步骤6: 生成报告
        if args.verbose:
            print("[5/6] 生成报告...")
        
        report_gen = ReportGenerator(str(output_path))
        
        # 导出issues.csv
        issues_csv = report_gen.export_issues_csv(issues)
        if args.verbose:
            print(f"      已创建: {issues_csv}")
        
        # 生成timeline.html
        timeline_html = report_gen.generate_timeline_html(
            timeline_events=state_aggregator.get_timeline(),
            issues=issues,
            device_states=state_aggregator.get_all_device_states()
        )
        if args.verbose:
            print(f"      已创建: {timeline_html}")
        
        # 生成report.md
        log_stats = log_parser.get_statistics()
        rule_stats = rule_engine.get_statistics()
        state_stats = state_aggregator.get_statistics()
        
        report_md = report_gen.generate_report_md(
            log_stats=log_stats,
            rule_stats=rule_stats,
            state_stats=state_stats,
            issues=issues,
            id_conflicts=id_conflicts,
            unknown_ids=unknown_ids
        )
        if args.verbose:
            print(f"      已创建: {report_md}")
        
        # 输出统计摘要
        print("-" * 60)
        print("分析完成!")
        print("-" * 60)
        
        # 问题统计
        from .rule_engine import IssueSeverity
        critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == IssueSeverity.INFO)
        
        print(f"问题统计:")
        print(f"  🔴 严重: {critical_count}")
        print(f"  🟡 警告: {warning_count}")
        print(f"  🔵 信息: {info_count}")
        print(f"  总计: {len(issues)}")
        print()
        
        print(f"输出文件:")
        print(f"  📋 issues.csv      - 问题列表")
        print(f"  📊 timeline.html   - 交互式时间线")
        print(f"  📄 report.md       - 完整分析报告")
        print()
        print(f"输出目录: {output_path.absolute()}")
        
        if critical_count > 0:
            print()
            print("⚠️  警告: 检测到严重问题，建议优先处理!")
        
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
