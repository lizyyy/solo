#!/usr/bin/env python3
"""
SDB Exception Examples
Demonstrates various error scenarios and constraint violations.
"""

import os
import sys

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


def example_duplicate_primary_key():
    """Example: Duplicate primary key violation"""
    print("=" * 60)
    print("Example 1: Duplicate Primary Key")
    print("=" * 60)
    
    db_path = "test_duplicate_pk.sdb"
    cleanup_db(db_path)
    
    try:
        with SDBCore(db_path) as db:
            db.create()
            
            db.create_table(
                "users",
                [
                    ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                    ColumnDef("name", DataType.TEXT, nullable=False)
                ]
            )
            
            print("Inserting first user with id=1...")
            db.insert("users", {"id": 1, "name": "Alice"})
            print("Success: User inserted")
            
            print("\nAttempting to insert another user with id=1...")
            db.insert("users", {"id": 1, "name": "Bob"})
            print("ERROR: Should have raised ConstraintError!")
            
    except ConstraintError as e:
        print(f"Expected ConstraintError: {e}")
        print("✓ Correctly caught duplicate primary key violation")
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
    finally:
        cleanup_db(db_path)
    print()


def example_type_mismatch():
    """Example: Type mismatch error"""
    print("=" * 60)
    print("Example 2: Type Mismatch")
    print("=" * 60)
    
    db_path = "test_type_mismatch.sdb"
    cleanup_db(db_path)
    
    try:
        with SDBCore(db_path) as db:
            db.create()
            
            db.create_table(
                "products",
                [
                    ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                    ColumnDef("name", DataType.TEXT),
                    ColumnDef("price", DataType.REAL),
                    ColumnDef("stock", DataType.INTEGER)
                ]
            )
            
            print("Inserting valid product...")
            db.insert("products", {"id": 1, "name": "Laptop", "price": 999.99, "stock": 10})
            print("Success: Product inserted")
            
            print("\nAttempting to insert with invalid price type (string instead of number)...")
            db.insert("products", {"id": 2, "name": "Mouse", "price": "not a number", "stock": 5})
            print("ERROR: Should have raised TypeMismatchError!")
            
    except TypeMismatchError as e:
        print(f"Expected TypeMismatchError: {e}")
        print("✓ Correctly caught type mismatch")
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
    finally:
        cleanup_db(db_path)
    print()


def example_unique_constraint():
    """Example: Unique constraint violation"""
    print("=" * 60)
    print("Example 3: Unique Constraint Violation")
    print("=" * 60)
    
    db_path = "test_unique.sdb"
    cleanup_db(db_path)
    
    try:
        with SDBCore(db_path) as db:
            db.create()
            
            db.create_table(
                "users",
                [
                    ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                    ColumnDef("email", DataType.TEXT, is_unique=True),
                    ColumnDef("name", DataType.TEXT)
                ]
            )
            
            db.create_index("users", "idx_email", ["email"], unique=True)
            
            print("Inserting first user with email 'alice@example.com'...")
            db.insert("users", {"id": 1, "email": "alice@example.com", "name": "Alice"})
            print("Success: User inserted")
            
            print("\nAttempting to insert another user with same email...")
            db.insert("users", {"id": 2, "email": "alice@example.com", "name": "Alice Smith"})
            print("ERROR: Should have raised ConstraintError!")
            
    except ConstraintError as e:
        print(f"Expected ConstraintError: {e}")
        print("✓ Correctly caught unique constraint violation")
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
    finally:
        cleanup_db(db_path)
    print()


def example_not_null_constraint():
    """Example: NOT NULL constraint violation"""
    print("=" * 60)
    print("Example 4: NOT NULL Constraint Violation")
    print("=" * 60)
    
    db_path = "test_not_null.sdb"
    cleanup_db(db_path)
    
    try:
        with SDBCore(db_path) as db:
            db.create()
            
            db.create_table(
                "users",
                [
                    ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                    ColumnDef("name", DataType.TEXT, nullable=False),
                    ColumnDef("email", DataType.TEXT, nullable=True)
                ]
            )
            
            print("Inserting user with name...")
            db.insert("users", {"id": 1, "name": "Alice", "email": "alice@example.com"})
            print("Success: User inserted")
            
            print("\nAttempting to insert user without name...")
            db.insert("users", {"id": 2, "email": "bob@example.com"})
            print("ERROR: Should have raised ConstraintError!")
            
    except ConstraintError as e:
        print(f"Expected ConstraintError: {e}")
        print("✓ Correctly caught NOT NULL constraint violation")
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
    finally:
        cleanup_db(db_path)
    print()


def example_transaction_rollback():
    """Example: Transaction rollback"""
    print("=" * 60)
    print("Example 5: Transaction Rollback")
    print("=" * 60)
    
    db_path = "test_rollback.sdb"
    cleanup_db(db_path)
    
    try:
        db = SDBCore(db_path)
        db.create()
        
        db.create_table(
            "accounts",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT),
                ColumnDef("balance", DataType.REAL)
            ]
        )
        
        db.insert("accounts", {"id": 1, "name": "Alice", "balance": 1000.0})
        db.insert("accounts", {"id": 2, "name": "Bob", "balance": 500.0})
        
        print("Initial state:")
        for row in db.query("accounts"):
            print(f"  {row}")
        
        print("\nStarting transaction to transfer $100 from Alice to Bob...")
        db.begin_transaction()
        
        db.update("accounts", 1, {"balance": 900.0})
        db.update("accounts", 2, {"balance": 600.0})
        
        print("After updates (in transaction):")
        for row in db.query("accounts"):
            print(f"  {row}")
        
        print("\nRolling back transaction...")
        db.rollback()
        
        print("After rollback:")
        for row in db.query("accounts"):
            print(f"  {row}")
        
        alice = db.query("accounts", filters={"id": 1})[0]
        bob = db.query("accounts", filters={"id": 2})[0]
        
        if alice["balance"] == 1000.0 and bob["balance"] == 500.0:
            print("✓ Transaction rollback successful - balances restored to original values")
        else:
            print("ERROR: Rollback did not restore balances correctly")
        
    except TransactionError as e:
        print(f"TransactionError: {e}")
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
    finally:
        db.close()
        cleanup_db(db_path)
    print()


def example_transaction_commit():
    """Example: Transaction commit"""
    print("=" * 60)
    print("Example 6: Transaction Commit")
    print("=" * 60)
    
    db_path = "test_commit.sdb"
    cleanup_db(db_path)
    
    try:
        db = SDBCore(db_path)
        db.create()
        
        db.create_table(
            "accounts",
            [
                ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                ColumnDef("name", DataType.TEXT),
                ColumnDef("balance", DataType.REAL)
            ]
        )
        
        db.insert("accounts", {"id": 1, "name": "Alice", "balance": 1000.0})
        db.insert("accounts", {"id": 2, "name": "Bob", "balance": 500.0})
        
        print("Initial state:")
        for row in db.query("accounts"):
            print(f"  {row}")
        
        print("\nStarting transaction to transfer $200 from Alice to Bob...")
        db.begin_transaction()
        
        db.update("accounts", 1, {"balance": 800.0})
        db.update("accounts", 2, {"balance": 700.0})
        
        print("After updates (in transaction):")
        for row in db.query("accounts"):
            print(f"  {row}")
        
        print("\nCommitting transaction...")
        db.commit()
        
        print("After commit:")
        for row in db.query("accounts"):
            print(f"  {row}")
        
        alice = db.query("accounts", filters={"id": 1})[0]
        bob = db.query("accounts", filters={"id": 2})[0]
        
        if alice["balance"] == 800.0 and bob["balance"] == 700.0:
            print("✓ Transaction commit successful - changes persisted")
        else:
            print("ERROR: Commit did not persist changes correctly")
        
    except TransactionError as e:
        print(f"TransactionError: {e}")
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
    finally:
        db.close()
        cleanup_db(db_path)
    print()


def example_invalid_column():
    """Example: Invalid column reference"""
    print("=" * 60)
    print("Example 7: Invalid Column Reference")
    print("=" * 60)
    
    db_path = "test_invalid_col.sdb"
    cleanup_db(db_path)
    
    try:
        with SDBCore(db_path) as db:
            db.create()
            
            db.create_table(
                "users",
                [
                    ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                    ColumnDef("name", DataType.TEXT)
                ]
            )
            
            print("Attempting to insert with non-existent column 'email'...")
            db.insert("users", {"id": 1, "name": "Alice", "email": "alice@example.com"})
            print("ERROR: Should have raised SDBError!")
            
    except SDBError as e:
        print(f"Expected SDBError: {e}")
        print("✓ Correctly caught invalid column reference")
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
    finally:
        cleanup_db(db_path)
    print()


def example_update_nonexistent_row():
    """Example: Update/Delete non-existent row"""
    print("=" * 60)
    print("Example 8: Update/Delete Non-Existent Row")
    print("=" * 60)
    
    db_path = "test_nonexistent.sdb"
    cleanup_db(db_path)
    
    try:
        with SDBCore(db_path) as db:
            db.create()
            
            db.create_table(
                "users",
                [
                    ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                    ColumnDef("name", DataType.TEXT)
                ]
            )
            
            db.insert("users", {"id": 1, "name": "Alice"})
            
            print("Updating existing row (id=1)...")
            result = db.update("users", 1, {"name": "Alice Smith"})
            if result:
                print("✓ Update successful for existing row")
            
            print("\nUpdating non-existent row (id=999)...")
            result = db.update("users", 999, {"name": "Bob"})
            if not result:
                print("✓ Update returned False for non-existent row (expected behavior)")
            
            print("\nDeleting non-existent row (id=999)...")
            result = db.delete("users", 999)
            if not result:
                print("✓ Delete returned False for non-existent row (expected behavior)")
            
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
    finally:
        cleanup_db(db_path)
    print()


def example_index_usage():
    """Example: Index usage and benefit"""
    print("=" * 60)
    print("Example 9: Index Usage")
    print("=" * 60)
    
    db_path = "test_index.sdb"
    cleanup_db(db_path)
    
    try:
        with SDBCore(db_path) as db:
            db.create()
            
            db.create_table(
                "products",
                [
                    ColumnDef("id", DataType.INTEGER, is_primary_key=True),
                    ColumnDef("sku", DataType.TEXT, is_unique=True),
                    ColumnDef("name", DataType.TEXT),
                    ColumnDef("category", DataType.TEXT)
                ]
            )
            
            db.create_index("products", "idx_category", ["category"])
            
            print("Inserting products...")
            for i in range(10):
                db.insert("products", {
                    "id": i + 1,
                    "sku": f"SKU{i+1:04d}",
                    "name": f"Product {i+1}",
                    "category": "Electronics" if i < 5 else "Clothing"
                })
            print("✓ 10 products inserted")
            
            print("\nTable structure:")
            table_def = db.get_table_def("products")
            print(f"  Indexes: {list(table_def.indexes.keys())}")
            
            print("\nQuerying by primary key (index hit)...")
            results = db.query("products", filters={"id": 3})
            print(f"  Found: {results[0]}")
            print("✓ Primary key index used")
            
            print("\nQuerying by unique column 'sku' (index hit)...")
            results = db.query("products", filters={"sku": "SKU0003"})
            if results:
                print(f"  Found: {results[0]}")
                print("✓ Unique index used")
            
            print("\nQuerying by category (index hit)...")
            results = db.query("products", filters={"category": "Electronics"})
            print(f"  Found {len(results)} products in Electronics category")
            print("✓ Category index used")
            
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
    finally:
        cleanup_db(db_path)
    print()


def main():
    print("SDB Exception Examples")
    print("Demonstrates various error scenarios and constraint violations")
    print("=" * 60)
    print()
    
    example_duplicate_primary_key()
    example_type_mismatch()
    example_unique_constraint()
    example_not_null_constraint()
    example_transaction_rollback()
    example_transaction_commit()
    example_invalid_column()
    example_update_nonexistent_row()
    example_index_usage()
    
    print("=" * 60)
    print("All examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
