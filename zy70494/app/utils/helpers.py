import hashlib
import uuid
from datetime import datetime

def generate_batch_id(prefix='BATCH'):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique_id = str(uuid.uuid4())[:8].upper()
    return f'{prefix}_{timestamp}_{unique_id}'

def generate_report_code(prefix='RPT'):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique_id = str(uuid.uuid4())[:8].upper()
    return f'{prefix}_{timestamp}_{unique_id}'

def calculate_hash(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()

def generate_rerun_flag(execution_id):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f'RE_RUN_{execution_id}_{timestamp}'
