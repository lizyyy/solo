import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, Any, List, Optional
from tabulate import tabulate
from colorama import Fore, Style

from .executor import DryRunResult, ArchiveRecord, ImpactAnalysis


@dataclass
class ArchiveReport:
    report_type: str
    timestamp: str
    config: Dict[str, Any]
    summary: Dict[str, Any]
    details: Dict[str, Any]
    sql_snippets: List[Dict[str, Any]]
    rollback_plan: Dict[str, Any]
    metadata: Dict[str, Any]


class ReportGenerator:
    def __init__(self, output_dir: str = './archive_reports'):
        self.output_dir = output_dir
        self._ensure_output_dir()
    
    def _ensure_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
    
    def _get_report_path(self, prefix: str, format: str = 'json') -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return os.path.join(self.output_dir, f'{prefix}_{timestamp}.{format}')
    
    def _serialize_for_json(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        if isinstance(obj, dict):
            return {k: self._serialize_for_json(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._serialize_for_json(item) for item in obj]
        return obj
    
    def generate_dry_run_report(
        self, 
        dry_run_result: DryRunResult, 
        config: Dict[str, Any]
    ) -> ArchiveReport:
        timestamp = datetime.now()
        
        summary = {
            'success': dry_run_result.success,
            'total_partitions': len(dry_run_result.partitions),
            'partitions_with_data': 0,
            'total_rows_to_archive': 0,
            'total_rows_by_partition': {},
            'estimated_duration_minutes': 0.0,
            'error_count': len(dry_run_result.errors),
            'warning_count': len(dry_run_result.warnings)
        }
        
        if dry_run_result.impact_analysis:
            summary['total_rows_to_archive'] = dry_run_result.impact_analysis.total_rows_to_archive
            summary['rows_by_partition'] = dry_run_result.impact_analysis.rows_by_partition
            summary['estimated_duration_minutes'] = dry_run_result.impact_analysis.estimated_duration_minutes
            
            for partition_name, row_count in dry_run_result.impact_analysis.rows_by_partition.items():
                if row_count > 0:
                    summary['partitions_with_data'] += 1
        
        details = {
            'errors': dry_run_result.errors,
            'warnings': dry_run_result.warnings,
            'partitions': []
        }
        
        for partition in dry_run_result.partitions:
            details['partitions'].append({
                'name': partition.name,
                'condition': partition.condition,
                'parameters': partition.parameters,
                'row_count': partition.row_count,
                'status': partition.status
            })
        
        sql_snippets = []
        for stmt in dry_run_result.sql_statements:
            sql_snippets.append({
                'partition_name': stmt['partition_name'],
                'operation': 'SELECT (Archive)',
                'sql': stmt['select_sql'],
                'parameters': stmt['parameters'],
                'estimated_rows': stmt['estimated_rows']
            })
            sql_snippets.append({
                'partition_name': stmt['partition_name'],
                'operation': 'DELETE (Cleanup)',
                'sql': stmt['delete_sql'],
                'parameters': stmt['parameters'],
                'estimated_rows': stmt['estimated_rows']
            })
        
        rollback_plan = self._generate_rollback_plan(dry_run_result)
        
        report = ArchiveReport(
            report_type='dry_run',
            timestamp=timestamp.isoformat(),
            config=config,
            summary=summary,
            details=details,
            sql_snippets=sql_snippets,
            rollback_plan=rollback_plan,
            metadata={
                'generated_at': timestamp.isoformat(),
                'version': '0.1.0',
                'source': 'archive-cli'
            }
        )
        
        return report
    
    def _generate_rollback_plan(self, dry_run_result: DryRunResult) -> Dict[str, Any]:
        rollback_steps = []
        
        for stmt in dry_run_result.sql_statements:
            rollback_steps.append({
                'step': f"Restore partition: {stmt['partition_name']}",
                'action': 'INSERT BACK',
                'source_query': stmt['select_sql'],
                'target_table': 'original_table',
                'condition': stmt['delete_sql'],
                'estimated_rows': stmt['estimated_rows']
            })
        
        return {
            'description': 'Rollback plan to restore archived data',
            'steps': rollback_steps,
            'validation_checks': [
                'Verify target table exists before restore',
                'Check for primary key conflicts',
                'Verify row count matches original',
                'Compare hash checksums if available'
            ]
        }
    
    def save_report_json(self, report: ArchiveReport, filename: Optional[str] = None) -> str:
        if filename is None:
            filename = self._get_report_path(report.report_type, 'json')
        
        report_dict = asdict(report)
        report_dict = self._serialize_for_json(report_dict)
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_dict, f, indent=2, ensure_ascii=False)
        
        return filename
    
    def print_console_report(self, report: ArchiveReport):
        print("\n" + "="*80)
        print(f"ARCHIVE {report.report_type.upper()} REPORT")
        print("="*80)
        print(f"\nGenerated at: {report.timestamp}")
        
        print("\n" + "-"*80)
        print("SUMMARY")
        print("-"*80)
        
        summary = report.summary
        status_color = Fore.GREEN if summary.get('success') else Fore.RED
        print(f"\nStatus: {status_color}{'SUCCESS' if summary.get('success') else 'FAILED'}{Style.RESET_ALL}")
        print(f"Total partitions: {summary.get('total_partitions', 0)}")
        print(f"Partitions with data: {summary.get('partitions_with_data', 0)}")
        print(f"Total rows to archive: {summary.get('total_rows_to_archive', 0):,}")
        print(f"Estimated duration: {summary.get('estimated_duration_minutes', 0):.2f} minutes")
        print(f"Errors: {Fore.RED}{summary.get('error_count', 0)}{Style.RESET_ALL}")
        print(f"Warnings: {Fore.YELLOW}{summary.get('warning_count', 0)}{Style.RESET_ALL}")
        
        if summary.get('rows_by_partition'):
            print("\nRows by partition:")
            table_data = [
                [name, count] 
                for name, count in summary['rows_by_partition'].items()
            ]
            print(tabulate(table_data, headers=['Partition', 'Row Count'], tablefmt='grid'))
        
        if report.details.get('errors'):
            print(f"\n{Fore.RED}ERRORS:{Style.RESET_ALL}")
            for error in report.details['errors']:
                print(f"  - {error}")
        
        if report.details.get('warnings'):
            print(f"\n{Fore.YELLOW}WARNINGS:{Style.RESET_ALL}")
            for warning in report.details['warnings']:
                print(f"  - {warning}")
        
        if report.sql_snippets:
            print("\n" + "-"*80)
            print("SQL Snippets (first 5 shown)")
            print("-"*80)
            
            for i, snippet in enumerate(report.sql_snippets[:5]):
                print(f"\n[{snippet['partition_name']}] {snippet['operation']}:")
                print(f"  Estimated rows: {snippet['estimated_rows']:,}")
                print(f"  SQL: {snippet['sql'][:100]}..." if len(snippet['sql']) > 100 else f"  SQL: {snippet['sql']}")
        
        print("\n" + "="*80)
    
    def save_sql_snippets(self, report: ArchiveReport, filename: Optional[str] = None) -> str:
        if filename is None:
            filename = self._get_report_path(f"{report.report_type}_sql", 'sql')
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"-- SQL Snippets for Archive Operation\n")
            f.write(f"-- Generated at: {report.timestamp}\n")
            f.write(f"-- Report type: {report.report_type}\n\n")
            
            for snippet in report.sql_snippets:
                f.write(f"\n-- ========================================\n")
                f.write(f"-- Partition: {snippet['partition_name']}\n")
                f.write(f"-- Operation: {snippet['operation']}\n")
                f.write(f"-- Estimated rows: {snippet['estimated_rows']:,}\n")
                f.write(f"-- Parameters: {snippet['parameters']}\n")
                f.write(f"-- ========================================\n")
                f.write(f"{snippet['sql']}\n")
                f.write(f"\n")
        
        return filename
    
    def save_rollback_plan(self, report: ArchiveReport, filename: Optional[str] = None) -> str:
        if filename is None:
            filename = self._get_report_path(f"{report.report_type}_rollback", 'md')
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"# Rollback Plan\n\n")
            f.write(f"**Generated at**: {report.timestamp}\n\n")
            
            f.write(f"## Description\n")
            f.write(f"{report.rollback_plan.get('description', '')}\n\n")
            
            f.write(f"## Rollback Steps\n\n")
            for i, step in enumerate(report.rollback_plan.get('steps', []), 1):
                f.write(f"### Step {i}: {step['step']}\n\n")
                f.write(f"- **Action**: {step['action']}\n")
                f.write(f"- **Estimated rows**: {step.get('estimated_rows', 0):,}\n")
                f.write(f"- **Source query**: `{step['source_query'][:100]}...`\n\n")
            
            f.write(f"## Validation Checks\n\n")
            for check in report.rollback_plan.get('validation_checks', []):
                f.write(f"- [ ] {check}\n")
        
        return filename
