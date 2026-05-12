"""
风险分析模块

分析 SQL 语句，识别数据库迁移风险。
"""

import re
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from enum import Enum
import hashlib


class RiskLevel(str, Enum):
    """风险级别"""
    BLOCKER = 'blocker'  # 阻断，必须修复
    WARNING = 'warning'  # 警告，建议修复
    INFO = 'info'  # 信息，无需修复


class RiskType(str, Enum):
    """风险类型"""
    NO_ROLLBACK = 'no_rollback'  # 无回滚脚本
    LARGE_TABLE_NONCONCURRENT_INDEX = 'large_table_nonconcurrent_index'  # 大表加非并发索引
    DIRECT_COLUMN_DROP = 'direct_column_drop'  # 直接删除列
    DEFAULT_VALUE_REWRITE = 'default_value_rewrite'  # 默认值导致全表重写
    DUPLICATE_VERSION = 'duplicate_version'  # 重复迁移编号
    VERSION_ORDER_ERROR = 'version_order_error'  # 脚本顺序错乱
    SQL_PARSE_ERROR = 'sql_parse_error'  # SQL 解析失败
    LARGE_TABLE_ALTER = 'large_table_alter'  # 大表 ALTER 操作


@dataclass
class Risk:
    """风险项"""
    risk_type: RiskType
    level: RiskLevel
    description: str
    script_version: str
    script_filename: str
    service: str
    sql_statement: Optional[str] = None
    table_name: Optional[str] = None
    details: str = ''
    hash: str = ''
    
    def compute_hash(self) -> str:
        """计算风险的唯一哈希，用于稳定比较"""
        content = f"{self.risk_type}|{self.script_version}|{self.table_name}|{self.sql_statement or ''}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def __post_init__(self):
        if not self.hash:
            self.hash = self.compute_hash()


@dataclass
class AnalysisResult:
    """分析结果"""
    risks: List[Risk] = field(default_factory=list)
    parse_errors: List[str] = field(default_factory=list)
    
    @property
    def blockers(self) -> List[Risk]:
        """获取阻断级风险"""
        return [r for r in self.risks if r.level == RiskLevel.BLOCKER]
    
    @property
    def warnings(self) -> List[Risk]:
        """获取警告级风险"""
        return [r for r in self.risks if r.level == RiskLevel.WARNING]
    
    @property
    def infos(self) -> List[Risk]:
        """获取信息级风险"""
        return [r for r in self.risks if r.level == RiskLevel.INFO]
    
    def has_blockers(self) -> bool:
        """是否存在阻断级风险"""
        return len(self.blockers) > 0
    
    def get_risks_by_service(self) -> Dict[str, List[Risk]]:
        """按服务分组风险"""
        by_service: Dict[str, List[Risk]] = {}
        for risk in self.risks:
            if risk.service not in by_service:
                by_service[risk.service] = []
            by_service[risk.service].append(risk)
        return by_service


class RiskAnalyzer:
    """风险分析器"""
    
    # 匹配 ALTER TABLE 的表名
    ALTER_TABLE_PATTERN = re.compile(
        r'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w\.]+)',
        re.IGNORECASE
    )
    
    # 匹配 CREATE INDEX 的表名（在 ON 后面）
    CREATE_INDEX_TABLE_PATTERN = re.compile(
        r'ON\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([\w\.]+)',
        re.IGNORECASE
    )
    
    # 匹配 DROP INDEX 的表名（PostgreSQL: DROP INDEX [CONCURRENTLY] [IF EXISTS] name; 没有表名）
    # MySQL: ALTER TABLE ... DROP INDEX, 已经被 ALTER_TABLE_PATTERN 覆盖
    
    # 匹配添加列的语句
    ADD_COLUMN_PATTERN = re.compile(
        r'ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?[\w_]+\s+[\w_\(\)]+(?:\s+NOT\s+NULL)?\s+DEFAULT\s+',
        re.IGNORECASE
    )
    
    # 匹配修改列默认值的语句（MySQL 风格）
    ALTER_COLUMN_DEFAULT_PATTERN = re.compile(
        r'ALTER\s+(?:COLUMN\s+)?[\w_]+\s+SET\s+DEFAULT|MODIFY\s+(?:COLUMN\s+)?[\w_]+\s+[\w_\(\)]+\s+DEFAULT',
        re.IGNORECASE
    )
    
    # 匹配删除列的语句
    DROP_COLUMN_PATTERN = re.compile(
        r'DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?[\w_]+',
        re.IGNORECASE
    )
    
    # 匹配 CREATE INDEX CONCURRENTLY
    CONCURRENT_INDEX_PATTERN = re.compile(
        r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY',
        re.IGNORECASE
    )
    
    # 匹配 CREATE INDEX（非并发）
    NONCONCURRENT_INDEX_PATTERN = re.compile(
        r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY)',
        re.IGNORECASE
    )
    
    def __init__(self, config_manager):
        self.config_manager = config_manager
    
    def analyze_migrations(self, parser) -> AnalysisResult:
        """分析所有迁移脚本"""
        result = AnalysisResult()
        
        migrations = parser.get_sorted_migrations()
        
        # 检查重复版本
        duplicates = parser.check_duplicate_versions()
        for version in duplicates:
            migration = parser.migrations.get(version)
            if migration:
                risk = Risk(
                    risk_type=RiskType.DUPLICATE_VERSION,
                    level=RiskLevel.BLOCKER,
                    description=f"重复的迁移编号: {version}",
                    script_version=version,
                    script_filename=migration.filename,
                    service=migration.service,
                    details="同一时间戳被用于多个迁移脚本"
                )
                result.risks.append(risk)
        
        # 检查版本顺序
        order_errors = parser.check_version_gaps()
        for error in order_errors:
            # 从错误信息中提取版本号
            version_match = re.search(r'(\d{14})', error)
            version = version_match.group(1) if version_match else 'unknown'
            
            risk = Risk(
                risk_type=RiskType.VERSION_ORDER_ERROR,
                level=RiskLevel.BLOCKER,
                description="脚本顺序错乱",
                script_version=version,
                script_filename=error,
                service='unknown',
                details=error
            )
            result.risks.append(risk)
        
        # 分析每个迁移脚本
        for migration in migrations:
            # 确定服务
            migration.service = self._determine_service(migration)
            
            # 检查是否有回滚脚本
            if not migration.has_rollback:
                risk = Risk(
                    risk_type=RiskType.NO_ROLLBACK,
                    level=RiskLevel.WARNING,
                    description="缺少回滚脚本",
                    script_version=migration.version,
                    script_filename=migration.filename,
                    service=migration.service,
                    details="建议为每个迁移脚本提供对应的回滚脚本"
                )
                result.risks.append(risk)
            
            # 检查解析错误
            if migration.parse_errors:
                for error in migration.parse_errors:
                    risk = Risk(
                        risk_type=RiskType.SQL_PARSE_ERROR,
                        level=RiskLevel.BLOCKER,
                        description="SQL 解析失败",
                        script_version=migration.version,
                        script_filename=migration.filename,
                        service=migration.service,
                        details=error
                    )
                    result.risks.append(risk)
                result.parse_errors.extend(migration.parse_errors)
            
            # 分析 SQL 语句
            for statement in migration.statements:
                self._analyze_statement(statement, migration, result)
        
        return result
    
    def _determine_service(self, migration) -> str:
        """根据脚本内容或表名确定服务"""
        # 首先从内容中查找表名，然后确定服务
        for statement in migration.statements:
            table_names = self._extract_table_names(statement)
            for table_name in table_names:
                service = self.config_manager.get_table_service(table_name)
                if service != 'unknown':
                    return service
        return 'unknown'
    
    def _extract_table_names(self, statement: str) -> List[str]:
        """从 SQL 语句中提取表名"""
        tables = []
        
        # 检查 ALTER TABLE
        alter_matches = self.ALTER_TABLE_PATTERN.findall(statement)
        for match in alter_matches:
            if '.' in match:
                table = match.split('.')[-1]
            else:
                table = match
            tables.append(table)
        
        # 检查 CREATE INDEX ... ON table
        index_matches = self.CREATE_INDEX_TABLE_PATTERN.findall(statement)
        for match in index_matches:
            if '.' in match:
                table = match.split('.')[-1]
            else:
                table = match
            tables.append(table)
        
        # 去重
        return list(set(tables))
    
    def _analyze_statement(
        self, 
        statement: str, 
        migration, 
        result: AnalysisResult
    ) -> None:
        """分析单个 SQL 语句"""
        table_names = self._extract_table_names(statement)
        service = migration.service
        
        for table_name in table_names:
            is_large = self.config_manager.is_large_table(table_name)
            
            # 1. 检查大表加非并发索引
            if is_large and self.NONCONCURRENT_INDEX_PATTERN.search(statement):
                risk = Risk(
                    risk_type=RiskType.LARGE_TABLE_NONCONCURRENT_INDEX,
                    level=RiskLevel.BLOCKER,
                    description=f"大表 {table_name} 使用非并发方式创建索引",
                    script_version=migration.version,
                    script_filename=migration.filename,
                    service=service,
                    sql_statement=statement[:200],
                    table_name=table_name,
                    details="大表创建索引应使用 CREATE INDEX CONCURRENTLY 以避免锁表"
                )
                result.risks.append(risk)
            
            # 2. 检查直接删除列
            if self.DROP_COLUMN_PATTERN.search(statement) and 'ALTER TABLE' in statement.upper():
                risk = Risk(
                    risk_type=RiskType.DIRECT_COLUMN_DROP,
                    level=RiskLevel.WARNING,
                    description=f"直接删除表 {table_name} 的列",
                    script_version=migration.version,
                    script_filename=migration.filename,
                    service=service,
                    sql_statement=statement[:200],
                    table_name=table_name,
                    details="删除列是不可逆操作，建议先将列标记为废弃，后续再删除"
                )
                result.risks.append(risk)
            
            # 3. 检查默认值导致全表重写
            # PostgreSQL: ADD COLUMN ... DEFAULT 会重写表（旧版本）
            # MySQL: ALTER TABLE ... ALTER COLUMN ... SET DEFAULT 不需要重写
            # 但 ADD COLUMN ... DEFAULT 在某些情况下需要
            if self.ADD_COLUMN_PATTERN.search(statement) and is_large:
                risk = Risk(
                    risk_type=RiskType.DEFAULT_VALUE_REWRITE,
                    level=RiskLevel.WARNING,
                    description=f"大表 {table_name} 添加带默认值的列",
                    script_version=migration.version,
                    script_filename=migration.filename,
                    service=service,
                    sql_statement=statement[:200],
                    table_name=table_name,
                    details="添加带默认值的列可能导致全表重写，建议先添加可空列，再回填数据，最后设置默认值"
                )
                result.risks.append(risk)
            
            # 4. 大表 ALTER 操作警告
            if is_large and 'ALTER TABLE' in statement.upper():
                # 排除一些相对安全的操作
                if not (self.CONCURRENT_INDEX_PATTERN.search(statement) or 
                        'RENAME' in statement.upper()):
                    risk = Risk(
                        risk_type=RiskType.LARGE_TABLE_ALTER,
                        level=RiskLevel.WARNING,
                        description=f"大表 {table_name} 的 ALTER 操作",
                        script_version=migration.version,
                        script_filename=migration.filename,
                        service=service,
                        sql_statement=statement[:200],
                        table_name=table_name,
                        details="大表的 ALTER 操作可能导致长时间锁表或性能问题"
                    )
                    result.risks.append(risk)
