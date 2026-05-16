import json
import csv
from typing import List, Dict
from datetime import datetime, timedelta


def generate_channel_receipts() -> List[Dict]:
    """
    生成复核支付渠道回执样例数据
    包含正常数据、参数化问题、以及脏行被吞的异常场景
    """
    base_date = datetime.now()

    samples = []

    for i in range(1, 11):
        business_no = f"PAY{base_date.strftime('%Y%m%d')}{i:04d}"
        samples.append({
            "business_no": business_no,
            "channel_code": f"CH{i:03d}",
            "amount": 1000.00 + i * 100,
            "status": "success",
            "sql": f"SELECT * FROM payment_records WHERE business_no = ? AND channel_code = ?",
            "description": "正确使用参数化查询",
            "expected_result": "pass",
            "source": "支付宝渠道回执"
        })

    business_no = f"PAY{base_date.strftime('%Y%m%d')}0011"
    samples.append({
        "business_no": business_no,
        "channel_code": "CH011",
        "amount": 5000.00,
        "status": "success",
        "sql": "SELECT * FROM payment_records WHERE business_no = 'PAY202605160011'",
        "raw_sql_pattern": "字符串拼接: '...' + var",
        "description": "字符串拼接SQL - 注入风险",
        "expected_result": "fail",
        "source": "微信支付渠道回执"
    })

    business_no = f"PAY{base_date.strftime('%Y%m%d')}0012"
    samples.append({
        "business_no": business_no,
        "channel_code": "CH012",
        "amount": 3000.00,
        "status": "success",
        "sql": "SELECT * FROM payment_records WHERE amount > 1000 AND status = 'success'",
        "raw_sql_pattern": "f-string: f'...{var}...'",
        "description": "f-string格式化SQL - 注入风险",
        "expected_result": "fail",
        "source": "银联渠道回执"
    })

    business_no = f"PAY{base_date.strftime('%Y%m%d')}0013"
    samples.append({
        "business_no": business_no,
        "channel_code": "CH013",
        "amount": 2500.00,
        "status": "success",
        "sql": "SELECT * FROM payment_records WHERE channel_code = '%s'",
        "raw_sql_pattern": ".format(): '...%s...'.format(var)",
        "description": "format方法格式化SQL - 注入风险",
        "expected_result": "fail",
        "source": "京东支付渠道回执"
    })

    business_no = f"PAY{base_date.strftime('%Y%m%d')}0014"
    samples.append({
        "business_no": business_no,
        "channel_code": "CH014",
        "amount": 8000.00,
        "status": "success",
        "sql": "SELECT * FROM payment_records WHERE id = 12345",
        "raw_sql_pattern": "%格式化: '...%d...' % var",
        "description": "百分号格式化SQL - 注入风险",
        "expected_result": "fail",
        "source": "美团支付渠道回执"
    })

    business_no = f"DIRTY{base_date.strftime('%Y%m%d')}0099"
    samples.append({
        "business_no": business_no,
        "channel_code": "DIRTY",
        "amount": -99999.99,
        "status": "异常",
        "sql": "",
        "description": "脏数据 - 金额为负，SQL为空，业务单号格式异常",
        "expected_result": "skip",
        "source": "边缘节点清册-异常回执",
        "is_dirty": True
    })

    samples.append({
        "business_no": "",
        "channel_code": "CH016",
        "amount": 1500.00,
        "status": "success",
        "sql": "SELECT * FROM orders WHERE id = ?",
        "description": "脏数据 - 业务单号为空，会被吞掉",
        "expected_result": "swallowed",
        "source": "边缘节点清册-缺失业务单号",
        "is_dirty": True,
        "will_be_swallowed": True
    })

    return samples


def save_samples_to_json(samples: List[Dict], filepath: str):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(samples, f, ensure_ascii=False, indent=2)


def save_samples_to_csv(samples: List[Dict], filepath: str):
    if not samples:
        return
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=samples[0].keys())
        writer.writeheader()
        writer.writerows(samples)


def load_samples_from_file(filepath: str) -> List[Dict]:
    if filepath.endswith('.json'):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    elif filepath.endswith('.csv'):
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)
    else:
        raise ValueError("不支持的文件格式，请使用.json或.csv")


def get_default_sample_path() -> str:
    return "channel_receipts_sample.json"
