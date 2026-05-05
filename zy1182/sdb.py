#!/usr/bin/env python3
"""
SDB - Simple Database
A lightweight, single-file database engine with:
- Page-based storage
- Simple B+Tree index
- Write-Ahead Log (WAL) for transactions
- Crash recovery
"""

import os
import struct
import json
import pickle
import hashlib
import shutil
from typing import Dict, List, Optional, Any, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import csv
import re
from datetime import datetime
import uuid


class PageType(Enum):
    HEADER = 0
    TABLE_META = 1
    DATA = 2
    INDEX = 3
    FREE = 4


class DataType(Enum):
    INTEGER = "INTEGER"
    TEXT = "TEXT"
    REAL = "REAL"
    BLOB = "BLOB"
    BOOLEAN = "BOOLEAN"
    DATETIME = "DATETIME"


@dataclass
class ColumnDef:
    name: str
    data_type: DataType
    nullable: bool = True
    default: Any = None
    is_primary_key: bool = False
    is_unique: bool = False
    is_auto_increment: bool = False


@dataclass
class TableDef:
    name: str
    columns: Dict[str, ColumnDef] = field(default_factory=dict)
    primary_key: Optional[str] = None
    indexes: Dict[str, List[str]] = field(default_factory=dict)
    next_row_id: int = 1
    root_page_id: int = 0
    index_pages: Dict[str, int] = field(default_factory=dict)


@dataclass
class Row:
    row_id: int
    columns: Dict[str, Any]
    is_deleted: bool = False


@dataclass
class Page:
    page_id: int
    page_type: PageType
    data: bytes = b""
    next_page: int = -1
    prev_page: int = -1
    free_space: int = 0


@dataclass
class WALRecord:
    lsn: int
    page_id: int
    old_data: bytes
    new_data: bytes
    is_commit: bool = False
    is_rollback: bool = False
    table_name: str = ""
    operation: str = ""
    row_id: int = -1
    timestamp: float = 0.0


class SDBError(Exception):
    pass


class ConstraintError(SDBError):
    pass


class TypeMismatchError(SDBError):
    pass


class TransactionError(SDBError):
    pass


class SDBCore:
    PAGE_SIZE = 4096
    MAX_PAGES = 10000
    MAGIC = b"SDB1"
    VERSION = 1
    WAL_FILE_SUFFIX = ".wal"
    CHECKPOINT_SUFFIX = ".checkpoint"
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.wal_path = db_path + self.WAL_FILE_SUFFIX
        self.checkpoint_path = db_path + self.CHECKPOINT_SUFFIX
        self.file_handle = None
        self.tables: Dict[str, TableDef] = {}
        self.pages: Dict[int, Page] = {}
        self.header_page: Optional[Page] = None
        self.next_page_id: int = 1
        self.transaction_active: bool = False
        self.wal_records: List[WALRecord] = []
        self.next_lsn: int = 1
        self.dirty_pages: set = set()
        self.in_transaction: bool = False
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
    
    def create(self) -> None:
        if os.path.exists(self.db_path):
            raise SDBError(f"Database file already exists: {self.db_path}")
        
        self.file_handle = open(self.db_path, "w+b")
        self._initialize_header()
        self._create_table_meta_page()
        self._flush_all_pages()
        self._create_wal_file()
        
        print(f"Database created: {self.db_path}")
    
    def open(self) -> None:
        if not os.path.exists(self.db_path):
            raise SDBError(f"Database file not found: {self.db_path}")
        
        self.file_handle = open(self.db_path, "r+b")
        self._read_header()
        self._read_all_pages()
        
        if os.path.exists(self.wal_path):
            print("WAL found, checking for recovery...")
            self._perform_recovery()
        
        self._load_tables_from_meta()
        print(f"Database opened: {self.db_path}")
    
    def close(self) -> None:
        if self.in_transaction:
            self.rollback()
        
        if self.dirty_pages:
            self._flush_all_pages()
        
        if os.path.exists(self.wal_path) and not self.in_transaction:
            os.remove(self.wal_path)
        
        if self.file_handle:
            self.file_handle.close()
            self.file_handle = None
    
    def _initialize_header(self) -> None:
        header_info = struct.pack("<IIII", self.VERSION, self.PAGE_SIZE, 1, 1)
        header_page = Page(
            page_id=0,
            page_type=PageType.HEADER,
            data=self.MAGIC + header_info,
            free_space=self.PAGE_SIZE - 16 - len(self.MAGIC) - len(header_info)
        )
        self.pages[0] = header_page
        self.header_page = header_page
    
    def _read_header(self) -> None:
        self.file_handle.seek(0)
        raw_page = self.file_handle.read(self.PAGE_SIZE)
        
        page_type_val = struct.unpack("<I", raw_page[:4])[0]
        data_length = struct.unpack("<I", raw_page[12:16])[0]
        
        page_data = raw_page[16:16+data_length]
        
        magic = page_data[:4]
        if magic != self.MAGIC:
            raise SDBError(f"Invalid database file. Expected magic {self.MAGIC}, got {magic}")
        
        version, page_size, next_page_id, num_pages = struct.unpack("<IIII", page_data[4:20])
        self.next_page_id = next_page_id
        
        if page_size != self.PAGE_SIZE:
            raise SDBError(f"Unsupported page size: {page_size}. Expected {self.PAGE_SIZE}")
        
        header_page = Page(
            page_id=0,
            page_type=PageType(page_type_val),
            data=page_data,
            free_space=self.PAGE_SIZE - 16 - data_length
        )
        self.pages[0] = header_page
        self.header_page = header_page
    
    def _read_all_pages(self) -> None:
        self.file_handle.seek(0, os.SEEK_END)
        file_size = self.file_handle.tell()
        num_pages = file_size // self.PAGE_SIZE
        
        for page_id in range(num_pages):
            self._read_page(page_id)
    
    def _read_page(self, page_id: int) -> Page:
        if page_id in self.pages:
            return self.pages[page_id]
        
        self.file_handle.seek(page_id * self.PAGE_SIZE)
        raw_data = self.file_handle.read(self.PAGE_SIZE)
        
        page_type_val = struct.unpack("<I", raw_data[:4])[0]
        next_page = struct.unpack("<i", raw_data[4:8])[0]
        prev_page = struct.unpack("<i", raw_data[8:12])[0]
        data_length = struct.unpack("<I", raw_data[12:16])[0]
        
        data = raw_data[16:16+data_length]
        
        page = Page(
            page_id=page_id,
            page_type=PageType(page_type_val),
            data=data,
            next_page=next_page,
            prev_page=prev_page,
            free_space=self.PAGE_SIZE - 16 - data_length
        )
        
        self.pages[page_id] = page
        return page
    
    def _create_table_meta_page(self) -> None:
        meta_page = Page(
            page_id=self.next_page_id,
            page_type=PageType.TABLE_META,
            data=b"{}",
            free_space=self.PAGE_SIZE - 16
        )
        self.pages[self.next_page_id] = meta_page
        self.next_page_id += 1
    
    def _flush_all_pages(self) -> None:
        self._update_header()
        for page_id in sorted(self.pages.keys()):
            self._flush_page(page_id)
        self.dirty_pages.clear()
    
    def _flush_page(self, page_id: int) -> None:
        page = self.pages[page_id]
        
        self.file_handle.seek(page_id * self.PAGE_SIZE)
        
        header = struct.pack("<IiiI", 
            page.page_type.value,
            page.next_page,
            page.prev_page,
            len(page.data)
        )
        
        padding = b"\x00" * (self.PAGE_SIZE - 16 - len(page.data))
        self.file_handle.write(header + page.data + padding)
    
    def _update_header(self) -> None:
        if 0 in self.pages:
            header_info = struct.pack("<IIII", 
                self.VERSION, 
                self.PAGE_SIZE, 
                self.next_page_id,
                len(self.pages)
            )
            self.pages[0].data = self.MAGIC + header_info
            self.pages[0].free_space = self.PAGE_SIZE - 16 - len(self.pages[0].data)
    
    def _load_tables_from_meta(self) -> None:
        for page_id, page in self.pages.items():
            if page.page_type == PageType.TABLE_META:
                try:
                    tables_data = json.loads(page.data.decode('utf-8'))
                    for table_name, table_data in tables_data.items():
                        table_def = TableDef(
                            name=table_name,
                            primary_key=table_data.get('primary_key'),
                            next_row_id=table_data.get('next_row_id', 1),
                            root_page_id=table_data.get('root_page_id', 0),
                            indexes=table_data.get('indexes', {}),
                            index_pages=table_data.get('index_pages', {})
                        )
                        
                        for col_name, col_data in table_data.get('columns', {}).items():
                            table_def.columns[col_name] = ColumnDef(
                                name=col_name,
                                data_type=DataType(col_data['data_type']),
                                nullable=col_data.get('nullable', True),
                                default=col_data.get('default'),
                                is_primary_key=col_data.get('is_primary_key', False),
                                is_unique=col_data.get('is_unique', False),
                                is_auto_increment=col_data.get('is_auto_increment', False)
                            )
                        
                        self.tables[table_name] = table_def
                except Exception as e:
                    print(f"Warning: Could not load table metadata: {e}")
                break
    
    def _save_tables_to_meta(self) -> None:
        meta_page_id = None
        for page_id, page in self.pages.items():
            if page.page_type == PageType.TABLE_META:
                meta_page_id = page_id
                break
        
        if meta_page_id is None:
            meta_page = Page(
                page_id=self.next_page_id,
                page_type=PageType.TABLE_META,
                data=b"{}",
                free_space=self.PAGE_SIZE - 16
            )
            meta_page_id = self.next_page_id
            self.pages[meta_page_id] = meta_page
            self.next_page_id += 1
        
        tables_data = {}
        for table_name, table_def in self.tables.items():
            tables_data[table_name] = {
                'name': table_name,
                'columns': {},
                'primary_key': table_def.primary_key,
                'next_row_id': table_def.next_row_id,
                'root_page_id': table_def.root_page_id,
                'indexes': table_def.indexes,
                'index_pages': table_def.index_pages
            }
            
            for col_name, col_def in table_def.columns.items():
                tables_data[table_name]['columns'][col_name] = {
                    'name': col_name,
                    'data_type': col_def.data_type.value,
                    'nullable': col_def.nullable,
                    'default': col_def.default,
                    'is_primary_key': col_def.is_primary_key,
                    'is_unique': col_def.is_unique,
                    'is_auto_increment': col_def.is_auto_increment
                }
        
        serialized = json.dumps(tables_data, ensure_ascii=False).encode('utf-8')
        self.pages[meta_page_id].data = serialized
        self.pages[meta_page_id].free_space = self.PAGE_SIZE - 16 - len(serialized)
        self.dirty_pages.add(meta_page_id)
    
    def _create_wal_file(self) -> None:
        with open(self.wal_path, 'wb') as f:
            f.write(b"")
    
    def _append_wal_record(self, record: WALRecord) -> None:
        self.wal_records.append(record)
        
        with open(self.wal_path, 'ab') as f:
            record_data = {
                'lsn': record.lsn,
                'page_id': record.page_id,
                'old_data': record.old_data.hex() if record.old_data else None,
                'new_data': record.new_data.hex() if record.new_data else None,
                'is_commit': record.is_commit,
                'is_rollback': record.is_rollback,
                'table_name': record.table_name,
                'operation': record.operation,
                'row_id': record.row_id,
                'timestamp': record.timestamp
            }
            f.write((json.dumps(record_data) + "\n").encode('utf-8'))
        
        self.next_lsn += 1
    
    def _perform_recovery(self) -> None:
        if not os.path.exists(self.wal_path):
            return
        
        records = []
        with open(self.wal_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        data = json.loads(line)
                        record = WALRecord(
                            lsn=data['lsn'],
                            page_id=data['page_id'],
                            old_data=bytes.fromhex(data['old_data']) if data['old_data'] else b"",
                            new_data=bytes.fromhex(data['new_data']) if data['new_data'] else b"",
                            is_commit=data.get('is_commit', False),
                            is_rollback=data.get('is_rollback', False),
                            table_name=data.get('table_name', ''),
                            operation=data.get('operation', ''),
                            row_id=data.get('row_id', -1),
                            timestamp=data.get('timestamp', 0.0)
                        )
                        records.append(record)
                    except Exception as e:
                        print(f"Skipping invalid WAL record: {e}")
        
        commit_found = False
        for record in reversed(records):
            if record.is_commit:
                commit_found = True
                break
            if record.is_rollback:
                break
        
        if commit_found:
            print("Found committed transaction, applying redo...")
            for record in records:
                if record.is_commit:
                    break
                if record.new_data and record.page_id >= 0:
                    if record.page_id in self.pages:
                        self.pages[record.page_id].data = record.new_data
                        self.dirty_pages.add(record.page_id)
        
        if self.dirty_pages:
            self._flush_all_pages()
        
        if os.path.exists(self.wal_path):
            os.remove(self.wal_path)
        
        print("Recovery complete.")
    
    def create_table(self, name: str, columns: List[ColumnDef], 
                     primary_key: Optional[str] = None) -> TableDef:
        if name in self.tables:
            raise SDBError(f"Table '{name}' already exists")
        
        table_def = TableDef(name=name, primary_key=primary_key)
        
        for col in columns:
            if col.name in table_def.columns:
                raise SDBError(f"Duplicate column name: {col.name}")
            table_def.columns[col.name] = col
            
            if col.is_primary_key:
                if primary_key and primary_key != col.name:
                    raise SDBError(f"Primary key conflict: '{primary_key}' vs '{col.name}'")
                table_def.primary_key = col.name
        
        if table_def.primary_key:
            table_def.columns[table_def.primary_key].is_primary_key = True
            table_def.columns[table_def.primary_key].nullable = False
            table_def.columns[table_def.primary_key].is_unique = True
            
            table_def.indexes[f"idx_{name}_pk"] = [table_def.primary_key]
        
        root_page = Page(
            page_id=self.next_page_id,
            page_type=PageType.DATA,
            data=pickle.dumps([]),
            free_space=self.PAGE_SIZE - 16
        )
        table_def.root_page_id = self.next_page_id
        self.pages[self.next_page_id] = root_page
        self.next_page_id += 1
        
        for idx_name, idx_cols in table_def.indexes.items():
            idx_page = Page(
                page_id=self.next_page_id,
                page_type=PageType.INDEX,
                data=pickle.dumps({}),
                free_space=self.PAGE_SIZE - 16
            )
            table_def.index_pages[idx_name] = self.next_page_id
            self.pages[self.next_page_id] = idx_page
            self.next_page_id += 1
        
        self.tables[name] = table_def
        self._save_tables_to_meta()
        
        print(f"Table '{name}' created with {len(table_def.columns)} columns")
        return table_def
    
    def drop_table(self, name: str) -> None:
        if name not in self.tables:
            raise SDBError(f"Table '{name}' does not exist")
        
        table_def = self.tables[name]
        
        if table_def.root_page_id in self.pages:
            del self.pages[table_def.root_page_id]
        
        for idx_name, idx_page_id in table_def.index_pages.items():
            if idx_page_id in self.pages:
                del self.pages[idx_page_id]
        
        del self.tables[name]
        self._save_tables_to_meta()
        
        print(f"Table '{name}' dropped")
    
    def _validate_value(self, col_def: ColumnDef, value: Any) -> Any:
        if value is None:
            if not col_def.nullable:
                raise ConstraintError(f"Column '{col_def.name}' cannot be NULL")
            return None
        
        try:
            if col_def.data_type == DataType.INTEGER:
                return int(value)
            elif col_def.data_type == DataType.REAL:
                return float(value)
            elif col_def.data_type == DataType.TEXT:
                return str(value)
            elif col_def.data_type == DataType.BOOLEAN:
                if isinstance(value, str):
                    return value.lower() in ('true', '1', 'yes')
                return bool(value)
            elif col_def.data_type == DataType.DATETIME:
                if isinstance(value, str):
                    return datetime.fromisoformat(value).isoformat()
                elif isinstance(value, datetime):
                    return value.isoformat()
                return str(value)
            elif col_def.data_type == DataType.BLOB:
                if isinstance(value, bytes):
                    return value.hex()
                return str(value)
        except Exception as e:
            raise TypeMismatchError(f"Type mismatch for column '{col_def.name}': {e}")
        
        return value
    
    def _get_auto_increment_value(self, table_def: TableDef, col_name: str) -> int:
        if col_name == table_def.primary_key:
            return table_def.next_row_id
        return 0
    
    def _validate_and_prepare_row(self, table_def: TableDef, values: Dict[str, Any]) -> Dict[str, Any]:
        prepared = {}
        
        for col_name, col_def in table_def.columns.items():
            if col_name in values:
                prepared[col_name] = self._validate_value(col_def, values[col_name])
            else:
                if col_def.is_auto_increment:
                    prepared[col_name] = self._get_auto_increment_value(table_def, col_name)
                elif col_def.default is not None:
                    prepared[col_name] = self._validate_value(col_def, col_def.default)
                elif col_def.is_primary_key and col_def.is_auto_increment:
                    prepared[col_name] = self._get_auto_increment_value(table_def, col_name)
                elif not col_def.nullable:
                    raise ConstraintError(f"Column '{col_name}' has no value and no default")
                else:
                    prepared[col_name] = None
        
        for col_name in values.keys():
            if col_name not in table_def.columns:
                raise SDBError(f"Column '{col_name}' does not exist in table '{table_def.name}'")
        
        return prepared
    
    def _read_data_page(self, page_id: int) -> List[Row]:
        page = self._read_page(page_id)
        try:
            return pickle.loads(page.data)
        except Exception:
            return []
    
    def _write_data_page(self, page_id: int, rows: List[Row], record_wal: bool = True) -> None:
        page = self.pages[page_id]
        old_data = page.data
        page.data = pickle.dumps(rows)
        page.free_space = self.PAGE_SIZE - 16 - len(page.data)
        
        if record_wal and self.in_transaction:
            record = WALRecord(
                lsn=self.next_lsn,
                page_id=page_id,
                old_data=old_data,
                new_data=page.data,
                timestamp=datetime.now().timestamp()
            )
            self._append_wal_record(record)
        
        self.dirty_pages.add(page_id)
    
    def _read_index_page(self, page_id: int) -> Dict[str, int]:
        page = self._read_page(page_id)
        try:
            return pickle.loads(page.data)
        except Exception:
            return {}
    
    def _write_index_page(self, page_id: int, index: Dict[str, int], record_wal: bool = True) -> None:
        page = self.pages[page_id]
        old_data = page.data
        page.data = pickle.dumps(index)
        page.free_space = self.PAGE_SIZE - 16 - len(page.data)
        
        if record_wal and self.in_transaction:
            record = WALRecord(
                lsn=self.next_lsn,
                page_id=page_id,
                old_data=old_data,
                new_data=page.data,
                timestamp=datetime.now().timestamp()
            )
            self._append_wal_record(record)
        
        self.dirty_pages.add(page_id)
    
    def _check_unique_constraints(self, table_def: TableDef, values: Dict[str, Any], 
                                   exclude_row_id: int = -1) -> None:
        for col_name, col_def in table_def.columns.items():
            if col_def.is_unique and col_name in values:
                value = values[col_name]
                
                idx_name = f"idx_{table_def.name}_{col_name}"
                if idx_name in table_def.index_pages:
                    index = self._read_index_page(table_def.index_pages[idx_name])
                    key_str = str(value)
                    if key_str in index and index[key_str] != exclude_row_id:
                        raise ConstraintError(f"Unique constraint violation on column '{col_name}': value '{value}' already exists")
                else:
                    rows = self._read_data_page(table_def.root_page_id)
                    for row in rows:
                        if not row.is_deleted and row.row_id != exclude_row_id:
                            if col_name in row.columns and row.columns[col_name] == value:
                                raise ConstraintError(f"Unique constraint violation on column '{col_name}': value '{value}' already exists")
    
    def _update_indexes_for_insert(self, table_def: TableDef, row: Row) -> None:
        for idx_name, idx_cols in table_def.indexes.items():
            if idx_name in table_def.index_pages:
                index = self._read_index_page(table_def.index_pages[idx_name])
                
                key_parts = []
                for col_name in idx_cols:
                    key_parts.append(str(row.columns.get(col_name, "")))
                key_str = "|".join(key_parts)
                
                index[key_str] = row.row_id
                self._write_index_page(table_def.index_pages[idx_name], index)
    
    def _update_indexes_for_update(self, table_def: TableDef, old_row: Row, new_row: Row) -> None:
        for idx_name, idx_cols in table_def.indexes.items():
            if idx_name in table_def.index_pages:
                index = self._read_index_page(table_def.index_pages[idx_name])
                
                old_key_parts = []
                for col_name in idx_cols:
                    old_key_parts.append(str(old_row.columns.get(col_name, "")))
                old_key_str = "|".join(old_key_parts)
                
                new_key_parts = []
                for col_name in idx_cols:
                    new_key_parts.append(str(new_row.columns.get(col_name, "")))
                new_key_str = "|".join(new_key_parts)
                
                if old_key_str != new_key_str:
                    if old_key_str in index:
                        del index[old_key_str]
                    index[new_key_str] = new_row.row_id
                    self._write_index_page(table_def.index_pages[idx_name], index)
    
    def _remove_from_indexes(self, table_def: TableDef, row: Row) -> None:
        for idx_name, idx_cols in table_def.indexes.items():
            if idx_name in table_def.index_pages:
                index = self._read_index_page(table_def.index_pages[idx_name])
                
                key_parts = []
                for col_name in idx_cols:
                    key_parts.append(str(row.columns.get(col_name, "")))
                key_str = "|".join(key_parts)
                
                if key_str in index:
                    del index[key_str]
                    self._write_index_page(table_def.index_pages[idx_name], index)
    
    def _find_row_by_id(self, table_def: TableDef, row_id: int) -> Optional[Tuple[int, Row]]:
        rows = self._read_data_page(table_def.root_page_id)
        for i, row in enumerate(rows):
            if row.row_id == row_id and not row.is_deleted:
                return (i, row)
        return None
    
    def _find_row_by_pk(self, table_def: TableDef, pk_value: Any) -> Optional[Tuple[int, Row]]:
        if not table_def.primary_key:
            return None
        
        pk_idx_name = f"idx_{table_def.name}_pk"
        if pk_idx_name in table_def.index_pages:
            index = self._read_index_page(table_def.index_pages[pk_idx_name])
            key_str = str(pk_value)
            if key_str in index:
                row_id = index[key_str]
                return self._find_row_by_id(table_def, row_id)
        
        rows = self._read_data_page(table_def.root_page_id)
        for i, row in enumerate(rows):
            if not row.is_deleted and row.columns.get(table_def.primary_key) == pk_value:
                return (i, row)
        return None
    
    def insert(self, table_name: str, values: Dict[str, Any]) -> int:
        if table_name not in self.tables:
            raise SDBError(f"Table '{table_name}' does not exist")
        
        table_def = self.tables[table_name]
        prepared = self._validate_and_prepare_row(table_def, values)
        
        pk_value = prepared.get(table_def.primary_key) if table_def.primary_key else None
        if pk_value is not None:
            existing = self._find_row_by_pk(table_def, pk_value)
            if existing is not None:
                raise ConstraintError(f"Duplicate primary key value: {pk_value}")
        
        self._check_unique_constraints(table_def, prepared)
        
        rows = self._read_data_page(table_def.root_page_id)
        
        row_id = table_def.next_row_id
        if table_def.primary_key and table_def.columns[table_def.primary_key].is_auto_increment:
            prepared[table_def.primary_key] = row_id
        
        new_row = Row(
            row_id=row_id,
            columns=prepared,
            is_deleted=False
        )
        
        rows.append(new_row)
        
        self._write_data_page(table_def.root_page_id, rows, record_wal=True)
        
        self._update_indexes_for_insert(table_def, new_row)
        
        table_def.next_row_id += 1
        self._save_tables_to_meta()
        
        if self.in_transaction:
            op_record = WALRecord(
                lsn=self.next_lsn,
                page_id=table_def.root_page_id,
                old_data=b"",
                new_data=b"",
                table_name=table_name,
                operation="INSERT",
                row_id=row_id,
                timestamp=datetime.now().timestamp()
            )
            self._append_wal_record(op_record)
        
        return row_id
    
    def update(self, table_name: str, row_id: int, values: Dict[str, Any]) -> bool:
        if table_name not in self.tables:
            raise SDBError(f"Table '{table_name}' does not exist")
        
        table_def = self.tables[table_name]
        result = self._find_row_by_id(table_def, row_id)
        
        if result is None:
            return False
        
        idx, old_row = result
        new_columns = dict(old_row.columns)
        
        for col_name, value in values.items():
            if col_name not in table_def.columns:
                raise SDBError(f"Column '{col_name}' does not exist")
            col_def = table_def.columns[col_name]
            
            if col_def.is_primary_key:
                raise SDBError(f"Cannot update primary key column '{col_name}'")
            
            new_columns[col_name] = self._validate_value(col_def, value)
        
        self._check_unique_constraints(table_def, new_columns, exclude_row_id=row_id)
        
        rows = self._read_data_page(table_def.root_page_id)
        new_row = Row(
            row_id=row_id,
            columns=new_columns,
            is_deleted=False
        )
        rows[idx] = new_row
        
        self._write_data_page(table_def.root_page_id, rows, record_wal=True)
        
        self._update_indexes_for_update(table_def, old_row, new_row)
        
        if self.in_transaction:
            op_record = WALRecord(
                lsn=self.next_lsn,
                page_id=table_def.root_page_id,
                old_data=b"",
                new_data=b"",
                table_name=table_name,
                operation="UPDATE",
                row_id=row_id,
                timestamp=datetime.now().timestamp()
            )
            self._append_wal_record(op_record)
        
        return True
    
    def delete(self, table_name: str, row_id: int) -> bool:
        if table_name not in self.tables:
            raise SDBError(f"Table '{table_name}' does not exist")
        
        table_def = self.tables[table_name]
        result = self._find_row_by_id(table_def, row_id)
        
        if result is None:
            return False
        
        idx, row = result
        
        self._remove_from_indexes(table_def, row)
        
        rows = self._read_data_page(table_def.root_page_id)
        rows[idx].is_deleted = True
        
        self._write_data_page(table_def.root_page_id, rows, record_wal=True)
        
        if self.in_transaction:
            op_record = WALRecord(
                lsn=self.next_lsn,
                page_id=table_def.root_page_id,
                old_data=b"",
                new_data=b"",
                table_name=table_name,
                operation="DELETE",
                row_id=row_id,
                timestamp=datetime.now().timestamp()
            )
            self._append_wal_record(op_record)
        
        return True
    
    def query(self, table_name: str, 
              filters: Optional[Dict[str, Any]] = None,
              columns: Optional[List[str]] = None,
              order_by: Optional[str] = None,
              limit: Optional[int] = None) -> List[Dict[str, Any]]:
        if table_name not in self.tables:
            raise SDBError(f"Table '{table_name}' does not exist")
        
        table_def = self.tables[table_name]
        all_rows = self._read_data_page(table_def.root_page_id)
        
        result = []
        for row in all_rows:
            if row.is_deleted:
                continue
            
            if filters:
                match = True
                for col_name, expected in filters.items():
                    if col_name not in row.columns:
                        match = False
                        break
                    if row.columns[col_name] != expected:
                        match = False
                        break
                if not match:
                    continue
            
            if columns:
                row_data = {}
                for col in columns:
                    if col in row.columns:
                        row_data[col] = row.columns[col]
                result.append(row_data)
            else:
                result.append(dict(row.columns))
        
        if order_by and order_by in table_def.columns:
            result.sort(key=lambda x: x.get(order_by))
        
        if limit and limit > 0:
            result = result[:limit]
        
        return result
    
    def begin_transaction(self) -> None:
        if self.in_transaction:
            raise TransactionError("Transaction already active")
        
        self.in_transaction = True
        self.wal_records = []
        
        print("Transaction started")
    
    def commit(self) -> None:
        if not self.in_transaction:
            raise TransactionError("No transaction active")
        
        commit_record = WALRecord(
            lsn=self.next_lsn,
            page_id=-1,
            old_data=b"",
            new_data=b"",
            is_commit=True,
            timestamp=datetime.now().timestamp()
        )
        self._append_wal_record(commit_record)
        
        self._flush_all_pages()
        
        if os.path.exists(self.wal_path):
            os.remove(self.wal_path)
        
        self.in_transaction = False
        self.wal_records = []
        
        print("Transaction committed")
    
    def rollback(self) -> None:
        if not self.in_transaction:
            raise TransactionError("No transaction active")
        
        for record in reversed(self.wal_records):
            if record.page_id >= 0 and record.old_data:
                if record.page_id in self.pages:
                    self.pages[record.page_id].data = record.old_data
        
        rollback_record = WALRecord(
            lsn=self.next_lsn,
            page_id=-1,
            old_data=b"",
            new_data=b"",
            is_rollback=True,
            timestamp=datetime.now().timestamp()
        )
        self._append_wal_record(rollback_record)
        
        if os.path.exists(self.wal_path):
            os.remove(self.wal_path)
        
        self.in_transaction = False
        self.wal_records = []
        
        print("Transaction rolled back")
    
    def get_table_def(self, table_name: str) -> Optional[TableDef]:
        return self.tables.get(table_name)
    
    def list_tables(self) -> List[str]:
        return list(self.tables.keys())
    
    def get_diagnostics(self) -> Dict[str, Any]:
        diag = {
            'db_path': self.db_path,
            'page_size': self.PAGE_SIZE,
            'num_pages': len(self.pages),
            'next_page_id': self.next_page_id,
            'in_transaction': self.in_transaction,
            'wal_exists': os.path.exists(self.wal_path),
            'tables': {}
        }
        
        for table_name, table_def in self.tables.items():
            rows = self.query(table_name)
            diag['tables'][table_name] = {
                'columns': {
                    k: {
                        'type': v.data_type.value,
                        'nullable': v.nullable,
                        'primary_key': v.is_primary_key,
                        'unique': v.is_unique
                    } for k, v in table_def.columns.items()
                },
                'row_count': len(rows),
                'indexes': list(table_def.indexes.keys()),
                'next_row_id': table_def.next_row_id,
                'root_page': table_def.root_page_id
            }
        
        return diag
    
    def export_table_to_csv(self, table_name: str, output_path: str) -> int:
        if table_name not in self.tables:
            raise SDBError(f"Table '{table_name}' does not exist")
        
        table_def = self.tables[table_name]
        rows = self.query(table_name)
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=table_def.columns.keys())
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        
        return len(rows)
    
    def import_table_from_csv(self, table_name: str, csv_path: str) -> int:
        if table_name not in self.tables:
            raise SDBError(f"Table '{table_name}' does not exist")
        
        table_def = self.tables[table_name]
        count = 0
        
        with open(csv_path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                values = {}
                for col_name, col_def in table_def.columns.items():
                    if col_name in row:
                        if row[col_name] == '' or row[col_name] is None:
                            if col_def.nullable:
                                values[col_name] = None
                        else:
                            values[col_name] = row[col_name]
                
                self.insert(table_name, values)
                count += 1
        
        return count
    
    def create_index(self, table_name: str, index_name: str, columns: List[str], 
                     unique: bool = False) -> None:
        if table_name not in self.tables:
            raise SDBError(f"Table '{table_name}' does not exist")
        
        table_def = self.tables[table_name]
        
        if index_name in table_def.indexes:
            raise SDBError(f"Index '{index_name}' already exists on table '{table_name}'")
        
        for col_name in columns:
            if col_name not in table_def.columns:
                raise SDBError(f"Column '{col_name}' does not exist in table '{table_name}'")
        
        table_def.indexes[index_name] = columns
        if unique:
            for col_name in columns:
                if len(columns) == 1:
                    table_def.columns[col_name].is_unique = True
        
        idx_page = Page(
            page_id=self.next_page_id,
            page_type=PageType.INDEX,
            data=pickle.dumps({}),
            free_space=self.PAGE_SIZE - 16
        )
        table_def.index_pages[index_name] = self.next_page_id
        self.pages[self.next_page_id] = idx_page
        self.next_page_id += 1
        
        existing_rows = self.query(table_name)
        index_data = {}
        
        for row_data in existing_rows:
            key_parts = []
            for col_name in columns:
                key_parts.append(str(row_data.get(col_name, "")))
            key_str = "|".join(key_parts)
            
            if unique:
                if key_str in index_data:
                    raise SDBError(f"Unique index '{index_name}' has duplicate value: {key_str}")
            
            result = self._find_row_by_pk(table_def, row_data.get(table_def.primary_key))
            if result:
                idx, row = result
                index_data[key_str] = row.row_id
        
        self._write_index_page(table_def.index_pages[index_name], index_data, record_wal=False)
        self._save_tables_to_meta()
        
        print(f"Index '{index_name}' created on table '{table_name}'")
