import csv
from io import StringIO
from typing import List, Dict, Any, Optional
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models import Member, Policy, Coverage, Incident, Claim


class ExportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def export_policies_csv(
        self,
        member_id: Optional[int] = None,
        policy_type: Optional[str] = None
    ) -> str:
        query = select(Policy).options(
            selectinload(Policy.member),
            selectinload(Policy.coverages)
        ).order_by(Policy.id)
        
        conditions = []
        if member_id:
            conditions.append(Policy.insured_member_id == member_id)
        if policy_type:
            conditions.append(Policy.policy_type == policy_type)
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.db.execute(query)
        policies = result.scalars().all()

        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "policy_number", "insurance_company", "policy_type",
            "insured_member_name", "start_date", "end_date",
            "waiting_period_days", "deductible_amount", "deductible_period",
            "premium_amount", "payment_frequency", "next_renewal_date",
            "coverage_type", "coverage_limit", "reimbursement_ratio",
            "is_active", "notes"
        ])
        
        for policy in policies:
            member_name = policy.member.name if policy.member else ""
            
            if policy.coverages:
                for coverage in policy.coverages:
                    writer.writerow([
                        policy.policy_number,
                        policy.insurance_company,
                        policy.policy_type,
                        member_name,
                        policy.start_date.isoformat() if policy.start_date else "",
                        policy.end_date.isoformat() if policy.end_date else "",
                        policy.waiting_period_days,
                        float(policy.deductible_amount) if policy.deductible_amount else 0,
                        policy.deductible_period,
                        float(policy.premium_amount) if policy.premium_amount else 0,
                        policy.payment_frequency or "",
                        policy.next_renewal_date.isoformat() if policy.next_renewal_date else "",
                        coverage.coverage_type,
                        float(coverage.coverage_limit) if coverage.coverage_limit else 0,
                        float(coverage.reimbursement_ratio) if coverage.reimbursement_ratio else 1.0,
                        policy.is_active,
                        policy.notes or "",
                    ])
            else:
                writer.writerow([
                    policy.policy_number,
                    policy.insurance_company,
                    policy.policy_type,
                    member_name,
                    policy.start_date.isoformat() if policy.start_date else "",
                    policy.end_date.isoformat() if policy.end_date else "",
                    policy.waiting_period_days,
                    float(policy.deductible_amount) if policy.deductible_amount else 0,
                    policy.deductible_period,
                    float(policy.premium_amount) if policy.premium_amount else 0,
                    policy.payment_frequency or "",
                    policy.next_renewal_date.isoformat() if policy.next_renewal_date else "",
                    "",
                    0,
                    1.0,
                    policy.is_active,
                    policy.notes or "",
                ])
        
        return output.getvalue()

    async def export_incidents_csv(
        self,
        member_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> str:
        query = select(Incident).options(
            selectinload(Incident.member),
            selectinload(Incident.claims)
        ).order_by(Incident.incident_date.desc())
        
        conditions = []
        if member_id:
            conditions.append(Incident.affected_member_id == member_id)
        if status:
            conditions.append(Incident.status == status)
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.db.execute(query)
        incidents = result.scalars().all()

        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "incident_number", "incident_type", "incident_date",
            "report_date", "affected_member_name", "description",
            "location", "severity", "status", "claim_count", "notes"
        ])
        
        for incident in incidents:
            member_name = incident.member.name if incident.member else ""
            writer.writerow([
                incident.incident_number,
                incident.incident_type,
                incident.incident_date.isoformat() if incident.incident_date else "",
                incident.report_date.isoformat() if incident.report_date else "",
                member_name,
                incident.description,
                incident.location or "",
                incident.severity,
                incident.status,
                len(incident.claims),
                incident.notes or "",
            ])
        
        return output.getvalue()

    async def export_claims_csv(
        self,
        incident_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> str:
        query = select(Claim).options(
            selectinload(Claim.policy),
            selectinload(Claim.coverage),
            selectinload(Claim.incident),
            selectinload(Claim.status_timeline),
            selectinload(Claim.documents)
        ).order_by(Claim.created_at.desc())
        
        conditions = []
        if incident_id:
            conditions.append(Claim.incident_id == incident_id)
        if status:
            conditions.append(Claim.status == status)
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.db.execute(query)
        claims = result.scalars().all()

        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "claim_number", "incident_number", "incident_date",
            "policy_number", "insurance_company", "coverage_type",
            "submit_date", "claim_amount", "approved_amount",
            "deductible_applied", "status", "rejection_reason",
            "document_count", "notes"
        ])
        
        for claim in claims:
            writer.writerow([
                claim.claim_number,
                claim.incident.incident_number if claim.incident else "",
                claim.incident.incident_date.isoformat() if claim.incident and claim.incident.incident_date else "",
                claim.policy.policy_number if claim.policy else "",
                claim.policy.insurance_company if claim.policy else "",
                claim.coverage.coverage_type if claim.coverage else "",
                claim.submit_date.isoformat() if claim.submit_date else "",
                float(claim.claim_amount) if claim.claim_amount else 0,
                float(claim.approved_amount) if claim.approved_amount else 0,
                float(claim.deductible_applied) if claim.deductible_applied else 0,
                claim.status,
                claim.rejection_reason or "",
                len(claim.documents),
                claim.notes or "",
            ])
        
        return output.getvalue()

    async def export_markdown(
        self,
        member_id: Optional[int] = None,
        policy_type: Optional[str] = None,
        include_policies: bool = True,
        include_incidents: bool = True,
        include_claims: bool = True
    ) -> str:
        lines = []
        lines.append("# 家庭保险保单和理赔报告")
        lines.append(f"\n生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        filters = []
        if member_id:
            result = await self.db.execute(select(Member).where(Member.id == member_id))
            member = result.scalar_one_or_none()
            if member:
                filters.append(f"成员: {member.name}")
        if policy_type:
            filters.append(f"险种: {policy_type}")
        if filters:
            lines.append(f"\n筛选条件: {', '.join(filters)}")

        if include_policies:
            lines.append("\n## 保单信息")
            query = select(Policy).options(
                selectinload(Policy.member),
                selectinload(Policy.coverages)
            ).order_by(Policy.id)
            
            conditions = []
            if member_id:
                conditions.append(Policy.insured_member_id == member_id)
            if policy_type:
                conditions.append(Policy.policy_type == policy_type)
            if conditions:
                query = query.where(and_(*conditions))
            
            result = await self.db.execute(query)
            policies = result.scalars().all()
            
            for policy in policies:
                member_name = policy.member.name if policy.member else "全家"
                status = "✅ 有效" if policy.is_active else "❌ 已失效"
                
                lines.append(f"\n### {policy.policy_number} - {policy.insurance_company}")
                lines.append(f"- **被保险人**: {member_name}")
                lines.append(f"- **险种类型**: {policy.policy_type}")
                lines.append(f"- **保障期间**: {policy.start_date} 至 {policy.end_date}")
                lines.append(f"- **等待期**: {policy.waiting_period_days} 天")
                lines.append(f"- **免赔额**: {policy.deductible_amount} 元 ({policy.deductible_period})")
                lines.append(f"- **状态**: {status}")
                
                if policy.coverages:
                    lines.append(f"\n#### 保障责任")
                    for cov in policy.coverages:
                        ratio_text = f"{float(cov.reimbursement_ratio) * 100}%" if cov.reimbursement_ratio else "100%"
                        lines.append(f"- **{cov.coverage_type}**: 保额 {cov.coverage_limit} 元, 报销比例 {ratio_text}")

        if include_incidents:
            lines.append("\n## 出险事件")
            query = select(Incident).options(
                selectinload(Incident.member),
                selectinload(Incident.claims)
            ).order_by(Incident.incident_date.desc())
            
            if member_id:
                query = query.where(Incident.affected_member_id == member_id)
            
            result = await self.db.execute(query)
            incidents = result.scalars().all()
            
            for incident in incidents:
                member_name = incident.member.name if incident.member else "未指定"
                status_map = {"pending": "待处理", "processing": "处理中", "closed": "已结案"}
                status_text = status_map.get(incident.status, incident.status)
                
                lines.append(f"\n### {incident.incident_number} - {incident.incident_type}")
                lines.append(f"- **出险日期**: {incident.incident_date}")
                lines.append(f"- **涉及成员**: {member_name}")
                lines.append(f"- **严重程度**: {incident.severity}")
                lines.append(f"- **状态**: {status_text}")
                lines.append(f"- **描述**: {incident.description}")
                if incident.notes:
                    lines.append(f"- **备注**: {incident.notes}")

        if include_claims:
            lines.append("\n## 理赔记录")
            query = select(Claim).options(
                selectinload(Claim.policy),
                selectinload(Claim.incident)
            ).order_by(Claim.created_at.desc())
            
            result = await self.db.execute(query)
            claims = result.scalars().all()
            
            status_map = {
                "draft": "草稿",
                "submitted": "已提交",
                "processing": "审核中",
                "additional_info": "需补件",
                "paid": "已赔付",
                "rejected": "已拒赔",
            }
            
            for claim in claims:
                policy_num = claim.policy.policy_number if claim.policy else "未知"
                incident_num = claim.incident.incident_number if claim.incident else "未知"
                status_text = status_map.get(claim.status, claim.status)
                
                lines.append(f"\n### {claim.claim_number}")
                lines.append(f"- **关联保单**: {policy_num}")
                lines.append(f"- **关联事件**: {incident_num}")
                lines.append(f"- **状态**: {status_text}")
                if claim.claim_amount:
                    lines.append(f"- **申请金额**: {claim.claim_amount} 元")
                if claim.approved_amount:
                    lines.append(f"- **批准金额**: {claim.approved_amount} 元")
                if claim.rejection_reason:
                    lines.append(f"- **拒赔原因**: {claim.rejection_reason}")

        lines.append("\n---")
        lines.append("\n*报告由家庭保险保单和理赔跟进系统自动生成*")
        
        return "\n".join(lines)

    async def export_html(
        self,
        member_id: Optional[int] = None,
        policy_type: Optional[str] = None,
        include_policies: bool = True,
        include_incidents: bool = True,
        include_claims: bool = True
    ) -> str:
        markdown = await self.export_markdown(
            member_id=member_id,
            policy_type=policy_type,
            include_policies=include_policies,
            include_incidents=include_incidents,
            include_claims=include_claims
        )
        
        html_parts = []
        html_parts.append("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>家庭保险保单和理赔报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #1a365d; border-bottom: 3px solid #4299e1; padding-bottom: 10px; }
        h2 { color: #2b6cb0; margin-top: 30px; }
        h3 { color: #2c5282; margin-top: 20px; }
        h4 { color: #4a5568; }
        ul { margin-left: 20px; padding-left: 0; }
        li { margin: 8px 0; list-style: none; padding-left: 20px; position: relative; }
        li::before { content: "•"; color: #4299e1; font-weight: bold; position: absolute; left: 0; }
        .status-active { color: #38a169; font-weight: bold; }
        .status-inactive { color: #e53e3e; font-weight: bold; }
        hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
        .footer { color: #718096; font-size: 14px; text-align: center; }
        .card { background: #f7fafc; border-radius: 8px; padding: 16px; margin: 12px 0; }
    </style>
</head>
<body>
""")
        
        lines = markdown.split("\n")
        in_list = False
        
        for line in lines:
            if line.startswith("# "):
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                html_parts.append(f"<h1>{line[2:]}</h1>")
            elif line.startswith("## "):
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                html_parts.append(f"<h2>{line[3:]}</h2>")
            elif line.startswith("### "):
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                html_parts.append(f'<div class="card"><h3>{line[4:]}</h3>')
            elif line.startswith("#### "):
                html_parts.append(f"<h4>{line[5:]}</h4>")
            elif line.startswith("- **"):
                if not in_list:
                    html_parts.append("<ul>")
                    in_list = True
                content = line[3:]
                if "✅ 有效" in content:
                    content = content.replace("✅ 有效", '<span class="status-active">✅ 有效</span>')
                if "❌ 已失效" in content:
                    content = content.replace("❌ 已失效", '<span class="status-inactive">❌ 已失效</span>')
                html_parts.append(f"<li>{content}</li>")
            elif line == "---":
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                if '</div>' not in html_parts[-1]:
                    html_parts.append("</div>")
                html_parts.append("<hr>")
            elif line.startswith("*报告由") and line.endswith("*"):
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                html_parts.append(f'<div class="footer">{line[1:-1]}</div>')
            elif line.strip():
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                html_parts.append(f"<p>{line}</p>")

        if in_list:
            html_parts.append("</ul>")
        if '<div class="card">' in html_parts[-2] and '</div>' not in html_parts[-1]:
            html_parts.append("</div>")

        html_parts.append("""
</body>
</html>
""")
        
        return "".join(html_parts)
