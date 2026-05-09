import json
import logging
import os
import sys
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import config


class JsonEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.strftime(config.TIMESTAMP_FORMAT)
        if isinstance(obj, set):
            return list(obj)
        return super().default(obj)


class LoggerFactory:
    _loggers: Dict[str, logging.Logger] = {}

    @classmethod
    def get(cls, name: str, level: int = logging.INFO) -> logging.Logger:
        if name in cls._loggers:
            return cls._loggers[name]

        config.ensure_dirs()
        logger = logging.getLogger(name)
        logger.setLevel(level)
        logger.handlers = []
        logger.propagate = False

        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            "%Y-%m-%d %H:%M:%S",
        )

        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

        log_file = os.path.join(
            config.LOGS_DIR,
            f"{datetime.now().strftime(config.TIMESTAMP_FORMAT)}_{name}.log",
        )
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        cls._loggers[name] = logger
        return logger


logger = LoggerFactory.get("backup_recovery_drill")


def save_json(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, cls=JsonEncoder, indent=2, ensure_ascii=False)
    logger.info(f"已保存文件: {path}")


def load_json(path: str, default: Any = None) -> Any:
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def format_exception(e: Exception) -> Dict[str, Any]:
    return {
        "error_type": type(e).__name__,
        "error_message": str(e),
        "traceback": traceback.format_exc(),
    }


def format_table(data: List[Dict[str, Any]], headers: Optional[List[str]] = None) -> str:
    if not data:
        return "（无数据）"

    if headers is None:
        headers = list(data[0].keys())

    rows = []
    col_widths = {h: len(str(h)) for h in headers}
    for item in data:
        for h in headers:
            val = str(item.get(h, ""))
            col_widths[h] = max(col_widths[h], len(val))

    header_row = " | ".join(f"{str(h).ljust(col_widths[h])}" for h in headers)
    separator = "-+-".join("-" * col_widths[h] for h in headers)
    rows.append(header_row)
    rows.append(separator)

    for item in data:
        row_vals = [str(item.get(h, "")).ljust(col_widths[h]) for h in headers]
        rows.append(" | ".join(row_vals))

    return "\n".join(rows)


def get_timestamp() -> str:
    return datetime.now().strftime(config.TIMESTAMP_FORMAT)


def colorize(text: str, color: str = "white") -> str:
    colors = {
        "red": "\033[31m",
        "green": "\033[32m",
        "yellow": "\033[33m",
        "blue": "\033[34m",
        "white": "\033[37m",
        "reset": "\033[0m",
    }
    return f"{colors.get(color, colors['white'])}{text}{colors['reset']}"


def print_separator(title: str = "", length: int = 80) -> None:
    if title:
        border = length - len(title) - 4
        left = border // 2
        right = border - left
        print(f"\n{'=' * left} {title} {'=' * right}")
    else:
        print("=" * length)
