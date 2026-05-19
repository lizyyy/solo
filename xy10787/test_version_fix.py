#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine, SessionLocal
from models import VersionRelease, LanguagePack

Base.metadata.create_all(bind=engine)
client = TestClient(app)
db = SessionLocal()

print("\n" + "=" * 60)
print("验证版本管理功能修复")
print("=" * 60)

print("\n1. 清理测试数据...")
db.query(VersionRelease).delete()
db.query(LanguagePack).delete()
db.commit()

print("2. 创建测试语言包...")
pack = client.post("/api/translation/language-packs", json={
    "language_code": "zh-CN",
    "language_name": "中文"
})
language_pack_id = pack.json()['id']
print(f"   语言包 ID: {language_pack_id}")

print("\n3. 创建第一个版本...")
v1 = client.post("/api/version", json={
    "version": "v1.0.0",
    "language_pack_id": language_pack_id,
    "description": "第一个版本"
})
print(f"   状态: {v1.status_code}")
v1_data = v1.json()
print(f"   版本: {v1_data['version']}")
print(f"   language_pack 字段是否存在: {'language_pack' in v1_data}")
if 'language_pack' in v1_data and v1_data['language_pack']:
    print(f"   language_pack.language_name: {v1_data['language_pack']['language_name']}")

print("\n4. 获取版本列表，验证 language_pack 字段...")
versions = client.get("/api/version")
versions_data = versions.json()
v_first = versions_data[0]
has_lang_pack = 'language_pack' in v_first and v_first['language_pack'] is not None
print(f"   language_pack 存在: {'✅' if has_lang_pack else '❌'}")
if has_lang_pack:
    print(f"   language_pack.language_name: {v_first['language_pack']['language_name']}")

print("\n5. 测试重复版本约束：同一语言包创建相同版本号...")
v2 = client.post("/api/version", json={
    "version": "v1.0.0",
    "language_pack_id": language_pack_id,
    "description": "重复版本"
})
print(f"   状态: {v2.status_code}")
print(f"   返回版本 ID: {v2.json()['id']}")
print(f"   原始版本 ID: {v1_data['id']}")
print(f"   是否返回同一记录（无重复创建）: {'✅' if v2.json()['id'] == v1_data['id'] else '❌'}")

print("\n6. 测试幂等性：使用相同 idempotency_key 重复请求...")
v3 = client.post(
    "/api/version",
    headers={"X-Idempotency-Key": "test-idempotency-key-123"},
    json={
        "version": "v2.0.0",
        "language_pack_id": language_pack_id,
        "description": "幂等性测试"
    }
)
v4 = client.post(
    "/api/version",
    headers={"X-Idempotency-Key": "test-idempotency-key-123"},
    json={
        "version": "v2.0.0",
        "language_pack_id": language_pack_id,
        "description": "幂等性测试"
    }
)
print(f"   第一次请求 ID: {v3.json()['id']}")
print(f"   第二次请求 ID: {v4.json()['id']}")
print(f"   幂等性生效（返回同一记录）: {'✅' if v3.json()['id'] == v4.json()['id'] else '❌'}")

print("\n7. 检查是否只有两条版本记录...")
all_versions = client.get("/api/version")
count = len(all_versions.json())
print(f"   版本总数: {count}")
print(f"   预期 2 条(v1.0.0 和 v2.0.0): {'✅' if count == 2 else f'❌ 有 {count} 条'}")

print("\n" + "=" * 60)
all_passed = has_lang_pack and v2.json()['id'] == v1_data['id'] and v3.json()['id'] == v4.json()['id'] and count == 2
print("✅ 所有测试通过！" if all_passed else "❌ 部分测试失败")
print("=" * 60)

db.close()
