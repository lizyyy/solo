import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

for dir_path in [DATA_DIR, OUTPUT_DIR, LOG_DIR]:
    os.makedirs(dir_path, exist_ok=True)

CONFIG = {
    'time_column': 'time',
    'value_column': 'rainfall',
    'station_column': 'station',
    
    'rainfall_unit': 'mm',
    
    'min_value': 0.0,
    'max_value': 1000.0,
    
    'min_interval': 5,
    
    'spike_threshold': 50.0,
    
    'neighbor_count': 3,
    
    'min_neighbor_overlap': 0.3,
    
    'min_valid_ratio': 0.5,
    
    'qc_tests': [
        'range_check',
        'spike_check',
        'constant_check',
        'logic_check'
    ],
    
    'interpolation_methods': [
        'linear',
        'polynomial',
        'spline',
        'neighbor_weighted'
    ],
    
    'random_seed': 42,
    
    'timestamp': datetime.now().strftime('%Y%m%d_%H%M%S')
}

QC_RULES = {
    'range_check': {
        'name': '值域范围检查',
        'description': '检查雨量值是否在合理范围内',
        'min_value': CONFIG['min_value'],
        'max_value': CONFIG['max_value']
    },
    'spike_check': {
        'name': '突刺检查',
        'description': '检测异常突刺值',
        'threshold': CONFIG['spike_threshold'],
        'window_size': 5
    },
    'constant_check': {
        'name': '恒值检查',
        'description': '检测连续相同值',
        'max_constant_count': 6,
        'min_value_threshold': 0.1
    },
    'logic_check': {
        'name': '逻辑一致性检查',
        'description': '检查与相邻站点的一致性',
        'max_diff_ratio': 3.0
    },
    'missing_check': {
        'name': '缺测检查',
        'description': '检查缺失值'
    },
    'duplicate_check': {
        'name': '重复检查',
        'description': '检查重复记录'
    },
    'format_check': {
        'name': '格式检查',
        'description': '检查数据格式和单位'
    }
}
