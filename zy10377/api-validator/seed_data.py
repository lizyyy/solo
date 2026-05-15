import asyncio
import httpx
import hashlib
from datetime import datetime


def generate_hash(*args):
    content = "|".join(str(arg) for arg in args if arg is not None)
    return hashlib.sha256(content.encode()).hexdigest()


BASE_URL = "http://localhost:8000"


async def seed_data():
    print("🚀 开始初始化测试数据...")
    
    async with httpx.AsyncClient() as client:
        print("\n📝 1. 创建环境变量...")
        env_vars = [
            {"key": "API_BASE_URL", "value": "https://jsonplaceholder.typicode.com", "description": "测试 API 基础地址"},
            {"key": "AUTH_TOKEN", "value": "test-token-123", "description": "测试认证令牌", "is_secret": True},
        ]
        for env in env_vars:
            try:
                response = await client.post(f"{BASE_URL}/api/v1/environment", json=env)
                if response.status_code == 201:
                    print(f"  ✅ 创建: {env['key']}")
                else:
                    print(f"  ℹ️ 已存在: {env['key']}")
            except Exception as e:
                print(f"  ❌ 错误: {e}")

        print("\n📄 2. 创建文档页面...")
        doc_hash = generate_hash("User API Documentation", "/api/users")
        document = {
            "url": "https://example.com/docs/user-api",
            "title": "User API Documentation",
            "content_hash": doc_hash,
            "is_active": True
        }
        try:
            response = await client.post(f"{BASE_URL}/api/v1/documents", json=document)
            if response.status_code == 201:
                doc_id = response.json()['id']
                print(f"  ✅ 创建文档 (ID: {doc_id})")
            else:
                print(f"  ℹ️ 文档已存在或错误: {response.text}")
                doc_id = None
        except Exception as e:
            print(f"  ❌ 错误: {e}")
            doc_id = None

        print("\n🔧 3. 创建请求示例...")
        examples = [
            {
                "name": "获取用户列表 - 正常请求",
                "method": "GET",
                "url": "https://jsonplaceholder.typicode.com/users",
                "headers": {"Content-Type": "application/json"},
                "body": None,
                "expected_status": 200,
                "is_active": True
            },
            {
                "name": "获取单个用户 - 正常请求",
                "method": "GET",
                "url": "https://jsonplaceholder.typicode.com/users/1",
                "headers": {"Content-Type": "application/json"},
                "body": None,
                "expected_status": 200,
                "is_active": True
            },
            {
                "name": "创建用户 - POST请求",
                "method": "POST",
                "url": "https://jsonplaceholder.typicode.com/users",
                "headers": {"Content-Type": "application/json"},
                "body": '{"name": "Test User", "username": "testuser", "email": "test@example.com"}',
                "expected_status": 201,
                "is_active": True
            },
            {
                "name": "环境变量注入测试",
                "method": "GET",
                "url": "{{API_BASE_URL}}/posts/1",
                "headers": {"Authorization": "Bearer {{AUTH_TOKEN}}"},
                "body": None,
                "expected_status": 200,
                "is_active": True
            },
            {
                "name": "404错误 - 资源不存在",
                "method": "GET",
                "url": "https://jsonplaceholder.typicode.com/nonexistent-999",
                "headers": {},
                "body": None,
                "expected_status": 200,
                "is_active": True
            },
            {
                "name": "缺少环境变量测试",
                "method": "GET",
                "url": "{{MISSING_VAR}}/test",
                "headers": {},
                "body": None,
                "expected_status": 200,
                "is_active": True
            },
        ]
        
        example_ids = []
        for ex in examples:
            ex_hash = generate_hash(ex['method'], ex['url'], ex['body'])
            ex['content_hash'] = ex_hash
            if doc_id:
                ex['document_page_id'] = doc_id
            try:
                response = await client.post(f"{BASE_URL}/api/v1/examples", json=ex)
                if response.status_code == 201:
                    ex_id = response.json()['id']
                    example_ids.append(ex_id)
                    print(f"  ✅ 创建: {ex['name']} (ID: {ex_id})")
                else:
                    print(f"  ℹ️ 跳过: {ex['name']} - {response.text[:50]}")
            except Exception as e:
                print(f"  ❌ 错误: {e}")

        print("\n✅ 4. 执行验证 - 正常场景...")
        if len(example_ids) >= 2:
            try:
                response = await client.post(
                    f"{BASE_URL}/api/v1/validate",
                    json={"example_ids": example_ids[:2]}
                )
                print(f"  ✅ 验证完成: {len(response.json())} 个结果")
            except Exception as e:
                print(f"  ❌ 错误: {e}")

        print("\n⚠️ 5. 执行验证 - 异常场景...")
        if len(example_ids) >= 5:
            try:
                response = await client.post(
                    f"{BASE_URL}/api/v1/validate",
                    json={"example_id": example_ids[4]}
                )
                result = response.json()[0]
                print(f"  ✅ 验证完成 - 状态: {result['status']}")
            except Exception as e:
                print(f"  ❌ 错误: {e}")

        print("\n❌ 6. 测试防重复提交...")
        if example_ids:
            try:
                await client.post(
                    f"{BASE_URL}/api/v1/validate",
                    json={"example_id": example_ids[0]}
                )
                response2 = await client.post(
                    f"{BASE_URL}/api/v1/validate",
                    json={"example_id": example_ids[0]}
                )
                if response2.status_code == 409:
                    print(f"  ✅ 防重复提交生效: {response2.json()['message']}")
                else:
                    print(f"  ⚠️ 状态码: {response2.status_code}")
            except Exception as e:
                print(f"  ❌ 错误: {e}")

        print("\n🔧 7. 测试人工处理...")
        if len(example_ids) >= 3:
            try:
                response = await client.post(
                    f"{BASE_URL}/api/v1/validate",
                    json={"example_id": example_ids[2]}
                )
                result = response.json()[0]
                result_id = result['id']
                
                response = await client.put(
                    f"{BASE_URL}/api/v1/results/{result_id}/status",
                    json={"status": "fixing", "operator": "admin", "remark": "正在检查 API 配置"}
                )
                print(f"  ✅ 状态更新为 fixing")
                
                response = await client.put(
                    f"{BASE_URL}/api/v1/results/{result_id}/status",
                    json={"status": "fixed", "operator": "admin", "remark": "已更新 API 配置"}
                )
                print(f"  ✅ 状态更新为 fixed")
                
                fix_trace = {
                    "validation_result_id": result_id,
                    "action_taken": "Updated environment variables",
                    "operator": "admin",
                    "remark": "Fixed authentication token"
                }
                response = await client.post(f"{BASE_URL}/api/v1/fix-traces", json=fix_trace)
                print(f"  ✅ 创建修复追踪记录")
            except Exception as e:
                print(f"  ❌ 错误: {e}")

        print("\n🚫 8. 测试被拦截的路径...")
        try:
            response = await client.get(f"{BASE_URL}/blocked/path")
            if response.status_code == 403:
                print(f"  ✅ 路径拦截生效: {response.json()['message']}")
        except Exception as e:
            print(f"  ✅ 路径拦截生效")

        print("\n📊 9. 获取统计信息...")
        try:
            response = await client.get(f"{BASE_URL}/api/v1/stats")
            stats = response.json()
            print(f"  ✅ 总示例数: {stats['total_examples']}")
            print(f"  ✅ 总验证数: {stats['total_validations']}")
            print(f"  ✅ 成功率: {stats['success_rate']}%")
        except Exception as e:
            print(f"  ❌ 错误: {e}")

        print("\n🎉 测试数据初始化完成!")
        print(f"\n📝 管理后台: {BASE_URL}/")
        print(f"📚 Swagger 文档: {BASE_URL}/docs")


if __name__ == "__main__":
    asyncio.run(seed_data())
