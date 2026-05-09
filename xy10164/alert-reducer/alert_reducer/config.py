import os
import yaml
from typing import Dict, Any


DEFAULT_CONFIG = {
    "merge": {
        "window_minutes": 15,
        "merge_by": ["alertname", "severity", "job", "instance"],
        "count_threshold": 5
    },
    "suppression_rules": [],
    "escalation_strategies": [],
    "night_hours": {
        "start": "22:00",
        "end": "06:00"
    },
    "database": {
        "path": "sqlite:///alerts.db"
    },
    "logging": {
        "level": "INFO",
        "file": "alert_reducer.log",
        "log_to_file": True
    }
}


class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or self._find_config()
        self.config = self._load_config()
    
    def _find_config(self) -> str:
        """查找配置文件"""
        possible_paths = [
            os.path.join(os.getcwd(), "config.yaml"),
            os.path.join(os.path.expanduser("~"), ".alert_reducer", "config.yaml"),
            "/etc/alert_reducer/config.yaml"
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        # 返回默认路径
        return possible_paths[0]
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置"""
        config = DEFAULT_CONFIG.copy()
        
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    user_config = yaml.safe_load(f) or {}
                    self._deep_update(config, user_config)
            except Exception as e:
                print(f"警告: 加载配置文件失败: {e}")
                print("使用默认配置")
        
        return config
    
    def _deep_update(self, base: Dict, update: Dict):
        """深度更新字典"""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_update(base[key], value)
            else:
                base[key] = value
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置项"""
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value
    
    @property
    def merge_window_minutes(self) -> int:
        return self.get('merge.window_minutes', 15)
    
    @property
    def merge_by_fields(self) -> list:
        return self.get('merge.merge_by', ['alertname', 'severity', 'job', 'instance'])
    
    @property
    def merge_count_threshold(self) -> int:
        return self.get('merge.count_threshold', 5)
    
    @property
    def suppression_rules(self) -> list:
        return self.get('suppression_rules', [])
    
    @property
    def active_suppression_rules(self) -> list:
        return [r for r in self.suppression_rules if r.get('status') == 'active']
    
    @property
    def escalation_strategies(self) -> list:
        return self.get('escalation_strategies', [])
    
    @property
    def night_hours(self) -> Dict[str, str]:
        return self.get('night_hours', {'start': '22:00', 'end': '06:00'})
    
    @property
    def database_path(self) -> str:
        db_path = self.get('database.path', 'alerts.db')
        if not db_path.startswith('sqlite:///'):
            db_path = f'sqlite:///{db_path}'
        return db_path
    
    @property
    def logging_level(self) -> str:
        return self.get('logging.level', 'INFO')
    
    @property
    def logging_file(self) -> str:
        return self.get('logging.file', 'alert_reducer.log')
    
    @property
    def log_to_file(self) -> bool:
        return self.get('logging.log_to_file', True)
