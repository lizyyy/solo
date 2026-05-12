from datetime import datetime, timedelta
from src.utils.storage import storage


def timestamp_now() -> str:
    return datetime.now().isoformat()


def create_sample_activity() -> dict:
    now = datetime.now()
    return {
        "activity_id": "ACT_2026_SPRING",
        "name": "2026春季满赠活动",
        "start_time": (now - timedelta(days=7)).isoformat(),
        "end_time": (now + timedelta(days=30)).isoformat(),
        "threshold_amount": 500.0,
        "gift_sku": "GIFT_SK001",
        "gift_name": "精美保温杯",
        "gift_qty_per_order": 1,
        "is_active": True,
        "description": "单笔订单满500元即送精美保温杯1个",
        "return_deduct_rule": "amount_below_threshold",
        "max_reissue_count": 1,
        "created_at": timestamp_now(),
        "updated_at": timestamp_now()
    }


def create_sample_inventory() -> list:
    return [
        {
            "sku": "GIFT_SK001",
            "name": "精美保温杯",
            "total_qty": 100,
            "available_qty": 100,
            "allocated_qty": 0,
            "shipped_qty": 0,
            "returned_qty": 0,
            "reissued_qty": 0,
            "created_at": timestamp_now(),
            "updated_at": timestamp_now()
        }
    ]


def create_scenario_orders() -> list:
    return [
        {
            "order_id": "ORD_001_NORMAL",
            "user_id": "USER_001",
            "total_amount": 699.0,
            "paid_amount": 699.0,
            "status": "已支付",
            "created_at": timestamp_now(),
            "updated_at": timestamp_now(),
            "items": [
                {
                    "sku": "PROD_A001",
                    "name": "春季连衣裙",
                    "price": 699.0,
                    "quantity": 1,
                    "returned_quantity": 0
                }
            ],
            "activity_id": "ACT_2026_SPRING",
            "parent_order_id": None,
            "split_order_ids": [],
            "returned_amount": 0.0,
            "reissued": False,
            "reissue_count": 0,
            "gift_status": "待判断",
            "gift_sku": None,
            "gift_qty": 0,
            "gift_allocated_qty": 0,
            "gift_shipped_qty": 0,
            "gift_returned_qty": 0,
            "gift_deducted": False,
            "gift_deduct_amount": 0.0,
            "remarks": ""
        },
        {
            "order_id": "ORD_002_STOCK_SHORTAGE",
            "user_id": "USER_002",
            "total_amount": 888.0,
            "paid_amount": 888.0,
            "status": "已支付",
            "created_at": timestamp_now(),
            "updated_at": timestamp_now(),
            "items": [
                {
                    "sku": "PROD_A002",
                    "name": "真皮手提包",
                    "price": 888.0,
                    "quantity": 1,
                    "returned_quantity": 0
                }
            ],
            "activity_id": "ACT_2026_SPRING",
            "parent_order_id": None,
            "split_order_ids": [],
            "returned_amount": 0.0,
            "reissued": False,
            "reissue_count": 0,
            "gift_status": "待判断",
            "gift_sku": None,
            "gift_qty": 0,
            "gift_allocated_qty": 0,
            "gift_shipped_qty": 0,
            "gift_returned_qty": 0,
            "gift_deducted": False,
            "gift_deduct_amount": 0.0,
            "remarks": ""
        },
        {
            "order_id": "ORD_003_PARTIAL_RETURN",
            "user_id": "USER_003",
            "total_amount": 1200.0,
            "paid_amount": 1200.0,
            "status": "已支付",
            "created_at": timestamp_now(),
            "updated_at": timestamp_now(),
            "items": [
                {
                    "sku": "PROD_A003",
                    "name": "羊毛大衣",
                    "price": 1000.0,
                    "quantity": 1,
                    "returned_quantity": 0
                },
                {
                    "sku": "PROD_A004",
                    "name": "配饰丝巾",
                    "price": 200.0,
                    "quantity": 1,
                    "returned_quantity": 0
                }
            ],
            "activity_id": "ACT_2026_SPRING",
            "parent_order_id": None,
            "split_order_ids": [],
            "returned_amount": 0.0,
            "reissued": False,
            "reissue_count": 0,
            "gift_status": "待判断",
            "gift_sku": None,
            "gift_qty": 0,
            "gift_allocated_qty": 0,
            "gift_shipped_qty": 0,
            "gift_returned_qty": 0,
            "gift_deducted": False,
            "gift_deduct_amount": 0.0,
            "remarks": ""
        },
        {
            "order_id": "ORD_004_SPLIT_A",
            "user_id": "USER_004",
            "total_amount": 300.0,
            "paid_amount": 300.0,
            "status": "已支付",
            "created_at": timestamp_now(),
            "updated_at": timestamp_now(),
            "items": [
                {
                    "sku": "PROD_A005",
                    "name": "牛仔裤",
                    "price": 300.0,
                    "quantity": 1,
                    "returned_quantity": 0
                }
            ],
            "activity_id": "ACT_2026_SPRING",
            "parent_order_id": "ORD_004_PARENT",
            "split_order_ids": ["ORD_004_SPLIT_B"],
            "returned_amount": 0.0,
            "reissued": False,
            "reissue_count": 0,
            "gift_status": "待判断",
            "gift_sku": None,
            "gift_qty": 0,
            "gift_allocated_qty": 0,
            "gift_shipped_qty": 0,
            "gift_returned_qty": 0,
            "gift_deducted": False,
            "gift_deduct_amount": 0.0,
            "remarks": ""
        },
        {
            "order_id": "ORD_004_SPLIT_B",
            "user_id": "USER_004",
            "total_amount": 400.0,
            "paid_amount": 400.0,
            "status": "已支付",
            "created_at": timestamp_now(),
            "updated_at": timestamp_now(),
            "items": [
                {
                    "sku": "PROD_A006",
                    "name": "运动鞋",
                    "price": 400.0,
                    "quantity": 1,
                    "returned_quantity": 0
                }
            ],
            "activity_id": "ACT_2026_SPRING",
            "parent_order_id": "ORD_004_PARENT",
            "split_order_ids": ["ORD_004_SPLIT_A"],
            "returned_amount": 0.0,
            "reissued": False,
            "reissue_count": 0,
            "gift_status": "待判断",
            "gift_sku": None,
            "gift_qty": 0,
            "gift_allocated_qty": 0,
            "gift_shipped_qty": 0,
            "gift_returned_qty": 0,
            "gift_deducted": False,
            "gift_deduct_amount": 0.0,
            "remarks": ""
        },
        {
            "order_id": "ORD_005_NO_ACTIVITY",
            "user_id": "USER_005",
            "total_amount": 1000.0,
            "paid_amount": 1000.0,
            "status": "已支付",
            "created_at": timestamp_now(),
            "updated_at": timestamp_now(),
            "items": [
                {
                    "sku": "PROD_A007",
                    "name": "数码产品",
                    "price": 1000.0,
                    "quantity": 1,
                    "returned_quantity": 0
                }
            ],
            "activity_id": None,
            "parent_order_id": None,
            "split_order_ids": [],
            "returned_amount": 0.0,
            "reissued": False,
            "reissue_count": 0,
            "gift_status": "待判断",
            "gift_sku": None,
            "gift_qty": 0,
            "gift_allocated_qty": 0,
            "gift_shipped_qty": 0,
            "gift_returned_qty": 0,
            "gift_deducted": False,
            "gift_deduct_amount": 0.0,
            "remarks": ""
        },
        {
            "order_id": "ORD_006_BELOW_THRESHOLD",
            "user_id": "USER_006",
            "total_amount": 399.0,
            "paid_amount": 399.0,
            "status": "已支付",
            "created_at": timestamp_now(),
            "updated_at": timestamp_now(),
            "items": [
                {
                    "sku": "PROD_A008",
                    "name": "T恤",
                    "price": 399.0,
                    "quantity": 1,
                    "returned_quantity": 0
                }
            ],
            "activity_id": "ACT_2026_SPRING",
            "parent_order_id": None,
            "split_order_ids": [],
            "returned_amount": 0.0,
            "reissued": False,
            "reissue_count": 0,
            "gift_status": "待判断",
            "gift_sku": None,
            "gift_qty": 0,
            "gift_allocated_qty": 0,
            "gift_shipped_qty": 0,
            "gift_returned_qty": 0,
            "gift_deducted": False,
            "gift_deduct_amount": 0.0,
            "remarks": ""
        }
    ]


def create_low_stock_inventory() -> list:
    return [
        {
            "sku": "GIFT_SK001",
            "name": "精美保温杯",
            "total_qty": 1,
            "available_qty": 1,
            "allocated_qty": 0,
            "shipped_qty": 0,
            "returned_qty": 0,
            "reissued_qty": 0,
            "created_at": timestamp_now(),
            "updated_at": timestamp_now()
        }
    ]


def load_all_samples() -> dict:
    return {
        "activity": create_sample_activity(),
        "inventory": create_sample_inventory(),
        "orders": create_scenario_orders(),
        "low_stock_inventory": create_low_stock_inventory()
    }
