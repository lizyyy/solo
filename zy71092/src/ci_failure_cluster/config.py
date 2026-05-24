import os
from dataclasses import dataclass, field
from typing import List, Optional
import yaml


@dataclass
class ClusterConfig:
    similarity_threshold: float = 0.85
    min_cluster_size: int = 2
    max_tokens_per_signature: int = 50
    normalize_paths: bool = True
    normalize_hex: bool = True
    normalize_numbers: bool = True
    normalize_uuids: bool = True
    normalize_timestamps: bool = True
    stop_words: List[str] = field(default_factory=list)
    error_patterns: List[str] = field(default_factory=list)
    stack_frame_ignore: List[str] = field(default_factory=list)
    jitter_window_size: int = 10

    @classmethod
    def from_yaml(cls, path: str) -> "ClusterConfig":
        if not os.path.exists(path):
            return cls()
        with open(path, "r") as f:
            data = yaml.safe_load(f) or {}
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    @classmethod
    def default(cls) -> "ClusterConfig":
        instance = cls()
        instance.stop_words = [
            "error", "failed", "failure", "exception", "traceback",
            "file", "line", "in", "the", "a", "an", "to", "for",
        ]
        instance.error_patterns = [
            r"AssertionError",
            r"TimeoutError",
            r"ConnectionError",
            r"ImportError",
            r"ModuleNotFoundError",
            r"ValueError",
            r"TypeError",
            r"KeyError",
            r"IndexError",
            r"AttributeError",
            r"SyntaxError",
            r"RuntimeError",
            r"NotImplementedError",
        ]
        instance.stack_frame_ignore = [
            r"site-packages",
            r"dist-packages",
            r"node_modules",
            r"__pycache__",
            r"\.pyc$",
        ]
        return instance
