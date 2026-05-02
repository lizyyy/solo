import os
import json
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


DEFAULT_CONFIG_NAME = "rehearsal.json"
DEFAULT_MIGRATIONS_DIR = "migrations"
DEFAULT_BASELINE_SCHEMA_DIR = "baseline"
DEFAULT_SAMPLE_DATA_DIR = "sample_data"
DEFAULT_OUTPUT_DIR = "output"


class ConfigModel(BaseModel):
    project_name: str = Field(default="db-migration-project", description="项目名称")
    database_type: str = Field(default="sqlite", description="数据库类型: sqlite, postgres")
    migrations_dir: str = Field(default=DEFAULT_MIGRATIONS_DIR, description="迁移脚本目录")
    baseline_schema_dir: str = Field(default=DEFAULT_BASELINE_SCHEMA_DIR, description="基线 Schema 目录")
    sample_data_dir: str = Field(default=DEFAULT_SAMPLE_DATA_DIR, description="样本数据目录")
    output_dir: str = Field(default=DEFAULT_OUTPUT_DIR, description="输出目录")
    
    postgres: Optional[Dict[str, Any]] = Field(default=None, description="PostgreSQL 配置")
    sqlite: Optional[Dict[str, Any]] = Field(default=None, description="SQLite 配置")
    
    rules: Dict[str, Any] = Field(
        default_factory=lambda: {
            "dangerous_ddl": {"enabled": True, "severity": "error"},
            "irreversible_migration": {"enabled": True, "severity": "error"},
            "foreign_key_changes": {"enabled": True, "severity": "warning"},
            "index_changes": {"enabled": True, "severity": "warning"},
            "duplicate_versions": {"enabled": True, "severity": "error"},
            "data_loss_risk": {"enabled": True, "severity": "error"},
            "missing_rollback": {"enabled": True, "severity": "warning"},
        }
    )
    
    migration_types: List[str] = Field(
        default_factory=lambda: ["sql", "prisma", "alembic", "flyway", "liquibase"],
        description="支持的迁移类型",
    )
    
    version_patterns: Dict[str, str] = Field(
        default_factory=lambda: {
            "flyway": r"V(\d+)__.*\.sql",
            "liquibase": r".*\.xml",
            "alembic": r".*\.py",
            "prisma": r"schema\.prisma",
            "sql": r"(\d+)_.*\.sql",
        }
    )


@dataclass
class Config:
    project_name: str = "db-migration-project"
    database_type: str = "sqlite"
    migrations_dir: str = DEFAULT_MIGRATIONS_DIR
    baseline_schema_dir: str = DEFAULT_BASELINE_SCHEMA_DIR
    sample_data_dir: str = DEFAULT_SAMPLE_DATA_DIR
    output_dir: str = DEFAULT_OUTPUT_DIR
    config_path: str = ""
    
    postgres: dict = field(default_factory=dict)
    sqlite: dict = field(default_factory=dict)
    rules: dict = field(default_factory=dict)
    migration_types: list = field(default_factory=list)
    version_patterns: dict = field(default_factory=dict)
    
    @property
    def migrations_path(self) -> Path:
        return Path(self.migrations_dir)
    
    @property
    def baseline_path(self) -> Path:
        return Path(self.baseline_schema_dir)
    
    @property
    def sample_data_path(self) -> Path:
        return Path(self.sample_data_dir)
    
    @property
    def output_path(self) -> Path:
        return Path(self.output_dir)
    
    def to_dict(self) -> dict:
        data = asdict(self)
        data.pop("config_path", None)
        return data


def find_config_file(start_dir: str = ".") -> Optional[str]:
    """
    从当前目录向上查找配置文件。
    """
    current = Path(start_dir).resolve()
    
    while True:
        config_path = current / DEFAULT_CONFIG_NAME
        if config_path.exists():
            return str(config_path)
        
        parent = current.parent
        if parent == current:
            return None
        
        current = parent


def load_config(config_path: Optional[str] = None) -> Config:
    """
    加载配置文件。
    """
    if config_path is None:
        config_path = find_config_file()
    
    if config_path is None:
        config_path = os.path.join(os.getcwd(), DEFAULT_CONFIG_NAME)
        if not os.path.exists(config_path):
            return init_config(".", "sqlite")
    
    with open(config_path, "r", encoding="utf-8") as f:
        config_data = json.load(f)
    
    model = ConfigModel(**config_data)
    
    config = Config(
        project_name=model.project_name,
        database_type=model.database_type,
        migrations_dir=model.migrations_dir,
        baseline_schema_dir=model.baseline_schema_dir,
        sample_data_dir=model.sample_data_dir,
        output_dir=model.output_dir,
        config_path=config_path,
        postgres=model.postgres or {},
        sqlite=model.sqlite or {},
        rules=model.rules,
        migration_types=model.migration_types,
        version_patterns=model.version_patterns,
    )
    
    return config


def init_config(target_dir: str, database_type: str = "sqlite") -> Config:
    """
    初始化配置文件。
    """
    target_path = Path(target_dir).resolve()
    config_path = target_path / DEFAULT_CONFIG_NAME
    
    model = ConfigModel(
        project_name=target_path.name,
        database_type=database_type,
        migrations_dir=str(target_path / DEFAULT_MIGRATIONS_DIR),
        baseline_schema_dir=str(target_path / DEFAULT_BASELINE_SCHEMA_DIR),
        sample_data_dir=str(target_path / DEFAULT_SAMPLE_DATA_DIR),
        output_dir=str(target_path / DEFAULT_OUTPUT_DIR),
    )
    
    os.makedirs(model.migrations_dir, exist_ok=True)
    os.makedirs(model.baseline_schema_dir, exist_ok=True)
    os.makedirs(model.sample_data_dir, exist_ok=True)
    os.makedirs(model.output_dir, exist_ok=True)
    
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(model.model_dump(), f, indent=2, ensure_ascii=False)
    
    return Config(
        project_name=model.project_name,
        database_type=model.database_type,
        migrations_dir=model.migrations_dir,
        baseline_schema_dir=model.baseline_schema_dir,
        sample_data_dir=model.sample_data_dir,
        output_dir=model.output_dir,
        config_path=str(config_path),
        postgres=model.postgres or {},
        sqlite=model.sqlite or {},
        rules=model.rules,
        migration_types=model.migration_types,
        version_patterns=model.version_patterns,
    )
