import requests
import json

API_BASE = 'http://localhost:8000/api'

demo_error_codes = [
    {
        "code": "ERR-1001",
        "original_input": "ConnectionError: Failed to connect to database at 10.0.0.1:5432. Connection refused.",
        "trigger_interface": "/api/user/profile",
        "user_tip": "系统暂时无法连接，请稍后重试。如问题持续，请联系客服。",
        "processing_steps": "1. 检查数据库连接池配置\n2. 检查数据库服务器状态\n3. 检查网络连通性\n4. 联系DBA确认服务状态"
    },
    {
        "code": "ERR-2002",
        "original_input": "AuthenticationFailed: Token expired at 2024-01-15T10:30:00Z. Current time: 2024-01-16T09:00:00Z",
        "trigger_interface": "/api/auth/verify",
        "user_tip": "登录已过期，请重新登录。",
        "processing_steps": "1. 清除本地token缓存\n2. 重定向到登录页面\n3. 用户重新登录获取新token\n4. 检查token有效期配置"
    },
    {
        "code": "ERR-3003",
        "original_input": "ValidationError: 'email' field must be a valid email address. Received: user@invalid",
        "trigger_interface": "/api/user/register",
        "user_tip": "请输入有效的邮箱地址。",
        "processing_steps": "1. 前端校验邮箱格式\n2. 后端二次校验\n3. 返回明确的错误提示\n4. 引导用户重新输入"
    }
]

def init_demo():
    print("开始初始化演示数据...")
    
    created_ids = []
    
    for ec in demo_error_codes:
        try:
            res = requests.post(f"{API_BASE}/error-codes", json=ec)
            if res.status_code == 200:
                data = res.json()
                created_ids.append(data['id'])
                print(f"✓ 创建错误码: {ec['code']} (ID: {data['id']})")
            else:
                print(f"✗ 创建失败 {ec['code']}: {res.text}")
        except Exception as e:
            print(f"✗ 错误 {ec['code']}: {e}")
    
    if created_ids:
        ec_id = created_ids[0]
        print(f"\n对 ID={ec_id} 进行处理模拟...")
        
        process_data = {
            "handler": "张三",
            "handle_reason": "根据运维团队分析，确认是数据库连接池配置问题导致",
            "trigger_interface": "/api/user/profile",
            "user_tip": "系统暂时无法连接，请稍后重试。如问题持续，请联系客服。",
            "processing_steps": "1. 检查数据库连接池配置\n2. 检查数据库服务器状态\n3. 检查网络连通性\n4. 联系DBA确认服务状态",
            "processed_result": "已调整连接池配置，max_connections从100调整到500"
        }
        
        res = requests.put(f"{API_BASE}/error-codes/{ec_id}/process", json=process_data)
        if res.status_code == 200:
            print("✓ 处理成功")
            
            print("\n进行复核模拟...")
            review_data = {
                "reviewer": "李四",
                "review_result": "approved",
                "review_comment": "处理方案合理，同意生效"
            }
            
            res = requests.post(f"{API_BASE}/error-codes/{ec_id}/review", json=review_data)
            if res.status_code == 200:
                print("✓ 复核通过并生效")
    
    if len(created_ids) > 1:
        ec_id = created_ids[1]
        print(f"\n对 ID={ec_id} 进行处理模拟...")
        
        process_data = {
            "handler": "王五",
            "handle_reason": "认证模块常规问题，按标准流程处理",
            "trigger_interface": "/api/auth/verify",
            "user_tip": "登录已过期，请重新登录。",
            "processing_steps": "1. 清除本地token缓存\n2. 重定向到登录页面\n3. 用户重新登录获取新token\n4. 检查token有效期配置",
            "processed_result": "已优化前端token过期检测逻辑"
        }
        
        requests.put(f"{API_BASE}/error-codes/{ec_id}/process", json=process_data)
        print("✓ 处理成功 (状态: 已处理，待复核)")
    
    print("\n添加命中统计模拟数据...")
    for ec_id in created_ids:
        for i in range(5):
            hit_data = {
                "user_id": f"user_{i+1}",
                "request_id": f"req_{ec_id}_{i+1}",
                "is_success": i < 3,
                "error_message": "模拟命中记录" if i >= 3 else None
            }
            try:
                requests.post(
                    f"{API_BASE}/error-codes/{ec_id}/hit?user_id={hit_data['user_id']}&request_id={hit_data['request_id']}&is_success={str(hit_data['is_success']).lower()}&error_message={hit_data['error_message'] or ''}"
                )
            except:
                pass
        print(f"✓ 为错误码 ID={ec_id} 添加了5条命中记录")
    
    print("\n演示数据初始化完成!")
    print(f"共创建 {len(created_ids)} 个错误码")
    print("\n可以打开 frontend/index.html 查看效果")

if __name__ == "__main__":
    init_demo()
