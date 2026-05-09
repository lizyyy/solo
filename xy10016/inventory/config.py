import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'data'
LOG_DIR = BASE_DIR / 'logs'

DATABASE_URL = os.getenv(
    'INVENTORY_DB_URL',
    f'sqlite:///{DATA_DIR}/inventory.db'
)

TEST_DATABASE_URL = f'sqlite:///{DATA_DIR}/test_inventory.db'

for dir_path in [DATA_DIR, LOG_DIR]:
    dir_path.mkdir(exist_ok=True)

LOG_LEVEL = os.getenv('INVENTORY_LOG_LEVEL', 'INFO')
LOG_FILE = LOG_DIR / 'inventory.log'

MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY = 2
