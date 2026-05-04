import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta

from app.models import Policy, Member, Coverage


@pytest.mark.asyncio
class TestPolicyAPI:
    
    async def test_list_policies_empty(self, client: AsyncClient):
        response = await client.get("/api/policies/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    
    async def test_create_policy_with_member(self, client: AsyncClient, async_session: AsyncSession):
        member = Member(
            name="测试被保险人",
            relationship="父亲",
            birth_date="1980-01-01",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        policy_data = {
            "policy_number": "MED-TEST-001",
            "insurance_company": "平安保险",
            "policy_type": "medical",
            "insured_member_id": member.id,
            "start_date": "2024-01-01",
            "end_date": "2025-01-01",
            "waiting_period_days": 30,
            "deductible_amount": 10000,
            "deductible_period": "annual",
            "premium_amount": 5000,
            "is_active": True
        }
        
        response = await client.post("/api/policies/", json=policy_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["policy_number"] == "MED-TEST-001"
        assert data["insurance_company"] == "平安保险"
        assert data["policy_type"] == "medical"
        assert data["insured_member_id"] == member.id
        assert data["start_date"] == "2024-01-01"
        assert data["end_date"] == "2025-01-01"
        assert data["waiting_period_days"] == 30
        assert data["deductible_amount"] == 10000
        assert data["is_active"] is True
    
    async def test_create_policy_required_fields(self, client: AsyncClient):
        invalid_data = {
            "policy_number": "INVALID-001"
        }
        
        response = await client.post("/api/policies/", json=invalid_data)
        assert response.status_code == 422
    
    async def test_get_policy_by_id(self, client: AsyncClient, async_session: AsyncSession):
        policy = Policy(
            policy_number="POL-001",
            insurance_company="测试保险公司",
            policy_type="accident",
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            is_active=True
        )
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        
        response = await client.get(f"/api/policies/{policy.id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == policy.id
        assert data["policy_number"] == "POL-001"
        assert data["insurance_company"] == "测试保险公司"
    
    async def test_get_policy_not_found(self, client: AsyncClient):
        response = await client.get("/api/policies/9999")
        assert response.status_code == 404
    
    async def test_update_policy(self, client: AsyncClient, async_session: AsyncSession):
        policy = Policy(
            policy_number="UPDATE-001",
            insurance_company="原保险公司",
            policy_type="medical",
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            waiting_period_days=30,
            is_active=True
        )
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        
        update_data = {
            "insurance_company": "新保险公司",
            "waiting_period_days": 90,
            "notes": "更新的备注"
        }
        
        response = await client.put(f"/api/policies/{policy.id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["insurance_company"] == "新保险公司"
        assert data["waiting_period_days"] == 90
        assert data["notes"] == "更新的备注"
        assert data["policy_number"] == "UPDATE-001"
    
    async def test_delete_policy(self, client: AsyncClient, async_session: AsyncSession):
        policy = Policy(
            policy_number="DELETE-001",
            insurance_company="删除测试保险公司",
            policy_type="auto",
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            is_active=True
        )
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        policy_id = policy.id
        
        result = await async_session.execute(
            select(Policy).where(Policy.id == policy_id)
        )
        assert result.scalar_one_or_none() is not None
        
        response = await client.delete(f"/api/policies/{policy_id}")
        assert response.status_code == 204
        
        await async_session.expire_all()
        result = await async_session.execute(
            select(Policy).where(Policy.id == policy_id)
        )
        assert result.scalar_one_or_none() is None
    
    async def test_list_policies_with_coverage(self, client: AsyncClient, async_session: AsyncSession):
        policy = Policy(
            policy_number="COVERAGE-001",
            insurance_company="测试公司",
            policy_type="medical",
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            is_active=True
        )
        
        coverage1 = Coverage(
            coverage_type="住院医疗",
            coverage_limit=200000,
            reimbursement_ratio=0.9,
            is_active=True
        )
        
        coverage2 = Coverage(
            coverage_type="门诊医疗",
            coverage_limit=20000,
            reimbursement_ratio=0.7,
            is_active=True
        )
        
        policy.coverages.append(coverage1)
        policy.coverages.append(coverage2)
        async_session.add(policy)
        await async_session.commit()
        
        response = await client.get("/api/policies/")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 1
        policy_data = data[0]
        assert policy_data["policy_number"] == "COVERAGE-001"
    
    async def test_filter_policies_by_type(self, client: AsyncClient, async_session: AsyncSession):
        policies = [
            Policy(
                policy_number="MED-001",
                insurance_company="公司1",
                policy_type="medical",
                start_date=date(2024, 1, 1),
                end_date=date(2025, 1, 1)
            ),
            Policy(
                policy_number="ACC-001",
                insurance_company="公司2",
                policy_type="accident",
                start_date=date(2024, 1, 1),
                end_date=date(2025, 1, 1)
            ),
            Policy(
                policy_number="AUTO-001",
                insurance_company="公司3",
                policy_type="auto",
                start_date=date(2024, 1, 1),
                end_date=date(2025, 1, 1)
            ),
        ]
        async_session.add_all(policies)
        await async_session.commit()
        
        response = await client.get("/api/policies/?policy_type=medical")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["policy_number"] == "MED-001"
        
        response = await client.get("/api/policies/?policy_type=accident")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["policy_number"] == "ACC-001"
    
    async def test_expiring_soon_policies_in_dashboard(self, client: AsyncClient, async_session: AsyncSession):
        today = date.today()
        
        expiring_policy = Policy(
            policy_number="EXPIRING-001",
            insurance_company="即将到期公司",
            policy_type="medical",
            start_date=date(today.year - 1, today.month, today.day),
            end_date=date(today.year, today.month, today.day) + timedelta(days=15),
            is_active=True
        )
        
        normal_policy = Policy(
            policy_number="NORMAL-001",
            insurance_company="正常公司",
            policy_type="medical",
            start_date=date(today.year, 1, 1),
            end_date=date(today.year + 1, 1, 1),
            is_active=True
        )
        
        async_session.add_all([expiring_policy, normal_policy])
        await async_session.commit()
        
        response = await client.get("/api/dashboard/")
        assert response.status_code == 200
        
        data = response.json()
        assert "alerts" in data
        assert "expiring_soon" in data["alerts"]
        
        expiring = data["alerts"]["expiring_soon"]
        assert len(expiring) >= 1
        policy_numbers = [p["policy_number"] for p in expiring]
        assert "EXPIRING-001" in policy_numbers
