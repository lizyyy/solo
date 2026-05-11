import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List


ORDER_API_V1 = {
    "api_name": "订单服务API",
    "version": "v1.0.0",
    "service_name": "order-service",
    "endpoints": [
        {
            "path": "/api/v1/orders",
            "method": "POST",
            "summary": "创建订单",
            "request_body": [
                {"name": "user_id", "type": "string", "required": True},
                {"name": "product_id", "type": "string", "required": True},
                {"name": "quantity", "type": "integer", "required": True},
                {"name": "price", "type": "number", "required": True},
                {"name": "currency", "type": "string", "required": False, "enum_values": ["CNY", "USD"]},
                {"name": "remark", "type": "string", "required": False},
            ],
            "response_body": [
                {"name": "order_id", "type": "string", "required": True},
                {"name": "status", "type": "string", "required": True, "enum_values": ["pending", "paid", "shipped"]},
                {"name": "created_at", "type": "string", "required": True},
            ],
        },
        {
            "path": "/api/v1/orders/{order_id}",
            "method": "GET",
            "summary": "查询订单",
            "path_params": [
                {"name": "order_id", "type": "string", "required": True},
            ],
            "response_body": [
                {"name": "order_id", "type": "string", "required": True},
                {"name": "user_id", "type": "string", "required": True},
                {"name": "amount", "type": "number", "required": True},
                {"name": "status", "type": "string", "required": True},
                {"name": "created_at", "type": "string", "required": True},
            ],
        },
    ],
}

ORDER_API_V2 = {
    "api_name": "订单服务API",
    "version": "v2.0.0",
    "service_name": "order-service",
    "endpoints": [
        {
            "path": "/api/v1/orders",
            "method": "POST",
            "summary": "创建订单",
            "request_body": [
                {"name": "user_id", "type": "string", "required": True},
                {"name": "product_id", "type": "string", "required": True},
                {"name": "quantity", "type": "integer", "required": True},
                {"name": "price", "type": "number", "required": True},
                {"name": "currency", "type": "string", "required": True, "enum_values": ["CNY", "USD", "EUR", "GBP"]},
                {"name": "shipping_address", "type": "object", "required": True},
            ],
            "response_body": [
                {"name": "order_id", "type": "string", "required": True},
                {"name": "status", "type": "string", "required": True, "enum_values": ["pending", "paid", "shipped", "delivered", "cancelled"]},
                {"name": "created_at", "type": "string", "required": True},
                {"name": "payment_method", "type": "string", "required": False},
            ],
        },
        {
            "path": "/api/v1/orders/{order_id}",
            "method": "GET",
            "summary": "查询订单",
            "path_params": [
                {"name": "order_id", "type": "string", "required": True},
            ],
            "response_body": [
                {"name": "order_id", "type": "string", "required": True},
                {"name": "user_id", "type": "string", "required": True},
                {"name": "amount", "type": "string", "required": True},
                {"name": "status", "type": "string", "required": True},
                {"name": "created_at", "type": "string", "required": True},
                {"name": "tracking_number", "type": "string", "required": False},
            ],
        },
    ],
}

INVENTORY_API_V1 = {
    "api_name": "库存服务API",
    "version": "v1.0.0",
    "service_name": "inventory-service",
    "endpoints": [
        {
            "path": "/api/v1/inventory/{sku}",
            "method": "GET",
            "summary": "查询库存",
            "path_params": [
                {"name": "sku", "type": "string", "required": True},
            ],
            "response_body": [
                {"name": "sku", "type": "string", "required": True},
                {"name": "available_qty", "type": "integer", "required": True},
                {"name": "reserved_qty", "type": "integer", "required": True},
                {"name": "warehouse", "type": "string", "required": False},
            ],
        },
        {
            "path": "/api/v1/inventory/reserve",
            "method": "POST",
            "summary": "扣减库存",
            "request_body": [
                {"name": "sku", "type": "string", "required": True},
                {"name": "quantity", "type": "integer", "required": True},
                {"name": "order_id", "type": "string", "required": False},
            ],
            "response_body": [
                {"name": "reservation_id", "type": "string", "required": True},
                {"name": "success", "type": "boolean", "required": True},
            ],
        },
    ],
}

INVENTORY_API_V2 = {
    "api_name": "库存服务API",
    "version": "v2.0.0",
    "service_name": "inventory-service",
    "endpoints": [
        {
            "path": "/api/v1/inventory/{sku}",
            "method": "GET",
            "summary": "查询库存",
            "path_params": [
                {"name": "sku", "type": "string", "required": True},
            ],
            "response_body": [
                {"name": "sku", "type": "string", "required": True},
                {"name": "available_qty", "type": "integer", "required": True},
                {"name": "warehouse_code", "type": "string", "required": True},
            ],
        },
        {
            "path": "/api/v1/inventory/reserve",
            "method": "POST",
            "summary": "扣减库存",
            "request_body": [
                {"name": "sku", "type": "string", "required": True},
                {"name": "quantity", "type": "integer", "required": True},
                {"name": "order_id", "type": "string", "required": True},
                {"name": "reason", "type": "string", "required": False, "enum_values": ["ORDER", "TRANSFER", "ADJUST"]},
            ],
            "response_body": [
                {"name": "reservation_id", "type": "string", "required": True},
                {"name": "success", "type": "boolean", "required": True},
                {"name": "expires_at", "type": "string", "required": True},
            ],
        },
    ],
}

MEMBER_API_V1 = {
    "api_name": "会员服务API",
    "version": "v1.0.0",
    "service_name": "member-service",
    "endpoints": [
        {
            "path": "/api/v1/members/{member_id}",
            "method": "GET",
            "summary": "查询会员信息",
            "path_params": [
                {"name": "member_id", "type": "string", "required": True},
            ],
            "response_body": [
                {"name": "member_id", "type": "string", "required": True},
                {"name": "name", "type": "string", "required": True},
                {"name": "level", "type": "string", "required": True, "enum_values": ["BRONZE", "SILVER", "GOLD"]},
                {"name": "points", "type": "integer", "required": True},
                {"name": "phone", "type": "string", "required": False},
            ],
        },
        {
            "path": "/api/v1/members",
            "method": "POST",
            "summary": "创建会员",
            "request_body": [
                {"name": "name", "type": "string", "required": True},
                {"name": "phone", "type": "string", "required": True},
                {"name": "email", "type": "string", "required": False},
            ],
            "response_body": [
                {"name": "member_id", "type": "string", "required": True},
                {"name": "level", "type": "string", "required": True},
            ],
        },
    ],
}

MEMBER_API_V2 = {
    "api_name": "会员服务API",
    "version": "v2.0.0",
    "service_name": "member-service",
    "endpoints": [
        {
            "path": "/api/v1/members/{member_id}",
            "method": "GET",
            "summary": "查询会员信息",
            "path_params": [
                {"name": "member_id", "type": "string", "required": True},
            ],
            "response_body": [
                {"name": "member_id", "type": "string", "required": True},
                {"name": "name", "type": "string", "required": True},
                {"name": "level", "type": "string", "required": True, "enum_values": ["BRONZE", "SILVER", "GOLD", "PLATINUM"]},
                {"name": "points_balance", "type": "integer", "required": True},
                {"name": "phone", "type": "string", "required": True},
            ],
        },
        {
            "path": "/api/v1/members",
            "method": "POST",
            "summary": "创建会员",
            "request_body": [
                {"name": "name", "type": "string", "required": True},
                {"name": "phone", "type": "string", "required": True},
                {"name": "email", "type": "string", "required": True},
                {"name": "marketing_consent", "type": "boolean", "required": True},
            ],
            "response_body": [
                {"name": "member_id", "type": "string", "required": True},
                {"name": "level", "type": "string", "required": True},
            ],
        },
    ],
}

CALLERS = [
    {
        "service_name": "payment-service",
        "team_name": "支付团队",
        "owner": "张三",
        "email": "zhangsan@example.com",
        "endpoints_called": [
            "POST:/api/v1/orders",
            "GET:/api/v1/orders/{order_id}",
        ],
        "call_volume": 15000,
        "last_called_at": (datetime.now() - timedelta(hours=1)).isoformat(),
    },
    {
        "service_name": "shopping-cart-service",
        "team_name": "购物车团队",
        "owner": "李四",
        "email": "lisi@example.com",
        "endpoints_called": [
            "POST:/api/v1/orders",
            "GET:/api/v1/inventory/{sku}",
            "POST:/api/v1/inventory/reserve",
        ],
        "call_volume": 8000,
        "last_called_at": (datetime.now() - timedelta(hours=2)).isoformat(),
    },
    {
        "service_name": "recommendation-service",
        "team_name": "推荐团队",
        "owner": None,
        "email": None,
        "endpoints_called": [
            "GET:/api/v1/members/{member_id}",
        ],
        "call_volume": 500,
        "last_called_at": (datetime.now() - timedelta(days=1)).isoformat(),
    },
    {
        "service_name": "crm-service",
        "team_name": "CRM团队",
        "owner": "王五",
        "email": "wangwu@example.com",
        "endpoints_called": [
            "GET:/api/v1/members/{member_id}",
            "POST:/api/v1/members",
        ],
        "call_volume": 2000,
        "last_called_at": (datetime.now() - timedelta(hours=5)).isoformat(),
    },
    {
        "service_name": "notification-service",
        "team_name": "通知团队",
        "owner": "赵六",
        "email": "zhaoliu@example.com",
        "endpoints_called": [
            "GET:/api/v1/orders/{order_id}",
        ],
        "call_volume": 3000,
        "last_called_at": (datetime.now() - timedelta(hours=3)).isoformat(),
    },
    {
        "service_name": "report-service",
        "team_name": "报表团队",
        "owner": "钱七",
        "email": "qianqi@example.com",
        "endpoints_called": [
            "GET:/api/v1/inventory/{sku}",
        ],
        "call_volume": 100,
        "last_called_at": (datetime.now() - timedelta(days=3)).isoformat(),
    },
]

ALERTS = [
    {
        "id": "alert-001",
        "service_name": "payment-service",
        "message": "订单创建接口近30分钟超时率上升5%",
        "level": "error",
        "created_at": (datetime.now() - timedelta(minutes=30)).isoformat(),
        "related_endpoint": "POST:/api/v1/orders",
    },
    {
        "id": "alert-002",
        "service_name": "crm-service",
        "message": "会员查询接口返回大量4xx错误",
        "level": "warning",
        "created_at": (datetime.now() - timedelta(hours=2)).isoformat(),
        "related_endpoint": "GET:/api/v1/members/{member_id}",
    },
]

NOTES = [
    {
        "id": "note-001",
        "service_name": "shopping-cart-service",
        "content": "购物车团队计划下周进行代码重构，可能影响库存接口调用",
        "author": "李四",
        "created_at": (datetime.now() - timedelta(days=1)).isoformat(),
        "related_endpoint": "POST:/api/v1/inventory/reserve",
    },
]


def _save_json(path: Path, data: Dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def generate_all_examples(output_dir: str) -> str:
    base_path = Path(output_dir)
    contracts_dir = base_path / "contracts"

    _save_json(contracts_dir / "order-api-v1.json", ORDER_API_V1)
    _save_json(contracts_dir / "order-api-v2.json", ORDER_API_V2)
    _save_json(contracts_dir / "inventory-api-v1.json", INVENTORY_API_V1)
    _save_json(contracts_dir / "inventory-api-v2.json", INVENTORY_API_V2)
    _save_json(contracts_dir / "member-api-v1.json", MEMBER_API_V1)
    _save_json(contracts_dir / "member-api-v2.json", MEMBER_API_V2)
    _save_json(base_path / "callers.json", CALLERS)
    _save_json(base_path / "alerts.json", ALERTS)
    _save_json(base_path / "notes.json", NOTES)

    return str(base_path.absolute())
