import json
from pathlib import Path
from datetime import datetime, timedelta


def create_sample_files(output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now()
    
    payments = [
        {
            "order_id": "ORD-001",
            "user_id": "USER-001",
            "user_account": "alipay_001@example.com",
            "amount": 1000.00,
            "paid_at": (now - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S"),
            "currency": "CNY",
            "status": "success"
        },
        {
            "order_id": "ORD-002",
            "user_id": "USER-002",
            "user_account": "wechat_002",
            "amount": 500.00,
            "paid_at": (now - timedelta(days=20)).strftime("%Y-%m-%d %H:%M:%S"),
            "currency": "CNY",
            "status": "success"
        },
        {
            "order_id": "ORD-003",
            "user_id": "USER-003",
            "user_account": "alipay_003@example.com",
            "amount": 2000.00,
            "paid_at": (now - timedelta(days=15)).strftime("%Y-%m-%d %H:%M:%S"),
            "currency": "CNY",
            "status": "success"
        },
        {
            "order_id": "ORD-004",
            "user_id": "USER-004",
            "user_account": "blacklisted_user@example.com",
            "amount": 800.00,
            "paid_at": (now - timedelta(days=10)).strftime("%Y-%m-%d %H:%M:%S"),
            "currency": "CNY",
            "status": "success"
        },
        {
            "order_id": "ORD-005",
            "user_id": "USER-005",
            "user_account": "wechat_005",
            "amount": 300.00,
            "paid_at": (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
            "currency": "CNY",
            "status": "success"
        },
        {
            "order_id": "ORD-006",
            "user_id": "USER-006",
            "user_account": "alipay_006@example.com",
            "amount": 1500.00,
            "paid_at": (now - timedelta(days=45)).strftime("%Y-%m-%d %H:%M:%S"),
            "currency": "CNY",
            "status": "success"
        }
    ]
    
    blacklist = [
        {
            "account": "blacklisted_user@example.com",
            "reason": "历史多次恶意退款记录",
            "added_at": (now - timedelta(days=60)).strftime("%Y-%m-%d %H:%M:%S"),
            "added_by": "风控管理员",
            "is_active": True
        }
    ]
    
    approvals = [
        {
            "approval_id": "APR-001",
            "order_id": "ORD-001",
            "refund_request_id": "REQ-001",
            "approver": "张经理",
            "amount": 500.00,
            "status": "approved",
            "approved_at": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": (now + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
            "reason": "商品质量问题"
        },
        {
            "approval_id": "APR-002",
            "order_id": "ORD-002",
            "refund_request_id": "REQ-002",
            "approver": "张经理",
            "amount": 500.00,
            "status": "approved",
            "approved_at": (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": (now + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
            "reason": "用户申请退款"
        },
        {
            "approval_id": "APR-003",
            "order_id": "ORD-003",
            "refund_request_id": "REQ-003",
            "approver": "王主管",
            "amount": 2500.00,
            "status": "approved",
            "approved_at": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": (now + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
            "reason": "活动补偿"
        },
        {
            "approval_id": "APR-004",
            "order_id": "ORD-004",
            "refund_request_id": "REQ-004",
            "approver": "张经理",
            "amount": 800.00,
            "status": "approved",
            "approved_at": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": (now + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
            "reason": "商品损坏"
        },
        {
            "approval_id": "APR-006",
            "order_id": "ORD-006",
            "refund_request_id": "REQ-006",
            "approver": "张经理",
            "amount": 300.00,
            "status": "approved",
            "approved_at": (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            "reason": "重复订单"
        }
    ]
    
    historical_refunds = [
        {
            "refund_id": "REF-001",
            "order_id": "ORD-001",
            "amount": 300.00,
            "processed_at": (now - timedelta(days=10)).strftime("%Y-%m-%d %H:%M:%S"),
            "status": "success",
            "processor": "财务人员A"
        },
        {
            "refund_id": "REF-002",
            "order_id": "ORD-002",
            "amount": 500.00,
            "processed_at": (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
            "status": "success",
            "processor": "财务人员B"
        },
        {
            "refund_id": "REF-003",
            "order_id": "ORD-006",
            "amount": 800.00,
            "processed_at": (now - timedelta(days=20)).strftime("%Y-%m-%d %H:%M:%S"),
            "status": "success",
            "processor": "财务人员A"
        }
    ]
    
    refund_requests = [
        {
            "request_id": "REQ-001",
            "order_id": "ORD-001",
            "user_account": "alipay_001@example.com",
            "amount": 500.00,
            "reason": "商品质量问题，部分退款",
            "requested_at": (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
            "requested_by": "客服小王"
        },
        {
            "request_id": "REQ-002",
            "order_id": "ORD-002",
            "user_account": "wechat_002",
            "amount": 500.00,
            "reason": "用户申请全额退款",
            "requested_at": (now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"),
            "requested_by": "客服小李"
        },
        {
            "request_id": "REQ-003",
            "order_id": "ORD-003",
            "user_account": "alipay_003@example.com",
            "amount": 2500.00,
            "reason": "活动补偿退款",
            "requested_at": (now - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"),
            "requested_by": "运营小张"
        },
        {
            "request_id": "REQ-004",
            "order_id": "ORD-004",
            "user_account": "blacklisted_user@example.com",
            "amount": 800.00,
            "reason": "商品损坏",
            "requested_at": (now - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S"),
            "requested_by": "客服小王"
        },
        {
            "request_id": "REQ-005",
            "order_id": "ORD-005",
            "user_account": "wechat_005",
            "amount": 300.00,
            "reason": "未收到货",
            "requested_at": (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
            "requested_by": "客服小李"
        },
        {
            "request_id": "REQ-006",
            "order_id": "ORD-006",
            "user_account": "alipay_006@example.com",
            "amount": 300.00,
            "reason": "重复订单退款",
            "requested_at": (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            "requested_by": "运营小张"
        }
    ]
    
    files = {
        "payments.json": payments,
        "blacklist.json": blacklist,
        "approvals.json": approvals,
        "historical_refunds.json": historical_refunds,
        "refund_requests.json": refund_requests
    }
    
    for filename, data in files.items():
        file_path = output_dir / filename
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    return output_dir
