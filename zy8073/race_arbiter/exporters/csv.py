import csv
from typing import Dict
from ..arbitration.arbitrator import ArbitrationResult, RunnerResult
from ..rules.engine import format_timedelta


def export_results_csv(result: ArbitrationResult, file_path: str):
    runners = sorted(result.runners.values(), key=lambda x: x.bib)
    
    fieldnames = [
        'bib', 'name', 'category', 'chip_id',
        'start_time', 'end_time', 'net_time',
        'is_dnf', 'is_dq', 'is_manual', 'violations'
    ]
    
    with open(file_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for runner in runners:
            row = {
                'bib': runner.bib,
                'name': runner.name,
                'category': runner.category,
                'chip_id': runner.chip_id,
                'start_time': runner.start_time.isoformat() if runner.start_time else '',
                'end_time': runner.end_time.isoformat() if runner.end_time else '',
                'net_time': format_timedelta(runner.net_time) if runner.net_time else '',
                'is_dnf': str(runner.is_dnf),
                'is_dq': str(runner.is_dq),
                'is_manual': str(runner.is_manual),
                'violations': '|'.join([v.type for v in runner.violations])
            }
            writer.writerow(row)
