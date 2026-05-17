import re
import json
from typing import Dict, Any, List, Optional, Callable
from .reader import DeadLetterMessage


class Redactor:
    def __init__(self):
        self.phone_pattern = re.compile(r"\b(1[3-9]\d{9}|\+\d{1,3}[-.\s]?\d{1,14})\b")
        self.email_pattern = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
        self.credit_card_pattern = re.compile(r"\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b")
        self.id_pattern = re.compile(r"\b\d{17}[\dXx]\b")
        self.password_keys = {"password", "pwd", "secret", "token", "api_key", "auth_token"}

    def redact_message(self, msg: DeadLetterMessage) -> Dict[str, Any]:
        if msg.parsed is None:
            return {"raw_content": self._redact_string(msg.raw_content)}

        result = self._deep_redact(msg.parsed.copy())
        result["_meta"] = {
            "line_number": msg.line_number,
            "error_reason": msg.error_reason,
            "business_key": msg.business_key,
            "was_redacted": True
        }
        return result

    def _deep_redact(self, obj: Any) -> Any:
        if isinstance(obj, dict):
            return {k: self._redact_value(k, v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._deep_redact(item) for item in obj]
        elif isinstance(obj, str):
            return self._redact_string(obj)
        return obj

    def _redact_value(self, key: str, value: Any) -> Any:
        key_lower = key.lower()
        
        if key_lower in self.password_keys and isinstance(value, str):
            return "[REDACTED]"
        
        return self._deep_redact(value)

    def _redact_string(self, s: str) -> str:
        s = self.phone_pattern.sub("[PHONE]", s)
        s = self.email_pattern.sub("[EMAIL]", s)
        s = self.credit_card_pattern.sub("[CREDIT_CARD]", s)
        s = self.id_pattern.sub("[ID_NUMBER]", s)
        return s

    def redact_to_json(self, msg: DeadLetterMessage, pretty: bool = False) -> str:
        redacted = self.redact_message(msg)
        indent = 2 if pretty else None
        return json.dumps(redacted, ensure_ascii=False, indent=indent)
