"""
迁移脚本解析模块

解析迁移脚本，提取元数据和 SQL 语句。
"""

import os
import re
from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass, field
from datetime import datetime

import sqlparse


@dataclass
class MigrationScript:
    """迁移脚本"""
    filename: str
    full_path: str
    version: str
    description: str
    content: str
    statements: List[str] = field(default_factory=list)
    parse_errors: List[str] = field(default_factory=list)
    has_rollback: bool = False
    service: str = 'unknown'


class MigrationParser:
    """迁移脚本解析器"""
    
    # 时间戳格式: V20240115120000__description.sql
    TIMESTAMP_PATTERN = re.compile(
        r'^V(\d{14})__([\w_]+)\.sql$',
        re.IGNORECASE
    )
    
    # 回滚脚本: U20240115120000__description.sql 或 Vxxx_rollback.sql
    ROLLBACK_PATTERN = re.compile(
        r'^U(\d{14})__([\w_]+)\.sql$|^V(\d{14})__([\w_]+)_rollback\.sql$',
        re.IGNORECASE
    )
    
    def __init__(self, migration_dir: str):
        self.migration_dir = migration_dir
        self.migrations: Dict[str, MigrationScript] = {}
        self.rollbacks: Dict[str, MigrationScript] = {}
    
    def parse_directory(self) -> Tuple[Dict[str, MigrationScript], List[str]]:
        """解析整个迁移目录"""
        errors = []
        
        if not os.path.exists(self.migration_dir):
            raise FileNotFoundError(f"迁移目录不存在: {self.migration_dir}")
        
        for filename in os.listdir(self.migration_dir):
            if not filename.endswith('.sql'):
                continue
            
            full_path = os.path.join(self.migration_dir, filename)
            
            try:
                # 检查是否是回滚脚本
                rollback_match = self.ROLLBACK_PATTERN.match(filename)
                if rollback_match:
                    version = rollback_match.group(1) or rollback_match.group(3)
                    rollback = self._parse_script(filename, full_path, version, is_rollback=True)
                    self.rollbacks[version] = rollback
                    continue
                
                # 检查是否是正向迁移脚本
                timestamp_match = self.TIMESTAMP_PATTERN.match(filename)
                if timestamp_match:
                    version = timestamp_match.group(1)
                    description = timestamp_match.group(2)
                    migration = self._parse_script(filename, full_path, version, description, is_rollback=False)
                    self.migrations[version] = migration
                else:
                    errors.append(f"无效的迁移脚本命名格式: {filename}")
            
            except Exception as e:
                errors.append(f"解析脚本失败 {filename}: {str(e)}")
        
        self._check_rollback_matches()
        return self.migrations, errors
    
    def _parse_script(
        self, 
        filename: str, 
        full_path: str, 
        version: str, 
        description: str = '',
        is_rollback: bool = False
    ) -> MigrationScript:
        """解析单个脚本文件"""
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        migration = MigrationScript(
            filename=filename,
            full_path=full_path,
            version=version,
            description=description,
            content=content
        )
        
        # 解析 SQL 语句
        try:
            parsed = sqlparse.parse(content)
            migration.statements = []
            for stmt in parsed:
                stmt_str = str(stmt).strip()
                if stmt_str:
                    # 检查是否有非注释的内容
                    # 移除所有注释后检查是否有实质内容
                    without_comments = sqlparse.format(stmt_str, strip_comments=True).strip()
                    if without_comments and without_comments != ';':
                        migration.statements.append(stmt_str)
        except Exception as e:
            migration.parse_errors.append(f"SQL 解析失败: {str(e)}")
        
        return migration
    
    def _check_rollback_matches(self) -> None:
        """检查每个正向迁移是否有对应的回滚脚本"""
        for version, migration in self.migrations.items():
            migration.has_rollback = version in self.rollbacks
    
    def get_sorted_migrations(self) -> List[MigrationScript]:
        """按版本号排序的迁移列表"""
        return sorted(
            self.migrations.values(),
            key=lambda m: m.version
        )
    
    def get_versions(self) -> List[str]:
        """获取所有版本号"""
        return sorted(self.migrations.keys())
    
    def check_duplicate_versions(self) -> List[str]:
        """检查重复的版本号"""
        versions = []
        duplicates = []
        
        for migration in self.get_sorted_migrations():
            if migration.version in versions:
                duplicates.append(migration.version)
            else:
                versions.append(migration.version)
        
        return duplicates
    
    def check_version_gaps(self) -> List[str]:
        """检查版本号是否有间隔（基于时间戳）"""
        sorted_migrations = self.get_sorted_migrations()
        if len(sorted_migrations) <= 1:
            return []
        
        gaps = []
        for i in range(1, len(sorted_migrations)):
            prev = sorted_migrations[i-1]
            curr = sorted_migrations[i]
            
            try:
                prev_time = datetime.strptime(prev.version, '%Y%m%d%H%M%S')
                curr_time = datetime.strptime(curr.version, '%Y%m%d%H%M%S')
                
                # 如果时间戳是递减的
                if curr_time <= prev_time:
                    gaps.append(
                        f"版本顺序异常: {curr.version} ({curr.filename}) "
                        f"在 {prev.version} ({prev.filename}) 之前"
                    )
            except ValueError:
                continue
        
        return gaps
    
    def get_migration_by_filename(self, filename: str) -> Optional[MigrationScript]:
        """通过文件名获取迁移脚本"""
        for migration in self.migrations.values():
            if migration.filename == filename:
                return migration
        return None
