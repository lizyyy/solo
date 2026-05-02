#!/usr/bin/env python3
import argparse
import sys
import os
from pathlib import Path
from .parsers.entries import parse_entries_csv
from .parsers.timings import parse_timings_jsonl
from .parsers.rules import parse_rules_yaml
from .parsers.appeals import parse_appeals_json
from .arbitration.arbitrator import Arbitrator
from .exporters.csv import export_results_csv
from .exporters.markdown import export_appeals_report_md
from .exporters.html import export_timeline_html


def main():
    parser = argparse.ArgumentParser(description="Race Timing Arbitration Tool")
    parser.add_argument("--entries", "-e", required=True, help="Path to entries CSV file")
    parser.add_argument("--timings", "-t", required=True, help="Path to timings JSONL file")
    parser.add_argument("--rules", "-r", required=True, help="Path to rules YAML file")
    parser.add_argument("--appeals", "-a", help="Path to appeals JSON file (optional)")
    parser.add_argument("--output-dir", "-o", default=".", help="Output directory (default: current directory)")
    
    args = parser.parse_args()
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        print("Parsing entries...")
        entries = parse_entries_csv(args.entries)
        print(f"Loaded {len(entries)} entries")
        
        print("Parsing timings...")
        timings = parse_timings_jsonl(args.timings)
        print(f"Loaded {len(timings)} timing points")
        
        print("Parsing rules...")
        rules = parse_rules_yaml(args.rules)
        print(f"Loaded rules for {rules.race_name}")
        
        appeals = []
        if args.appeals and os.path.exists(args.appeals):
            print("Parsing appeals...")
            appeals = parse_appeals_json(args.appeals)
            print(f"Loaded {len(appeals)} appeals")
        
        print("Arbitrating results...")
        arbitrator = Arbitrator(rules)
        result = arbitrator.process(entries, timings, appeals)
        
        print("Exporting results...")
        
        csv_path = output_dir / "results.csv"
        export_results_csv(result, str(csv_path))
        print(f"Results exported to {csv_path}")
        
        md_path = output_dir / "appeals_report.md"
        export_appeals_report_md(result, rules, str(md_path))
        print(f"Report exported to {md_path}")
        
        html_path = output_dir / "timeline.html"
        export_timeline_html(result, rules, str(html_path))
        print(f"Timeline exported to {html_path}")
        
        print("\nDone!")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
