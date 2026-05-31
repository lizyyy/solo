import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

DATA_DIR = BASE_DIR / "data"
INPUT_DIR = DATA_DIR / "input"
OUTPUT_DIR = DATA_DIR / "output"
HISTORY_DIR = DATA_DIR / "history"
DB_PATH = DATA_DIR / "masking.db"

for dir_path in [DATA_DIR, INPUT_DIR, OUTPUT_DIR, HISTORY_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

SENSITIVE_PATTERNS = {
    "phone": r"1[3-9]\d{9}",
    "id_card": r"[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]",
    "email": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}",
    "name_catch": r"(?:先生|女士|小姐|同志)\s*[:：]\s*([\u4e00-\u9fa5]{2,4})",
    "address_catch": r"(?:地址|住址|居住地)\s*[:：]\s*([\u4e00-\u9fa50-9]+[^，。\n]{5,})",
    "order_no_catch": r"(?:ORD|order|订单号?)[_\-:：]*([A-Z0-9]{8,20})",
    "account_catch": r"(?:账号|账户|支付宝|微信|银行卡号?)[_\-:：]*([\dA-Za-z@.]{6,30})",
}

MASK_REPLACEMENTS = {
    "phone": lambda x: x[:3] + "****" + x[-4:],
    "id_card": lambda x: x[:6] + "********" + x[-4:],
    "email": lambda x: x[0] + "***" + x[x.find("@"):],
    "name": lambda x: "*" * len(x),
    "address": lambda x: x[:3] + "****" + x[-3:] if len(x) > 6 else "****",
    "order_no": lambda x: "***" + x[-4:],
    "account": lambda x: "***" + x[-4:],
}

SOURCE_TYPES = ["customer_service", "manual_review", "gray_record"]

STATUS_CODES = {
    "pending": "待处理",
    "processing": "处理中",
    "success": "处理成功",
    "warning": "有变更提醒",
    "failed": "处理失败",
    "duplicate": "重复提交",
}
