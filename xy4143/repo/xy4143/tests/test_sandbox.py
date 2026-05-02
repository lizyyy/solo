import pytest

from db_migration_rehearsal.sandbox import SQLiteSandbox, ExecutionResult
from db_migration_rehearsal.config import Config


class TestSQLiteSandbox:
    
    def test_create_and_cleanup(self):
        config = Config()
        sandbox = SQLiteSandbox(config)
        
        sandbox.create()
        assert sandbox.engine is not None
        assert sandbox.db_path is not None
        
        sandbox.cleanup()
        assert sandbox.engine is None
        assert sandbox.db_path is None
    
    def test_execute_sql_create_table(self):
        config = Config()
        sandbox = SQLiteSandbox(config)
        
        try:
            sandbox.create()
            
            sql = """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE
            );
            """
            
            success, error = sandbox.execute_sql(sql)
            assert success is True, f"Error: {error}"
            assert error is None
            
            schema = sandbox.get_schema_state()
            tables = [t["name"] for t in schema.get("tables", [])]
            assert "users" in tables
        
        finally:
            sandbox.cleanup()
    
    def test_execute_sql_insert_and_select(self):
        config = Config()
        sandbox = SQLiteSandbox(config)
        
        try:
            sandbox.create()
            
            create_sql = """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
            """
            sandbox.execute_sql(create_sql)
            
            insert_sql = "INSERT INTO users (name) VALUES ('Alice'), ('Bob');"
            success, error = sandbox.execute_sql(insert_sql)
            assert success is True, f"Error: {error}"
        
        finally:
            sandbox.cleanup()
    
    def test_execute_sql_error_handling(self):
        config = Config()
        sandbox = SQLiteSandbox(config)
        
        try:
            sandbox.create()
            
            sql = "INVALID SQL STATEMENT;"
            success, error = sandbox.execute_sql(sql)
            
            assert success is False
            assert error is not None
        
        finally:
            sandbox.cleanup()
    
    def test_get_schema_state(self):
        config = Config()
        sandbox = SQLiteSandbox(config)
        
        try:
            sandbox.create()
            
            sql = """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX idx_email ON users(email);
            """
            
            sandbox.execute_sql(sql)
            
            schema = sandbox.get_schema_state()
            
            assert "tables" in schema
            assert len(schema["tables"]) == 1
            
            users_table = schema["tables"][0]
            assert users_table["name"] == "users"
            
            columns = [c["name"] for c in users_table["columns"]]
            assert "id" in columns
            assert "name" in columns
            assert "email" in columns
            assert "created_at" in columns
        
        finally:
            sandbox.cleanup()
    
    def test_load_schema(self):
        config = Config()
        sandbox = SQLiteSandbox(config)
        
        try:
            sandbox.create()
            
            schema_sql = """
            CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                price REAL
            );
            """
            
            sandbox.load_schema(schema_sql)
            
            schema = sandbox.get_schema_state()
            tables = [t["name"] for t in schema.get("tables", [])]
            assert "products" in tables
        
        finally:
            sandbox.cleanup()


class TestExecutionResult:
    
    def test_to_dict(self):
        result = ExecutionResult(
            migration_version="1",
            migration_file="V1__test.sql",
            success=True,
            execution_time_ms=123.45,
            operations_executed=2,
        )
        
        data = result.to_dict()
        
        assert data["migration_version"] == "1"
        assert data["migration_file"] == "V1__test.sql"
        assert data["success"] is True
        assert data["execution_time_ms"] == 123.45
        assert data["operations_executed"] == 2
    
    def test_with_error(self):
        result = ExecutionResult(
            migration_version="2",
            migration_file="V2__test.sql",
            success=False,
            error_message="Syntax error in SQL",
        )
        
        assert result.success is False
        assert result.error_message == "Syntax error in SQL"
