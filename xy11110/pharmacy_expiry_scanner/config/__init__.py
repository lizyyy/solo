import yaml
import os
from pathlib import Path


def load_config(config_path=None):
    if config_path is None:
        config_path = Path(__file__).parent / "rules.yaml"
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    return config
