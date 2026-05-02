import csv
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from db_migration_rehearsal.config import Config
from db_migration_rehearsal.sandbox import SandboxExecutor


class SampleDataValidator:
    
    SUPPORTED_FORMATS = [".sql", ".json", ".csv"]
    
    def __init__(self, config: Config):
        self.config = config
    
    def list_sample_files(self) -> List[str]:
        sample_dir = Path(self.config.sample_data_dir)
        
        if not sample_dir.exists():
            return []
        
        files: List[str] = []
        
        for ext in self.SUPPORTED_FORMATS:
            for file_path in sample_dir.glob(f"*{ext}"):
                if file_path.is_file():
                    files.append(str(file_path))
        
        return sorted(files)
    
    def validate_all_samples(self) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        
        sample_files = self.list_sample_files()
        
        if not sample_files:
            return [{"sample_file": "N/A", "success": True, "message": "No sample files found"}]
        
        executor = SandboxExecutor(self.config)
        
        try:
            executor.create_sandbox()
            executor.load_baseline_schema()
            executor.execute_all_migrations(stop_on_error=False)
            
            for sample_file in sample_files:
                result = self._validate_sample(executor, sample_file)
                results.append(result)
        
        finally:
            executor.cleanup()
        
        return results
    
    def _validate_sample(
        self,
        executor: SandboxExecutor,
        sample_file: str,
    ) -> Dict[str, Any]:
        path = Path(sample_file)
        ext = path.suffix.lower()
        
        try:
            if ext == ".sql":
                return self._validate_sql_sample(executor, sample_file)
            elif ext == ".json":
                return self._validate_json_sample(executor, sample_file)
            elif ext == ".csv":
                return self._validate_csv_sample(executor, sample_file)
            else:
                return {
                    "sample_file": path.name,
                    "success": False,
                    "error": f"Unsupported file format: {ext}",
                }
        
        except Exception as e:
            return {
                "sample_file": path.name,
                "success": False,
                "error": str(e),
                "warnings": [],
            }
    
    def _validate_sql_sample(
        self,
        executor: SandboxExecutor,
        sample_file: str,
    ) -> Dict[str, Any]:
        path = Path(sample_file)
        
        with open(sample_file, "r", encoding="utf-8") as f:
            sql_content = f.read()
        
        if not executor.sandbox:
            return {
                "sample_file": path.name,
                "success": False,
                "error": "Sandbox not initialized",
            }
        
        success, error = executor.sandbox.execute_sql(sql_content)
        
        if success:
            return {
                "sample_file": path.name,
                "success": True,
                "rows_inserted": self._count_insert_statements(sql_content),
                "warnings": [],
            }
        else:
            return {
                "sample_file": path.name,
                "success": False,
                "error": error,
                "warnings": self._extract_warnings(error),
            }
    
    def _validate_json_sample(
        self,
        executor: SandboxExecutor,
        sample_file: str,
    ) -> Dict[str, Any]:
        path = Path(sample_file)
        
        with open(sample_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            data = [data]
        
        if not isinstance(data, list):
            return {
                "sample_file": path.name,
                "success": False,
                "error": "JSON must be an array of objects or a single object",
            }
        
        errors: List[str] = []
        warnings: List[str] = []
        success_count = 0
        
        schema = self._get_schema_state(executor)
        
        for i, row in enumerate(data):
            if not isinstance(row, dict):
                errors.append(f"Row {i}: must be an object")
                continue
            
            table_name = row.get("table", row.get("table_name"))
            if not table_name:
                errors.append(f"Row {i}: missing 'table' or 'table_name' field")
                continue
            
            table_data = row.get("data", row)
            if "table" in table_data:
                table_data = {k: v for k, v in table_data.items() if k != "table"}
            
            validation_result = self._validate_row_against_schema(
                table_name, table_data, schema
            )
            
            if not validation_result["valid"]:
                errors.extend(
                    f"Row {i} ({table_name}): {err}"
                    for err in validation_result["errors"]
                )
            else:
                success_count += 1
                warnings.extend(
                    f"Row {i} ({table_name}): {w}"
                    for w in validation_result["warnings"]
                )
        
        return {
            "sample_file": path.name,
            "success": len(errors) == 0,
            "error": "; ".join(errors) if errors else None,
            "rows_validated": len(data),
            "rows_valid": success_count,
            "warnings": warnings,
        }
    
    def _validate_csv_sample(
        self,
        executor: SandboxExecutor,
        sample_file: str,
    ) -> Dict[str, Any]:
        path = Path(sample_file)
        
        table_name = path.stem
        
        errors: List[str] = []
        warnings: List[str] = []
        row_count = 0
        
        schema = self._get_schema_state(executor)
        
        with open(sample_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            
            for i, row in enumerate(reader):
                row_count += 1
                
                validation_result = self._validate_row_against_schema(
                    table_name, row, schema
                )
                
                if not validation_result["valid"]:
                    errors.extend(
                        f"Row {i + 1}: {err}"
                        for err in validation_result["errors"]
                    )
                else:
                    warnings.extend(
                        f"Row {i + 1}: {w}"
                        for w in validation_result["warnings"]
                    )
        
        return {
            "sample_file": path.name,
            "success": len(errors) == 0,
            "error": "; ".join(errors) if errors else None,
            "table": table_name,
            "rows_validated": row_count,
            "warnings": warnings,
        }
    
    def _get_schema_state(self, executor: SandboxExecutor) -> Dict[str, Any]:
        if not executor.sandbox:
            return {"tables": []}
        
        return executor.sandbox.get_schema_state()
    
    def _validate_row_against_schema(
        self,
        table_name: str,
        row_data: Dict[str, Any],
        schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        errors: List[str] = []
        warnings: List[str] = []
        
        tables = {t["name"]: t for t in schema.get("tables", [])}
        
        if table_name not in tables:
            return {
                "valid": False,
                "errors": [f"Table '{table_name}' does not exist in schema"],
                "warnings": [],
            }
        
        table = tables[table_name]
        columns = {c["name"]: c for c in table.get("columns", [])}
        
        for col_name, value in row_data.items():
            if col_name not in columns:
                warnings.append(f"Column '{col_name}' not in table schema")
                continue
            
            col = columns[col_name]
            
            if value is None or value == "":
                if not col.get("nullable", True) and not col.get("default"):
                    errors.append(
                        f"Column '{col_name}' is NOT NULL and has no default, but value is null"
                    )
                continue
            
            col_type = col.get("type", "").upper()
            type_errors = self._validate_type(value, col_type)
            errors.extend(type_errors)
        
        required_cols = [
            c["name"]
            for c in table.get("columns", [])
            if not c.get("nullable", True) and not c.get("default") and not c.get("autoincrement")
        ]
        
        for req_col in required_cols:
            if req_col not in row_data:
                errors.append(f"Missing required column: '{req_col}'")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }
    
    def _validate_type(self, value: Any, expected_type: str) -> List[str]:
        errors: List[str] = []
        
        if "INT" in expected_type or "INTEGER" in expected_type or "BIGINT" in expected_type:
            try:
                int(str(value))
            except (ValueError, TypeError):
                errors.append(f"Value '{value}' is not a valid integer for type {expected_type}")
        
        elif "FLOAT" in expected_type or "REAL" in expected_type or "DOUBLE" in expected_type:
            try:
                float(str(value))
            except (ValueError, TypeError):
                errors.append(f"Value '{value}' is not a valid float for type {expected_type}")
        
        elif "BOOLEAN" in expected_type:
            str_val = str(value).lower()
            if str_val not in ["true", "false", "1", "0", "t", "f", "yes", "no"]:
                errors.append(f"Value '{value}' is not a valid boolean")
        
        elif "DATE" in expected_type or "DATETIME" in expected_type:
            if not self._is_valid_date(str(value)):
                errors.append(f"Value '{value}' is not a valid date/datetime format")
        
        return errors
    
    def _is_valid_date(self, value: str) -> bool:
        date_patterns = [
            r"^\d{4}-\d{2}-\d{2}$",
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}",
            r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}",
            r"^\d{2}/\d{2}/\d{4}$",
            r"^\d{2}-\d{2}-\d{4}$",
        ]
        
        for pattern in date_patterns:
            if re.match(pattern, value):
                return True
        
        return False
    
    def _count_insert_statements(self, sql: str) -> int:
        import sqlparse
        
        statements = sqlparse.split(sql)
        count = 0
        
        for stmt in statements:
            stmt_upper = stmt.strip().upper()
            if stmt_upper.startswith("INSERT"):
                count += 1
        
        return count
    
    def _extract_warnings(self, error: str) -> List[str]:
        warnings: List[str] = []
        
        error_lower = error.lower()
        
        if "constraint" in error_lower:
            warnings.append("Possible constraint violation")
        
        if "unique" in error_lower:
            warnings.append("Possible unique constraint violation")
        
        if "foreign key" in error_lower:
            warnings.append("Possible foreign key constraint violation")
        
        if "null" in error_lower:
            warnings.append("Possible NOT NULL constraint violation")
        
        return warnings
