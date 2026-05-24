import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional


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
        rules.total_max_size = data.get("total_max_size", 0)
        rules.layer_budget = LayerBudget(
            max_size=data.get("layer_budget", {}).get("max_size", 0),
            warning_threshold=data.get("layer_budget", {}).get("warning_threshold", 0.8),
        )
        rules.path_patterns = data.get("path_patterns", {})
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
