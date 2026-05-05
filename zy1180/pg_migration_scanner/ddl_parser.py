"""DDL 解析器 - 解析 PostgreSQL DDL 语句并提取关键信息。"""

import re
from typing import Optional

import sqlglot
from sqlglot import exp

from .models import DDLType, DDLOperation, LockMode


HIGH_RISK_DDL_TYPES = {
    DDLType.DROP_TABLE,
    DDLType.TRUNCATE,
    DDLType.ALTER_COLUMN,
    DDLType.DROP_COLUMN,
    DDLType.ADD_CONSTRAINT,
    DDLType.DROP_CONSTRAINT,
    DDLType.RENAME,
}

ALTERNATIVE_LOCK_MODES = {
    DDLType.CREATE_INDEX: LockMode.SHARE,
    DDLType.DROP_INDEX: LockMode.ACCESS_EXCLUSIVE,
    DDLType.ALTER_TABLE: LockMode.ACCESS_EXCLUSIVE,
    DDLType.DROP_TABLE: LockMode.ACCESS_EXCLUSIVE,
    DDLType.TRUNCATE: LockMode.ACCESS_EXCLUSIVE,
    DDLType.CREATE_TABLE: LockMode.ACCESS_EXCLUSIVE,
    DDLType.ALTER_COLUMN: LockMode.ACCESS_EXCLUSIVE,
    DDLType.ADD_COLUMN: LockMode.ACCESS_EXCLUSIVE,
    DDLType.DROP_COLUMN: LockMode.ACCESS_EXCLUSIVE,
    DDLType.ADD_CONSTRAINT: LockMode.ACCESS_EXCLUSIVE,
    DDLType.DROP_CONSTRAINT: LockMode.ACCESS_EXCLUSIVE,
    DDLType.RENAME: LockMode.ACCESS_EXCLUSIVE,
}


class DDLParser:
    """PostgreSQL DDL 解析器。"""

    def __init__(self) -> None:
        self._concurrently_pattern = re.compile(
            r"\bCONCURRENTLY\b", re.IGNORECASE
        )
        self._if_not_exists_pattern = re.compile(
            r"\bIF\s+NOT\s+EXISTS\b", re.IGNORECASE
        )
        self._if_exists_pattern = re.compile(
            r"\bIF\s+EXISTS\b", re.IGNORECASE
        )

    def parse(self, sql: str) -> list[DDLOperation]:
        """解析 SQL 语句，返回 DDL 操作列表。

        Args:
            sql: 原始 SQL 语句，可能包含多条语句

        Returns:
            解析后的 DDL 操作列表
        """
        operations: list[DDLOperation] = []

        statements = sqlglot.parse(sql, read="postgres")

        for stmt in statements:
            if stmt is None:
                continue

            operation = self._parse_statement(stmt, sql)
            if operation:
                operations.append(operation)

        if not operations and self._contains_ddl(sql):
            operations.extend(self._fallback_parse(sql))

        return operations

    def _parse_statement(
        self, stmt: exp.Expression, raw_sql: str
    ) -> Optional[DDLOperation]:
        """解析单个 SQL 语句。"""
        if isinstance(stmt, exp.Create):
            return self._parse_create(stmt, raw_sql)
        elif isinstance(stmt, exp.Drop):
            return self._parse_drop(stmt, raw_sql)
        elif isinstance(stmt, exp.Alter):
            return self._parse_alter(stmt, raw_sql)
        elif isinstance(stmt, exp.Truncate):
            return self._parse_truncate(stmt, raw_sql)
        elif isinstance(stmt, exp.Rename):
            return self._parse_rename(stmt, raw_sql)
        elif isinstance(stmt, exp.Comment):
            return self._parse_comment(stmt, raw_sql)
        elif isinstance(stmt, exp.Grant):
            return self._parse_grant(stmt, raw_sql)
        elif isinstance(stmt, exp.Revoke):
            return self._parse_revoke(stmt, raw_sql)

        return None

    def _parse_create(self, stmt: exp.Create, raw_sql: str) -> Optional[DDLOperation]:
        """解析 CREATE 语句。"""
        this = stmt.this

        if isinstance(this, exp.Table):
            return DDLOperation(
                raw_sql=raw_sql,
                ddl_type=DDLType.CREATE_TABLE,
                table_name=self._get_table_name(this),
                schema_name=self._get_schema_name(this),
                lock_mode=LockMode.ACCESS_EXCLUSIVE,
                is_transactional=True,
                description=f"创建表 {self._get_table_name(this)}",
            )
        elif isinstance(this, exp.Index):
            index_name = str(this.name) if this.name else ""
            table_name = self._get_table_from_index(this)
            is_concurrently = bool(self._concurrently_pattern.search(raw_sql))

            lock_mode = LockMode.SHARE
            if is_concurrently:
                lock_mode = LockMode.SHARE_UPDATE_EXCLUSIVE

            return DDLOperation(
                raw_sql=raw_sql,
                ddl_type=DDLType.CREATE_INDEX,
                table_name=table_name,
                index_name=index_name,
                is_concurrently=is_concurrently,
                lock_mode=lock_mode,
                is_transactional=not is_concurrently,
                description=f"{'并发' if is_concurrently else ''}创建索引 {index_name} ON {table_name}",
            )
        elif isinstance(this, exp.View):
            return DDLOperation(
                raw_sql=raw_sql,
                ddl_type=DDLType.CREATE_VIEW,
                table_name=self._get_table_name(this),
                schema_name=self._get_schema_name(this),
                lock_mode=LockMode.ACCESS_EXCLUSIVE,
                is_transactional=True,
                description=f"创建视图 {self._get_table_name(this)}",
            )

        return None

    def _parse_drop(self, stmt: exp.Drop, raw_sql: str) -> Optional[DDLOperation]:
        """解析 DROP 语句。"""
        this = stmt.this
        kind = stmt.args.get("kind", "").upper() if "kind" in stmt.args else ""

        if isinstance(this, exp.Table) or kind == "TABLE":
            return DDLOperation(
                raw_sql=raw_sql,
                ddl_type=DDLType.DROP_TABLE,
                table_name=self._get_table_name(this) if isinstance(this, exp.Table) else str(this),
                schema_name=self._get_schema_name(this) if isinstance(this, exp.Table) else None,
                lock_mode=LockMode.ACCESS_EXCLUSIVE,
                is_transactional=True,
                description=f"删除表 {self._get_table_name(this) if isinstance(this, exp.Table) else str(this)}",
            )
        elif isinstance(this, exp.Index) or kind == "INDEX":
            index_name = str(this.name) if isinstance(this, exp.Index) and this.name else str(this)
            is_concurrently = bool(self._concurrently_pattern.search(raw_sql))

            return DDLOperation(
                raw_sql=raw_sql,
                ddl_type=DDLType.DROP_INDEX,
                table_name="",
                index_name=index_name,
                is_concurrently=is_concurrently,
                lock_mode=LockMode.ACCESS_EXCLUSIVE,
                is_transactional=not is_concurrently,
                description=f"{'并发' if is_concurrently else ''}删除索引 {index_name}",
            )
        elif isinstance(this, exp.View) or kind == "VIEW":
            return DDLOperation(
                raw_sql=raw_sql,
                ddl_type=DDLType.DROP_VIEW,
                table_name=self._get_table_name(this) if isinstance(this, exp.View) else str(this),
                lock_mode=LockMode.ACCESS_EXCLUSIVE,
                is_transactional=True,
                description=f"删除视图",
            )

        return None

    def _parse_alter(self, stmt: exp.Alter, raw_sql: str) -> Optional[DDLOperation]:
        """解析 ALTER 语句。"""
        this = stmt.this
        actions = stmt.args.get("actions", [])

        table_name = self._get_table_name(this) if this else ""
        schema_name = self._get_schema_name(this) if this else None

        for action in actions:
            if isinstance(action, exp.Drop):
                kind = action.args.get("kind", "").upper() if "kind" in action.args else ""
                if kind == "COLUMN" or isinstance(action.this, exp.Column):
                    col_name = str(action.this)
                    return DDLOperation(
                        raw_sql=raw_sql,
                        ddl_type=DDLType.DROP_COLUMN,
                        table_name=table_name,
                        schema_name=schema_name,
                        lock_mode=LockMode.ACCESS_EXCLUSIVE,
                        is_transactional=True,
                        description=f"删除列 {table_name}.{col_name}",
                    )
            elif isinstance(action, exp.ColumnDef):
                return DDLOperation(
                    raw_sql=raw_sql,
                    ddl_type=DDLType.ADD_COLUMN,
                    table_name=table_name,
                    schema_name=schema_name,
                    lock_mode=LockMode.ACCESS_EXCLUSIVE,
                    is_transactional=True,
                    description=f"添加列到表 {table_name}",
                )
            elif isinstance(action, exp.AlterColumn):
                col_name = str(action.this) if action.this else ""
                return DDLOperation(
                    raw_sql=raw_sql,
                    ddl_type=DDLType.ALTER_COLUMN,
                    table_name=table_name,
                    schema_name=schema_name,
                    lock_mode=LockMode.ACCESS_EXCLUSIVE,
                    is_transactional=True,
                    description=f"修改列 {table_name}.{col_name}",
                )
            elif isinstance(action, exp.AddConstraint):
                constraint = action.this
                constraint_name = str(constraint.name) if constraint and constraint.name else ""
                return DDLOperation(
                    raw_sql=raw_sql,
                    ddl_type=DDLType.ADD_CONSTRAINT,
                    table_name=table_name,
                    schema_name=schema_name,
                    lock_mode=LockMode.ACCESS_EXCLUSIVE,
                    is_transactional=True,
                    description=f"添加约束 {constraint_name} 到表 {table_name}",
                )
            elif isinstance(action, exp.Drop):
                kind = action.args.get("kind", "").upper() if "kind" in action.args else ""
                if kind == "CONSTRAINT":
                    constraint_name = str(action.this)
                    return DDLOperation(
                        raw_sql=raw_sql,
                        ddl_type=DDLType.DROP_CONSTRAINT,
                        table_name=table_name,
                        schema_name=schema_name,
                        lock_mode=LockMode.ACCESS_EXCLUSIVE,
                        is_transactional=True,
                        description=f"删除约束 {constraint_name} 从表 {table_name}",
                    )
            elif isinstance(action, exp.Rename):
                return DDLOperation(
                    raw_sql=raw_sql,
                    ddl_type=DDLType.RENAME,
                    table_name=table_name,
                    schema_name=schema_name,
                    lock_mode=LockMode.ACCESS_EXCLUSIVE,
                    is_transactional=True,
                    description=f"重命名表/列 {table_name}",
                )

        return DDLOperation(
            raw_sql=raw_sql,
            ddl_type=DDLType.ALTER_TABLE,
            table_name=table_name,
            schema_name=schema_name,
            lock_mode=LockMode.ACCESS_EXCLUSIVE,
            is_transactional=True,
            description=f"修改表 {table_name}",
        )

    def _parse_truncate(self, stmt: exp.Truncate, raw_sql: str) -> Optional[DDLOperation]:
        """解析 TRUNCATE 语句。"""
        tables = stmt.args.get("tables", [])
        table_names = ", ".join(self._get_table_name(t) for t in tables) if tables else ""

        return DDLOperation(
            raw_sql=raw_sql,
            ddl_type=DDLType.TRUNCATE,
            table_name=table_names,
            lock_mode=LockMode.ACCESS_EXCLUSIVE,
            is_transactional=True,
            description=f"清空表 {table_names}",
        )

    def _parse_rename(self, stmt: exp.Rename, raw_sql: str) -> Optional[DDLOperation]:
        """解析 RENAME 语句。"""
        return DDLOperation(
            raw_sql=raw_sql,
            ddl_type=DDLType.RENAME,
            table_name=str(stmt.this) if stmt.this else "",
            lock_mode=LockMode.ACCESS_EXCLUSIVE,
            is_transactional=True,
            description=f"重命名对象",
        )

    def _parse_comment(self, stmt: exp.Comment, raw_sql: str) -> Optional[DDLOperation]:
        """解析 COMMENT 语句。"""
        return DDLOperation(
            raw_sql=raw_sql,
            ddl_type=DDLType.COMMENT,
            table_name="",
            lock_mode=LockMode.ACCESS_SHARE,
            is_transactional=True,
            description="添加注释",
        )

    def _parse_grant(self, stmt: exp.Grant, raw_sql: str) -> Optional[DDLOperation]:
        """解析 GRANT 语句。"""
        return DDLOperation(
            raw_sql=raw_sql,
            ddl_type=DDLType.GRANT,
            table_name="",
            lock_mode=LockMode.ACCESS_SHARE,
            is_transactional=True,
            description="授权",
        )

    def _parse_revoke(self, stmt: exp.Revoke, raw_sql: str) -> Optional[DDLOperation]:
        """解析 REVOKE 语句。"""
        return DDLOperation(
            raw_sql=raw_sql,
            ddl_type=DDLType.REVOKE,
            table_name="",
            lock_mode=LockMode.ACCESS_SHARE,
            is_transactional=True,
            description="撤销权限",
        )

    def _get_table_name(self, expr: Optional[exp.Expression]) -> str:
        """从表达式中获取表名。"""
        if expr is None:
            return ""
        if isinstance(expr, exp.Table):
            return str(expr.name)
        if isinstance(expr, exp.TableAlias):
            return str(expr.this)
        return str(expr)

    def _get_schema_name(self, expr: Optional[exp.Expression]) -> Optional[str]:
        """从表达式中获取 schema 名。"""
        if expr is None:
            return None
        if isinstance(expr, exp.Table) and expr.db:
            return str(expr.db)
        return None

    def _get_table_from_index(self, index: exp.Index) -> str:
        """从索引表达式中获取表名。"""
        table = index.args.get("table")
        if table:
            return self._get_table_name(table)
        return ""

    def _contains_ddl(self, sql: str) -> bool:
        """检查 SQL 是否包含 DDL 语句（备用检查）。"""
        ddl_keywords = [
            r"\bCREATE\s+(TABLE|INDEX|VIEW|CONSTRAINT)\b",
            r"\bALTER\s+TABLE\b",
            r"\bDROP\s+(TABLE|INDEX|VIEW|COLUMN|CONSTRAINT)\b",
            r"\bTRUNCATE\s+TABLE\b",
            r"\bRENAME\s+(TABLE|COLUMN)\b",
            r"\bCOMMENT\s+ON\b",
        ]
        for pattern in ddl_keywords:
            if re.search(pattern, sql, re.IGNORECASE):
                return True
        return False

    def _fallback_parse(self, sql: str) -> list[DDLOperation]:
        """备用解析方法，使用正则表达式。"""
        operations: list[DDLOperation] = []

        create_index_match = re.search(
            r"\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(\w+)",
            sql,
            re.IGNORECASE,
        )
        if create_index_match:
            index_name = create_index_match.group(1)
            table_name = create_index_match.group(2)
            is_concurrently = bool(
                re.search(r"\bCONCURRENTLY\b", sql, re.IGNORECASE)
            )
            operations.append(
                DDLOperation(
                    raw_sql=sql,
                    ddl_type=DDLType.CREATE_INDEX,
                    table_name=table_name,
                    index_name=index_name,
                    is_concurrently=is_concurrently,
                    lock_mode=(
                        LockMode.SHARE_UPDATE_EXCLUSIVE
                        if is_concurrently
                        else LockMode.SHARE
                    ),
                    is_transactional=not is_concurrently,
                    description=f"{'并发' if is_concurrently else ''}创建索引 {index_name} ON {table_name}",
                )
            )

        alter_table_match = re.search(
            r"\bALTER\s+TABLE\s+(?:ONLY\s+)?(\w+(?:\.\w+)?)\s+(.+)",
            sql,
            re.IGNORECASE | re.DOTALL,
        )
        if alter_table_match and not operations:
            table_name = alter_table_match.group(1)
            action = alter_table_match.group(2)

            ddl_type = DDLType.ALTER_TABLE
            description = f"修改表 {table_name}"

            if re.search(r"\bADD\s+(?:COLUMN\s+)?(\w+)\s+", action, re.IGNORECASE):
                ddl_type = DDLType.ADD_COLUMN
                col_name = re.search(
                    r"\bADD\s+(?:COLUMN\s+)?(\w+)\s+", action, re.IGNORECASE
                )
                description = f"添加列 {table_name}.{col_name.group(1) if col_name else ''}"
            elif re.search(r"\bDROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?(\w+)", action, re.IGNORECASE):
                ddl_type = DDLType.DROP_COLUMN
                col_name = re.search(
                    r"\bDROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?(\w+)", action, re.IGNORECASE
                )
                description = f"删除列 {table_name}.{col_name.group(1) if col_name else ''}"
            elif re.search(r"\bALTER\s+(?:COLUMN\s+)?(\w+)", action, re.IGNORECASE):
                ddl_type = DDLType.ALTER_COLUMN
                col_name = re.search(
                    r"\bALTER\s+(?:COLUMN\s+)?(\w+)", action, re.IGNORECASE
                )
                description = f"修改列 {table_name}.{col_name.group(1) if col_name else ''}"
            elif re.search(r"\bADD\s+(?:CONSTRAINT\s+)?(\w+)?", action, re.IGNORECASE):
                ddl_type = DDLType.ADD_CONSTRAINT
                constraint_name = re.search(
                    r"\bADD\s+(?:CONSTRAINT\s+)?(\w+)?", action, re.IGNORECASE
                )
                description = f"添加约束 {constraint_name.group(1) if constraint_name and constraint_name.group(1) else ''} 到表 {table_name}"

            operations.append(
                DDLOperation(
                    raw_sql=sql,
                    ddl_type=ddl_type,
                    table_name=table_name,
                    lock_mode=LockMode.ACCESS_EXCLUSIVE,
                    is_transactional=True,
                    description=description,
                )
            )

        return operations
