#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from bacnet_validator.parser import parse_all
from bacnet_validator.rules import Validator
from bacnet_validator.reporter import Reporter


def main():
    parser = argparse.ArgumentParser(
        description="BACnet Gateway Upgrade Validation Tool - Validate point table changes before upgrade",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic validation with sample data
  python bacnet_validate.py --point-map samples/point_map.csv \\
                             --bacnet-reads samples/bacnet_reads.jsonl \\
                             --rules samples/rules.yaml \\
                             --output ./output

  # Show summary only
  python bacnet_validate.py --point-map point_map.csv \\
                             --bacnet-reads bacnet_reads.jsonl \\
                             --rules rules.yaml \\
                             --summary

  # Verbose mode
  python bacnet_validate.py -p point_map.csv -b bacnet_reads.jsonl -r rules.yaml -v
        """,
    )

    parser.add_argument(
        "-p",
        "--point-map",
        required=True,
        help="Path to point_map.csv containing point name mappings",
    )
    parser.add_argument(
        "-b",
        "--bacnet-reads",
        required=True,
        help="Path to bacnet_reads.jsonl containing historical BACnet readings",
    )
    parser.add_argument(
        "-r",
        "--rules",
        required=True,
        help="Path to rules.yaml containing validation rules",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="./bacnet_validation_output",
        help="Output directory for reports (default: ./bacnet_validation_output)",
    )
    parser.add_argument(
        "-s",
        "--summary",
        action="store_true",
        help="Only show summary, don't generate full reports",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose output",
    )

    args = parser.parse_args()

    point_map_path = Path(args.point_map)
    bacnet_reads_path = Path(args.bacnet_reads)
    rules_path = Path(args.rules)
    output_dir = Path(args.output)

    if not point_map_path.exists():
        print(f"Error: Point map file not found: {point_map_path}", file=sys.stderr)
        sys.exit(1)

    if not bacnet_reads_path.exists():
        print(f"Error: BACnet reads file not found: {bacnet_reads_path}", file=sys.stderr)
        sys.exit(1)

    if not rules_path.exists():
        print(f"Error: Rules file not found: {rules_path}", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        print("=" * 60)
        print("BACnet Gateway Upgrade Validation Tool")
        print("=" * 60)
        print(f"Point Map:  {point_map_path}")
        print(f"BACnet Reads: {bacnet_reads_path}")
        print(f"Rules:      {rules_path}")
        print(f"Output:     {output_dir}")
        print()

    try:
        if args.verbose:
            print("[1/3] Parsing input files...")

        parsed_data = parse_all(
            str(point_map_path),
            str(bacnet_reads_path),
            str(rules_path),
        )

        if args.verbose:
            print(f"      - Parsed {len(parsed_data.point_mappings)} point mappings")
            print(f"      - Parsed {len(parsed_data.bacnet_readings)} BACnet readings")
            print(f"      - Parsed {len(parsed_data.rules)} validation rules")
            print()

        if args.verbose:
            print("[2/3] Running validation rules...")

        validator = Validator(parsed_data)
        result = validator.validate()

        if args.verbose or args.summary:
            print()
            print("=" * 60)
            print("VALIDATION SUMMARY")
            print("=" * 60)
            print(f"Total Points:         {result.total_points}")
            print(f"Total Readings:       {result.total_readings}")
            print(f"Points with Readings: {result.points_with_readings}")
            print(f"Points without Readings: {result.points_without_readings}")
            print()
            print("Issues by Severity:")
            print(f"  Critical: {result.critical_count}")
            print(f"  High:     {result.high_count}")
            print(f"  Medium:   {result.medium_count}")
            print(f"  Low:      {result.low_count}")
            print(f"  TOTAL:    {len(result.all_issues)}")
            print()

            if result.critical_count > 0:
                print("CRITICAL ISSUES (Upgrade NOT recommended):")
                for issue in result.all_issues:
                    if issue.severity.value == "critical":
                        print(f"  - [{issue.issue_type.value}] {issue.point_identifier}: {issue.message}")
                print()

        if not args.summary:
            if args.verbose:
                print("[3/3] Generating reports...")

            output_dir.mkdir(parents=True, exist_ok=True)
            reporter = Reporter(result)

            output_files = reporter.generate_all(str(output_dir))

            if args.verbose:
                print(f"      - Issues CSV:  {output_files['issues_csv']}")
                print(f"      - Markdown Report: {output_files['mapping_report_md']}")
                print(f"      - HTML Timeline: {output_files['timeline_html']}")
                print()

            print("=" * 60)
            print("VALIDATION COMPLETE")
            print("=" * 60)
            print(f"\nGenerated Reports:")
            print(f"  1. {output_files['issues_csv']}")
            print(f"  2. {output_files['mapping_report_md']}")
            print(f"  3. {output_files['timeline_html']}")
            print()

        if result.critical_count > 0:
            sys.exit(2)
        elif result.high_count > 0:
            sys.exit(1)
        else:
            sys.exit(0)

    except Exception as e:
        print(f"Error during validation: {e}", file=sys.stderr)
        if args.verbose:
            import traceback

            traceback.print_exc()
        sys.exit(3)


if __name__ == "__main__":
    main()
