import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///' + os.path.join(BASE_DIR, 'qc_appeal.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_AS_ASCII = False

    BATCH_STATUS_PENDING = 'pending'
    BATCH_STATUS_PROCESSING = 'processing'
    BATCH_STATUS_COMPLETED = 'completed'
    BATCH_STATUS_FAILED = 'failed'

    RECORD_STATUS_PENDING = 'pending'
    RECORD_STATUS_VALID = 'valid'
    RECORD_STATUS_ERROR = 'error'
    RECORD_STATUS_APPEALED = 'appealed'
    RECORD_STATUS_UPHELD = 'upheld'
    RECORD_STATUS_REVERSED = 'reversed'

    WRITEBACK_STATUS_PENDING = 'pending'
    WRITEBACK_STATUS_RUNNING = 'running'
    WRITEBACK_STATUS_SUCCESS = 'success'
    WRITEBACK_STATUS_FAILED = 'failed'
