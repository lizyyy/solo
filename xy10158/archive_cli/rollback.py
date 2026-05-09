import json
import os
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy import text

from .config import AppConfig
from .database import DatabaseManager
from .executor import ArchiveRecord


@dataclass
class RollbackResult:
    success: bool
    restored_partitions: List[str] = field(default_factory=list)
    failed_partitions: List[str] = field(default_factory=list)
    total_restored_rows: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class RollbackEntry:
    partition_name: str
    primary_keys: List[Any]
    source_table: str
    target_table: str
    archive_time: str


class RollbackManager:
    def __init__(self, config: AppConfig):
        self.config = config
        self.db_manager = DatabaseManager(config.database)
        self.rollback_dir = os.path.join(config.report.output_dir, 'rollback_records')
        self._ensure_rollback_dir()
    
    def _ensure_rollback_dir(self):
        if not os.path.exists(self.rollback_dir):
            os.makedirs(self.rollback_dir)
    
    def _get_rollback_file_path(self, timestamp: str) -> str:
        return os.path.join(self.rollback_dir, f'rollback_{timestamp}.json')
    
    def save_archive_record(self, records: List[ArchiveRecord]) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = self._get_rollback_file_path(timestamp)
        
        rollback_data = {
            'timestamp': timestamp,
            'archive_config': {
                'source_table': self.config.archive.source_table,
                'target_table': self.config.archive.target_table,
                'primary_key': self.config.archive.primary_key,
                'schema': self.config.database.schema
            },
            'records': []
        }
        
        for record in records:
            rollback_data['records'].append({
                'partition_name': record.partition_name,
                'primary_keys': record.primary_key_values,
                'count': record.count,
                'archive_time': record.archive_time.isoformat()
            })
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(rollback_data, f, indent=2, ensure_ascii=False)
        
        return file_path
    
    def list_available_rollbacks(self) -> List[Dict[str, Any]]:
        rollbacks = []
        
        for filename in os.listdir(self.rollback_dir):
            if filename.startswith('rollback_') and filename.endswith('.json'):
                file_path = os.path.join(self.rollback_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    total_rows = sum(r.get('count', 0) for r in data.get('records', []))
                    
                    rollbacks.append({
                        'timestamp': data.get('timestamp'),
                        'source_table': data.get('archive_config', {}).get('source_table'),
                        'target_table': data.get('archive_config', {}).get('target_table'),
                        'total_records': len(data.get('records', [])),
                        'total_rows': total_rows,
                        'file_path': file_path
                    })
                except Exception as e:
                    continue
        
        return sorted(rollbacks, key=lambda x: x['timestamp'], reverse=True)
    
    def load_rollback_data(self, timestamp: str) -> Optional[Dict[str, Any]]:
        file_path = self._get_rollback_file_path(timestamp)
        
        if not os.path.exists(file_path):
            for rb in self.list_available_rollbacks():
                if rb['timestamp'].startswith(timestamp):
                    file_path = rb['file_path']
                    break
        
        if not os.path.exists(file_path):
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _get_full_table_name(self, table: str) -> str:
        if self.config.database.schema:
            return f"{self.config.database.schema}.{table}"
        return table
    
    def execute_rollback(self, timestamp: str, dry_run: bool = True) -> RollbackResult:
        result = RollbackResult(success=True)
        
        rollback_data = self.load_rollback_data(timestamp)
        if rollback_data is None:
            result.success = False
            result.errors.append(f"No rollback record found for timestamp: {timestamp}")
            return result
        
        archive_config = rollback_data.get('archive_config', {})
        source_table = archive_config.get('source_table', self.config.archive.source_table)
        target_table = archive_config.get('target_table', self.config.archive.target_table)
        primary_key = archive_config.get('primary_key', self.config.archive.primary_key)
        
        if not self.db_manager.table_exists(target_table, self.config.database.schema):
            result.success = False
            result.errors.append(f"Target archive table '{target_table}' does not exist")
            return result
        
        records = rollback_data.get('records', [])
        
        for record in records:
            partition_name = record.get('partition_name')
            primary_keys = record.get('primary_keys', [])
            
            if not primary_keys:
                result.warnings.append(f"Partition {partition_name} has no primary keys to restore")
                continue
            
            try:
                placeholders = ','.join([f':pk{i}' for i in range(len(primary_keys))])
                params = {f'pk{i}': pk for i, pk in enumerate(primary_keys)}
                
                select_sql = f"""
                SELECT * FROM {self._get_full_table_name(target_table)}
                WHERE {primary_key} IN ({placeholders})
                """
                
                if dry_run:
                    result.restored_partitions.append(partition_name)
                    result.total_restored_rows += len(primary_keys)
                    result.warnings.append(
                        f"[DRY-RUN] Would restore {len(primary_keys)} rows from partition {partition_name}"
                    )
                    continue
                
                data = self.db_manager.execute_query(select_sql, params)
                
                if len(data) > 0:
                    data.to_sql(
                        name=source_table,
                        con=self.db_manager.connect(),
                        schema=self.config.database.schema,
                        if_exists='append',
                        index=False
                    )
                    
                    delete_sql = f"""
                    DELETE FROM {self._get_full_table_name(target_table)}
                    WHERE {primary_key} IN ({placeholders})
                    """
                    
                    self.db_manager.execute_update(delete_sql, params)
                    
                    result.restored_partitions.append(partition_name)
                    result.total_restored_rows += len(data)
                    
                else:
                    result.warnings.append(f"Partition {partition_name}: No data found in archive table")
                
            except Exception as e:
                result.success = False
                result.failed_partitions.append(partition_name)
                result.errors.append(f"Partition {partition_name} rollback failed: {str(e)}")
        
        return result
    
    def validate_rollback(self, timestamp: str) -> Dict[str, Any]:
        rollback_data = self.load_rollback_data(timestamp)
        if rollback_data is None:
            return {'valid': False, 'errors': ['Rollback record not found']}
        
        archive_config = rollback_data.get('archive_config', {})
        target_table = archive_config.get('target_table')
        primary_key = archive_config.get('primary_key')
        
        validation = {
            'valid': True,
            'checks': [],
            'summary': {}
        }
        
        if not self.db_manager.table_exists(target_table, self.config.database.schema):
            validation['valid'] = False
            validation['checks'].append({
                'check': 'archive_table_exists',
                'status': 'failed',
                'message': f"Archive table '{target_table}' does not exist"
            })
        else:
            validation['checks'].append({
                'check': 'archive_table_exists',
                'status': 'passed',
                'message': f"Archive table '{target_table}' exists"
            })
        
        total_expected = 0
        for record in rollback_data.get('records', []):
            total_expected += record.get('count', 0)
        
        validation['summary']['expected_rows'] = total_expected
        validation['summary']['partitions'] = len(rollback_data.get('records', []))
        
        return validation
    
    def generate_rollback_report(self, result: RollbackResult, timestamp: str) -> Dict[str, Any]:
        return {
            'rollback_timestamp': datetime.now().isoformat(),
            'archive_timestamp': timestamp,
            'success': result.success,
            'summary': {
                'total_restored': result.total_restored_rows,
                'partitions_restored': len(result.restored_partitions),
                'partitions_failed': len(result.failed_partitions)
            },
            'details': {
                'restored_partitions': result.restored_partitions,
                'failed_partitions': result.failed_partitions,
                'errors': result.errors,
                'warnings': result.warnings
            }
        }
