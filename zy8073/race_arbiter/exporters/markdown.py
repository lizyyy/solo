from typing import Dict
from datetime import datetime
from ..arbitration.arbitrator import ArbitrationResult, RunnerResult, Violation
from ..rules.engine import format_timedelta
from ..parsers.rules import RaceRules


def export_appeals_report_md(result: ArbitrationResult, rules: RaceRules, file_path: str):
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(f"# {rules.race_name} - Arbitration Report\n\n")
        f.write(f"Generated: {datetime.now().isoformat()}\n\n")
        
        f.write("## Summary\n\n")
        total = len(result.runners)
        dnf = sum(1 for r in result.runners.values() if r.is_dnf)
        dq = sum(1 for r in result.runners.values() if r.is_dq)
        manual = sum(1 for r in result.runners.values() if r.is_manual)
        f.write(f"- Total runners: {total}\n")
        f.write(f"- Finished: {total - dnf}\n")
        f.write(f"- DNF: {dnf}\n")
        f.write(f"- DQ: {dq}\n")
        f.write(f"- Manual adjustments: {manual}\n")
        f.write(f"- Unassigned chips: {len(result.unassigned_chips)}\n")
        f.write(f"- Duplicate chips: {len(result.duplicate_chips)}\n\n")
        
        f.write("---\n\n")
        
        f.write("## Violations by Runner\n\n")
        for bib, runner in sorted(result.runners.items()):
            if runner.violations:
                f.write(f"### {runner.name} (#{bib})\n\n")
                f.write(f"- Chip: {runner.chip_id}\n")
                if runner.net_time:
                    f.write(f"- Net time: {format_timedelta(runner.net_time)}\n")
                if runner.is_dnf:
                    f.write(f"- **DNF**\n")
                f.write("\n")
                for v in runner.violations:
                    icon = "⚠️" if v.severity == "warning" else "❌" if v.severity == "error" else "ℹ️"
                    f.write(f"{icon} **{v.type}**: {v.description}\n")
                f.write("\n")
        
        if result.unassigned_chips:
            f.write("---\n\n")
            f.write("## Unassigned Chips\n\n")
            for tp in result.unassigned_chips:
                f.write(f"- Chip {tp.chip_id} at {tp.mat_id} on {tp.timestamp.isoformat()}\n")
            f.write("\n")
        
        if result.duplicate_chips:
            f.write("---\n\n")
            f.write("## Duplicate Passes\n\n")
            for chip_id, tps in result.duplicate_chips.items():
                f.write(f"### Chip {chip_id}\n\n")
                for tp in tps:
                    f.write(f"- {tp.mat_id} at {tp.timestamp.isoformat()}\n")
                f.write("\n")
