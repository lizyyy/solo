import os
import shutil
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

from db_migration_rehearsal.config import Config
from db_migration_rehearsal.migration_parser import (
    MigrationParserFactory,
    ParsedMigration,
)


class MigrationImporter:
    
    SUPPORTED_EXTENSIONS = [".sql", ".prisma", ".py"]
    
    def __init__(self, config: Config):
        self.config = config
    
    def list_migration_files(self, source_dir: str, recursive: bool = False) -> List[str]:
        files: List[str] = []
        
        source_path = Path(source_dir)
        
        if not source_path.exists():
            return files
        
        for ext in self.SUPPORTED_EXTENSIONS:
            if recursive:
                pattern = f"**/*{ext}"
            else:
                pattern = f"*{ext}"
            
            for file_path in source_path.glob(pattern):
                if file_path.is_file() and self._is_migration_file(str(file_path)):
                    files.append(str(file_path))
        
        return sorted(files)
    
    def _is_migration_file(self, filepath: str) -> bool:
        filename = os.path.basename(filepath).lower()
        
        excluded_patterns = [
            "__pycache__",
            ".pyc",
            "conftest.py",
            "test_",
            "_test",
        ]
        
        for pattern in excluded_patterns:
            if pattern in filename or pattern in filepath:
                return False
        
        if filepath.endswith(".py"):
            if "alembic" in filepath.lower() or "versions" in filepath.lower():
                return True
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            if "def upgrade" in content or "def downgrade" in content:
                return True
            return False
        
        return True
    
    def import_migrations(
        self,
        source_dir: str,
        target_dir: str,
        recursive: bool = False,
    ) -> List[Dict[str, Any]]:
        files = self.list_migration_files(source_dir, recursive)
        
        target_path = Path(target_dir)
        target_path.mkdir(parents=True, exist_ok=True)
        
        imported: List[Dict[str, Any]] = []
        
        for file_path in files:
            filename = os.path.basename(file_path)
            dest_path = target_path / filename
            
            if dest_path.exists():
                dest_path = self._resolve_conflict(dest_path)
            
            shutil.copy2(file_path, dest_path)
            
            version = MigrationParserFactory.get_version(str(dest_path))
            parsed = MigrationParserFactory.parse_file(str(dest_path))
            
            imported.append({
                "filename": filename,
                "source": file_path,
                "destination": str(dest_path),
                "version": version or "unknown",
                "type": parsed.migration_type if parsed else self._detect_type(filename),
            })
        
        return imported
    
    def _resolve_conflict(self, dest_path: Path) -> Path:
        parent = dest_path.parent
        stem = dest_path.stem
        suffix = dest_path.suffix
        
        counter = 1
        while True:
            new_name = f"{stem}_{counter}{suffix}"
            new_path = parent / new_name
            if not new_path.exists():
                return new_path
            counter += 1
    
    def _detect_type(self, filename: str) -> str:
        if filename.endswith(".sql"):
            return "sql"
        elif filename.endswith(".prisma"):
            return "prisma"
        elif filename.endswith(".py"):
            return "alembic"
        return "unknown"
    
    def list_migrations(self) -> List[Dict[str, Any]]:
        migrations_dir = Path(self.config.migrations_dir)
        
        if not migrations_dir.exists():
            return []
        
        migrations: List[Dict[str, Any]] = []
        
        for ext in self.SUPPORTED_EXTENSIONS:
            for file_path in migrations_dir.glob(f"*{ext}"):
                if file_path.is_file():
                    version = MigrationParserFactory.get_version(str(file_path))
                    migrations.append({
                        "version": version or "unknown",
                        "filename": file_path.name,
                        "filepath": str(file_path),
                        "type": self._detect_type(file_path.name),
                    })
        
        return sorted(migrations, key=lambda x: x["version"])
    
    def parse_all_migrations(self) -> List[ParsedMigration]:
        migrations_dir = Path(self.config.migrations_dir)
        
        if not migrations_dir.exists():
            return []
        
        parsed_migrations: List[ParsedMigration] = []
        
        for ext in self.SUPPORTED_EXTENSIONS:
            for file_path in migrations_dir.glob(f"*{ext}"):
                if file_path.is_file() and self._is_migration_file(str(file_path)):
                    parsed = MigrationParserFactory.parse_file(str(file_path))
                    if parsed:
                        parsed_migrations.append(parsed)
        
        return sorted(parsed_migrations, key=lambda x: x.version)


class BaselineSchemaImporter:
    
    SUPPORTED_EXTENSIONS = [".sql", ".prisma", ".json"]
    
    def __init__(self, config: Config):
        self.config = config
    
    def import_schema(
        self,
        schema_path: str,
        target_dir: str,
    ) -> Dict[str, Any]:
        source_path = Path(schema_path)
        
        if not source_path.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_path}")
        
        target_path = Path(target_dir)
        target_path.mkdir(parents=True, exist_ok=True)
        
        dest_file = target_path / source_path.name
        
        if dest_file.exists():
            dest_file = self._resolve_conflict(dest_file)
        
        shutil.copy2(source_path, dest_file)
        
        schema_info = self._parse_schema(str(dest_file))
        
        return {
            "name": source_path.name,
            "source": str(source_path),
            "destination": str(dest_file),
            "type": self._detect_type(str(dest_file)),
            **schema_info,
        }
    
    def _resolve_conflict(self, dest_path: Path) -> Path:
        parent = dest_path.parent
        stem = dest_path.stem
        suffix = dest_path.suffix
        
        counter = 1
        while True:
            new_name = f"{stem}_{counter}{suffix}"
            new_path = parent / new_name
            if not new_path.exists():
                return new_path
            counter += 1
    
    def _detect_type(self, filepath: str) -> str:
        if filepath.endswith(".sql"):
            return "sql"
        elif filepath.endswith(".prisma"):
            return "prisma"
        elif filepath.endswith(".json"):
            return "json"
        return "unknown"
    
    def _parse_schema(self, filepath: str) -> Dict[str, Any]:
        schema_type = self._detect_type(filepath)
        
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        tables: List[str] = []
        
        if schema_type == "sql":
            import sqlparse
            
            statements = sqlparse.split(content)
            for stmt in statements:
                stmt_upper = stmt.upper()
                if "CREATE TABLE" in stmt_upper:
                    match = re.search(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(,;]+)", stmt, re.IGNORECASE)
                    if match:
                        table_name = match.group(1).strip().strip('"').strip("'")
                        if table_name not in tables:
                            tables.append(table_name)
        
        elif schema_type == "prisma":
            matches = re.findall(r"model\s+(\w+)", content)
            tables = list(matches)
        
        return {
            "tables_count": len(tables),
            "tables": tables,
        }
    
    def list_baseline_schemas(self) -> List[Dict[str, Any]]:
        baseline_dir = Path(self.config.baseline_schema_dir)
        
        if not baseline_dir.exists():
            return []
        
        schemas: List[Dict[str, Any]] = []
        
        for ext in self.SUPPORTED_EXTENSIONS:
            for file_path in baseline_dir.glob(f"*{ext}"):
                if file_path.is_file():
                    schemas.append({
                        "filename": file_path.name,
                        "filepath": str(file_path),
                        "type": self._detect_type(str(file_path)),
                    })
        
        return schemas


def import_migrations(
    source_dir: str,
    target_dir: str,
    recursive: bool = False,
) -> List[Dict[str, Any]]:
    config = Config()
    importer = MigrationImporter(config)
    return importer.import_migrations(source_dir, target_dir, recursive)


def import_baseline_schema(
    schema_path: str,
    target_dir: str,
) -> Dict[str, Any]:
    config = Config()
    importer = BaselineSchemaImporter(config)
    return importer.import_schema(schema_path, target_dir)
