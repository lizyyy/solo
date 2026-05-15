#!/usr/bin/env python3
import asyncio
import httpx
from datetime import datetime, timedelta

async def test_field_authorization():
    print("=" * 60)
    print("测试1: 字段授权校验")
    print("=" * 60)
    
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=10.0) as client:
        print("\n1.1 尝试创建导出申请（字段未授权）...")
        request_id = f"TEST_AUTH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        idempotency_key = f"IDEMPOT_{request_id}"
        
        response = await client.post(
            "/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id,
                "requester_id": "user_test",
                "requester_name": "测试用户",
                "data_source": "test_db",
                "field_scope": [
                    {"table_name": "customers", "fields": ["unauthorized_field"]}
                ],
                "expiry_policy": {"type": "hours", "value": 24},
                "idempotency_key": idempotency_key
            }
        )
        
        print(f"   状态码: {response.status_code}")
        if response.status_code == 403:
            print(f"   ✅ 成功拦截！错误信息: {response.json().get('detail', 'N/A')}")
        else:
            print(f"   ❌ 未正确拦截！响应: {response.text}")
            return False
        
        print("\n1.2 先授权字段，再创建...")
        await client.post(
            "/api/v1/auth/fields",
            json={
                "requester_id": "user_test",
                "data_source": "test_db",
                "field_name": "authorized_field"
            }
        )
        
        request_id2 = f"TEST_AUTH2_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        idempotency_key2 = f"IDEMPOT_{request_id2}"
        
        response = await client.post(
            "/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key2},
            json={
                "request_id": request_id2,
                "requester_id": "user_test",
                "requester_name": "测试用户",
                "data_source": "test_db",
                "field_scope": [
                    {"table_name": "customers", "fields": ["authorized_field"]}
                ],
                "expiry_policy": {"type": "hours", "value": 24},
                "idempotency_key": idempotency_key2
            }
        )
        
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            print(f"   ✅ 创建成功！状态: {response.json()['data']['status']}")
        else:
            print(f"   ❌ 创建失败！响应: {response.text}")
            return False
        
        return True


async def test_status_transition():
    print("\n" + "=" * 60)
    print("测试2: 状态流转限制")
    print("=" * 60)
    
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=10.0) as client:
        print("\n2.1 创建导出申请...")
        await client.post(
            "/api/v1/auth/fields",
            json={
                "requester_id": "user_status",
                "data_source": "test_db",
                "field_name": "field_a"
            }
        )
        
        request_id = f"TEST_STATUS_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        idempotency_key = f"IDEMPOT_{request_id}"
        
        await client.post(
            "/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id,
                "requester_id": "user_status",
                "requester_name": "测试用户",
                "data_source": "test_db",
                "field_scope": [
                    {"table_name": "customers", "fields": ["field_a"]}
                ],
                "expiry_policy": {"type": "hours", "value": 24},
                "idempotency_key": idempotency_key
            }
        )
        
        print(f"   申请ID: {request_id}")
        
        print("\n2.2 尝试非法状态转换（pending -> downloaded）...")
        response = await client.put(
            "/api/v1/exports/status",
            json={
                "request_id": request_id,
                "new_status": "downloaded",
                "operator_id": "admin",
                "operator_name": "管理员"
            }
        )
        
        print(f"   状态码: {response.status_code}")
        if response.status_code == 400:
            print(f"   ✅ 成功拦截！错误信息: {response.json().get('detail', 'N/A')}")
        else:
            print(f"   ❌ 未正确拦截！响应: {response.text}")
            return False
        
        print("\n2.3 合法状态转换测试（按正确顺序推进）...")
        valid_transitions = ["validating", "approved", "generating", "ready"]
        all_success = True
        for status in valid_transitions:
            response = await client.put(
                "/api/v1/exports/status",
                json={
                    "request_id": request_id,
                    "new_status": status,
                    "operator_id": "admin",
                    "operator_name": "管理员"
                }
            )
            if response.status_code == 200:
                print(f"     ✅ pending -> {status}: 成功")
            else:
                print(f"     ❌ pending -> {status}: 失败")
                all_success = False
        
        return all_success


async def test_expiry_check():
    print("\n" + "=" * 60)
    print("测试3: 过期策略校验")
    print("=" * 60)
    
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=10.0) as client:
        print("\n3.1 创建一个已过期的导出申请...")
        await client.post(
            "/api/v1/auth/fields",
            json={
                "requester_id": "user_expiry",
                "data_source": "test_db",
                "field_name": "field_b"
            }
        )
        
        request_id = f"TEST_EXPIRY_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        idempotency_key = f"IDEMPOT_{request_id}"
        
        # 先创建
        create_response = await client.post(
            "/api/v1/exports",
            headers={"X-Idempotency-Key": idempotency_key},
            json={
                "request_id": request_id,
                "requester_id": "user_expiry",
                "requester_name": "测试用户",
                "data_source": "test_db",
                "field_scope": [
                    {"table_name": "customers", "fields": ["field_b"]}
                ],
                "expiry_policy": {"type": "hours", "value": 24},
                "idempotency_key": idempotency_key
            }
        )
        
        # 推进到 ready 状态
        for status in ["validating", "approved", "generating", "ready"]:
            await client.put(
                "/api/v1/exports/status",
                json={
                    "request_id": request_id,
                    "new_status": status,
                    "operator_id": "admin",
                    "operator_name": "管理员"
                }
            )
        
        print(f"   申请ID: {request_id}")
        
        print("\n3.2 直接修改数据库让它过期，然后尝试生成签名...")
        # 这里需要使用 SQLAlchemy 直接更新数据库
        from sqlalchemy import create_engine, text
        from app.models import Base
        import os
        
        db_path = "watermark_export.db"
        if os.path.exists(db_path):
            engine = create_engine(f"sqlite:///{db_path}")
            with engine.connect() as conn:
                expired_time = (datetime.now() - timedelta(hours=1)).isoformat()
                conn.execute(
                    text(f"UPDATE export_requests SET expiry_time = '{expired_time}' WHERE request_id = '{request_id}'")
                )
                conn.commit()
            print("   ✅ 已将过期时间设置为过去时间")
        
        response = await client.post(
            "/api/v1/exports/signature",
            json={
                "request_id": request_id,
                "downloader_id": "user_expiry",
                "downloader_name": "测试用户"
            }
        )
        
        print(f"   状态码: {response.status_code}")
        if response.status_code == 400:
            print(f"   ✅ 成功拦截！错误信息: {response.json().get('detail', 'N/A')}")
        else:
            print(f"   ❌ 未正确拦截！响应: {response.text}")
            return False
        
        return True


async def main():
    print("\n" + "*" * 60)
    print("数据导出水印 API - 核心业务校验修复验证")
    print("*" * 60)
    
    results = []
    
    try:
        results.append(await test_field_authorization())
    except Exception as e:
        print(f"\n❌ 测试1异常: {e}")
        results.append(False)
    
    try:
        results.append(await test_status_transition())
    except Exception as e:
        print(f"\n❌ 测试2异常: {e}")
        results.append(False)
    
    try:
        results.append(await test_expiry_check())
    except Exception as e:
        print(f"\n❌ 测试3异常: {e}")
        results.append(False)
    
    print("\n" + "=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)
    print(f"✅ 字段授权校验: {'通过' if results[0] else '失败'}")
    print(f"✅ 状态流转限制: {'通过' if results[1] else '失败'}")
    print(f"✅ 过期策略校验: {'通过' if results[2] else '失败'}")
    
    if all(results):
        print("\n🎉 所有核心业务校验修复验证通过！")
    else:
        print("\n⚠️ 部分测试未通过，请检查修复！")


if __name__ == "__main__":
    asyncio.run(main())
