import os
import sys

APP_NAME = '器械包追踪台'
APP_VERSION = '1.0.0'

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = os.path.join(DATA_DIR, 'sterilization.db')

DEFAULT_OPERATOR = '系统'

STATUS_COLORS = {
    '待灭菌': '#FFC107',
    '灭菌中': '#2196F3',
    '待放行': '#FF9800',
    '已放行': '#4CAF50',
    '已领用': '#9E9E9E',
    '已隔离': '#F44336',
    '已报废': '#607D8B'
}
