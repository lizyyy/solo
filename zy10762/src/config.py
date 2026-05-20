import yaml
from pathlib import Path
from typing import Dict, Any, Optional


class Config:
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config" / "default.yaml"
        
        config_file = Path(config_path)
        if not config_file.exists():
            raise FileNotFoundError(f"配置文件不存在: {config_path}")
        
        with open(config_file, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    @property
    def overlap_enabled(self) -> bool:
        return self.get('deduplication.overlap.enabled', True)

    @property
    def time_overlap_threshold(self) -> int:
        return self.get('deduplication.overlap.time_overlap_threshold', 5)

    @property
    def content_similarity_threshold(self) -> float:
        return self.get('deduplication.overlap.content_similarity_threshold', 0.85)

    @property
    def merge_strategy(self) -> str:
        return self.get('deduplication.overlap.merge_strategy', 'merge_evidence')

    @property
    def model_duplicate_enabled(self) -> bool:
        return self.get('deduplication.model_duplicate.enabled', True)

    @property
    def model_time_window(self) -> int:
        return self.get('deduplication.model_duplicate.time_window', 300)

    @property
    def confidence_diff_threshold(self) -> float:
        return self.get('deduplication.model_duplicate.confidence_diff_threshold', 0.1)

    @property
    def fp_recovery_enabled(self) -> bool:
        return self.get('deduplication.false_positive_recovery.enabled', True)

    @property
    def fp_marker_field(self) -> str:
        return self.get('deduplication.false_positive_recovery.fp_marker_field', 'is_false_positive')

    @property
    def keep_fp_with_marker(self) -> bool:
        return self.get('deduplication.false_positive_recovery.keep_fp_with_marker', True)

    @property
    def output_format(self) -> str:
        return self.get('output.format', 'json')

    @property
    def preserve_evidence_chain(self) -> bool:
        return self.get('output.preserve_evidence_chain', True)

    @property
    def include_source_info(self) -> bool:
        return self.get('output.include_source_info', True)

    def get_field(self, field_name: str) -> str:
        return self.get(f'fields.{field_name}', field_name)
