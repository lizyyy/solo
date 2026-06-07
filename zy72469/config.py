import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DATA_DIR = os.path.join(DATA_DIR, 'raw')
PROCESSED_DATA_DIR = os.path.join(DATA_DIR, 'processed')
SAMPLES_DIR = os.path.join(BASE_DIR, 'samples')

for d in [DATA_DIR, RAW_DATA_DIR, PROCESSED_DATA_DIR, SAMPLES_DIR]:
    os.makedirs(d, exist_ok=True)

HEATMAP_GRID_SIZE = 50
EVENING_START_HOUR = 18
EVENING_END_HOUR = 6
MIN_SAMPLES_PER_HOUR = 3

ROLES = {
    'grid_inspector': '网格员',
    'project_manager': '城更项目经理',
    'street_planner': '街道规划员'
}
