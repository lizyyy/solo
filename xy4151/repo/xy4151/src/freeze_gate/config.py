from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from .models import (
    CheckSeverity,
    ForbiddenRule,
    LengthBudget,
    PlaceholderRule,
    ProjectConfig,
)


class ConfigManager:
    CONFIG_FILENAME = "freeze-gate.yaml"
    
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.config_file = config_path / self.CONFIG_FILENAME
    
    def config_exists(self) -> bool:
        return self.config_file.exists()
    
    def save(self, config: ProjectConfig):
        data = self._config_to_dict(config)
        self.config_path.mkdir(parents=True, exist_ok=True)
        with open(self.config_file, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    def load(self) -> ProjectConfig:
        with open(self.config_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
        return self._dict_to_config(data)
    
    def _config_to_dict(self, config: ProjectConfig) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "name": config.name,
            "version": config.version,
            "source_language": config.source_language,
            "target_languages": config.target_languages,
            "output_directory": config.output_directory,
        }
        
        if config.placeholder_rules:
            data["placeholder_rules"] = [
                {
                    "pattern": r.pattern,
                    "description": r.description,
                    "example": r.example,
                    "allow_any_order": r.allow_any_order,
                    "preserve_case": r.preserve_case,
                }
                for r in config.placeholder_rules
            ]
        
        if config.length_budgets:
            data["length_budgets"] = {
                lang: {
                    "max_length": b.max_length,
                    "max_characters": b.max_characters,
                    "ratio_to_source": b.ratio_to_source,
                    "description": b.description,
                }
                for lang, b in config.length_budgets.items()
            }
        
        if config.forbidden_words:
            data["forbidden_words"] = [
                {
                    "word": fw.word,
                    "languages": fw.languages,
                    "severity": fw.severity.name,
                    "reason": fw.reason,
                }
                for fw in config.forbidden_words
            ]
        
        if config.resource_paths:
            data["resource_paths"] = config.resource_paths
        
        return data
    
    def _dict_to_config(self, data: Dict[str, Any]) -> ProjectConfig:
        placeholder_rules = []
        for rule_data in data.get("placeholder_rules", []):
            placeholder_rules.append(PlaceholderRule(
                pattern=rule_data.get("pattern", ""),
                description=rule_data.get("description", ""),
                example=rule_data.get("example", ""),
                allow_any_order=rule_data.get("allow_any_order", False),
                preserve_case=rule_data.get("preserve_case", True),
            ))
        
        length_budgets = {}
        for lang, budget_data in data.get("length_budgets", {}).items():
            length_budgets[lang] = LengthBudget(
                language=lang,
                max_length=budget_data.get("max_length", 100),
                max_characters=budget_data.get("max_characters", 100),
                ratio_to_source=budget_data.get("ratio_to_source", 1.0),
                description=budget_data.get("description", ""),
            )
        
        forbidden_words = []
        for fw_data in data.get("forbidden_words", []):
            severity_str = fw_data.get("severity", "ERROR").upper()
            severity = CheckSeverity[severity_str] if hasattr(CheckSeverity, severity_str) else CheckSeverity.ERROR
            forbidden_words.append(ForbiddenRule(
                word=fw_data.get("word", ""),
                languages=fw_data.get("languages", []),
                severity=severity,
                reason=fw_data.get("reason", ""),
            ))
        
        config = ProjectConfig(
            name=data.get("name", "Unnamed"),
            version=data.get("version", "1.0.0"),
            source_language=data.get("source_language", "zh-CN"),
            target_languages=data.get("target_languages", []),
            placeholder_rules=placeholder_rules,
            length_budgets=length_budgets,
            forbidden_words=forbidden_words,
            resource_paths=data.get("resource_paths", {}),
            output_directory=data.get("output_directory", "./output"),
        )
        
        if not config.placeholder_rules:
            config.placeholder_rules = config.default_placeholder_rules()
        
        return config
