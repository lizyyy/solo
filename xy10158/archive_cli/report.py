import json
import os
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, Any, List, Optional
from tabulate import tabulate
from colorama import Fore, Style

from .executor import DryRunResult, ArchiveRecord, ImpactAnalysis, PartitionSample


@dataclass
class ArchiveReport:
    report_type: str
    timestamp: str
    config: Dict[str, Any]
    config_file_path: Optional[str]
    execution_command: Optional[str]
    summary: Dict[str, Any]
    details: Dict[str, Any]
    partition_samples: Dict[str, Any]
    validation_issues: List[Dict[str, Any]]
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
        config: Dict[str, Any],
        config_file_path: Optional[str] = None,
        execution_command: Optional[str] = None
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
            'warning_count': len(dry_run_result.warnings),
            'partitions_with_samples': len(dry_run_result.partition_samples)
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
        
        partition_samples = {}
        for name, sample in dry_run_result.partition_samples.items():
            partition_samples[name] = {
                'partition_name': sample.partition_name,
                'sample_rows': sample.sample_rows,
                'sample_count': len(sample.sample_rows),
                'primary_keys': sample.primary_keys,
                'primary_key_count': len(sample.primary_keys),
                'total_count': sample.total_count
            }
        
        validation_issues = []
        for issue in dry_run_result.validation_issues_detailed:
            validation_issues.append({
                'type': issue.type,
                'severity': issue.severity,
                'message': issue.message,
                'affected_rows': issue.affected_rows,
                'sample_data': issue.sample_data
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
        
        rollback_plan = self._generate_rollback_plan(dry_run_result, config)
        
        report = ArchiveReport(
            report_type='dry_run',
            timestamp=timestamp.isoformat(),
            config=config,
            config_file_path=config_file_path,
            execution_command=execution_command,
            summary=summary,
            details=details,
            partition_samples=partition_samples,
            validation_issues=validation_issues,
            sql_snippets=sql_snippets,
            rollback_plan=rollback_plan,
            metadata={
                'generated_at': timestamp.isoformat(),
                'version': '0.1.0',
                'source': 'archive-cli',
                'command_line': ' '.join(sys.argv) if len(sys.argv) > 0 else None
            }
        )
        
        return report
    
    def _generate_rollback_plan(self, dry_run_result: DryRunResult, config: Dict[str, Any]) -> Dict[str, Any]:
        rollback_steps = []
        all_primary_keys = []
        
        source_table = config.get('archive', {}).get('source_table', 'source_table')
        target_table = config.get('archive', {}).get('target_table', 'target_table')
        primary_key = config.get('archive', {}).get('primary_key', 'id')
        schema = config.get('database', {}).get('schema')
        
        full_source = f"{schema}.{source_table}" if schema else source_table
        full_target = f"{schema}.{target_table}" if schema else target_table
        
        processed_partitions = set()
        
        for stmt in dry_run_result.sql_statements:
            partition_name = stmt['partition_name']
            
            if partition_name in processed_partitions:
                continue
            processed_partitions.add(partition_name)
            
            sample = dry_run_result.partition_samples.get(partition_name)
            primary_keys = sample.primary_keys if sample else []
            all_primary_keys.extend(primary_keys)
            
            pk_placeholders = ','.join([f"'{pk}'" for pk in primary_keys[:5]])
            if len(primary_keys) > 5:
                pk_placeholders += ", ..."
            
            rollback_select_sql = f"SELECT * FROM {full_target} WHERE {primary_key} IN ({pk_placeholders})"
            rollback_delete_sql = f"DELETE FROM {full_target} WHERE {primary_key} IN ({pk_placeholders})"
            
            rollback_steps.append({
                'step': f"Restore partition: {partition_name}",
                'action': 'INSERT BACK from archive to source',
                'source_table': full_target,
                'target_table': full_source,
                'primary_key_column': primary_key,
                'primary_keys_sample': primary_keys[:10],
                'primary_keys_count': len(primary_keys),
                'select_sql': rollback_select_sql,
                'delete_sql': rollback_delete_sql,
                'original_archive_query': stmt['select_sql'],
                'original_delete_query': stmt['delete_sql'],
                'estimated_rows': stmt['estimated_rows']
            })
        
        return {
            'description': 'Rollback plan to restore archived data from archive table to source table',
            'summary': {
                'total_partitions': len(processed_partitions),
                'total_primary_keys': len(all_primary_keys),
                'source_table': full_source,
                'target_table': full_target,
                'primary_key_column': primary_key
            },
            'steps': rollback_steps,
            'all_primary_keys': all_primary_keys,
            'executable_rollback_sql': {
                'select_all_archived': f"SELECT * FROM {full_target}",
                'restore_template': f"INSERT INTO {full_source} SELECT * FROM {full_target} WHERE {primary_key} IN (<PK_LIST>)",
                'cleanup_template': f"DELETE FROM {full_target} WHERE {primary_key} IN (<PK_LIST>)"
            },
            'validation_checks': [
                f'Verify archive table {full_target} exists before restore',
                f'Check for primary key conflicts in {full_source}',
                'Verify row count matches original archive count',
                'Compare hash checksums if available',
                'Run in dry-run mode first to validate restore queries'
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
        
        if report.config_file_path:
            print(f"Config file: {report.config_file_path}")
        if report.execution_command:
            print(f"Command: {report.execution_command}")
        
        print("\n" + "-"*80)
        print("SUMMARY")
        print("-"*80)
        
        summary = report.summary
        status_color = Fore.GREEN if summary.get('success') else Fore.RED
        print(f"\nStatus: {status_color}{'SUCCESS' if summary.get('success') else 'FAILED'}{Style.RESET_ALL}")
        print(f"Total partitions: {summary.get('total_partitions', 0)}")
        print(f"Partitions with data: {summary.get('partitions_with_data', 0)}")
        print(f"Partitions with samples: {summary.get('partitions_with_samples', 0)}")
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
        
        if report.partition_samples:
            print("\n" + "-"*80)
            print("PARTITION SAMPLES & PRIMARY KEYS")
            print("-"*80)
            
            for name, sample in report.partition_samples.items():
                pk_count = sample.get('primary_key_count', 0)
                sample_count = sample.get('sample_count', 0)
                pks = sample.get('primary_keys', [])[:5]
                
                print(f"\n{Fore.CYAN}{name}{Style.RESET_ALL}:")
                print(f"  Total rows: {sample.get('total_count', 0)}")
                print(f"  Primary keys collected: {pk_count}")
                if pks:
                    print(f"  PK sample: {pks}{'...' if pk_count > 5 else ''}")
                if sample_count > 0:
                    print(f"  Sample rows collected: {sample_count}")
        
        if report.validation_issues:
            print("\n" + "-"*80)
            print("DETAILED VALIDATION ISSUES")
            print("-"*80)
            
            for issue in report.validation_issues:
                severity_color = Fore.RED if issue['severity'] == 'error' else Fore.YELLOW
                print(f"\n{severity_color}[{issue['severity'].upper()}]{Style.RESET_ALL} {issue['type']}: {issue['message']}")
                if issue.get('affected_rows'):
                    print(f"  Affected rows: {issue['affected_rows']}")
                if issue.get('sample_data'):
                    print(f"  Sample of affected rows: {issue['sample_data'][:2]}")
        
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
            
            if report.config_file_path:
                f.write(f"**Config file**: `{report.config_file_path}`\n\n")
            
            summary = report.rollback_plan.get('summary', {})
            if summary:
                f.write(f"## Summary\n\n")
                f.write(f"- **Total partitions**: {summary.get('total_partitions', 0)}\n")
                f.write(f"- **Total primary keys**: {summary.get('total_primary_keys', 0):,}\n")
                f.write(f"- **Source table (to restore to)**: `{summary.get('source_table', 'N/A')}`\n")
                f.write(f"- **Archive table (to restore from)**: `{summary.get('target_table', 'N/A')}`\n")
                f.write(f"- **Primary key column**: `{summary.get('primary_key_column', 'N/A')}`\n\n")
            
            f.write(f"## Description\n")
            f.write(f"{report.rollback_plan.get('description', '')}\n\n")
            
            executable_sql = report.rollback_plan.get('executable_rollback_sql', {})
            if executable_sql:
                f.write(f"## Executable SQL Templates\n\n")
                f.write(f"### 1. Query all archived records\n")
                f.write(f"```sql\n{executable_sql.get('select_all_archived', '')}\n```\n\n")
                
                f.write(f"### 2. Restore template (replace <PK_LIST>)\n")
                f.write(f"```sql\n{executable_sql.get('restore_template', '')}\n```\n\n")
                
                f.write(f"### 3. Cleanup template (after successful restore)\n")
                f.write(f"```sql\n{executable_sql.get('cleanup_template', '')}\n```\n\n")
            
            all_pks = report.rollback_plan.get('all_primary_keys', [])
            if all_pks:
                f.write(f"## Complete Primary Key List\n\n")
                f.write(f"**Total keys**: {len(all_pks):,}\n\n")
                f.write(f"```\n")
                for i, pk in enumerate(all_pks, 1):
                    f.write(f"{pk}")
                    if i < len(all_pks):
                        f.write(", ")
                    if i % 10 == 0:
                        f.write("\n")
                f.write(f"\n```\n\n")
            
            f.write(f"## Rollback Steps\n\n")
            for i, step in enumerate(report.rollback_plan.get('steps', []), 1):
                f.write(f"### Step {i}: {step['step']}\n\n")
                f.write(f"- **Action**: {step['action']}\n")
                f.write(f"- **Estimated rows**: {step.get('estimated_rows', 0):,}\n")
                f.write(f"- **From table**: `{step.get('source_table', 'N/A')}`\n")
                f.write(f"- **To table**: `{step.get('target_table', 'N/A')}`\n")
                f.write(f"- **Primary key column**: `{step.get('primary_key_column', 'N/A')}`\n")
                f.write(f"- **Primary keys count**: {step.get('primary_keys_count', 0):,}\n")
                
                pk_sample = step.get('primary_keys_sample', [])
                if pk_sample:
                    f.write(f"- **PK sample**: `{pk_sample}`\n")
                
                f.write(f"\n#### SQL to restore this partition:\n")
                f.write(f"```sql\n{step.get('select_sql', 'N/A')}\n```\n\n")
                
                f.write(f"#### Original archive queries (for reference):\n")
                f.write(f"- Archive SELECT: `{step.get('original_archive_query', 'N/A')[:150]}...`\n")
                f.write(f"- Original DELETE: `{step.get('original_delete_query', 'N/A')[:150]}...`\n\n")
            
            f.write(f"## Validation Checks\n\n")
            for check in report.rollback_plan.get('validation_checks', []):
                f.write(f"- [ ] {check}\n")
        
        return filename
