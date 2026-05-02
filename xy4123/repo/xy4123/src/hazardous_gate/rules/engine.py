from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.config import get_settings
from hazardous_gate.models.database import Batch, CourseUsage, HazardLevel, StorageGroup, UsageItem, UsageStatus
from hazardous_gate.models.schemas import ApprovalCheckResult, CourseUsageCreate, RiskItem, RuleViolation, UsageItemCreate
from hazardous_gate.storage.crud import BatchCRUD, CourseUsageCRUD

settings = get_settings()


class UsageRuleEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_quantity(self, batch: Batch, requested: Decimal) -> Optional[RuleViolation]:
        if batch.current_quantity < requested:
            return RuleViolation(
                rule_name="超量领用",
                severity="error",
                message=f"库存不足",
                details={
                    "batch_id": batch.id,
                    "batch_number": batch.batch_number,
                    "reagent_name": batch.reagent.name if batch.reagent else "未知",
                    "current": float(batch.current_quantity),
                    "requested": float(requested),
                    "unit": batch.package_unit,
                },
            )
        return None

    async def check_expiry(self, batch: Batch) -> Optional[RuleViolation]:
        today = date.today()
        if batch.expiry_date < today:
            return RuleViolation(
                rule_name="过期试剂",
                severity="error",
                message=f"试剂已过期",
                details={
                    "batch_id": batch.id,
                    "batch_number": batch.batch_number,
                    "reagent_name": batch.reagent.name if batch.reagent else "未知",
                    "expiry_date": batch.expiry_date.isoformat(),
                    "days_expired": (today - batch.expiry_date).days,
                },
            )

        warning_days = 30
        if batch.expiry_date <= today + timedelta(days=warning_days):
            return RuleViolation(
                rule_name="即将过期",
                severity="warning",
                message=f"试剂即将在{warning_days}天内过期",
                details={
                    "batch_id": batch.id,
                    "batch_number": batch.batch_number,
                    "reagent_name": batch.reagent.name if batch.reagent else "未知",
                    "expiry_date": batch.expiry_date.isoformat(),
                    "days_remaining": (batch.expiry_date - today).days,
                },
            )
        return None

    async def check_authorization(
        self,
        batch: Batch,
        user_authorization_level: int = 1,
    ) -> Optional[RuleViolation]:
        reagent = batch.reagent
        if not reagent:
            return RuleViolation(
                rule_name="试剂信息缺失",
                severity="error",
                message="无法获取试剂授权信息",
                details={"batch_id": batch.id},
            )

        min_level = reagent.min_authorization_level
        if user_authorization_level < min_level:
            level_names = {1: "基础", 2: "中级", 3: "高级", 4: "特殊", 5: "剧毒"}
            return RuleViolation(
                rule_name="授权不足",
                severity="error",
                message=f"需要{level_names.get(min_level, str(min_level))}级授权",
                details={
                    "batch_id": batch.id,
                    "batch_number": batch.batch_number,
                    "reagent_name": reagent.name,
                    "hazard_level": reagent.hazard_level.value if isinstance(reagent.hazard_level, HazardLevel) else reagent.hazard_level,
                    "required_level": min_level,
                    "user_level": user_authorization_level,
                },
            )
        return None

    async def check_incompatible_groups(
        self,
        batches: list[Batch],
    ) -> list[RuleViolation]:
        violations = []
        groups: dict[str, list[dict]] = {}

        for batch in batches:
            reagent = batch.reagent
            if not reagent:
                continue
            group = reagent.storage_group
            if isinstance(group, StorageGroup):
                group_str = group.value
            else:
                group_str = str(group)

            if group_str not in groups:
                groups[group_str] = []
            groups[group_str].append({
                "batch_id": batch.id,
                "batch_number": batch.batch_number,
                "reagent_name": reagent.name,
                "group": group_str,
            })

        incompatible = settings.INCOMPATIBLE_GROUPS
        group_list = list(groups.keys())

        for i, group1 in enumerate(group_list):
            for group2 in group_list[i + 1:]:
                if group1 in incompatible:
                    if group2 in incompatible[group1]:
                        violations.append(RuleViolation(
                            rule_name="互斥试剂同车",
                            severity="error",
                            message=f"{group1}与{group2}不能同车发放",
                            details={
                                "group1": group1,
                                "group2": group2,
                                "items_group1": groups[group1],
                                "items_group2": groups[group2],
                            },
                        ))
                if group2 in incompatible:
                    if group1 in incompatible[group2]:
                        violations.append(RuleViolation(
                            rule_name="互斥试剂同车",
                            severity="error",
                            message=f"{group2}与{group1}不能同车发放",
                            details={
                                "group1": group2,
                                "group2": group1,
                                "items_group1": groups[group2],
                                "items_group2": groups[group1],
                            },
                        ))

        return violations

    async def check_waste_destination(
        self,
        usage_create: CourseUsageCreate,
        batches: list[Batch],
    ) -> Optional[RuleViolation]:
        has_hazardous = False
        for batch in batches:
            reagent = batch.reagent
            if reagent:
                level = reagent.hazard_level
                if isinstance(level, HazardLevel):
                    level_str = level.value
                else:
                    level_str = str(level)
                if level_str in ["高危", "剧毒"]:
                    has_hazardous = True
                    break
                group = reagent.storage_group
                if isinstance(group, StorageGroup):
                    group_str = group.value
                else:
                    group_str = str(group)
                if group_str in ["酸类", "碱类", "氰化物", "氧化剂"]:
                    has_hazardous = True
                    break

        if has_hazardous and not usage_create.waste_destination:
            return RuleViolation(
                rule_name="缺少废液去向",
                severity="error",
                message="高危/剧毒/特殊试剂需要指定废液去向",
                details={
                    "valid_destinations": list(settings.VALID_WASTE_DESTINATIONS),
                },
            )

        if usage_create.waste_destination:
            if usage_create.waste_destination not in settings.VALID_WASTE_DESTINATIONS:
                return RuleViolation(
                    rule_name="无效废液去向",
                    severity="error",
                    message=f"废液去向'{usage_create.waste_destination}'不在有效选项中",
                    details={
                        "provided": usage_create.waste_destination,
                        "valid_options": list(settings.VALID_WASTE_DESTINATIONS),
                    },
                )

        return None

    async def check_pending_returns(
        self,
        teacher_id: str,
    ) -> list[RuleViolation]:
        violations = []

        pending_usages = await CourseUsageCRUD.get_all(
            self.db,
            teacher_id=teacher_id,
        )

        in_use_usages = [u for u in pending_usages if u.status == UsageStatus.IN_USE]

        if in_use_usages:
            count = len(in_use_usages)
            warnings.append(RuleViolation(
                rule_name="存在未归还领用",
                severity="warning",
                message=f"该教师有{count}个未归还的领用单",
                details={
                    "pending_count": count,
                    "pending_usage_numbers": [u.usage_number for u in in_use_usages],
                },
            ))

        return violations

    async def validate_usage(
        self,
        usage_create: CourseUsageCreate,
        user_authorization_level: int = 1,
        teacher_id: Optional[str] = None,
    ) -> ApprovalCheckResult:
        violations = []
        warnings = []
        batches = []

        for item in usage_create.items:
            batch = await BatchCRUD.get_by_id(self.db, item.batch_id, load_reagent=True)
            if not batch:
                violations.append(RuleViolation(
                    rule_name="批次不存在",
                    severity="error",
                    message=f"批次ID {item.batch_id} 不存在",
                    details={"batch_id": item.batch_id},
                ))
                continue

            if not batch.is_active:
                violations.append(RuleViolation(
                    rule_name="批次已停用",
                    severity="error",
                    message=f"批次 {batch.batch_number} 已停用",
                    details={
                        "batch_id": batch.id,
                        "batch_number": batch.batch_number,
                    },
                ))
                continue

            batches.append(batch)

            quantity_violation = await self.check_quantity(batch, item.requested_quantity)
            if quantity_violation:
                violations.append(quantity_violation)

            expiry_violation = await self.check_expiry(batch)
            if expiry_violation:
                if expiry_violation.severity == "error":
                    violations.append(expiry_violation)
                else:
                    warnings.append(expiry_violation)

            auth_violation = await self.check_authorization(batch, user_authorization_level)
            if auth_violation:
                violations.append(auth_violation)

        if batches:
            incompatible_violations = await self.check_incompatible_groups(batches)
            violations.extend(incompatible_violations)

            waste_violation = await self.check_waste_destination(usage_create, batches)
            if waste_violation:
                violations.append(waste_violation)

        if teacher_id:
            pending_warnings = await self.check_pending_returns(teacher_id)
            warnings.extend(pending_warnings)

        return ApprovalCheckResult(
            approved=len(violations) == 0,
            violations=violations,
            warnings=warnings,
        )

    async def validate_usage_for_approval(
        self,
        usage_id: int,
        approver_level: int = 3,
    ) -> ApprovalCheckResult:
        usage = await CourseUsageCRUD.get_by_id(self.db, usage_id, load_items=True)
        if not usage:
            return ApprovalCheckResult(
                approved=False,
                violations=[
                    RuleViolation(
                        rule_name="领用单不存在",
                        severity="error",
                        message=f"领用单ID {usage_id} 不存在",
                        details={},
                    )
                ],
            )

        if usage.status not in [UsageStatus.PENDING, UsageStatus.APPROVED]:
            return ApprovalCheckResult(
                approved=False,
                violations=[
                    RuleViolation(
                        rule_name="状态错误",
                        severity="error",
                        message=f"领用单状态为{usage.status.value}，无法审批",
                        details={"current_status": usage.status.value},
                    )
                ],
            )

        violations = []
        warnings = []
        batches = []

        for item in usage.items:
            batch = item.batch
            if not batch:
                violations.append(RuleViolation(
                    rule_name="批次信息缺失",
                    severity="error",
                    message=f"领用明细 {item.id} 关联的批次不存在",
                    details={"usage_item_id": item.id},
                ))
                continue

            batches.append(batch)

            if item.approved_quantity:
                check_quantity = item.approved_quantity
            else:
                check_quantity = item.requested_quantity

            quantity_violation = await self.check_quantity(batch, check_quantity)
            if quantity_violation:
                violations.append(quantity_violation)

            expiry_violation = await self.check_expiry(batch)
            if expiry_violation:
                if expiry_violation.severity == "error":
                    violations.append(expiry_violation)
                else:
                    warnings.append(expiry_violation)

        if batches:
            incompatible_violations = await self.check_incompatible_groups(batches)
            violations.extend(incompatible_violations)

        return ApprovalCheckResult(
            approved=len(violations) == 0,
            violations=violations,
            warnings=warnings,
        )


class RiskAssessmentEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def assess_batch_risk(self, batch: Batch) -> list[RiskItem]:
        risks = []
        today = date.today()
        reagent = batch.reagent

        if not reagent:
            return risks

        reagent_name = reagent.name
        cas_number = reagent.cas_number

        if batch.expiry_date < today:
            risks.append(RiskItem(
                reagent_name=reagent_name,
                cas_number=cas_number,
                batch_number=batch.batch_number,
                risk_type="过期试剂",
                risk_level="高",
                description=f"试剂已过期{(today - batch.expiry_date).days}天",
                current_quantity=batch.current_quantity,
                unit=batch.package_unit,
                expiry_date=batch.expiry_date,
            ))
        elif batch.expiry_date <= today + timedelta(days=30):
            risks.append(RiskItem(
                reagent_name=reagent_name,
                cas_number=cas_number,
                batch_number=batch.batch_number,
                risk_type="即将过期",
                risk_level="中",
                description=f"试剂将在{(batch.expiry_date - today).days}天内过期",
                current_quantity=batch.current_quantity,
                unit=batch.package_unit,
                expiry_date=batch.expiry_date,
            ))

        level = reagent.hazard_level
        if isinstance(level, HazardLevel):
            level_str = level.value
        else:
            level_str = str(level)

        if level_str in ["高危", "剧毒"] and batch.current_quantity > 0:
            risks.append(RiskItem(
                reagent_name=reagent_name,
                cas_number=cas_number,
                batch_number=batch.batch_number,
                risk_type="高风险存量",
                risk_level="高",
                description=f"{level_str}试剂库存需要特别关注",
                current_quantity=batch.current_quantity,
                unit=batch.package_unit,
            ))

        if batch.current_quantity <= 0:
            risks.append(RiskItem(
                reagent_name=reagent_name,
                cas_number=cas_number,
                batch_number=batch.batch_number,
                risk_type="零库存",
                risk_level="低",
                description="该批次库存为零",
                current_quantity=batch.current_quantity,
                unit=batch.package_unit,
            ))

        return risks

    async def get_all_risks(self) -> list[RiskItem]:
        all_risks = []
        batches = await BatchCRUD.get_all(self.db, only_active=True, limit=1000)

        for batch in batches:
            risks = await self.assess_batch_risk(batch)
            all_risks.extend(risks)

        return all_risks
