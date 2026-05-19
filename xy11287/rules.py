from datetime import datetime, date
from typing import List, Tuple, Dict
from sqlalchemy.orm import Session
from models import (
    Drug, InventoryBatch, Contraindication, Prescription,
    PrescriptionItem, ValidationResult, ExceptionTypeEnum
)
from schemas import ValidationSummary, ValidationResultCreate


class ValidationEngine:
    def __init__(self, db: Session):
        self.db = db
        self.validation_results: List[ValidationResultCreate] = []

    def validate_prescription(self, prescription: Prescription, items: List[PrescriptionItem]) -> ValidationSummary:
        self.validation_results = []

        for item in items:
            self._validate_item(prescription, item)

        self._validate_contraindications(items)

        total_items = len(items)
        blocked_count = sum(1 for v in self.validation_results if v.is_blocking)
        warning_count = sum(1 for v in self.validation_results if not v.is_blocking)
        passed_count = total_items - (1 if blocked_count > 0 else 0)

        blocking_exceptions = [v.message for v in self.validation_results if v.is_blocking]
        warning_exceptions = [v.message for v in self.validation_results if not v.is_blocking]

        return ValidationSummary(
            total_items=total_items,
            passed_count=passed_count,
            warning_count=warning_count,
            blocked_count=blocked_count,
            blocking_exceptions=blocking_exceptions,
            warning_exceptions=warning_exceptions
        )

    def _validate_item(self, prescription: Prescription, item: PrescriptionItem):
        drug = self.db.query(Drug).filter(Drug.id == item.drug_id).first()
        if not drug:
            return

        weight = prescription.weight if prescription.weight_unit == "kg" else prescription.weight / 2.20462

        calculated_min_dose = drug.min_dose_per_kg * weight
        calculated_max_dose = drug.max_dose_per_kg * weight

        item.calculated_min_dose = calculated_min_dose
        item.calculated_max_dose = calculated_max_dose

        self._validate_dose_range(item, drug, calculated_min_dose, calculated_max_dose)
        self._validate_batch_expiration(item)
        self._validate_stock(item)

    def _validate_dose_range(self, item: PrescriptionItem, drug: Drug, min_dose: float, max_dose: float):
        if item.prescribed_dose < min_dose:
            self.validation_results.append(ValidationResultCreate(
                prescription_item_id=item.id,
                exception_type=ExceptionTypeEnum.DOSE_TOO_LOW,
                severity="warning",
                message=f"{item.drug_name} 剂量过低: 处方剂量 {item.prescribed_dose} {item.dose_unit}，"
                        f"最小推荐剂量 {min_dose:.2f} {drug.dose_unit}",
                is_blocking=False
            ))

        if item.prescribed_dose > max_dose:
            self.validation_results.append(ValidationResultCreate(
                prescription_item_id=item.id,
                exception_type=ExceptionTypeEnum.DOSE_TOO_HIGH,
                severity="critical",
                message=f"{item.drug_name} 剂量过高: 处方剂量 {item.prescribed_dose} {item.dose_unit}，"
                        f"最大推荐剂量 {max_dose:.2f} {drug.dose_unit}",
                is_blocking=True
            ))

    def _validate_batch_expiration(self, item: PrescriptionItem):
        if item.batch_id:
            batch = self.db.query(InventoryBatch).filter(InventoryBatch.id == item.batch_id).first()
            if batch:
                today = date.today()
                if batch.expiration_date.date() < today:
                    self.validation_results.append(ValidationResultCreate(
                        prescription_item_id=item.id,
                        exception_type=ExceptionTypeEnum.BATCH_EXPIRED,
                        severity="critical",
                        message=f"{item.drug_name} 批号 {batch.batch_number} 已过期，过期日期: {batch.expiration_date.date()}",
                        is_blocking=True
                    ))

    def _validate_stock(self, item: PrescriptionItem):
        if item.batch_id:
            batch = self.db.query(InventoryBatch).filter(InventoryBatch.id == item.batch_id).first()
            if batch and batch.quantity < item.quantity:
                self.validation_results.append(ValidationResultCreate(
                    prescription_item_id=item.id,
                    exception_type=ExceptionTypeEnum.INSUFFICIENT_STOCK,
                    severity="critical",
                    message=f"{item.drug_name} 库存不足: 库存 {batch.quantity} {batch.unit}，"
                            f"需要 {item.quantity} {item.quantity_unit}",
                    is_blocking=True
                ))

    def _validate_contraindications(self, items: List[PrescriptionItem]):
        drug_ids = [item.drug_id for item in items]
        for i, item_a in enumerate(items):
            for item_b in items[i + 1:]:
                contraindication = self.db.query(Contraindication).filter(
                    ((Contraindication.drug_a_id == item_a.drug_id) & (Contraindication.drug_b_id == item_b.drug_id)) |
                    ((Contraindication.drug_a_id == item_b.drug_id) & (Contraindication.drug_b_id == item_a.drug_id))
                ).first()

                if contraindication:
                    is_blocking = contraindication.severity in ["critical", "high"]
                    self.validation_results.append(ValidationResultCreate(
                        prescription_item_id=item_a.id,
                        exception_type=ExceptionTypeEnum.DRUG_CONTRAINDICATION,
                        severity=contraindication.severity,
                        message=f"禁忌组合: {item_a.drug_name} 与 {item_b.drug_name} 不能同时使用。"
                                f"原因: {contraindication.description or '严重药物相互作用'}",
                        is_blocking=is_blocking
                    ))

    def get_validation_results(self) -> List[ValidationResultCreate]:
        return self.validation_results


class DoseCalculator:
    @staticmethod
    def calculate_dose_range(drug: Drug, weight: float, weight_unit: str = "kg") -> Tuple[float, float]:
        if weight_unit != "kg":
            weight = weight / 2.20462
        min_dose = drug.min_dose_per_kg * weight
        max_dose = drug.max_dose_per_kg * weight
        return min_dose, max_dose

    @staticmethod
    def check_dose_safety(drug: Drug, prescribed_dose: float, weight: float, weight_unit: str = "kg") -> Dict:
        min_dose, max_dose = DoseCalculator.calculate_dose_range(drug, weight, weight_unit)
        return {
            "min_dose": min_dose,
            "max_dose": max_dose,
            "prescribed_dose": prescribed_dose,
            "is_within_range": min_dose <= prescribed_dose <= max_dose,
            "is_too_low": prescribed_dose < min_dose,
            "is_too_high": prescribed_dose > max_dose,
            "variation_percent": round(((prescribed_dose - ((min_dose + max_dose) / 2)) / ((min_dose + max_dose) / 2)) * 100, 2)
        }
