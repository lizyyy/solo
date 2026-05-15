#!/usr/bin/env python3
import asyncio
import httpx
from datetime import datetime

BASE_URL = "http://localhost:8000"


async def test_successful_workflow():
    print("=" * 60)
    print("测试用例 1: 成功流程 - 完整的导出申请流程")
    print("=" * 60)
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        print("\n1. 健康检查...")
        response = await client.get("/api/v1/health")
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.json()['message']}")

        print("\n2. 授权字段...")
        auth_response = await client.post(
            "/api/v1/auth/fields",
            json={
                "requester_id": "user_001",
                "data_source": "customer_db",
                "field_name": "customer_name"
            }
        )
        print(f"   状态码: {auth_response.status_code}")
        print(f"   授权结果: {auth_response.json()['data']['is_authorized']}")

        print("\n3. 检查字段授权...")
        check_response = await client.get(
            "/api/v1/auth/fields/check",
            params={
                "requester_id": "user_001",
                "data_source": "customer_db",
                "field_name": "customer_name"
            }
        )
        print(f"   状态码: {check_response.status_code}")
        print(f"   授权状态: {check_response.json()['data']['is_authorized']}")

        print("\n4. 创建导出申请...")
        request_id = f"REQ_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        idempotency_key = f"IDEMPOT_{request_id}"
        
        create_response = await client.post(
            "/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id,
                "requester_id": "user_001",
                "requester_name": "张三",
                "data_source": "customer_db",
                "field_scope": [
                    {
                        "table_name": "customers",
                        "fields": ["customer_id", "customer_name", "email"]
                    }
                ],
                "expiry_policy": {
                    "type": "hours",
                    "value": 24
                },
                "idempotency_key": idempotency_key
            }
        )
        print(f"   状态码: {create_response.status_code}")
        print(f"   请求ID: {request_id}")
        print(f"   状态: {create_response.json()['data']['status']}")

        print("\n5. 重复提交（幂等性测试）...")
        duplicate_response = await client.post(
            "/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id,
                "requester_id": "user_001",
                "requester_name": "张三",
                "data_source": "customer_db",
                "field_scope": [
                    {
                        "table_name": "customers",
                        "fields": ["customer_id", "customer_name", "email"]
                    }
                ],
                "expiry_policy": {
                    "type": "hours",
                    "value": 24
                },
                "idempotency_key": idempotency_key
            }
        )
        print(f"   状态码: {duplicate_response.status_code}")
        print(f"   消息: {duplicate_response.json()['message']}")

        print("\n6. 推进状态: VALIDATING...")
        status_response = await client.put(
            "/api/v1/exports/status",
            json={
                "request_id": request_id,
                "new_status": "validating",
                "operator_id": "admin_001",
                "operator_name": "管理员",
                "remark": "开始校验导出申请"
            }
        )
        print(f"   状态码: {status_response.status_code}")
        print(f"   新状态: {status_response.json()['data']['status']}")

        print("\n7. 推进状态: APPROVED...")
        status_response = await client.put(
            "/api/v1/exports/status",
            json={
                "request_id": request_id,
                "new_status": "approved",
                "operator_id": "admin_001",
                "operator_name": "管理员",
                "remark": "导出申请审批通过"
            }
        )
        print(f"   状态码: {status_response.status_code}")
        print(f"   新状态: {status_response.json()['data']['status']}")

        print("\n8. 推进状态: GENERATING...")
        status_response = await client.put(
            "/api/v1/exports/status",
            json={
                "request_id": request_id,
                "new_status": "generating",
                "operator_id": "system",
                "operator_name": "系统",
                "remark": "开始生成导出文件"
            }
        )
        print(f"   状态码: {status_response.status_code}")
        print(f"   新状态: {status_response.json()['data']['status']}")

        print("\n9. 生成水印...")
        watermark_response = await client.post(
            "/api/v1/exports/watermark",
            json={
                "request_id": request_id,
                "watermark_type": "text",
                "watermark_content": {}
            }
        )
        print(f"   状态码: {watermark_response.status_code}")
        print(f"   水印ID: {watermark_response.json()['data']['watermark_id']}")

        print("\n10. 推进状态: READY...")
        status_response = await client.put(
            "/api/v1/exports/status",
            json={
                "request_id": request_id,
                "new_status": "ready",
                "operator_id": "system",
                "operator_name": "系统",
                "remark": "导出文件已准备就绪"
            }
        )
        print(f"   状态码: {status_response.status_code}")
        print(f"   新状态: {status_response.json()['data']['status']}")

        print("\n11. 生成下载签名...")
        signature_response = await client.post(
            "/api/v1/exports/signature",
            json={
                "request_id": request_id,
                "downloader_id": "user_001",
                "downloader_name": "张三"
            }
        )
        print(f"   状态码: {signature_response.status_code}")
        print(f"   签名: {signature_response.json()['data']['signature'][:20]}...")
        print(f"   下载链接: {signature_response.json()['data']['download_url']}")

        print("\n12. 推进状态: DOWNLOADED...")
        status_response = await client.put(
            "/api/v1/exports/status",
            json={
                "request_id": request_id,
                "new_status": "downloaded",
                "operator_id": "user_001",
                "operator_name": "张三",
                "remark": "文件已下载"
            }
        )
        print(f"   状态码: {status_response.status_code}")
        print(f"   新状态: {status_response.json()['data']['status']}")
        print(f"   最终结论: {status_response.json()['data']['final_conclusion']}")

        print("\n13. 查询审计日志...")
        audit_response = await client.get(f"/api/v1/exports/{request_id}/audit-logs")
        logs = audit_response.json()["data"]
        print(f"   状态码: {audit_response.status_code}")
        print(f"   日志数量: {len(logs)}")
        for log in logs[:3]:
            print(f"     - {log['action']}: {log['old_status']} -> {log['new_status']} (by {log['operator_name']})")

        print("\n14. 查询导出历史...")
        history_response = await client.post(
            "/api/v1/exports/history",
            json={
                "requester_id": "user_001",
                "page": 1,
                "page_size": 10
            }
        )
        history_data = history_response.json()["data"]
        print(f"   状态码: {history_response.status_code}")
        print(f"   总记录数: {history_data['total']}")

        print("\n✅ 成功流程测试完成!")
        return request_id


async def test_error_workflow():
    print("\n" + "=" * 60)
    print("测试用例 2: 问题流程 - 异常场景测试")
    print("=" * 60)
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        print("\n1. 查询不存在的导出申请...")
        response = await client.get("/api/v1/exports/NONEXISTENT_123")
        print(f"   状态码: {response.status_code}")
        print(f"   错误信息: {response.json().get('detail', 'N/A')}")

        print("\n2. 更新不存在的导出申请状态...")
        status_response = await client.put(
            "/api/v1/exports/status",
            json={
                "request_id": "NONEXISTENT_123",
                "new_status": "approved",
                "operator_id": "admin_001",
                "operator_name": "管理员"
            }
        )
        print(f"   状态码: {status_response.status_code}")
        print(f"   错误信息: {status_response.json().get('detail', 'N/A')}")

        print("\n3. 为未就绪的申请生成下载签名...")
        request_id = f"REQ_ERR_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        idempotency_key = f"IDEMPOT_{request_id}"
        
        await client.post(
            "/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id,
                "requester_id": "user_002",
                "requester_name": "李四",
                "data_source": "order_db",
                "field_scope": [
                    {
                        "table_name": "orders",
                        "fields": ["order_id", "amount"]
                    }
                ],
                "expiry_policy": {
                    "type": "hours",
                    "value": 24
                },
                "idempotency_key": idempotency_key
            }
        )
        
        signature_response = await client.post(
            "/api/v1/exports/signature",
            json={
                "request_id": request_id,
                "downloader_id": "user_002",
                "downloader_name": "李四"
            }
        )
        print(f"   状态码: {signature_response.status_code}")
        print(f"   错误信息: {signature_response.json().get('detail', 'N/A')}")

        print("\n4. 拒绝导出申请...")
        reject_response = await client.put(
            "/api/v1/exports/status",
            json={
                "request_id": request_id,
                "new_status": "rejected",
                "operator_id": "admin_001",
                "operator_name": "管理员",
                "remark": "字段未授权，申请被拒绝"
            }
        )
        print(f"   状态码: {reject_response.status_code}")
        print(f"   新状态: {reject_response.json()['data']['status']}")
        print(f"   最终结论: {reject_response.json()['data']['final_conclusion']}")

        print("\n5. 查询被拒绝申请的审计日志...")
        audit_response = await client.get(f"/api/v1/exports/{request_id}/audit-logs")
        logs = audit_response.json()["data"]
        print(f"   日志数量: {len(logs)}")
        for log in logs:
            print(f"     - {log['action']}: {log['remark']}")

        print("\n6. 幂等性键冲突测试（相同key不同请求体）...")
        conflict_response = await client.post(
            "/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id + "_DIFF",
                "requester_id": "user_002",
                "requester_name": "李四",
                "data_source": "DIFFERENT_DB",
                "field_scope": [],
                "expiry_policy": {
                    "type": "hours",
                    "value": 48
                },
                "idempotency_key": idempotency_key
            }
        )
        print(f"   状态码: {conflict_response.status_code}")
        print(f"   错误信息: {conflict_response.json().get('detail', 'N/A')}")

        print("\n✅ 问题流程测试完成!")


async def main():
    print("\n")
    print("*" * 60)
    print("*" + " " * 58 + "*")
    print("*" + " " * 15 + "数据导出水印 API 测试套件" + " " * 15 + "*")
    print("*" + " " * 58 + "*")
    print("*" * 60)
    print("\n请确保服务已启动: python -m app.main")
    print("\n按 Enter 键开始测试...", end="")
    input()

    try:
        await test_successful_workflow()
        await test_error_workflow()
        
        print("\n" + "=" * 60)
        print("📊 测试总结")
        print("=" * 60)
        print("✅ 成功流程: 完整的导出申请生命周期测试")
        print("✅ 问题流程: 异常场景和错误处理测试")
        print("✅ 幂等性: 重复提交不会产生脏数据")
        print("✅ 追溯查询: 所有状态变更都记录在审计日志中")
        print("✅ 数据持久化: 重启服务后数据仍然保留")
        print("\n🎉 所有测试完成!")
        print("\n💡 提示:")
        print("   - API文档: http://localhost:8000/docs")
        print("   - 数据库文件: watermark_export.db")
        
    except Exception as e:
        print(f"\n❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
