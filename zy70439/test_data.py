import json
from models import RiskType

def generate_receipt_data():
    records = [
        {
            "business_order_no": "BIZ2024010001",
            "channel": "ALIPAY",
            "payer_account": "user1@example.com",
            "payee_account": "merchant@shop.com",
            "amount": 1500.00,
            "receipt_no": "RCPT202401150001",
            "receipt_time": "2024-01-15 10:30:00",
            "operator": "admin",
            "risk_type": RiskType.NORMAL,
            "exception_desc": None
        },
        {
            "business_order_no": "BIZ2024010001",
            "channel": "ALIPAY",
            "payer_account": "user1@example.com",
            "payee_account": "merchant@shop.com",
            "amount": 1500.00,
            "receipt_no": "RCPT202401150001",
            "receipt_time": "2024-01-15 10:30:00",
            "operator": "admin",
            "risk_type": RiskType.DUPLICATE_SUBMISSION,
            "exception_desc": "回执号重复提交，该回执已于5分钟前处理完成"
        },
        {
            "business_order_no": "BIZ2024010002",
            "channel": "WECHAT",
            "payer_account": "o123456789",
            "payee_account": "mch_987654321",
            "amount": 2800.50,
            "receipt_no": "RCPT202401150002",
            "receipt_time": "2024-01-15 11:20:00",
            "operator": "admin",
            "risk_type": RiskType.NORMAL,
            "exception_desc": None
        },
        {
            "business_order_no": "BIZ2024010003",
            "channel": "UNIONPAY",
            "payer_account": "622202****1234",
            "payee_account": "622202****5678",
            "amount": 5000.00,
            "receipt_no": "RCPT202401150003",
            "receipt_time": "2024-01-15 14:00:00",
            "operator": "operator1",
            "risk_type": RiskType.AMOUNT_MISMATCH,
            "exception_desc": "回执金额5000.00与订单金额4800.00不符，差异200.00元"
        },
        {
            "business_order_no": "BIZ2024010004",
            "channel": "ALIPAY",
            "payer_account": "user2@example.com",
            "payee_account": "merchant@shop.com",
            "amount": 3200.00,
            "receipt_no": "RCPT202401150004",
            "receipt_time": "2024-01-15 15:30:00",
            "operator": "operator1",
            "risk_type": RiskType.NORMAL,
            "exception_desc": None
        },
        {
            "business_order_no": "BIZ2024010005",
            "channel": "WECHAT",
            "payer_account": "o987654321",
            "payee_account": "mch_123456789",
            "amount": 1800.00,
            "receipt_no": "RCPT202401150005",
            "receipt_time": "2024-01-15 16:45:00",
            "operator": "operator2",
            "risk_type": RiskType.ACCOUNT_MISMATCH,
            "exception_desc": "收款方账号与系统备案账号不一致"
        },
        {
            "business_order_no": "BIZ2024010005",
            "channel": "WECHAT",
            "payer_account": "o987654321",
            "payee_account": "mch_correct001",
            "amount": 1800.00,
            "receipt_no": "RCPT202401150006",
            "receipt_time": "2024-01-15 16:46:00",
            "operator": "operator2",
            "risk_type": RiskType.NORMAL,
            "exception_desc": None
        },
        {
            "business_order_no": "BIZ2024010006",
            "channel": "UNIONPAY",
            "payer_account": "622202****9999",
            "payee_account": "622202****1111",
            "amount": 10000.00,
            "receipt_no": "RCPT202401150007",
            "receipt_time": "2024-01-15 09:00:00",
            "operator": "admin",
            "risk_type": RiskType.TIMEOUT,
            "exception_desc": "渠道回执超时，超过48小时未收到确认"
        }
    ]
    
    return {
        "operator": "admin",
        "batch_name": "2024年1月15日支付渠道复核批次",
        "records": records
    }

def generate_duplicate_batch():
    data = generate_receipt_data()
    data["batch_name"] = "重复提交测试批次"
    return data

def generate_small_batch():
    return {
        "operator": "test_user",
        "batch_name": "小批量测试",
        "records": [
            {
                "business_order_no": "TEST001",
                "channel": "ALIPAY",
                "payer_account": "test@test.com",
                "payee_account": "payee@test.com",
                "amount": 100.00,
                "receipt_no": "TEST001",
                "receipt_time": "2024-01-01 00:00:00",
                "operator": "test_user",
                "risk_type": RiskType.NORMAL,
                "exception_desc": None
            }
        ]
    }


if __name__ == "__main__":
    data = generate_receipt_data()
    print(json.dumps(data, indent=2, ensure_ascii=False))
