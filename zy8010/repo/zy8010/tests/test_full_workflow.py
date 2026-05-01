import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.main import app
from app.database import get_db, Base as AppBase
from app.models import Base


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    TestingSessionLocal = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_session):
    async def override_get_db():
        yield test_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_full_workflow_import_to_report(client):
    batch_no = "BATCH_20260501_001"
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)
    next_week = today + timedelta(days=7)

    import_data = {
        "batch_no": batch_no,
        "prescriptions": [
            {
                "prescription_no": "RX20260501001",
                "patient_name": "张三",
                "patient_id": "P001",
                "prescription_date": yesterday.isoformat(),
                "doctor_name": "李医生",
                "department": "内科",
                "diagnosis": "高血压",
                "batch_no": batch_no,
                "items": [
                    {
                        "drug_name": "硝苯地平缓释片",
                        "drug_code": "DRUG001",
                        "specification": "10mg*30片",
                        "quantity": 2.0,
                        "unit": "盒",
                        "dosage": "每日2次，每次1片",
                        "batch_no": "BATCH20260101"
                    },
                    {
                        "drug_name": "阿司匹林肠溶片",
                        "drug_code": "DRUG002",
                        "specification": "100mg*30片",
                        "quantity": 1.0,
                        "unit": "盒",
                        "dosage": "每日1次，每次1片",
                        "batch_no": "BATCH20260102"
                    }
                ]
            },
            {
                "prescription_no": "RX20260501002",
                "patient_name": "李四",
                "patient_id": "P002",
                "prescription_date": tomorrow.isoformat(),
                "doctor_name": "王医生",
                "department": "内分泌科",
                "diagnosis": "糖尿病",
                "batch_no": batch_no,
                "items": [
                    {
                        "drug_name": "二甲双胍缓释片",
                        "drug_code": "DRUG003",
                        "specification": "500mg*30片",
                        "quantity": 3.0,
                        "unit": "盒",
                        "dosage": "每日2次，每次1片",
                        "batch_no": "BATCH20260103"
                    }
                ]
            }
        ],
        "settlements": [
            {
                "settlement_no": "STL20260501001",
                "prescription_no": "RX20260501001",
                "settlement_date": today.isoformat(),
                "total_amount": 156.50,
                "insurance_payment": 125.20,
                "personal_payment": 31.30,
                "batch_no": batch_no
            },
            {
                "settlement_no": "STL20260501002",
                "prescription_no": "RX20260501002",
                "settlement_date": yesterday.isoformat(),
                "total_amount": 89.00,
                "insurance_payment": 71.20,
                "personal_payment": 18.80,
                "batch_no": batch_no
            }
        ],
        "inventories": [
            {
                "drug_code": "DRUG001",
                "drug_name": "硝苯地平缓释片",
                "batch_no": "BATCH20260101",
                "quantity": 100.0,
                "unit": "盒",
                "expiry_date": next_week.isoformat(),
                "manufacturer": "某制药公司"
            },
            {
                "drug_code": "DRUG002",
                "drug_name": "阿司匹林肠溶片",
                "batch_no": "BATCH20260102",
                "quantity": 50.0,
                "unit": "盒",
                "expiry_date": next_week.isoformat(),
                "manufacturer": "某制药公司"
            }
        ],
        "returns": []
    }

    response = await client.post("/api/import/batch", json=import_data)
    assert response.status_code == 200, f"导入失败: {response.text}"
    import_result = response.json()
    assert import_result["success"] is True, f"导入有错误: {import_result.get('errors', [])}"
    assert import_result["imported"]["prescriptions"] == 2
    assert import_result["imported"]["settlements"] == 2
    assert import_result["imported"]["inventories"] == 2

    val_response1 = await client.get("/api/validate/RX20260501001")
    assert val_response1.status_code == 200
    val_result1 = val_response1.json()
    assert val_result1["prescription_no"] == "RX20260501001"
    assert val_result1["total_rules"] == 6

    val_response2 = await client.get("/api/validate/RX20260501002")
    assert val_response2.status_code == 200
    val_result2 = val_response2.json()

    date_issues = [r for r in val_result2["results"] if r["rule_code"] == "R001" and not r["passed"]]
    assert len(date_issues) > 0, "应该检测到处方日期晚于结算日期的问题"

    batch_issues = [r for r in val_result2["results"] if r["rule_code"] == "R002" and not r["passed"]]
    assert len(batch_issues) > 0, "应该检测到批号不存在的问题"

    review_response1 = await client.put(
        "/api/review/RX20260501001/status",
        json={
            "status": "approved",
            "reviewer": "张药师",
            "review_comment": "处方合规，药品批号有效，结算金额一致。"
        }
    )
    assert review_response1.status_code == 200
    review_result1 = review_response1.json()
    assert review_result1["status"] == "approved"
    assert review_result1["reviewer"] == "张药师"

    review_response2 = await client.put(
        "/api/review/RX20260501002/status",
        json={
            "status": "needs_rectification",
            "reviewer": "李药师",
            "review_comment": "存在高风险问题",
            "rectification_note": "请核对处方日期和药品批号后重新提交。"
        }
    )
    assert review_response2.status_code == 200
    review_result2 = review_response2.json()
    assert review_result2["status"] == "needs_rectification"

    report_response = await client.get(f"/api/report/markdown?batch_no={batch_no}")
    assert report_response.status_code == 200
    report_content = report_response.text

    assert "处方外配复核审计报告" in report_content
    assert "RX20260501001" in report_content
    assert "RX20260501002" in report_content
    assert "处方日期晚于结算日期" in report_content
    assert "批号不存在" in report_content
    assert "张药师" in report_content
    assert "李药师" in report_content

    stats_response = await client.get(f"/api/report/stats?batch_no={batch_no}")
    assert stats_response.status_code == 200
    stats_result = stats_response.json()
    assert stats_result["total_prescriptions"] == 2
    assert stats_result["high_severity_issues"] >= 2

    print("\n=== 测试通过: 完整流程验证成功 ===")
    print(f"导入处方数: {import_result['imported']['prescriptions']}")
    print(f"导入结算数: {import_result['imported']['settlements']}")
    print(f"处方1校验结果: 通过{val_result1['passed_count']}, 失败{val_result1['failed_count']}")
    print(f"处方2校验结果: 通过{val_result2['passed_count']}, 失败{val_result2['failed_count']}")
    print(f"报告包含高风险问题: {stats_result['high_severity_issues']}个")


@pytest.mark.asyncio
async def test_return_quantity_exceeds_rule(client):
    batch_no = "TEST_RETURN_BATCH"
    today = datetime.now()
    next_week = today + timedelta(days=7)

    import_data = {
        "batch_no": batch_no,
        "prescriptions": [
            {
                "prescription_no": "RX_RETURN_TEST",
                "patient_name": "王五",
                "patient_id": "P003",
                "prescription_date": today.isoformat(),
                "doctor_name": "赵医生",
                "department": "内科",
                "diagnosis": "感冒",
                "batch_no": batch_no,
                "items": [
                    {
                        "drug_name": "布洛芬缓释胶囊",
                        "drug_code": "DRUG004",
                        "specification": "300mg*20粒",
                        "quantity": 2.0,
                        "unit": "盒",
                        "dosage": "每日2次，每次1粒",
                        "batch_no": "BATCH20260104"
                    }
                ]
            }
        ],
        "settlements": [],
        "inventories": [
            {
                "drug_code": "DRUG004",
                "drug_name": "布洛芬缓释胶囊",
                "batch_no": "BATCH20260104",
                "quantity": 100.0,
                "unit": "盒",
                "expiry_date": next_week.isoformat(),
                "manufacturer": "某制药公司"
            }
        ],
        "returns": [
            {
                "return_no": "RET20260501001",
                "prescription_no": "RX_RETURN_TEST",
                "drug_name": "布洛芬缓释胶囊",
                "batch_no": "BATCH20260104",
                "return_quantity": 5.0,
                "return_date": today.isoformat(),
                "return_reason": "患者过敏",
                "operator": "李护士"
            }
        ]
    }

    response = await client.post("/api/import/batch", json=import_data)
    assert response.status_code == 200
    import_result = response.json()
    assert import_result["imported"]["returns"] == 1

    val_response = await client.get("/api/validate/RX_RETURN_TEST")
    assert val_response.status_code == 200
    val_result = val_response.json()

    return_issues = [r for r in val_result["results"] if r["rule_code"] == "R003" and not r["passed"]]
    assert len(return_issues) > 0, "应该检测到退药数量超过原发药数量的问题"

    issue = return_issues[0]
    assert "超过原发药数量" in issue["description"]
