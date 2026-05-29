import re
import logging
from typing import Any, Dict, List, Optional, Union
from enum import Enum

from ..core.config import Config


class MaskingContext(str, Enum):
    DISPLAY = "display"
    EXPORT = "export"
    LOG = "log"


def _camel_to_snake(name: str) -> str:
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append("_")
        result.append(char)
    return "".join(result).lower()


def is_sensitive_field(field_name: str, config: Config) -> bool:
    if not field_name:
        return False
    field_normalized = _camel_to_snake(field_name).replace("-", "_").replace(" ", "_")
    for sensitive in config.sensitive_fields:
        sensitive_lower = _camel_to_snake(sensitive).replace("-", "_")
        if sensitive_lower in field_normalized or field_normalized in sensitive_lower:
            return True
    return False


def mask_sensitive_string(value: str, config: Config) -> str:
    if not value or len(value) <= 4:
        return config.mask_pattern
    if len(value) <= 8:
        return value[:2] + config.mask_pattern + value[-2:]
    return value[:4] + config.mask_pattern + value[-4:]


def _should_mask(context: MaskingContext, config: Config) -> bool:
    if context == MaskingContext.DISPLAY:
        return config.enable_display_masking
    elif context == MaskingContext.EXPORT:
        return config.enable_export_masking
    elif context == MaskingContext.LOG:
        return config.enable_log_masking
    return True


def mask_sensitive_data(
    data: Any,
    config: Config,
    context: MaskingContext = MaskingContext.DISPLAY,
    path: str = "",
) -> Any:
    if not _should_mask(context, config):
        return data

    if data is None:
        return None

    if isinstance(data, dict):
        result: Dict[str, Any] = {}
        for key, value in data.items():
            current_path = f"{path}.{key}" if path else key
            if is_sensitive_field(key, config):
                if isinstance(value, str):
                    result[key] = mask_sensitive_string(value, config)
                elif isinstance(value, (int, float)):
                    result[key] = config.mask_pattern
                else:
                    result[key] = mask_sensitive_data(value, config, context, current_path)
            else:
                result[key] = mask_sensitive_data(value, config, context, current_path)
        return result

    if isinstance(data, list):
        return [mask_sensitive_data(item, config, context, path) for item in data]

    if isinstance(data, str):
        if _contains_sensitive_pattern(data):
            return _mask_sensitive_patterns(data, config)
        return data

    return data


def _contains_sensitive_pattern(value: str) -> bool:
    patterns = [
        r"(?i)(?:aws|aliyun|volcengine).*(?:key|secret|token)",
        r"AKIA[0-9A-Z]{16}",
        r"(?i)sk-[a-zA-Z0-9]{20,}",
        r"\b\d{12}\b",
    ]
    for pattern in patterns:
        if re.search(pattern, value):
            return True
    return False


def _mask_sensitive_patterns(value: str, config: Config) -> str:
    result = value
    result = re.sub(r"AKIA[0-9A-Z]{16}", "AKIA" + config.mask_pattern, result)
    result = re.sub(r"(?i)sk-[a-zA-Z0-9]{20,}", "sk-" + config.mask_pattern, result)
    result = re.sub(r"\b(\d{4})\d{8}(\d{4})\b", r"\1" + config.mask_pattern + r"\2", result)
    return result


class MaskedLogger(logging.LoggerAdapter):
    def __init__(self, logger: logging.Logger, config: Config):
        super().__init__(logger, {})
        self.config = config

    def process(self, msg: str, kwargs: Any) -> tuple:
        masked_msg = mask_sensitive_data(msg, self.config, MaskingContext.LOG)
        if "extra" in kwargs:
            kwargs["extra"] = mask_sensitive_data(kwargs["extra"], self.config, MaskingContext.LOG)
        return masked_msg, kwargs


def get_masked_logger(config: Config, name: str = "cloudbill") -> MaskedLogger:
    logger = logging.getLogger(name)
    return MaskedLogger(logger, config)
