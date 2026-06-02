from models import TailAdjustmentEntry, CustodianConfirmation, DividendStatus


DEMO_TAIL_ADJUSTMENTS = [
    TailAdjustmentEntry(
        id="DIV001",
        stock_code="00700.HK",
        stock_name="腾讯控股",
        amount_str="HKD 125,000.00",
        ex_date="2024-06-15",
        record_date="2024-06-20",
        status=DividendStatus.PENDING,
        remark="",
    ),
    TailAdjustmentEntry(
        id="DIV002",
        stock_code="03690.HK",
        stock_name="美团-W",
        amount_str="港币人民币 89,500.00",
        ex_date="2024-06-15",
        record_date="2024-06-20",
        status=DividendStatus.PENDING,
        remark="",
    ),
    TailAdjustmentEntry(
        id="DIV003",
        stock_code="00941.HK",
        stock_name="中国移动",
        amount_str="56,200.00",
        ex_date="2024-03-20",
        record_date="2024-03-25",
        status=DividendStatus.PENDING,
        remark="",
    ),
]


DEMO_CUSTODIAN_CONFIRMATIONS = [
    CustodianConfirmation(
        id="CONF003",
        entry_id="DIV003",
        confirmed_amount=56200.00,
        confirmed_currency="HKD",
        is_old_standard=True,
        confirmation_date="2024-06-18",
        custodian_remark="2024Q1股息，按旧口径计算，因系统切换延迟补传",
    ),
]


DEMO_MANUAL_CORRECTION = {
    "entry_id": "DIV002",
    "new_currency": "HKD",
    "new_amount": 89500.00,
    "operator": "阿芬",
    "reason": "托管对接人李经理电话确认：该笔全部为港币，人民币标注为笔误",
}
