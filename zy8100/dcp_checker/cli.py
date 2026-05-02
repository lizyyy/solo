import argparse
import sys
import webbrowser
from pathlib import Path
from typing import List, Optional

from .parser import (
    parse_dcp_manifest, parse_cpl_xml, parse_pkl_xml,
    parse_kdm_xml, parse_screens_csv, parse_schedule_yaml,
    KDMInfo
)
from .rules import Validator
from .coverage import ScheduleCoverageAnalyzer
from .reporter import (
    generate_kdm_audit_markdown,
    generate_issues_csv,
    generate_timeline_html
)


def print_section(title: str):
    print(f"\n{'=' * 60}")
    print(f" {title}")
    print('=' * 60)


def print_status(msg: str, ok: bool = True):
    symbol = '✓' if ok else '✗'
    print(f"  [{symbol}] {msg}")


def run_precheck(
    manifest_path: str,
    kdm_paths: List[str],
    screens_csv: str,
    schedule_yaml: str,
    output_dir: str = '.',
    cpl_paths: Optional[List[str]] = None,
    pkl_paths: Optional[List[str]] = None,
    open_browser: bool = False
) -> int:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print_section("解析 DCP 清单 / Parsing DCP Manifest")
    try:
        dcp_data = parse_dcp_manifest(manifest_path)
        print_status(f"DCP manifest loaded: {manifest_path}", True)
        print(f"  - Assets: {len(dcp_data['assets'])}")
        print(f"  - CPLs: {len(dcp_data['cpls'])}")
        print(f"  - PKLs: {len(dcp_data['pkls'])}")
    except Exception as e:
        print_status(f"Failed to parse manifest: {e}", False)
        return 1

    print_section("解析 KDM 文件 / Parsing KDM Files")
    kdms: List[KDMInfo] = []
    for kdm_path in kdm_paths:
        try:
            kdm = parse_kdm_xml(kdm_path)
            kdms.append(kdm)
            print_status(f"KDM loaded: {kdm_path}", True)
            print(f"  - Title: {kdm.content_title_text}")
            print(f"  - Valid: {kdm.kdm_validity_start[:19]} to {kdm.kdm_validity_end[:19]}")
            print(f"  - Screens: {', '.join(kdm.screen_list) if kdm.screen_list else 'N/A'}")
        except Exception as e:
            print_status(f"Failed to parse KDM {kdm_path}: {e}", False)

    print_section("解析银幕设备 CSV / Parsing Theater Screens CSV")
    try:
        screens = parse_screens_csv(screens_csv)
        print_status(f"Screens CSV loaded: {screens_csv}", True)
        print(f"  - Total screens: {len(screens)}")
    except Exception as e:
        print_status(f"Failed to parse screens CSV: {e}", False)
        return 1

    print_section("解析排片 YAML / Parsing Schedule YAML")
    try:
        schedule = parse_schedule_yaml(schedule_yaml)
        print_status(f"Schedule YAML loaded: {schedule_yaml}", True)
        print(f"  - Total showtimes: {schedule.total_shows}")
    except Exception as e:
        print_status(f"Failed to parse schedule YAML: {e}", False)
        return 1

    print_section("执行验证规则 / Running Validation Rules")
    validator = Validator(dcp_data, screens, schedule, kdms)
    issues = validator.validate()

    error_count = len([i for i in issues if i.severity == 'ERROR'])
    warning_count = len([i for i in issues if i.severity == 'WARNING'])

    print(f"  - Issues found: {error_count} errors, {warning_count} warnings")

    print_section("分析排片覆盖 / Analyzing Schedule Coverage")
    analyzer = ScheduleCoverageAnalyzer(schedule, kdms, screens)
    coverage_result = analyzer.analyze()

    summary = coverage_result['summary']
    print(f"  - Total shows: {summary['total_shows']}")
    print(f"  - Covered shows: {summary['covered_shows']}")
    print(f"  - Coverage: {summary['overall_coverage_percentage']:.1f}%")

    print_section("生成报告 / Generating Reports")

    kdm_audit_path = str(output_path / 'kdm_audit.md')
    generate_kdm_audit_markdown(
        issues,
        summary,
        coverage_result['coverage_by_screen'],
        kdm_audit_path
    )
    print_status(f"KDM audit report: {kdm_audit_path}", True)

    issues_csv_path = str(output_path / 'issues.csv')
    generate_issues_csv(issues, issues_csv_path)
    print_status(f"Issues CSV: {issues_csv_path}", True)

    timeline_html_path = str(output_path / 'timeline.html')
    timeline_data = analyzer.get_timeline_data()
    generate_timeline_html(timeline_data, timeline_html_path)
    print_status(f"Timeline HTML: {timeline_html_path}", True)

    if open_browser:
        print_section("打开 HTML 报告 / Opening HTML Report")
        webbrowser.open(f'file://{timeline_html_path}')

    print_section("预检完成 / Pre-check Complete")
    print(f"\n报告已生成:")
    print(f"  - {kdm_audit_path}")
    print(f"  - {issues_csv_path}")
    print(f"  - {timeline_html_path}")

    if error_count > 0:
        print(f"\n⚠️  发现 {error_count} 个错误需要处理")
        return 1

    return 0


def main():
    parser = argparse.ArgumentParser(
        description='影院 DCP/KDM 放映包预检器 - Cinema DCP/KDM Pre-checker',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法 / Examples:
  dcp-checker --manifest dcp_manifest.json --kdm kdm1.xml kdm2.xml \\
               --screens screens.csv --schedule schedule.yaml

  dcp-checker -m manifest.json -k kdm.xml -s screens.csv \\
               -y schedule.yaml -o output/ --open
        '''
    )

    parser.add_argument(
        '-m', '--manifest',
        required=True,
        help='Path to dcp_manifest.json'
    )
    parser.add_argument(
        '-k', '--kdm',
        nargs='+',
        required=True,
        help='Path to one or more KDM XML files'
    )
    parser.add_argument(
        '-s', '--screens',
        required=True,
        help='Path to theater screens CSV file'
    )
    parser.add_argument(
        '-y', '--schedule',
        required=True,
        help='Path to schedule YAML file'
    )
    parser.add_argument(
        '-o', '--output',
        default='.',
        help='Output directory for reports (default: current directory)'
    )
    parser.add_argument(
        '--cpl',
        nargs='+',
        help='Optional: Path to additional CPL XML files'
    )
    parser.add_argument(
        '--pkl',
        nargs='+',
        help='Optional: Path to additional PKL XML files'
    )
    parser.add_argument(
        '--open',
        action='store_true',
        help='Open timeline.html in browser after generation'
    )
    parser.add_argument(
        '--version',
        action='version',
        version='%(prog)s 1.0.0'
    )

    args = parser.parse_args()

    sys.exit(run_precheck(
        manifest_path=args.manifest,
        kdm_paths=args.kdm,
        screens_csv=args.screens,
        schedule_yaml=args.schedule,
        output_dir=args.output,
        cpl_paths=args.cpl,
        pkl_paths=args.pkl,
        open_browser=args.open
    ))


if __name__ == '__main__':
    main()
