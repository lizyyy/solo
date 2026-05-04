import pytest
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Member, Policy, Coverage, Incident
from app.services.claim_engine import ClaimEngine


@pytest.mark.asyncio
class TestClaimEngine:
    
    async def test_waiting_period_passed(self, async_session: AsyncSession):
        member = Member(
            name="测试成员",
            relationship="父亲",
            birth_date="1980-01-01",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        policy = Policy(
            policy_number="WAIT-001",
            insurance_company="测试公司",
            policy_type="medical",
            insured_member_id=member.id,
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            waiting_period_days=30,
            is_active=True
        )
        
        coverage = Coverage(
            coverage_type="住院医疗",
            coverage_limit=200000,
            reimbursement_ratio=Decimal("0.9"),
            is_active=True
        )
        policy.coverages.append(coverage)
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        
        incident = Incident(
            incident_number="INC-WAIT-001",
            incident_type="疾病住院",
            incident_date=date(2024, 2, 15),
            affected_member_id=member.id,
            description="等待期后住院",
            status="processing"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        risk_reasons = []
        to_do_items = []
        
        status = await engine._check_waiting_period(
            policy, coverage, incident.incident_date, risk_reasons, to_do_items
        )
        
        assert status == "passed"
        assert len(risk_reasons) == 0
    
    async def test_waiting_period_in_progress(self, async_session: AsyncSession):
        member = Member(
            name="测试成员2",
            relationship="母亲",
            birth_date="1982-01-01",
            gender="女"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        policy = Policy(
            policy_number="WAIT-002",
            insurance_company="测试公司",
            policy_type="medical",
            insured_member_id=member.id,
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            waiting_period_days=30,
            is_active=True
        )
        
        coverage = Coverage(
            coverage_type="住院医疗",
            coverage_limit=200000,
            reimbursement_ratio=Decimal("0.9"),
            is_active=True
        )
        policy.coverages.append(coverage)
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        
        incident = Incident(
            incident_number="INC-WAIT-002",
            incident_type="疾病住院",
            incident_date=date(2024, 1, 15),
            affected_member_id=member.id,
            description="等待期内住院",
            status="processing"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        risk_reasons = []
        to_do_items = []
        
        status = await engine._check_waiting_period(
            policy, coverage, incident.incident_date, risk_reasons, to_do_items
        )
        
        assert status == "in_waiting_period"
        assert len(risk_reasons) == 1
        assert risk_reasons[0].type == "waiting_period"
        assert risk_reasons[0].severity == "high"
        assert "等待期" in risk_reasons[0].message
    
    async def test_no_waiting_period(self, async_session: AsyncSession):
        member = Member(
            name="测试成员3",
            relationship="儿子",
            birth_date="2010-01-01",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        policy = Policy(
            policy_number="WAIT-003",
            insurance_company="测试公司",
            policy_type="accident",
            insured_member_id=member.id,
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            waiting_period_days=0,
            is_active=True
        )
        
        coverage = Coverage(
            coverage_type="意外医疗",
            coverage_limit=50000,
            reimbursement_ratio=Decimal("1.0"),
            is_active=True
        )
        policy.coverages.append(coverage)
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        
        engine = ClaimEngine(async_session)
        risk_reasons = []
        to_do_items = []
        
        status = await engine._check_waiting_period(
            policy, coverage, date(2024, 1, 2), risk_reasons, to_do_items
        )
        
        assert status == "passed"
        assert len(risk_reasons) == 0
    
    async def test_report_deadline_ok(self, async_session: AsyncSession):
        member = Member(
            name="测试成员4",
            relationship="女儿",
            birth_date="2015-01-01",
            gender="女"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        incident = Incident(
            incident_number="INC-DEAD-001",
            incident_type="意外受伤",
            incident_date=date.today() - timedelta(days=5),
            report_date=date.today() - timedelta(days=3),
            affected_member_id=member.id,
            description="正常报案",
            status="processing"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        risk_reasons = []
        to_do_items = []
        
        status = engine._check_report_deadline(incident, risk_reasons, to_do_items)
        
        assert status == "ok"
        assert len(risk_reasons) == 0
    
    async def test_report_deadline_delayed(self, async_session: AsyncSession):
        member = Member(
            name="测试成员5",
            relationship="父亲",
            birth_date="1980-01-01",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        incident = Incident(
            incident_number="INC-DEAD-002",
            incident_type="意外受伤",
            incident_date=date.today() - timedelta(days=50),
            report_date=date.today() - timedelta(days=45),
            affected_member_id=member.id,
            description="延迟报案",
            status="processing"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        risk_reasons = []
        to_do_items = []
        
        status = engine._check_report_deadline(incident, risk_reasons, to_do_items)
        
        assert status == "delayed"
        assert len(risk_reasons) == 1
        assert risk_reasons[0].type == "report_deadline"
        assert risk_reasons[0].severity == "high"
    
    async def test_report_deadline_urgent(self, async_session: AsyncSession):
        member = Member(
            name="测试成员6",
            relationship="母亲",
            birth_date="1982-01-01",
            gender="女"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        incident = Incident(
            incident_number="INC-DEAD-003",
            incident_type="意外受伤",
            incident_date=date.today() - timedelta(days=25),
            report_date=None,
            affected_member_id=member.id,
            description="即将过期报案",
            status="pending"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        risk_reasons = []
        to_do_items = []
        
        status = engine._check_report_deadline(incident, risk_reasons, to_do_items)
        
        assert status == "urgent"
        assert len(risk_reasons) == 1
        assert risk_reasons[0].severity == "medium"
        assert len(to_do_items) > 0
    
    async def test_report_deadline_overdue(self, async_session: AsyncSession):
        member = Member(
            name="测试成员7",
            relationship="父亲",
            birth_date="1980-01-01",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        incident = Incident(
            incident_number="INC-DEAD-004",
            incident_type="意外受伤",
            incident_date=date.today() - timedelta(days=40),
            report_date=None,
            affected_member_id=member.id,
            description="已过期未报案",
            status="pending"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        risk_reasons = []
        to_do_items = []
        
        status = engine._check_report_deadline(incident, risk_reasons, to_do_items)
        
        assert status == "overdue"
        assert len(risk_reasons) == 1
        assert risk_reasons[0].severity == "high"
        assert "已超过" in risk_reasons[0].message
    
    async def test_document_requirements_medical(self, async_session: AsyncSession):
        member = Member(
            name="测试成员8",
            relationship="父亲",
            birth_date="1980-01-01",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        policy = Policy(
            policy_number="DOC-001",
            insurance_company="测试公司",
            policy_type="medical",
            insured_member_id=member.id,
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            is_active=True
        )
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        
        incident = Incident(
            incident_number="INC-DOC-001",
            incident_type="疾病住院",
            incident_date=date(2024, 3, 1),
            affected_member_id=member.id,
            description="住院治疗",
            status="processing"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        to_do_items = []
        
        engine._add_document_requirements(policy, None, incident, to_do_items)
        
        assert len(to_do_items) > 0
        
        medical_docs = ["诊断证明", "医疗发票", "费用明细", "病历", "出院小结"]
        doc_actions = [td.action for td in to_do_items]
        
        for doc in medical_docs:
            assert any(doc in action for action in doc_actions)
    
    async def test_document_requirements_accident(self, async_session: AsyncSession):
        member = Member(
            name="测试成员9",
            relationship="母亲",
            birth_date="1982-01-01",
            gender="女"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        policy = Policy(
            policy_number="DOC-002",
            insurance_company="测试公司",
            policy_type="accident",
            insured_member_id=member.id,
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            is_active=True
        )
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        
        incident = Incident(
            incident_number="INC-DOC-002",
            incident_type="意外受伤",
            incident_date=date(2024, 3, 1),
            affected_member_id=member.id,
            description="意外摔倒",
            status="processing"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        to_do_items = []
        
        engine._add_document_requirements(policy, None, incident, to_do_items)
        
        assert len(to_do_items) > 0
        
        accident_docs = ["事故证明", "伤残鉴定"]
        doc_actions = [td.action for td in to_do_items]
        
        for doc in accident_docs:
            assert any(doc in action for action in doc_actions)
    
    async def test_document_requirements_auto(self, async_session: AsyncSession):
        policy = Policy(
            policy_number="DOC-003",
            insurance_company="测试公司",
            policy_type="auto",
            start_date=date(2024, 1, 1),
            end_date=date(2025, 1, 1),
            is_active=True
        )
        async_session.add(policy)
        await async_session.commit()
        await async_session.refresh(policy)
        
        incident = Incident(
            incident_number="INC-DOC-003",
            incident_type="车辆事故",
            incident_date=date(2024, 3, 1),
            description="车辆刮蹭",
            status="processing"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        to_do_items = []
        
        engine._add_document_requirements(policy, None, incident, to_do_items)
        
        assert len(to_do_items) > 0
        
        auto_docs = ["行驶证", "驾驶证", "事故认定书", "定损单", "维修发票"]
        doc_actions = [td.action for td in to_do_items]
        
        for doc in auto_docs:
            assert any(doc in action for action in doc_actions)
    
    async def test_generate_summary_no_policies(self, async_session: AsyncSession):
        member = Member(
            name="测试成员10",
            relationship="父亲",
            birth_date="1980-01-01",
            gender="男"
        )
        async_session.add(member)
        await async_session.commit()
        await async_session.refresh(member)
        
        incident = Incident(
            incident_number="INC-SUM-001",
            incident_type="意外受伤",
            incident_date=date(2024, 3, 1),
            affected_member_id=member.id,
            description="测试事件",
            status="processing"
        )
        async_session.add(incident)
        await async_session.commit()
        await async_session.refresh(incident)
        
        engine = ClaimEngine(async_session)
        
        summary = engine._generate_summary([], incident)
        
        assert "未找到适用于本次" in summary
        assert "意外受伤" in summary
