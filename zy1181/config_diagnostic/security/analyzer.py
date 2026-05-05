import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Pattern

from ..parsers.base import ConfigValue, ParsedConfig


class FindingSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class FindingType(Enum):
    SENSITIVE_PLAINTEXT = "sensitive_plaintext"
    INVALID_ENUM = "invalid_enum"
    WEAK_PASSWORD = "weak_password"
    HARDCODED_SECRET = "hardcoded_secret"
    INSECURE_DEFAULT = "insecure_default"
    EXPOSED_CREDENTIAL = "exposed_credential"
    EMPTY_SECRET = "empty_secret"


@dataclass
class SecurityFinding:
    finding_type: FindingType
    severity: FindingSeverity
    key: str
    value: Any
    source: str
    source_path: str
    description: str
    suggestion: str
    line_number: Optional[int] = None


@dataclass
class SecurityResult:
    total_findings: int = 0
    findings: List[SecurityFinding] = field(default_factory=list)
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    info_count: int = 0
    summary: Dict[str, Any] = field(default_factory=dict)


class SecurityAnalyzer:
    SENSITIVE_KEY_PATTERNS: List[str] = [
        "password", "passwd", "pwd", "secret", "token", "api_key",
        "apikey", "private_key", "privatekey", "credential",
        "authorization", "auth_token", "access_token", "refresh_token",
        "aws_secret", "aws_access", "db_pass", "database_pass",
        "connection_string", "conn_string", "redis_pass",
        "mongo_pass", "mysql_pass", "postgres_pass", "sql_pass",
        "jwt_secret", "session_secret", "cookie_secret",
        "encryption_key", "encrypt_key", "decrypt_key",
        "api_secret", "app_secret", "client_secret",
        "oauth_secret", "openai_key", "openai_api_key",
        "stripe_key", "stripe_secret", "paypal_secret",
    ]
    
    COMMON_ENUM_VALUES: Dict[str, List[str]] = {
        "environment": ["development", "staging", "production", "test", "local"],
        "env": ["development", "staging", "production", "test", "local"],
        "log_level": ["DEBUG", "INFO", "WARN", "WARNING", "ERROR", "CRITICAL", "FATAL"],
        "loglevel": ["DEBUG", "INFO", "WARN", "WARNING", "ERROR", "CRITICAL", "FATAL"],
        "mode": ["development", "production", "test", "debug", "release"],
        "stage": ["dev", "development", "staging", "uat", "prod", "production"],
        "protocol": ["http", "https", "ftp", "sftp", "ssh", "tcp", "udp"],
        "ssl_mode": ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"],
        "tls_mode": ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"],
        "auth_method": ["none", "basic", "digest", "bearer", "oauth", "oauth2", "jwt", "api_key"],
        "authentication": ["none", "basic", "digest", "bearer", "oauth", "oauth2", "jwt", "api_key"],
    }
    
    WEAK_PASSWORD_PATTERNS: List[Pattern] = [
        re.compile(r"^password$", re.IGNORECASE),
        re.compile(r"^123456$"),
        re.compile(r"^qwerty$", re.IGNORECASE),
        re.compile(r"^admin$", re.IGNORECASE),
        re.compile(r"^root$", re.IGNORECASE),
        re.compile(r"^test$", re.IGNORECASE),
        re.compile(r"^guest$", re.IGNORECASE),
        re.compile(r"^welcome$", re.IGNORECASE),
        re.compile(r"^monkey$", re.IGNORECASE),
        re.compile(r"^12345678$"),
        re.compile(r"^123456789$"),
        re.compile(r"^12345$"),
    ]
    
    HARDCODED_SECRET_PATTERNS: List[Pattern] = [
        re.compile(r"^AKIA[0-9A-Z]{16}"),
        re.compile(r"^sk-[a-zA-Z0-9]{32}"),
        re.compile(r"^gh[ps]_[a-zA-Z0-9]{36,}"),
        re.compile(r"^xox[baprs]-[a-zA-Z0-9-]{40,}"),
        re.compile(r"^sk_live_[a-zA-Z0-9]{24}"),
        re.compile(r"^sk_test_[a-zA-Z0-9]{24}"),
        re.compile(r"^pk_live_[a-zA-Z0-9]{24}"),
        re.compile(r"^pk_test_[a-zA-Z0-9]{24}"),
    ]
    
    def __init__(self):
        self._configs: List[ParsedConfig] = []
        self._custom_enums: Dict[str, List[str]] = {}
    
    def add_config(self, config: ParsedConfig) -> None:
        self._configs.append(config)
    
    def set_custom_enums(self, enums: Dict[str, List[str]]) -> None:
        self._custom_enums = enums.copy()
    
    def analyze(self) -> SecurityResult:
        result = SecurityResult()
        
        for config in self._configs:
            for key, value in config.values.items():
                self._check_sensitive_plaintext(key, value, result)
                self._check_invalid_enum(key, value, result)
                self._check_weak_password(key, value, result)
                self._check_hardcoded_secret(key, value, result)
                self._check_insecure_default(key, value, result)
                self._check_empty_secret(key, value, result)
        
        self._update_counts(result)
        self._generate_summary(result)
        
        return result
    
    def _check_sensitive_plaintext(
        self,
        key: str,
        value: ConfigValue,
        result: SecurityResult
    ) -> None:
        if not isinstance(value.value, str):
            return
        
        key_lower = key.lower()
        is_sensitive_key = any(
            pattern.lower() in key_lower
            for pattern in self.SENSITIVE_KEY_PATTERNS
        )
        
        if is_sensitive_key and value.value:
            if not self._is_placeholder(value.value):
                severity = FindingSeverity.HIGH
                if self._looks_like_real_secret(value.value):
                    severity = FindingSeverity.CRITICAL
                
                finding = SecurityFinding(
                    finding_type=FindingType.SENSITIVE_PLAINTEXT,
                    severity=severity,
                    key=key,
                    value=value.value,
                    source=value.source.value,
                    source_path=value.source_path or "",
                    description=f"Sensitive field '{key}' found in plaintext",
                    suggestion="Use environment variables or a secure vault service. "
                               f"Consider encrypting this value or using a secrets manager.",
                    line_number=value.line_number,
                )
                result.findings.append(finding)
    
    def _check_invalid_enum(
        self,
        key: str,
        value: ConfigValue,
        result: SecurityResult
    ) -> None:
        if not isinstance(value.value, str):
            return
        
        key_lower = key.lower()
        
        valid_values: List[str] = []
        
        for enum_key, enum_values in self._custom_enums.items():
            if enum_key.lower() == key_lower or key_lower.endswith(f".{enum_key.lower()}"):
                valid_values = enum_values
                break
        
        if not valid_values:
            for enum_key, enum_values in self.COMMON_ENUM_VALUES.items():
                if enum_key.lower() == key_lower or key_lower.endswith(f".{enum_key.lower()}"):
                    valid_values = enum_values
                    break
        
        if valid_values:
            str_value = str(value.value)
            if str_value not in valid_values and str_value.lower() not in [v.lower() for v in valid_values]:
                finding = SecurityFinding(
                    finding_type=FindingType.INVALID_ENUM,
                    severity=FindingSeverity.MEDIUM,
                    key=key,
                    value=value.value,
                    source=value.source.value,
                    source_path=value.source_path or "",
                    description=f"Invalid enum value '{value.value}' for key '{key}'. "
                               f"Valid values are: {', '.join(valid_values)}",
                    suggestion=f"Use one of the valid values: {', '.join(valid_values)}. "
                               f"If this is intentional, add custom enum validation for this key.",
                    line_number=value.line_number,
                )
                result.findings.append(finding)
    
    def _check_weak_password(
        self,
        key: str,
        value: ConfigValue,
        result: SecurityResult
    ) -> None:
        if not isinstance(value.value, str):
            return
        
        key_lower = key.lower()
        is_password_key = any(
            pattern in key_lower
            for pattern in ["password", "passwd", "pwd"]
        )
        
        if is_password_key:
            for pattern in self.WEAK_PASSWORD_PATTERNS:
                if pattern.match(value.value):
                    finding = SecurityFinding(
                        finding_type=FindingType.WEAK_PASSWORD,
                        severity=FindingSeverity.HIGH,
                        key=key,
                        value="[REDACTED - WEAK PASSWORD",
                        source=value.source.value,
                        source_path=value.source_path or "",
                        description=f"Weak password detected for key '{key}'",
                        suggestion="Use a strong password with at least 12 characters, "
                                   "including uppercase, lowercase, numbers, and special characters.",
                        line_number=value.line_number,
                    )
                    result.findings.append(finding)
                    break
            
            if len(value.value) < 8:
                finding = SecurityFinding(
                    finding_type=FindingType.WEAK_PASSWORD,
                    severity=FindingSeverity.MEDIUM,
                    key=key,
                    value="[REDACTED - SHORT PASSWORD]",
                    source=value.source.value,
                    source_path=value.source_path or "",
                    description=f"Short password (length {len(value.value)}) detected for key '{key}'",
                    suggestion="Use a password with at least 12 characters for better security.",
                    line_number=value.line_number,
                )
                result.findings.append(finding)
    
    def _check_hardcoded_secret(
        self,
        key: str,
        value: ConfigValue,
        result: SecurityResult
    ) -> None:
        if not isinstance(value.value, str):
            return
        
        for pattern in self.HARDCODED_SECRET_PATTERNS:
            if pattern.match(value.value):
                finding = SecurityFinding(
                    finding_type=FindingType.HARDCODED_SECRET,
                    severity=FindingSeverity.CRITICAL,
                    key=key,
                    value="[REDACTED - HARDCODED SECRET]",
                    source=value.source.value,
                    source_path=value.source_path or "",
                    description=f"Hardcoded secret detected in key '{key}'. "
                               f"This appears to be a real API key or token.",
                    suggestion="Immediately rotate this credential. Use environment variables "
                               "or a secure vault service. Never commit secrets to version control.",
                    line_number=value.line_number,
                )
                result.findings.append(finding)
                break
    
    def _check_insecure_default(
        self,
        key: str,
        value: ConfigValue,
        result: SecurityResult
    ) -> None:
        if not isinstance(value.value, (str, bool)):
            return
        
        key_lower = key.lower()
        
        if "debug" in key_lower and value.value is True:
            finding = SecurityFinding(
                finding_type=FindingType.INSECURE_DEFAULT,
                severity=FindingSeverity.MEDIUM,
                key=key,
                value=value.value,
                source=value.source.value,
                source_path=value.source_path or "",
                description=f"Debug mode enabled in key '{key}'",
                suggestion="Disable debug mode in production environments. "
                           "Debug mode can expose sensitive information.",
                line_number=value.line_number,
            )
            result.findings.append(finding)
        
        if "ssl" in key_lower or "tls" in key_lower:
            if value.value is False or (isinstance(value.value, str) and value.value.lower() == "false"):
                finding = SecurityFinding(
                    finding_type=FindingType.INSECURE_DEFAULT,
                    severity=FindingSeverity.HIGH,
                    key=key,
                    value=value.value,
                    source=value.source.value,
                    source_path=value.source_path or "",
                    description=f"SSL/TLS disabled in key '{key}'",
                    suggestion="Enable SSL/TLS for secure communications. "
                               "Disabling SSL/TLS can expose data in transit.",
                    line_number=value.line_number,
                )
                result.findings.append(finding)
        
        if "environment" in key_lower or "env" in key_lower:
            if isinstance(value.value, str) and value.value.lower() in ["development", "dev", "debug"]:
                finding = SecurityFinding(
                    finding_type=FindingType.INSECURE_DEFAULT,
                    severity=FindingSeverity.LOW,
                    key=key,
                    value=value.value,
                    source=value.source.value,
                    source_path=value.source_path or "",
                    description=f"Environment set to '{value.value}' in key '{key}'",
                    suggestion="Ensure this is the intended environment. "
                               "Development settings should not be used in production.",
                    line_number=value.line_number,
                )
                result.findings.append(finding)
    
    def _check_empty_secret(
        self,
        key: str,
        value: ConfigValue,
        result: SecurityResult
    ) -> None:
        if not isinstance(value.value, str):
            return
        
        key_lower = key.lower()
        is_sensitive_key = any(
            pattern.lower() in key_lower
            for pattern in self.SENSITIVE_KEY_PATTERNS
        )
        
        if is_sensitive_key and not value.value.strip():
            finding = SecurityFinding(
                finding_type=FindingType.EMPTY_SECRET,
                severity=FindingSeverity.MEDIUM,
                key=key,
                value="(empty)",
                source=value.source.value,
                source_path=value.source_path or "",
                description=f"Empty secret value for sensitive key '{key}'",
                suggestion="Provide a valid secret value or remove the configuration. "
                           "Empty secrets may indicate incomplete configuration.",
                line_number=value.line_number,
            )
            result.findings.append(finding)
    
    def _is_placeholder(self, value: str) -> bool:
        placeholders = [
            "your_", "your-", "xxx", "***", "###", "___",
            "placeholder", "replace_me", "changeme", "change_me",
            "<", ">", "[", "]", "{", "}",
            "example", "demo", "test", "sample",
        ]
        
        value_lower = value.lower()
        
        for placeholder in placeholders:
            if placeholder in value_lower:
                return True
        
        len_stripped = len(value.strip('*#_<>[]{}'))
        if len_stripped < 3:
            return True
        
        return False
    
    def _looks_like_real_secret(self, value: str) -> bool:
        if len(value) < 8:
            return False
        
        has_uppercase = any(c.isupper() for c in value)
        has_lowercase = any(c.islower() for c in value)
        has_digit = any(c.isdigit() for c in value)
        has_special = any(c in '-_=+!@#$%^&*()' for c in value)
        
        variety = sum([has_uppercase, has_lowercase, has_digit, has_special])
        
        if variety >= 3:
            return True
        
        if len(value) >= 32:
            return True
        
        for pattern in self.HARDCODED_SECRET_PATTERNS:
            if pattern.match(value):
                return True
        
        return False
    
    def _update_counts(self, result: SecurityResult) -> None:
        result.total_findings = len(result.findings)
        
        for finding in result.findings:
            if finding.severity == FindingSeverity.CRITICAL:
                result.critical_count += 1
            elif finding.severity == FindingSeverity.HIGH:
                result.high_count += 1
            elif finding.severity == FindingSeverity.MEDIUM:
                result.medium_count += 1
            elif finding.severity == FindingSeverity.LOW:
                result.low_count += 1
            elif finding.severity == FindingSeverity.INFO:
                result.info_count += 1
    
    def _generate_summary(self, result: SecurityResult) -> None:
        type_counts: Dict[str, int] = {}
        source_counts: Dict[str, int] = {}
        
        for finding in result.findings:
            finding_type = finding.finding_type.value
            if finding_type not in type_counts:
                type_counts[finding_type] = 0
            type_counts[finding_type] += 1
            
            source = finding.source
            if source not in source_counts:
                source_counts[source] = 0
            source_counts[source] += 1
        
        result.summary = {
            "total_findings": result.total_findings,
            "severity_distribution": {
                "critical": result.critical_count,
                "high": result.high_count,
                "medium": result.medium_count,
                "low": result.low_count,
                "info": result.info_count,
            },
            "type_distribution": type_counts,
            "source_distribution": source_counts,
        }
