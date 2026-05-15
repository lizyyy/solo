import re
import sqlparse
from typing import List, Dict, Tuple, Any
from dataclasses import dataclass


@dataclass
class CheckResult:
    passed: bool
    errors: List[str]
    warnings: List[str]
    corrections: List[str]
    details: Dict[str, Any]


class RuleEngine:
    def __init__(self, db):
        self.db = db
        self._ensure_default_rules()

    def _ensure_default_rules(self):
        latest = self.db.get_latest_rule_version()
        if not latest:
            self.db.save_rule_version(
                version="v1.0",
                rule_content=self._get_v1_rules(),
                description="初始版本：基础SQL参数化检查规则"
            )

    def _get_v1_rules(self) -> Dict:
        return {
            "rules": [
                {
                    "id": "R001",
                    "name": "字符串拼接检测",
                    "description": "检测SQL中是否存在字符串拼接导致的注入风险",
                    "pattern": r"(['\"]\s*\+\s*[\w\$]|[\w\$]\s*\+\s*['\"])",
                    "severity": "critical",
                    "suggestion": "使用参数化查询替代字符串拼接"
                },
                {
                    "id": "R002",
                    "name": "f-string格式化检测",
                    "description": "检测Python f-string直接格式化SQL",
                    "pattern": r"f['\"]\s*.*?\{.*?\}.*?['\"]",
                    "severity": "critical",
                    "suggestion": "使用参数化查询替代f-string格式化"
                },
                {
                    "id": "R003",
                    "name": "百分号格式化检测",
                    "description": "检测使用%进行SQL字符串格式化",
                    "pattern": r"['\"]\s*%\s*\(",
                    "severity": "critical",
                    "suggestion": "使用参数化查询替代%格式化"
                },
                {
                    "id": "R004",
                    "name": "format方法检测",
                    "description": "检测使用.format()进行SQL格式化",
                    "pattern": r"\.format\s*\(",
                    "severity": "high",
                    "suggestion": "使用参数化查询替代format方法"
                },
                {
                    "id": "R005",
                    "name": "硬编码检测",
                    "description": "检测WHERE条件中的硬编码值，强制使用参数化查询",
                    "check_func": "check_param_markers",
                    "severity": "high",
                    "suggestion": "使用?或%s作为参数标记，避免硬编码SQL"
                },
                {
                    "id": "R006",
                    "name": "注释敏感信息检测",
                    "description": "检测SQL注释中是否包含敏感信息",
                    "pattern": r"--.*?(password|secret|key|token)",
                    "severity": "high",
                    "suggestion": "移除SQL注释中的敏感信息"
                },
                {
                    "id": "R007",
                    "name": "动态表名列名检测",
                    "description": "检测动态表名/列名拼接（白名单外）",
                    "check_func": "check_dynamic_identifiers",
                    "severity": "high",
                    "suggestion": "使用白名单验证动态标识符"
                }
            ],
            "allowed_param_markers": ["?", "%s", ":1", ":name"],
            "allowed_tables": ["payment_records", "channel_receipts", "orders", "users"],
            "allowed_columns": ["id", "amount", "status", "channel_code", "business_no", "created_at"]
        }

    def check_sql(self, sql: str, rule_version: str = None) -> CheckResult:
        rule_data = self.db.get_rule_version(rule_version) if rule_version else self.db.get_latest_rule_version()
        if not rule_data:
            return CheckResult(False, ["未找到有效的规则版本"], [], [], {})

        rules = rule_data["rule_content"]["rules"]
        errors = []
        warnings = []
        corrections = []
        details = {}

        parsed = sqlparse.parse(sql)
        if not parsed:
            errors.append("SQL语法解析失败")
            return CheckResult(False, errors, warnings, corrections, {"rule_version": rule_data["version"]})

        sql_normalized = " ".join(sql.split()).lower()

        for rule in rules:
            if "pattern" in rule:
                matches = re.findall(rule["pattern"], sql, re.IGNORECASE)
                if matches:
                    msg = f"[{rule['id']}] {rule['name']}: 发现 {len(matches)} 处匹配 - {rule['suggestion']}"
                    if rule["severity"] in ["critical", "high"]:
                        errors.append(msg)
                    else:
                        warnings.append(msg)
                    corrections.append(f"修正建议: {rule['suggestion']}")
                    details[rule["id"]] = {"matches": matches, "severity": rule["severity"]}
            elif "check_func" in rule:
                func = getattr(self, rule["check_func"], None)
                if func:
                    result = func(sql, rule_data["rule_content"])
                    if result:
                        if result["passed"] is False:
                            msg = f"[{rule['id']}] {rule['name']}: {result['message']} - {rule['suggestion']}"
                            if rule["severity"] in ["critical", "high"]:
                                errors.append(msg)
                            else:
                                warnings.append(msg)
                            details[rule["id"]] = result

        details["rule_version"] = rule_data["version"]
        details["rule_description"] = rule_data["description"]

        return CheckResult(
            passed=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            corrections=corrections,
            details=details
        )

    def check_param_markers(self, sql: str, rule_content: Dict) -> Dict:
        allowed = rule_content.get("allowed_param_markers", ["?", "%s", ":name", ":1"])
        has_param = any(marker in sql for marker in allowed)

        has_hardcoded_where = False
        if "where" in sql.lower() and not has_param:
            import re
            matches = re.findall(r"=\s*['\"]?[\w\d]+['\"]?", sql, re.IGNORECASE)
            if matches:
                has_hardcoded_where = True

        if has_hardcoded_where:
            return {
                "passed": False,
                "message": f"检测到硬编码值 ({len(matches)}处)，未使用参数化查询，存在注入风险"
            }
        return {"passed": True}

    def check_dynamic_identifiers(self, sql: str, rule_content: Dict) -> Dict:
        allowed_tables = rule_content.get("allowed_tables", [])
        allowed_columns = rule_content.get("allowed_columns", [])

        issues = []
        for match in re.finditer(r"\{(\w+)\}", sql):
            identifier = match.group(1)
            if identifier not in allowed_tables and identifier not in allowed_columns:
                issues.append(identifier)

        if issues:
            return {
                "passed": False,
                "message": f"检测到未授权的动态标识符: {', '.join(issues)}"
            }
        return {"passed": True}

    def add_rule_version(self, version: str, rules: Dict, description: str = ""):
        self.db.save_rule_version(version, rules, description)

    def list_rule_versions(self) -> List[Dict]:
        conn = self.db._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT version, description, created_at FROM rule_versions ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
