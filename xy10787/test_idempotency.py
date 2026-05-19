import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine, SessionLocal
from models import Translation, LanguageKey, LanguagePack, TranslationStatus

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def test_audit_status_constraints():
    print("=" * 60)
    print("测试审核状态约束和幂等性")
    print("=" * 60)

    db = SessionLocal()
    try:
        print("\n1. 清理测试数据...")
        db.query(Translation).delete()
        db.query(LanguageKey).delete()
        db.query(LanguagePack).delete()
        db.commit()

        print("\n2. 创建测试语言包...")
        pack_response = client.post(
            "/api/translation/language-packs",
            json={"language_code": "zh-CN", "language_name": "中文"}
        )
        print(f"   创建语言包: {pack_response.status_code}")
        language_pack_id = pack_response.json()['id']

        print("\n3. 创建测试文案 Key...")
        key_response = client.post(
            "/api/translation/language-keys",
            json={
                "key": "test.welcome",
                "default_value": "Welcome {name}!",
                "description": "Test message"
            }
        )
        print(f"   创建文案 Key: {key_response.status_code}")

        print("\n4. 获取翻译记录...")
        translations_response = client.get("/api/translation")
        translations = translations_response.json()
        translation_id = translations[0]['id']
        initial_status = translations[0]['status']
        print(f"   翻译 ID: {translation_id}, 初始状态: {initial_status}")
        assert initial_status == 'pending', "初始状态应该是 pending"

        print("\n5. 测试开始审核...")
        review_response1 = client.post(
            f"/api/translation/{translation_id}/start-review",
            json={"idempotency_key": f"start-review-{translation_id}"}
        )
        print(f"   第一次开始审核: {review_response1.status_code}, 状态: {review_response1.json()['status']}")
        assert review_response1.json()['status'] == 'reviewing', "状态应该是 reviewing"

        print("\n6. 测试重复点击开始审核（状态应该不变）...")
        review_response2 = client.post(
            f"/api/translation/{translation_id}/start-review",
            json={"idempotency_key": f"start-review-{translation_id}"}
        )
        print(f"   第二次开始审核: {review_response2.status_code}, 状态: {review_response2.json()['status']}")
        assert review_response2.json()['status'] == 'reviewing', "状态应该保持 reviewing"

        print("\n7. 测试审核通过...")
        approve_response = client.post(
            f"/api/translation/{translation_id}/review",
            json={
                "approved": True,
                "comment": "审核通过",
                "idempotency_key": f"review-{translation_id}-approved"
            }
        )
        print(f"   审核通过: {approve_response.status_code}, 状态: {approve_response.json()['status']}")
        assert approve_response.json()['status'] == 'approved', "状态应该是 approved"

        print("\n8. 测试已审核通过后，重复调用审核通过（状态应该不变）...")
        approve_response2 = client.post(
            f"/api/translation/{translation_id}/review",
            json={
                "approved": True,
                "comment": "再次审核通过",
                "idempotency_key": f"review-{translation_id}-approved"
            }
        )
        print(f"   再次审核通过: {approve_response2.status_code}, 状态: {approve_response2.json()['status']}")
        assert approve_response2.json()['status'] == 'approved', "状态应该保持 approved"

        print("\n9. 测试已审核通过后，调用审核拒绝（状态应该不变 - 关键修复！）...")
        reject_response = client.post(
            f"/api/translation/{translation_id}/review",
            json={
                "approved": False,
                "comment": "审核拒绝",
                "idempotency_key": f"review-{translation_id}-rejected"
            }
        )
        print(f"   审核拒绝调用: {reject_response.status_code}, 状态: {reject_response.json()['status']}")
        assert reject_response.json()['status'] == 'approved', "已审核通过后，状态不应变为 rejected"

        print("\n10. 测试已审核通过后，再次点击开始审核（状态应该不变）...")
        review_response3 = client.post(
            f"/api/translation/{translation_id}/start-review",
            json={"idempotency_key": f"start-review-{translation_id}"}
        )
        print(f"   再次开始审核: {review_response3.status_code}, 状态: {review_response3.json()['status']}")
        assert review_response3.json()['status'] == 'approved', "已审核通过后，状态不应变回 reviewing"

        print("\n" + "=" * 60)
        print("✅ 所有测试通过！审核状态约束正常工作！")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    test_audit_status_constraints()
