from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DEMO_DIR = DATA_DIR / "demo"
UPLOAD_DIR = DATA_DIR / "uploads"

REVIEW_STATUSES = [
    "待导入",
    "待复核",
    "补录中",
    "客户经理复核",
    "已完成"
]

ISSUE_TYPES = [
    "审批人拼音",
    "缺少除权日截图",
    "金额不匹配",
    "日期不匹配"
]

NEXT_STEPS = [
    "联系客户经理",
    "联系基金会计林姐",
    "补录材料",
    "系统重跑"
]

DATA_DIR.mkdir(exist_ok=True)
DEMO_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

