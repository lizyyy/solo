from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from models import (
    Customer, TreatmentPackage, PackageItem, VerificationRecord,
    ExtensionRequest, ValidationResult, VerificationStatus,
    PackageStatus, ExtensionStatus
)


class RulesEngine:
    def __init__(self):
        self.customers: Dict[str, Customer] = {}
        self.packages: Dict[str, TreatmentPackage] = {}
        self.verifications: List[VerificationRecord] = []
        self.extensions: Dict[str, ExtensionRequest] = {}

    def load_data(self, customers: List[Customer], packages: List[TreatmentPackage],
                  verifications: List[VerificationRecord], extensions: List[ExtensionRequest]):
        for c in customers:
            self.customers[c.customer_id] = c
        for p in packages:
            self.packages[p.package_id] = p
        self.verifications = verifications
        for e in extensions:
            self.extensions[e.request_id] = e

    def validate_package_transfer(self, package_id: str, target_store_id: str) -> ValidationResult:
        package = self.packages.get(package_id)
        if not package:
            return ValidationResult(
                VerificationStatus.INVALID,
                f"套餐 {package_id} 不存在",
                {"package_id": package_id}
            )

        if package.status != PackageStatus.ACTIVE:
            return ValidationResult(
                VerificationStatus.INVALID,
                f"套餐状态异常: {package.status.value}",
                {"package_id": package_id, "status": package.status.value}
            )

        if package.current_store_id == target_store_id:
            return ValidationResult(
                VerificationStatus.WARNING,
                f"套餐已在目标门店 {target_store_id}",
                {"package_id": package_id, "current_store": package.current_store_id}
            )

        if package.transferred and len(package.transfer_history) >= 3:
            return ValidationResult(
                VerificationStatus.CONFLICT,
                f"套餐转店次数超限（最多3次），已转店 {len(package.transfer_history)} 次",
                {"package_id": package_id, "transfer_count": len(package.transfer_history)}
            )

        return ValidationResult(
            VerificationStatus.VALID,
            f"套餐可转店至 {target_store_id}",
            {
                "package_id": package_id,
                "original_store": package.original_store_id,
                "current_store": package.current_store_id,
                "target_store": target_store_id,
                "transfer_history": package.transfer_history
            }
        )

    def validate_gift_deduction(self, package_id: str, item_id: str, gift_count: int) -> ValidationResult:
        package = self.packages.get(package_id)
        if not package:
            return ValidationResult(
                VerificationStatus.INVALID,
                f"套餐 {package_id} 不存在",
                {"package_id": package_id}
            )

        item = next((i for i in package.items if i.item_id == item_id), None)
        if not item:
            return ValidationResult(
                VerificationStatus.INVALID,
                f"套餐中不存在项目 {item_id}",
                {"package_id": package_id, "item_id": item_id}
            )

        remaining = item.remaining_count
        if remaining < gift_count:
            return ValidationResult(
                VerificationStatus.CONFLICT,
                f"赠送次数不足，剩余 {remaining} 次，请求赠送 {gift_count} 次",
                {
                    "package_id": package_id,
                    "item_id": item_id,
                    "remaining": remaining,
                    "requested": gift_count
                }
            )

        if gift_count > item.total_count * 0.3:
            return ValidationResult(
                VerificationStatus.WARNING,
                f"赠送比例过高，建议审核（赠送 {gift_count} 次，占购买量 {gift_count/item.total_count:.1%}）",
                {
                    "package_id": package_id,
                    "item_id": item_id,
                    "gift_count": gift_count,
                    "total_count": item.total_count,
                    "ratio": gift_count / item.total_count
                }
            )

        return ValidationResult(
            VerificationStatus.VALID,
            f"可赠送 {gift_count} 次",
            {
                "package_id": package_id,
                "item_id": item_id,
                "gift_count": gift_count,
                "remaining_before": remaining,
                "remaining_after": remaining - gift_count
            }
        )

    def validate_extension(self, package_id: str, new_expiry: datetime, reason: str) -> ValidationResult:
        package = self.packages.get(package_id)
        if not package:
            return ValidationResult(
                VerificationStatus.INVALID,
                f"套餐 {package_id} 不存在",
                {"package_id": package_id}
            )

        if new_expiry <= package.expiry_date:
            return ValidationResult(
                VerificationStatus.CONFLICT,
                f"延期日期必须晚于当前到期日 {package.expiry_date.strftime('%Y-%m-%d')}",
                {
                    "package_id": package_id,
                    "current_expiry": package.expiry_date,
                    "requested_expiry": new_expiry
                }
            )

        days_extended = (new_expiry - package.expiry_date).days
        if days_extended > 180:
            return ValidationResult(
                VerificationStatus.WARNING,
                f"延期超过180天（{days_extended}天），需高级审批",
                {
                    "package_id": package_id,
                    "current_expiry": package.expiry_date,
                    "requested_expiry": new_expiry,
                    "days_extended": days_extended
                }
            )

        pending_extensions = [
            e for e in self.extensions.values()
            if e.package_id == package_id and e.status == ExtensionStatus.PENDING
        ]
        if pending_extensions:
            return ValidationResult(
                VerificationStatus.CONFLICT,
                f"套餐已有待审批的延期申请（申请ID: {pending_extensions[0].request_id}）",
                {
                    "package_id": package_id,
                    "pending_request_id": pending_extensions[0].request_id
                }
            )

        return ValidationResult(
            VerificationStatus.VALID,
            f"延期申请有效，延长 {days_extended} 天",
            {
                "package_id": package_id,
                "current_expiry": package.expiry_date,
                "requested_expiry": new_expiry,
                "days_extended": days_extended,
                "reason": reason
            }
        )

    def check_expiry_status(self, package_id: str, check_date: datetime = None) -> ValidationResult:
        check_date = check_date or datetime.now()
        package = self.packages.get(package_id)

        if not package:
            return ValidationResult(
                VerificationStatus.INVALID,
                f"套餐 {package_id} 不存在",
                {"package_id": package_id}
            )

        effective_expiry = package.expiry_date
        approved_extensions = [
            e for e in self.extensions.values()
            if e.package_id == package_id and e.status == ExtensionStatus.APPROVED
        ]
        if approved_extensions:
            latest_extension = max(approved_extensions, key=lambda x: x.new_expiry)
            effective_expiry = latest_extension.new_expiry

        days_until_expiry = (effective_expiry - check_date).days

        if days_until_expiry < 0:
            return ValidationResult(
                VerificationStatus.INVALID,
                f"套餐已过期 {abs(days_until_expiry)} 天",
                {
                    "package_id": package_id,
                    "effective_expiry": effective_expiry,
                    "check_date": check_date,
                    "days_past_expiry": abs(days_until_expiry)
                }
            )
        elif days_until_expiry <= 7:
            return ValidationResult(
                VerificationStatus.WARNING,
                f"套餐即将过期，剩余 {days_until_expiry} 天",
                {
                    "package_id": package_id,
                    "effective_expiry": effective_expiry,
                    "days_until_expiry": days_until_expiry
                }
            )
        else:
            return ValidationResult(
                VerificationStatus.VALID,
                f"套餐有效，剩余 {days_until_expiry} 天过期",
                {
                    "package_id": package_id,
                    "effective_expiry": effective_expiry,
                    "days_until_expiry": days_until_expiry
                }
            )

    def reconcile_verifications(self, package_id: str) -> Dict:
        package = self.packages.get(package_id)
        if not package:
            return {"error": f"套餐 {package_id} 不存在"}

        package_verifications = [v for v in self.verifications if v.package_id == package_id]
        item_verification_counts = defaultdict(lambda: {"normal": 0, "gift": 0, "total": 0})

        for v in package_verifications:
            item_verification_counts[v.item_id]["total"] += 1
            if v.is_gift:
                item_verification_counts[v.item_id]["gift"] += 1
            else:
                item_verification_counts[v.item_id]["normal"] += 1

        discrepancies = []
        for item in package.items:
            counts = item_verification_counts[item.item_id]
            expected_used = counts["total"]

            if item.used_count != expected_used:
                discrepancies.append({
                    "item_id": item.item_id,
                    "item_name": item.name,
                    "recorded_used": item.used_count,
                    "actual_verifications": expected_used,
                    "gift_verifications": counts["gift"],
                    "normal_verifications": counts["normal"],
                    "difference": item.used_count - expected_used
                })

        return {
            "package_id": package_id,
            "total_verifications": len(package_verifications),
            "discrepancies": discrepancies,
            "item_breakdown": dict(item_verification_counts)
        }

    def full_package_audit(self, package_id: str) -> Dict:
        package = self.packages.get(package_id)
        if not package:
            return {"error": f"套餐 {package_id} 不存在", "status": "invalid"}

        customer = self.customers.get(package.customer_id)
        expiry_check = self.check_expiry_status(package_id)
        reconciliation = self.reconcile_verifications(package_id)

        items_status = []
        for item in package.items:
            items_status.append({
                "item_id": item.item_id,
                "name": item.name,
                "total_count": item.total_count,
                "used_count": item.used_count,
                "gifted_count": item.gifted_count,
                "remaining_count": item.remaining_count
            })

        return {
            "package_id": package_id,
            "customer": {
                "customer_id": customer.customer_id if customer else None,
                "name": customer.name if customer else "未知",
                "phone": customer.phone if customer else "未知"
            },
            "package_name": package.name,
            "original_store": package.original_store_id,
            "current_store": package.current_store_id,
            "status": package.status.value,
            "expiry_status": expiry_check.status.value,
            "expiry_message": expiry_check.message,
            "expiry_details": expiry_check.details,
            "transferred": package.transferred,
            "transfer_history": package.transfer_history,
            "items": items_status,
            "reconciliation": reconciliation,
            "audit_timestamp": datetime.now().isoformat()
        }
