#!/usr/bin/env python3
import asyncio
import httpx
from datetime import datetime

async def test():
    print("开始验证API功能...")
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=10.0) as client:
        # 1. 健康检查
        print("1. 健康检查...")
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200, f"健康检查失败: {resp.status_code}"
        data = resp.json()
        print(f"   \u2705 通过: {data['message']}")

        # 2. 授权字段
        print("2. 字段授权...")
        resp = await client.post("/api/v1/auth/fields", json={
            "requester_id": "test_user",
            "data_source": "test_db",
            "field_name": "test_field"
        })
        assert resp.status_code == 200, f"授权失败: {resp.status_code}"
        data = resp.json()
        print(f"   \u2705 通过: is_authorized={data['data']['is_authorized']}")

        # 3. 创建导出申请
        print("3. 创建导出申请...")
        request_id = f"TEST_REQ_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        idempotency_key = f"IDEMPOT_{request_id}"
        resp = await client.post("/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id,
                "requester_id": "test_user",
                "requester_name": "测试用户",
                "data_source": "test_db",
                "field_scope": [{"table_name": "test", "fields": ["a", "b"]}],
                "expiry_policy": {"type": "hours", "value": 24},
                "idempotency_key": idempotency_key
            })
        assert resp.status_code == 200, f"创建失败: {resp.status_code}"
        data = resp.json()
        print(f"   \u2705 通过: request_id={request_id}, status={data['data']['status']}")

        # 4. 幂等性测试（重复提交）
        print("4. 幂等性测试（重复提交）...")
        resp2 = await client.post("/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id,
                "requester_id": "test_user",
                "requester_name": "测试用户",
                "data_source": "test_db",
                "field_scope": [{"table_name": "test", "fields": ["a", "b"]}],
                "expiry_policy": {"type": "hours", "value": 24},
                "idempotency_key": idempotency_key
            })
        data2 = resp2.json()
        assert "幂等" in data2['message'] or "已存在" in data2['message']
        print(f"   \u2705 通过: {data2['message']}")

        # 5. 状态推进
        print("5. 状态推进测试...")
        for status in ["validating", "approved", "generating", "ready"]:
            resp = await client.put("/api/v1/exports/status", json={
                "request_id": request_id,
                "new_status": status,
                "operator_id": "admin",
                "operator_name": "管理员",
                "remark": f"推进到{status}"
            })
            assert resp.status_code == 200, f"状态更新失败: {resp.status_code}"
        print(f"   \u2705 通过: 状态已推进到 ready")

        # 6. 生成水印
        print("6. 生成水印...")
        resp = await client.post("/api/v1/exports/watermark", json={
            "request_id": request_id,
            "watermark_type": "text",
            "watermark_content": {}
        })
        assert resp.status_code == 200, f"水印生成失败: {resp.status_code}"
        data = resp.json()
        print(f"   \u2705 通过: watermark_id={data['data']['watermark_id']}")

        # 7. 生成下载签名
        print("7. 生成下载签名...")
        resp = await client.post("/api/v1/exports/signature", json={
            "request_id": request_id,
            "downloader_id": "test_user",
            "downloader_name": "测试用户"
        })
        assert resp.status_code == 200, f"签名生成失败: {resp.status_code}"
        print(f"   \u2705 通过: signature生成成功")

        # 8. 查询审计日志
        print("8. 查询审计日志...")
        resp = await client.get(f"/api/v1/exports/{request_id}/audit-logs")
        assert resp.status_code == 200, f"审计日志查询失败: {resp.status_code}"
        logs = resp.json()['data']
        print(f"   \u2705 通过: 审计日志 {len(logs)} 条记录")

        # 9. 查询导出历史
        print("9. 查询导出历史...")
        resp = await client.post("/api/v1/exports/history", json={
            "requester_id": "test_user",
            "page": 1,
            "page_size": 10
        })
        assert resp.status_code == 200, f"历史查询失败: {resp.status_code}"
        data = resp.json()
        print(f"   \u2705 通过: 共 {data['data']['total']} 条记录")

        print("\n🎉 所有API验证通过！")
        print(f"\n📝 测试申请ID: {request_id}")
        print(f"📝 API文档地址: http://localhost:8000/docs")
        print(f"📝 数据库文件: watermark_export.db")

if __name__ == "__main__":
    asyncio.run(test())
