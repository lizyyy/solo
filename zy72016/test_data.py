SAMPLE_BATCH = {
    "batch_no": "MARGIN-2024-05-001",
    "name": "2024年5月外汇保证金穿仓复盘",
    "description": "包含正常记录、空值、重复项、边界记录的测试批次",
    "operator": "门店财务老曹"
}

SAMPLE_RECORDS = [
    {
        "record_no": "REC-001",
        "customer_name": "张三",
        "account_no": "ACC-10001",
        "currency": "USD",
        "margin_amount": 50000.0,
        "shortfall_amount": 12500.0,
        "payment_date": "2024-05-15",
        "payment_amount": 10000.0,
        "refund_amount": 0.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "合同扫描件备注：客户5月10日EUR/USD多单爆仓，穿仓12500美元，已电话通知客户。手写备注：老曹-5月16日已联系，客户承诺3天内补缴。",
        "manual_notes": [
            "收款流水：2024-05-15 收到10000美元，流水号TXN-20240515-001",
            "退款申请：无",
            "审批邮件：风控部李总审批通过，同意先追缴再处理后续"
        ]
    },
    {
        "record_no": "REC-002",
        "customer_name": "李四",
        "account_no": "ACC-10002",
        "currency": "EUR",
        "margin_amount": 80000.0,
        "shortfall_amount": 25000.0,
        "payment_date": "2024-05-18",
        "payment_amount": 25000.0,
        "refund_amount": 0.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "合同扫描件乱备注：李四GBP/JPY空单，5月17日跳空穿仓25000欧元。！！注意！！客户说是系统滑点导致，正在投诉中。别问老曹，问风控老王。",
        "manual_notes": [
            "收款流水：2024-05-18 收到25000欧元，流水号TXN-20240518-007",
            "审批邮件：待客户投诉处理完成后再确认"
        ]
    },
    {
        "record_no": "REC-001",
        "customer_name": "张三",
        "account_no": "ACC-10001",
        "currency": "USD",
        "margin_amount": 50000.0,
        "shortfall_amount": 12500.0,
        "payment_date": "2024-05-15",
        "payment_amount": 10000.0,
        "refund_amount": 0.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "重复导入的张三记录，测试重复检测功能",
        "manual_notes": []
    },
    {
        "record_no": "REC-003",
        "customer_name": "",
        "account_no": "ACC-10003",
        "currency": None,
        "margin_amount": 30000.0,
        "shortfall_amount": None,
        "payment_date": "",
        "payment_amount": None,
        "refund_amount": 0.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "空值测试记录：合同扫描件模糊，客户名称看不清，穿仓金额待确认。老曹注：需要找柜台小周核对原始单据。",
        "manual_notes": [
            "收款流水：无记录",
            "退款申请：无"
        ]
    },
    {
        "record_no": "REC-004",
        "customer_name": "王五",
        "account_no": "ACC-10004",
        "currency": "USD",
        "margin_amount": 100000.0,
        "shortfall_amount": 0.0,
        "payment_date": "2024-05-20",
        "payment_amount": 5000.0,
        "refund_amount": 0.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "边界测试：穿仓金额为0，实际是及时止损，没有穿仓。但系统误报，需要人工确认排除。",
        "manual_notes": [
            "收款流水：2024-05-20 收到5000美元保证金补充",
            "审批邮件：风控确认无穿仓，标记为正常"
        ]
    },
    {
        "record_no": "REC-005",
        "customer_name": "赵六",
        "account_no": "ACC-10005",
        "currency": "JPY",
        "margin_amount": 2000000.0,
        "shortfall_amount": -5000.0,
        "payment_date": "2024-05-22",
        "payment_amount": 100000.0,
        "refund_amount": 0.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "边界测试：穿仓金额为负数，说明客户账户还有盈余，可能是穿仓计算错误。老曹注：需要IT检查计算公式。",
        "manual_notes": []
    },
    {
        "record_no": "REC-006",
        "customer_name": "孙七",
        "account_no": "ACC-10006",
        "currency": "USD",
        "margin_amount": 200000.0,
        "shortfall_amount": 80000.0,
        "payment_date": "2024-05-25",
        "payment_amount": 50000.0,
        "refund_amount": 60000.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "边界测试：退款金额60000大于已缴金额50000，明显异常。可能是退款申请录入错误。",
        "manual_notes": [
            "退款申请：申请退款60000美元，申请人未知，需要核实"
        ]
    },
    {
        "record_no": "REC-007",
        "customer_name": "周八",
        "account_no": "ACC-10007",
        "currency": "GBP",
        "margin_amount": 150000.0,
        "shortfall_amount": 45000.0,
        "payment_date": "2024-05-10",
        "payment_amount": 30000.0,
        "refund_amount": 0.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "正常记录：周八GBP/USD多单穿仓45000英镑，已缴30000。手写备注：老曹-客户说下周补缴剩下15000。",
        "manual_notes": [
            "收款流水：2024-05-10 收到30000英镑，流水号TXN-20240510-015",
            "审批邮件：已审批，待客户补缴余款"
        ]
    },
    {
        "record_no": "REC-008",
        "customer_name": "吴九",
        "account_no": "ACC-10008",
        "currency": "USD",
        "margin_amount": 25000000.0,
        "shortfall_amount": 15000000.0,
        "payment_date": "2024-05-28",
        "payment_amount": 5000000.0,
        "refund_amount": 0.0,
        "source": "CONTRACT_SCAN",
        "contract_original_note": "边界测试：大额穿仓1500万美元，远超常规阈值，需要特别审批。手写备注：此单需总经理签字。",
        "manual_notes": [
            "收款流水：2024-05-28 收到500万美元，流水号TXN-20240528-088",
            "审批邮件：待总经理审批中"
        ]
    }
]

LATE_ATTACHMENT_REC007 = {
    "record_no": "REC-007",
    "customer_name": "周八",
    "account_no": "ACC-10007",
    "currency": "GBP",
    "margin_amount": 150000.0,
    "shortfall_amount": 15000.0,
    "payment_date": "2024-05-30",
    "payment_amount": 45000.0,
    "refund_amount": 0.0,
    "source": "LATE_ATTACHMENT",
    "contract_original_note": "",
    "note_content": "客户周八于5月30日补缴剩余15000英镑，穿仓已全额覆盖。原记录穿仓45000，已缴45000，应退0。",
    "manual_notes": [
        "晚到收款流水：2024-05-30 收到15000英镑，流水号TXN-20240530-112",
        "晚到审批邮件：财务确认已全额到账，可结案"
    ]
}

MANUAL_CONFIRMATIONS = [
    {"record_no": "REC-001", "new_status": "CONFIRMED", "change_reason": "客户已补缴，穿仓处理完毕", "operator": "门店财务老曹"},
    {"record_no": "REC-002", "new_status": "EXCEPTION", "change_reason": "客户投诉中，暂列为例外，待处理", "operator": "门店财务老曹"},
    {"record_no": "REC-003", "new_status": "NEEDS_CONFIRM", "change_reason": "空值太多，需要找小周核对后再处理", "operator": "门店财务老曹"},
    {"record_no": "REC-004", "new_status": "CONFIRMED", "change_reason": "穿仓为0，确认无误，排除", "operator": "门店财务老曹"},
    {"record_no": "REC-005", "new_status": "EXCEPTION", "change_reason": "穿仓负数，需IT检查计算公式", "operator": "门店财务老曹"},
    {"record_no": "REC-006", "new_status": "NEEDS_CONFIRM", "change_reason": "退款大于已缴，明显异常，需核实退款申请", "operator": "门店财务老曹"},
    {"record_no": "REC-008", "new_status": "NEEDS_CONFIRM", "change_reason": "大额穿仓，待总经理审批", "operator": "门店财务老曹"}
]
