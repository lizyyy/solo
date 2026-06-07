import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data_store")
EXPORT_DIR = os.path.join(BASE_DIR, "exports")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

PHONE_PATTERN = r'1[3-9]\d{9}'

SENSITIVE_FIELDS = ['phone', 'mobile', '手机号', '电话', '联系方式']

EXPORT_FIELDS = [
    '批次号', '会话ID', '知识片段ID', '原始问题', '当前口径',
    '标注员留言', '现场说法', '预警状态', '脱敏状态',
    '处理人', '处理时间', '证据来源'
]
