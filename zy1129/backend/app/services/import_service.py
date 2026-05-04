import csv
import json
from io import StringIO
from typing import List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Member, Policy, Coverage, ClaimRule


class ImportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def import_policies_csv(self, csv_content: str) -> Dict[str, Any]:
        results = {"success": 0, "failed": 0, "errors": []}
        
        reader = csv.DictReader(StringIO(csv_content))
        
        for row_num, row in enumerate(reader, start=2):
            try:
                policy = await self._parse_policy_row(row)
                if policy:
                    self.db.add(policy)
                    results["success"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"行 {row_num}: {str(e)}")
        
        await self.db.commit()
        return results

    async def _parse_policy_row(self, row: Dict[str, str]) -> Policy:
        insured_member_id = None
        if row.get("insured_member_name"):
            from sqlalchemy import select
            result = await self.db.execute(
                select(Member).where(Member.name == row.get("insured_member_name"))
            )
            member = result.scalar_one_or_none()
            if member:
                insured_member_id = member.id

        def parse_date(date_str: str) -> date:
            if not date_str:
                return None
            for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"]:
                try:
                    return datetime.strptime(date_str.strip(), fmt).date()
                except ValueError:
                    continue
            raise ValueError(f"无法解析日期: {date_str}")

        def parse_decimal(value: str) -> Decimal:
            if not value:
                return Decimal("0")
            return Decimal(str(value).strip().replace(",", ""))

        policy = Policy(
            policy_number=row.get("policy_number", "").strip(),
            insurance_company=row.get("insurance_company", "").strip(),
            policy_type=row.get("policy_type", "medical").strip(),
            insured_member_id=insured_member_id,
            start_date=parse_date(row.get("start_date", "")),
            end_date=parse_date(row.get("end_date", "")),
            waiting_period_days=int(row.get("waiting_period_days", 0) or 0),
            deductible_amount=parse_decimal(row.get("deductible_amount", "0")),
            deductible_period=row.get("deductible_period", "annual").strip(),
            premium_amount=parse_decimal(row.get("premium_amount", "0")),
            payment_frequency=row.get("payment_frequency", "").strip(),
            next_renewal_date=parse_date(row.get("next_renewal_date", "")),
            policy_file_path=row.get("policy_file_path", "").strip(),
            notes=row.get("notes", "").strip(),
            is_active=row.get("is_active", "true").lower() in ["true", "1", "yes"],
        )

        if row.get("coverage_type"):
            coverage = Coverage(
                coverage_type=row.get("coverage_type", "").strip(),
                coverage_limit=parse_decimal(row.get("coverage_limit", "0")),
                deductible=parse_decimal(row.get("coverage_deductible", "0")),
                reimbursement_ratio=parse_decimal(row.get("reimbursement_ratio", "1.0")),
                waiting_period_days=int(row.get("coverage_waiting_period", 0) or 0) if row.get("coverage_waiting_period") else None,
                is_active=True,
            )
            policy.coverages.append(coverage)

        return policy

    async def import_claims_csv(self, csv_content: str) -> Dict[str, Any]:
        results = {"success": 0, "failed": 0, "errors": []}
        return results

    async def import_claim_rules_json(self, json_content: str) -> Dict[str, Any]:
        results = {"success": 0, "failed": 0, "errors": []}
        
        try:
            rules_data = json.loads(json_content)
            
            if isinstance(rules_data, dict) and "rules" in rules_data:
                rules_data = rules_data["rules"]
            
            if not isinstance(rules_data, list):
                rules_data = [rules_data]
            
            for rule_data in rules_data:
                try:
                    rule = ClaimRule(
                        rule_name=rule_data.get("rule_name", ""),
                        rule_type=rule_data.get("rule_type", ""),
                        policy_type=rule_data.get("policy_type"),
                        coverage_type=rule_data.get("coverage_type"),
                        conditions=rule_data.get("conditions"),
                        actions=rule_data.get("actions"),
                        is_active=rule_data.get("is_active", True),
                        priority=rule_data.get("priority", 0),
                    )
                    self.db.add(rule)
                    results["success"] += 1
                except Exception as e:
                    results["failed"] += 1
                    results["errors"].append(str(e))
            
            await self.db.commit()
        except json.JSONDecodeError as e:
            results["errors"].append(f"JSON解析错误: {str(e)}")
        
        return results

    async def import_members_csv(self, csv_content: str) -> Dict[str, Any]:
        results = {"success": 0, "failed": 0, "errors": []}
        
        reader = csv.DictReader(StringIO(csv_content))
        
        for row_num, row in enumerate(reader, start=2):
            try:
                def parse_date(date_str: str) -> date:
                    if not date_str:
                        return None
                    for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"]:
                        try:
                            return datetime.strptime(date_str.strip(), fmt).date()
                        except ValueError:
                            continue
                    return None

                member = Member(
                    name=row.get("name", "").strip(),
                    relationship=row.get("relationship", "").strip(),
                    birth_date=parse_date(row.get("birth_date", "")),
                    gender=row.get("gender", "").strip(),
                    notes=row.get("notes", "").strip(),
                )
                self.db.add(member)
                results["success"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"行 {row_num}: {str(e)}")
        
        await self.db.commit()
        return results
