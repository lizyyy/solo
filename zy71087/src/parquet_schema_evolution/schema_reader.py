from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pyarrow as pa
import pyarrow.parquet as pq

from .models import DecimalInfo, FieldSchema, SchemaSnapshot


class SchemaReader:
    def __init__(self):
        pass

    def read_from_parquet(
        self,
        path: str,
        sample_partitions: Optional[List[str]] = None,
        sample_size: int = 10,
    ) -> SchemaSnapshot:
        path_obj = Path(path)

        if path_obj.is_file():
            return self._read_single_file(path_obj)
        elif path_obj.is_dir():
            return self._read_directory(path_obj, sample_partitions, sample_size)
        else:
            raise FileNotFoundError(f"Path not found: {path}")

    def _read_single_file(self, file_path: Path) -> SchemaSnapshot:
        parquet_file = pq.ParquetFile(file_path)
        schema = parquet_file.schema_arrow
        fields = self._parse_arrow_schema(schema)

        return SchemaSnapshot(
            source=str(file_path),
            created_at=datetime.now(),
            fields=fields,
            row_count=parquet_file.metadata.num_rows,
            file_count=1,
        )

    def _read_directory(
        self,
        dir_path: Path,
        sample_partitions: Optional[List[str]] = None,
        sample_size: int = 10,
    ) -> SchemaSnapshot:
        parquet_files = list(dir_path.rglob("*.parquet"))

        if not parquet_files:
            raise ValueError(f"No Parquet files found in directory: {dir_path}")

        if sample_partitions:
            parquet_files = self._filter_by_partitions(parquet_files, sample_partitions)

        if len(parquet_files) > sample_size:
            import random
            random.seed(42)
            parquet_files = random.sample(parquet_files, sample_size)

        schemas = []
        total_rows = 0

        for file_path in parquet_files[:sample_size]:
            try:
                parquet_file = pq.ParquetFile(file_path)
                schemas.append(parquet_file.schema_arrow)
                total_rows += parquet_file.metadata.num_rows
            except Exception as e:
                print(f"Warning: Could not read {file_path}: {e}")

        if not schemas:
            raise ValueError("No valid Parquet files could be read")

        merged_schema = self._merge_schemas(schemas)
        fields = self._parse_arrow_schema(merged_schema)

        return SchemaSnapshot(
            source=str(dir_path),
            created_at=datetime.now(),
            fields=fields,
            row_count=total_rows,
            file_count=len(parquet_files),
            partition_info=self._extract_partition_info(dir_path, parquet_files),
        )

    def _filter_by_partitions(
        self, files: List[Path], partitions: List[str]
    ) -> List[Path]:
        filtered = []
        for file_path in files:
            file_str = str(file_path)
            if any(p in file_str for p in partitions):
                filtered.append(file_path)
        return filtered if filtered else files

    def _extract_partition_info(
        self, dir_path: Path, files: List[Path]
    ) -> Dict[str, Any]:
        partition_cols = set()
        partition_values: Dict[str, set] = {}

        for file_path in files:
            rel_path = file_path.relative_to(dir_path)
            parts = rel_path.parts[:-1]

            for part in parts:
                if "=" in part:
                    col, val = part.split("=", 1)
                    partition_cols.add(col)
                    if col not in partition_values:
                        partition_values[col] = set()
                    partition_values[col].add(val)

        return {
            "columns": sorted(list(partition_cols)),
            "values": {k: sorted(list(v)) for k, v in partition_values.items()},
        }

    def _merge_schemas(self, schemas: List[pa.Schema]) -> pa.Schema:
        if len(schemas) == 1:
            return schemas[0]

        merged = schemas[0]
        for schema in schemas[1:]:
            try:
                merged = pa.unify_schemas([merged, schema])
            except Exception:
                pass
        return merged

    def _parse_arrow_schema(
        self, schema: pa.Schema, prefix: str = ""
    ) -> List[FieldSchema]:
        fields = []
        for i, field in enumerate(schema):
            field_path = f"{prefix}{field.name}" if prefix else field.name
            parsed_field = self._parse_field(field, field_path, prefix)
            fields.append(parsed_field)
        return fields

    def _parse_field(
        self, field: pa.Field, field_path: str, prefix: str = ""
    ) -> FieldSchema:
        data_type = field.type
        is_struct = pa.types.is_struct(data_type)
        is_list = pa.types.is_list(data_type) or pa.types.is_large_list(data_type)
        is_map = pa.types.is_map(data_type)

        children: List[FieldSchema] = []
        decimal_info: Optional[DecimalInfo] = None

        if is_struct:
            child_prefix = f"{field_path}."
            for child_name in data_type.names:
                child_field = data_type.field(child_name)
                child_path = f"{child_prefix}{child_name}"
                children.append(
                    self._parse_field(child_field, child_path, child_prefix)
                )
        elif is_list:
            item_field = data_type.value_field
            item_path = f"{field_path}.item"
            children.append(self._parse_field(item_field, item_path, f"{field_path}."))
        elif is_map:
            key_field = data_type.key_field
            item_field = data_type.item_field
            children.append(
                self._parse_field(key_field, f"{field_path}.key", f"{field_path}.")
            )
            children.append(
                self._parse_field(item_field, f"{field_path}.value", f"{field_path}.")
            )
        elif pa.types.is_decimal(data_type):
            decimal_info = DecimalInfo(
                precision=data_type.precision, scale=data_type.scale
            )

        type_str = self._type_to_string(data_type)

        metadata: Dict[str, Any] = {}
        if field.metadata:
            for k, v in field.metadata.items():
                try:
                    metadata[k.decode("utf-8")] = v.decode("utf-8")
                except Exception:
                    pass

        return FieldSchema(
            name=field.name,
            path=field_path,
            data_type=type_str,
            nullable=field.nullable,
            is_struct=is_struct,
            is_list=is_list,
            is_map=is_map,
            children=children,
            decimal_info=decimal_info,
            metadata=metadata,
            original_type=str(data_type),
        )

    def _type_to_string(self, data_type: pa.DataType) -> str:
        if pa.types.is_null(data_type):
            return "null"
        elif pa.types.is_boolean(data_type):
            return "boolean"
        elif pa.types.is_int8(data_type):
            return "int8"
        elif pa.types.is_int16(data_type):
            return "int16"
        elif pa.types.is_int32(data_type):
            return "int32"
        elif pa.types.is_int64(data_type):
            return "int64"
        elif pa.types.is_uint8(data_type):
            return "uint8"
        elif pa.types.is_uint16(data_type):
            return "uint16"
        elif pa.types.is_uint32(data_type):
            return "uint32"
        elif pa.types.is_uint64(data_type):
            return "uint64"
        elif pa.types.is_float16(data_type):
            return "float16"
        elif pa.types.is_float32(data_type):
            return "float32"
        elif pa.types.is_float64(data_type):
            return "float64"
        elif pa.types.is_decimal(data_type):
            return f"decimal({data_type.precision},{data_type.scale})"
        elif pa.types.is_date32(data_type):
            return "date32"
        elif pa.types.is_date64(data_type):
            return "date64"
        elif pa.types.is_timestamp(data_type):
            tz = f"[{data_type.tz}]" if data_type.tz else ""
            return f"timestamp[{data_type.unit}]{tz}"
        elif pa.types.is_time32(data_type):
            return f"time32[{data_type.unit}]"
        elif pa.types.is_time64(data_type):
            return f"time64[{data_type.unit}]"
        elif pa.types.is_duration(data_type):
            return f"duration[{data_type.unit}]"
        elif pa.types.is_string(data_type):
            return "string"
        elif pa.types.is_large_string(data_type):
            return "large_string"
        elif pa.types.is_binary(data_type):
            return "binary"
        elif pa.types.is_large_binary(data_type):
            return "large_binary"
        elif pa.types.is_fixed_size_binary(data_type):
            return f"fixed_size_binary[{data_type.byte_width}]"
        elif pa.types.is_struct(data_type):
            return "struct"
        elif pa.types.is_list(data_type):
            return "list"
        elif pa.types.is_large_list(data_type):
            return "large_list"
        elif pa.types.is_map(data_type):
            return "map"
        elif pa.types.is_union(data_type):
            return "union"
        else:
            return str(data_type)

    def read_from_snapshot(self, path: str) -> SchemaSnapshot:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        fields = self._dict_to_fields(data.get("fields", []))

        return SchemaSnapshot(
            source=data.get("source", path),
            created_at=datetime.fromisoformat(data.get("created_at", datetime.now().isoformat())),
            fields=fields,
            partition_info=data.get("partition_info"),
            row_count=data.get("row_count"),
            file_count=data.get("file_count"),
        )

    def _dict_to_fields(self, fields_data: List[Dict[str, Any]]) -> List[FieldSchema]:
        fields = []
        for fd in fields_data:
            decimal_info = None
            if fd.get("decimal_info"):
                decimal_info = DecimalInfo(
                    precision=fd["decimal_info"]["precision"],
                    scale=fd["decimal_info"]["scale"],
                )

            children = self._dict_to_fields(fd.get("children", []))

            fields.append(
                FieldSchema(
                    name=fd["name"],
                    path=fd["path"],
                    data_type=fd["data_type"],
                    nullable=fd["nullable"],
                    is_struct=fd.get("is_struct", False),
                    is_list=fd.get("is_list", False),
                    is_map=fd.get("is_map", False),
                    children=children,
                    decimal_info=decimal_info,
                    metadata=fd.get("metadata", {}),
                    original_type=fd.get("original_type"),
                )
            )
        return fields

    def save_snapshot(self, snapshot: SchemaSnapshot, output_path: str) -> None:
        output_path_obj = Path(output_path)
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path_obj, "w", encoding="utf-8") as f:
            json.dump(snapshot.to_dict(), f, indent=2, ensure_ascii=False)
