"""迁移计划模块 - 生成 LFS 迁移计划和 dry-run"""
from .generator import (
    MigrationPlanGenerator,
    generate_gitattributes_suggestions,
    generate_migration_command,
    generate_migration_plan,
)

__all__ = [
    "MigrationPlanGenerator",
    "generate_migration_plan",
    "generate_gitattributes_suggestions",
    "generate_migration_command",
]
