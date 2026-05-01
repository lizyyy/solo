"""
脱敏规则模块

负责处理日志中的敏感信息：
- 手机号、邮箱、身份证号
- Token、API Key、密码
- JSON 嵌套结构中的敏感字段
- 支持自定义脱敏规则
"""

import re
import json
from typing import List, Dict, Any, Optional, Tuple, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from copy import deepcopy


class SanitizeAction(Enum):
    """脱敏操作类型"""
    MASK = "mask"
    REPLACE = "replace"
    REMOVE = "remove"
    HASH = "hash"


@dataclass
class SanitizeRule:
    """脱敏规则"""
    name: str
    pattern: str
    action: SanitizeAction = SanitizeAction.MASK
    replacement: str = "****"
    mask_char: str = "*"
    keep_prefix: int = 3
    keep_suffix: int = 4
    json_keys: List[str] = field(default_factory=list)
    enabled: bool = True
    description: str = ""


@dataclass
class SanitizeResult:
    """脱敏结果"""
    original: str
    sanitized: str
    matches_found: int
    applied_rules: List[str]


DEFAULT_PRESET_RULES: List[Dict] = [
    {
        "name": "phone_number",
        "pattern": r'(?<![\d])1[3-9]\d{9}(?![\d])',
        "action": "mask",
        "mask_char": "*",
        "keep_prefix": 3,
        "keep_suffix": 4,
        "description": "中国手机号"
    },
    {
        "name": "email",
        "pattern": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        "action": "mask",
        "mask_char": "*",
        "keep_prefix": 2,
        "keep_suffix": 0,
        "description": "电子邮箱"
    },
    {
        "name": "id_card",
        "pattern": r'(?<![\d])[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx](?![\d])',
        "action": "mask",
        "mask_char": "*",
        "keep_prefix": 6,
        "keep_suffix": 4,
        "description": "身份证号"
    },
    {
        "name": "token_bearer",
        "pattern": r'(?i)(?:bearer|token)[\s:=]+[A-Za-z0-9\-._~+/]+=*',
        "action": "replace",
        "replacement": "[REDACTED_TOKEN]",
        "description": "Bearer Token"
    },
    {
        "name": "api_key",
        "pattern": r'(?i)(?:api[_-]?key|apikey|secret[_-]?key)["\']?\s*[:=]\s*["\']?[A-Za-z0-9\-_]+["\']?',
        "action": "replace",
        "replacement": '"apiKey": "[REDACTED]"',
        "description": "API Key"
    },
    {
        "name": "password",
        "pattern": r'(?i)(?:password|pwd|passwd)["\']?\s*[:=]\s*["\'][^"\']+["\']',
        "action": "replace",
        "replacement": '"password": "[REDACTED]"',
        "description": "密码字段"
    },
    {
        "name": "jwt_token",
        "pattern": r'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
        "action": "replace",
        "replacement": "[JWT_REDACTED]",
        "description": "JWT Token"
    },
    {
        "name": "ip_address",
        "pattern": r'(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)',
        "action": "mask",
        "mask_char": "*",
        "keep_prefix": 0,
        "keep_suffix": 0,
        "description": "IP地址"
    },
]

DEFAULT_JSON_SENSITIVE_KEYS = [
    "token", "access_token", "refresh_token", "id_token",
    "password", "pwd", "secret", "private_key",
    "api_key", "apikey", "apiKey", "API_KEY",
    "authorization", "Authorization", "auth",
    "phone", "mobile", "phoneNumber", "手机号",
    "email", "mail", "邮箱",
    "idCard", "id_card", "身份证", "idNumber",
    "cardNumber", "bankCard", "银行卡",
    "name", "realName", "姓名",
    "userId", "user_id", "uid", "用户ID",
]


class LogSanitizer:
    """日志脱敏器"""

    def __init__(self, rules: Optional[List[SanitizeRule]] = None):
        self._rules: List[SanitizeRule] = []
        self._compiled_patterns: Dict[str, re.Pattern] = {}
        self._sensitive_json_keys: List[str] = DEFAULT_JSON_SENSITIVE_KEYS.copy()

        if rules:
            for rule in rules:
                self.add_rule(rule)
        else:
            self._load_default_rules()

    def _load_default_rules(self):
        """加载默认预设规则"""
        for rule_data in DEFAULT_PRESET_RULES:
            rule = self._create_rule_from_dict(rule_data)
            self.add_rule(rule)

    def _create_rule_from_dict(self, data: Dict) -> SanitizeRule:
        """从字典创建规则"""
        action_str = data.get("action", "mask")
        try:
            action = SanitizeAction(action_str)
        except ValueError:
            action = SanitizeAction.MASK

        return SanitizeRule(
            name=data.get("name", ""),
            pattern=data.get("pattern", ""),
            action=action,
            replacement=data.get("replacement", "****"),
            mask_char=data.get("mask_char", "*"),
            keep_prefix=data.get("keep_prefix", 3),
            keep_suffix=data.get("keep_suffix", 4),
            json_keys=data.get("json_keys", []),
            enabled=data.get("enabled", True),
            description=data.get("description", "")
        )

    def add_rule(self, rule: SanitizeRule):
        """添加脱敏规则"""
        if rule.enabled and rule.pattern:
            try:
                compiled = re.compile(rule.pattern, re.MULTILINE)
                self._compiled_patterns[rule.name] = compiled
                self._rules.append(rule)
            except re.error as e:
                print(f"Warning: Invalid regex pattern for rule '{rule.name}': {e}")

    def add_sensitive_json_keys(self, keys: List[str]):
        """添加敏感 JSON 字段名"""
        for key in keys:
            if key not in self._sensitive_json_keys:
                self._sensitive_json_keys.append(key)

    def sanitize_text(self, text: str) -> SanitizeResult:
        """
        脱敏纯文本内容

        应用所有正则规则进行替换
        """
        if not text:
            return SanitizeResult(
                original="",
                sanitized="",
                matches_found=0,
                applied_rules=[]
            )

        result = text
        total_matches = 0
        applied_rules = []

        for rule in self._rules:
            if not rule.enabled:
                continue

            pattern = self._compiled_patterns.get(rule.name)
            if not pattern:
                continue

            matches = list(pattern.finditer(result))
            if not matches:
                continue

            total_matches += len(matches)
            applied_rules.append(rule.name)

            result = pattern.sub(
                lambda m: self._apply_rule_to_match(m, rule),
                result
            )

        return SanitizeResult(
            original=text,
            sanitized=result,
            matches_found=total_matches,
            applied_rules=applied_rules
        )

    def sanitize_json(self, data: Union[str, Dict, List]) -> Tuple[Any, SanitizeResult]:
        """
        脱敏 JSON 数据

        处理嵌套结构中的敏感字段
        """
        if isinstance(data, str):
            try:
                parsed = json.loads(data)
            except json.JSONDecodeError:
                result = self.sanitize_text(data)
                return result.sanitized, result
        else:
            parsed = deepcopy(data)

        original_str = json.dumps(data, ensure_ascii=False) if isinstance(data, (dict, list)) else str(data)

        sanitized_data = self._sanitize_json_value(parsed)

        sanitized_str = json.dumps(sanitized_data, ensure_ascii=False)

        matches = 0
        if sanitized_str != original_str:
            matches = 1

        return sanitized_data, SanitizeResult(
            original=original_str,
            sanitized=sanitized_str,
            matches_found=matches,
            applied_rules=["json_sensitive_keys"]
        )

    def _sanitize_json_value(self, value: Any) -> Any:
        """递归脱敏 JSON 值"""
        if isinstance(value, dict):
            return {k: self._sanitize_dict_value(k, v) for k, v in value.items()}
        elif isinstance(value, list):
            return [self._sanitize_json_value(v) for v in value]
        elif isinstance(value, str):
            result = self.sanitize_text(value)
            return result.sanitized
        else:
            return value

    def _sanitize_dict_value(self, key: str, value: Any) -> Any:
        """处理字典值，检查是否为敏感键"""
        is_sensitive = False

        for sensitive_key in self._sensitive_json_keys:
            if self._key_matches(key, sensitive_key):
                is_sensitive = True
                break

        if is_sensitive:
            if isinstance(value, str):
                return self._mask_string(value, 0, 0, "*")
            elif isinstance(value, (int, float, bool)):
                return "[REDACTED]"
            elif isinstance(value, dict):
                return {k: self._sanitize_dict_value(k, v) for k, v in value.items()}
            elif isinstance(value, list):
                return [self._sanitize_json_value(v) for v in value]
            else:
                return "[REDACTED]"

        return self._sanitize_json_value(value)

    def _key_matches(self, key: str, pattern: str) -> bool:
        """检查键名是否匹配敏感模式（不区分大小写）"""
        key_lower = key.lower()
        pattern_lower = pattern.lower()

        if pattern_lower == key_lower:
            return True

        if pattern_lower in key_lower:
            return True

        return False

    def _apply_rule_to_match(self, match: re.Match, rule: SanitizeRule) -> str:
        """对匹配结果应用规则"""
        matched_text = match.group(0)

        if rule.action == SanitizeAction.MASK:
            return self._mask_string(
                matched_text,
                rule.keep_prefix,
                rule.keep_suffix,
                rule.mask_char
            )
        elif rule.action == SanitizeAction.REPLACE:
            return rule.replacement
        elif rule.action == SanitizeAction.HASH:
            import hashlib
            return hashlib.md5(matched_text.encode()).hexdigest()[:8]
        elif rule.action == SanitizeAction.REMOVE:
            return ""
        else:
            return matched_text

    def _mask_string(self, text: str, keep_prefix: int, keep_suffix: int, mask_char: str) -> str:
        """
        掩码字符串

        保留前后指定字符数，中间用掩码替换
        """
        if not text:
            return text

        text_len = len(text)

        if text_len <= keep_prefix + keep_suffix:
            return mask_char * text_len

        prefix = text[:keep_prefix] if keep_prefix > 0 else ""
        suffix = text[-keep_suffix:] if keep_suffix > 0 else ""
        mask_len = text_len - keep_prefix - keep_suffix
        mask = mask_char * mask_len

        return prefix + mask + suffix

    def sanitize_log_content(self, content: str) -> Tuple[str, SanitizeResult]:
        """
        智能脱敏日志内容

        自动检测 JSON 结构并处理
        """
        stripped = content.strip()

        if (stripped.startswith('{') and stripped.endswith('}')) or \
           (stripped.startswith('[') and stripped.endswith(']')):
            try:
                json_data, result = self.sanitize_json(content)
                if isinstance(json_data, (dict, list)):
                    return json.dumps(json_data, ensure_ascii=False), result
                return str(json_data), result
            except json.JSONDecodeError:
                pass

        result = self.sanitize_text(content)
        return result.sanitized, result

    @classmethod
    def from_json_config(cls, config_path: str) -> 'LogSanitizer':
        """
        从 JSON 配置文件创建脱敏器
        """
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        sanitizer = cls(rules=[])

        rules_data = config.get("rules", [])
        for rule_data in rules_data:
            rule = sanitizer._create_rule_from_dict(rule_data)
            sanitizer.add_rule(rule)

        extra_keys = config.get("sensitive_json_keys", [])
        if extra_keys:
            sanitizer.add_sensitive_json_keys(extra_keys)

        return sanitizer


def create_default_sanitizer() -> LogSanitizer:
    """创建使用默认规则的脱敏器"""
    return LogSanitizer()
