#!/usr/bin/env python3
"""冷链温控异常追溯 CLI 主程序"""

import argparse
import yaml
import os
import sys
from pathlib import Path

from cold_chain.parser import DataParser
from cold_chain.analyzer import ColdChainAnalyzer
from cold_chain.report import ReportGenerator


def main():
    parser = argparse.ArgumentParser(
        description='冷链温控异常追溯 CLI - 读取温度曲线、车辆路线、装卸节点、签收时间、货品批次和阈值规则，生成详细的追溯报告'
    )
    
    parser.add_argument(
        '--config', '-c',
        type=str,
        required=True,
        help='配置文件路径（YAML格式）'
    )
    
    parser.add_argument(
        '--format', '-f',
        type=str,
        choices=['text', 'html'],
        default='text',
        help='报告输出格式（text 或 html）'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='trace_report',
        help='报告文件名（不含扩展名）'
    )
    
    parser.add_argument(
        '--output-dir',
        type=str,
        default='reports',
        help='报告输出目录'
    )
    
    args = parser.parse_args()
    
    config_path = args.config
    if not os.path.exists(config_path):
        print(f"错误：配置文件不存在：{config_path}")
        sys.exit(1)
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"错误：无法读取配置文件：{e}")
        sys.exit(1)
    
    print("=" * 60)
    print("冷链温控异常追溯系统")
    print("=" * 60)
    print()
    
    print("1. 解析数据文件...")
    data_parser = DataParser()
    
    try:
        parsed_data = data_parser.parse_config_files(config.get('data_files', {}))
    except Exception as e:
        print(f"错误：数据解析失败：{e}")
        sys.exit(1)
    
    print("   数据解析完成")
    print()
    
    print("2. 执行追溯分析...")
    analyzer = ColdChainAnalyzer()
    
    try:
        result = analyzer.analyze(parsed_data)
    except Exception as e:
        print(f"错误：分析过程失败：{e}")
        sys.exit(1)
    
    print("   分析完成")
    print()
    
    print("3. 生成追溯报告...")
    report_gen = ReportGenerator(output_dir=args.output_dir)
    
    try:
        report_path = report_gen.save_report(
            result,
            filename=args.output,
            format_type=args.format
        )
    except Exception as e:
        print(f"错误：报告生成失败：{e}")
        sys.exit(1)
    
    print("   报告生成完成")
    print()
    
    print("=" * 60)
    print("分析结果摘要")
    print("=" * 60)
    print(f"  分析批次总数：{result.total_batches}")
    print(f"  存在异常批次：{result.batches_with_anomalies}")
    print(f"  检测到异常数：{result.total_anomalies}")
    print(f"  发现数据缺口：{len(result.data_gaps)}")
    print(f"  检测时间漂移：{len(result.time_drifts)}")
    print()
    
    if result.recommendations:
        print("建议行动：")
        for rec in result.recommendations:
            print(f"  • {rec}")
        print()
    
    print(f"报告已保存至：{report_path}")
    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
