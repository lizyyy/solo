import sqlglot
import re
import uuid
from datetime import datetime
from typing import List, Tuple, Dict, Any
from .models import (
    SQLSnippet, SQLType, TargetTable, RiskScore, RiskLevel,
    ProcessingTrace
)


class SQLAuditEngine:
    TABLE_SIZE_ESTIMATES = {
        "users": 1000000,
        "orders": 5000000,
        "order_items": 20000000,
        "products": 500000,
        "logs": 100000000,
    }

    def parse_sql(self, sql_content: str) -> Tuple[SQLType, List[TargetTable], List[str], List[str]]:
        errors = []
        warnings = []
        tables = []
        sql_type = SQLType.UNKNOWN

        try:
            parsed = sqlglot.parse_one(sql_content)
            sql_type = self._get_sql_type(parsed)
            tables = self._extract_tables(parsed)
            warnings.extend(self._check_syntax_warnings(parsed, sql_type))
        except Exception as e:
            errors.append(f"SQL解析失败: {str(e)}")

        return sql_type, tables, errors, warnings

    def _get_sql_type(self, parsed) -> SQLType:
        node_type = type(parsed).__name__.upper()
        
        type_mapping = {
            'SELECT': SQLType.SELECT,
            'INSERT': SQLType.INSERT,
            'UPDATE': SQLType.UPDATE,
            'DELETE': SQLType.DELETE,
            'ALTER': SQLType.ALTER,
            'CREATE': SQLType.CREATE,
            'DROP': SQLType.DROP,
            'TRUNCATE': SQLType.TRUNCATE,
        }
        
        for key, sql_type in type_mapping.items():
            if key in node_type:
                return sql_type
        
        return SQLType.UNKNOWN

    def _extract_tables(self, parsed) -> List[TargetTable]:
        tables = []
        seen_tables = set()

        for table in parsed.find_all(sqlglot.exp.Table):
            table_name = table.name.lower()
            if table_name not in seen_tables:
                seen_tables.add(table_name)
                tables.append(TargetTable(
                    table_name=table_name,
                    schema_name=table.db if table.db else None,
                    estimated_rows=self.TABLE_SIZE_ESTIMATES.get(table_name, 10000),
                    has_index=True
                ))

        return tables

    def _check_syntax_warnings(self, parsed, sql_type: SQLType) -> List[str]:
        warnings = []

        if sql_type in [SQLType.UPDATE, SQLType.DELETE]:
            where_clause = parsed.find(sqlglot.exp.Where)
            if not where_clause:
                warnings.append("缺少WHERE子句，可能导致全表操作")
            else:
                if "1=1" in str(where_clause).replace(" ", ""):
                    warnings.append("WHERE子句包含恒真条件(1=1)，存在全表操作风险")

        if sql_type == SQLType.SELECT:
            limit = parsed.find(sqlglot.exp.Limit)
            if not limit:
                warnings.append("SELECT语句缺少LIMIT限制")

        if sql_type == SQLType.ALTER:
            alter_kind = ""
            node_type_str = type(parsed).__name__.upper()
            if 'ALTER' in node_type_str:
                alter_kind = "DDL"
                if hasattr(parsed, 'args'):
                    for key in parsed.args:
                        if 'COLUMN' in str(key).upper():
                            alter_kind = "修改列"
                            break
                
                warnings.append(f"ALTER TABLE操作({alter_kind})可能导致表锁")

        return warnings

    def estimate_impacted_rows(self, sql_type: SQLType, tables: List[TargetTable], sql_content: str) -> int:
        if not tables:
            return 0

        if sql_type in [SQLType.INSERT, SQLType.SELECT]:
            return min(1000, max(t.estimated_rows for t in tables) // 100)

        if sql_type in [SQLType.UPDATE, SQLType.DELETE]:
            where_match = re.search(r'WHERE\s+(.+?)(?:LIMIT|ORDER|$)', sql_content, re.IGNORECASE | re.DOTALL)
            if where_match:
                where_condition = where_match.group(1)
                if "id =" in where_condition.lower() or "id=" in where_condition.lower():
                    return 1
                if " in (" in where_condition.lower():
                    return 100
            return max(t.estimated_rows for t in tables)

        if sql_type == SQLType.ALTER:
            return max(t.estimated_rows for t in tables)

        return 0

    def assess_lock_risk(self, sql_type: SQLType, tables: List[TargetTable], impacted_rows: int) -> Tuple[int, str]:
        risk_score = 0
        reasons = []

        if sql_type == SQLType.ALTER:
            risk_score += 50
            reasons.append("DDL操作可能导致长时间表锁")
            for table in tables:
                if table.estimated_rows > 1000000:
                    risk_score += 30
                    reasons.append(f"表 {table.table_name} 数据量较大({table.estimated_rows}行)，ALTER操作锁风险高")

        elif sql_type in [SQLType.UPDATE, SQLType.DELETE]:
            if impacted_rows > 100000:
                risk_score += 40
                reasons.append(f"影响行数过多({impacted_rows}行)，可能导致长时间行锁")
            if impacted_rows == 0:
                risk_score += 20
                reasons.append("无法确定影响行数，可能存在全表扫描风险")

        elif sql_type == SQLType.TRUNCATE:
            risk_score += 60
            reasons.append("TRUNCATE操作会立即持有表锁且无法回滚")

        elif sql_type == SQLType.DROP:
            risk_score += 80
            reasons.append("DROP操作风险极高，会删除整个表")

        risk_score = min(risk_score, 100)
        return risk_score, "; ".join(reasons)

    def validate_rollback(self, sql_type: SQLType, sql_content: str, rollback_script: str = None) -> Tuple[bool, str]:
        if not rollback_script:
            return False, "未提供回滚脚本"

        try:
            parsed_rollback = sqlglot.parse_one(rollback_script)
            rollback_type = self._get_sql_type(parsed_rollback)

            if sql_type == SQLType.INSERT and rollback_type == SQLType.DELETE:
                return True, "回滚脚本校验通过: INSERT -> DELETE"
            if sql_type == SQLType.DELETE and rollback_type == SQLType.INSERT:
                return True, "回滚脚本校验通过: DELETE -> INSERT"
            if sql_type == SQLType.UPDATE and rollback_type == SQLType.UPDATE:
                return True, "回滚脚本校验通过: UPDATE -> UPDATE"
            if sql_type == SQLType.ALTER and rollback_type == SQLType.ALTER:
                return True, "回滚脚本校验通过: ALTER -> ALTER"

            return False, f"回滚脚本类型不匹配: {sql_type} -> {rollback_type}"

        except Exception as e:
            return False, f"回滚脚本解析失败: {str(e)}"

    def calculate_risk_score(self, snippet: SQLSnippet) -> RiskScore:
        impact_score = min(snippet.estimated_impacted_rows // 1000, 30)
        lock_score = snippet.lock_risk_score // 2
        rollback_score = 0 if snippet.has_rollback else 20

        total_score = impact_score + lock_score + rollback_score

        risk_factors = []
        if snippet.estimated_impacted_rows > 10000:
            risk_factors.append(f"影响行数较多: {snippet.estimated_impacted_rows}")
        if snippet.lock_risk_score > 30:
            risk_factors.append(f"锁风险较高: {snippet.lock_risk_score}")
        if not snippet.has_rollback:
            risk_factors.append("缺少回滚脚本")

        if total_score >= 70:
            risk_level = RiskLevel.CRITICAL
        elif total_score >= 50:
            risk_level = RiskLevel.HIGH
        elif total_score >= 30:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        return RiskScore(
            total_score=total_score,
            impact_score=impact_score,
            lock_score=lock_score,
            rollback_score=rollback_score,
            risk_level=risk_level,
            risk_factors=risk_factors
        )

    def audit_snippet(self, sql_content: str, rollback_script: str = None) -> SQLSnippet:
        snippet_id = str(uuid.uuid4())[:8]

        sql_type, tables, errors, warnings = self.parse_sql(sql_content)

        impacted_rows = self.estimate_impacted_rows(sql_type, tables, sql_content)

        lock_score, lock_reason = self.assess_lock_risk(sql_type, tables, impacted_rows)

        has_rollback = False
        if rollback_script:
            has_rollback, validation_msg = self.validate_rollback(sql_type, sql_content, rollback_script)
            if validation_msg:
                if has_rollback:
                    warnings.append(validation_msg)
                else:
                    errors.append(validation_msg)

        snippet = SQLSnippet(
            id=snippet_id,
            sql_content=sql_content,
            sql_type=sql_type,
            target_tables=tables,
            estimated_impacted_rows=impacted_rows,
            lock_risk_score=lock_score,
            lock_risk_reason=lock_reason,
            has_rollback=has_rollback,
            rollback_script=rollback_script,
            parse_errors=errors,
            warnings=warnings
        )

        return snippet

    def create_processing_trace(self, original_input: str, steps: List[Dict[str, Any]],
                                final_conclusion: str, errors: List[str]) -> ProcessingTrace:
        return ProcessingTrace(
            original_input=original_input,
            processing_steps=steps,
            final_conclusion=final_conclusion,
            errors=errors
        )
