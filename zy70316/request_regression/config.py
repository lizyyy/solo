import os
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
import yaml


@dataclass
class DesensitizationRule:
    field: str
    pattern: Optional[str] = None
    replacement: str = "***"


@dataclass
class IgnoreRule:
    path: str
    reason: Optional[str] = None


@dataclass
class ServiceConfig:
    name: str
    type: str
    url: Optional[str] = None
    module: Optional[str] = None
    processor: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)


@dataclass
class ThresholdConfig:
    max_total_diffs: int = 100
    max_severity_score: float = 100.0
    max_response_time_diff_ms: int = 1000


@dataclass
class RegressionConfig:
    input_dir: str = "samples/raw"
    output_dir: str = "samples/processed"
    replay_results_dir: str = "results/replay"
    comparison_dir: str = "results/comparison"
    approvals_dir: str = "results/approvals"
    reports_dir: str = "results/reports"

    desensitization_rules: List[DesensitizationRule] = field(default_factory=list)
    ignore_rules: List[IgnoreRule] = field(default_factory=list)
    required_headers: List[str] = field(default_factory=list)
    groups: List[str] = field(default_factory=list)

    services: List[ServiceConfig] = field(default_factory=list)
    baseline_service: str = ""
    target_service: str = ""

    thresholds: ThresholdConfig = field(default_factory=ThresholdConfig)

    @classmethod
    def load(cls, path: str) -> "RegressionConfig":
        if not os.path.exists(path):
            return cls()

        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        desensitization_rules = [
            DesensitizationRule(**r) for r in data.get("desensitization_rules", [])
        ]
        ignore_rules = [IgnoreRule(**r) for r in data.get("ignore_rules", [])]
        services = [ServiceConfig(**s) for s in data.get("services", [])]
        thresholds = ThresholdConfig(**data.get("thresholds", {}))

        return cls(
            input_dir=data.get("input_dir", cls.input_dir),
            output_dir=data.get("output_dir", cls.output_dir),
            replay_results_dir=data.get("replay_results_dir", cls.replay_results_dir),
            comparison_dir=data.get("comparison_dir", cls.comparison_dir),
            approvals_dir=data.get("approvals_dir", cls.approvals_dir),
            reports_dir=data.get("reports_dir", cls.reports_dir),
            desensitization_rules=desensitization_rules,
            ignore_rules=ignore_rules,
            required_headers=data.get("required_headers", []),
            groups=data.get("groups", []),
            services=services,
            baseline_service=data.get("baseline_service", ""),
            target_service=data.get("target_service", ""),
            thresholds=thresholds,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "input_dir": self.input_dir,
            "output_dir": self.output_dir,
            "replay_results_dir": self.replay_results_dir,
            "comparison_dir": self.comparison_dir,
            "approvals_dir": self.approvals_dir,
            "reports_dir": self.reports_dir,
            "desensitization_rules": [asdict(r) for r in self.desensitization_rules],
            "ignore_rules": [asdict(r) for r in self.ignore_rules],
            "required_headers": self.required_headers,
            "groups": self.groups,
            "services": [asdict(s) for s in self.services],
            "baseline_service": self.baseline_service,
            "target_service": self.target_service,
            "thresholds": asdict(self.thresholds),
        }

    def save(self, path: str) -> None:
        dir_path = os.path.dirname(path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(self.to_dict(), f, default_flow_style=False, allow_unicode=True)

    def get_service(self, name: str) -> Optional[ServiceConfig]:
        for s in self.services:
            if s.name == name:
                return s
        return None
