from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from app.models import Member, Policy, Coverage, Incident, Claim


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_risk_dashboard(self) -> Dict[str, Any]:
        today = date.today()
        thirty_days_later = today + timedelta(days=30)
        
        expiring_policies = await self._get_expiring_policies(today, thirty_days_later)
        expired_policies = await self._get_expired_policies(today)
        duplicate_coverages = await self._get_duplicate_coverages()
        pending_deductibles = await self._get_pending_deductibles()
        urgent_reports = await self._get_urgent_report_deadlines(today)
        
        stats = {
            "total_policies": await self._count_active_policies(),
            "total_members": await self._count_members(),
            "active_claims": await self._count_active_claims(),
            "pending_incidents": await self._count_pending_incidents(),
        }
        
        return {
            "stats": stats,
            "alerts": {
                "expiring_soon": expiring_policies,
                "already_expired": expired_policies,
                "duplicate_coverages": duplicate_coverages,
                "pending_deductibles": pending_deductibles,
                "urgent_reports": urgent_reports,
            },
            "summary": await self._generate_summary(
                expiring_policies, expired_policies, duplicate_coverages, 
                pending_deductibles, urgent_reports
            )
        }

    async def _get_expiring_policies(
        self, today: date, thirty_days_later: date
    ) -> List[Dict[str, Any]]:
        query = select(Policy).options(
            selectinload(Policy.member),
            selectinload(Policy.coverages)
        ).where(
            and_(
                Policy.is_active == True,
                Policy.end_date >= today,
                Policy.end_date <= thirty_days_later
            )
        ).order_by(Policy.end_date)
        
        result = await self.db.execute(query)
        policies = result.scalars().all()
        
        return [
            {
                "id": p.id,
                "policy_number": p.policy_number,
                "insurance_company": p.insurance_company,
                "policy_type": p.policy_type,
                "member_name": p.member.name if p.member else "全家",
                "end_date": p.end_date.isoformat(),
                "days_remaining": (p.end_date - today).days,
                "next_renewal_date": p.next_renewal_date.isoformat() if p.next_renewal_date else None,
            }
            for p in policies
        ]

    async def _get_expired_policies(self, today: date) -> List[Dict[str, Any]]:
        query = select(Policy).options(
            selectinload(Policy.member)
        ).where(
            and_(
                Policy.is_active == True,
                Policy.end_date < today
            )
        ).order_by(Policy.end_date.desc())
        
        result = await self.db.execute(query)
        policies = result.scalars().all()
        
        return [
            {
                "id": p.id,
                "policy_number": p.policy_number,
                "insurance_company": p.insurance_company,
                "policy_type": p.policy_type,
                "member_name": p.member.name if p.member else "全家",
                "end_date": p.end_date.isoformat(),
                "days_since_expiry": (today - p.end_date).days,
            }
            for p in policies
        ]

    async def _get_duplicate_coverages(self) -> List[Dict[str, Any]]:
        query = select(Policy).options(
            selectinload(Policy.member),
            selectinload(Policy.coverages)
        ).where(
            and_(
                Policy.is_active == True,
                Policy.insured_member_id != None
            )
        ).order_by(Policy.insured_member_id, Policy.policy_type)
        
        result = await self.db.execute(query)
        policies = result.scalars().all()
        
        member_policies: Dict[int, List[Dict]] = {}
        for p in policies:
            if p.insured_member_id not in member_policies:
                member_policies[p.insured_member_id] = []
            member_policies[p.insured_member_id].append({
                "id": p.id,
                "policy_number": p.policy_number,
                "insurance_company": p.insurance_company,
                "policy_type": p.policy_type,
                "member_name": p.member.name if p.member else "",
                "start_date": p.start_date.isoformat(),
                "end_date": p.end_date.isoformat(),
                "coverage_limit": float(p.coverages[0].coverage_limit) if p.coverages else 0,
            })
        
        duplicates = []
        for member_id, policies_list in member_policies.items():
            type_groups: Dict[str, List] = {}
            for p in policies_list:
                pt = p["policy_type"]
                if pt not in type_groups:
                    type_groups[pt] = []
                type_groups[pt].append(p)
            
            for pt, group in type_groups.items():
                if len(group) > 1:
                    duplicates.append({
                        "member_name": group[0]["member_name"],
                        "policy_type": pt,
                        "policies": group,
                        "total_limit": sum(p["coverage_limit"] for p in group),
                    })
        
        return duplicates

    async def _get_pending_deductibles(self) -> List[Dict[str, Any]]:
        today = date.today()
        start_of_year = date(today.year, 1, 1)
        
        query = select(Policy).options(
            selectinload(Policy.member),
            selectinload(Policy.coverages)
        ).where(
            and_(
                Policy.is_active == True,
                Policy.deductible_amount > 0
            )
        )
        
        result = await self.db.execute(query)
        policies = result.scalars().all()
        
        pending = []
        for policy in policies:
            claims_query = select(Claim).where(
                and_(
                    Claim.policy_id == policy.id,
                    Claim.status.in_(["submitted", "processing", "paid"]),
                    Claim.submit_date >= start_of_year
                )
            )
            claims_result = await self.db.execute(claims_query)
            claims = claims_result.scalars().all()
            
            total_deducted = sum(c.deductible_applied or Decimal("0") for c in claims)
            remaining = policy.deductible_amount - total_deducted
            
            if remaining > 0:
                pending.append({
                    "id": policy.id,
                    "policy_number": policy.policy_number,
                    "insurance_company": policy.insurance_company,
                    "policy_type": policy.policy_type,
                    "member_name": policy.member.name if policy.member else "全家",
                    "total_deductible": float(policy.deductible_amount),
                    "total_deducted": float(total_deducted),
                    "remaining": float(remaining),
                    "deductible_period": policy.deductible_period,
                })
        
        return sorted(pending, key=lambda x: x["remaining"], reverse=True)

    async def _get_urgent_report_deadlines(self, today: date) -> List[Dict[str, Any]]:
        REPORT_DEADLINE_DAYS = 30
        URGENT_DAYS = 7
        
        query = select(Incident).options(
            selectinload(Incident.member)
        ).where(
            and_(
                Incident.report_date == None,
                Incident.status != "closed"
            )
        )
        
        result = await self.db.execute(query)
        incidents = result.scalars().all()
        
        urgent = []
        for incident in incidents:
            days_since_incident = (today - incident.incident_date).days
            days_remaining = REPORT_DEADLINE_DAYS - days_since_incident
            
            if days_remaining <= URGENT_DAYS:
                urgent.append({
                    "id": incident.id,
                    "incident_number": incident.incident_number,
                    "incident_type": incident.incident_type,
                    "incident_date": incident.incident_date.isoformat(),
                    "member_name": incident.member.name if incident.member else "未指定",
                    "description": incident.description,
                    "days_since_incident": days_since_incident,
                    "days_remaining": max(0, days_remaining),
                    "is_overdue": days_remaining < 0,
                })
        
        return sorted(urgent, key=lambda x: x["days_remaining"])

    async def _count_active_policies(self) -> int:
        query = select(func.count(Policy.id)).where(Policy.is_active == True)
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def _count_members(self) -> int:
        query = select(func.count(Member.id))
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def _count_active_claims(self) -> int:
        query = select(func.count(Claim.id)).where(
            Claim.status.not_in(["paid", "rejected"])
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def _count_pending_incidents(self) -> int:
        query = select(func.count(Incident.id)).where(
            Incident.status == "pending"
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def _generate_summary(
        self,
        expiring: List,
        expired: List,
        duplicates: List,
        deductibles: List,
        urgent_reports: List
    ) -> str:
        alerts = []
        
        if expired:
            alerts.append(f"⚠️ {len(expired)} 份保单已过期但仍标记为有效")
        
        if expiring:
            urgent_expiring = [p for p in expiring if p["days_remaining"] <= 7]
            if urgent_expiring:
                alerts.append(f"🚨 {len(urgent_expiring)} 份保单将在7天内到期")
            else:
                alerts.append(f"📅 {len(expiring)} 份保单将在30天内到期")
        
        if duplicates:
            alerts.append(f"🔄 发现 {len(duplicates)} 组可能重复的保障")
        
        if urgent_reports:
            overdue = [r for r in urgent_reports if r["is_overdue"]]
            if overdue:
                alerts.append(f"🚨 {len(overdue)} 个出险事件已超过报案期限")
            else:
                alerts.append(f"⚠️ {len(urgent_reports)} 个出险事件报案期限即将到期")
        
        if deductibles:
            high_remaining = [d for d in deductibles if d["remaining"] > 1000]
            if high_remaining:
                alerts.append(f"💰 {len(high_remaining)} 份保单免赔额剩余超过1000元")
        
        if not alerts:
            return "✅ 未发现明显风险，保障状态良好。"
        
        return " | ".join(alerts)
