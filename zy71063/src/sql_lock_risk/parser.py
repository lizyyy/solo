import re
import os
from typing import List, Tuple, Optional
import sqlparse
from sqlparse.sql import Statement, IdentifierList, Identifier, Token
from sqlparse.tokens import Keyword, DDL, Name, Whitespace

from .models import AlterStatement, AlterType, MigrationFile


class SQLParser:
    def __init__(self):
        self.alter_type_patterns = {
            AlterType.ADD_COLUMN: r'ADD\s+(COLUMN\s+)?`?(\w+)`?',
            AlterType.DROP_COLUMN: r'DROP\s+(COLUMN\s+)?`?(\w+)`?',
            AlterType.MODIFY_COLUMN: r'MODIFY\s+(COLUMN\s+)?`?(\w+)`?',
            AlterType.ADD_INDEX: r'ADD\s+(UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?(INDEX|KEY)',
            AlterType.DROP_INDEX: r'DROP\s+(INDEX|KEY)\s+`?(\w+)`?',
            AlterType.ADD_CONSTRAINT: r'ADD\s+(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY)',
            AlterType.DROP_CONSTRAINT: r'DROP\s+(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY)',
            AlterType.RENAME_TABLE: r'RENAME\s+(TO|AS)\s+`?(\w+)`?',
            AlterType.RENAME_COLUMN: r'RENAME\s+(COLUMN\s+)?`?(\w+)`?\s+TO\s+`?(\w+)`?',
            AlterType.ALTER_DEFAULT: r'ALTER\s+(COLUMN\s+)?`?(\w+)`?\s+(SET|DROP)\s+DEFAULT',
        }

    def parse_file(self, file_path: str) -> MigrationFile:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return self.parse_content(content, file_path)

    def parse_content(self, content: str, file_path: str = "") -> MigrationFile:
        statements = sqlparse.parse(content)
        alter_statements: List[AlterStatement] = []
        is_wrapped_in_transaction = self._detect_transaction_wrap(content)
        has_rollback_script, rollback_path = self._detect_rollback_script(file_path)

        for stmt in statements:
            stmt_str = str(stmt).strip()
            if not stmt_str:
                continue
            
            if self._is_alter_statement(stmt):
                alter_stmt = self._parse_alter_statement(stmt, stmt_str)
                if alter_stmt:
                    alter_statements.append(alter_stmt)

        return MigrationFile(
            file_path=file_path,
            statements=alter_statements,
            is_wrapped_in_transaction=is_wrapped_in_transaction,
            has_rollback_script=has_rollback_script,
            rollback_path=rollback_path
        )

    def _detect_transaction_wrap(self, content: str) -> bool:
        content_upper = content.upper()
        has_start = bool(re.search(r'\bSTART\s+TRANSACTION\b', content_upper)) or \
                     bool(re.search(r'\bBEGIN\b', content_upper))
        has_commit = bool(re.search(r'\bCOMMIT\b', content_upper))
        return has_start and has_commit

    def _detect_rollback_script(self, file_path: str) -> Tuple[bool, Optional[str]]:
        if not file_path:
            return False, None
        
        dir_name = os.path.dirname(file_path)
        base_name = os.path.basename(file_path)
        name_without_ext, ext = os.path.splitext(base_name)
        
        rollback_patterns = [
            f"{name_without_ext}_rollback{ext}",
            f"rollback_{name_without_ext}{ext}",
            f"down_{name_without_ext}{ext}",
            f"{name_without_ext}_down{ext}",
            f"revert_{name_without_ext}{ext}",
        ]
        
        for pattern in rollback_patterns:
            candidate = os.path.join(dir_name, pattern)
            if os.path.exists(candidate):
                return True, candidate
        
        return False, None

    def _is_alter_statement(self, stmt: Statement) -> bool:
        for token in stmt.tokens:
            if token.ttype and 'ALTER' in token.value.upper():
                if 'DDL' in str(token.ttype) or token.ttype is Keyword or token.ttype is DDL:
                    return True
        return False

    def _parse_alter_statement(self, stmt: Statement, raw_sql: str) -> Optional[AlterStatement]:
        table_name = self._extract_table_name(stmt)
        if not table_name:
            return None

        alter_type = self._detect_alter_type(raw_sql)
        is_concurrent = 'CONCURRENT' in raw_sql.upper()
        is_online = 'ONLINE' in raw_sql.upper()
        uses_algorithm_inplace = bool(re.search(r'ALGORITHM\s*=\s*INPLACE', raw_sql, re.IGNORECASE))
        uses_lock_none = bool(re.search(r'LOCK\s*=\s*NONE', raw_sql, re.IGNORECASE))

        column_name = self._extract_column_name(raw_sql, alter_type)
        index_name = self._extract_index_name(raw_sql, alter_type)
        is_nullable = self._extract_nullable(raw_sql)
        has_default = self._extract_has_default(raw_sql)
        column_type = self._extract_column_type(raw_sql, alter_type)

        return AlterStatement(
            raw_sql=raw_sql,
            table_name=table_name,
            alter_type=alter_type,
            is_concurrent=is_concurrent,
            is_online=is_online,
            uses_algorithm_inplace=uses_algorithm_inplace,
            uses_lock_none=uses_lock_none,
            column_name=column_name,
            index_name=index_name,
            is_nullable=is_nullable,
            has_default=has_default,
            column_type=column_type
        )

    def _extract_table_name(self, stmt: Statement) -> Optional[str]:
        found_alter = False
        for token in stmt.tokens:
            if token.ttype in (Keyword, DDL) and 'ALTER' in token.value.upper():
                found_alter = True
                continue
            if found_alter:
                if isinstance(token, Identifier):
                    return token.get_name()
                if token.ttype is Name:
                    return token.value.strip('`')
                if isinstance(token, IdentifierList):
                    for ident in token.get_identifiers():
                        return ident.get_name()
        return None

    def _detect_alter_type(self, sql: str) -> AlterType:
        sql_upper = sql.upper()
        
        detection_order = [
            AlterType.ADD_INDEX,
            AlterType.DROP_INDEX,
            AlterType.ADD_CONSTRAINT,
            AlterType.DROP_CONSTRAINT,
            AlterType.RENAME_TABLE,
            AlterType.RENAME_COLUMN,
            AlterType.ALTER_DEFAULT,
            AlterType.ADD_COLUMN,
            AlterType.DROP_COLUMN,
            AlterType.MODIFY_COLUMN,
        ]
        
        for alter_type in detection_order:
            pattern = self.alter_type_patterns.get(alter_type)
            if pattern and re.search(pattern, sql_upper):
                return alter_type
        
        return AlterType.UNKNOWN

    def _extract_column_name(self, sql: str, alter_type: AlterType) -> Optional[str]:
        patterns = [
            r'ADD\s+(?:COLUMN\s+)?`?(\w+)`?',
            r'DROP\s+(?:COLUMN\s+)?`?(\w+)`?',
            r'MODIFY\s+(?:COLUMN\s+)?`?(\w+)`?',
            r'ALTER\s+(?:COLUMN\s+)?`?(\w+)`?',
            r'RENAME\s+(?:COLUMN\s+)?`?(\w+)`?\s+TO',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, sql, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None

    def _extract_index_name(self, sql: str, alter_type: AlterType) -> Optional[str]:
        patterns = [
            r'ADD\s+(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?(?:INDEX|KEY)\s+`?(\w+)`?',
            r'DROP\s+(?:INDEX|KEY)\s+`?(\w+)`?',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, sql, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None

    def _extract_nullable(self, sql: str) -> Optional[bool]:
        if re.search(r'NOT\s+NULL', sql, re.IGNORECASE):
            return False
        if re.search(r'(?<!NOT\s)NULL', sql, re.IGNORECASE):
            return True
        return None

    def _extract_has_default(self, sql: str) -> Optional[bool]:
        has_default = bool(re.search(r'DEFAULT\s+', sql, re.IGNORECASE))
        drop_default = bool(re.search(r'DROP\s+DEFAULT', sql, re.IGNORECASE))
        if drop_default:
            return False
        if has_default:
            return True
        return None

    def _extract_column_type(self, sql: str, alter_type: AlterType) -> Optional[str]:
        if alter_type not in (AlterType.ADD_COLUMN, AlterType.MODIFY_COLUMN):
            return None
        
        match = re.search(
            r'(?:ADD|MODIFY)\s+(?:COLUMN\s+)?`?\w+`?\s+((?:TINYINT|SMALLINT|MEDIUMINT|INT|BIGINT|DECIMAL|FLOAT|DOUBLE|'
            r'CHAR|VARCHAR|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|BINARY|VARBINARY|BLOB|TINYBLOB|MEDIUMBLOB|LONGBLOB|'
            r'DATE|TIME|DATETIME|TIMESTAMP|YEAR|ENUM|SET|JSON|BOOLEAN|BOOL)[^,\s]*)',
            sql,
            re.IGNORECASE
        )
        if match:
            return match.group(1).upper()
        
        return None
