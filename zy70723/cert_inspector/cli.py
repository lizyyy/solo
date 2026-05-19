#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path
from datetime import datetime

from cert_inspector.cert_analyzer import CertAnalyzer
from cert_inspector.reporter import Reporter
from cert_inspector.models import CertConfig


def main():
    parser = argparse.ArgumentParser(
        description="证书链解析弱算法修复建议排查CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s analyze cert.pem                    # 分析单个证书
  %(prog)s analyze cert.pem --chain chain.pem  # 分析证书链
  %(prog)s batch ./certs                       # 批量分析目录
  %(prog)s report --json                       # 输出JSON报告
  %(prog)s report --html                       # 输出HTML报告
        """
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    analyze_parser = subparsers.add_parser("analyze", help="分析证书")
    analyze_parser.add_argument("cert_file", help="证书文件路径")
    analyze_parser.add_argument("--chain", help="中间证书链文件")
    analyze_parser.add_argument("--output", "-o", help="输出目录")
    analyze_parser.add_argument("--json", action="store_true", help="输出JSON格式")
    analyze_parser.add_argument("--html", action="store_true", help="输出HTML格式")
    analyze_parser.add_argument("--warn-days", type=int, default=30, 
                                help="过期预警天数 (默认30天)")

    batch_parser = subparsers.add_parser("batch", help="批量分析证书")
    batch_parser.add_argument("directory", help="证书目录路径")
    batch_parser.add_argument("--output", "-o", help="输出目录")
    batch_parser.add_argument("--json", action="store_true", help="输出JSON格式")
    batch_parser.add_argument("--html", action="store_true", help="输出HTML格式")

    report_parser = subparsers.add_parser("report", help="生成报告")
    report_parser.add_argument("--input", "-i", help="分析结果JSON文件")
    report_parser.add_argument("--output", "-o", help="输出目录")
    report_parser.add_argument("--json", action="store_true", help="输出JSON格式")
    report_parser.add_argument("--html", action="store_true", help="输出HTML格式")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    config = CertConfig(
        warn_days=getattr(args, "warn_days", 30),
        output_dir=getattr(args, "output", "./cert_reports"),
        output_json=getattr(args, "json", False),
        output_html=getattr(args, "html", False),
    )

    analyzer = CertAnalyzer(config)
    reporter = Reporter(config)

    if args.command == "analyze":
        result = analyzer.analyze_certificate(
            args.cert_file,
            chain_file=getattr(args, "chain", None)
        )
        reporter.print_result(result)
        
        if config.output_json or config.output_html:
            reporter.export_report(result, config.output_dir)
            
    elif args.command == "batch":
        results = analyzer.analyze_directory(args.directory)
        reporter.print_batch_results(results)
        
        if config.output_json or config.output_html:
            reporter.export_batch_report(results, config.output_dir)
            
    elif args.command == "report":
        if args.input:
            result = reporter.load_result(args.input)
            if config.output_html:
                reporter.export_html_report(result, config.output_dir)
            else:
                reporter.print_result(result)

    return 0


if __name__ == "__main__":
    sys.exit(main())
