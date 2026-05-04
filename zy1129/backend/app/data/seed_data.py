from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Member, Policy, Coverage, Incident, Claim, ClaimRule, ClaimDocument, ClaimStatusTimeline


async def create_seed_data(db: AsyncSession):
    members = await _create_members(db)
    policies = await _create_policies(db, members)
    incidents = await _create_incidents(db, members)
    await _create_claims(db, incidents, policies)
    await _create_claim_rules(db)
    
    await db.commit()


async def _create_members(db: AsyncSession) -> Dict[str, Member]:
    members_data = [
        {"name": "张三", "relationship": "父亲", "birth_date": date(1980, 5, 15), "gender": "男"},
        {"name": "李四", "relationship": "母亲", "birth_date": date(1982, 8, 20), "gender": "女"},
        {"name": "张小宝", "relationship": "儿子", "birth_date": date(2010, 3, 10), "gender": "男"},
        {"name": "张小贝", "relationship": "女儿", "birth_date": date(2015, 12, 25), "gender": "女"},
    ]
    
    members = {}
    for data in members_data:
        member = Member(**data)
        db.add(member)
        members[data["name"]] = member
    
    await db.flush()
    return members


async def _create_policies(db: AsyncSession, members: Dict[str, Member]) -> Dict[str, Policy]:
    today = date.today()
    
    policies_data = [
        {
            "policy_number": "MED-2024-001",
            "insurance_company": "平安保险",
            "policy_type": "medical",
            "insured_member": "张三",
            "start_date": date(today.year - 1, today.month, today.day),
            "end_date": date(today.year, today.month, today.day) + timedelta(days=5),
            "waiting_period_days": 30,
            "deductible_amount": Decimal("10000"),
            "deductible_period": "annual",
            "premium_amount": Decimal("5000"),
            "payment_frequency": "annual",
            "coverages": [
                {"coverage_type": "住院医疗", "coverage_limit": Decimal("200000"), "reimbursement_ratio": Decimal("0.9")},
                {"coverage_type": "门诊医疗", "coverage_limit": Decimal("20000"), "reimbursement_ratio": Decimal("0.7")},
            ]
        },
        {
            "policy_number": "MED-2024-002",
            "insurance_company": "太平洋保险",
            "policy_type": "medical",
            "insured_member": "李四",
            "start_date": date(today.year - 6, today.month, today.day),
            "end_date": date(today.year + 6, today.month, today.day),
            "waiting_period_days": 90,
            "deductible_amount": Decimal("5000"),
            "deductible_period": "annual",
            "premium_amount": Decimal("3500"),
            "payment_frequency": "annual",
            "coverages": [
                {"coverage_type": "住院医疗", "coverage_limit": Decimal("300000"), "reimbursement_ratio": Decimal("0.85")},
            ]
        },
        {
            "policy_number": "MED-2024-003",
            "insurance_company": "中国人寿",
            "policy_type": "medical",
            "insured_member": "张小宝",
            "start_date": date(today.year, 1, 1),
            "end_date": date(today.year + 1, 1, 1),
            "waiting_period_days": 30,
            "deductible_amount": Decimal("1000"),
            "deductible_period": "annual",
            "premium_amount": Decimal("1200"),
            "payment_frequency": "annual",
            "coverages": [
                {"coverage_type": "少儿住院医疗", "coverage_limit": Decimal("50000"), "reimbursement_ratio": Decimal("0.9")},
                {"coverage_type": "少儿门诊", "coverage_limit": Decimal("10000"), "reimbursement_ratio": Decimal("0.8")},
            ]
        },
        {
            "policy_number": "ACC-2024-001",
            "insurance_company": "友邦保险",
            "policy_type": "accident",
            "insured_member": "张三",
            "start_date": date(today.year - 3, 6, 1),
            "end_date": date(today.year + 7, 6, 1),
            "waiting_period_days": 0,
            "deductible_amount": Decimal("0"),
            "deductible_period": "per_claim",
            "premium_amount": Decimal("800"),
            "payment_frequency": "annual",
            "coverages": [
                {"coverage_type": "意外身故", "coverage_limit": Decimal("1000000"), "reimbursement_ratio": Decimal("1.0")},
                {"coverage_type": "意外伤残", "coverage_limit": Decimal("500000"), "reimbursement_ratio": Decimal("1.0")},
                {"coverage_type": "意外医疗", "coverage_limit": Decimal("50000"), "reimbursement_ratio": Decimal("1.0")},
            ]
        },
        {
            "policy_number": "AUTO-2024-001",
            "insurance_company": "人保财险",
            "policy_type": "auto",
            "insured_member": None,
            "start_date": date(today.year, 3, 15),
            "end_date": date(today.year + 1, 3, 15),
            "waiting_period_days": 0,
            "deductible_amount": Decimal("2000"),
            "deductible_period": "per_claim",
            "premium_amount": Decimal("4500"),
            "payment_frequency": "annual",
            "coverages": [
                {"coverage_type": "交强险", "coverage_limit": Decimal("200000"), "reimbursement_ratio": Decimal("1.0")},
                {"coverage_type": "商业三者险", "coverage_limit": Decimal("2000000"), "reimbursement_ratio": Decimal("1.0")},
                {"coverage_type": "车损险", "coverage_limit": Decimal("150000"), "reimbursement_ratio": Decimal("1.0")},
            ]
        },
        {
            "policy_number": "PROP-2024-001",
            "insurance_company": "平安财险",
            "policy_type": "property",
            "insured_member": None,
            "start_date": date(today.year - 5, today.month, today.day),
            "end_date": date(today.year, today.month, today.day) + timedelta(days=15),
            "waiting_period_days": 7,
            "deductible_amount": Decimal("500"),
            "deductible_period": "per_claim",
            "premium_amount": Decimal("600"),
            "payment_frequency": "annual",
            "coverages": [
                {"coverage_type": "房屋主体", "coverage_limit": Decimal("3000000"), "reimbursement_ratio": Decimal("1.0")},
                {"coverage_type": "室内财产", "coverage_limit": Decimal("500000"), "reimbursement_ratio": Decimal("1.0")},
                {"coverage_type": "水暖管爆裂", "coverage_limit": Decimal("50000"), "reimbursement_ratio": Decimal("1.0")},
            ]
        },
        {
            "policy_number": "MED-2024-004",
            "insurance_company": "泰康保险",
            "policy_type": "medical",
            "insured_member": "张小贝",
            "start_date": date(today.year - 2, 11, 1),
            "end_date": date(today.year + 1, 11, 1),
            "waiting_period_days": 30,
            "deductible_amount": Decimal("0"),
            "deductible_period": "annual",
            "premium_amount": Decimal("980"),
            "payment_frequency": "annual",
            "coverages": [
                {"coverage_type": "少儿重疾", "coverage_limit": Decimal("300000"), "reimbursement_ratio": Decimal("1.0")},
                {"coverage_type": "少儿医疗", "coverage_limit": Decimal("30000"), "reimbursement_ratio": Decimal("0.9")},
            ]
        },
    ]
    
    policies = {}
    for data in policies_data:
        member = members.get(data["insured_member"]) if data["insured_member"] else None
        policy = Policy(
            policy_number=data["policy_number"],
            insurance_company=data["insurance_company"],
            policy_type=data["policy_type"],
            insured_member_id=member.id if member else None,
            start_date=data["start_date"],
            end_date=data["end_date"],
            waiting_period_days=data["waiting_period_days"],
            deductible_amount=data["deductible_amount"],
            deductible_period=data["deductible_period"],
            premium_amount=data["premium_amount"],
            payment_frequency=data["payment_frequency"],
            is_active=True,
        )
        db.add(policy)
        
        for cov_data in data.get("coverages", []):
            coverage = Coverage(
                coverage_type=cov_data["coverage_type"],
                coverage_limit=cov_data["coverage_limit"],
                reimbursement_ratio=cov_data["reimbursement_ratio"],
                is_active=True,
            )
            policy.coverages.append(coverage)
        
        policies[data["policy_number"]] = policy
    
    await db.flush()
    return policies


async def _create_incidents(db: AsyncSession, members: Dict[str, Member]) -> Dict[str, Incident]:
    today = date.today()
    
    incidents_data = [
        {
            "incident_number": "INC-2024-001",
            "incident_type": "意外受伤",
            "incident_date": today - timedelta(days=5),
            "report_date": today - timedelta(days=3),
            "affected_member": "张三",
            "description": "下班途中骑电动车摔倒，导致左手腕骨折，已送往医院治疗。",
            "location": "北京市朝阳区建国路",
            "severity": "moderate",
            "status": "processing",
        },
        {
            "incident_number": "INC-2024-002",
            "incident_type": "疾病住院",
            "incident_date": today - timedelta(days=45),
            "report_date": today - timedelta(days=40),
            "affected_member": "李四",
            "description": "因急性阑尾炎住院手术治疗，已出院。",
            "location": "北京协和医院",
            "severity": "moderate",
            "status": "closed",
        },
        {
            "incident_number": "INC-2024-003",
            "incident_type": "车辆事故",
            "incident_date": today - timedelta(days=120),
            "report_date": today - timedelta(days=118),
            "affected_member": None,
            "description": "小区停车场倒车时刮蹭到旁边车辆，双方车辆均有损伤。",
            "location": "阳光花园小区地下停车场",
            "severity": "minor",
            "status": "closed",
        },
        {
            "incident_number": "INC-2024-004",
            "incident_type": "儿童感冒发烧",
            "incident_date": today - timedelta(days=10),
            "report_date": None,
            "affected_member": "张小宝",
            "description": "孩子放学后出现高烧症状，已到社区医院就诊。",
            "location": "社区卫生服务中心",
            "severity": "minor",
            "status": "pending",
        },
    ]
    
    incidents = {}
    for data in incidents_data:
        member = members.get(data["affected_member"]) if data["affected_member"] else None
        incident = Incident(
            incident_number=data["incident_number"],
            incident_type=data["incident_type"],
            incident_date=data["incident_date"],
            report_date=data["report_date"],
            affected_member_id=member.id if member else None,
            description=data["description"],
            location=data["location"],
            severity=data["severity"],
            status=data["status"],
        )
        db.add(incident)
        incidents[data["incident_number"]] = incident
    
    await db.flush()
    return incidents


async def _create_claims(db: AsyncSession, incidents: Dict[str, Incident], policies: Dict[str, Policy]):
    today = date.today()
    
    incident_001 = incidents.get("INC-2024-001")
    policy_accident = policies.get("ACC-2024-001")
    policy_medical = policies.get("MED-2024-001")
    
    if incident_001 and policy_accident and policy_medical:
        claim1 = Claim(
            incident_id=incident_001.id,
            policy_id=policy_accident.id,
            coverage_id=policy_accident.coverages[2].id if policy_accident.coverages else None,
            claim_number="CLM-2024-001",
            submit_date=today - timedelta(days=2),
            claim_amount=Decimal("15000"),
            approved_amount=None,
            deductible_applied=Decimal("0"),
            status="processing",
            notes="等待保险公司审核中，已提交所有医疗票据。",
        )
        db.add(claim1)
        
        claim2 = Claim(
            incident_id=incident_001.id,
            policy_id=policy_medical.id,
            coverage_id=policy_medical.coverages[0].id if policy_medical.coverages else None,
            claim_number="CLM-2024-002",
            submit_date=today - timedelta(days=1),
            claim_amount=Decimal("25000"),
            approved_amount=None,
            deductible_applied=Decimal("10000"),
            status="submitted",
            notes="刚提交，需扣除年度免赔额1万元。",
        )
        db.add(claim2)
        
        await db.flush()
        
        doc1 = ClaimDocument(
            claim_id=claim1.id,
            document_type="医疗发票",
            document_name="门诊收费票据",
            is_required=True,
            is_submitted=True,
            submitted_date=today - timedelta(days=2),
        )
        doc2 = ClaimDocument(
            claim_id=claim1.id,
            document_type="诊断证明",
            document_name="骨折诊断证明书",
            is_required=True,
            is_submitted=True,
            submitted_date=today - timedelta(days=2),
        )
        db.add_all([doc1, doc2])
        
        timeline1 = ClaimStatusTimeline(
            claim_id=claim1.id,
            status="draft",
            description="创建理赔申请",
            operator="用户",
        )
        timeline2 = ClaimStatusTimeline(
            claim_id=claim1.id,
            status="submitted",
            description="提交理赔材料至保险公司",
            operator="用户",
        )
        timeline3 = ClaimStatusTimeline(
            claim_id=claim1.id,
            status="processing",
            description="保险公司正在审核",
            operator="系统",
        )
        db.add_all([timeline1, timeline2, timeline3])
    
    incident_002 = incidents.get("INC-2024-002")
    policy_medical_li = policies.get("MED-2024-002")
    
    if incident_002 and policy_medical_li:
        claim3 = Claim(
            incident_id=incident_002.id,
            policy_id=policy_medical_li.id,
            coverage_id=policy_medical_li.coverages[0].id if policy_medical_li.coverages else None,
            claim_number="CLM-2024-003",
            submit_date=today - timedelta(days=35),
            claim_amount=Decimal("18000"),
            approved_amount=Decimal("10200"),
            deductible_applied=Decimal("5000"),
            status="paid",
            notes="已赔付，扣除免赔额5000元后按85%比例赔付。",
        )
        db.add(claim3)
        
        await db.flush()
        
        timeline4 = ClaimStatusTimeline(
            claim_id=claim3.id,
            status="draft",
            description="创建理赔申请",
            operator="用户",
        )
        timeline5 = ClaimStatusTimeline(
            claim_id=claim3.id,
            status="submitted",
            description="提交理赔材料",
            operator="用户",
        )
        timeline6 = ClaimStatusTimeline(
            claim_id=claim3.id,
            status="processing",
            description="保险公司要求补充住院小结",
            operator="系统",
        )
        timeline7 = ClaimStatusTimeline(
            claim_id=claim3.id,
            status="additional_info",
            description="补充提交住院小结",
            operator="用户",
        )
        timeline8 = ClaimStatusTimeline(
            claim_id=claim3.id,
            status="paid",
            description="已赔付10200元",
            operator="系统",
        )
        db.add_all([timeline4, timeline5, timeline6, timeline7, timeline8])
    
    await db.flush()


async def _create_claim_rules(db: AsyncSession):
    rules_data = [
        {
            "rule_name": "医疗险等待期提醒",
            "rule_type": "waiting_period",
            "policy_type": "medical",
            "priority": 10,
        },
        {
            "rule_name": "意外险无等待期",
            "rule_type": "waiting_period",
            "policy_type": "accident",
            "priority": 5,
        },
        {
            "rule_name": "车险需事故认定书",
            "rule_type": "document",
            "policy_type": "auto",
            "priority": 8,
        },
    ]
    
    for data in rules_data:
        rule = ClaimRule(
            rule_name=data["rule_name"],
            rule_type=data["rule_type"],
            policy_type=data["policy_type"],
            is_active=True,
            priority=data["priority"],
        )
        db.add(rule)
    
    await db.flush()
