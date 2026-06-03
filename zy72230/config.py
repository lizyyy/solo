import os
from datetime import datetime, date

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DATA_DIR = os.path.join(DATA_DIR, 'raw')
PROCESSED_DATA_DIR = os.path.join(DATA_DIR, 'processed')
SCREENSHOT_DIR = os.path.join(DATA_DIR, 'screenshots')
LOG_DIR = os.path.join(BASE_DIR, 'logs')
REPORT_DIR = os.path.join(BASE_DIR, 'reports')
SCRIPT_DIR = os.path.join(BASE_DIR, 'scripts')

BUSINESS_DATE = date(2026, 6, 2)
EX_RIGHTS_DATE = date(2026, 6, 1)

TAX_RATE_NEW = 0.001
TAX_RATE_OLD = 0.0008
TAX_RATE_REMARK = "2026年6月起印花税由0.08%调整为0.1%，旧口径补录数据仍按原税率计算"

BROKER_FEE_RATE = 0.0002
MANAGEMENT_FEE_RATE = 0.00002

NORMAL_BIZ_IDS = ["BIZ20260601001"]
SPLIT_BIZ_IDS = ["BIZ20260601002"]
SUPPLEMENT_BIZ_IDS = ["BIZ20260601003"]

REVIEW_STATUS = {
    'PENDING': '待复核',
    'NORMAL': '正常',
    'SPLIT_REVIEW': '拆分行待主管复核',
    'SUPPLEMENTED': '已补录',
    'REJECTED': '已驳回'
}

for d in [DATA_DIR, RAW_DATA_DIR, PROCESSED_DATA_DIR, SCREENSHOT_DIR, LOG_DIR, REPORT_DIR, SCRIPT_DIR]:
    os.makedirs(d, exist_ok=True)
