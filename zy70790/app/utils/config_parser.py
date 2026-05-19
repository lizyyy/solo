import json
import yaml
from typing import Dict, List, Any, Optional
from abc import ABC, abstractmethod


class BaseConfigParser(ABC):
    @abstractmethod
    def parse(self, config_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        pass


class PythonConfigParser(BaseConfigParser):
    def parse(self, config_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        policies = []
        retry_config = config_data.get("retry", config_data)
        status_codes = retry_config.get("status_codes", [])
        
        if not status_codes:
            status_codes = retry_config.get("retryable_status_codes", [429, 500, 502, 503, 504])
        
        base_policy = {
            "max_retries": retry_config.get("max_retries", 3),
            "backoff_strategy": retry_config.get("backoff_strategy", "exponential"),
            "initial_delay": retry_config.get("initial_delay", 1.0),
            "max_delay": retry_config.get("max_delay", 30.0),
            "multiplier": retry_config.get("multiplier", 2.0),
            "jitter_enabled": retry_config.get("jitter_enabled", True),
        }
        
        for code in status_codes:
            policy = base_policy.copy()
            policy["status_code"] = code
            policy["is_retryable"] = True
            policies.append(policy)
        
        non_retryable = retry_config.get("non_retryable_status_codes", [400, 401, 403, 404])
        for code in non_retryable:
            policies.append({
                "status_code": code,
                "max_retries": 0,
                "backoff_strategy": "none",
                "initial_delay": 0,
                "max_delay": 0,
                "multiplier": 1,
                "jitter_enabled": False,
                "is_retryable": False,
            })
        
        return policies


class JavaConfigParser(BaseConfigParser):
    def parse(self, config_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        policies = []
        retry_config = config_data.get("retryPolicy", config_data)
        
        max_attempts = retry_config.get("maxAttempts", 3)
        backoff = retry_config.get("backoff", {})
        
        base_policy = {
            "max_retries": max_attempts - 1,
            "backoff_strategy": backoff.get("type", "exponential"),
            "initial_delay": backoff.get("delay", 1000) / 1000.0,
            "max_delay": backoff.get("maxDelay", 30000) / 1000.0,
            "multiplier": backoff.get("multiplier", 2.0),
            "jitter_enabled": backoff.get("jitter", True),
        }
        
        retryable_codes = retry_config.get("retryableStatusCodes", [429, 500, 502, 503])
        for code in retryable_codes:
            policy = base_policy.copy()
            policy["status_code"] = code
            policy["is_retryable"] = True
            policies.append(policy)
        
        non_retryable = retry_config.get("nonRetryableStatusCodes", [400, 404])
        for code in non_retryable:
            policies.append({
                "status_code": code,
                "max_retries": 0,
                "backoff_strategy": "none",
                "initial_delay": 0,
                "max_delay": 0,
                "multiplier": 1,
                "jitter_enabled": False,
                "is_retryable": False,
            })
        
        return policies


class GoConfigParser(BaseConfigParser):
    def parse(self, config_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        policies = []
        retry_config = config_data.get("retry", config_data)
        
        base_policy = {
            "max_retries": retry_config.get("maxRetries", 3),
            "backoff_strategy": retry_config.get("backoffStrategy", "exponential"),
            "initial_delay": retry_config.get("initialInterval", 1000) / 1000.0,
            "max_delay": retry_config.get("maxInterval", 30000) / 1000.0,
            "multiplier": retry_config.get("multiplier", 1.5),
            "jitter_enabled": retry_config.get("jitter", True),
        }
        
        retryable = retry_config.get("retryableStatusCodes", [429, 500, 502, 503, 504])
        for code in retryable:
            policy = base_policy.copy()
            policy["status_code"] = code
            policy["is_retryable"] = True
            policies.append(policy)
        
        return policies


class JavaScriptConfigParser(BaseConfigParser):
    def parse(self, config_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        policies = []
        retry_config = config_data.get("retry", config_data)
        
        retries = retry_config.get("retries", 3)
        if isinstance(retries, dict):
            base_policy = {
                "max_retries": retries.get("limit", 3),
            }
        else:
            base_policy = {"max_retries": retries}
        
        base_policy.update({
            "backoff_strategy": retry_config.get("backoff", "exponential"),
            "initial_delay": retry_config.get("initialDelay", 1.0),
            "max_delay": retry_config.get("maxDelay", 30.0),
            "multiplier": retry_config.get("factor", 2.0),
            "jitter_enabled": retry_config.get("jitter", True),
        })
        
        http_codes = retry_config.get("httpStatusCodes", {})
        retryable = http_codes.get("retry", [429, 500, 502, 503, 504])
        
        for code in retryable:
            policy = base_policy.copy()
            policy["status_code"] = code
            policy["is_retryable"] = True
            policies.append(policy)
        
        return policies


class ConfigParserFactory:
    _parsers: Dict[str, BaseConfigParser] = {
        "python": PythonConfigParser(),
        "java": JavaConfigParser(),
        "go": GoConfigParser(),
        "javascript": JavaScriptConfigParser(),
        "typescript": JavaScriptConfigParser(),
        "js": JavaScriptConfigParser(),
    }
    
    @classmethod
    def get_parser(cls, language: str) -> Optional[BaseConfigParser]:
        return cls._parsers.get(language.lower())
    
    @classmethod
    def register_parser(cls, language: str, parser: BaseConfigParser):
        cls._parsers[language.lower()] = parser


def parse_config(language: str, config_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    parser = ConfigParserFactory.get_parser(language)
    if not parser:
        raise ValueError(f"No parser found for language: {language}")
    return parser.parse(config_data)


def categorize_status_code(status_code: int) -> str:
    if status_code < 400:
        return "success"
    elif status_code < 500:
        return "client_error"
    elif status_code < 600:
        return "server_error"
    return "other"