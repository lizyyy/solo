from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .utils import parse_size


@dataclass
class LayerBudget:
    max_size: int = 0
    warning_threshold: float = 0.8


@dataclass
class BudgetRules:
    total_max_size: int = 0
    layer_budget: LayerBudget = field(default_factory=LayerBudget)
    path_patterns: Dict[str, int] = field(default_factory=dict)
    cached_dirs: List[str] = field(default_factory=list)
    base_image_allowlist: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> "BudgetRules":
        rules = cls()

        total_max_size = data.get("total_max_size", 0)
        if isinstance(total_max_size, str):
            total_max_size = parse_size(total_max_size)
        rules.total_max_size = int(total_max_size)

        layer_budget_data = data.get("layer_budget", {})
        layer_max_size = layer_budget_data.get("max_size", 0)
        if isinstance(layer_max_size, str):
            layer_max_size = parse_size(layer_max_size)

        rules.layer_budget = LayerBudget(
            max_size=int(layer_max_size),
            warning_threshold=float(layer_budget_data.get("warning_threshold", 0.8)),
        )

        path_patterns = data.get("path_patterns", {})
        parsed_patterns = {}
        for pattern, size_limit in path_patterns.items():
            if isinstance(size_limit, str):
                size_limit = parse_size(size_limit)
            parsed_patterns[pattern] = int(size_limit)
        rules.path_patterns = parsed_patterns

        rules.cached_dirs = data.get("cached_dirs", [])
        rules.base_image_allowlist = data.get("base_image_allowlist", [])
        return rules


DEFAULT_BUDGET_RULES = BudgetRules(
    total_max_size=2 * 1024 * 1024 * 1024,
    layer_budget=LayerBudget(
        max_size=500 * 1024 * 1024,
        warning_threshold=0.8,
    ),
    path_patterns={
        "**/*.pyc": 10 * 1024 * 1024,
        "**/.git": 100 * 1024 * 1024,
        "**/node_modules": 500 * 1024 * 1024,
        "**/__pycache__": 50 * 1024 * 1024,
    },
    cached_dirs=[
        "/var/cache",
        "/root/.cache",
        "/root/.npm",
        "/root/.pip",
        "/tmp",
    ],
)
