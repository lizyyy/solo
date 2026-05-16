#!/usr/bin/env python3

SAMPLE_JOURNEYS = [
    {
        "name": "用户登录流程巡检",
        "description": "端到端测试用户从登录到查看 dashboard 的完整流程",
        "steps": [
            {
                "step_id": "step_001",
                "name": "访问登录页",
                "action": "navigate_to_url",
                "params": {"url": "https://example.com/login"},
                "expected_result": "页面加载成功",
                "timeout": 30
            },
            {
                "step_id": "step_002",
                "name": "输入用户名",
                "action": "input_text",
                "params": {"selector": "#username", "text": "test_user"},
                "expected_result": "用户名输入成功",
                "timeout": 10
            },
            {
                "step_id": "step_003",
                "name": "输入密码",
                "action": "input_text",
                "params": {"selector": "#password", "text": "test_pass"},
                "expected_result": "密码输入成功",
                "timeout": 10
            },
            {
                "step_id": "step_004",
                "name": "提交登录",
                "action": "click_button",
                "params": {"selector": "#submit"},
                "expected_result": "登录成功跳转",
                "timeout": 30
            },
            {
                "step_id": "step_005",
                "name": "验证 dashboard",
                "action": "verify_element",
                "params": {"selector": ".dashboard-title"},
                "expected_result": "dashboard 标题可见",
                "timeout": 10
            }
        ],
        "dependent_services": [
            {
                "service_name": "auth_service",
                "service_type": "authentication",
                "endpoint": "https://auth.example.com",
                "health_check": "/health"
            },
            {
                "service_name": "dashboard_service",
                "service_type": "ui_service",
                "endpoint": "https://dashboard.example.com"
            },
            {
                "service_name": "user_db",
                "service_type": "database",
                "endpoint": "db.example.com:5432"
            }
        ],
        "run_frequency": "hourly"
    },
    {
        "name": "支付流程巡检",
        "description": "测试从商品选择到支付完成的完整支付流程",
        "steps": [
            {
                "step_id": "pay_001",
                "name": "选择商品",
                "action": "select_item",
                "params": {"item_id": "prod_123"},
                "expected_result": "商品已选择",
                "timeout": 15
            },
            {
                "step_id": "pay_002",
                "name": "进入结算页",
                "action": "click_button",
                "params": {"selector": "#checkout"},
                "expected_result": "结算页面加载成功",
                "timeout": 20
            },
            {
                "step_id": "pay_003",
                "name": "选择支付方式",
                "action": "select_option",
                "params": {"selector": "#payment-method", "value": "credit_card"},
                "expected_result": "支付方式已选择",
                "timeout": 10
            },
            {
                "step_id": "pay_004",
                "name": "确认支付",
                "action": "click_button",
                "params": {"selector": "#confirm-payment"},
                "expected_result": "支付成功",
                "timeout": 45
            }
        ],
        "dependent_services": [
            {
                "service_name": "payment_gateway",
                "service_type": "payment",
                "endpoint": "https://pay.example.com"
            },
            {
                "service_name": "order_service",
                "service_type": "order_management",
                "endpoint": "https://orders.example.com"
            },
            {
                "service_name": "inventory_service",
                "service_type": "inventory",
                "endpoint": "https://inventory.example.com"
            }
        ],
        "run_frequency": "every_30_minutes"
    },
    {
        "name": "用户注册流程巡检",
        "description": "测试新用户从注册到激活的完整流程",
        "steps": [
            {
                "step_id": "reg_001",
                "name": "访问注册页",
                "action": "navigate_to_url",
                "params": {"url": "https://example.com/register"},
                "expected_result": "注册页面加载成功",
                "timeout": 30
            },
            {
                "step_id": "reg_002",
                "name": "填写注册信息",
                "action": "fill_form",
                "params": {
                    "form_data": {
                        "email": "test_new@example.com",
                        "username": "new_user",
                        "password": "SecurePass123!"
                    }
                },
                "expected_result": "表单填写完成",
                "timeout": 20
            },
            {
                "step_id": "reg_003",
                "name": "提交注册",
                "action": "click_button",
                "params": {"selector": "#register-btn"},
                "expected_result": "注册成功",
                "timeout": 30
            }
        ],
        "dependent_services": [
            {
                "service_name": "email_service",
                "service_type": "notification",
                "endpoint": "https://email.example.com"
            },
            {
                "service_name": "user_service",
                "service_type": "user_management",
                "endpoint": "https://users.example.com"
            }
        ],
        "run_frequency": "daily"
    }
]


SAMPLE_FAILURES = [
    {
        "error_type": "timeout_error",
        "error_message": "页面加载超时，超过30秒未响应",
        "context": {"url": "https://example.com/login", "browser": "chrome"},
        "step_id": "step_001"
    },
    {
        "error_type": "element_not_found",
        "error_message": "无法找到登录按钮元素",
        "context": {"selector": "#submit", "html_snapshot": "..."},
        "step_id": "step_004"
    },
    {
        "error_type": "assertion_failed",
        "error_message": "dashboard 标题验证失败",
        "context": {"expected": "Welcome", "actual": "Error"},
        "step_id": "step_005"
    }
]


def print_summary():
    print("=" * 60)
    print("合成旅程注册 API - 示例数据")
    print("=" * 60)
    print(f"\n包含 {len(SAMPLE_JOURNEYS)} 个端到端巡检旅程:")
    for i, journey in enumerate(SAMPLE_JOURNEYS, 1):
        print(f"  {i}. {journey['name']}")
        print(f"     - {journey['description']}")
        print(f"     - 步骤数: {len(journey['steps'])}")
        print(f"     - 依赖服务数: {len(journey['dependent_services'])}")
        print(f"     - 运行频率: {journey['run_frequency']}")
        print()


if __name__ == "__main__":
    print_summary()
