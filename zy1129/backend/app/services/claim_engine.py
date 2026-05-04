from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models import (
    Member, Policy, Coverage, Incident, Claim, 
    ClaimRule, ClaimCalculationResult
)
from app.schemas.claim_calculation import (
    RiskReason, ToDoItem, ClaimCalculationResult as CalculationResultSchema,
    ClaimAnalysisResponse
)


class ClaimEngine:
    REPORT_DEADLINE_DAYS = 30

    def __init__(self, db: AsyncSession):
        self.db = db

    async def analyze_incident(
        self, 
        incident_id: int,
        estimated_loss: Optional[Decimal] = None
    ) -> ClaimAnalysisResponse:
        incident = await self.db.execute(
            select(Incident).options(selectinload(Incident.member)).where(Incident.id == incident_id)
        )
        incident = incident.scalar_one_or_none()
        
        if not incident:
            raise ValueError(f"Incident with id {incident_id} not found")

        relevant_policies = await self._get_relevant_policies(incident)
        
        calculations: List[CalculationResultSchema] = []
        total_claimable = Decimal("0")

        for policy in relevant_policies:
            result = await self._calculate_policy_coverage(
                incident, policy, estimated_loss
            )
            calculations.append(result)
            if result.estimated_claimable_amount:
                total_claimable += result.estimated_claimable_amount

        overall_summary = self._generate_summary(calculations, incident)
        
        return ClaimAnalysisResponse(
            incident_id=incident.id,
            incident_number=incident.incident_number,
            incident_type=incident.incident_type,
            incident_date=incident.incident_date.isoformat(),
            affected_member_name=incident.member.name if incident.member else None,
            calculations=calculations,
            overall_summary=overall_summary,
            total_estimated_claimable=total_claimable
        )

    async def _get_relevant_policies(self, incident: Incident) -> List[Tuple[Policy, Optional[Coverage]]]:
        policies = []
        
        query = select(Policy).options(selectinload(Policy.coverages)).where(
            and_(
                Policy.is_active == True,
                Policy.start_date <= incident.incident_date,
                Policy.end_date >= incident.incident_date,
            )
        )
        
        if incident.affected_member_id:
            query = query.where(
                (Policy.insured_member_id == incident.affected_member_id) |
                (Policy.insured_member_id == None)
            )
        
        result = await self.db.execute(query)
        all_policies = result.scalars().all()

        incident_type = incident.incident_type.lower()
        
        for policy in all_policies:
            policy_type = policy.policy_type.lower()
            
            if policy_type == "medical":
                if "疾病" in incident_type or "住院" in incident_type or "医疗" in incident_type:
                    for coverage in policy.coverages:
                        if coverage.is_active:
                            policies.append((policy, coverage))
                    if not policy.coverages:
                        policies.append((policy, None))
            
            elif policy_type == "accident":
                if "意外" in incident_type or "事故" in incident_type or "伤害" in incident_type:
                    for coverage in policy.coverages:
                        if coverage.is_active:
                            policies.append((policy, coverage))
                    if not policy.coverages:
                        policies.append((policy, None))
            
            elif policy_type == "auto":
                if "车辆" in incident_type or "车险" in incident_type or "车祸" in incident_type:
                    for coverage in policy.coverages:
                        if coverage.is_active:
                            policies.append((policy, coverage))
                    if not policy.coverages:
                        policies.append((policy, None))
            
            elif policy_type == "property":
                if "家财" in incident_type or "房屋" in incident_type or "财产" in incident_type:
                    for coverage in policy.coverages:
                        if coverage.is_active:
                            policies.append((policy, coverage))
                    if not policy.coverages:
                        policies.append((policy, None))

        return policies

    async def _calculate_policy_coverage(
        self,
        incident: Incident,
        policy: Policy,
        coverage: Optional[Coverage],
        estimated_loss: Optional[Decimal]
    ) -> CalculationResultSchema:
        risk_reasons: List[RiskReason] = []
        to_do_items: List[ToDoItem] = []
        is_coverable = True

        waiting_period_status = await self._check_waiting_period(
            policy, coverage, incident.incident_date, risk_reasons, to_do_items
        )
        
        deductible_status = await self._check_deductible(
            policy, coverage, estimated_loss, risk_reasons, to_do_items
        )
        
        report_deadline_status = self._check_report_deadline(
            incident, risk_reasons, to_do_items
        )

        if any(rr.severity == "high" for rr in risk_reasons):
            is_coverable = False

        estimated_claimable = self._calculate_claimable_amount(
            policy, coverage, estimated_loss, deductible_status
        )

        await self._check_claim_rules(
            policy, coverage, incident, risk_reasons, to_do_items
        )

        self._add_document_requirements(policy, coverage, incident, to_do_items)

        return CalculationResultSchema(
            incident_id=incident.id,
            policy_id=policy.id,
            policy_number=policy.policy_number,
            insurance_company=policy.insurance_company,
            is_coverable=is_coverable,
            risk_reasons=risk_reasons,
            to_do_items=to_do_items,
            estimated_claimable_amount=estimated_claimable,
            waiting_period_status=waiting_period_status,
            deductible_status=deductible_status,
            report_deadline_status=report_deadline_status
        )

    async def _check_waiting_period(
        self,
        policy: Policy,
        coverage: Optional[Coverage],
        incident_date: date,
        risk_reasons: List[RiskReason],
        to_do_items: List[ToDoItem]
    ) -> str:
        waiting_days = policy.waiting_period_days or 0
        if coverage and coverage.waiting_period_days:
            waiting_days = coverage.waiting_period_days

        if waiting_days == 0:
            return "passed"

        waiting_end_date = policy.start_date + timedelta(days=waiting_days)
        
        if incident_date < waiting_end_date:
            days_remaining = (waiting_end_date - incident_date).days
            risk_reasons.append(RiskReason(
                type="waiting_period",
                message=f"出险日期仍在等待期内。等待期{waiting_days}天，到{waiting_end_date.isoformat()}结束，还差{days_remaining}天过等待期",
                severity="high"
            ))
            return "in_waiting_period"

        return "passed"

    async def _check_deductible(
        self,
        policy: Policy,
        coverage: Optional[Coverage],
        estimated_loss: Optional[Decimal],
        risk_reasons: List[RiskReason],
        to_do_items: List[ToDoItem]
    ) -> str:
        deductible = policy.deductible_amount or Decimal("0")
        if coverage and coverage.deductible:
            deductible = coverage.deductible

        if deductible == 0:
            return "not_applicable"

        annual_claims = await self._get_annual_claims(policy)
        total_deducted = sum(c.deductible_applied or Decimal("0") for c in annual_claims)
        
        remaining_deductible = deductible - total_deducted

        if remaining_deductible <= 0:
            return "reached"

        if estimated_loss and estimated_loss <= remaining_deductible:
            risk_reasons.append(RiskReason(
                type="deductible",
                message=f"预估损失金额{estimated_loss}元低于剩余免赔额{remaining_deductible}元，本次理赔可能无法获得赔付",
                severity="medium"
            ))
            to_do_items.append(ToDoItem(
                action="确认损失",
                description=f"核实实际损失金额是否超过免赔额{remaining_deductible}元",
                priority="high"
            ))
            return "not_reached"

        return "partially_reached"

    async def _get_annual_claims(self, policy: Policy) -> List[Claim]:
        today = date.today()
        start_of_year = date(today.year, 1, 1)
        
        query = select(Claim).where(
            and_(
                Claim.policy_id == policy.id,
                Claim.status.in_(["submitted", "processing", "paid"]),
                Claim.submit_date >= start_of_year
            )
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    def _check_report_deadline(
        self,
        incident: Incident,
        risk_reasons: List[RiskReason],
        to_do_items: List[ToDoItem]
    ) -> str:
        if incident.report_date:
            days_since_incident = (incident.report_date - incident.incident_date).days
            if days_since_incident > self.REPORT_DEADLINE_DAYS:
                risk_reasons.append(RiskReason(
                    type="report_deadline",
                    message=f"报案延迟，出险日期{incident.incident_date.isoformat()}，报案日期{incident.report_date.isoformat()}，超过{self.REPORT_DEADLINE_DAYS}天报案期限{days_since_incident - self.REPORT_DEADLINE_DAYS}天，可能影响理赔",
                    severity="high"
                ))
                return "delayed"
            return "ok"

        today = date.today()
        days_since_incident = (today - incident.incident_date).days
        days_remaining = self.REPORT_DEADLINE_DAYS - days_since_incident

        if days_remaining <= 0:
            risk_reasons.append(RiskReason(
                type="report_deadline",
                message=f"已超过报案期限{abs(days_remaining)}天，出险日期{incident.incident_date.isoformat()}，请立即联系保险公司报案",
                severity="high"
            ))
            return "overdue"
        elif days_remaining <= 7:
            risk_reasons.append(RiskReason(
                type="report_deadline",
                message=f"报案期限仅剩{days_remaining}天，请尽快向保险公司报案",
                severity="medium"
            ))
            to_do_items.append(ToDoItem(
                action="报案",
                description=f"向{self.REPORT_DEADLINE_DAYS}天期限内报案，剩余{days_remaining}天",
                deadline=(today + timedelta(days=days_remaining)).isoformat(),
                priority="high"
            ))
            return "urgent"

        to_do_items.append(ToDoItem(
            action="报案",
            description=f"在{self.REPORT_DEADLINE_DAYS}天期限内报案，剩余{days_remaining}天",
            deadline=(today + timedelta(days=days_remaining)).isoformat(),
            priority="medium"
        ))
        return "ok"

    def _calculate_claimable_amount(
        self,
        policy: Policy,
        coverage: Optional[Coverage],
        estimated_loss: Optional[Decimal],
        deductible_status: str
    ) -> Optional[Decimal]:
        if not estimated_loss:
            return None

        limit = policy.coverages[0].coverage_limit if policy.coverages else None
        if coverage:
            limit = coverage.coverage_limit

        if not limit:
            return estimated_loss

        ratio = coverage.reimbursement_ratio if coverage else Decimal("1.0")

        claimable = min(estimated_loss * ratio, limit)
        return claimable

    async def _check_claim_rules(
        self,
        policy: Policy,
        coverage: Optional[Coverage],
        incident: Incident,
        risk_reasons: List[RiskReason],
        to_do_items: List[ToDoItem]
    ):
        query = select(ClaimRule).where(
            and_(
                ClaimRule.is_active == True,
                (ClaimRule.policy_type == policy.policy_type) | (ClaimRule.policy_type == None),
            )
        ).order_by(ClaimRule.priority.desc())

        result = await self.db.execute(query)
        rules = result.scalars().all()

        for rule in rules:
            if rule.conditions:
                if self._evaluate_rule_condition(rule.conditions, policy, coverage, incident):
                    if rule.actions:
                        self._apply_rule_actions(rule.actions, risk_reasons, to_do_items)

    def _evaluate_rule_condition(
        self,
        conditions: dict,
        policy: Policy,
        coverage: Optional[Coverage],
        incident: Incident
    ) -> bool:
        return True

    def _apply_rule_actions(
        self,
        actions: dict,
        risk_reasons: List[RiskReason],
        to_do_items: List[ToDoItem]
    ):
        if "add_risk" in actions:
            risk = actions["add_risk"]
            risk_reasons.append(RiskReason(
                type=risk.get("type", "rule"),
                message=risk.get("message", ""),
                severity=risk.get("severity", "medium")
            ))
        
        if "add_todo" in actions:
            todo = actions["add_todo"]
            to_do_items.append(ToDoItem(
                action=todo.get("action", ""),
                description=todo.get("description", ""),
                priority=todo.get("priority", "medium")
            ))

    def _add_document_requirements(
        self,
        policy: Policy,
        coverage: Optional[Coverage],
        incident: Incident,
        to_do_items: List[ToDoItem]
    ):
        policy_type = policy.policy_type.lower()
        incident_type = incident.incident_type.lower()

        base_docs = [
            ("理赔申请书", "填写并签署理赔申请书"),
            ("身份证明", "提供被保险人身份证复印件"),
            ("银行账户", "提供收款银行账户信息"),
        ]

        if "medical" in policy_type or "疾病" in incident_type or "医疗" in incident_type:
            medical_docs = [
                ("诊断证明", "医院出具的正式诊断证明书"),
                ("医疗发票", "医疗费用发票原件"),
                ("费用明细", "医疗费用明细清单"),
                ("病历", "门诊或住院病历"),
                ("出院小结", "如有住院，需提供出院小结"),
            ]
            for doc_name, desc in medical_docs:
                to_do_items.append(ToDoItem(
                    action=f"准备{doc_name}",
                    description=desc,
                    priority="high"
                ))

        if "accident" in policy_type or "意外" in incident_type:
            accident_docs = [
                ("事故证明", "意外事故证明材料，如交警证明、单位证明等"),
                ("伤残鉴定", "如涉及伤残，需提供伤残鉴定报告"),
            ]
            for doc_name, desc in accident_docs:
                to_do_items.append(ToDoItem(
                    action=f"准备{doc_name}",
                    description=desc,
                    priority="high"
                ))

        if "auto" in policy_type or "车辆" in incident_type:
            auto_docs = [
                ("行驶证", "车辆行驶证复印件"),
                ("驾驶证", "驾驶员驾驶证复印件"),
                ("事故认定书", "交警事故认定书"),
                ("定损单", "保险公司定损单"),
                ("维修发票", "车辆维修发票"),
            ]
            for doc_name, desc in auto_docs:
                to_do_items.append(ToDoItem(
                    action=f"准备{doc_name}",
                    description=desc,
                    priority="high"
                ))

        if "property" in policy_type or "家财" in incident_type or "财产" in incident_type:
            property_docs = [
                ("财产损失清单", "详细的财产损失清单"),
                ("购买凭证", "受损财产的购买发票或凭证"),
                ("现场照片", "事故现场照片"),
                ("报警记录", "如涉及盗窃或人为损坏，需报警记录"),
            ]
            for doc_name, desc in property_docs:
                to_do_items.append(ToDoItem(
                    action=f"准备{doc_name}",
                    description=desc,
                    priority="high"
                ))

        for doc_name, desc in base_docs:
            to_do_items.append(ToDoItem(
                action=f"准备{doc_name}",
                description=desc,
                priority="medium"
            ))

    def _generate_summary(
        self,
        calculations: List[CalculationResultSchema],
        incident: Incident
    ) -> str:
        if not calculations:
            return f"未找到适用于本次{incident.incident_type}事件的有效保单，请检查保单配置。"

        coverable_count = sum(1 for c in calculations if c.is_coverable)
        total_claimable = sum(c.estimated_claimable_amount or Decimal("0") for c in calculations)

        high_risks = []
        for calc in calculations:
            for risk in calc.risk_reasons:
                if risk.severity == "high":
                    high_risks.append(f"{calc.policy_number}: {risk.message}")

        summary_parts = [
            f"本次{incident.incident_type}事件涉及{len(calculations)}份保单，",
            f"其中{coverable_count}份保单初步判断可理赔，",
            f"预估可赔金额总计约{total_claimable}元。"
        ]

        if high_risks:
            summary_parts.append(f"\n⚠️ 存在{len(high_risks)}个高风险项需要注意：")
            for risk in high_risks[:3]:
                summary_parts.append(f"- {risk}")

        return " ".join(summary_parts)


class ClaimAnalysisService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.engine = ClaimEngine(db)

    async def analyze_and_save(
        self,
        incident_id: int,
        estimated_loss: Optional[Decimal] = None
    ) -> ClaimAnalysisResponse:
        analysis = await self.engine.analyze_incident(incident_id, estimated_loss)
        
        for calc in analysis.calculations:
            result = ClaimCalculationResult(
                incident_id=calc.incident_id,
                policy_id=calc.policy_id,
                is_coverable=calc.is_coverable,
                risk_reasons=[rr.model_dump() for rr in calc.risk_reasons],
                to_do_items=[td.model_dump() for td in calc.to_do_items],
                estimated_claimable_amount=calc.estimated_claimable_amount,
                waiting_period_status=calc.waiting_period_status,
                deductible_status=calc.deductible_status,
                report_deadline_status=calc.report_deadline_status,
            )
            self.db.add(result)
        
        await self.db.commit()
        
        return analysis
