"""测试数据准备：正常、异常、重复请求和人工处理场景"""
from datetime import datetime, timedelta
import json


def get_normal_case_data():
    """正常场景测试数据：成功的用户查询接口调用"""
    return {
        "name": "用户信息查询接口",
        "method": "GET",
        "path": "/api/v1/users/{user_id}",
        "description": "根据用户ID查询用户详细信息，包括基本信息和权限信息",
        "downstream_services": [
            {
                "service_name": "user_db",
                "service_type": "database",
                "endpoint": "mysql://user-db:3306/user_db",
                "method": "SELECT",
                "cache_key": "user:info:{user_id}",
                "cache_ttl": 3600
            },
            {
                "service_name": "permission_service",
                "service_type": "grpc",
                "endpoint": "grpc://permission-service:50051",
                "method": "GetUserPermissions",
                "cache_key": "user:perms:{user_id}",
                "cache_ttl": 1800
            },
            {
                "service_name": "audit_log",
                "service_type": "kafka",
                "endpoint": "kafka://kafka-cluster:9092",
                "method": "produce",
                "cache_key": None,
                "cache_ttl": None
            }
        ],
        "call_samples": [
            {
                "trace_id": "trace-001-normal",
                "request_id": "req-001",
                "user_id": "user-1001",
                "timestamp": datetime.utcnow() - timedelta(minutes=5),
                "status": "SUCCESS",
                "total_latency": 85.5,
                "category": None,
                "request_data": {"user_id": "user-1001", "include_permissions": True},
                "response_data": {"user_id": "user-1001", "name": "张三", "permissions": ["read", "write"]},
                "error_message": None,
                "error_stack": None,
                "downstream_calls": [
                    {"service_name": "user_db", "latency": 25.3, "status": "SUCCESS"},
                    {"service_name": "permission_service", "latency": 40.2, "status": "SUCCESS"},
                    {"service_name": "audit_log", "latency": 10.0, "status": "SUCCESS"}
                ]
            },
            {
                "trace_id": "trace-002-normal",
                "request_id": "req-002",
                "user_id": "user-1002",
                "timestamp": datetime.utcnow() - timedelta(minutes=3),
                "status": "SUCCESS",
                "total_latency": 120.8,
                "category": None,
                "request_data": {"user_id": "user-1002", "include_permissions": True},
                "response_data": {"user_id": "user-1002", "name": "李四", "permissions": ["read"]},
                "error_message": None,
                "error_stack": None,
                "downstream_calls": [
                    {"service_name": "user_db", "latency": 45.6, "status": "SUCCESS"},
                    {"service_name": "permission_service", "latency": 60.4, "status": "SUCCESS"},
                    {"service_name": "audit_log", "latency": 5.8, "status": "SUCCESS"}
                ]
            },
            {
                "trace_id": "trace-003-normal",
                "request_id": "req-003",
                "user_id": "user-1003",
                "timestamp": datetime.utcnow() - timedelta(minutes=1),
                "status": "SUCCESS",
                "total_latency": 95.2,
                "category": None,
                "request_data": {"user_id": "user-1003", "include_permissions": False},
                "response_data": {"user_id": "user-1003", "name": "王五"},
                "error_message": None,
                "error_stack": None,
                "downstream_calls": [
                    {"service_name": "user_db", "latency": 30.1, "status": "SUCCESS"},
                    {"service_name": "audit_log", "latency": 8.5, "status": "SUCCESS"}
                ]
            }
        ]
    }


def get_exception_case_data():
    """异常场景测试数据：包含超时和数据库连接失败的情况"""
    return {
        "name": "订单创建接口",
        "method": "POST",
        "path": "/api/v1/orders",
        "description": "创建用户订单，涉及库存检查、支付、订单入库等多个下游服务",
        "downstream_services": [
            {
                "service_name": "inventory_service",
                "service_type": "rest",
                "endpoint": "http://inventory-service:8080/api/check",
                "method": "POST",
                "cache_key": None,
                "cache_ttl": None
            },
            {
                "service_name": "payment_gateway",
                "service_type": "rest",
                "endpoint": "https://api.payment-gateway.com/v1/charge",
                "method": "POST",
                "cache_key": None,
                "cache_ttl": None
            },
            {
                "service_name": "order_db",
                "service_type": "database",
                "endpoint": "mysql://order-db:3306/order_db",
                "method": "INSERT",
                "cache_key": None,
                "cache_ttl": None
            }
        ],
        "call_samples": [
            {
                "trace_id": "trace-101-error",
                "request_id": "req-101",
                "user_id": "user-2001",
                "timestamp": datetime.utcnow() - timedelta(minutes=10),
                "status": "FAILED",
                "total_latency": 35000.0,
                "category": None,
                "request_data": {"user_id": "user-2001", "items": [{"sku": "prod-001", "qty": 2}], "amount": 199.98},
                "response_data": None,
                "error_message": "Request timeout after 30000ms",
                "error_stack": "TimeoutError: Request timeout after 30000ms\n    at handle_timeout (/app/services/payment.js:123:45)\n    at process._tickCallback (internal/process/next_tick.js:68:7)",
                "downstream_calls": [
                    {"service_name": "inventory_service", "latency": 150.2, "status": "SUCCESS"},
                    {"service_name": "payment_gateway", "latency": 30000.0, "status": "TIMEOUT", "error": "Connection timeout"}
                ]
            },
            {
                "trace_id": "trace-102-error",
                "request_id": "req-102",
                "user_id": "user-2002",
                "timestamp": datetime.utcnow() - timedelta(minutes=8),
                "status": "FAILED",
                "total_latency": 520.5,
                "category": None,
                "request_data": {"user_id": "user-2002", "items": [{"sku": "prod-002", "qty": 1}], "amount": 99.99},
                "response_data": None,
                "error_message": "Database connection failed: Too many connections",
                "error_stack": "ConnectionError: Too many connections\n    at createConnection (/app/db/connection.js:89:23)\n    at Object.insertOrder (/app/models/order.js:45:10)",
                "downstream_calls": [
                    {"service_name": "inventory_service", "latency": 120.3, "status": "SUCCESS"},
                    {"service_name": "payment_gateway", "latency": 350.1, "status": "SUCCESS"},
                    {"service_name": "order_db", "latency": 0, "status": "FAILED", "error": "Too many connections"}
                ]
            },
            {
                "trace_id": "trace-103-success",
                "request_id": "req-103",
                "user_id": "user-2003",
                "timestamp": datetime.utcnow() - timedelta(minutes=5),
                "status": "SUCCESS",
                "total_latency": 650.8,
                "category": None,
                "request_data": {"user_id": "user-2003", "items": [{"sku": "prod-003", "qty": 3}], "amount": 299.97},
                "response_data": {"order_id": "order-8888", "status": "created"},
                "error_message": None,
                "error_stack": None,
                "downstream_calls": [
                    {"service_name": "inventory_service", "latency": 180.5, "status": "SUCCESS"},
                    {"service_name": "payment_gateway", "latency": 400.2, "status": "SUCCESS"},
                    {"service_name": "order_db", "latency": 50.1, "status": "SUCCESS"}
                ]
            }
        ]
    }


def get_high_risk_case_data():
    """高风险场景：高故障率、无缓存策略、P99耗时过高"""
    return {
        "name": "推荐商品接口",
        "method": "GET",
        "path": "/api/v1/recommendations",
        "description": "基于用户行为的个性化商品推荐，调用复杂的推荐算法服务",
        "downstream_services": [
            {
                "service_name": "recommendation_engine",
                "service_type": "grpc",
                "endpoint": "grpc://recommendation-engine:50051",
                "method": "GetRecommendations",
                "cache_key": None,
                "cache_ttl": None
            },
            {
                "service_name": "user_behavior_db",
                "service_type": "database",
                "endpoint": "mongodb://behavior-db:27017/behavior",
                "method": "aggregate",
                "cache_key": None,
                "cache_ttl": None
            },
            {
                "service_name": "product_catalog",
                "service_type": "rest",
                "endpoint": "http://product-service:8080/api/products",
                "method": "GET",
                "cache_key": None,
                "cache_ttl": None
            }
        ],
        "call_samples": [
            {
                "trace_id": f"trace-20{i}",
                "request_id": f"req-20{i}",
                "user_id": f"user-300{i}",
                "timestamp": datetime.utcnow() - timedelta(minutes=i),
                "status": "FAILED" if i % 2 == 0 else "SUCCESS",
                "total_latency": 4500.0 if i % 2 == 0 else 2500.0,
                "category": None,
                "request_data": {"user_id": f"user-300{i}", "limit": 10},
                "response_data": None if i % 2 == 0 else {"products": [f"prod-{j}" for j in range(10)]},
                "error_message": "Recommendation engine timeout" if i % 2 == 0 else None,
                "error_stack": None,
                "downstream_calls": [
                    {"service_name": "user_behavior_db", "latency": 800.0 + i * 50, "status": "SUCCESS"},
                    {"service_name": "recommendation_engine", "latency": 3500.0 if i % 2 == 0 else 1500.0, "status": "FAILED" if i % 2 == 0 else "SUCCESS"},
                    {"service_name": "product_catalog", "latency": 200.0, "status": "SUCCESS"}
                ]
            }
            for i in range(1, 11)
        ]
    }


def get_blocked_path_case_data():
    """会被拦截的路径示例：敏感接口 - 删除用户数据"""
    return {
        "id": "blocked-profile-001",
        "name": "用户数据删除接口",
        "method": "DELETE",
        "path": "/api/v1/users/{user_id}/data",
        "description": "此接口涉及用户数据删除，属于高风险敏感操作，会被自动拦截",
        "downstream_services": [
            {
                "service_name": "user_data_cleaner",
                "service_type": "internal",
                "endpoint": "internal://data-cleaner/delete",
                "method": "DELETE",
                "cache_key": None,
                "cache_ttl": None
            }
        ],
        "call_samples": [
            {
                "trace_id": "trace-blocked-001",
                "request_id": "req-blocked-001",
                "user_id": "user-9999",
                "timestamp": datetime.utcnow(),
                "status": "BLOCKED",
                "total_latency": 1.5,
                "category": "SENSITIVE_OPERATION",
                "request_data": {"user_id": "user-9999", "delete_all": True, "reason": "user_requested"},
                "response_data": None,
                "error_message": "Operation blocked: Sensitive data deletion requires manual approval",
                "error_stack": "SecurityError: Operation blocked by security policy\n    at checkSensitiveOperation (/app/middleware/security.js:234:15)",
                "downstream_calls": []
            }
        ]
    }


def print_test_data():
    """打印测试数据以便查看"""
    print("=" * 80)
    print("【正常场景测试数据】")
    print("-" * 80)
    print(json.dumps(get_normal_case_data(), default=str, indent=2, ensure_ascii=False))
    print("\n" + "=" * 80)
    print("【异常场景测试数据】")
    print("-" * 80)
    print(json.dumps(get_exception_case_data(), default=str, indent=2, ensure_ascii=False))
    print("\n" + "=" * 80)
    print("【高风险场景测试数据】")
    print("-" * 80)
    print(json.dumps(get_high_risk_case_data(), default=str, indent=2, ensure_ascii=False))
    print("\n" + "=" * 80)
    print("【拦截路径测试数据】")
    print("-" * 80)
    print(json.dumps(get_blocked_path_case_data(), default=str, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    print_test_data()
