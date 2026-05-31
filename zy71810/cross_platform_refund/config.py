from pathlib import Path

BASE_DIR = Path(__file__).parent

DATA_DIR = BASE_DIR / "data"
SAMPLES_DIR = DATA_DIR / "samples"
INPUT_DIR = DATA_DIR / "input"
OUTPUT_DIR = DATA_DIR / "output"

for d in [SAMPLES_DIR, INPUT_DIR, OUTPUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

RECONCILIATION_COLS = {
    "required": ["交易流水号", "交易时间", "交易金额", "支付平台"],
    "optional": ["商户订单号", "用户账号", "商品名称", "备注"]
}

REFUND_FLOW_COLS = {
    "required": ["退款流水号", "原交易流水号", "退款金额", "退款时间", "退款状态"],
    "optional": ["退款原因", "操作人", "备注"]
}

SUPPLEMENT_STATUS = {
    "PENDING": "待补录",
    "CONFIRMED": "已确认",
    "MANUAL_MODIFIED": "人工修改",
    "REVOKED": "已撤回"
}

STATUS_COLORS = {
    "待补录": "yellow",
    "已确认": "green",
    "人工修改": "blue",
    "已撤回": "red"
}

EXPORT_FORMATS = ["xlsx", "csv"]
