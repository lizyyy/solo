#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from fastapi.testclient import TestClient
    from main import app
    from database import Base, engine, SessionLocal
    from models import Translation, LanguageKey, LanguagePack, TranslationStatus
    print("✅ 导入成功")
except Exception as e:
    print(f"❌ 导入失败: {e}")
    sys.exit(1)

Base.metadata.create_all(bind=engine)
client = TestClient(app)
db = SessionLocal()

try:
    print("\n" + "=" * 60)
    print("验证审核状态约束修复")
    print("=" * 60)

    print("\n1. 清理测试数据...")
    db.query(Translation).delete()
    db.query(LanguageKey).delete()
    db.query(LanguagePack).delete()
    db.commit()

    print("2. 创建测试语言包...")
    pack = client.post("/api/translation/language-packs", json={"language_code": "zh-CN", "language_name": "中文"})
    print(f"   状态: {pack.status_code}")

    print("3. 创建测试文案 Key...")
    key = client.post("/api/translation/language-keys", json={
        "key": "test.welcome",
        "default_value": "Welcome {name}!"
    })
    print(f"   状态: {key.status_code}")

    print("4. 获取翻译记录...")
    trans = client.get("/api/translation")
    tid = trans.json()[0]['id']
    print(f"   翻译 ID: {tid}, 初始状态: {trans.json()[0]['status']}")

    print("\n5. 开始审核...")
    r1 = client.post(f"/api/translation/{tid}/start-review", json={"idempotency_key": f"start-review-{tid}"})
    print(f"   状态: {r1.json()['status']}")
    assert r1.json()['status'] == 'reviewing', "应该是 reviewing 状态"

    print("\n6. 审核通过...")
    r2 = client.post(f"/api/translation/{tid}/review", json={
        "approved": True,
        "comment": "通过",
        "idempotency_key": f"review-{tid}-approved"
    })
    print(f"   状态: {r2.json()['status']}")
    assert r2.json()['status'] == 'approved', "应该是 approved 状态"

    print("\n7. 关键测试：已审核通过后，调用审核拒绝...")
    r3 = client.post(f"/api/translation/{tid}/review", json={
        "approved": False,
        "comment": "拒绝",
        "idempotency_key": f"review-{tid}-rejected"
    })
    print(f"   返回状态: {r3.json()['status']}")
    if r3.json()['status'] == 'approved':
        print("   ✅ 修复成功！已审核通过的状态不会变为 rejected")
    else:
        print(f"   ❌ 修复失败！状态从 approved 变为 {r3.json()['status']}")
        sys.exit(1)

    print("\n8. 已审核通过后，再次点击开始审核...")
    r4 = client.post(f"/api/translation/{tid}/start-review", json={"idempotency_key": f"start-review-{tid}"})
    print(f"   返回状态: {r4.json()['status']}")
    if r4.json()['status'] == 'approved':
        print("   ✅ 修复成功！已审核通过的状态不会变回 reviewing")
    else:
        print(f"   ❌ 修复失败！状态从 approved 变为 {r4.json()['status']}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("✅ 所有验证通过！状态约束正常工作！")
    print("=" * 60)

finally:
    db.close()
