import os
import uuid
import yaml
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.db.sqlite_manager import SQLiteManager, TempSQLiteDatabase, QueryResult, ExplainPlan
from app.validator.result_comparator import ResultComparator, ComparisonResult


class ValidationStatus(Enum):
    PENDING = 'pending'
    RUNNING = 'running'
    PASSED = 'passed'
    FAILED = 'failed'
    ERROR = 'error'
    MANUALLY_CONFIRMED = 'manually_confirmed'


@dataclass
class ValidationCase:
    case_id: str
    name: str
    original_sql: str
    optimized_sql: str
    description: str = ''
    tags: List[str] = field(default_factory=list)
    
    status: ValidationStatus = ValidationStatus.PENDING
    comparison_result: Optional[ComparisonResult] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    suggestions: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'case_id': self.case_id,
            'name': self.name,
            'original_sql': self.original_sql,
            'optimized_sql': self.optimized_sql,
            'description': self.description,
            'tags': self.tags,
            'status': self.status.value if self.status else None,
            'error_message': self.error_message,
            'comparison_result': self.comparison_result.to_dict() if self.comparison_result else None,
            'suggestions': self.suggestions,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }


@dataclass
class ValidationResult:
    validation_id: str
    name: str
    status: ValidationStatus
    
    cases: List[ValidationCase] = field(default_factory=list)
    
    passed_count: int = 0
    failed_count: int = 0
    error_count: int = 0
    
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    schema_imported: bool = False
    data_imported: bool = False
    
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'validation_id': self.validation_id,
            'name': self.name,
            'status': self.status.value,
            'total_cases': len(self.cases),
            'passed_count': self.passed_count,
            'failed_count': self.failed_count,
            'error_count': self.error_count,
            'schema_imported': self.schema_imported,
            'data_imported': self.data_imported,
            'error_message': self.error_message,
            'cases': [case.to_dict() for case in self.cases],
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }


class SQLValidator:
    def __init__(self, sqlite_manager: SQLiteManager, sql_timeout: int = 30):
        self.sqlite_manager = sqlite_manager
        self.sql_timeout = sql_timeout
        self.comparator = ResultComparator()
    
    def parse_cases_from_yaml(self, yaml_content: str) -> List[ValidationCase]:
        cases = []
        try:
            data = yaml.safe_load(yaml_content)
            
            if data and isinstance(data, dict):
                if 'cases' in data:
                    case_list = data['cases']
                else:
                    case_list = [data]
            elif data and isinstance(data, list):
                case_list = data
            else:
                case_list = []
            
            for i, case_data in enumerate(case_list):
                case_id = case_data.get('case_id', f'case_{uuid.uuid4().hex[:8]}')
                name = case_data.get('name', f'Case {i+1}')
                
                original_sql = case_data.get('original_sql') or case_data.get('original')
                optimized_sql = case_data.get('optimized_sql') or case_data.get('optimized')
                
                if not original_sql or not optimized_sql:
                    continue
                
                case = ValidationCase(
                    case_id=case_id,
                    name=name,
                    original_sql=original_sql.strip(),
                    optimized_sql=optimized_sql.strip(),
                    description=case_data.get('description', ''),
                    tags=case_data.get('tags', [])
                )
                cases.append(case)
            
        except yaml.YAMLError as e:
            raise ValueError(f'YAML 解析错误: {e}')
        
        return cases
    
    def create_validation(self, name: str = 'Unnamed Validation') -> ValidationResult:
        validation_id = uuid.uuid4().hex
        return ValidationResult(
            validation_id=validation_id,
            name=name,
            status=ValidationStatus.PENDING
        )
    
    def run_validation(
        self,
        validation: ValidationResult,
        schema_sql: str,
        seed_csv: str,
        cases: List[ValidationCase],
        csv_table_name: Optional[str] = None
    ) -> ValidationResult:
        
        validation.started_at = datetime.now()
        validation.status = ValidationStatus.RUNNING
        validation.cases = cases
        
        db_id, db = None, None
        
        try:
            db_id, db = self.sqlite_manager.create_database()
            
            schema_result = db.execute_schema(schema_sql)
            if not schema_result['success']:
                validation.status = ValidationStatus.ERROR
                validation.error_message = f'Schema 导入失败: {schema_result["error"]}'
                validation.completed_at = datetime.now()
                return validation
            
            validation.schema_imported = True
            
            if seed_csv and seed_csv.strip():
                tables = db.list_tables()
                if tables:
                    if csv_table_name and csv_table_name in tables:
                        table_to_import = csv_table_name
                    else:
                        table_to_import = tables[0]
                    
                    csv_result = db.import_csv(table_to_import, seed_csv)
                    if csv_result['success']:
                        validation.data_imported = True
                    else:
                        validation.error_message = f'数据导入警告: {csv_result["error"]}'
            
            for case in validation.cases:
                self._run_case(case, db)
                
                if case.status == ValidationStatus.PASSED:
                    validation.passed_count += 1
                elif case.status == ValidationStatus.FAILED:
                    validation.failed_count += 1
                elif case.status == ValidationStatus.ERROR:
                    validation.error_count += 1
            
            if validation.error_count == 0 and validation.failed_count == 0:
                validation.status = ValidationStatus.PASSED
            elif validation.error_count > 0:
                validation.status = ValidationStatus.ERROR
            else:
                validation.status = ValidationStatus.FAILED
            
        except Exception as e:
            validation.status = ValidationStatus.ERROR
            validation.error_message = str(e)
        
        finally:
            if db_id:
                self.sqlite_manager.cleanup_database(db_id)
        
        validation.completed_at = datetime.now()
        return validation
    
    def _run_case(self, case: ValidationCase, db: TempSQLiteDatabase) -> None:
        case.started_at = datetime.now()
        case.status = ValidationStatus.RUNNING
        
        try:
            original_result = db.execute_query(case.original_sql, self.sql_timeout)
            optimized_result = db.execute_query(case.optimized_sql, self.sql_timeout)
            
            original_explain = db.explain_query(case.original_sql)
            optimized_explain = db.explain_query(case.optimized_sql)
            
            comparison = self.comparator.compare_results(
                original_result,
                optimized_result,
                case.original_sql,
                case.optimized_sql,
                original_explain,
                optimized_explain
            )
            
            case.comparison_result = comparison
            
            case.suggestions = self.comparator.generate_optimization_suggestions(
                comparison,
                case.original_sql,
                case.optimized_sql
            )
            
            if comparison.error:
                case.status = ValidationStatus.ERROR
                case.error_message = comparison.error
            elif comparison.passed:
                case.status = ValidationStatus.PASSED
            else:
                case.status = ValidationStatus.FAILED
                
        except Exception as e:
            case.status = ValidationStatus.ERROR
            case.error_message = str(e)
        
        case.completed_at = datetime.now()
