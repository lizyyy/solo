from dataclasses import dataclass, field
from typing import Optional
import yaml
from pathlib import Path


@dataclass
class DeduplicationConfig:
    text_similarity_threshold: float = 0.92
    score_diff_threshold: float = 0.05
    time_window_hours: int = 24
    consider_model_version: bool = True
    consider_problem_id: bool = True


@dataclass
class ConflictConfig:
    label_conflict_threshold: float = 0.7
    auto_flag_score_gap: float = 0.3


@dataclass
class ReportConfig:
    include_raw_sources: bool = True
    show_model_vs_human: bool = True
    highlight_boundary_cases: bool = True


@dataclass
class AppConfig:
    deduplication: DeduplicationConfig = field(default_factory=DeduplicationConfig)
    conflict: ConflictConfig = field(default_factory=ConflictConfig)
    report: ReportConfig = field(default_factory=ReportConfig)

    @classmethod
    def load_from_yaml(cls, config_path: Path) -> "AppConfig":
        with open(config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        dedup_data = data.get("deduplication", {})
        conflict_data = data.get("conflict_detection", {})
        report_data = data.get("report", {})

        return cls(
            deduplication=DeduplicationConfig(**dedup_data),
            conflict=ConflictConfig(**conflict_data),
            report=ReportConfig(**report_data),
        )
