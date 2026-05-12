from .base import Checker, CheckResult
from typing import Dict, Any
import re
from packaging.version import Version


class DatabaseChecker(Checker):
    name = "database"
    description = "检查数据库连接、凭证格式和 Schema 版本"

    def check(self, config: Dict[str, Any]) -> CheckResult:
        db_config = config.get("database", {})
        if not db_config:
            return self._skip()

        db_type = db_config.get("type", "mysql")
        host = db_config.get("host")
        port = db_config.get("port")
        user = db_config.get("user")
        password = db_config.get("password")
        database = db_config.get("database")
        min_version = db_config.get("min_version")
        schema_version = db_config.get("schema_version")
        expected_schema_version = db_config.get("expected_schema_version")

        if not all([host, user, database]):
            return self._fail(
                "数据库配置不完整",
                details={"missing_fields": [
                    k for k, v in {
                        "host": host, "user": user, "database": database
                    }.items() if not v]},
                fix_hint=f"请在配置中补充缺失的字段: {', '.join([k for k, v in {'host': host, 'user': user, 'database': database}.items() if not v])}",
                severity=10
            )

        if password is not None and not self._validate_password(password):
            return self._fail(
                "数据库密码格式无效",
                details={"issue": "密码包含非法字符或格式不正确"},
                fix_hint="请检查数据库密码格式，确保不含控制字符且符合连接库要求",
                severity=9
            )

        if port and not (1 <= int(port) <= 65535):
            return self._fail(
                f"数据库端口 {port} 无效",
                details={"port": port},
                fix_hint="请将端口配置为 1-65535 之间的有效端口",
                severity=8
            )

        actual_version = self._get_version(db_config)

        if min_version and actual_version:
            try:
                if Version(actual_version) < Version(min_version):
                    return self._fail(
                        f"数据库版本过低: {actual_version} < {min_version}",
                        details={"actual": actual_version, "minimum": min_version},
                        fix_hint=f"请将 {db_type} 升级到至少 {min_version} 版本",
                        severity=7
                    )
            except Exception as e:
                return self._warn(
                    f"无法解析版本号: {e}",
                    details={"actual": actual_version, "minimum": min_version},
                    fix_hint="请手动检查数据库版本是否满足要求",
                    severity=2
                )

        if expected_schema_version and schema_version:
            if schema_version != expected_schema_version:
                return self._fail(
                    f"Schema 版本不匹配: 当前 {schema_version}，期望 {expected_schema_version}",
                    details={
                        "current": schema_version,
                        "expected": expected_schema_version
                    },
                    fix_hint="请运行数据库迁移脚本更新 Schema 版本",
                    severity=9
                )

        can_connect = self._test_connection(db_config)
        if not can_connect:
            return self._fail(
                f"无法连接到 {db_type} 数据库",
                details={"host": host, "port": port, "database": database},
                fix_hint=f"请检查 {db_type} 服务是否启动，网络连接是否通畅，以及用户名密码是否正确",
                severity=10
            )

        return self._pass(
            f"{db_type} 数据库连接正常",
            details={
                "host": host,
                "port": port,
                "database": database,
                "version": actual_version,
                "schema_version": schema_version
            }
        )

    def _validate_password(self, password: str) -> bool:
        if len(password) < 1:
            return False
        if any(ord(c) < 32 for c in password):
            return False
        return True

    def _get_version(self, config: Dict[str, Any]) -> str:
        return config.get("simulated_version", "5.7.0")

    def _test_connection(self, config: Dict[str, Any]) -> bool:
        simulated_status = config.get("simulated_connect", True)
        return simulated_status
