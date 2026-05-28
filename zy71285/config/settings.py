"""
全局配置
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT_CONFIG = {
    'sound_speed': 343.0,
    'min_frequency': 20.0,
    'max_frequency': 200.0,
    'frequency_tolerance': 0.5,
    'risk_levels': {
        'critical': 5.0,
        'warning': 10.0,
        'normal': 20.0
    },
    'output_dir': 'output',
    'history_dir': 'history',
    'input_dir': 'input'
}
