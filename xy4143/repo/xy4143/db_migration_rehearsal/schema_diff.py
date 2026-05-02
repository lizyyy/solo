import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from deepdiff import DeepDiff


@dataclass
class ColumnDiff:
    name: str
    table_name: str
    change_type: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    properties_changed: Dict[str, Tuple[Any, Any]] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "table_name": self.table_name,
            "change_type": self.change_type,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "properties_changed": self.properties_changed,
        }


@dataclass
class TableDiff:
    name: str
    change_type: str
    old_schema: Optional[Dict[str, Any]] = None
    new_schema: Optional[Dict[str, Any]] = None
    columns_added: List[ColumnDiff] = field(default_factory=list)
    columns_removed: List[ColumnDiff] = field(default_factory=list)
    columns_modified: List[ColumnDiff] = field(default_factory=list)
    indices_added: List[Dict[str, Any]] = field(default_factory=list)
    indices_removed: List[Dict[str, Any]] = field(default_factory=list)
    foreign_keys_added: List[Dict[str, Any]] = field(default_factory=list)
    foreign_keys_removed: List[Dict[str, Any]] = field(default_factory=list)
    primary_key_changed: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "change_type": self.change_type,
            "columns_added": [c.to_dict() for c in self.columns_added],
            "columns_removed": [c.to_dict() for c in self.columns_removed],
            "columns_modified": [c.to_dict() for c in self.columns_modified],
            "indices_added": self.indices_added,
            "indices_removed": self.indices_removed,
            "foreign_keys_added": self.foreign_keys_added,
            "foreign_keys_removed": self.foreign_keys_removed,
            "primary_key_changed": self.primary_key_changed,
        }


@dataclass
class SchemaDiffResult:
    has_changes: bool = False
    
    tables_added: List[TableDiff] = field(default_factory=list)
    tables_removed: List[TableDiff] = field(default_factory=list)
    tables_modified: List[TableDiff] = field(default_factory=list)
    
    columns_added: List[ColumnDiff] = field(default_factory=list)
    columns_removed: List[ColumnDiff] = field(default_factory=list)
    columns_modified: List[ColumnDiff] = field(default_factory=list)
    
    indexes_added: List[Dict[str, Any]] = field(default_factory=list)
    indexes_removed: List[Dict[str, Any]] = field(default_factory=list)
    
    foreign_keys_added: List[Dict[str, Any]] = field(default_factory=list)
    foreign_keys_removed: List[Dict[str, Any]] = field(default_factory=list)
    
    raw_diff: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "has_changes": self.has_changes,
            "tables": {
                "added": [t.to_dict() for t in self.tables_added],
                "removed": [t.to_dict() for t in self.tables_removed],
                "modified": [t.to_dict() for t in self.tables_modified],
            },
            "columns": {
                "added": [c.to_dict() for c in self.columns_added],
                "removed": [c.to_dict() for c in self.columns_removed],
                "modified": [c.to_dict() for c in self.columns_modified],
            },
            "indexes": {
                "added": self.indexes_added,
                "removed": self.indexes_removed,
            },
            "foreign_keys": {
                "added": self.foreign_keys_added,
                "removed": self.foreign_keys_removed,
            },
            "summary": self.get_summary(),
        }
    
    def get_summary(self) -> Dict[str, int]:
        return {
            "tables_added": len(self.tables_added),
            "tables_removed": len(self.tables_removed),
            "tables_modified": len(self.tables_modified),
            "columns_added": len(self.columns_added),
            "columns_removed": len(self.columns_removed),
            "columns_modified": len(self.columns_modified),
            "indexes_added": len(self.indexes_added),
            "indexes_removed": len(self.indexes_removed),
            "foreign_keys_added": len(self.foreign_keys_added),
            "foreign_keys_removed": len(self.foreign_keys_removed),
        }


class BaseSchemaComparator(ABC):
    
    @abstractmethod
    def compare(self, old_schema: Dict[str, Any], new_schema: Dict[str, Any]) -> SchemaDiffResult:
        pass


class SchemaComparator(BaseSchemaComparator):
    
    def compare(self, old_schema: Dict[str, Any], new_schema: Dict[str, Any]) -> SchemaDiffResult:
        result = SchemaDiffResult()
        
        old_tables = self._get_tables_dict(old_schema)
        new_tables = self._get_tables_dict(new_schema)
        
        old_table_names = set(old_tables.keys())
        new_table_names = set(new_tables.keys())
        
        tables_added = new_table_names - old_table_names
        tables_removed = old_table_names - new_table_names
        tables_common = old_table_names & new_table_names
        
        for table_name in tables_added:
            table_diff = TableDiff(
                name=table_name,
                change_type="added",
                new_schema=new_tables[table_name],
            )
            result.tables_added.append(table_diff)
            result.has_changes = True
        
        for table_name in tables_removed:
            table_diff = TableDiff(
                name=table_name,
                change_type="removed",
                old_schema=old_tables[table_name],
            )
            result.tables_removed.append(table_diff)
            result.has_changes = True
        
        for table_name in tables_common:
            old_table = old_tables[table_name]
            new_table = new_tables[table_name]
            
            table_diff = self._compare_table(table_name, old_table, new_table)
            
            if (
                table_diff.columns_added
                or table_diff.columns_removed
                or table_diff.columns_modified
                or table_diff.indices_added
                or table_diff.indices_removed
                or table_diff.foreign_keys_added
                or table_diff.foreign_keys_removed
                or table_diff.primary_key_changed
            ):
                table_diff.change_type = "modified"
                result.tables_modified.append(table_diff)
                result.has_changes = True
                
                result.columns_added.extend(table_diff.columns_added)
                result.columns_removed.extend(table_diff.columns_removed)
                result.columns_modified.extend(table_diff.columns_modified)
                
                for idx in table_diff.indices_added:
                    result.indexes_added.append({
                        "table": table_name,
                        "index": idx,
                    })
                
                for idx in table_diff.indices_removed:
                    result.indexes_removed.append({
                        "table": table_name,
                        "index": idx,
                    })
                
                for fk in table_diff.foreign_keys_added:
                    result.foreign_keys_added.append({
                        "table": table_name,
                        "foreign_key": fk,
                    })
                
                for fk in table_diff.foreign_keys_removed:
                    result.foreign_keys_removed.append({
                        "table": table_name,
                        "foreign_key": fk,
                    })
        
        raw_diff = DeepDiff(old_schema, new_schema, ignore_order=True, report_repetition=True)
        result.raw_diff = raw_diff.to_dict() if raw_diff else None
        
        return result
    
    def _get_tables_dict(self, schema: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        tables = schema.get("tables", [])
        return {table["name"]: table for table in tables}
    
    def _compare_table(
        self,
        table_name: str,
        old_table: Dict[str, Any],
        new_table: Dict[str, Any],
    ) -> TableDiff:
        diff = TableDiff(name=table_name, change_type="none")
        
        old_columns = self._get_columns_dict(old_table)
        new_columns = self._get_columns_dict(new_table)
        
        old_col_names = set(old_columns.keys())
        new_col_names = set(new_columns.keys())
        
        cols_added = new_col_names - old_col_names
        cols_removed = old_col_names - new_col_names
        cols_common = old_col_names & new_col_names
        
        for col_name in cols_added:
            diff.columns_added.append(ColumnDiff(
                name=col_name,
                table_name=table_name,
                change_type="added",
                new_value=new_columns[col_name],
            ))
        
        for col_name in cols_removed:
            diff.columns_removed.append(ColumnDiff(
                name=col_name,
                table_name=table_name,
                change_type="removed",
                old_value=old_columns[col_name],
            ))
        
        for col_name in cols_common:
            old_col = old_columns[col_name]
            new_col = new_columns[col_name]
            
            col_diff = self._compare_column(table_name, col_name, old_col, new_col)
            
            if col_diff.properties_changed:
                diff.columns_modified.append(col_diff)
        
        old_indices = self._get_indices_dict(old_table)
        new_indices = self._get_indices_dict(new_table)
        
        old_idx_names = set(old_indices.keys())
        new_idx_names = set(new_indices.keys())
        
        diff.indices_added = [
            new_indices[name] for name in (new_idx_names - old_idx_names)
        ]
        diff.indices_removed = [
            old_indices[name] for name in (old_idx_names - new_idx_names)
        ]
        
        old_fks = self._get_foreign_keys_dict(old_table)
        new_fks = self._get_foreign_keys_dict(new_table)
        
        old_fk_names = set(old_fks.keys())
        new_fk_names = set(new_fks.keys())
        
        diff.foreign_keys_added = [
            new_fks[name] for name in (new_fk_names - old_fk_names)
        ]
        diff.foreign_keys_removed = [
            old_fks[name] for name in (old_fk_names - old_fk_names)
        ]
        
        old_pk = set(old_table.get("primary_key_columns", []))
        new_pk = set(new_table.get("primary_key_columns", []))
        
        if old_pk != new_pk:
            diff.primary_key_changed = True
        
        return diff
    
    def _get_columns_dict(self, table: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        columns = table.get("columns", [])
        return {col["name"]: col for col in columns}
    
    def _get_indices_dict(self, table: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        indices = table.get("indices", [])
        return {idx["name"]: idx for idx in indices}
    
    def _get_foreign_keys_dict(self, table: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        fks = table.get("foreign_keys", [])
        result: Dict[str, Dict[str, Any]] = {}
        
        for fk in fks:
            name = fk.get("name") or "_".join(fk.get("constrained_columns", []))
            result[name] = fk
        
        return result
    
    def _compare_column(
        self,
        table_name: str,
        column_name: str,
        old_col: Dict[str, Any],
        new_col: Dict[str, Any],
    ) -> ColumnDiff:
        diff = ColumnDiff(
            name=column_name,
            table_name=table_name,
            change_type="modified",
        )
        
        properties_to_check = ["type", "nullable", "default", "autoincrement"]
        
        for prop in properties_to_check:
            old_val = old_col.get(prop)
            new_val = new_col.get(prop)
            
            if old_val != new_val:
                diff.properties_changed[prop] = (old_val, new_val)
        
        return diff


class SchemaDiffer:
    
    def __init__(self):
        self.comparator = SchemaComparator()
    
    def compare(
        self,
        old_schema: Dict[str, Any],
        new_schema: Dict[str, Any],
    ) -> SchemaDiffResult:
        return self.comparator.compare(old_schema, new_schema)
    
    def compare_schemas(
        self,
        old_schema_path: str,
        new_schema_path: str,
    ) -> SchemaDiffResult:
        import json
        
        with open(old_schema_path, "r", encoding="utf-8") as f:
            old_schema = json.load(f)
        
        with open(new_schema_path, "r", encoding="utf-8") as f:
            new_schema = json.load(f)
        
        return self.compare(old_schema, new_schema)
