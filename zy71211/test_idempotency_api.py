import sys
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models import CancellationReason


def run_api_test():
    print("=" * 70)
    print("接口级幂等性测试 - 模拟真实调用链路")
    print("=" * 70)

    SQLALCHEMY_DATABASE_URL = "sqlite:///./test_idempotency.db"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    passed = 0
    failed = 0

    try:
        print("\n1. 创建客户...")
        response = client.post(
            "/customers/",
            json={"id_card": "310101199001011234", "name": "张三", "phone": "13800138000"}
        )
        assert response.status_code == 201, f"状态码错误: {response.status_code}"
        customer_id = response.json()["id"]
        print(f"   ✓ 客户创建成功，ID: {customer_id}")
        passed += 1

        print("\n2. 创建贷款申请...")
        response = client.post(
            "/applications/",
            json={"customer_id": customer_id, "loan_amount": 100000, "loan_term": 12}
        )
        assert response.status_code == 201, f"状态码错误: {response.status_code}"
        application_id = response.json()["id"]
        application_no = response.json()["application_no"]
        print(f"   ✓ 申请创建成功，ID: {application_id}, 编号: {application_no}")
        passed += 1

        print("\n3. 上传已过期的客户资料...")
        expiry_date = (date.today() - timedelta(days=10)).isoformat()
        response = client.post(
            "/documents/",
            json={
                "application_id": application_id,
                "doc_type": "身份证",
                "doc_no": "310101199001011234",
                "expiry_date": expiry_date
            }
        )
        assert response.status_code == 201, f"状态码错误: {response.status_code}"
        print(f"   ✓ 已过期资料上传成功，过期日期: {expiry_date}")
        passed += 1

        print("\n4. 第一次调用撤件接口（资料过期原因）...")
        response = client.post(
            "/cancellations/",
            json={
                "application_id": application_id,
                "reason": CancellationReason.DOC_EXPIRED.value,
                "reason_detail": "身份证已过期",
                "operator": "操作员A"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}"
        result1 = response.json()
        assert result1["success"] is True, f"首次撤件应该成功，返回: {result1}"
        assert result1["cancellation"] is not None, "应该返回撤件记录"
        cancel_no1 = result1["cancellation"]["cancellation_no"]
        print(f"   ✓ 首次撤件成功，撤件编号: {cancel_no1}")
        print(f"     提示信息: {result1['message']}")
        if result1["warnings"]:
            print(f"     风险提示: {result1['warnings']}")
        passed += 1

        print("\n5. 验证申请状态已变更为已撤件...")
        response = client.get(f"/applications/{application_id}")
        assert response.status_code == 200
        app_status = response.json()["application"]["status"]
        assert app_status == "已撤件", f"状态应该是已撤件，实际是: {app_status}"
        print(f"   ✓ 申请状态正确: {app_status}")
        passed += 1

        print("\n" + "=" * 70)
        print("6. 关键测试：同一申请 + 同一原因，第二次调用撤件接口...")
        print("   期望：幂等命中，返回 success=True 和已有撤件记录")
        print("   之前的BUG：返回 success=False, message='申请已撤件'")
        print("=" * 70)

        response = client.post(
            "/cancellations/",
            json={
                "application_id": application_id,
                "reason": CancellationReason.DOC_EXPIRED.value,
                "reason_detail": "身份证已过期",
                "operator": "操作员A"
            }
        )
        assert response.status_code == 200, f"状态码错误: {response.status_code}"
        result2 = response.json()

        print(f"   返回 success: {result2['success']}")
        print(f"   返回 message: {result2['message']}")
        print(f"   返回 warnings: {result2['warnings']}")
        if result2["cancellation"]:
            print(f"   返回撤件编号: {result2['cancellation']['cancellation_no']}")

        assert result2["success"] is True, (
            f"幂等调用应该返回 success=True，实际是 success={result2['success']}。"
            f"message={result2['message']}"
        )
        assert result2["cancellation"] is not None, "幂等调用应该返回已有撤件记录"
        assert result2["cancellation"]["cancellation_no"] == cancel_no1, (
            f"幂等调用应该返回同一个撤件记录，期望 {cancel_no1}，"
            f"实际 {result2['cancellation']['cancellation_no']}"
        )
        assert "幂等" in result2["message"], "消息应该包含幂等提示"
        assert any("幂等校验" in w for w in result2["warnings"]), "应该包含幂等校验警告"

        print("   ✓ 幂等性正确！第二次调用返回已有记录，未重复创建")
        passed += 1

        print("\n7. 验证：撤件记录总数仍然是1（未重复创建）...")
        response = client.get("/cancellations/", params={"application_id": application_id})
        assert response.status_code == 200
        records = response.json()
        assert len(records) == 1, f"撤件记录应该是1条，实际是{len(records)}条"
        print(f"   ✓ 撤件记录总数正确: {len(records)} 条")
        passed += 1

        print("\n8. 测试：同一申请 + 不同原因，应该返回失败...")
        response = client.post(
            "/cancellations/",
            json={
                "application_id": application_id,
                "reason": CancellationReason.CUSTOMER_REGRET.value,
                "reason_detail": "客户不想要了",
                "operator": "操作员A"
            }
        )
        assert response.status_code == 200
        result3 = response.json()
        assert result3["success"] is False, "不同原因的撤件应该失败"
        assert "已撤件" in result3["message"], "消息应该提示已撤件"
        print(f"   ✓ 不同原因撤件正确拦截: success={result3['success']}, message={result3['message']}")
        passed += 1

        print("\n9. 验证：不同原因调用后，撤件记录总数仍然是1...")
        response = client.get("/cancellations/", params={"application_id": application_id})
        assert response.status_code == 200
        records = response.json()
        assert len(records) == 1, f"撤件记录应该是1条，实际是{len(records)}条"
        print(f"   ✓ 撤件记录总数未增加: {len(records)} 条")
        passed += 1

        print("\n" + "=" * 70)
        print(f"接口级测试完成: {passed} 项通过, {failed} 项失败")
        print("=" * 70)

        print("\n幂等性修复验证总结:")
        print("  ✓ 首次撤件：success=True，创建新记录")
        print("  ✓ 二次同因：success=True，返回已有记录（幂等命中）")
        print("  ✓ 二次异因：success=False，提示已撤件")
        print("  ✓ 记录总数：始终为1，无重复创建")

        return passed == 9

    except AssertionError as e:
        print(f"\n   ✗ 断言失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

    except Exception as e:
        print(f"\n   ✗ 测试异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_api_test()
    sys.exit(0 if success else 1)