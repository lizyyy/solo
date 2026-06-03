"""
多臂老虎机活动分流 - 配置文件
"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DOCS_DIR = os.path.join(BASE_DIR, 'docs')
SCRIPTS_DIR = os.path.join(BASE_DIR, 'scripts')
RESULTS_DIR = os.path.join(BASE_DIR, 'results')
HISTORY_DIR = os.path.join(RESULTS_DIR, 'history')

EPSILON = 0.1
DEFAULT_ALPHA = 1.0
DEFAULT_BETA = 1.0
