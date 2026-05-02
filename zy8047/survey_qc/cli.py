#!/usr/bin/env python3
"""CLI entry point for survey quality inspection."""

import argparse
import sys
from pathlib import Path

from .engine import SurveyQCEngine


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Drone aerial survey delivery package quality inspection CLI",
    )
    parser.add_argument("package_dir", help="Path to survey package directory")
    parser.add_argument("--rules", "-r", help="Path to rules YAML file")
    parser.add_argument("--output", "-o", help="Output directory for reports")
    parser.add_argument("--quiet", "-q", action="store_true", help="Suppress console output")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose output")

    args = parser.parse_args()

    if not Path(args.package_dir).exists():
        print(f"Error: Package directory not found: {args.package_dir}", file=sys.stderr)
        return 1

    if args.rules and not Path(args.rules).exists():
        print(f"Error: Rules file not found: {args.rules}", file=sys.stderr)
        return 1

    try:
        engine = SurveyQCEngine(args.package_dir, args.rules)
        summary = engine.run()
        outputs = engine.generate_reports(args.output)

        if not args.quiet:
            print(f"\n{'='*60}")
            print("SURVEY QUALITY INSPECTION COMPLETE")
            print(f"{'='*60}")
            print(f"Package: {summary['package_name']}")
            print(f"Routes: {len(summary['routes'])}")
            print(f"Total Issues: {summary['total_issues']}")
            print(f"\nReports generated in: {outputs['summary'].parent}")
            print(f"  - summary.md")
            print(f"  - route_issues.csv")
            for route_id in summary["routes"]:
                print(f"  - {route_id}_issues.csv")

        if args.verbose:
            for route_id, data in summary["routes"].items():
                print(f"\nRoute {route_id}: {data['photo_count']} photos, {len(data['issues'])} issues")
                for issue in data["issues"]:
                    print(f"  [{issue.severity}] {issue.issue_type}: {issue.message}")

        high_issues = [i for i in engine.all_issues if i.severity == "HIGH"]
        if high_issues and not args.quiet:
            print(f"\n⚠️  {len(high_issues)} HIGH severity issues detected!")

        return 0

    except Exception as e:
        print(f"Error during QC inspection: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
