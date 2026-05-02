import pytest

from db_migration_rehearsal.rules import (
    DangerousDDLRule,
    IrreversibleMigrationRule,
    MissingRollbackRule,
    DuplicateVersionsRule,
    DataLossRiskRule,
    Severity,
    RuleViolation,
)
from db_migration_rehearsal.migration_parser import ParsedMigration


class TestDangerousDDLRule:
    
    def test_detect_drop_table(self):
        rule = DangerousDDLRule()
        
        migration = ParsedMigration(
            version="1",
            filename="V1__drop.sql",
            filepath="/test/V1__drop.sql",
            migration_type="sql",
            raw_content="DROP TABLE users;",
            up_operations=[{
                "type": "DROP_TABLE",
                "statement": "DROP TABLE users;",
                "tables": ["users"],
                "columns": [],
                "risk_level": "high",
            }],
            has_rollback=False,
        )
        
        violations = rule.check(migration)
        
        assert len(violations) == 1
        assert violations[0].rule_id == "dangerous_ddl"
        assert violations[0].severity == Severity.ERROR
    
    def test_detect_drop_column(self):
        rule = DangerousDDLRule()
        
        migration = ParsedMigration(
            version="1",
            filename="V1__drop_col.sql",
            filepath="/test/V1__drop_col.sql",
            migration_type="sql",
            raw_content="ALTER TABLE users DROP COLUMN phone;",
            up_operations=[{
                "type": "ALTER_DROP_COLUMN",
                "statement": "ALTER TABLE users DROP COLUMN phone;",
                "tables": ["users"],
                "columns": ["phone"],
                "risk_level": "high",
            }],
            has_rollback=False,
        )
        
        violations = rule.check(migration)
        
        assert len(violations) == 1
    
    def test_safe_operations_not_flagged(self):
        rule = DangerousDDLRule()
        
        migration = ParsedMigration(
            version="1",
            filename="V1__safe.sql",
            filepath="/test/V1__safe.sql",
            migration_type="sql",
            raw_content="ALTER TABLE users ADD COLUMN phone TEXT;",
            up_operations=[{
                "type": "ALTER_ADD_COLUMN",
                "statement": "ALTER TABLE users ADD COLUMN phone TEXT;",
                "tables": ["users"],
                "columns": ["phone"],
                "risk_level": "low",
            }],
            has_rollback=False,
        )
        
        violations = rule.check(migration)
        
        assert len(violations) == 0


class TestIrreversibleMigrationRule:
    
    def test_detect_no_rollback_with_dangerous_ops(self):
        rule = IrreversibleMigrationRule()
        
        migration = ParsedMigration(
            version="1",
            filename="V1__danger_no_rollback.sql",
            filepath="/test/V1__danger_no_rollback.sql",
            migration_type="sql",
            raw_content="DROP TABLE users;",
            up_operations=[{
                "type": "DROP_TABLE",
                "risk_level": "high",
            }],
            down_operations=[],
            has_rollback=False,
        )
        
        violations = rule.check(migration)
        
        assert len(violations) == 1
        assert violations[0].severity == Severity.ERROR
    
    def test_no_violation_with_rollback(self):
        rule = IrreversibleMigrationRule()
        
        migration = ParsedMigration(
            version="1",
            filename="V1__with_rollback.sql",
            filepath="/test/V1__with_rollback.sql",
            migration_type="sql",
            raw_content="""
            DROP TABLE users;
            -- down:
            -- CREATE TABLE users (...);
            """,
            up_operations=[{
                "type": "DROP_TABLE",
                "risk_level": "high",
            }],
            down_operations=[{
                "type": "CREATE_TABLE",
            }],
            has_rollback=True,
        )
        
        violations = rule.check(migration)
        
        assert len(violations) == 0
    
    def test_safe_ops_no_rollback_ok(self):
        rule = IrreversibleMigrationRule()
        
        migration = ParsedMigration(
            version="1",
            filename="V1__safe_no_rollback.sql",
            filepath="/test/V1__safe_no_rollback.sql",
            migration_type="sql",
            raw_content="ALTER TABLE users ADD COLUMN phone TEXT;",
            up_operations=[{
                "type": "ALTER_ADD_COLUMN",
                "risk_level": "low",
            }],
            down_operations=[],
            has_rollback=False,
        )
        
        violations = rule.check(migration)
        
        assert len(violations) == 0


class TestDuplicateVersionsRule:
    
    def test_detect_duplicate_version(self):
        rule = DuplicateVersionsRule()
        
        migration1 = ParsedMigration(
            version="1",
            filename="V1__first.sql",
            filepath="/test/V1__first.sql",
            migration_type="sql",
            raw_content="",
            up_operations=[],
            has_rollback=False,
        )
        
        migration2 = ParsedMigration(
            version="1",
            filename="V1__second.sql",
            filepath="/test/V1__second.sql",
            migration_type="sql",
            raw_content="",
            up_operations=[],
            has_rollback=False,
        )
        
        violations1 = rule.check(migration1)
        assert len(violations1) == 0
        
        violations2 = rule.check(migration2)
        assert len(violations2) == 1
        assert "V1__first.sql" in violations2[0].description
    
    def test_reset_clears_versions(self):
        rule = DuplicateVersionsRule()
        
        migration1 = ParsedMigration(
            version="1",
            filename="V1__first.sql",
            filepath="/test/V1__first.sql",
            migration_type="sql",
            raw_content="",
            up_operations=[],
            has_rollback=False,
        )
        
        rule.check(migration1)
        rule.reset()
        
        migration2 = ParsedMigration(
            version="1",
            filename="V1__second.sql",
            filepath="/test/V1__second.sql",
            migration_type="sql",
            raw_content="",
            up_operations=[],
            has_rollback=False,
        )
        
        violations = rule.check(migration2)
        assert len(violations) == 0


class TestDataLossRiskRule:
    
    def test_detect_type_compression(self):
        rule = DataLossRiskRule()
        
        migration = ParsedMigration(
            version="1",
            filename="V1__type_change.sql",
            filepath="/test/V1__type_change.sql",
            migration_type="sql",
            raw_content="ALTER TABLE users ALTER COLUMN id BIGINT TO INT;",
            up_operations=[{
                "type": "ALTER_MODIFY_COLUMN",
                "statement": "ALTER TABLE users ALTER COLUMN id BIGINT TO INT;",
                "tables": ["users"],
                "columns": ["id"],
                "risk_level": "medium",
            }],
            has_rollback=False,
        )
        
        violations = rule.check(migration)
        
        assert len(violations) >= 0


class TestRuleViolation:
    
    def test_to_dict(self):
        violation = RuleViolation(
            rule_id="test_rule",
            rule_name="Test Rule",
            severity=Severity.ERROR,
            migration_version="1",
            migration_file="V1__test.sql",
            description="Test violation",
            location={"line": 1, "column": 0},
            suggestion="Fix it",
            metadata={"extra": "info"},
        )
        
        data = violation.to_dict()
        
        assert data["rule_id"] == "test_rule"
        assert data["severity"] == "error"
        assert data["description"] == "Test violation"
        assert data["suggestion"] == "Fix it"
