import yaml
import os
from typing import Dict, List, Any


class Config:
    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.yaml')
        self.config_path = config_path
        self._config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    @property
    def db_path(self) -> str:
        return self._config.get('database', {}).get('path', './member_tags.db')

    @property
    def source_priority(self) -> Dict[str, int]:
        priority_list = self._config.get('priority_rules', {}).get('source_priority', [])
        priority_dict = {}
        for item in priority_list:
            priority_dict.update(item)
        return priority_dict

    def get_source_priority(self, source: str) -> int:
        return self.source_priority.get(source, 0)

    @property
    def default_validity_days(self) -> int:
        return self._config.get('priority_rules', {}).get('default_validity_days', 90)

    @property
    def mutually_exclusive_tags(self) -> List[List[str]]:
        return self._config.get('mutually_exclusive_tags', [])

    def is_mutually_exclusive(self, tag1: str, tag2: str) -> bool:
        for group in self.mutually_exclusive_tags:
            if tag1 in group and tag2 in group and tag1 != tag2:
                return True
        return False

    @property
    def sources(self) -> Dict[str, str]:
        sources_list = self._config.get('sources', [])
        sources_dict = {}
        for item in sources_list:
            sources_dict[item['name']] = item['display_name']
        return sources_dict

    @property
    def require_reason_tags(self) -> List[str]:
        return self._config.get('require_reason_tags', [])

    def requires_reason(self, tag: str) -> bool:
        return tag in self.require_reason_tags

    def get_source_display_name(self, source: str) -> str:
        return self.sources.get(source, source)


_config_instance = None


def get_config() -> Config:
    global _config_instance
    if _config_instance is None:
        _config_instance = Config()
    return _config_instance
