import yaml
import os
from pathlib import Path

DEFAULT_CONFIG = {
    'retention_period_days': 48,
    'holiday_file': 'config/holidays_2025.csv',
    'box_number_prefix': 'GD',
    'output_dir': 'output',
    'strict_mode': False,
    'duplicate_warning_only': True
}

def load_config(config_path=None):
    if config_path is None:
        config_path = Path(__file__).parent.parent / 'config' / 'default.yaml'
    
    config = DEFAULT_CONFIG.copy()
    
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            user_config = yaml.safe_load(f)
            if user_config:
                config.update(user_config)
    
    return config
