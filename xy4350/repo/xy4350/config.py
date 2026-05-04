import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, 'kiln_prechecker.db')
DATA_DIR = os.path.join(BASE_DIR, 'data')
EXPORT_DIR = os.path.join(BASE_DIR, 'exports')

# 确保目录存在
for directory in [DATA_DIR, EXPORT_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory)
