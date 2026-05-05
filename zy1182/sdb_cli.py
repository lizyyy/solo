#!/usr/bin/env python3
"""
SDB CLI - Command Line Interface for Simple Database
"""

import argparse
import sys
import os
import json
import re
from typing import Optional, Dict, Any, List

from sdb import (
    SDBCore, ColumnDef, DataType,
    SDBError, ConstraintError, TypeMismatchError, TransactionError
)


class SQLQueryParser:
    """Simple SQL-like query parser for SDB"""
    
    @staticmethod
    def parse_select(query: str) -> Optional[Dict[str, Any]]:
        """Parse SELECT statement: SELECT col1, col2 FROM table WHERE condition ORDER BY col LIMIT n"""
        query = query.strip()
        
        select_match = re.match(
            r'^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+))?(?:\s+LIMIT\s+(\d+))?$',
            query, re.IGNORECASE
        )
        
        if not select_match:
            return None
        
        columns_part = select_match.group(1).strip()
        table_name = select_match.group(2).strip()
        where_part = select_match.group(3)
        order_by = select_match.group(4)
        limit = select_match.group(5)
        
        if columns_part == '*':
            columns = None
        else:
            columns = [c.strip() for c in columns_part.split(',')]
        
        filters = {}
        if where_part:
            conditions = re.split(r'\s+AND\s+', where_part, flags=re.IGNORECASE)
            for cond in conditions:
                eq_match = re.match(r'(\w+)\s*=\s*(.+)', cond.strip())
                if eq_match:
                    col = eq_match.group(1).strip()
                    val = eq_match.group(2).strip()
                    
                    if val.startswith("'") and val.endswith("'"):
                        val = val[1:-1]
                    elif val.startswith('"') and val.endswith('"'):
                        val = val[1:-1]
                    elif val.isdigit():
                        val = int(val)
                    elif re.match(r'^\d+\.\d+$', val):
                        val = float(val)
                    
                    filters[col] = val
        
        limit_int = None
        if limit:
            limit_int = int(limit)
        
        return {
            'type': 'SELECT',
            'table': table_name,
            'columns': columns,
            'filters': filters if filters else None,
            'order_by': order_by,
            'limit': limit_int
        }
    
    @staticmethod
    def parse_insert(query: str) -> Optional[Dict[str, Any]]:
        """Parse INSERT statement: INSERT INTO table (col1, col2) VALUES (val1, val2)"""
        query = query.strip()
        
        insert_match = re.match(
            r'^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)$',
            query, re.IGNORECASE
        )
        
        if not insert_match:
            return None
        
        table_name = insert_match.group(1).strip()
        cols_part = insert_match.group(2).strip()
        vals_part = insert_match.group(3).strip()
        
        columns = [c.strip() for c in cols_part.split(',')]
        values_raw = [v.strip() for v in vals_part.split(',')]
        
        values = {}
        for i, (col, val) in enumerate(zip(columns, values_raw)):
            if val.startswith("'") and val.endswith("'"):
                values[col] = val[1:-1]
            elif val.startswith('"') and val.endswith('"'):
                values[col] = val[1:-1]
            elif val.upper() == 'NULL':
                values[col] = None
            elif val.isdigit():
                values[col] = int(val)
            elif re.match(r'^\d+\.\d+$', val):
                values[col] = float(val)
            else:
                values[col] = val
        
        return {
            'type': 'INSERT',
            'table': table_name,
            'values': values
        }
    
    @staticmethod
    def parse_update(query: str) -> Optional[Dict[str, Any]]:
        """Parse UPDATE statement: UPDATE table SET col1=val1, col2=val2 WHERE pk=value"""
        query = query.strip()
        
        update_match = re.match(
            r'^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$',
            query, re.IGNORECASE
        )
        
        if not update_match:
            return None
        
        table_name = update_match.group(1).strip()
        set_part = update_match.group(2).strip()
        where_part = update_match.group(3)
        
        set_values = {}
        set_items = re.split(r',\s*(?![^(]*\))', set_part)
        for item in set_items:
            eq_match = re.match(r'(\w+)\s*=\s*(.+)', item.strip())
            if eq_match:
                col = eq_match.group(1).strip()
                val = eq_match.group(2).strip()
                
                if val.startswith("'") and val.endswith("'"):
                    set_values[col] = val[1:-1]
                elif val.startswith('"') and val.endswith('"'):
                    set_values[col] = val[1:-1]
                elif val.upper() == 'NULL':
                    set_values[col] = None
                elif val.isdigit():
                    set_values[col] = int(val)
                elif re.match(r'^\d+\.\d+$', val):
                    set_values[col] = float(val)
                else:
                    set_values[col] = val
        
        row_id = None
        if where_part:
            eq_match = re.match(r'(\w+)\s*=\s*(.+)', where_part.strip())
            if eq_match:
                val = eq_match.group(2).strip()
                if val.isdigit():
                    row_id = int(val)
                elif val.startswith("'") and val.endswith("'"):
                    row_id = val[1:-1]
        
        return {
            'type': 'UPDATE',
            'table': table_name,
            'values': set_values,
            'row_id': row_id
        }
    
    @staticmethod
    def parse_delete(query: str) -> Optional[Dict[str, Any]]:
        """Parse DELETE statement: DELETE FROM table WHERE pk=value"""
        query = query.strip()
        
        delete_match = re.match(
            r'^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$',
            query, re.IGNORECASE
        )
        
        if not delete_match:
            return None
        
        table_name = delete_match.group(1).strip()
        where_part = delete_match.group(2)
        
        row_id = None
        if where_part:
            eq_match = re.match(r'(\w+)\s*=\s*(.+)', where_part.strip())
            if eq_match:
                val = eq_match.group(2).strip()
                if val.isdigit():
                    row_id = int(val)
                elif val.startswith("'") and val.endswith("'"):
                    row_id = val[1:-1]
        
        return {
            'type': 'DELETE',
            'table': table_name,
            'row_id': row_id
        }
    
    @staticmethod
    def parse(query: str) -> Optional[Dict[str, Any]]:
        """Parse a SQL-like query"""
        if not query or not query.strip():
            return None
        
        query_upper = query.strip().upper()
        
        if query_upper.startswith('SELECT'):
            return SQLQueryParser.parse_select(query)
        elif query_upper.startswith('INSERT'):
            return SQLQueryParser.parse_insert(query)
        elif query_upper.startswith('UPDATE'):
            return SQLQueryParser.parse_update(query)
        elif query_upper.startswith('DELETE'):
            return SQLQueryParser.parse_delete(query)
        
        return None


class SDBCLI:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.db: Optional[SDBCore] = None
        self.is_open = False
    
    def create(self) -> bool:
        try:
            self.db = SDBCore(self.db_path)
            self.db.create()
            self.is_open = True
            return True
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def open(self) -> bool:
        try:
            self.db = SDBCore(self.db_path)
            self.db.open()
            self.is_open = True
            return True
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def close(self) -> None:
        if self.db:
            self.db.close()
            self.is_open = False
    
    def _ensure_open(self) -> bool:
        if not self.is_open or not self.db:
            print("Error: Database not open")
            return False
        return True
    
    def create_table(self, table_name: str, columns_str: str) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            columns = []
            col_defs = [c.strip() for c in columns_str.split(',')]
            
            for col_def in col_defs:
                parts = col_def.split()
                if len(parts) < 2:
                    print(f"Invalid column definition: {col_def}")
                    return False
                
                col_name = parts[0]
                type_str = parts[1].upper()
                nullable = True
                is_pk = False
                is_unique = False
                is_auto = False
                default = None
                
                try:
                    data_type = DataType(type_str)
                except ValueError:
                    print(f"Invalid data type: {type_str}")
                    return False
                
                i = 2
                while i < len(parts):
                    modifier = parts[i].upper()
                    if modifier == 'NOT':
                        if i + 1 < len(parts) and parts[i + 1].upper() == 'NULL':
                            nullable = False
                            i += 1
                    elif modifier == 'NULL':
                        nullable = True
                    elif modifier == 'PRIMARY':
                        if i + 1 < len(parts) and parts[i + 1].upper() == 'KEY':
                            is_pk = True
                            nullable = False
                            i += 1
                    elif modifier == 'UNIQUE':
                        is_unique = True
                    elif modifier == 'AUTO_INCREMENT':
                        is_auto = True
                    elif modifier == 'DEFAULT':
                        if i + 1 < len(parts):
                            default = parts[i + 1]
                            i += 1
                    i += 1
                
                columns.append(ColumnDef(
                    name=col_name,
                    data_type=data_type,
                    nullable=nullable,
                    default=default,
                    is_primary_key=is_pk,
                    is_unique=is_unique,
                    is_auto_increment=is_auto
                ))
            
            primary_key = None
            for col in columns:
                if col.is_primary_key:
                    primary_key = col.name
                    break
            
            self.db.create_table(table_name, columns, primary_key)
            return True
            
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def insert(self, table_name: str, values_json: str) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            values = json.loads(values_json)
            row_id = self.db.insert(table_name, values)
            print(f"Inserted row with ID: {row_id}")
            return True
        except json.JSONDecodeError as e:
            print(f"Invalid JSON: {e}")
            return False
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def update(self, table_name: str, row_id: int, values_json: str) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            values = json.loads(values_json)
            success = self.db.update(table_name, row_id, values)
            if success:
                print(f"Updated row {row_id}")
            else:
                print(f"Row {row_id} not found")
            return success
        except json.JSONDecodeError as e:
            print(f"Invalid JSON: {e}")
            return False
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def delete(self, table_name: str, row_id: int) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            success = self.db.delete(table_name, row_id)
            if success:
                print(f"Deleted row {row_id}")
            else:
                print(f"Row {row_id} not found")
            return success
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def query(self, table_name: str, filters_json: str = None, 
              columns_str: str = None, order_by: str = None, 
              limit: int = None) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            filters = None
            if filters_json:
                filters = json.loads(filters_json)
            
            columns = None
            if columns_str:
                columns = [c.strip() for c in columns_str.split(',')]
            
            results = self.db.query(table_name, filters, columns, order_by, limit)
            
            if not results:
                print("No results")
                return True
            
            cols = list(results[0].keys())
            print("\t".join(cols))
            print("-" * 80)
            for row in results:
                print("\t".join(str(row.get(c, "")) for c in cols))
            
            print(f"\nTotal: {len(results)} rows")
            return True
            
        except json.JSONDecodeError as e:
            print(f"Invalid JSON: {e}")
            return False
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def execute_sql(self, query: str) -> bool:
        if not self._ensure_open():
            return False
        
        parsed = SQLQueryParser.parse(query)
        
        if not parsed:
            print(f"Could not parse query: {query}")
            return False
        
        try:
            if parsed['type'] == 'SELECT':
                results = self.db.query(
                    parsed['table'],
                    parsed.get('filters'),
                    parsed.get('columns'),
                    parsed.get('order_by'),
                    parsed.get('limit')
                )
                
                if not results:
                    print("No results")
                    return True
                
                cols = list(results[0].keys())
                print("\t".join(cols))
                print("-" * 80)
                for row in results:
                    print("\t".join(str(row.get(c, "")) for c in cols))
                print(f"\nTotal: {len(results)} rows")
                
            elif parsed['type'] == 'INSERT':
                row_id = self.db.insert(parsed['table'], parsed['values'])
                print(f"Inserted row with ID: {row_id}")
                
            elif parsed['type'] == 'UPDATE':
                if parsed['row_id'] is None:
                    print("UPDATE requires WHERE clause with primary key")
                    return False
                success = self.db.update(parsed['table'], parsed['row_id'], parsed['values'])
                if success:
                    print(f"Updated row {parsed['row_id']}")
                else:
                    print(f"Row {parsed['row_id']} not found")
                    
            elif parsed['type'] == 'DELETE':
                if parsed['row_id'] is None:
                    print("DELETE requires WHERE clause with primary key")
                    return False
                success = self.db.delete(parsed['table'], parsed['row_id'])
                if success:
                    print(f"Deleted row {parsed['row_id']}")
                else:
                    print(f"Row {parsed['row_id']} not found")
            
            return True
            
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def begin_transaction(self) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            self.db.begin_transaction()
            return True
        except TransactionError as e:
            print(f"Error: {e}")
            return False
    
    def commit(self) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            self.db.commit()
            return True
        except TransactionError as e:
            print(f"Error: {e}")
            return False
    
    def rollback(self) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            self.db.rollback()
            return True
        except TransactionError as e:
            print(f"Error: {e}")
            return False
    
    def list_tables(self) -> bool:
        if not self._ensure_open():
            return False
        
        tables = self.db.list_tables()
        if not tables:
            print("No tables")
            return True
        
        print("Tables:")
        for t in tables:
            table_def = self.db.get_table_def(t)
            col_count = len(table_def.columns) if table_def else 0
            idx_count = len(table_def.indexes) if table_def else 0
            print(f"  - {t}: {col_count} columns, {idx_count} indexes")
        
        return True
    
    def describe_table(self, table_name: str) -> bool:
        if not self._ensure_open():
            return False
        
        table_def = self.db.get_table_def(table_name)
        if not table_def:
            print(f"Table '{table_name}' not found")
            return False
        
        print(f"Table: {table_name}")
        print(f"Primary Key: {table_def.primary_key}")
        print(f"Next Row ID: {table_def.next_row_id}")
        print(f"Root Page: {table_def.root_page_id}")
        print("\nColumns:")
        for col_name, col_def in table_def.columns.items():
            attrs = []
            if col_def.is_primary_key:
                attrs.append("PK")
            if col_def.is_unique:
                attrs.append("UNIQUE")
            if not col_def.nullable:
                attrs.append("NOT NULL")
            if col_def.is_auto_increment:
                attrs.append("AUTO_INCREMENT")
            if col_def.default:
                attrs.append(f"DEFAULT={col_def.default}")
            
            attrs_str = f" ({', '.join(attrs)})" if attrs else ""
            print(f"  {col_name}: {col_def.data_type.value}{attrs_str}")
        
        if table_def.indexes:
            print("\nIndexes:")
            for idx_name, idx_cols in table_def.indexes.items():
                print(f"  {idx_name}: ({', '.join(idx_cols)})")
        
        return True
    
    def create_index(self, table_name: str, index_name: str, 
                     columns_str: str, unique: bool = False) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            columns = [c.strip() for c in columns_str.split(',')]
            self.db.create_index(table_name, index_name, columns, unique)
            return True
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def import_csv(self, table_name: str, csv_path: str) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            count = self.db.import_table_from_csv(table_name, csv_path)
            print(f"Imported {count} rows")
            return True
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def export_csv(self, table_name: str, output_path: str) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            count = self.db.export_table_to_csv(table_name, output_path)
            print(f"Exported {count} rows to {output_path}")
            return True
        except SDBError as e:
            print(f"Error: {e}")
            return False
    
    def diagnostics(self, output_path: str = None) -> bool:
        if not self._ensure_open():
            return False
        
        try:
            diag = self.db.get_diagnostics()
            
            if output_path:
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(diag, f, indent=2, ensure_ascii=False)
                print(f"Diagnostics written to {output_path}")
            else:
                print(json.dumps(diag, indent=2, ensure_ascii=False))
            
            return True
        except Exception as e:
            print(f"Error: {e}")
            return False


def main():
    parser = argparse.ArgumentParser(
        description='SDB - Simple Database CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create a new database
  python sdb_cli.py --db test.sdb create

  # Open an existing database and interact
  python sdb_cli.py --db test.sdb open

  # Create a table
  python sdb_cli.py --db test.sdb create-table users \
    "id INTEGER PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT UNIQUE, age INTEGER"

  # Insert data
  python sdb_cli.py --db test.sdb insert users '{"name": "Alice", "email": "alice@example.com", "age": 25}'

  # Query
  python sdb_cli.py --db test.sdb query users
  python sdb_cli.py --db test.sdb query users --filters '{"age": 25}'

  # Execute SQL-like query
  python sdb_cli.py --db test.sdb sql "SELECT * FROM users WHERE age > 20 ORDER BY name LIMIT 10"

  # Transaction
  python sdb_cli.py --db test.sdb begin
  python sdb_cli.py --db test.sdb insert users '{"name": "Bob", "email": "bob@example.com"}'
  python sdb_cli.py --db test.sdb commit

  # Import/Export CSV
  python sdb_cli.py --db test.sdb import-csv users data.csv
  python sdb_cli.py --db test.sdb export-csv users output.csv

  # Diagnostics
  python sdb_cli.py --db test.sdb diagnostics
        """
    )
    
    parser.add_argument('--db', required=True, help='Path to database file (.sdb)')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    subparsers.add_parser('create', help='Create a new database')
    subparsers.add_parser('open', help='Open an existing database')
    
    create_table_parser = subparsers.add_parser('create-table', help='Create a table')
    create_table_parser.add_argument('table_name', help='Table name')
    create_table_parser.add_argument('columns', help='Column definitions (comma-separated)')
    
    drop_table_parser = subparsers.add_parser('drop-table', help='Drop a table')
    drop_table_parser.add_argument('table_name', help='Table name')
    
    insert_parser = subparsers.add_parser('insert', help='Insert a row')
    insert_parser.add_argument('table_name', help='Table name')
    insert_parser.add_argument('values', help='JSON object of column values')
    
    update_parser = subparsers.add_parser('update', help='Update a row')
    update_parser.add_argument('table_name', help='Table name')
    update_parser.add_argument('row_id', type=int, help='Row ID (primary key)')
    update_parser.add_argument('values', help='JSON object of column values to update')
    
    delete_parser = subparsers.add_parser('delete', help='Delete a row')
    delete_parser.add_argument('table_name', help='Table name')
    delete_parser.add_argument('row_id', type=int, help='Row ID (primary key)')
    
    query_parser = subparsers.add_parser('query', help='Query rows')
    query_parser.add_argument('table_name', help='Table name')
    query_parser.add_argument('--filters', help='JSON object of filter conditions')
    query_parser.add_argument('--columns', help='Comma-separated column names to select')
    query_parser.add_argument('--order-by', help='Column to order by')
    query_parser.add_argument('--limit', type=int, help='Maximum number of rows')
    
    sql_parser = subparsers.add_parser('sql', help='Execute SQL-like query')
    sql_parser.add_argument('query', help='SQL-like query string')
    
    subparsers.add_parser('begin', help='Begin transaction')
    subparsers.add_parser('commit', help='Commit transaction')
    subparsers.add_parser('rollback', help='Rollback transaction')
    
    subparsers.add_parser('tables', help='List all tables')
    
    describe_parser = subparsers.add_parser('describe', help='Describe table structure')
    describe_parser.add_argument('table_name', help='Table name')
    
    index_parser = subparsers.add_parser('create-index', help='Create an index')
    index_parser.add_argument('table_name', help='Table name')
    index_parser.add_argument('index_name', help='Index name')
    index_parser.add_argument('columns', help='Comma-separated column names')
    index_parser.add_argument('--unique', action='store_true', help='Create unique index')
    
    import_parser = subparsers.add_parser('import-csv', help='Import data from CSV')
    import_parser.add_argument('table_name', help='Table name')
    import_parser.add_argument('csv_path', help='Path to CSV file')
    
    export_parser = subparsers.add_parser('export-csv', help='Export table to CSV')
    export_parser.add_argument('table_name', help='Table name')
    export_parser.add_argument('output_path', help='Output CSV path')
    
    diag_parser = subparsers.add_parser('diagnostics', help='Generate diagnostics report')
    diag_parser.add_argument('--output', help='Output file path (JSON)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    cli = SDBCLI(args.db)
    
    if args.command == 'create':
        if not cli.create():
            sys.exit(1)
        cli.close()
        
    elif args.command == 'open':
        if not cli.open():
            sys.exit(1)
        print(f"Database {args.db} opened. Type 'exit' to close.")
        print("Type 'help' for available commands in interactive mode.")
        
        try:
            while True:
                try:
                    line = input("sdb> ").strip()
                except EOFError:
                    break
                
                if not line:
                    continue
                if line.lower() in ('exit', 'quit', 'q'):
                    break
                elif line.lower() == 'help':
                    print("Interactive commands:")
                    print("  tables              - List all tables")
                    print("  describe <table>    - Describe table structure")
                    print("  SELECT/INSERT/UPDATE/DELETE ... - Execute SQL-like query")
                    print("  begin               - Begin transaction")
                    print("  commit              - Commit transaction")
                    print("  rollback            - Rollback transaction")
                    print("  diagnostics         - Show diagnostics")
                    print("  exit/quit/q         - Exit")
                    continue
                elif line.lower() == 'tables':
                    cli.list_tables()
                    continue
                elif line.lower().startswith('describe '):
                    parts = line.split()
                    if len(parts) >= 2:
                        cli.describe_table(parts[1])
                    continue
                elif line.lower().startswith('begin'):
                    cli.begin_transaction()
                    continue
                elif line.lower().startswith('commit'):
                    cli.commit()
                    continue
                elif line.lower().startswith('rollback'):
                    cli.rollback()
                    continue
                elif line.lower().startswith('diagnostics'):
                    cli.diagnostics()
                    continue
                
                cli.execute_sql(line)
                
        finally:
            cli.close()
            
    else:
        if not cli.open():
            sys.exit(1)
        
        try:
            if args.command == 'create-table':
                success = cli.create_table(args.table_name, args.columns)
            elif args.command == 'drop-table':
                success = cli.db.drop_table(args.table_name) if cli.db else False
            elif args.command == 'insert':
                success = cli.insert(args.table_name, args.values)
            elif args.command == 'update':
                success = cli.update(args.table_name, args.row_id, args.values)
            elif args.command == 'delete':
                success = cli.delete(args.table_name, args.row_id)
            elif args.command == 'query':
                success = cli.query(
                    args.table_name,
                    args.filters,
                    args.columns,
                    args.order_by,
                    args.limit
                )
            elif args.command == 'sql':
                success = cli.execute_sql(args.query)
            elif args.command == 'begin':
                success = cli.begin_transaction()
            elif args.command == 'commit':
                success = cli.commit()
            elif args.command == 'rollback':
                success = cli.rollback()
            elif args.command == 'tables':
                success = cli.list_tables()
            elif args.command == 'describe':
                success = cli.describe_table(args.table_name)
            elif args.command == 'create-index':
                success = cli.create_index(
                    args.table_name,
                    args.index_name,
                    args.columns,
                    args.unique
                )
            elif args.command == 'import-csv':
                success = cli.import_csv(args.table_name, args.csv_path)
            elif args.command == 'export-csv':
                success = cli.export_csv(args.table_name, args.output_path)
            elif args.command == 'diagnostics':
                success = cli.diagnostics(args.output)
            else:
                print(f"Unknown command: {args.command}")
                success = False
                
            if not success:
                sys.exit(1)
                
        finally:
            cli.close()


if __name__ == '__main__':
    main()
