import pytest

from db_migration_rehearsal.migration_parser import (
    SQLMigrationParser,
    MigrationParserFactory,
    ParsedMigration,
)


class TestSQLMigrationParser:
    
    def test_detect_type(self):
        parser = SQLMigrationParser()
        assert parser.detect_type("test.sql") is True
        assert parser.detect_type("test.py") is False
        assert parser.detect_type("test.prisma") is False
    
    def test_get_version_flyway(self):
        parser = SQLMigrationParser()
        assert parser.get_version("V1__create_table.sql") == "1"
        assert parser.get_version("V1_2__create_table.sql") == "1_2"
        assert parser.get_version("V20240101120000__add_column.sql") == "20240101120000"
    
    def test_get_version_custom(self):
        parser = SQLMigrationParser()
        assert parser.get_version("001_create_table.sql") == "001"
        assert parser.get_version("002_add_column.sql") == "002"
    
    def test_parse_simple_migration(self, tmp_path):
        sql_content = """
-- Create users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- down:
DROP TABLE users;
"""
        
        file_path = tmp_path / "V1__create_users.sql"
        file_path.write_text(sql_content)
        
        parser = SQLMigrationParser()
        parsed = parser.parse(str(file_path))
        
        assert parsed.version == "1"
        assert parsed.migration_type == "sql"
        assert parsed.has_rollback is True
        assert len(parsed.up_operations) > 0
    
    def test_parse_create_table(self):
        parser = SQLMigrationParser()
        
        operations = parser._parse_sql_operations([
            "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);"
        ])
        
        assert len(operations) == 1
        assert operations[0]["type"] == "CREATE_TABLE"
        assert "users" in operations[0]["tables"]
    
    def test_parse_drop_table(self):
        parser = SQLMigrationParser()
        
        operations = parser._parse_sql_operations([
            "DROP TABLE users;"
        ])
        
        assert len(operations) == 1
        assert operations[0]["type"] == "DROP_TABLE"
        assert operations[0]["risk_level"] == "high"
    
    def test_parse_alter_add_column(self):
        parser = SQLMigrationParser()
        
        operations = parser._parse_sql_operations([
            "ALTER TABLE users ADD COLUMN phone TEXT;"
        ])
        
        assert len(operations) == 1
        assert operations[0]["type"] == "ALTER_ADD_COLUMN"
        assert operations[0]["risk_level"] == "low"
    
    def test_parse_alter_drop_column(self):
        parser = SQLMigrationParser()
        
        operations = parser._parse_sql_operations([
            "ALTER TABLE users DROP COLUMN phone;"
        ])
        
        assert len(operations) == 1
        assert operations[0]["type"] == "ALTER_DROP_COLUMN"
        assert operations[0]["risk_level"] == "high"
    
    def test_split_up_down(self):
        parser = SQLMigrationParser()
        
        content = """
CREATE TABLE users (id INTEGER);

-- down:
DROP TABLE users;
"""
        
        up, down = parser._split_up_down(content)
        
        assert len(up) > 0
        assert len(down) > 0
        assert any("CREATE" in line for line in up)
        assert any("DROP" in line for line in down)
    
    def test_classify_statement(self):
        parser = SQLMigrationParser()
        
        test_cases = [
            ("CREATE TABLE users (id INTEGER);", "CREATE_TABLE"),
            ("DROP TABLE users;", "DROP_TABLE"),
            ("ALTER TABLE users ADD COLUMN name TEXT;", "ALTER_ADD_COLUMN"),
            ("ALTER TABLE users DROP COLUMN name;", "ALTER_DROP_COLUMN"),
            ("CREATE INDEX idx_name ON users(name);", "CREATE_INDEX"),
            ("DROP INDEX idx_name;", "DROP_INDEX"),
            ("INSERT INTO users (name) VALUES ('test');", "INSERT"),
            ("UPDATE users SET name = 'test';", "UPDATE"),
            ("DELETE FROM users WHERE id = 1;", "DELETE"),
            ("TRUNCATE TABLE users;", "TRUNCATE"),
        ]
        
        for stmt, expected_type in test_cases:
            assert parser._classify_statement(stmt) == expected_type


class TestMigrationParserFactory:
    
    def test_get_parsers(self):
        parsers = MigrationParserFactory.get_parsers()
        assert len(parsers) > 0
    
    def test_parse_file_sql(self, tmp_path):
        sql_content = "CREATE TABLE test (id INTEGER);"
        
        file_path = tmp_path / "V1__test.sql"
        file_path.write_text(sql_content)
        
        parsed = MigrationParserFactory.parse_file(str(file_path))
        
        assert parsed is not None
        assert parsed.migration_type == "sql"


class TestParsedMigration:
    
    def test_to_dict(self):
        migration = ParsedMigration(
            version="1",
            filename="V1__test.sql",
            filepath="/test/V1__test.sql",
            migration_type="sql",
            raw_content="CREATE TABLE test (id INTEGER);",
            up_operations=[{"type": "CREATE_TABLE"}],
            has_rollback=False,
        )
        
        data = migration.to_dict()
        
        assert data["version"] == "1"
        assert data["migration_type"] == "sql"
        assert data["up_operations_count"] == 1
        assert data["has_rollback"] is False
