from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import Equipment, Rental, RentalItem, Booth
from app.schemas import RuleResult
from datetime import datetime


class RentalRuleEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules = [
            self.check_duplicate_scan,
            self.check_equipment_availability,
            self.check_cross_booth_borrow,
            self.check_equipment_status
        ]

    def check_duplicate_scan(self, equipment_ids: List[int], **kwargs) -> RuleResult:
        existing_ids = set()
        duplicates = []
        for eq_id in equipment_ids:
            if eq_id in existing_ids:
                duplicates.append(eq_id)
            existing_ids.add(eq_id)
        
        if duplicates:
            return RuleResult(
                passed=False,
                rule_name="duplicate_scan",
                message=f"检测到重复扫码: 设备ID {duplicates} 被多次扫描",
                details={"duplicate_ids": duplicates}
            )
        return RuleResult(
            passed=True,
            rule_name="duplicate_scan",
            message="无重复扫码"
        )

    def check_equipment_availability(self, equipment_ids: List[int], **kwargs) -> RuleResult:
        unavailable = []
        for eq_id in equipment_ids:
            eq = self.db.query(Equipment).filter(Equipment.id == eq_id).first()
            if eq and eq.status != "available":
                unavailable.append({"id": eq_id, "barcode": eq.barcode, "name": eq.name, "status": eq.status})
        
        if unavailable:
            return RuleResult(
                passed=False,
                rule_name="equipment_availability",
                message=f"设备不可用: {[eq['name'] for eq in unavailable]}",
                details={"unavailable_equipment": unavailable}
            )
        return RuleResult(
            passed=True,
            rule_name="equipment_availability",
            message="所有设备可用"
        )

    def check_cross_booth_borrow(self, equipment_ids: List[int], booth_id: int, **kwargs) -> RuleResult:
        cross_booth_items = []
        booth = self.db.query(Booth).filter(Booth.id == booth_id).first()
        booth_number = booth.booth_number if booth else "Unknown"

        for eq_id in equipment_ids:
            active_rental = self.db.query(RentalItem).join(Rental).filter(
                RentalItem.equipment_id == eq_id,
                Rental.status == "active",
                RentalItem.status == "borrowed"
            ).first()
            
            if active_rental:
                rented_booth = active_rental.rental.booth
                if rented_booth and rented_booth.id != booth_id:
                    cross_booth_items.append({
                        "equipment_id": eq_id,
                        "current_booth": rented_booth.booth_number,
                        "target_booth": booth_number,
                        "rental_id": active_rental.rental_id
                    })

        if cross_booth_items:
            return RuleResult(
                passed=False,
                rule_name="cross_booth_borrow",
                message=f"跨展位借用检测: 设备正在其他展位使用",
                details={"cross_booth_items": cross_booth_items}
            )
        return RuleResult(
            passed=True,
            rule_name="cross_booth_borrow",
            message="无跨展位借用冲突"
        )

    def check_equipment_status(self, equipment_ids: List[int], **kwargs) -> RuleResult:
        damaged = []
        for eq_id in equipment_ids:
            eq = self.db.query(Equipment).filter(Equipment.id == eq_id).first()
            if eq and eq.status == "damaged":
                damaged.append({"id": eq_id, "barcode": eq.barcode, "name": eq.name})
        
        if damaged:
            return RuleResult(
                passed=False,
                rule_name="equipment_damaged",
                message=f"设备已损坏: {[eq['name'] for eq in damaged]}",
                details={"damaged_equipment": damaged}
            )
        return RuleResult(
            passed=True,
            rule_name="equipment_damaged",
            message="无损坏设备"
        )

    def validate_rental(self, equipment_ids: List[int], booth_id: int) -> Dict[str, Any]:
        results = []
        all_passed = True
        
        for rule in self.rules:
            result = rule(equipment_ids=equipment_ids, booth_id=booth_id)
            results.append(result)
            if not result.passed:
                all_passed = False
        
        return {
            "passed": all_passed,
            "results": results,
            "failed_rules": [r for r in results if not r.passed]
        }


class ReturnRuleEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules = [
            self.check_equipment_borrowed,
            self.check_rental_active,
            self.validate_quantity
        ]

    def check_equipment_borrowed(self, rental_id: int, equipment_ids: List[int], **kwargs) -> RuleResult:
        not_borrowed = []
        for eq_id in equipment_ids:
            rental_item = self.db.query(RentalItem).filter(
                RentalItem.rental_id == rental_id,
                RentalItem.equipment_id == eq_id,
                RentalItem.status == "borrowed"
            ).first()
            
            if not rental_item:
                eq = self.db.query(Equipment).filter(Equipment.id == eq_id).first()
                not_borrowed.append({
                    "id": eq_id,
                    "barcode": eq.barcode if eq else "Unknown",
                    "name": eq.name if eq else "Unknown"
                })
        
        if not_borrowed:
            return RuleResult(
                passed=False,
                rule_name="equipment_borrowed",
                message=f"设备未在此借用单中借出: {[eq['name'] for eq in not_borrowed]}",
                details={"not_borrowed": not_borrowed}
            )
        return RuleResult(
            passed=True,
            rule_name="equipment_borrowed",
            message="所有设备都在此借用单中"
        )

    def check_rental_active(self, rental_id: int, **kwargs) -> RuleResult:
        rental = self.db.query(Rental).filter(Rental.id == rental_id).first()
        if not rental:
            return RuleResult(
                passed=False,
                rule_name="rental_exists",
                message="借用单不存在",
                details={"rental_id": rental_id}
            )
        
        if rental.status != "active":
            return RuleResult(
                passed=False,
                rule_name="rental_active",
                message=f"借用单状态为 {rental.status}，无法归还",
                details={"rental_id": rental_id, "status": rental.status}
            )
        
        return RuleResult(
            passed=True,
            rule_name="rental_active",
            message="借用单有效"
        )

    def validate_quantity(self, rental_id: int, items: List[Dict], **kwargs) -> RuleResult:
        invalid_quantity = []
        for item in items:
            eq_id = item.get("equipment_id")
            qty = item.get("quantity", 0)
            
            rental_item = self.db.query(RentalItem).filter(
                RentalItem.rental_id == rental_id,
                RentalItem.equipment_id == eq_id
            ).first()
            
            if rental_item and qty > rental_item.quantity:
                invalid_quantity.append({
                    "equipment_id": eq_id,
                    "borrowed": rental_item.quantity,
                    "returning": qty
                })
        
        if invalid_quantity:
            return RuleResult(
                passed=False,
                rule_name="quantity_validation",
                message="归还数量大于借出数量",
                details={"invalid_items": invalid_quantity}
            )
        return RuleResult(
            passed=True,
            rule_name="quantity_validation",
            message="数量验证通过"
        )

    def validate_return(self, rental_id: int, items: List[Dict]) -> Dict[str, Any]:
        results = []
        all_passed = True
        
        equipment_ids = [item.get("equipment_id") for item in items]
        
        for rule in self.rules:
            result = rule(rental_id=rental_id, equipment_ids=equipment_ids, items=items)
            results.append(result)
            if not result.passed:
                all_passed = False
        
        return {
            "passed": all_passed,
            "results": results,
            "failed_rules": [r for r in results if not r.passed]
        }


class DamageFeeCalculator:
    DAMAGE_RATES = {
        "minor": 0.1,
        "moderate": 0.3,
        "severe": 0.7,
        "total": 1.0
    }

    @classmethod
    def calculate_fee(cls, deposit: float, damage_level: str) -> float:
        rate = cls.DAMAGE_RATES.get(damage_level.lower(), 0)
        return deposit * rate

    @classmethod
    def validate_damage_level(cls, damage_level: str) -> bool:
        return damage_level.lower() in cls.DAMAGE_RATES
