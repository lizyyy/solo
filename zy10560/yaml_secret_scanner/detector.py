import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class SecretPattern:
    name: str
    regex: str
    risk_level: str
    description: str
    min_entropy: float = 3.0


class SecretDetector:
    PATTERNS: List[SecretPattern] = [
        SecretPattern(
            name="aws-access-key",
            regex=r"(?i)AKIA[0-9A-Z]{16}",
            risk_level="critical",
            description="AWS 访问密钥 ID",
            min_entropy=3.5
        ),
        SecretPattern(
            name="aws-secret-key",
            regex=r"(?i)(?:aws[_-]?secret[_-]?access[_-]?key|secret[_-]?access[_-]?key)\s*[:=]\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?",
            risk_level="critical",
            description="AWS 秘密访问密钥",
            min_entropy=4.0
        ),
        SecretPattern(
            name="github-token",
            regex=r"(?i)gh[ps]_[A-Za-z0-9]{36}",
            risk_level="critical",
            description="GitHub 个人访问令牌",
            min_entropy=3.5
        ),
        SecretPattern(
            name="gitlab-token",
            regex=r"(?i)glpat-[A-Za-z0-9_-]{20,}",
            risk_level="critical",
            description="GitLab 个人访问令牌",
            min_entropy=3.5
        ),
        SecretPattern(
            name="slack-token",
            regex=r"(?i)(xox[baprs]-[A-Za-z0-9]{10,48})",
            risk_level="critical",
            description="Slack API 令牌",
            min_entropy=3.0
        ),
        SecretPattern(
            name="stripe-api-key",
            regex=r"(?i)sk_(test|live)_[A-Za-z0-9]{24,}",
            risk_level="critical",
            description="Stripe API 密钥",
            min_entropy=3.5
        ),
        SecretPattern(
            name="jwt-token",
            regex=r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
            risk_level="high",
            description="JWT 令牌",
            min_entropy=3.0
        ),
        SecretPattern(
            name="private-key",
            regex=r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
            risk_level="critical",
            description="私钥",
            min_entropy=2.0
        ),
        SecretPattern(
            name="api-key-generic",
            regex=r"(?i)(?:api[_-]?key|apikey|secret[_-]?key|secretkey|token|auth[_-]?token|password|passwd)\s*[:=]\s*['\"]?([A-Za-z0-9]{16,})['\"]?",
            risk_level="high",
            description="通用 API 密钥/令牌",
            min_entropy=3.5
        ),
        SecretPattern(
            name="database-url",
            regex=r"(?i)(?:postgres|mysql|mongodb|redis|sqlite)://[^:]+:([^@]+)@",
            risk_level="high",
            description="数据库连接字符串",
            min_entropy=3.0
        ),
        SecretPattern(
            name="bearer-token",
            regex=r"(?i)bearer\s+([A-Za-z0-9._-]{20,})",
            risk_level="high",
            description="Bearer 认证令牌",
            min_entropy=3.0
        ),
        SecretPattern(
            name="basic-auth",
            regex=r"(?i)basic\s+([A-Za-z0-9+/=]{4,})",
            risk_level="medium",
            description="Basic 认证凭证",
            min_entropy=2.5
        ),
        SecretPattern(
            name="oauth-secret",
            regex=r"(?i)(?:client[_-]?secret|oauth[_-]?secret)\s*[:=]\s*['\"]?([A-Za-z0-9]{16,})['\"]?",
            risk_level="high",
            description="OAuth 客户端密钥",
            min_entropy=3.5
        ),
        SecretPattern(
            name="hex-secret",
            regex=r"\b[0-9a-fA-F]{32,64}\b",
            risk_level="medium",
            description="十六进制密钥/哈希",
            min_entropy=3.0
        ),
        SecretPattern(
            name="base64-secret",
            regex=r"(?<=[:=]\s*['\"]?)[A-Za-z0-9+/=]{32,}(?=['\"]?)",
            risk_level="low",
            description="长 Base64 字符串",
            min_entropy=3.5
        ),
    ]

    RISK_WEIGHTS = {
        "low": 1,
        "medium": 2,
        "high": 3,
        "critical": 4,
    }

    def __init__(self, custom_patterns: Optional[Dict[str, dict]] = None):
        self.patterns = list(self.PATTERNS)
        if custom_patterns:
            for name, config in custom_patterns.items():
                self.patterns.append(SecretPattern(
                    name=name,
                    regex=config.get("regex", ""),
                    risk_level=config.get("risk_level", "medium"),
                    description=config.get("description", ""),
                    min_entropy=config.get("min_entropy", 3.0)
                ))

    @staticmethod
    def calculate_entropy(s: str) -> float:
        import math
        if not s:
            return 0.0
        char_count = {}
        for c in s:
            char_count[c] = char_count.get(c, 0) + 1
        entropy = 0.0
        for count in char_count.values():
            p = count / len(s)
            entropy -= p * math.log2(p)
        return entropy

    @staticmethod
    def is_placeholder(value: str) -> bool:
        placeholder_patterns = [
            r"^\$\{.*\}$",
            r"^\{\{.*\}\}$",
            r"^%\{.*\}$",
            r"^<.*>$",
            r"^REPLACE_ME$",
            r"^CHANGEME$",
            r"^TODO$",
            r"^example$",
            r"^placeholder$",
            r"^your[_-]?.*here$",
        ]
        value_lower = value.lower().strip()
        for pattern in placeholder_patterns:
            if re.match(pattern, value, re.IGNORECASE):
                return True
        return False

    def detect(self, value: str) -> List[Tuple[SecretPattern, str]]:
        results = []
        if not isinstance(value, str) or len(value) < 8:
            return results

        if self.is_placeholder(value):
            return results

        for pattern in self.patterns:
            try:
                matches = re.finditer(pattern.regex, value)
                for match in matches:
                    matched_value = match.group(1) if match.groups() else match.group(0)
                    if len(matched_value) >= 8:
                        entropy = self.calculate_entropy(matched_value)
                        if entropy >= pattern.min_entropy:
                            results.append((pattern, matched_value))
            except re.error:
                continue

        return results
