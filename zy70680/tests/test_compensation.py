import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def override_get_db(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def client(override_get_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_check(client):
    """测试健康检查"""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_create_base_data(client):
    """测试基础数据创建"""
    # 创建用户
    response = await client.post(
        "/api/v1/users",
        json={"user_id": "USER001", "user_name": "张三", "phone": "13800138000"}
    )
    assert response.status_code == 200
    assert response.json()["user_id"] == "USER001"

    # 创建处理人
    response = await client.post(
        "/api/v1/handlers",
        json={"handler_id": "ADMIN001", "handler_name": "客服小王", "department": "客服部"}
    )
    assert response.status_code == 200
    assert response.json()["handler_id"] == "ADMIN001"

    # 创建支付流水
    response = await client.post(
        "/api/v1/transactions",
        json={
            "transaction_id": "PAY20240101001",
            "user_id": "USER001",
            "amount": 99.9,
            "pay_channel": "WECHAT",
            "pay_status": "SUCCESS"
        }
    )
    assert response.status_code == 200
    assert response.json()["transaction_id"] == "PAY20240101001"

    # 创建补偿券
    response = await client.post(
        "/api/v1/vouchers",
        json={"voucher_code": "VOUCHER001", "amount": 5.0, "valid_days": 30}
    )
    assert response.status_code == 200
    assert response.json()["voucher_code"] == "VOUCHER001"


@pytest.mark.asyncio
async def test_compensation_full_flow(client):
    """测试补偿记录完整流程"""
    # 1. 先创建基础数据
    await client.post("/api/v1/users", json={"user_id": "USER001", "user_name": "张三"})
    await client.post("/api/v1/handlers", json={"handler_id": "ADMIN001", "handler_name": "客服小王"})
    await client.post("/api/v1/transactions", json={
        "transaction_id": "PAY20240101001",
        "user_id": "USER001",
        "amount": 99.9,
        "pay_channel": "WECHAT"
    })

    # 2. 创建补偿记录
    response = await client.post(
        "/api/v1/records",
        json={
            "transaction_id": "PAY20240101001",
            "user_id": "USER001",
            "handler_id": "ADMIN001",
            "reason": "支付成功但订单未生成"
        }
    )
    assert response.status_code == 200
    record = response.json()
    assert record["status"] == "PENDING"
    assert record["transaction_id"] == "PAY20240101001"
    record_no = record["record_no"]

    # 3. 推进状态: MATCHING
    response = await client.put(
        f"/api/v1/records/{record_no}/status?new_status=MATCHING&handler_id=ADMIN001"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "MATCHING"

    # 4. 匹配订单（自动补建）
    response = await client.post(
        f"/api/v1/records/{record_no}/match-order?handler_id=ADMIN001"
    )
    assert response.status_code == 200
    result = response.json()
    assert result["record"]["status"] == "ORDER_CREATED"
    assert "order" in result

    # 5. 推进状态: COMPENSATING
    response = await client.put(
        f"/api/v1/records/{record_no}/status?new_status=COMPENSATING&handler_id=ADMIN001&reason=发放5元无门槛券"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "COMPENSATING"

    # 6. 推进状态: COMPLETED
    response = await client.put(
        f"/api/v1/records/{record_no}/status?new_status=COMPLETED&handler_id=ADMIN001&conclusion=补偿完成"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"

    # 7. 查询记录详情
    response = await client.get(f"/api/v1/records/{record_no}")
    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"

    # 8. 导出报告
    response = await client.post(
        f"/api/v1/records/{record_no}/report?exported_by=ADMIN001"
    )
    assert response.status_code == 200
    assert "report_no" in response.json()

    # 9. 查看操作日志
    response = await client.get(f"/api/v1/records/{record_no}/logs")
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) > 0
    operations = [log["operation"] for log in logs]
    assert "CREATE" in operations
    assert "STATUS_CHANGE" in operations


@pytest.mark.asyncio
async def test_idempotent_creation(client):
    """测试幂等性 - 重复创建返回409"""
    # 先创建基础数据
    await client.post("/api/v1/users", json={"user_id": "USER001", "user_name": "张三"})
    await client.post("/api/v1/handlers", json={"handler_id": "ADMIN001", "handler_name": "客服小王"})
    await client.post("/api/v1/transactions", json={
        "transaction_id": "PAY20240101001",
        "user_id": "USER001",
        "amount": 99.9
    })

    # 第一次创建 - 成功
    response = await client.post(
        "/api/v1/records",
        json={
            "transaction_id": "PAY20240101001",
            "user_id": "USER001",
            "handler_id": "ADMIN001"
        }
    )
    assert response.status_code == 200

    # 第二次创建 - 返回409冲突
    response = await client.post(
        "/api/v1/records",
        json={
            "transaction_id": "PAY20240101001",
            "user_id": "USER001",
            "handler_id": "ADMIN001"
        }
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_invalid_status_transition(client):
    """测试非法状态流转"""
    # 先创建基础数据和补偿记录
    await client.post("/api/v1/users", json={"user_id": "USER001", "user_name": "张三"})
    await client.post("/api/v1/handlers", json={"handler_id": "ADMIN001", "handler_name": "客服小王"})
    await client.post("/api/v1/transactions", json={"transaction_id": "PAY20240101001", "user_id": "USER001", "amount": 99.9})

    response = await client.post(
        "/api/v1/records",
        json={"transaction_id": "PAY20240101001", "user_id": "USER001", "handler_id": "ADMIN001"}
    )
    record_no = response.json()["record_no"]

    # 从 PENDING 直接到 COMPLETED - 应该失败
    response = await client.put(
        f"/api/v1/records/{record_no}/status?new_status=COMPLETED&handler_id=ADMIN001"
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_manual_correction(client):
    """测试人工修正"""
    await client.post("/api/v1/users", json={"user_id": "USER001", "user_name": "张三"})
    await client.post("/api/v1/handlers", json={"handler_id": "ADMIN001", "handler_name": "客服小王"})
    await client.post("/api/v1/transactions", json={"transaction_id": "PAY20240101001", "user_id": "USER001", "amount": 99.9})
    await client.post("/api/v1/vouchers", json={"voucher_code": "VOUCHER001", "amount": 5.0, "valid_days": 30})

    response = await client.post(
        "/api/v1/records",
        json={"transaction_id": "PAY20240101001", "user_id": "USER001", "handler_id": "ADMIN001"}
    )
    record_no = response.json()["record_no"]

    # 人工修正 - 关联补偿券
    response = await client.put(
        f"/api/v1/records/{record_no}/correct?handler_id=ADMIN001",
        json={
            "voucher_id": 1,
            "compensation_amount": 5.0,
            "compensation_type": "VOUCHER"
        }
    )
    assert response.status_code == 200
    assert response.json()["compensation_amount"] == 5.0
    assert response.json()["voucher_id"] == 1


@pytest.mark.asyncio
async def test_withdraw_and_close(client):
    """测试撤回和关闭"""
    await client.post("/api/v1/users", json={"user_id": "USER001", "user_name": "张三"})
    await client.post("/api/v1/handlers", json={"handler_id": "ADMIN001", "handler_name": "客服小王"})
    await client.post("/api/v1/transactions", json={"transaction_id": "PAY20240101001", "user_id": "USER001", "amount": 99.9})
    await client.post("/api/v1/transactions", json={"transaction_id": "PAY20240101002", "user_id": "USER001", "amount": 199.0})

    # 创建第一条记录用于撤回测试
    response = await client.post(
        "/api/v1/records",
        json={"transaction_id": "PAY20240101001", "user_id": "USER001", "handler_id": "ADMIN001"}
    )
    record_no1 = response.json()["record_no"]

    # 撤回
    response = await client.put(
        f"/api/v1/records/{record_no1}/withdraw?handler_id=ADMIN001&reason=用户已退款无需补偿"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "WITHDRAWN"

    # 创建第二条记录用于关闭测试
    response = await client.post(
        "/api/v1/records",
        json={"transaction_id": "PAY20240101002", "user_id": "USER001", "handler_id": "ADMIN001"}
    )
    record_no2 = response.json()["record_no"]

    # 关闭
    response = await client.put(
        f"/api/v1/records/{record_no2}/close?handler_id=ADMIN001&reason=超时未处理自动关闭"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "CLOSED"


@pytest.mark.asyncio
async def test_query_records(client):
    """测试查询列表"""
    await client.post("/api/v1/users", json={"user_id": "USER001", "user_name": "张三"})
    await client.post("/api/v1/handlers", json={"handler_id": "ADMIN001", "handler_name": "客服小王"})
    await client.post("/api/v1/transactions", json={"transaction_id": "PAY20240101001", "user_id": "USER001", "amount": 99.9})

    # 创建多条记录
    for i in range(3):
        await client.post(
            "/api/v1/records",
            json={
                "transaction_id": f"PAY2024010100{i+1}",
                "user_id": "USER001",
                "handler_id": "ADMIN001"
            }
        )

    # 查询列表
    response = await client.get("/api/v1/records")
    assert response.status_code == 200
    assert len(response.json()) >= 3

    # 按状态过滤
    response = await client.get("/api/v1/records?status=PENDING")
    assert response.status_code == 200
    for record in response.json():
        assert record["status"] == "PENDING"
