import os
import re
import glob
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import sqlparse


@dataclass
class ParsedMigration:
    version: str
    filename: str
    filepath: str
    migration_type: str
    raw_content: str
    up_operations: List[Dict[str, Any]] = field(default_factory=list)
    down_operations: List[Dict[str, Any]] = field(default_factory=list)
    has_rollback: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "filename": self.filename,
            "filepath": self.filepath,
            "migration_type": self.migration_type,
            "has_rollback": self.has_rollback,
            "up_operations_count": len(self.up_operations),
            "down_operations_count": len(self.down_operations),
            "up_operations": self.up_operations,
            "down_operations": self.down_operations,
            "metadata": self.metadata,
        }


class BaseMigrationParser(ABC):
    
    @abstractmethod
    def parse(self, filepath: str) -> ParsedMigration:
        pass
    
    @abstractmethod
    def get_version(self, filepath: str) -> Optional[str]:
        pass
    
    @abstractmethod
    def detect_type(self, filepath: str) -> bool:
        pass


class SQLMigrationParser(BaseMigrationParser):
    
    VERSION_PATTERNS = [
        r"V(\d+(?:\.\d+)*)__.*\.sql",
        r"(\d+(?:\.\d+)*)_.*\.sql",
        r"(\d{14})_.*\.sql",
    ]
    
    ROLLBACK_KEYWORDS = [
        "-- down:",
        "-- rollback:",
        "-- revert:",
        "-- undo:",
    ]
    
    def detect_type(self, filepath: str) -> bool:
        return filepath.lower().endswith(".sql")
    
    def get_version(self, filepath: str) -> Optional[str]:
        filename = os.path.basename(filepath)
        
        for pattern in self.VERSION_PATTERNS:
            match = re.match(pattern, filename, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def parse(self, filepath: str) -> ParsedMigration:
        filename = os.path.basename(filepath)
        version = self.get_version(filepath) or "unknown"
        
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        up_ops, down_ops = self._split_up_down(content)
        has_rollback = len(down_ops) > 0
        
        up_parsed = self._parse_sql_operations(up_ops)
        down_parsed = self._parse_sql_operations(down_ops)
        
        return ParsedMigration(
            version=version,
            filename=filename,
            filepath=filepath,
            migration_type="sql",
            raw_content=content,
            up_operations=up_parsed,
            down_operations=down_parsed,
            has_rollback=has_rollback,
            metadata={
                "up_lines": len(up_ops),
                "down_lines": len(down_ops),
            },
        )
    
    def _split_up_down(self, content: str) -> Tuple[List[str], List[str]]:
        lines = content.split("\n")
        up_sql: List[str] = []
        down_sql: List[str] = []
        
        current_section = "up"
        
        for line in lines:
            line_lower = line.strip().lower()
            
            is_rollback_marker = any(
                keyword.lower() in line_lower
                for keyword in self.ROLLBACK_KEYWORDS
            )
            
            if is_rollback_marker:
                current_section = "down"
                continue
            
            if current_section == "up":
                up_sql.append(line)
            else:
                down_sql.append(line)
        
        return up_sql, down_sql
    
    def _parse_sql_operations(self, lines: List[str]) -> List[Dict[str, Any]]:
        if not lines:
            return []
        
        sql_content = "\n".join(lines)
        statements = sqlparse.split(sql_content)
        
        operations: List[Dict[str, Any]] = []
        
        for stmt in statements:
            stmt = stmt.strip()
            if not stmt or stmt.startswith("--"):
                continue
            
            op_type = self._classify_statement(stmt)
            
            operations.append({
                "type": op_type,
                "statement": stmt,
                "normalized": self._normalize_sql(stmt),
                "tables": self._extract_tables(stmt, op_type),
                "columns": self._extract_columns(stmt, op_type),
                "risk_level": self._assess_risk(op_type, stmt),
            })
        
        return operations
    
    def _classify_statement(self, stmt: str) -> str:
        stmt_upper = stmt.upper()
        
        if "CREATE TABLE" in stmt_upper:
            return "CREATE_TABLE"
        elif "ALTER TABLE" in stmt_upper:
            if "ADD COLUMN" in stmt_upper or "ADD " in stmt_upper and "COLUMN" in stmt_upper:
                return "ALTER_ADD_COLUMN"
            elif "DROP COLUMN" in stmt_upper:
                return "ALTER_DROP_COLUMN"
            elif "ALTER COLUMN" in stmt_upper or "MODIFY" in stmt_upper:
                return "ALTER_MODIFY_COLUMN"
            elif "RENAME COLUMN" in stmt_upper:
                return "ALTER_RENAME_COLUMN"
            elif "RENAME TO" in stmt_upper:
                return "ALTER_RENAME_TABLE"
            elif "ADD CONSTRAINT" in stmt_upper:
                return "ALTER_ADD_CONSTRAINT"
            elif "DROP CONSTRAINT" in stmt_upper:
                return "ALTER_DROP_CONSTRAINT"
            else:
                return "ALTER_TABLE"
        elif "DROP TABLE" in stmt_upper:
            return "DROP_TABLE"
        elif "CREATE INDEX" in stmt_upper:
            return "CREATE_INDEX"
        elif "DROP INDEX" in stmt_upper:
            return "DROP_INDEX"
        elif "CREATE UNIQUE INDEX" in stmt_upper:
            return "CREATE_UNIQUE_INDEX"
        elif "INSERT INTO" in stmt_upper:
            return "INSERT"
        elif "UPDATE" in stmt_upper and "SET" in stmt_upper:
            return "UPDATE"
        elif "DELETE FROM" in stmt_upper:
            return "DELETE"
        elif "TRUNCATE" in stmt_upper:
            return "TRUNCATE"
        elif "CREATE VIEW" in stmt_upper:
            return "CREATE_VIEW"
        elif "DROP VIEW" in stmt_upper:
            return "DROP_VIEW"
        elif "CREATE SEQUENCE" in stmt_upper:
            return "CREATE_SEQUENCE"
        elif "DROP SEQUENCE" in stmt_upper:
            return "DROP_SEQUENCE"
        else:
            return "UNKNOWN"
    
    def _normalize_sql(self, stmt: str) -> str:
        normalized = sqlparse.format(
            stmt,
            keyword_case="upper",
            identifier_case="lower",
            strip_comments=True,
            use_space_around_operators=True,
        )
        return normalized.strip()
    
    def _extract_tables(self, stmt: str, op_type: str) -> List[str]:
        tables: List[str] = []
        
        stmt_upper = stmt.upper()
        
        patterns = [
            r"TABLE\s+([^\s(,;]+)",
            r"INTO\s+([^\s(,;]+)",
            r"FROM\s+([^\s(,;]+)",
            r"UPDATE\s+([^\s(,;]+)",
            r"INDEX.*ON\s+([^\s(,;]+)",
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, stmt, re.IGNORECASE)
            for match in matches:
                table_name = match.strip().strip('"').strip("'")
                if table_name and table_name not in tables:
                    tables.append(table_name)
        
        return tables
    
    def _extract_columns(self, stmt: str, op_type: str) -> List[str]:
        columns: List[str] = []
        
        if op_type in ["ALTER_ADD_COLUMN", "ALTER_DROP_COLUMN", "ALTER_MODIFY_COLUMN", "ALTER_RENAME_COLUMN"]:
            patterns = [
                r"COLUMN\s+([^\s(,;]+)",
                r"RENAME\s+COLUMN\s+([^\s]+)\s+TO\s+([^\s,;]+)",
            ]
            for pattern in patterns:
                matches = re.findall(pattern, stmt, re.IGNORECASE)
                for match in matches:
                    if isinstance(match, tuple):
                        for col in match:
                            col = col.strip().strip('"').strip("'")
                            if col and col not in columns:
                                columns.append(col)
                    else:
                        col = match.strip().strip('"').strip("'")
                        if col and col not in columns:
                            columns.append(col)
        
        return columns
    
    def _assess_risk(self, op_type: str, stmt: str) -> str:
        high_risk_ops = [
            "DROP_TABLE", "DROP_INDEX", "ALTER_DROP_COLUMN",
            "TRUNCATE", "DELETE", "ALTER_RENAME_COLUMN",
            "ALTER_RENAME_TABLE",
        ]
        
        medium_risk_ops = [
            "ALTER_MODIFY_COLUMN", "ALTER_DROP_CONSTRAINT",
            "UPDATE", "DROP_VIEW", "DROP_SEQUENCE",
        ]
        
        if op_type in high_risk_ops:
            return "high"
        elif op_type in medium_risk_ops:
            return "medium"
        else:
            return "low"


class AlembicMigrationParser(BaseMigrationParser):
    
    VERSION_PATTERN = r"([a-f0-9]{12,})_.*\.py"
    
    def detect_type(self, filepath: str) -> bool:
        return filepath.endswith(".py") and "alembic" in filepath.lower() or "versions" in filepath.lower()
    
    def get_version(self, filepath: str) -> Optional[str]:
        filename = os.path.basename(filepath)
        match = re.match(self.VERSION_PATTERN, filename)
        if match:
            return match.group(1)
        return None
    
    def parse(self, filepath: str) -> ParsedMigration:
        filename = os.path.basename(filepath)
        version = self.get_version(filepath) or "unknown"
        
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        up_ops, down_ops = self._extract_functions(content)
        has_rollback = len(down_ops) > 0
        
        return ParsedMigration(
            version=version,
            filename=filename,
            filepath=filepath,
            migration_type="alembic",
            raw_content=content,
            up_operations=up_ops,
            down_operations=down_ops,
            has_rollback=has_rollback,
            metadata={
                "revision": self._extract_revision(content),
                "down_revision": self._extract_down_revision(content),
            },
        )
    
    def _extract_functions(self, content: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        up_ops: List[Dict[str, Any]] = []
        down_ops: List[Dict[str, Any]] = []
        
        def_pattern = r"def\s+(upgrade|downgrade)\s*\([^)]*\)\s*:"
        matches = list(re.finditer(def_pattern, content))
        
        for i, match in enumerate(matches):
            func_name = match.group(1)
            start = match.end()
            
            if i + 1 < len(matches):
                end = matches[i + 1].start()
            else:
                end = len(content)
            
            func_body = content[start:end]
            
            ops = self._parse_alembic_operations(func_body, func_name)
            
            if func_name == "upgrade":
                up_ops = ops
            else:
                down_ops = ops
        
        return up_ops, down_ops
    
    def _parse_alembic_operations(self, body: str, func_name: str) -> List[Dict[str, Any]]:
        operations: List[Dict[str, Any]] = []
        
        op_patterns = [
            (r"op\.create_table\s*\(\s*['\"]([^'\"]+)['\"]", "CREATE_TABLE"),
            (r"op\.drop_table\s*\(\s*['\"]([^'\"]+)['\"]", "DROP_TABLE"),
            (r"op\.add_column\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]", "ALTER_ADD_COLUMN"),
            (r"op\.drop_column\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]", "ALTER_DROP_COLUMN"),
            (r"op\.alter_column\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]", "ALTER_MODIFY_COLUMN"),
            (r"op\.rename_table\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]", "ALTER_RENAME_TABLE"),
            (r"op\.create_index\s*\(\s*['\"]([^'\"]+)['\"]", "CREATE_INDEX"),
            (r"op\.drop_index\s*\(\s*['\"]([^'\"]+)['\"]", "DROP_INDEX"),
            (r"op\.create_unique_constraint", "ALTER_ADD_CONSTRAINT"),
            (r"op\.drop_constraint", "ALTER_DROP_CONSTRAINT"),
            (r"op\.execute\s*\(\s*['\"]([^'\"]+)['\"]", "EXECUTE"),
        ]
        
        for pattern, op_type in op_patterns:
            matches = re.findall(pattern, body)
            for match in matches:
                tables: List[str] = []
                columns: List[str] = []
                
                if isinstance(match, tuple):
                    if len(match) >= 1:
                        tables = [match[0]]
                    if len(match) >= 2:
                        columns = [match[1]]
                else:
                    if "TABLE" in op_type or "INDEX" in op_type:
                        tables = [match]
                
                operations.append({
                    "type": op_type,
                    "tables": tables,
                    "columns": columns,
                    "raw_match": str(match),
                    "risk_level": self._assess_risk(op_type),
                })
        
        return operations
    
    def _assess_risk(self, op_type: str) -> str:
        high_risk = ["DROP_TABLE", "ALTER_DROP_COLUMN", "ALTER_RENAME_TABLE"]
        medium_risk = ["ALTER_MODIFY_COLUMN", "DROP_INDEX", "ALTER_DROP_CONSTRAINT"]
        
        if op_type in high_risk:
            return "high"
        elif op_type in medium_risk:
            return "medium"
        else:
            return "low"
    
    def _extract_revision(self, content: str) -> Optional[str]:
        match = re.search(r"revision\s*=\s*['\"]([^'\"]+)['\"]", content)
        if match:
            return match.group(1)
        return None
    
    def _extract_down_revision(self, content: str) -> Optional[str]:
        match = re.search(r"down_revision\s*=\s*['\"]([^'\"]+)['\"]", content)
        if match:
            return match.group(1)
        return None


class PrismaMigrationParser(BaseMigrationParser):
    
    def detect_type(self, filepath: str) -> bool:
        return filepath.endswith(".prisma") or "prisma" in filepath.lower()
    
    def get_version(self, filepath: str) -> Optional[str]:
        path_parts = Path(filepath).parts
        for part in reversed(path_parts):
            match = re.match(r"(\d{14})_", part)
            if match:
                return match.group(1)
            match = re.match(r"(\d+)_", part)
            if match:
                return match.group(1)
        return None
    
    def parse(self, filepath: str) -> ParsedMigration:
        filename = os.path.basename(filepath)
        version = self.get_version(filepath) or "unknown"
        
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        models = self._parse_models(content)
        enums = self._parse_enums(content)
        
        up_ops = self._generate_operations(models, enums)
        
        return ParsedMigration(
            version=version,
            filename=filename,
            filepath=filepath,
            migration_type="prisma",
            raw_content=content,
            up_operations=up_ops,
            down_operations=[],
            has_rollback=False,
            metadata={
                "models_count": len(models),
                "enums_count": len(enums),
                "models": models,
                "enums": enums,
            },
        )
    
    def _parse_models(self, content: str) -> Dict[str, Any]:
        models: Dict[str, Any] = {}
        
        model_pattern = r"model\s+(\w+)\s*\{([^}]+)\}"
        matches = re.finditer(model_pattern, content, re.MULTILINE)
        
        for match in matches:
            model_name = match.group(1)
            model_body = match.group(2)
            
            fields = self._parse_fields(model_body)
            indices = self._parse_indices(model_body)
            
            models[model_name] = {
                "fields": fields,
                "indices": indices,
            }
        
        return models
    
    def _parse_fields(self, body: str) -> List[Dict[str, Any]]:
        fields: List[Dict[str, Any]] = []
        
        lines = body.strip().split("\n")
        for line in lines:
            line = line.strip()
            
            if not line or line.startswith("//") or line.startswith("@@"):
                continue
            
            field_parts = line.split()
            if len(field_parts) >= 2:
                field_name = field_parts[0]
                field_type = field_parts[1]
                
                is_id = "@id" in line or (field_name == "id" and "Int" in field_type)
                is_unique = "@unique" in line
                is_optional = "?" in field_type or "Optional" in field_type
                is_list = "[]" in field_type
                
                relation_match = re.search(r"@relation\s*\(([^)]+)\)", line)
                relation = None
                if relation_match:
                    relation = relation_match.group(1)
                
                fields.append({
                    "name": field_name,
                    "type": field_type.rstrip("?[]"),
                    "is_id": is_id,
                    "is_unique": is_unique,
                    "is_optional": is_optional,
                    "is_list": is_list,
                    "relation": relation,
                })
        
        return fields
    
    def _parse_indices(self, body: str) -> List[Dict[str, Any]]:
        indices: List[Dict[str, Any]] = []
        
        index_pattern = r"@@(unique|index)\s*\(\[([^\]]+)\]\)"
        matches = re.finditer(index_pattern, body)
        
        for match in matches:
            index_type = "UNIQUE" if match.group(1) == "unique" else "INDEX"
            fields_str = match.group(2)
            fields = [f.strip() for f in fields_str.split(",")]
            
            indices.append({
                "type": index_type,
                "fields": fields,
            })
        
        return indices
    
    def _parse_enums(self, content: str) -> Dict[str, List[str]]:
        enums: Dict[str, List[str]] = {}
        
        enum_pattern = r"enum\s+(\w+)\s*\{([^}]+)\}"
        matches = re.finditer(enum_pattern, content, re.MULTILINE)
        
        for match in matches:
            enum_name = match.group(1)
            enum_body = match.group(2)
            
            values: List[str] = []
            for line in enum_body.strip().split("\n"):
                line = line.strip()
                if line and not line.startswith("//"):
                    values.append(line.split()[0])
            
            enums[enum_name] = values
        
        return enums
    
    def _generate_operations(self, models: Dict[str, Any], enums: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        operations: List[Dict[str, Any]] = []
        
        for enum_name, enum_values in enums.items():
            operations.append({
                "type": "CREATE_ENUM",
                "name": enum_name,
                "values": enum_values,
                "risk_level": "low",
            })
        
        for model_name, model_info in models.items():
            operations.append({
                "type": "CREATE_TABLE",
                "name": model_name,
                "fields": model_info.get("fields", []),
                "risk_level": "low",
            })
            
            for idx in model_info.get("indices", []):
                operations.append({
                    "type": "CREATE_" + idx["type"],
                    "table": model_name,
                    "fields": idx["fields"],
                    "risk_level": "low",
                })
        
        return operations


class MigrationParserFactory:
    
    _parsers: List[BaseMigrationParser] = []
    
    @classmethod
    def get_parsers(cls) -> List[BaseMigrationParser]:
        if not cls._parsers:
            cls._parsers = [
                SQLMigrationParser(),
                AlembicMigrationParser(),
                PrismaMigrationParser(),
            ]
        return cls._parsers
    
    @classmethod
    def parse_file(cls, filepath: str) -> Optional[ParsedMigration]:
        for parser in cls.get_parsers():
            if parser.detect_type(filepath):
                return parser.parse(filepath)
        
        if filepath.lower().endswith(".sql"):
            return SQLMigrationParser().parse(filepath)
        
        return None
    
    @classmethod
    def get_version(cls, filepath: str) -> Optional[str]:
        for parser in cls.get_parsers():
            if parser.detect_type(filepath):
                return parser.get_version(filepath)
        
        if filepath.lower().endswith(".sql"):
            return SQLMigrationParser().get_version(filepath)
        
        return None
