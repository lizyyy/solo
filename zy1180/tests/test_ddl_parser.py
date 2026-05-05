"""Tests for DDL parser."""

import pytest

from pg_migration_scanner.ddl_parser import DDLParser
from pg_migration_scanner.models import DDLType, LockMode


class TestDDLParser:
    """Test DDLParser class."""

    def setup_method(self) -> None:
        """Set up test fixture."""
        self.parser = DDLParser()

    def test_parse_create_table(self) -> None:
        """Test parsing CREATE TABLE."""
        sql = "CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(100));"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.CREATE_TABLE
        assert operations[0].table_name == "test"
        assert operations[0].lock_mode == LockMode.ACCESS_EXCLUSIVE

    def test_parse_create_index(self) -> None:
        """Test parsing CREATE INDEX."""
        sql = "CREATE INDEX idx_test ON test(name);"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.CREATE_INDEX
        assert operations[0].table_name == "test"
        assert operations[0].index_name == "idx_test"
        assert operations[0].is_concurrently is False
        assert operations[0].lock_mode == LockMode.SHARE

    def test_parse_create_index_concurrently(self) -> None:
        """Test parsing CREATE INDEX CONCURRENTLY."""
        sql = "CREATE INDEX CONCURRENTLY idx_test ON test(name);"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.CREATE_INDEX
        assert operations[0].is_concurrently is True
        assert operations[0].lock_mode == LockMode.SHARE_UPDATE_EXCLUSIVE
        assert operations[0].is_transactional is False

    def test_parse_drop_index(self) -> None:
        """Test parsing DROP INDEX."""
        sql = "DROP INDEX idx_test;"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.DROP_INDEX
        assert operations[0].lock_mode == LockMode.ACCESS_EXCLUSIVE

    def test_parse_alter_table_add_column(self) -> None:
        """Test parsing ALTER TABLE ADD COLUMN."""
        sql = "ALTER TABLE test ADD COLUMN new_col VARCHAR(255);"
        operations = self.parser.parse(sql)

        assert len(operations) >= 1
        ddl_types = [op.ddl_type for op in operations]
        assert DDLType.ADD_COLUMN in ddl_types or DDLType.ALTER_TABLE in ddl_types

    def test_parse_alter_table_drop_column(self) -> None:
        """Test parsing ALTER TABLE DROP COLUMN."""
        sql = "ALTER TABLE test DROP COLUMN old_col;"
        operations = self.parser.parse(sql)

        assert len(operations) >= 1
        for op in operations:
            assert op.lock_mode == LockMode.ACCESS_EXCLUSIVE

    def test_parse_alter_column_type(self) -> None:
        """Test parsing ALTER TABLE ALTER COLUMN TYPE."""
        sql = "ALTER TABLE test ALTER COLUMN col TYPE TEXT;"
        operations = self.parser.parse(sql)

        assert len(operations) >= 1
        ddl_types = [op.ddl_type for op in operations]
        assert DDLType.ALTER_COLUMN in ddl_types or DDLType.ALTER_TABLE in ddl_types

    def test_parse_drop_table(self) -> None:
        """Test parsing DROP TABLE."""
        sql = "DROP TABLE test;"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.DROP_TABLE
        assert operations[0].lock_mode == LockMode.ACCESS_EXCLUSIVE

    def test_parse_truncate(self) -> None:
        """Test parsing TRUNCATE."""
        sql = "TRUNCATE TABLE test;"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.TRUNCATE
        assert operations[0].lock_mode == LockMode.ACCESS_EXCLUSIVE

    def test_parse_add_constraint(self) -> None:
        """Test parsing ALTER TABLE ADD CONSTRAINT."""
        sql = "ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);"
        operations = self.parser.parse(sql)

        assert len(operations) >= 1
        for op in operations:
            assert op.lock_mode == LockMode.ACCESS_EXCLUSIVE

    def test_parse_multiple_statements(self) -> None:
        """Test parsing multiple statements."""
        sql = """
        CREATE TABLE test1 (id SERIAL PRIMARY KEY);
        CREATE TABLE test2 (id SERIAL PRIMARY KEY);
        CREATE INDEX idx_test1 ON test1(id);
        """
        operations = self.parser.parse(sql)

        assert len(operations) >= 3

    def test_parse_if_not_exists(self) -> None:
        """Test parsing IF NOT EXISTS."""
        sql = "CREATE INDEX IF NOT EXISTS idx_test ON test(name);"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.CREATE_INDEX

    def test_parse_if_exists(self) -> None:
        """Test parsing IF EXISTS."""
        sql = "DROP INDEX IF EXISTS idx_test;"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.DROP_INDEX

    def test_parse_comment(self) -> None:
        """Test parsing COMMENT."""
        sql = "COMMENT ON TABLE test IS 'This is a test table';"
        operations = self.parser.parse(sql)

        assert len(operations) == 1
        assert operations[0].ddl_type == DDLType.COMMENT
        assert operations[0].lock_mode == LockMode.ACCESS_SHARE
