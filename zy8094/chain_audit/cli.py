import argparse
import sys
from pathlib import Path

from .parse import (
    parse_athletes,
    parse_jsonl,
    parse_handover_rules,
    parse_lab_receipts,
    parse_timestamp,
)
from .state_machine import ChainBuilder
from .rules import run_audit
from .report import generate_markdown, generate_issues_csv, generate_timeline_html


def main():
    parser = argparse.ArgumentParser(description='反兴奋剂样本链路复核工具')
    parser.add_argument('--athletes', required=True, help='运动员数据 CSV 文件')
    parser.add_argument('--events', required=True, help='样本事件 JSONL 文件')
    parser.add_argument('--rules', required=True, help='交接规则 YAML 文件')
    parser.add_argument('--receipts', required=True, help='实验室回执 CSV 文件')
    parser.add_argument('--output-dir', default='output', help='输出目录')
    parser.add_argument('--report', default='chain_audit.md', help='审计报告文件名')
    parser.add_argument('--issues', default='issues.csv', help='问题列表文件名')
    parser.add_argument('--timeline', default='timeline.html', help='时间线 HTML 文件名')

    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    athletes = parse_athletes(args.athletes)
    print(f"已加载 {len(athletes)} 名运动员")

    events = parse_jsonl(args.events)
    print(f"已加载 {len(events)} 条样本事件")

    rules_config = parse_handover_rules(args.rules)
    print("已加载交接规则")

    receipts = parse_lab_receipts(args.receipts)
    print(f"已加载 {len(receipts)} 份实验室回执")

    builder = ChainBuilder()
    for event_data in events:
        timestamp = parse_timestamp(event_data['timestamp'])
        builder.add_event(event_data, timestamp)

    chains = builder.build_all()
    print(f"已构建 {len(chains)} 条样本链路")

    issues = run_audit(chains, rules_config)
    print(f"发现 {len(issues)} 个问题")

    report_path = output_dir / args.report
    issues_path = output_dir / args.issues
    timeline_path = output_dir / args.timeline

    generate_markdown(chains, issues, athletes, str(report_path))
    print(f"审计报告已生成: {report_path}")

    generate_issues_csv(issues, str(issues_path))
    print(f"问题列表已生成: {issues_path}")

    generate_timeline_html(chains, issues, athletes, str(timeline_path))
    print(f"时间线已生成: {timeline_path}")

    if issues:
        print("\n问题摘要:")
        for issue in issues[:10]:
            print(f"  [{issue.severity.upper()}] {issue.issue_id}: {issue.description}")
        if len(issues) > 10:
            print(f"  ... 还有 {len(issues) - 10} 个问题")


if __name__ == '__main__':
    main()
