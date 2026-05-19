import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'security_management.db')
DATA_DIR = os.path.join(BASE_DIR, 'data')
EXPORT_DIR = os.path.join(BASE_DIR, 'exports')
ERROR_DIR = os.path.join(BASE_DIR, 'errors')

ROLES = ['security_supervisor', 'gate_guard', 'auditor']

for directory in [DATA_DIR, EXPORT_DIR, ERROR_DIR]:
    os.makedirs(directory, exist_ok=True)
