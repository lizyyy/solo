#!/usr/bin/env python3
"""
SDB - Test Suite
Covers basic CRUD, constraints, transactions, indexes, CSV, and recovery.
"""

import os
import sys
import tempfile
import unittest
import csv
import json

from sdb import (
    SDBCore, ColumnDef, DataType,
    SDBError, ConstraintError, TypeMismatchError, TransactionError
)


def cleanup_db(db_path: str):
    """Remove test database files"""
    for ext in ['', '.wal', '.checkpoint']:
        path = db_path + ext
        if os.path.exists(path):
            os.remove(path)


class TestSDBCore(unittest.TestCase):
    """Test core database functionality"""
    
    def setUp(self):
        """Set up test database"""
        self.test_db = "test_core.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
    
    def tearDown(self):
        """Clean up test database"""
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_create_and_open_database(self):
        """Test creating and opening a database"""
        self.db.close()
        
        db2 = SDBCore(self.test_db)
        db2.open()
        self.assertEqual(len(db2.list_tables()), 0)
        db2.close()
    
    def test_create_table(self):
        """Test creating a table"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT, nullable=False),
                ColumnDef("email", DataType.TEXT, is_unique=True),
                ColumnDef("age", DataType.INTEGER)
            ]
        )
        
        tables = self.db.list_tables()
        self.assertIn("users", tables)
        
        table_def = self.db.get_table_def("users")
        self.assertEqual(table_def.primary_key, "id")
        self.assertEqual(len(table_def.columns), 4)
        self.assertFalse(table_def.columns["name"].nullable)
        self.assertTrue(table_def.columns["email"].is_unique)
    
    def test_insert_and_query(self):
        """Test inserting and querying data"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT),
                ColumnDef("age", DataType.INTEGER)
            ]
        )
        
        row_id = self.db.insert("users", {"id": 1, "name": "Alice", "age": 25})
        self.assertEqual(row_id, 1)
        
        row_id2 = self.db.insert("users", {"id": 2, "name": "Bob", "age": 30})
        self.assertEqual(row_id2, 2)
        
        results = self.db.query("users")
        self.assertEqual(len(results), 2)
        
        results = self.db.query("users", filters={"age": 25})
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Alice")
    
    def test_update(self):
        """Test updating data"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT),
                ColumnDef("age", DataType.INTEGER)
            ]
        )
        
        row_id = self.db.insert("users", {"id": 1, "name": "Alice", "age": 25})
        
        success = self.db.update("users", row_id, {"age": 26})
        self.assertTrue(success)
        
        results = self.db.query("users", filters={"id": 1})
        self.assertEqual(results[0]["age"], 26)
    
    def test_delete(self):
        """Test deleting data"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        row_id = self.db.insert("users", {"id": 1, "name": "Alice"})
        self.db.insert("users", {"id": 2, "name": "Bob"})
        
        success = self.db.delete("users", row_id)
        self.assertTrue(success)
        
        results = self.db.query("users")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Bob")
    
    def test_update_nonexistent_row(self):
        """Test updating non-existent row returns False"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        success = self.db.update("users", 999, {"name": "Test"})
        self.assertFalse(success)
    
    def test_delete_nonexistent_row(self):
        """Test deleting non-existent row returns False"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        success = self.db.delete("users", 999)
        self.assertFalse(success)


class TestConstraints(unittest.TestCase):
    """Test constraint enforcement"""
    
    def setUp(self):
        self.test_db = "test_constraints.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_duplicate_primary_key(self):
        """Test duplicate primary key raises ConstraintError"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        self.db.insert("users", {"id": 1, "name": "Alice"})
        
        with self.assertRaises(ConstraintError):
            self.db.insert("users", {"id": 1, "name": "Bob"})
    
    def test_unique_constraint(self):
        """Test unique constraint raises ConstraintError"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("email", DataType.TEXT, is_unique=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        self.db.create_index("users", "idx_email", ["email"], unique=True)
        
        self.db.insert("users", {"id": 1, "email": "alice@example.com", "name": "Alice"})
        
        with self.assertRaises(ConstraintError):
            self.db.insert("users", {"id": 2, "email": "alice@example.com", "name": "Bob"})
    
    def test_not_null_constraint(self):
        """Test NOT NULL constraint raises ConstraintError"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT, nullable=False)
            ]
        )
        
        with self.assertRaises(ConstraintError):
            self.db.insert("users", {"id": 1})
    
    def test_type_mismatch(self):
        """Test type mismatch raises TypeMismatchError"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("age", DataType.INTEGER)
            ]
        )
        
        with self.assertRaises(TypeMismatchError):
            self.db.insert("users", {"id": 1, "age": "not a number"})
    
    def test_invalid_column(self):
        """Test inserting with invalid column raises SDBError"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        with self.assertRaises(SDBError):
            self.db.insert("users", {"id": 1, "name": "Alice", "nonexistent": "value"})


class TestTransactions(unittest.TestCase):
    """Test transaction functionality"""
    
    def setUp(self):
        self.test_db = "test_transactions.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
        
        self.db.create_table(
            "accounts",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT),
                ColumnDef("balance", DataType.REAL)
            ]
        )
        
        self.db.insert("accounts", {"id": 1, "name": "Alice", "balance": 1000.0})
        self.db.insert("accounts", {"id": 2, "name": "Bob", "balance": 500.0})
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_transaction_commit(self):
        """Test transaction commit persists changes"""
        self.db.begin_transaction()
        
        self.db.update("accounts", 1, {"balance": 900.0})
        self.db.update("accounts", 2, {"balance": 600.0})
        
        alice = self.db.query("accounts", filters={"id": 1})[0]
        bob = self.db.query("accounts", filters={"id": 2})[0]
        self.assertEqual(alice["balance"], 900.0)
        self.assertEqual(bob["balance"], 600.0)
        
        self.db.commit()
        
        alice = self.db.query("accounts", filters={"id": 1})[0]
        bob = self.db.query("accounts", filters={"id": 2})[0]
        self.assertEqual(alice["balance"], 900.0)
        self.assertEqual(bob["balance"], 600.0)
    
    def test_transaction_rollback(self):
        """Test transaction rollback reverts changes"""
        self.db.begin_transaction()
        
        self.db.update("accounts", 1, {"balance": 900.0})
        self.db.update("accounts", 2, {"balance": 600.0})
        
        self.db.rollback()
        
        alice = self.db.query("accounts", filters={"id": 1})[0]
        bob = self.db.query("accounts", filters={"id": 2})[0]
        self.assertEqual(alice["balance"], 1000.0)
        self.assertEqual(bob["balance"], 500.0)
    
    def test_nested_transaction_error(self):
        """Test starting nested transaction raises TransactionError"""
        self.db.begin_transaction()
        
        with self.assertRaises(TransactionError):
            self.db.begin_transaction()
        
        self.db.rollback()
    
    def test_commit_without_transaction(self):
        """Test commit without active transaction raises TransactionError"""
        with self.assertRaises(TransactionError):
            self.db.commit()
    
    def test_rollback_without_transaction(self):
        """Test rollback without active transaction raises TransactionError"""
        with self.assertRaises(TransactionError):
            self.db.rollback()


class TestIndexes(unittest.TestCase):
    """Test index functionality"""
    
    def setUp(self):
        self.test_db = "test_indexes.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
        
        self.db.create_table(
            "products",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("sku", DataType.TEXT, is_unique=True),
                ColumnDef("name", DataType.TEXT),
                ColumnDef("category", DataType.TEXT)
            ]
        )
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_create_index(self):
        """Test creating an index"""
        self.db.create_index("products", "idx_category", ["category"])
        
        table_def = self.db.get_table_def("products")
        self.assertIn("idx_category", table_def.indexes)
    
    def test_unique_index_duplicate(self):
        """Test unique index prevents duplicates"""
        self.db.create_index("products", "idx_sku", ["sku"], unique=True)
        
        self.db.insert("products", {
            "id": 1, "sku": "SKU001", "name": "Laptop", "category": "Electronics"
        })
        
        with self.assertRaises(ConstraintError):
            self.db.insert("products", {
                "id": 2, "sku": "SKU001", "name": "Another Laptop", "category": "Electronics"
            })
    
    def test_primary_key_index(self):
        """Test primary key is automatically indexed"""
        self.db.insert("products", {
            "id": 1, "sku": "SKU001", "name": "Laptop", "category": "Electronics"
        })
        self.db.insert("products", {
            "id": 2, "sku": "SKU002", "name": "Mouse", "category": "Electronics"
        })
        
        results = self.db.query("products", filters={"id": 1})
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Laptop")


class TestCSVImportExport(unittest.TestCase):
    """Test CSV import and export"""
    
    def setUp(self):
        self.test_db = "test_csv.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
        
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT),
                ColumnDef("email", DataType.TEXT),
                ColumnDef("age", DataType.INTEGER)
            ]
        )
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
        
        if os.path.exists("test_export.csv"):
            os.remove("test_export.csv")
    
    def test_export_csv(self):
        """Test exporting table to CSV"""
        self.db.insert("users", {"id": 1, "name": "Alice", "email": "alice@example.com", "age": 25})
        self.db.insert("users", {"id": 2, "name": "Bob", "email": "bob@example.com", "age": 30})
        
        count = self.db.export_table_to_csv("users", "test_export.csv")
        self.assertEqual(count, 2)
        
        self.assertTrue(os.path.exists("test_export.csv"))
        
        with open("test_export.csv", 'r', newline='') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0]["name"], "Alice")
            self.assertEqual(rows[1]["name"], "Bob")


class TestDiagnostics(unittest.TestCase):
    """Test diagnostics functionality"""
    
    def setUp(self):
        self.test_db = "test_diag.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_diagnostics_empty_db(self):
        """Test diagnostics on empty database"""
        diag = self.db.get_diagnostics()
        
        self.assertEqual(diag["db_path"], self.test_db)
        self.assertEqual(diag["num_pages"], 2)
        self.assertEqual(len(diag["tables"]), 0)
    
    def test_diagnostics_with_table(self):
        """Test diagnostics with tables and data"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        self.db.insert("users", {"id": 1, "name": "Alice"})
        self.db.insert("users", {"id": 2, "name": "Bob"})
        
        diag = self.db.get_diagnostics()
        
        self.assertIn("users", diag["tables"])
        users_diag = diag["tables"]["users"]
        self.assertEqual(users_diag["row_count"], 2)
        self.assertIn("id", users_diag["columns"])
        self.assertTrue(users_diag["columns"]["id"]["primary_key"])


class TestAutoIncrement(unittest.TestCase):
    """Test auto-increment functionality"""
    
    def setUp(self):
        self.test_db = "test_autoinc.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_auto_increment_primary_key(self):
        """Test auto-increment primary key"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True, is_auto_increment=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        row_id1 = self.db.insert("users", {"name": "Alice"})
        self.assertEqual(row_id1, 1)
        
        row_id2 = self.db.insert("users", {"name": "Bob"})
        self.assertEqual(row_id2, 2)
        
        results = self.db.query("users")
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["id"], 1)
        self.assertEqual(results[1]["id"], 2)


class TestQueryFeatures(unittest.TestCase):
    """Test query features"""
    
    def setUp(self):
        self.test_db = "test_query.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
        
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT),
                ColumnDef("age", DataType.INTEGER),
                ColumnDef("email", DataType.TEXT)
            ]
        )
        
        self.db.insert("users", {"id": 1, "name": "Charlie", "age": 35, "email": "charlie@example.com"})
        self.db.insert("users", {"id": 2, "name": "Alice", "age": 25, "email": "alice@example.com"})
        self.db.insert("users", {"id": 3, "name": "Bob", "age": 30, "email": "bob@example.com"})
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_query_with_columns(self):
        """Test query with specific columns"""
        results = self.db.query("users", columns=["name", "email"])
        
        self.assertEqual(len(results), 3)
        for row in results:
            self.assertIn("name", row)
            self.assertIn("email", row)
            self.assertNotIn("age", row)
            self.assertNotIn("id", row)
    
    def test_query_with_order_by(self):
        """Test query with order by"""
        results = self.db.query("users", order_by="name")
        
        self.assertEqual(len(results), 3)
        self.assertEqual(results[0]["name"], "Alice")
        self.assertEqual(results[1]["name"], "Bob")
        self.assertEqual(results[2]["name"], "Charlie")
    
    def test_query_with_limit(self):
        """Test query with limit"""
        results = self.db.query("users", limit=2)
        
        self.assertEqual(len(results), 2)
    
    def test_query_with_filters(self):
        """Test query with filters"""
        results = self.db.query("users", filters={"age": 25})
        
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Alice")


class TestPersistence(unittest.TestCase):
    """Test data persistence"""
    
    def setUp(self):
        self.test_db = "test_persistence.sdb"
        cleanup_db(self.test_db)
    
    def tearDown(self):
        cleanup_db(self.test_db)
    
    def test_data_persists_after_close(self):
        """Test data persists after closing and reopening"""
        db1 = SDBCore(self.test_db)
        db1.create()
        
        db1.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        db1.insert("users", {"id": 1, "name": "Alice"})
        db1.insert("users", {"id": 2, "name": "Bob"})
        
        db1.close()
        
        db2 = SDBCore(self.test_db)
        db2.open()
        
        tables = db2.list_tables()
        self.assertIn("users", tables)
        
        results = db2.query("users")
        self.assertEqual(len(results), 2)
        
        db2.close()


class TestTableOperations(unittest.TestCase):
    """Test table operations"""
    
    def setUp(self):
        self.test_db = "test_tables.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_create_duplicate_table(self):
        """Test creating duplicate table raises SDBError"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        with self.assertRaises(SDBError):
            self.db.create_table(
                "users",
                [
                    ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                    ColumnDef("other", DataType.TEXT)
                ]
            )
    
    def test_drop_table(self):
        """Test dropping a table"""
        self.db.create_table(
            "users",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT)
            ]
        )
        
        self.assertIn("users", self.db.list_tables())
        
        self.db.drop_table("users")
        
        self.assertNotIn("users", self.db.list_tables())
    
    def test_drop_nonexistent_table(self):
        """Test dropping non-existent table raises SDBError"""
        with self.assertRaises(SDBError):
            self.db.drop_table("nonexistent")
    
    def test_get_nonexistent_table(self):
        """Test getting non-existent table returns None"""
        table_def = self.db.get_table_def("nonexistent")
        self.assertIsNone(table_def)


class TestDataTypes(unittest.TestCase):
    """Test data type handling"""
    
    def setUp(self):
        self.test_db = "test_datatypes.sdb"
        cleanup_db(self.test_db)
        self.db = SDBCore(self.test_db)
        self.db.create()
        
        self.db.create_table(
            "test_table",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("int_col", DataType.INTEGER),
                ColumnDef("real_col", DataType.REAL),
                ColumnDef("text_col", DataType.TEXT),
                ColumnDef("bool_col", DataType.BOOLEAN),
                ColumnDef("datetime_col", DataType.DATETIME)
            ]
        )
    
    def tearDown(self):
        self.db.close()
        cleanup_db(self.test_db)
    
    def test_integer_type(self):
        """Test INTEGER type"""
        row_id = self.db.insert("test_table", {"id": 1, "int_col": 42})
        results = self.db.query("test_table", filters={"id": 1})
        self.assertEqual(results[0]["int_col"], 42)
    
    def test_real_type(self):
        """Test REAL type"""
        row_id = self.db.insert("test_table", {"id": 1, "real_col": 3.14159})
        results = self.db.query("test_table", filters={"id": 1})
        self.assertAlmostEqual(results[0]["real_col"], 3.14159)
    
    def test_text_type(self):
        """Test TEXT type"""
        row_id = self.db.insert("test_table", {"id": 1, "text_col": "Hello World"})
        results = self.db.query("test_table", filters={"id": 1})
        self.assertEqual(results[0]["text_col"], "Hello World")
    
    def test_boolean_type(self):
        """Test BOOLEAN type"""
        self.db.insert("test_table", {"id": 1, "bool_col": True})
        self.db.insert("test_table", {"id": 2, "bool_col": False})
        
        results1 = self.db.query("test_table", filters={"id": 1})
        results2 = self.db.query("test_table", filters={"id": 2})
        
        self.assertTrue(results1[0]["bool_col"])
        self.assertFalse(results2[0]["bool_col"])
    
    def test_datetime_type(self):
        """Test DATETIME type"""
        test_datetime = "2024-01-15T10:30:00"
        row_id = self.db.insert("test_table", {"id": 1, "datetime_col": test_datetime})
        results = self.db.query("test_table", filters={"id": 1})
        self.assertEqual(results[0]["datetime_col"], test_datetime)


if __name__ == "__main__":
    unittest.main(verbosity=2)
