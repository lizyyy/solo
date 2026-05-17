import pyarrow.parquet as pq
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .types import SchemaSnapshot, BadRow


def read_parquet_schema(file_path: str) -> pq.ParquetSchema:
    return pq.read_schema(file_path)


def schema_to_dict(schema: pq.ParquetSchema) -> List[Dict[str, Any]]:
    fields = []
    for i in range(len(schema)):
        field = schema.field(i)
        logical_type = None
        if hasattr(field, 'logical_type'):
            logical_type = str(field.logical_type) if field.logical_type else None
        fields.append({
            "name": field.name,
            "type": str(field.type),
            "nullable": field.nullable,
            "logical_type": logical_type,
        })
    return fields


def get_schema_snapshot(file_path: str) -> SchemaSnapshot:
    schema = read_parquet_schema(file_path)
    parquet_file = pq.ParquetFile(file_path)
    
    return SchemaSnapshot(
        file_path=file_path,
        snapshot_time=datetime.now().isoformat(),
        fields=schema_to_dict(schema),
        row_count=parquet_file.metadata.num_rows
    )


def validate_parquet_file(file_path: str, sample_size: int = 1000) -> List[BadRow]:
    bad_rows = []
    try:
        parquet_file = pq.ParquetFile(file_path)
        total_rows = parquet_file.metadata.num_rows
        
        for row_group_idx in range(parquet_file.num_row_groups):
            row_group = parquet_file.read_row_group(row_group_idx)
            base_row = row_group_idx * parquet_file.metadata.row_group(row_group_idx).num_rows
            
            for col_idx, col in enumerate(row_group.columns):
                col_name = row_group.schema.field(col_idx).name
                try:
                    col.to_pandas()
                except Exception as e:
                    for chunk_idx, chunk in enumerate(col.chunks):
                        try:
                            chunk.to_pandas()
                        except Exception as chunk_e:
                            bad_rows.append(BadRow(
                                row_index=base_row + chunk_idx,
                                file_path=file_path,
                                reason=f"Column decode error: {str(chunk_e)[:100]}",
                                column_name=col_name,
                                raw_value=None
                            ))
                            if len(bad_rows) >= sample_size:
                                return bad_rows
    except Exception as e:
        bad_rows.append(BadRow(
            row_index=-1,
            file_path=file_path,
            reason=f"File read error: {str(e)}",
            column_name=None,
            raw_value=None
        ))
    
    return bad_rows


def get_parquet_files(input_path: str) -> List[str]:
    path = Path(input_path)
    if path.is_file():
        if path.suffix.lower() == '.parquet':
            return [str(path)]
        return []
    elif path.is_dir():
        return sorted([str(f) for f in path.rglob('*.parquet') if f.is_file()])
    return []
