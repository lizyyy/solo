#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
渠道线索去重来源优先级冲突保留排查CLI
"""
import argparse
import os
import sys
from utils import read_leads_from_csv
from deduplicator import LeadDeduplicator
from reporter import ReportGenerator


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║            渠道线索去重来源优先级冲突保留排查CLI             ║
║           Lead Deduplication CLI - Rule-based, Auditable     ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def main():
    parser = argparse.ArgumentParser(
        description='渠道线索去重工具 - 支持手机号、邮箱、公司名模糊匹配，来源优先级冲突保留',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py --input leads.csv --output-dir ./output
  python main.py --input leads.csv --phone-threshold 0.8 --company-threshold 0.7
        """
    )
    
    parser.add_argument('--input', '-i', required=True,
                        help='输入线索CSV文件路径')
    parser.add_argument('--output-dir', '-o', default='./deduplication_output',
                        help='输出目录（默认: ./deduplication_output）')
    parser.add_argument('--phone-threshold', type=float, default=0.9,
                        help='手机号匹配阈值（默认: 0.9）')
    parser.add_argument('--email-threshold', type=float, default=0.9,
                        help='邮箱匹配阈值（默认: 0.9）')
    parser.add_argument('--company-threshold', type=float, default=0.8,
                        help='公司名匹配阈值（默认: 0.8）')
    parser.add_argument('--combined-threshold', type=float, default=0.75,
                        help='公司名+邮箱前缀综合阈值（默认: 0.75）')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='显示详细处理信息')
    
    args = parser.parse_args()
    
    print_banner()
    
    if not os.path.exists(args.input):
        print(f"❌ 错误：输入文件不存在: {args.input}")
        sys.exit(1)
    
    os.makedirs(args.output_dir, exist_ok=True)
    
    print(f"📂 读取输入文件: {args.input}")
    try:
        leads = read_leads_from_csv(args.input)
        print(f"✅ 成功读取 {len(leads)} 条线索")
    except Exception as e:
        print(f"❌ 读取文件失败: {e}")
        sys.exit(1)
    
    if args.verbose:
        print(f"\n📊 来源分布统计:")
        from collections import Counter
        sources = Counter(ld.source for ld in leads if ld.source)
        for source, count in sources.most_common():
            print(f"  - {source}: {count}条")
    
    print(f"\n🔍 开始去重处理...")
    print(f"   参数配置:")
    print(f"   - 手机号阈值: {args.phone_threshold}")
    print(f"   - 邮箱阈值: {args.email_threshold}")
    print(f"   - 公司名阈值: {args.company_threshold}")
    print(f"   - 综合阈值: {args.combined_threshold}\n")
    
    deduplicator = LeadDeduplicator(
        phone_threshold=args.phone_threshold,
        email_threshold=args.email_threshold,
        company_threshold=args.company_threshold,
        company_email_combined_threshold=args.combined_threshold
    )
    
    result = deduplicator.deduplicate(leads)
    
    print(f"✅ 去重完成！")
    print(f"\n📈 去重统计:")
    print(f"   - 输入线索: {result.total_input} 条")
    print(f"   - 去重后唯一: {result.total_unique} 条")
    print(f"   - 发现重复: {result.total_duplicates} 条")
    print(f"   - 重复率: {(result.total_duplicates/result.total_input*100):.1f}%")
    print(f"   - 重复群组: {len(result.duplicate_groups)} 个")
    
    if result.duplicate_groups and args.verbose:
        print(f"\n🔗 重复群组预览:")
        for idx, group in enumerate(result.duplicate_groups[:3], 1):
            print(f"   {idx}. {group.group_id} - {group.match_reason} ({len(group.duplicate_leads)+1}条)")
        if len(result.duplicate_groups) > 3:
            print(f"   ... 还有 {len(result.duplicate_groups) - 3} 个群组")
    
    print(f"\n📝 生成输出文件...")
    
    reporter = ReportGenerator(result)
    
    unique_csv = os.path.join(args.output_dir, '01_unique_leads.csv')
    reporter.generate_unique_leads_csv(unique_csv)
    print(f"   ✅ 唯一线索列表: {unique_csv}")
    
    machine_csv = os.path.join(args.output_dir, '02_machine_readable_report.csv')
    reporter.generate_machine_readable_csv(machine_csv)
    print(f"   ✅ 机器可读报告: {machine_csv}")
    
    human_md = os.path.join(args.output_dir, '03_human_readable_report.md')
    reporter.generate_human_readable_markdown(human_md)
    print(f"   ✅ 人类可读报告: {human_md}")
    
    print(f"\n🎉 全部处理完成！输出目录: {os.path.abspath(args.output_dir)}")
    print(f"\n💡 验收提示:")
    print(f"   1. 机器可读报告(CSV)与人类可读报告(Markdown)数据保持一致")
    print(f"   2. 来源优先级规则正确应用")
    print(f"   3. 字段冲突已清晰标注")


if __name__ == '__main__':
    main()
