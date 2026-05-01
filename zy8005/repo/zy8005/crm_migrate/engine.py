import os
from typing import Any, Dict, List, Optional

from .config import SchemaConfig, MappingConfig, load_schema, load_mapping
from .csv_loader import CSVLoader, DataNormalizer
from .dependency_sorter import DependencySorter
from .report_generator import ReportGenerator
from .sql_generator import SQLGenerator
from .validators import (
    DEFAULT_VALIDATORS,
    BaseValidator,
    Severity,
    ValidationIssue,
    ValidationResult,
)


class MigrationEngine:
    def __init__(
        self,
        source_dir: str,
        schema_path: str,
        mapping_path: str,
        out_dir: str,
        force: bool = False,
    ):
        self.source_dir = source_dir
        self.schema_path = schema_path
        self.mapping_path = mapping_path
        self.out_dir = out_dir
        self.force = force
        
        self.schema: Optional[SchemaConfig] = None
        self.mapping: Optional[MappingConfig] = None
        self.csv_loader: Optional[CSVLoader] = None
        self.validators: List[BaseValidator] = DEFAULT_VALIDATORS
    
    def load_configs(self) -> None:
        self.schema = load_schema(self.schema_path)
        self.mapping = load_mapping(self.mapping_path)
        self.csv_loader = CSVLoader(self.source_dir)
    
    def apply_mappings(
        self, table_name: str, source_rows: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        if self.mapping is None or self.schema is None:
            return []
        
        field_mappings = self.mapping.get_field_mappings(table_name)
        transformations = self.mapping.get_transformations(table_name)
        schema_columns = self.schema.get_columns(table_name)
        
        result_rows: List[Dict[str, Any]] = []
        
        for source_row in source_rows:
            target_row: Dict[str, Any] = {}
            
            for target_field, source_field in field_mappings.items():
                source_field_lower = source_field.strip().lower()
                value = source_row.get(source_field_lower)
                
                if value is not None:
                    transform = transformations.get(target_field)
                    if transform:
                        value = self._apply_transform(value, transform)
                
                target_row[target_field] = value
            
            target_row["_row_num"] = source_row.get("_row_num")
            target_row["_source_file"] = source_row.get("_source_file")
            
            result_rows.append(target_row)
        
        return result_rows
    
    def _apply_transform(self, value: Any, transform: Dict[str, Any]) -> Any:
        transform_type = transform.get("type")
        
        if transform_type == "lowercase":
            return str(value).lower() if value else value
        elif transform_type == "uppercase":
            return str(value).upper() if value else value
        elif transform_type == "trim":
            return str(value).strip() if value else value
        elif transform_type == "normalize_date":
            target_format = transform.get("format", "%Y-%m-%d")
            return DataNormalizer.normalize_date(value, target_format)
        elif transform_type == "normalize_datetime":
            target_format = transform.get("format", "%Y-%m-%d %H:%M:%S")
            return DataNormalizer.normalize_datetime(value, target_format)
        elif transform_type == "normalize_email":
            return DataNormalizer.normalize_email(value)
        elif transform_type == "normalize_phone":
            return DataNormalizer.normalize_phone(value)
        elif transform_type == "boolean":
            return DataNormalizer.normalize_boolean(value)
        elif transform_type == "integer":
            return DataNormalizer.normalize_integer(value)
        elif transform_type == "float":
            return DataNormalizer.normalize_float(value)
        
        return value
    
    def validate_all(
        self, table_data: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, ValidationResult]:
        if self.schema is None or self.mapping is None:
            return {}
        
        results: Dict[str, ValidationResult] = {}
        
        for table_name, rows in table_data.items():
            result = ValidationResult(table_name=table_name, rows=rows)
            
            for validator in self.validators:
                issues = validator.validate(
                    table_name=table_name,
                    rows=rows,
                    schema_config=self.schema,
                    mapping_config=self.mapping,
                    all_data=table_data,
                )
                result.issues.extend(issues)
            
            results[table_name] = result
        
        return results
    
    def run(self) -> Dict[str, Any]:
        self.load_configs()
        
        if self.schema is None or self.mapping is None:
            return {"success": False, "error": "配置加载失败"}
        
        target_tables = self.mapping.get_all_target_tables()
        
        table_data: Dict[str, List[Dict[str, Any]]] = {}
        for table_name in target_tables:
            source_file = self.mapping.get_source_file(table_name)
            if source_file:
                _, source_rows = self.csv_loader.load_file(source_file)
                mapped_rows = self.apply_mappings(table_name, source_rows)
                table_data[table_name] = mapped_rows
        
        validation_results = self.validate_all(table_data)
        
        total_errors = sum(
            len(result.get_errors()) for result in validation_results.values()
        )
        total_warnings = sum(
            len(result.get_warnings()) for result in validation_results.values()
        )
        
        if total_errors > 0:
            status = "error"
        elif total_warnings > 0:
            status = "warning"
        else:
            status = "success"
        
        summary = {
            "status": status,
            "total_tables": len(target_tables),
            "total_rows": sum(len(rows) for rows in table_data.values()),
            "total_errors": total_errors,
            "total_warnings": total_warnings,
            "force_mode": self.force,
        }
        
        sorter = DependencySorter(self.schema)
        sorted_forward = sorter.sort_tables(target_tables)
        sorted_backward = sorter.sort_for_rollback(target_tables)
        
        os.makedirs(self.out_dir, exist_ok=True)
        
        report_gen = ReportGenerator()
        
        json_report = report_gen.generate_json_report(
            validation_results, table_data, summary
        )
        json_path = os.path.join(self.out_dir, "report.json")
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(json_report)
        
        md_report = report_gen.generate_markdown_report(
            validation_results, table_data, summary
        )
        md_path = os.path.join(self.out_dir, "report.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_report)
        
        sql_gen = SQLGenerator(self.schema, self.mapping)
        
        has_blocking_errors = total_errors > 0
        
        if not has_blocking_errors or self.force:
            migrate_sql = sql_gen.generate_migrate_sql(
                sorted_forward, table_data, has_errors=has_blocking_errors
            )
            migrate_path = os.path.join(self.out_dir, "migrate.sql")
            with open(migrate_path, "w", encoding="utf-8") as f:
                f.write(migrate_sql)
            
            rollback_sql = sql_gen.generate_rollback_sql(
                sorted_backward, table_data
            )
            rollback_path = os.path.join(self.out_dir, "rollback.sql")
            with open(rollback_path, "w", encoding="utf-8") as f:
                f.write(rollback_sql)
        
        return {
            "success": True,
            "summary": summary,
            "validation_results": validation_results,
            "output_dir": self.out_dir,
        }
