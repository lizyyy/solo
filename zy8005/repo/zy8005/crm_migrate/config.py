import json
import os
from typing import Any, Dict, List, Optional

import yaml


class SchemaConfig:
    def __init__(self, tables: Dict[str, Any]):
        self.tables = tables

    def get_table(self, table_name: str) -> Optional[Dict[str, Any]]:
        return self.tables.get(table_name)

    def get_columns(self, table_name: str) -> Dict[str, Any]:
        table = self.get_table(table_name)
        if table:
            return table.get("columns", {})
        return {}

    def get_required_columns(self, table_name: str) -> List[str]:
        columns = self.get_columns(table_name)
        return [name for name, col in columns.items() if col.get("required", False)]

    def get_foreign_keys(self, table_name: str) -> List[Dict[str, str]]:
        table = self.get_table(table_name)
        if table:
            return table.get("foreign_keys", [])
        return []

    def get_dependencies(self, table_name: str) -> List[str]:
        fks = self.get_foreign_keys(table_name)
        return [fk["referenced_table"] for fk in fks]

    def get_all_tables(self) -> List[str]:
        return list(self.tables.keys())


class MappingConfig:
    def __init__(self, mappings: Dict[str, Any]):
        self.mappings = mappings

    def get_table_mapping(self, target_table: str) -> Optional[Dict[str, Any]]:
        return self.mappings.get(target_table)

    def get_source_file(self, target_table: str) -> Optional[str]:
        mapping = self.get_table_mapping(target_table)
        if mapping:
            return mapping.get("source_file")
        return None

    def get_field_mappings(self, target_table: str) -> Dict[str, str]:
        mapping = self.get_table_mapping(target_table)
        if mapping:
            return mapping.get("fields", {})
        return {}

    def get_transformations(self, target_table: str) -> Dict[str, Dict[str, Any]]:
        mapping = self.get_table_mapping(target_table)
        if mapping:
            return mapping.get("transformations", {})
        return {}

    def get_natural_keys(self, target_table: str) -> List[str]:
        mapping = self.get_table_mapping(target_table)
        if mapping:
            return mapping.get("natural_keys", [])
        return []

    def get_all_target_tables(self) -> List[str]:
        return list(self.mappings.keys())


def load_json_file(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_yaml_file(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_schema(schema_path: str) -> SchemaConfig:
    ext = os.path.splitext(schema_path)[1].lower()
    if ext == ".json":
        data = load_json_file(schema_path)
    elif ext in (".yaml", ".yml"):
        data = load_yaml_file(schema_path)
    else:
        raise ValueError(f"Unsupported schema file format: {ext}")
    
    return SchemaConfig(data.get("tables", data))


def load_mapping(mapping_path: str) -> MappingConfig:
    ext = os.path.splitext(mapping_path)[1].lower()
    if ext == ".json":
        data = load_json_file(mapping_path)
    elif ext in (".yaml", ".yml"):
        data = load_yaml_file(mapping_path)
    else:
        raise ValueError(f"Unsupported mapping file format: {ext}")
    
    return MappingConfig(data)
