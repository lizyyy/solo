import yaml
import os
from dataclasses import dataclass, field
from typing import List, Dict, Any


@dataclass
class Config:
    config_path: str = "config.yaml"
    _config: Dict[str, Any] = field(default_factory=dict, init=False)

    def __post_init__(self):
        self.load()
        self._ensure_directories()

    def load(self) -> None:
        if os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                self._config = yaml.safe_load(f)
        else:
            self._config = self._default_config()

    def _default_config(self) -> Dict[str, Any]:
        return {
            "battle_reports": {
                "input_dir": "data/raw_reports",
                "archive_dir": "data/archived_reports",
                "encoding": "utf-8",
            },
            "data": {
                "output_dir": "output",
                "backup_dir": "backup",
                "balance_file": "data/balance/balance_sheet.xlsx",
            },
            "export": {
                "default_format": "xlsx",
                "timestamp_format": "%Y%m%d_%H%M%S",
                "encoding": "utf-8-sig",
            },
            "validation": {
                "max_rounds": 30,
                "expected_teams": ["进攻方", "防守方"],
                "required_fields": ["回合", "阵营", "玩家ID", "行动类型", "结果"],
            },
            "anomaly_detection": {
                "enable_auto_detect": True,
                "damage_threshold": 5000,
                "healing_threshold": 3000,
                "score_gap_threshold": 1000,
            },
        }

    def _ensure_directories(self) -> None:
        dirs = [
            self.battle_report_input_dir,
            self.battle_report_archive_dir,
            self.output_dir,
            self.backup_dir,
            os.path.dirname(self.balance_file_path),
        ]
        for d in dirs:
            if d and not os.path.exists(d):
                os.makedirs(d, exist_ok=True)

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split(".")
        value = self._config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    @property
    def battle_report_input_dir(self) -> str:
        return self.get("battle_reports.input_dir", "data/raw_reports")

    @property
    def battle_report_archive_dir(self) -> str:
        return self.get("battle_reports.archive_dir", "data/archived_reports")

    @property
    def battle_report_encoding(self) -> str:
        return self.get("battle_reports.encoding", "utf-8")

    @property
    def output_dir(self) -> str:
        return self.get("data.output_dir", "output")

    @property
    def backup_dir(self) -> str:
        return self.get("data.backup_dir", "backup")

    @property
    def balance_file_path(self) -> str:
        return self.get("data.balance_file", "data/balance/balance_sheet.xlsx")

    @property
    def export_format(self) -> str:
        return self.get("export.default_format", "xlsx")

    @property
    def timestamp_format(self) -> str:
        return self.get("export.timestamp_format", "%Y%m%d_%H%M%S")

    @property
    def max_rounds(self) -> int:
        return self.get("validation.max_rounds", 30)

    @property
    def expected_teams(self) -> List[str]:
        return self.get("validation.expected_teams", ["进攻方", "防守方"])

    @property
    def required_fields(self) -> List[str]:
        return self.get("validation.required_fields", ["回合", "阵营", "玩家ID", "行动类型", "结果"])

    @property
    def damage_threshold(self) -> int:
        return self.get("anomaly_detection.damage_threshold", 5000)

    @property
    def healing_threshold(self) -> int:
        return self.get("anomaly_detection.healing_threshold", 3000)

    @property
    def score_gap_threshold(self) -> int:
        return self.get("anomaly_detection.score_gap_threshold", 1000)
