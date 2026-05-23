import json
from datetime import datetime

SAMPLE_CABINETS = [
    {"cabinet_no": "CAB001", "location": "A栋1楼大厅"},
    {"cabinet_no": "CAB002", "location": "B栋2楼办公室"},
    {"cabinet_no": "CAB003", "location": "C栋负一楼停车场"}
]

SAMPLE_SKUS = [
    {"sku_code": "SKU001", "sku_name": "农夫山泉500ml", "unit_price": 2.0},
    {"sku_code": "SKU002", "sku_name": "可口可乐330ml", "unit_price": 3.0},
    {"sku_code": "SKU003", "sku_name": "康师傅红烧牛肉面", "unit_price": 5.0},
    {"sku_code": "SKU004", "sku_name": "奥利奥饼干106g", "unit_price": 8.5},
    {"sku_code": "SKU005", "sku_name": "乐事薯片75g", "unit_price": 7.0}
]

def generate_replenishment_data(cabinet_no: str, batch_no: str, idempotent_key: str = None):
    return {
        "batch_no": batch_no,
        "cabinet_no": cabinet_no,
        "operator_id": "OP001",
        "operator_name": "张三",
        "idempotent_key": idempotent_key,
        "items": [
            {"sku_code": "SKU001", "sku_name": "农夫山泉500ml", "replenish_quantity": 30, "unit_price": 2.0},
            {"sku_code": "SKU002", "sku_name": "可口可乐330ml", "replenish_quantity": 20, "unit_price": 3.0},
            {"sku_code": "SKU003", "sku_name": "康师傅红烧牛肉面", "replenish_quantity": 15, "unit_price": 5.0}
        ],
        "damages": [
            {"sku_code": "SKU001", "sku_name": "农夫山泉500ml", "damage_type": "破损", "quantity": 2, "unit_price": 2.0, "reason": "运输途中瓶身破损"}
        ],
        "expired_removals": [
            {"sku_code": "SKU003", "sku_name": "康师傅红烧牛肉面", "quantity": 1, "unit_price": 5.0}
        ]
    }

def generate_settlement_data(settlement_no: str, cabinet_no: str, batch_no: str):
    return {
        "settlement_no": settlement_no,
        "cabinet_no": cabinet_no,
        "batch_no": batch_no
    }

def generate_manual_correction(target_type: str, target_id: int, reason: str = "盘点发现数据有误"):
    return {
        "target_type": target_type,
        "target_id": target_id,
        "operator_id": "ADMIN001",
        "operator_name": "管理员",
        "reason": reason,
        "correction_data": {
            "current_quantity": 100
        }
    }

if __name__ == "__main__":
    print("=== 样例数据生成器 ===")
    print("\n样例货柜:")
    print(json.dumps(SAMPLE_CABINETS, ensure_ascii=False, indent=2))

    print("\n样例补货数据:")
    print(json.dumps(generate_replenishment_data("CAB001", "BATCH001"), ensure_ascii=False, indent=2))
