"""
Sample数据目录
"""
import os

SAMPLE_DIR = os.path.dirname(os.path.abspath(__file__))

PROTECTION_CSV = os.path.join(SAMPLE_DIR, 'protection_actions.csv')
SAMPLING_JSONL = os.path.join(SAMPLE_DIR, 'sampling_data.jsonl')
SETTINGS_YAML = os.path.join(SAMPLE_DIR, 'protection_settings.yaml')
INVENTORY_YAML = os.path.join(SAMPLE_DIR, 'device_inventory.yaml')
