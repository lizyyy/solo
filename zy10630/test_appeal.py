import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database import Base, get_db
from models import AppealStatus, AppealSource

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_appeal.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def run_before_and_after_tests():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestAppealCompleteFlow:
    """测试：完整流转 - 已封禁 → 申诉中 → 已恢复"""

    def test_complete_flow(self):
        # 1. 创建申诉（初始状态：已封禁）
        create_response = client.post(
            "/api/appeal",
            json={
                "image_url": "https://example.com/test.jpg",
                "image_hash": "abc123",
                "review_tags": "色情",
                "model_version": "v1.0",
                "appeal_material": "这是正常艺术图片",
                "source": "人工申诉",
                "operator": "user001",
            },
        )
        assert create_response.status_code == 201
        appeal_id = create_response.json()["id"]
        assert create_response.json()["status"] == "已封禁"

        # 2. 检查历史记录是否存在
        history_response = client.get(f"/api/appeal/{appeal_id}/history")
        assert history_response.status_code == 200
        assert len(history_response.json()) >= 1

        # 3. 提交申诉 → 申诉中
        update_response = client.put(
            f"/api/appeal/{appeal_id}/status",
            json={
                "status": "申诉中",
                "operator": "admin001",
                "source": "人工申诉",
                "remark": "用户提交申诉，等待审核",
            },
        )
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "申诉中"

        # 4. 申诉通过 → 已恢复
        update_response2 = client.put(
            f"/api/appeal/{appeal_id}/status",
            json={
                "status": "已恢复",
                "operator": "admin001",
                "source": "人工申诉",
                "remark": "申诉通过，恢复图片访问",
            },
        )
        assert update_response2.status_code == 200
        assert update_response2.json()["status"] == "已恢复"

        # 5. 检查详情页数据是否对应
        detail_response = client.get(f"/api/appeal/{appeal_id}")
        assert detail_response.status_code == 200
        detail_data = detail_response.json()
        assert detail_data["status"] == "已恢复"
        assert len(detail_data["history"]) >= 3

        # 6. 检查列表页
        list_response = client.get("/api/appeal")
        assert list_response.status_code == 200
        assert list_response.json()["total"] == 1

        # 7. 检查导出
        export_response = client.get("/api/batch/export")
        assert export_response.status_code == 200
        assert export_response.json()["total"] == 1

        print("✓ 完整流转测试通过")


class TestConflictRecord:
    """测试：冲突记录 - 缩略图恢复但原图仍封禁"""

    def test_thumbnail_vs_original_conflict(self):
        # 1. 先创建缩略图并恢复
        thumbnail_response = client.post(
            "/api/appeal",
            json={
                "image_url": "https://example.com/thumb_test.jpg",
                "image_hash": "samehash456",
                "review_tags": "敏感",
                "model_version": "v1.0",
                "appeal_material": "缩略图申诉",
                "source": "人工申诉",
                "operator": "user001",
            },
        )
        thumbnail_id = thumbnail_response.json()["id"]

        # 缩略图恢复
        client.put(
            f"/api/appeal/{thumbnail_id}/status",
            json={
                "status": "申诉中",
                "operator": "admin001",
                "source": "人工申诉",
            },
        )
        client.put(
            f"/api/appeal/{thumbnail_id}/status",
            json={
                "status": "已恢复",
                "operator": "admin001",
                "source": "人工申诉",
                "remark": "缩略图申诉通过",
            },
        )

        # 2. 批量导入原图（相同hash不同URL），应该检测到冲突
        batch_response = client.post(
            "/api/batch/import?operator=import_user",
            json=[
                {
                    "image_url": "https://example.com/original_test.jpg",
                    "image_hash": "samehash456",
                    "review_tags": "敏感",
                    "model_version": "v1.0",
                    "appeal_material": "原图申诉",
                }
            ],
        )

        assert batch_response.status_code == 200
        batch_data = batch_response.json()
        assert batch_data["failed"] == 1
        assert "缩略图已恢复" in batch_data["results"][0]["error"]

        print("✓ 冲突记录测试通过")


class TestBadImportRows:
    """测试：导入坏行"""

    def test_bad_import_rows(self):
        batch_response = client.post(
            "/api/batch/import?operator=import_user",
            json=[
                {
                    "image_url": "https://example.com/good.jpg",
                    "review_tags": "正常",
                    "model_version": "v1.0",
                },
                {
                    "image_url": "",
                    "review_tags": "色情",
                    "model_version": "v1.0",
                },
                {
                    "image_url": "https://example.com/missing_tags.jpg",
                    "review_tags": "",
                    "model_version": "v1.0",
                },
                {
                    "image_url": "https://example.com/missing_version.jpg",
                    "review_tags": "广告",
                    "model_version": "",
                },
            ],
        )

        assert batch_response.status_code == 200
        batch_data = batch_response.json()

        assert batch_data["success"] == 1
        assert batch_data["failed"] == 3

        errors = [r["error"] for r in batch_data["results"] if not r["success"]]
        assert any("image_url不能为空" in e for e in errors)
        assert any("review_tags不能为空" in e for e in errors)
        assert any("model_version不能为空" in e for e in errors)

        print("✓ 导入坏行测试通过")


class TestConsistencyCheck:
    """测试：列表、详情、历史、导出数据一致性"""

    def test_data_consistency(self):
        # 创建多条记录
        for i in range(3):
            client.post(
                "/api/appeal",
                json={
                    "image_url": f"https://example.com/img{i}.jpg",
                    "review_tags": "测试",
                    "model_version": "v1.0",
                    "operator": "tester",
                },
            )

        # 更新其中一条的状态
        client.put(
            "/api/appeal/2/status",
            json={
                "status": "申诉中",
                "operator": "admin",
                "source": "人工申诉",
            },
        )

        # 检查列表
        list_response = client.get("/api/appeal")
        assert list_response.json()["total"] == 3

        # 检查详情
        detail_response = client.get("/api/appeal/2")
        assert detail_response.json()["status"] == "申诉中"
        assert len(detail_response.json()["history"]) == 2

        # 检查导出
        export_response = client.get("/api/batch/export")
        assert export_response.json()["total"] == 3

        # 按状态过滤
        filtered_list = client.get("/api/appeal?status=申诉中")
        assert filtered_list.json()["total"] == 1

        print("✓ 数据一致性测试通过")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
