from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from datetime import datetime
from .config import AppConfig
from .database import DatabaseManager
from .strategy import (
    BasePartitionStrategy, 
    PartitionStrategyFactory, 
    PartitionInfo,
    StrategyValidationResult
)


@dataclass
class ValidationIssue:
    type: str
    severity: str
    message: str
    affected_rows: Optional[int] = None
    sample_data: Optional[List[Dict[str, Any]]] = None


@dataclass
class ImpactAnalysis:
    total_rows_to_archive: int = 0
    total_partitions: int = 0
    rows_by_partition: Dict[str, int] = field(default_factory=dict)
    validation_issues: List[ValidationIssue] = field(default_factory=list)
    estimated_duration_minutes: float = 0.0


@dataclass
class PartitionSample:
    partition_name: str
    sample_rows: List[Dict[str, Any]]
    primary_keys: List[Any]
    total_count: int


@dataclass
class DryRunResult:
    success: bool
    partitions: List[PartitionInfo] = field(default_factory=list)
    impact_analysis: Optional[ImpactAnalysis] = None
    sql_statements: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    partition_samples: Dict[str, PartitionSample] = field(default_factory=dict)
    validation_issues_detailed: List[ValidationIssue] = field(default_factory=list)


@dataclass
class ArchiveRecord:
    partition_name: str
    primary_key_values: List[Any]
    count: int
    archive_time: datetime = field(default_factory=datetime.now)


class ArchiveExecutor:
    def __init__(self, config: AppConfig):
        self.config = config
        self.db_manager = DatabaseManager(config.database)
        self.strategy: Optional[BasePartitionStrategy] = None
        self._source_columns: Optional[List[str]] = None
    
    def initialize(self):
        self.strategy = PartitionStrategyFactory.get_strategy(self.config.archive.partition)
        self._source_columns = self.db_manager.get_table_columns(
            self.config.archive.source_table, 
            self.config.database.schema
        )
    
    def validate_strategy(self) -> StrategyValidationResult:
        if self.strategy is None:
            return StrategyValidationResult(
                valid=False,
                errors=["Strategy not initialized. Call initialize() first."]
            )
        return self.strategy.validate()
    
    def validate_table_structure(self) -> List[ValidationIssue]:
        issues = []
        
        source_table = self.config.archive.source_table
        target_table = self.config.archive.target_table
        schema = self.config.database.schema
        
        if not self.db_manager.table_exists(source_table, schema):
            issues.append(ValidationIssue(
                type="structure",
                severity="error",
                message=f"Source table '{source_table}' does not exist"
            ))
            return issues
        
        if not self.db_manager.table_exists(target_table, schema):
            issues.append(ValidationIssue(
                type="structure",
                severity="warning",
                message=f"Target table '{target_table}' does not exist. Will be created automatically."
            ))
        
        source_cols = set(self._source_columns or [])
        target_cols = set()
        
        if self.db_manager.table_exists(target_table, schema):
            target_cols = set(self.db_manager.get_table_columns(target_table, schema))
            
            if self.config.archive.validate_columns:
                missing_cols = [c for c in self.config.archive.validate_columns if c not in target_cols]
                for col in missing_cols:
                    issues.append(ValidationIssue(
                        type="structure",
                        severity="error",
                        message=f"Validation column '{col}' exists in source but not in target table"
                    ))
        
        return issues
    
    def _build_count_query(self, partition: PartitionInfo) -> str:
        base_sql = f"SELECT COUNT(*) as cnt FROM {self._get_full_table_name(self.config.archive.source_table)}"
        condition = partition.condition
        
        if self.config.archive.archive_condition:
            condition = f"({condition}) AND ({self.config.archive.archive_condition})"
        
        return f"{base_sql} WHERE {condition}"
    
    def _get_full_table_name(self, table: str) -> str:
        if self.config.database.schema:
            return f"{self.config.database.schema}.{table}"
        return table
    
    def analyze_impact(self, partitions: List[PartitionInfo]) -> ImpactAnalysis:
        analysis = ImpactAnalysis(total_partitions=len(partitions))
        
        for partition in partitions:
            try:
                query = self._build_count_query(partition)
                result = self.db_manager.execute_query(query, partition.parameters)
                row_count = int(result.iloc[0]['cnt'])
                
                partition.row_count = row_count
                analysis.rows_by_partition[partition.name] = row_count
                analysis.total_rows_to_archive += row_count
                
            except Exception as e:
                partition.status = "error"
                analysis.validation_issues.append(ValidationIssue(
                    type="query",
                    severity="error",
                    message=f"Failed to count rows for partition {partition.name}: {str(e)}"
                ))
        
        if analysis.total_rows_to_archive > 0:
            analysis.estimated_duration_minutes = (
                analysis.total_rows_to_archive / self.config.archive.batch_size * 0.1
            )
        
        return analysis
    
    def collect_partition_samples(
        self, 
        partitions: List[PartitionInfo]
    ) -> Tuple[Dict[str, PartitionSample], List[ValidationIssue]]:
        samples = {}
        issues = []
        
        for partition in partitions:
            if partition.row_count is None or partition.row_count == 0:
                continue
            
            try:
                select_sql = self.strategy.generate_select_sql(partition)
                select_sql = select_sql.format(
                    source_table=self._get_full_table_name(self.config.archive.source_table)
                )
                
                if self.config.archive.archive_condition:
                    select_sql = f"{select_sql} AND ({self.config.archive.archive_condition})"
                
                limit = self.config.report.sample_limit if self.config.report.include_sample_data else 0
                
                if limit > 0:
                    sample_sql = f"SELECT * FROM ({select_sql}) AS subquery LIMIT {limit}"
                    sample_data = self.db_manager.execute_query(sample_sql, partition.parameters)
                    sample_rows = sample_data.to_dict('records')
                    primary_keys_sample = sample_data[self.config.archive.primary_key].tolist()
                else:
                    sample_rows = []
                    primary_keys_sample = []
                
                pk_sql = f"SELECT {self.config.archive.primary_key} FROM ({select_sql}) AS subquery"
                pk_data = self.db_manager.execute_query(pk_sql, partition.parameters)
                all_primary_keys = pk_data[self.config.archive.primary_key].tolist()
                
                for col in self.config.archive.validate_columns:
                    if limit > 0 and col in sample_data.columns:
                        null_count = sample_data[col].isna().sum()
                        if null_count > 0:
                            null_rows = sample_data[sample_data[col].isna()]
                            null_sample = null_rows.head(min(5, len(null_rows))).to_dict('records')
                            
                            issues.append(ValidationIssue(
                                type="data",
                                severity="warning",
                                message=f"Partition {partition.name}: Column '{col}' has {null_count} NULL values in sample",
                                affected_rows=null_count,
                                sample_data=null_sample
                            ))
                
                samples[partition.name] = PartitionSample(
                    partition_name=partition.name,
                    sample_rows=sample_rows,
                    primary_keys=all_primary_keys,
                    total_count=partition.row_count or 0
                )
                
            except Exception as e:
                issues.append(ValidationIssue(
                    type="data",
                    severity="error",
                    message=f"Failed to collect samples for partition {partition.name}: {str(e)}"
                ))
        
        return samples, issues
    
    def validate_data_integrity(self, partitions: List[PartitionInfo]) -> List[ValidationIssue]:
        issues = []
        
        for partition in partitions:
            if partition.row_count is None or partition.row_count == 0:
                continue
            
            try:
                select_sql = self.strategy.generate_select_sql(partition)
                select_sql = select_sql.format(
                    source_table=self._get_full_table_name(self.config.archive.source_table)
                )
                
                if self.config.archive.archive_condition:
                    select_sql = f"{select_sql} AND ({self.config.archive.archive_condition})"
                
                select_sql = f"SELECT * FROM ({select_sql}) AS subquery LIMIT {self.config.report.sample_limit}"
                
                sample_data = self.db_manager.execute_query(select_sql, partition.parameters)
                
                for col in self.config.archive.validate_columns:
                    if col in sample_data.columns:
                        null_count = sample_data[col].isna().sum()
                        if null_count > 0:
                            issues.append(ValidationIssue(
                                type="data",
                                severity="warning",
                                message=f"Partition {partition.name}: Column '{col}' has {null_count} NULL values in sample",
                                affected_rows=null_count
                            ))
                
            except Exception as e:
                issues.append(ValidationIssue(
                    type="data",
                    severity="error",
                    message=f"Failed to validate data for partition {partition.name}: {str(e)}"
                ))
        
        return issues
    
    def generate_sql_statements(self, partitions: List[PartitionInfo]) -> List[Dict[str, Any]]:
        statements = []
        
        for partition in partitions:
            if partition.row_count == 0:
                continue
            
            select_sql = self.strategy.generate_select_sql(partition)
            select_sql = select_sql.format(
                source_table=self._get_full_table_name(self.config.archive.source_table)
            )
            
            if self.config.archive.archive_condition:
                select_sql = f"{select_sql} AND ({self.config.archive.archive_condition})"
            
            delete_sql = self.strategy.generate_delete_sql(partition)
            delete_sql = delete_sql.format(
                source_table=self._get_full_table_name(self.config.archive.source_table)
            )
            
            if self.config.archive.archive_condition:
                delete_sql = f"{delete_sql} AND ({self.config.archive.archive_condition})"
            
            statements.append({
                'partition_name': partition.name,
                'select_sql': select_sql,
                'delete_sql': delete_sql,
                'parameters': partition.parameters,
                'estimated_rows': partition.row_count
            })
        
        return statements
    
    def run_dry_run(self) -> DryRunResult:
        result = DryRunResult(success=True)
        
        try:
            self.initialize()
            
            strategy_validation = self.validate_strategy()
            if not strategy_validation.valid:
                result.success = False
                result.errors.extend(strategy_validation.errors)
                return result
            result.warnings.extend(strategy_validation.warnings)
            
            structure_issues = self.validate_table_structure()
            for issue in structure_issues:
                if issue.severity == 'error':
                    result.success = False
                    result.errors.append(issue.message)
                else:
                    result.warnings.append(issue.message)
            
            if not result.success:
                return result
            
            partitions = self.strategy.generate_partitions()
            result.partitions = partitions
            
            impact_analysis = self.analyze_impact(partitions)
            result.impact_analysis = impact_analysis
            
            if impact_analysis.validation_issues:
                for issue in impact_analysis.validation_issues:
                    if issue.severity == 'error':
                        result.errors.append(issue.message)
                    else:
                        result.warnings.append(issue.message)
            
            samples, sample_issues = self.collect_partition_samples(partitions)
            result.partition_samples = samples
            result.validation_issues_detailed = sample_issues
            
            for issue in sample_issues:
                if issue.severity == 'error':
                    result.errors.append(issue.message)
                else:
                    result.warnings.append(issue.message)
            
            result.sql_statements = self.generate_sql_statements(partitions)
            
        except Exception as e:
            result.success = False
            result.errors.append(f"Dry-run failed: {str(e)}")
        
        return result
    
    def _check_existing_records(self, data: pd.DataFrame) -> pd.DataFrame:
        target_table = self.config.archive.target_table
        pk = self.config.archive.primary_key
        schema = self.config.database.schema
        
        if not self.db_manager.table_exists(target_table, schema):
            return data
        
        pk_values = data[pk].tolist()
        if not pk_values:
            return data
        
        placeholders = ','.join([f':pk{i}' for i in range(len(pk_values))])
        params = {f'pk{i}': pk for i, pk in enumerate(pk_values)}
        
        check_sql = f"""
        SELECT {pk} FROM {self._get_full_table_name(target_table)}
        WHERE {pk} IN ({placeholders})
        """
        
        existing = self.db_manager.execute_query(check_sql, params)
        existing_pks = set(existing[pk].tolist())
        
        if existing_pks:
            new_data = data[~data[pk].isin(existing_pks)]
            return new_data
        
        return data
    
    def execute_archive(self) -> Tuple[bool, List[ArchiveRecord], List[str], Dict[str, int]]:
        records = []
        errors = []
        stats = {
            'total_checked': 0,
            'already_exists': 0,
            'newly_archived': 0
        }
        
        try:
            self.initialize()
            partitions = self.strategy.generate_partitions()
            self.analyze_impact(partitions)
            
            for partition in partitions:
                if partition.row_count is None or partition.row_count == 0:
                    continue
                
                try:
                    select_sql = self.strategy.generate_select_sql(partition)
                    select_sql = select_sql.format(
                        source_table=self._get_full_table_name(self.config.archive.source_table)
                    )
                    
                    if self.config.archive.archive_condition:
                        select_sql = f"{select_sql} AND ({self.config.archive.archive_condition})"
                    
                    data = self.db_manager.execute_query(select_sql, partition.parameters)
                    
                    if len(data) > 0:
                        stats['total_checked'] += len(data)
                        
                        data_to_archive = self._check_existing_records(data)
                        
                        existing_count = len(data) - len(data_to_archive)
                        if existing_count > 0:
                            stats['already_exists'] += existing_count
                        
                        if len(data_to_archive) > 0:
                            pk_values = data_to_archive[self.config.archive.primary_key].tolist()
                            stats['newly_archived'] += len(data_to_archive)
                            
                            data_to_archive.to_sql(
                                name=self.config.archive.target_table,
                                con=self.db_manager.connect(),
                                schema=self.config.database.schema,
                                if_exists='append',
                                index=False
                            )
                            
                            placeholders = ','.join([f':pk{i}' for i in range(len(pk_values))])
                            pk_params = {f'pk{i}': pk for i, pk in enumerate(pk_values)}
                            
                            delete_sql = f"""
                            DELETE FROM {self._get_full_table_name(self.config.archive.source_table)}
                            WHERE {self.config.archive.primary_key} IN ({placeholders})
                            """
                            
                            self.db_manager.execute_update(delete_sql, pk_params)
                            
                            records.append(ArchiveRecord(
                                partition_name=partition.name,
                                primary_key_values=pk_values,
                                count=len(pk_values)
                            ))
                        
                        partition.status = "completed"
                    
                except Exception as e:
                    partition.status = "error"
                    errors.append(f"Partition {partition.name} failed: {str(e)}")
            
        except Exception as e:
            errors.append(f"Archive execution failed: {str(e)}")
        
        return (len(errors) == 0, records, errors, stats)
