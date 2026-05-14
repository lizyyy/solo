from datetime import datetime, timedelta
import json


def generate_normal_batch():
    """生成正常的离线会员续费流水演示数据"""
    base_time = datetime.now()
    
    transactions = [
        {
            "sequence_no": 1,
            "member_id": "M001",
            "transaction_no": "TXN20240101001",
            "transaction_time": (base_time - timedelta(days=30)).isoformat(),
            "amount": 99.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 2,
            "member_id": "M001",
            "transaction_no": "TXN20240115001",
            "transaction_time": (base_time - timedelta(days=15)).isoformat(),
            "amount": 99.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 3,
            "member_id": "M002",
            "transaction_no": "TXN20240101002",
            "transaction_time": (base_time - timedelta(days=30)).isoformat(),
            "amount": 199.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 4,
            "member_id": "M002",
            "transaction_no": "TXN20240120001",
            "transaction_time": (base_time - timedelta(days=10)).isoformat(),
            "amount": 199.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 5,
            "member_id": "M003",
            "transaction_no": "TXN20240125001",
            "transaction_time": (base_time - timedelta(days=5)).isoformat(),
            "amount": 299.0,
            "transaction_type": "renewal"
        }
    ]
    
    return {
        "batch_no": "BATCH_NORMAL_001",
        "caller": "member_service",
        "transactions": transactions,
        "remark": "正常演示批次 - 全部记录时间顺序正确"
    }


def generate_batch_with_time_order_error():
    """生成包含时间顺序错误的演示数据"""
    base_time = datetime.now()
    
    transactions = [
        {
            "sequence_no": 1,
            "member_id": "M004",
            "transaction_no": "TXN20240101004",
            "transaction_time": (base_time - timedelta(days=30)).isoformat(),
            "amount": 99.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 2,
            "member_id": "M004",
            "transaction_no": "TXN20240120004",
            "transaction_time": (base_time - timedelta(days=10)).isoformat(),
            "amount": 99.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 3,
            "member_id": "M004",
            "transaction_no": "TXN20240115004",
            "transaction_time": (base_time - timedelta(days=15)).isoformat(),
            "amount": 99.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 4,
            "member_id": "M005",
            "transaction_no": "TXN20240101005",
            "transaction_time": (base_time - timedelta(days=30)).isoformat(),
            "amount": 199.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 5,
            "member_id": "M005",
            "transaction_no": "TXN20240125005",
            "transaction_time": (base_time - timedelta(days=5)).isoformat(),
            "amount": 199.0,
            "transaction_type": "renewal"
        }
    ]
    
    return {
        "batch_no": "BATCH_ERROR_001",
        "caller": "member_service",
        "transactions": transactions,
        "remark": "异常演示批次 - M004的第3条记录时间顺序错误"
    }


def generate_partial_success_batch():
    """生成部分成功的演示数据"""
    base_time = datetime.now()
    
    transactions = [
        {
            "sequence_no": 1,
            "member_id": "M006",
            "transaction_no": "TXN20240101006",
            "transaction_time": (base_time - timedelta(days=30)).isoformat(),
            "amount": 99.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 2,
            "member_id": "M006",
            "transaction_no": "TXN20240115006",
            "transaction_time": (base_time - timedelta(days=15)).isoformat(),
            "amount": -50.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 3,
            "member_id": "M007",
            "transaction_no": "TXN20240101007",
            "transaction_time": (base_time - timedelta(days=30)).isoformat(),
            "amount": 0.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 4,
            "member_id": "M007",
            "transaction_no": "TXN20240120007",
            "transaction_time": (base_time - timedelta(days=10)).isoformat(),
            "amount": 299.0,
            "transaction_type": "renewal"
        },
        {
            "sequence_no": 5,
            "member_id": "M008",
            "transaction_no": "TXN20240125008",
            "transaction_time": (base_time - timedelta(days=5)).isoformat(),
            "amount": 399.0,
            "transaction_type": "renewal"
        }
    ]
    
    return {
        "batch_no": "BATCH_PARTIAL_001",
        "caller": "member_service",
        "transactions": transactions,
        "remark": "部分成功演示批次 - 包含负数金额和零金额错误"
    }


def generate_manual_note_example():
    """生成人工备注示例"""
    return {
        "batch_no": "BATCH_ERROR_001",
        "detail_id": 3,
        "caller": "member_service",
        "note_content": "实验室样本单复核：M004的第3条记录确实存在时间顺序问题，已通知上游系统修正数据",
        "created_by": "qa_team",
        "note_type": "review_note"
    }


def generate_v1_rule():
    """生成v1版本规则"""
    return {
        "version": "v1.0",
        "rule_name": "基础验签规则",
        "description": "检查时间顺序和金额为正数",
        "rule_config": json.dumps({
            "check_time_order": True,
            "check_amount_positive": True,
            "version": "v1.0"
        }, ensure_ascii=False),
        "is_active": True,
        "created_by": "admin"
    }


def generate_v2_rule():
    """生成v2版本规则（放宽时间顺序检查）"""
    return {
        "version": "v2.0",
        "rule_name": "宽松验签规则",
        "description": "仅检查金额为正数，不检查时间顺序",
        "rule_config": json.dumps({
            "check_time_order": False,
            "check_amount_positive": True,
            "version": "v2.0"
        }, ensure_ascii=False),
        "is_active": False,
        "created_by": "admin"
    }


if __name__ == "__main__":
    print("=== 正常演示数据 ===")
    print(json.dumps(generate_normal_batch(), indent=2, ensure_ascii=False))
    
    print("\n=== 包含时间顺序错误的演示数据 ===")
    print(json.dumps(generate_batch_with_time_order_error(), indent=2, ensure_ascii=False))
    
    print("\n=== 部分成功演示数据 ===")
    print(json.dumps(generate_partial_success_batch(), indent=2, ensure_ascii=False))
