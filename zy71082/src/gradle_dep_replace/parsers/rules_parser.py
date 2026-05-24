from pathlib import Path
from typing import List, Dict, Any

import yaml

from ..models.replacement import ReplacementRule, MatchStrategy


class RulesParser:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.path = Path(file_path)

    def parse(self) -> List[ReplacementRule]:
        if not self.path.exists():
            raise FileNotFoundError(f"File not found: {self.file_path}")

        content = self.path.read_text(encoding="utf-8")

        if self.path.suffix in (".yaml", ".yml"):
            data = yaml.safe_load(content)
        elif self.path.suffix == ".json":
            import json
            data = json.loads(content)
        else:
            raise ValueError(f"Unsupported rules file format: {self.path.suffix}")

        rules = []
        rules_data = data.get("rules", []) if isinstance(data, dict) else data

        for rule_data in rules_data:
            rule = self._parse_rule(rule_data)
            if rule:
                rules.append(rule)

        rules.sort(key=lambda r: r.priority, reverse=True)
        return rules

    def _parse_rule(self, rule_data: Dict[str, Any]) -> ReplacementRule:
        strategy_str = rule_data.get("match_strategy", "exact").lower()
        try:
            strategy = MatchStrategy(strategy_str)
        except ValueError:
            strategy = MatchStrategy.EXACT

        return ReplacementRule(
            id=rule_data.get("id", rule_data.get("name", "")),
            name=rule_data.get("name", ""),
            description=rule_data.get("description"),
            match_strategy=strategy,
            match_pattern=rule_data.get("match_pattern", rule_data.get("pattern", "")),
            target_group=rule_data.get("target_group"),
            target_name=rule_data.get("target_name"),
            target_version=rule_data.get("target_version"),
            reason=rule_data.get("reason"),
            priority=rule_data.get("priority", 0),
            is_active=rule_data.get("is_active", True),
            source_file=str(self.path),
        )
