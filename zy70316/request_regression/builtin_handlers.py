from typing import Dict, Any


def baseline_handler(method: str, url: str, headers: Dict[str, str], body: Any) -> Dict[str, Any]:
    if "/member/profile" in url:
        return {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": {
                "code": 0,
                "message": "success",
                "data": {
                    "user_id": "U10001",
                    "username": "***",
                    "phone": "***",
                    "level": "gold",
                    "points": 1580,
                    "created_at": "2024-01-15T10:30:00Z",
                },
            },
        }

    if "/order/list" in url:
        return {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": {
                "code": 0,
                "message": "success",
                "data": {
                    "total": 3,
                    "orders": [
                        {"order_id": "O001", "status": "paid", "amount": 299.00, "created_at": "2024-05-10T09:00:00Z"},
                        {"order_id": "O002", "status": "shipped", "amount": 599.00, "created_at": "2024-05-11T14:20:00Z"},
                        {"order_id": "O003", "status": "completed", "amount": 129.00, "created_at": "2024-05-12T08:15:00Z"},
                    ],
                },
            },
        }

    if "/inventory/check" in url:
        return {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": {
                "code": 0,
                "message": "success",
                "data": {
                    "sku": "SKU001",
                    "available": True,
                    "stock": 150,
                    "reserved": 25,
                    "warehouse": "WH-A",
                },
            },
        }

    return {
        "status_code": 404,
        "headers": {"Content-Type": "application/json"},
        "body": {"code": 404, "message": "Not Found", "data": None},
    }


def target_handler(method: str, url: str, headers: Dict[str, str], body: Any) -> Dict[str, Any]:
    if "/member/profile" in url:
        return {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": {
                "code": 0,
                "message": "success",
                "data": {
                    "user_id": "U10001",
                    "username": "***",
                    "phone": "***",
                    "level": "gold",
                    "points": 1580,
                    "created_at": "2024-01-15T10:30:00Z",
                    "member_since": "2024-01-15",
                    "vip_expire_at": "2025-01-15",
                },
            },
        }

    if "/order/list" in url:
        return {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": {
                "code": 0,
                "message": "success",
                "data": {
                    "total": 3,
                    "orders": [
                        {"order_id": "O001", "status": "paid", "amount": 299.00, "created_at": "2024-05-10T09:00:00Z"},
                        {"order_id": "O003", "status": "completed", "amount": 129.00, "created_at": "2024-05-12T08:15:00Z"},
                        {"order_id": "O002", "status": "shipped", "amount": 599.00, "created_at": "2024-05-11T14:20:00Z"},
                    ],
                },
            },
        }

    if "/inventory/check" in url:
        return {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": {
                "code": 0,
                "message": "success",
                "data": {
                    "sku": "SKU001",
                    "available": True,
                    "stock": 150,
                    "reserved": 25,
                },
            },
        }

    return {
        "status_code": 404,
        "headers": {"Content-Type": "application/json"},
        "body": {"code": 404, "message": "Not Found", "data": None},
    }
