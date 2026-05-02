#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from race_arbiter.parsers.entries import parse_entries_csv
from race_arbiter.parsers.timings import parse_timings_jsonl
from race_arbiter.parsers.rules import parse_rules_yaml
from race_arbiter.parsers.appeals import parse_appeals_json
from race_arbiter.arbitration.arbitrator import Arbitrator
from race_arbiter.exporters.csv import export_results_csv
from race_arbiter.exporters.markdown import export_appeals_report_md
from race_arbiter.exporters.html import export_timeline_html
import os

os.makedirs('output', exist_ok=True)

print("Parsing entries...")
entries = parse_entries_csv('data/examples/entries.csv')
print(f"Loaded {len(entries)} entries")

print("Parsing timings...")
timings = parse_timings_jsonl('data/examples/timings.jsonl')
print(f"Loaded {len(timings)} timing points")

print("Parsing rules...")
rules = parse_rules_yaml('data/examples/rules.yaml')
print(f"Loaded rules for {rules.race_name}")

print("Parsing appeals...")
appeals = parse_appeals_json('data/examples/appeals.json')
print(f"Loaded {len(appeals)} appeals")

print("Arbitrating results...")
arbitrator = Arbitrator(rules)
result = arbitrator.process(entries, timings, appeals)

print("Exporting results...")
export_results_csv(result, 'output/results.csv')
print("Results exported to output/results.csv")

export_appeals_report_md(result, rules, 'output/appeals_report.md')
print("Report exported to output/appeals_report.md")

export_timeline_html(result, rules, 'output/timeline.html')
print("Timeline exported to output/timeline.html")

print("\nDone!")
