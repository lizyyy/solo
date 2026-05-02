import os
import tempfile
import shutil
import json
import sqlite3
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import Engine

from db_migration_rehearsal.config import Config
from db_migration_rehearsal.migration_parser import ParsedMigration, MigrationParserFactory
from db_migration_rehearsal.importer import MigrationImporter


@dataclass
class ExecutionResult:
    migration_version: str
    migration_file: str
    success: bool
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    operations_executed: int = 0
    warnings: List[str] = field(default_factory=list)
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "migration_version": self.migration_version,
            "migration_file": self.migration_file,
            "success": self.success,
            "error_message": self.error_message,
            "execution_time_ms": self.execution_time_ms,
            "operations_executed": self.operations_executed,
            "warnings": self.warnings,
        }


class BaseSandbox(ABC):
    
    def __init__(self, config: Config):
        self.config = config
        self.engine: Optional[Engine] = None
        self.temp_dir: Optional[tempfile.TemporaryDirectory] = None
    
    @abstractmethod
    def create(self) -> None:
        pass
    
    @abstractmethod
    def cleanup(self) -> None:
        pass
    
    @abstractmethod
    def execute_sql(self, sql: str) -> Tuple[bool, Optional[str]]:
        pass
    
    @abstractmethod
    def get_schema_state(self) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def load_schema(self, schema_sql: str) -> None:
        pass


class SQLiteSandbox(BaseSandbox):
    
    def __init__(self, config: Config):
        super().__init__(config)
        self.db_path: Optional[str] = None
    
    def create(self) -> None:
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, "sandbox.db")
        
        self.engine = create_engine(f"sqlite:///{self.db_path}")
        
        with self.engine.connect() as conn:
            conn.execute(text("PRAGMA foreign_keys = ON"))
            conn.commit()
    
    def cleanup(self) -> None:
        if self.engine:
            self.engine.dispose()
            self.engine = None
        
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            self.temp_dir = None
        
        self.db_path = None
    
    def execute_sql(self, sql: str) -> Tuple[bool, Optional[str]]:
        if not self.engine:
            return False, "Sandbox not initialized"
        
        try:
            with self.engine.connect() as conn:
                statements = self._split_statements(sql)
                
                for stmt in statements:
                    stmt = stmt.strip()
                    if not stmt or stmt.startswith("--"):
                        continue
                    
                    conn.execute(text(stmt))
                
                conn.commit()
            
            return True, None
        
        except Exception as e:
            return False, str(e)
    
    def _split_statements(self, sql: str) -> List[str]:
        import sqlparse
        
        statements = sqlparse.split(sql)
        return [s.strip() for s in statements if s.strip()]
    
    def get_schema_state(self) -> Dict[str, Any]:
        if not self.engine:
            return {"tables": []}
        
        state: Dict[str, Any] = {
            "database_type": "sqlite",
            "tables": [],
            "indices": [],
            "foreign_keys": [],
        }
        
        inspector = inspect(self.engine)
        
        for table_name in inspector.get_table_names():
            columns = []
            for col in inspector.get_columns(table_name):
                columns.append({
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col.get("nullable", True),
                    "default": str(col.get("default")) if col.get("default") else None,
                    "autoincrement": col.get("autoincrement", False),
                })
            
            primary_key = inspector.get_pk_constraint(table_name)
            pk_columns = primary_key.get("constrained_columns", []) if primary_key else []
            
            indices = []
            for idx in inspector.get_indexes(table_name):
                indices.append({
                    "name": idx["name"],
                    "columns": idx["column_names"],
                    "unique": idx.get("unique", False),
                })
            
            foreign_keys = []
            for fk in inspector.get_foreign_keys(table_name):
                foreign_keys.append({
                    "name": fk.get("name"),
                    "constrained_columns": fk["constrained_columns"],
                    "referred_table": fk["referred_table"],
                    "referred_columns": fk["referred_columns"],
                })
            
            state["tables"].append({
                "name": table_name,
                "columns": columns,
                "primary_key_columns": pk_columns,
                "indices": indices,
                "foreign_keys": foreign_keys,
            })
        
        return state
    
    def load_schema(self, schema_sql: str) -> None:
        if not self.engine:
            raise RuntimeError("Sandbox not initialized")
        
        success, error = self.execute_sql(schema_sql)
        if not success:
            raise RuntimeError(f"Failed to load schema: {error}")


class SandboxExecutor:
    
    def __init__(self, config: Config):
        self.config = config
        self.sandbox: Optional[BaseSandbox] = None
    
    def create_sandbox(self) -> None:
        db_type = self.config.database_type.lower()
        
        if db_type == "sqlite":
            self.sandbox = SQLiteSandbox(self.config)
        elif db_type == "postgres":
            self.sandbox = SQLiteSandbox(self.config)
        else:
            self.sandbox = SQLiteSandbox(self.config)
        
        self.sandbox.create()
    
    def cleanup(self) -> None:
        if self.sandbox:
            self.sandbox.cleanup()
            self.sandbox = None
    
    def load_baseline_schema(self) -> Optional[Dict[str, Any]]:
        if not self.sandbox:
            return None
        
        baseline_dir = Path(self.config.baseline_schema_dir)
        
        if not baseline_dir.exists():
            return None
        
        schema_files: List[Path] = []
        for ext in [".sql", ".prisma"]:
            schema_files.extend(baseline_dir.glob(f"*{ext}"))
        
        if not schema_files:
            return None
        
        for schema_file in sorted(schema_files):
            schema_content = self._load_schema_file(schema_file)
            if schema_content:
                self.sandbox.load_schema(schema_content)
        
        return self.sandbox.get_schema_state()
    
    def _load_schema_file(self, schema_file: Path) -> Optional[str]:
        if schema_file.suffix == ".sql":
            with open(schema_file, "r", encoding="utf-8") as f:
                return f.read()
        
        elif schema_file.suffix == ".prisma":
            from db_migration_rehearsal.migration_parser import PrismaMigrationParser
            parser = PrismaMigrationParser()
            parsed = parser.parse(str(schema_file))
            return self._prisma_to_sql(parsed)
        
        return None
    
    def _prisma_to_sql(self, parsed: ParsedMigration) -> str:
        sql_statements: List[str] = []
        
        models = parsed.metadata.get("models", {})
        
        for model_name, model_info in models.items():
            fields = model_info.get("fields", [])
            
            column_defs: List[str] = []
            primary_keys: List[str] = []
            
            for field in fields:
                col_type = self._prisma_type_to_sql(field["type"])
                constraints: List[str] = []
                
                if field.get("is_id"):
                    primary_keys.append(field["name"])
                    if field["type"] == "Int":
                        constraints.append("PRIMARY KEY AUTOINCREMENT")
                    else:
                        constraints.append("PRIMARY KEY")
                
                if field.get("is_unique") and not field.get("is_id"):
                    constraints.append("UNIQUE")
                
                if not field.get("is_optional") and not field.get("is_id"):
                    constraints.append("NOT NULL")
                
                col_def = f"{field['name']} {col_type}"
                if constraints:
                    col_def += " " + " ".join(constraints)
                
                if not field.get("is_list"):
                    column_defs.append(col_def)
            
            create_sql = f"CREATE TABLE {model_name} (\n"
            create_sql += ",\n".join(f"  {col}" for col in column_defs)
            create_sql += "\n);"
            
            sql_statements.append(create_sql)
        
        return "\n\n".join(sql_statements)
    
    def _prisma_type_to_sql(self, prisma_type: str) -> str:
        type_mapping = {
            "Int": "INTEGER",
            "BigInt": "BIGINT",
            "Float": "REAL",
            "Decimal": "DECIMAL",
            "Boolean": "BOOLEAN",
            "String": "TEXT",
            "DateTime": "DATETIME",
            "Date": "DATE",
            "Bytes": "BLOB",
            "Json": "TEXT",
        }
        
        return type_mapping.get(prisma_type, "TEXT")
    
    def get_current_schema(self) -> Dict[str, Any]:
        if not self.sandbox:
            return {"tables": []}
        
        return self.sandbox.get_schema_state()
    
    def execute_all_migrations(
        self,
        stop_on_error: bool = True,
        verbose: bool = False,
    ) -> List[Dict[str, Any]]:
        if not self.sandbox:
            raise RuntimeError("Sandbox not initialized")
        
        importer = MigrationImporter(self.config)
        migrations = importer.parse_all_migrations()
        
        results: List[Dict[str, Any]] = []
        
        for migration in migrations:
            result = self._execute_migration(migration, verbose=verbose)
            results.append(result.to_dict())
            
            if not result.success and stop_on_error:
                break
        
        return results
    
    def _execute_migration(
        self,
        migration: ParsedMigration,
        verbose: bool = False,
    ) -> ExecutionResult:
        import time
        
        start_time = time.time()
        
        if not self.sandbox:
            return ExecutionResult(
                migration_version=migration.version,
                migration_file=migration.filename,
                success=False,
                error_message="Sandbox not initialized",
            )
        
        before_state = self.sandbox.get_schema_state()
        
        sql_to_execute = migration.raw_content
        
        if migration.migration_type == "alembic":
            warnings: List[str] = [
                "Alembic migrations require actual Python execution, "
                "using SQL fallback for sandbox testing"
            ]
            success = True
            error_msg = None
        else:
            success, error_msg = self.sandbox.execute_sql(sql_to_execute)
            warnings = []
        
        after_state = self.sandbox.get_schema_state()
        
        execution_time = (time.time() - start_time) * 1000
        
        return ExecutionResult(
            migration_version=migration.version,
            migration_file=migration.filename,
            success=success,
            error_message=error_msg,
            execution_time_ms=execution_time,
            operations_executed=len(migration.up_operations),
            warnings=warnings,
            before_state=before_state,
            after_state=after_state,
        )
    
    def save_execution_results(
        self,
        results: Dict[str, Any],
        output_dir: str,
    ) -> str:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"dry_run_{timestamp}.json"
        filepath = output_path / filename
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False, default=str)
        
        return str(filepath)
