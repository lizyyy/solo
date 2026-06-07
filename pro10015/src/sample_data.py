import pandas as pd
from datetime import datetime, timedelta


def generate_normal_sample() -> dict:
    base_date = datetime(2026, 6, 1)
    
    manager_notes = pd.DataFrame([
        {
            "customer_id": "C001",
            "customer_name": "张三",
            "account_no": "622202****1234",
            "dispute_amount": 5000.00,
            "note": "客户反馈5月28日POS消费非本人交易，已报案",
            "manager": "李经理",
            "record_time": base_date + timedelta(hours=9, minutes=30),
            "frozen": True
        },
        {
            "customer_id": "C002",
            "customer_name": "李四",
            "account_no": "622202****5678",
            "dispute_amount": 12000.50,
            "note": "境外盗刷，已联系卡组织",
            "manager": "王经理",
            "record_time": base_date + timedelta(hours=10, minutes=15),
            "frozen": True
        }
    ])
    
    counter_trans = pd.DataFrame([
        {
            "trans_id": "T20260601001",
            "customer_id": "C001",
            "customer_name": "张三",
            "account_no": "622202****1234",
            "trans_amount": 5000.00,
            "trans_type": "冻结",
            "trans_time": base_date + timedelta(hours=9, minutes=45),
            "operator": "柜员A"
        },
        {
            "trans_id": "T20260601002",
            "customer_id": "C002",
            "customer_name": "李四",
            "account_no": "622202****5678",
            "trans_amount": 12000.50,
            "trans_type": "冻结",
            "trans_time": base_date + timedelta(hours=10, minutes=30),
            "operator": "柜员B"
        }
    ])
    
    valuation_records = pd.DataFrame([
        {
            "valuation_id": "V20260601001",
            "customer_id": "C001",
            "account_no": "622202****1234",
            "dispute_amount": 5000.00,
            "valuation_amount": 5000.00,
            "version": 1,
            "manual_note": "交易时间与客户行程不符，支持拒付",
            "valuator": "估值员甲",
            "valuation_time": base_date + timedelta(hours=14, minutes=0)
        },
        {
            "valuation_id": "V20260601002",
            "customer_id": "C002",
            "account_no": "622202****5678",
            "dispute_amount": 12000.50,
            "valuation_amount": 12000.50,
            "version": 1,
            "manual_note": "境外IP，客户提供不在场证明",
            "valuator": "估值员乙",
            "valuation_time": base_date + timedelta(hours=15, minutes=30)
        }
    ])
    
    return {
        "name": "正常路径样例 - 数据完全匹配",
        "description": "客户经理备注、柜台流水、估值记录三方数据一致，无冲突",
        "manager_notes": manager_notes,
        "counter_trans": counter_trans,
        "valuation_records": valuation_records
    }


def generate_abnormal_sample_mismatch() -> dict:
    base_date = datetime(2026, 6, 2)
    
    manager_notes = pd.DataFrame([
        {
            "customer_id": "C003",
            "customer_name": "王五",
            "account_no": "622202****9012",
            "dispute_amount": 8000.00,
            "note": "客户称网银转账非本人操作",
            "manager": "赵经理",
            "record_time": base_date + timedelta(hours=9, minutes=0),
            "frozen": True
        },
        {
            "customer_id": "C003",
            "customer_name": "王五",
            "account_no": "622202****3456",
            "dispute_amount": 3500.00,
            "note": "同一客户另一账号也有异常",
            "manager": "赵经理",
            "record_time": base_date + timedelta(hours=9, minutes=5),
            "frozen": True
        }
    ])
    
    counter_trans = pd.DataFrame([
        {
            "trans_id": "T20260602001",
            "customer_id": "C003",
            "customer_name": "王五",
            "account_no": "622202****9012",
            "trans_amount": 7500.00,
            "trans_type": "冻结",
            "trans_time": base_date + timedelta(hours=9, minutes=20),
            "operator": "柜员C"
        }
    ])
    
    valuation_records = pd.DataFrame([
        {
            "valuation_id": "V20260602001",
            "customer_id": "C003",
            "account_no": "622202****9012",
            "dispute_amount": 8000.00,
            "valuation_amount": 8000.00,
            "version": 1,
            "manual_note": "",
            "valuator": "估值员甲",
            "valuation_time": base_date + timedelta(hours=11, minutes=0)
        }
    ])
    
    return {
        "name": "异常路径样例 - 多账号+金额不匹配+缺备注",
        "description": "同一客户2个账号：金额不匹配（备注8000 vs 流水7500）、第二个账号无流水、估值缺少人工备注",
        "manager_notes": manager_notes,
        "counter_trans": counter_trans,
        "valuation_records": valuation_records
    }


def generate_abnormal_sample_conflict() -> dict:
    base_date = datetime(2026, 6, 3)
    
    manager_notes = pd.DataFrame([
        {
            "customer_id": "C004",
            "customer_name": "赵六",
            "account_no": "622202****7890",
            "dispute_amount": 25000.00,
            "note": "理财赎回争议，客户称未操作",
            "manager": "孙经理",
            "record_time": base_date + timedelta(hours=14, minutes=0),
            "frozen": False
        },
        {
            "customer_id": "C005",
            "customer_name": "钱七",
            "account_no": "622202****2468",
            "dispute_amount": 1500.00,
            "note": "小额重复扣款",
            "manager": "周经理",
            "record_time": base_date + timedelta(hours=15, minutes=30),
            "frozen": True
        }
    ])
    
    counter_trans = pd.DataFrame([
        {
            "trans_id": "T20260603001",
            "customer_id": "C004",
            "customer_name": "赵六",
            "account_no": "622202****7890",
            "trans_amount": 25000.00,
            "trans_type": "冻结",
            "trans_time": base_date + timedelta(hours=14, minutes=30),
            "operator": "柜员D"
        },
        {
            "trans_id": "T20260603002",
            "customer_id": "C005",
            "customer_name": "钱七",
            "account_no": "622202****2468",
            "trans_amount": 1500.00,
            "trans_type": "冻结",
            "trans_time": base_date + timedelta(hours=16, minutes=0),
            "operator": "柜员E"
        },
        {
            "trans_id": "T20260603003",
            "customer_id": "C006",
            "customer_name": "孙八",
            "account_no": "622202****1357",
            "trans_amount": 3000.00,
            "trans_type": "冻结",
            "trans_time": base_date + timedelta(hours=16, minutes=30),
            "operator": "柜员F"
        }
    ])
    
    valuation_records = pd.DataFrame([
        {
            "valuation_id": "V20260603001",
            "customer_id": "C004",
            "account_no": "622202****7890",
            "dispute_amount": 25000.00,
            "valuation_amount": 20000.00,
            "version": 2,
            "manual_note": "经核查，其中5000元为客户本人操作，调整估值",
            "valuator": "估值员丙",
            "valuation_time": base_date + timedelta(hours=17, minutes=0)
        },
        {
            "valuation_id": "V20260603002",
            "customer_id": "C005",
            "account_no": "622202****2468",
            "dispute_amount": 1500.00,
            "valuation_amount": 1500.00,
            "version": 1,
            "manual_note": "确认系统重复扣款，支持全额退回",
            "valuator": "估值员甲",
            "valuation_time": base_date + timedelta(hours=17, minutes=30)
        }
    ])
    
    return {
        "name": "异常路径样例 - 估值冲突+流水多余",
        "description": "估值金额与备注不一致（备注25000 vs 估值20000）、柜台流水有C006但无对应备注",
        "manager_notes": manager_notes,
        "counter_trans": counter_trans,
        "valuation_records": valuation_records
    }


def get_all_samples() -> list:
    return [
        generate_normal_sample(),
        generate_abnormal_sample_mismatch(),
        generate_abnormal_sample_conflict()
    ]
