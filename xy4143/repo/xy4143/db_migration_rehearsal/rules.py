import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from db_migration_rehearsal.config import Config
from db_migration_rehearsal.migration_parser import ParsedMigration, MigrationParserFactory
from db_migration_rehearsal.importer import MigrationImporter


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class RuleViolation:
    rule_id: str
    rule_name: str
    severity: Severity
    migration_version: str
    migration_file: str
    description: str
    location: Optional[Dict[str, Any]] = None
    suggestion: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "severity": self.severity.value,
            "migration_version": self.migration_version,
            "migration_file": self.migration_file,
            "description": self.description,
            "location": self.location,
            "suggestion": self.suggestion,
            "metadata": self.metadata,
        }


class BaseRule(ABC):
    rule_id: str
    rule_name: str
    description: str
    default_severity: Severity
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.enabled = self.config.get("enabled", True)
        severity_str = self.config.get("severity", self.default_severity.value)
        self.severity = Severity(severity_str)
    
    @abstractmethod
    def check(self, migration: ParsedMigration) -> List[RuleViolation]:
        pass
    
    def create_violation(
        self,
        migration: ParsedMigration,
        description: str,
        location: Optional[Dict[str, Any]] = None,
        suggestion: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> RuleViolation:
        return RuleViolation(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            severity=self.severity,
            migration_version=migration.version,
            migration_file=migration.filename,
            description=description,
            location=location,
            suggestion=suggestion,
            metadata=metadata or {},
        )


class DangerousDDLRule(BaseRule):
    rule_id = "dangerous_ddl"
    rule_name = "危险 DDL 检查"
    description = "检测可能导致数据丢失的危险 DDL 操作"
    default_severity = Severity.ERROR
    
    DANGEROUS_OPERATIONS = {
        "DROP_TABLE": {
            "description": "删除表操作",
            "suggestion": "请确保这是预期操作，或者考虑使用软删除",
        },
        "DROP_INDEX": {
            "description": "删除索引操作",
            "suggestion": "请确保删除索引不会影响查询性能",
        },
        "ALTER_DROP_COLUMN": {
            "description": "删除列操作",
            "suggestion": "请确保删除列不会导致数据丢失，考虑先备份数据",
        },
        "ALTER_RENAME_COLUMN": {
            "description": "重命名列操作",
            "suggestion": "请更新所有引用该列的应用代码，考虑使用视图兼容旧代码",
        },
        "ALTER_RENAME_TABLE": {
            "description": "重命名表操作",
            "suggestion": "请更新所有引用该表的应用代码，考虑使用视图兼容旧代码",
        },
        "TRUNCATE": {
            "description": "清空表数据",
            "suggestion": "请确保这是预期操作，数据不可恢复",
        },
        "DROP_VIEW": {
            "description": "删除视图",
            "suggestion": "请确保没有应用依赖此视图",
        },
        "DROP_SEQUENCE": {
            "description": "删除序列",
            "suggestion": "请确保没有表使用此序列",
        },
    }
    
    def check(self, migration: ParsedMigration) -> List[RuleViolation]:
        violations: List[RuleViolation] = []
        
        for op in migration.up_operations:
            op_type = op.get("type", "UNKNOWN")
            
            if op_type in self.DANGEROUS_OPERATIONS:
                info = self.DANGEROUS_OPERATIONS[op_type]
                
                violation = self.create_violation(
                    migration=migration,
                    description=f"{info['description']}: {op.get('statement', '')[:100]}",
                    location={
                        "operation_type": op_type,
                        "tables": op.get("tables", []),
                        "columns": op.get("columns", []),
                    },
                    suggestion=info["suggestion"],
                    metadata={
                        "statement": op.get("statement", ""),
                        "risk_level": op.get("risk_level", "unknown"),
                    },
                )
                violations.append(violation)
        
        return violations


class IrreversibleMigrationRule(BaseRule):
    rule_id = "irreversible_migration"
    rule_name = "不可逆迁移检查"
    description = "检测没有提供回滚操作的迁移脚本"
    default_severity = Severity.ERROR
    
    def check(self, migration: ParsedMigration) -> List[RuleViolation]:
        violations: List[RuleViolation] = []
        
        if not migration.has_rollback and len(migration.up_operations) > 0:
            dangerous_ops = [
                op for op in migration.up_operations
                if op.get("risk_level") in ["high", "medium"]
            ]
            
            if dangerous_ops:
                violation = self.create_violation(
                    migration=migration,
                    description=f"迁移脚本包含 {len(dangerous_ops)} 个高/中风险操作但没有回滚脚本",
                    location={
                        "dangerous_operations_count": len(dangerous_ops),
                        "operations": [op.get("type") for op in dangerous_ops],
                    },
                    suggestion="请添加回滚脚本 (down 操作) 以便在出错时可以回滚",
                    metadata={
                        "up_operations_count": len(migration.up_operations),
                        "down_operations_count": len(migration.down_operations),
                    },
                )
                violations.append(violation)
        
        return violations


class MissingRollbackRule(BaseRule):
    rule_id = "missing_rollback"
    rule_name = "回滚脚本完整性检查"
    description = "检查回滚脚本是否完整覆盖所有正向操作"
    default_severity = Severity.WARNING
    
    def check(self, migration: ParsedMigration) -> List[RuleViolation]:
        violations: List[RuleViolation] = []
        
        if migration.has_rollback:
            up_types = set(op.get("type") for op in migration.up_operations)
            down_types = set(op.get("type") for op in migration.down_operations)
            
            expected_down = self._get_expected_down_operations(up_types)
            missing = expected_down - down_types
            
            if missing:
                violation = self.create_violation(
                    migration=migration,
                    description=f"回滚脚本可能不完整，缺少对以下操作的回滚: {', '.join(missing)}",
                    location={
                        "up_operations": list(up_types),
                        "down_operations": list(down_types),
                        "missing_operations": list(missing),
                    },
                    suggestion="请确保回滚脚本能够完全撤销正向操作的影响",
                )
                violations.append(violation)
        
        return violations
    
    def _get_expected_down_operations(self, up_types: set) -> set:
        mapping = {
            "CREATE_TABLE": {"DROP_TABLE"},
            "ALTER_ADD_COLUMN": {"ALTER_DROP_COLUMN"},
            "ALTER_DROP_COLUMN": {"ALTER_ADD_COLUMN"},
            "CREATE_INDEX": {"DROP_INDEX"},
            "DROP_INDEX": {"CREATE_INDEX"},
            "CREATE_UNIQUE_INDEX": {"DROP_INDEX"},
            "ALTER_ADD_CONSTRAINT": {"ALTER_DROP_CONSTRAINT"},
            "ALTER_DROP_CONSTRAINT": {"ALTER_ADD_CONSTRAINT"},
            "CREATE_VIEW": {"DROP_VIEW"},
            "DROP_VIEW": {"CREATE_VIEW"},
        }
        
        expected: set = set()
        for up_type in up_types:
            if up_type in mapping:
                expected.update(mapping[up_type])
        
        return expected


class ForeignKeyChangesRule(BaseRule):
    rule_id = "foreign_key_changes"
    rule_name = "外键变化检查"
    description = "检测外键约束的添加、删除和修改"
    default_severity = Severity.WARNING
    
    FOREIGN_KEY_OPERATIONS = {
        "ALTER_ADD_CONSTRAINT": "添加外键约束",
        "ALTER_DROP_CONSTRAINT": "删除外键约束",
    }
    
    def check(self, migration: ParsedMigration) -> List[RuleViolation]:
        violations: List[RuleViolation] = []
        
        for op in migration.up_operations:
            op_type = op.get("type", "")
            
            if op_type in self.FOREIGN_KEY_OPERATIONS:
                is_fk = False
                stmt = op.get("statement", "").upper()
                if "FOREIGN KEY" in stmt or "REFERENCES" in stmt:
                    is_fk = True
                
                if is_fk:
                    violation = self.create_violation(
                        migration=migration,
                        description=f"{self.FOREIGN_KEY_OPERATIONS[op_type]}: {op.get('statement', '')[:100]}",
                        location={
                            "operation_type": op_type,
                            "tables": op.get("tables", []),
                        },
                        suggestion="外键约束变化可能影响数据完整性和查询性能，请仔细验证",
                    )
                    violations.append(violation)
        
        return violations


class IndexChangesRule(BaseRule):
    rule_id = "index_changes"
    rule_name = "索引变化检查"
    description = "检测索引的添加、删除和修改"
    default_severity = Severity.WARNING
    
    INDEX_OPERATIONS = {
        "CREATE_INDEX": "创建索引",
        "CREATE_UNIQUE_INDEX": "创建唯一索引",
        "DROP_INDEX": "删除索引",
    }
    
    def check(self, migration: ParsedMigration) -> List[RuleViolation]:
        violations: List[RuleViolation] = []
        
        for op in migration.up_operations:
            op_type = op.get("type", "")
            
            if op_type in self.INDEX_OPERATIONS:
                is_unique = op_type == "CREATE_UNIQUE_INDEX"
                
                violation = self.create_violation(
                    migration=migration,
                    description=f"{self.INDEX_OPERATIONS[op_type]}: {op.get('statement', '')[:100]}",
                    location={
                        "operation_type": op_type,
                        "tables": op.get("tables", []),
                        "is_unique": is_unique,
                    },
                    suggestion="索引变化可能影响查询性能，请在生产环境前进行性能测试",
                    metadata={
                        "statement": op.get("statement", ""),
                    },
                )
                violations.append(violation)
        
        return violations


class DuplicateVersionsRule(BaseRule):
    rule_id = "duplicate_versions"
    rule_name = "重复版本检查"
    description = "检测重复的迁移版本号"
    default_severity = Severity.ERROR
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self._versions_seen: Dict[str, List[str]] = {}
    
    def check(self, migration: ParsedMigration) -> List[RuleViolation]:
        violations: List[RuleViolation] = []
        
        version = migration.version
        
        if version in self._versions_seen:
            self._versions_seen[version].append(migration.filename)
            
            violation = self.create_violation(
                migration=migration,
                description=f"检测到重复的迁移版本号 '{version}'，已存在于: {', '.join(self._versions_seen[version][:-1])}",
                location={
                    "version": version,
                    "duplicate_files": self._versions_seen[version],
                },
                suggestion="请修改迁移文件名，确保版本号唯一",
            )
            violations.append(violation)
        else:
            self._versions_seen[version] = [migration.filename]
        
        return violations
    
    def reset(self):
        self._versions_seen = {}


class DataLossRiskRule(BaseRule):
    rule_id = "data_loss_risk"
    rule_name = "数据丢失风险检查"
    description = "检测可能导致数据丢失的列类型变更"
    default_severity = Severity.ERROR
    
    TYPE_COMPRESSION = {
        ("BIGINT", "INT"): "从 BIGINT 缩小到 INT",
        ("BIGINT", "SMALLINT"): "从 BIGINT 缩小到 SMALLINT",
        ("INT", "SMALLINT"): "从 INT 缩小到 SMALLINT",
        ("TEXT", "VARCHAR"): "从 TEXT 缩小到 VARCHAR",
        ("DECIMAL", "INT"): "从 DECIMAL 缩小到 INT",
        ("FLOAT", "INT"): "从 FLOAT 缩小到 INT",
    }
    
    def check(self, migration: ParsedMigration) -> List[RuleViolation]:
        violations: List[RuleViolation] = []
        
        for op in migration.up_operations:
            op_type = op.get("type", "")
            
            if op_type == "ALTER_MODIFY_COLUMN":
                stmt = op.get("statement", "")
                
                for (from_type, to_type), desc in self.TYPE_COMPRESSION.items():
                    if from_type.upper() in stmt.upper() and to_type.upper() in stmt.upper():
                        violation = self.create_violation(
                            migration=migration,
                            description=f"数据类型收缩风险: {desc}",
                            location={
                                "operation_type": op_type,
                                "tables": op.get("tables", []),
                                "columns": op.get("columns", []),
                                "from_type": from_type,
                                "to_type": to_type,
                            },
                            suggestion="类型收缩可能导致数据截断或溢出，请确保数据在新类型范围内",
                            metadata={
                                "statement": stmt,
                            },
                        )
                        violations.append(violation)
        
        return violations


class RuleEngine:
    
    RULE_CLASSES = [
        DangerousDDLRule,
        IrreversibleMigrationRule,
        MissingRollbackRule,
        ForeignKeyChangesRule,
        IndexChangesRule,
        DuplicateVersionsRule,
        DataLossRiskRule,
    ]
    
    def __init__(self, config: Config):
        self.config = config
        self.rules: Dict[str, BaseRule] = {}
        
        for rule_class in self.RULE_CLASSES:
            rule_config = config.rules.get(rule_class.rule_id, {})
            rule = rule_class(rule_config)
            self.rules[rule.rule_id] = rule
    
    def run_all_checks(
        self,
        enabled_rules: Optional[List[str]] = None,
        skipped_rules: Optional[List[str]] = None,
        verbose: bool = False,
    ) -> Dict[str, Any]:
        importer = MigrationImporter(self.config)
        migrations = importer.parse_all_migrations()
        
        all_violations: List[RuleViolation] = []
        
        for rule in self.rules.values():
            if isinstance(rule, DuplicateVersionsRule):
                rule.reset()
        
        for migration in migrations:
            for rule_id, rule in self.rules.items():
                if not rule.enabled:
                    continue
                
                if enabled_rules and rule_id not in enabled_rules:
                    continue
                
                if skipped_rules and rule_id in skipped_rules:
                    continue
                
                violations = rule.check(migration)
                all_violations.extend(violations)
        
        errors = [v for v in all_violations if v.severity == Severity.ERROR]
        warnings = [v for v in all_violations if v.severity == Severity.WARNING]
        infos = [v for v in all_violations if v.severity == Severity.INFO]
        
        return {
            "migrations_checked": len(migrations),
            "total_violations": len(all_violations),
            "errors": len(errors),
            "warnings": len(warnings),
            "infos": len(infos),
            "issues": [v.to_dict() for v in all_violations],
            "checked_at": datetime.now().isoformat(),
        }
    
    def save_quarantine(
        self,
        check_results: Dict[str, Any],
        output_dir: str,
    ) -> str:
        import json
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        quarantine_file = output_path / "quarantine.json"
        
        data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "migrations_checked": check_results.get("migrations_checked", 0),
            },
            "summary": {
                "total_violations": check_results.get("total_violations", 0),
                "errors": check_results.get("errors", 0),
                "warnings": check_results.get("warnings", 0),
                "infos": check_results.get("infos", 0),
            },
            "issues": check_results.get("issues", []),
        }
        
        with open(quarantine_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return str(quarantine_file)
