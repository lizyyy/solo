import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
STORAGE_DIR = os.path.join(BASE_DIR, 'storage')
EXPORT_DIR = os.path.join(BASE_DIR, 'exports')

MAX_MACHINE_HOURS_PER_DAY = 12
MAX_CONSECUTIVE_DAYS = 3
DISINFECTION_INTERVAL_HOURS = 48
WATER_QUALITY_THRESHOLDS = {
    'conductivity': 0.1,
    'bacteria_count': 100,
    'endotoxin': 0.03
}
RISK_PATIENT_TYPES = ['乙肝', '丙肝', '梅毒', 'HIV']

for dir_path in [DATA_DIR, STORAGE_DIR, EXPORT_DIR]:
    os.makedirs(dir_path, exist_ok=True)
