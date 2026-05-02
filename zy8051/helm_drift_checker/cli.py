#!/usr/bin/env python3
"""Helm Drift Checker CLI."""

import argparse
import sys
import json
from pathlib import Path
from .parser import (
    parse_values,
    parse_chart_defaults,
    parse_cluster_snapshot,
    parse_upgrade_policy
)
from .diff import DiffEngine
from .rules import RuleEngine
from .report import ReportGenerator
from . import __version__


def main():
    parser = argparse.ArgumentParser(
        description="Helm Drift Checker - A Helm upgrade drift pre-flight CLI for platform engineers"
    )
    parser.add_argument(
        '--current-values',
        required=True,
        type=Path,
        help='Path to current values.yaml'
    )
    parser.add_argument(
        '--target-defaults',
        required=True,
        type=Path,
        help='Path to target chart defaults YAML'
    )
    parser.add_argument(
        '--cluster-snapshot',
        required=True,
        type=Path,
        help='Path to cluster resource snapshot JSON'
    )
    parser.add_argument(
        '--upgrade-policy',
        required=True,
        type=Path,
        help='Path to upgrade policy YAML'
    )
    parser.add_argument(
        '--env-overrides',
        nargs='*',
        type=Path,
        help='Path to environment override files (for conflict detection)'
    )
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path('.'),
        help='Output directory for reports'
    )
    parser.add_argument(
        '--version',
        action='version',
        version=f'%(prog)s {__version__}'
    )
    
    args = parser.parse_args()
    
    try:
        print("=" * 60)
        print("Helm Drift Checker")
        print("=" * 60)
        
        print("\n[1/5] Parsing input files...")
        current_values = parse_values(args.current_values)
        target_defaults = parse_chart_defaults(args.target_defaults)
        cluster_snapshot = parse_cluster_snapshot(args.cluster_snapshot)
        policy = parse_upgrade_policy(args.upgrade_policy)
        print("   ✓ Input files parsed successfully")
        
        print("\n[2/5] Analyzing configuration differences...")
        diff_engine = DiffEngine(current_values, target_defaults)
        diff_result = diff_engine.analyze(args.env_overrides)
        print(f"   ✓ Found {len(diff_result['changes'])} changes")
        print(f"   ✓ Found {len(diff_result['deleted_fields'])} deleted fields")
        print(f"   ✓ Found {len(diff_result['conflicts'])} conflicts")
        
        print("\n[3/5] Running validation rules...")
        rule_engine = RuleEngine(current_values, cluster_snapshot, policy)
        issues = rule_engine.analyze()
        print(f"   ✓ Found {len(issues)} issues")
        
        print("\n[4/5] Generating reports...")
        report_gen = ReportGenerator(args.output_dir)
        
        patch_plan = report_gen.generate_patch_plan(
            diff_result['changes'],
            diff_result['deleted_fields'],
            diff_result['conflicts'],
            issues,
            policy
        )
        issues_csv = report_gen.generate_issues_csv(issues)
        summary = report_gen.generate_summary(diff_result, issues)
        
        print(f"   ✓ Generated {patch_plan}")
        print(f"   ✓ Generated {issues_csv}")
        
        print("\n[5/5] Summary:")
        print("-" * 60)
        print(f"  Changes: {summary['summary']['changes']}")
        print(f"  Deleted fields: {summary['summary']['deleted_fields']}")
        print(f"  Conflicts: {summary['summary']['conflicts']}")
        print(f"  Issues: {summary['summary']['issues']}")
        print(f"  Critical issues: {summary['summary']['critical_issues']}")
        print("=" * 60)
        
        if summary['summary']['critical_issues'] > 0:
            print("\n⚠️  Critical issues detected! Review patch_plan.md before proceeding!")
            return 1
        else:
            print("\n✅ Check complete. All checks passed!")
            return 0
            
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
