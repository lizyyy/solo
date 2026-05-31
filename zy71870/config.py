#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, 'data')
HISTORY_DIR = os.path.join(BASE_DIR, 'history')
REPORT_DIR = os.path.join(BASE_DIR, 'report')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')

for dir_path in [DATA_DIR, HISTORY_DIR, REPORT_DIR, TEMPLATE_DIR]:
    os.makedirs(dir_path, exist_ok=True)

ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

FAIRNESS_WEIGHTS = {
    'rest_time': 0.25,
    'back_to_back': 0.30,
    'venue_balance': 0.20,
    'opponent_strength': 0.25
}

UNIT_MAPPING = {
    'time': ['分钟', 'min', 'minute', '小时', 'hour', 'h'],
    'distance': ['米', 'm', 'meter', '公里', 'km', 'kilometer'],
    'count': ['场', '次', '个', '局', '盘'],
}

RESPONSIBLE_PERSONS = {
    'experiment_data': '数据采集组 (小李)',
    'constraint_spec': '规则制定组 (王教练)',
    'parameter_tuning': '主教练 (张指导)'
}
