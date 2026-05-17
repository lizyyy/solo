#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from modules.parser import DataParser
from modules.cleaner import DataCleaner
from modules.merger import ChannelMerger
from modules.consultant import ConsultantSummary
from modules.tracker import SourceTracker
from modules.exporter import ReportExporter


def main():
    parser = argparse.ArgumentParser(
        description="售楼处渠道来访合并排查CLI工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python channel_visit_cli.py --visit 来访表.xlsx --channel 渠道表.xlsx --output 报告.xlsx
  python channel_visit_cli.py --visit 来访表.csv --channel 渠道表.csv --config config.yaml
        """
    )
    
    parser.add_argument("--visit", required=True, help="来访登记表路径 (Excel/CSV)")
    parser.add_argument("--channel", required=True, help="渠道认领表路径 (Excel/CSV)")
    parser.add_argument("--output", default="合并报告.xlsx", help="输出报告路径")
    parser.add_argument("--config", help="配置文件路径 (YAML)")
    parser.add_argument("--phone-col", default="客户电话", help="电话列名")
    parser.add_argument("--consultant-col", default="置业顾问", help="置业顾问列名")
    parser.add_argument("--channel-col", default="渠道名称", help="渠道名称列名")
    parser.add_argument("--status-col", default="认领状态", help="认领状态列名")
    parser.add_argument("--visit-sheet", help="来访表工作表名")
    parser.add_argument("--channel-sheet", help="渠道表工作表名")
    parser.add_argument("--verbose", action="store_true", help="显示详细信息")
    
    args = parser.parse_args()
    
    if args.verbose:
        print(f"[INFO] 读取来访表: {args.visit}")
        print(f"[INFO] 读取渠道表: {args.channel}")
    
    try:
        data_parser = DataParser(
            phone_col=args.phone_col,
            consultant_col=args.consultant_col,
            channel_col=args.channel_col,
            status_col=args.status_col
        )
        
        visit_data = data_parser.parse_visit(args.visit, sheet_name=args.visit_sheet)
        channel_data = data_parser.parse_channel(args.channel, sheet_name=args.channel_sheet)
        
        if args.verbose:
            print(f"[INFO] 来访记录数: {len(visit_data['valid'])}")
            print(f"[INFO] 渠道记录数: {len(channel_data['valid'])}")
            if visit_data['invalid']:
                print(f"[WARN] 来访表坏行数: {len(visit_data['invalid'])}")
            if channel_data['invalid']:
                print(f"[WARN] 渠道表坏行数: {len(channel_data['invalid'])}")
        
        cleaner = DataCleaner(phone_col=args.phone_col)
        cleaned_visit = cleaner.clean_visit(visit_data['valid'])
        cleaned_channel = cleaner.clean_channel(channel_data['valid'])
        
        if args.verbose:
            print(f"[INFO] 电话归一化完成")
        
        tracker = SourceTracker()
        
        merger = ChannelMerger(tracker=tracker)
        merged_result = merger.merge(cleaned_visit, cleaned_channel)
        
        if args.verbose:
            print(f"[INFO] 唯一客户数: {len(merged_result['unique_customers'])}")
            print(f"[INFO] 重复认领客户数: {len(merged_result['duplicate_customers'])}")
        
        consultant_summary = ConsultantSummary(tracker=tracker)
        summary_result = consultant_summary.summarize(merged_result)
        
        if args.verbose:
            print(f"[INFO] 顾问汇总完成，涉及顾问数: {len(summary_result['consultants'])}")
        
        exporter = ReportExporter()
        exporter.export(
            output_path=args.output,
            merged_result=merged_result,
            summary_result=summary_result,
            invalid_visit=visit_data['invalid'],
            invalid_channel=channel_data['invalid'],
            tracker=tracker
        )
        
        print(f"[SUCCESS] 报告已生成: {args.output}")
        
    except Exception as e:
        print(f"[ERROR] {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
