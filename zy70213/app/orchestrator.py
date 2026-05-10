from datetime import date, datetime
from typing import Optional, List, Tuple
from uuid import UUID

from .models import (
    Animal,
    FeedFormula,
    DailyRation,
    RationItem,
    VerificationResult
)
from .enums import Season, DailyRationStatus
from .store import store
from .services import RationCalculator, ValidationService
from .errors import (
    AnimalProfileError,
    FeedFormulaError,
    InventoryError,
    DataConsistencyError,
    StatusTransitionError,
    ValidationError
)


class RationOrchestrator:
    def __init__(self):
        self.validation_service = ValidationService()
        self.calculator = RationCalculator()

    def generate_ration(
        self,
        animal_id: UUID,
        ration_date: date,
        created_by: Optional[str] = None
    ) -> DailyRation:
        animal = store.get_animal(animal_id)
        if animal is None:
            raise AnimalProfileError(
                f"动物档案不存在: {animal_id}",
                animal_id=str(animal_id)
            )

        existing = store.get_ration_by_animal_and_date(animal_id, ration_date)
        if existing and existing.status not in [DailyRationStatus.FAILED, DailyRationStatus.DRAFT, DailyRationStatus.CANCELLED]:
            return existing

        season = Season.from_month(ration_date.month)

        animal_verify = self.validation_service.verify_animal_profile(animal)
        if not animal_verify.success:
            raise AnimalProfileError(
                "动物档案验证失败，请检查动物状态和数据",
                animal_id=str(animal_id),
                details={"verification": animal_verify.dict()}
            )

        formula = store.get_formula_for_species_and_season(animal.species, season)
        formula_verify = self.validation_service.verify_feed_formula(formula, animal.species, season)
        if not formula_verify.success:
            raise FeedFormulaError(
                f"饲料配方验证失败: {formula_verify.errors[0] if formula_verify.errors else '未知错误'}",
                species=animal.species,
                season=season.value,
                details={"verification": formula_verify.dict()}
            )

        base_items = self.calculator.calculate_base_ration(animal, formula)

        correction_rules = store.get_correction_rules_for_animal(animal)
        corrected_items, corrections_applied = self.calculator.apply_health_corrections(
            base_items, animal, correction_rules
        )

        ration_items = [
            RationItem(
                feed_name=item["feed_name"],
                planned_quantity_kg=item["quantity_kg"],
                unit=item["unit"],
                source_formula=formula.name
            )
            for item in corrected_items
        ]

        inventory_verify = self.validation_service.verify_inventory(ration_items)

        original_hash = self.calculator.calculate_original_hash(animal, formula, ration_date)

        all_messages = animal_verify.messages + formula_verify.messages
        all_warnings = animal_verify.warnings + formula_verify.warnings + inventory_verify.warnings
        all_errors = inventory_verify.errors

        ration = DailyRation(
            ration_date=ration_date,
            animal_id=animal_id,
            animal_name=animal.name,
            animal_species=animal.species,
            season=season,
            status=DailyRationStatus.DRAFT,
            items=ration_items,
            original_data_hash=original_hash,
            formula_id=formula.id,
            formula_name=formula.name,
            corrections_applied=corrections_applied,
            verification_messages=all_messages,
            warnings=all_warnings,
            errors=all_errors
        )

        if created_by:
            ration.created_by = created_by

        store.save_ration(ration)
        return ration

    def validate_ration(self, ration_id: UUID) -> Tuple[DailyRation, List[VerificationResult]]:
        ration = store.get_ration(ration_id)
        if ration is None:
            raise ValidationError(
                f"日配计划不存在: {ration_id}",
                stage="ration_not_found"
            )

        if not ration.status.can_transition_to(DailyRationStatus.VALIDATING):
            raise StatusTransitionError(
                f"无法从 {ration.status.value} 状态开始验证",
                from_status=ration.status.value,
                to_status="validating"
            )

        ration.status = DailyRationStatus.VALIDATING
        store.save_ration(ration)

        animal = store.get_animal(ration.animal_id)
        if animal is None:
            raise AnimalProfileError(
                f"关联的动物档案不存在: {ration.animal_id}",
                animal_id=str(ration.animal_id)
            )

        formula = store.get_formula_for_species_and_season(animal.species, ration.season)

        verifications: List[VerificationResult] = []

        verifications.append(self.validation_service.verify_animal_profile(animal))
        verifications.append(self.validation_service.verify_feed_formula(formula, animal.species, ration.season))
        verifications.append(self.validation_service.verify_inventory(ration.items))
        verifications.append(self.validation_service.verify_data_consistency(
            ration.original_data_hash, animal, formula, ration.ration_date
        ))

        all_success = all(v.success for v in verifications)
        ration.errors = [
            error for v in verifications for error in v.errors
        ]
        ration.warnings = [
            warning for v in verifications for warning in v.warnings
        ]
        ration.verification_messages = [
            msg for v in verifications for msg in v.messages
        ]

        if all_success:
            ration.status = DailyRationStatus.PENDING
        else:
            ration.status = DailyRationStatus.FAILED

        store.save_ration(ration)
        return ration, verifications

    def confirm_ration(self, ration_id: UUID) -> DailyRation:
        ration = store.get_ration(ration_id)
        if ration is None:
            raise ValidationError(
                f"日配计划不存在: {ration_id}",
                stage="ration_not_found"
            )

        if ration.status != DailyRationStatus.PENDING:
            raise StatusTransitionError(
                f"只有 PENDING 状态才能确认，当前状态: {ration.status.value}",
                from_status=ration.status.value,
                to_status="confirmed"
            )

        ration.status = DailyRationStatus.CONFIRMED
        store.save_ration(ration)
        return ration

    def execute_ration(self, ration_id: UUID) -> DailyRation:
        ration = store.get_ration(ration_id)
        if ration is None:
            raise ValidationError(
                f"日配计划不存在: {ration_id}",
                stage="ration_not_found"
            )

        if ration.status != DailyRationStatus.CONFIRMED:
            raise StatusTransitionError(
                f"只有 CONFIRMED 状态才能执行，当前状态: {ration.status.value}",
                from_status=ration.status.value,
                to_status="executed"
            )

        for item in ration.items:
            inventory = store.get_inventory(item.feed_name)
            if inventory is None:
                continue
            if inventory.current_qty_kg < item.planned_quantity_kg:
                raise InventoryError(
                    f"执行时发现库存不足: {item.feed_name}",
                    feed_name=item.feed_name,
                    required=item.planned_quantity_kg,
                    available=inventory.current_qty_kg
                )

        for item in ration.items:
            inventory = store.get_inventory(item.feed_name)
            if inventory is None:
                continue
            inventory.current_qty_kg -= item.planned_quantity_kg
            store.save_inventory(inventory)
            item.actual_quantity_kg = item.planned_quantity_kg

        ration.status = DailyRationStatus.EXECUTED
        ration.executed_at = datetime.utcnow()
        store.save_ration(ration)
        return ration

    def retry_failed_ration(self, ration_id: UUID) -> DailyRation:
        ration = store.get_ration(ration_id)
        if ration is None:
            raise ValidationError(
                f"日配计划不存在: {ration_id}",
                stage="ration_not_found"
            )

        if ration.status != DailyRationStatus.FAILED:
            raise StatusTransitionError(
                f"只有 FAILED 状态才能重跑，当前状态: {ration.status.value}",
                from_status=ration.status.value,
                to_status="draft"
            )

        return self.generate_ration(ration.animal_id, ration.ration_date, ration.created_by)

    def get_all_verifications(self, ration_id: UUID) -> List[VerificationResult]:
        ration = store.get_ration(ration_id)
        if ration is None:
            raise ValidationError(
                f"日配计划不存在: {ration_id}",
                stage="ration_not_found"
            )

        animal = store.get_animal(ration.animal_id)
        formula = store.get_formula_for_species_and_season(ration.animal_species, ration.season)

        verifications: List[VerificationResult] = []

        if animal:
            verifications.append(self.validation_service.verify_animal_profile(animal))
            verifications.append(self.validation_service.verify_feed_formula(formula, ration.animal_species, ration.season))
            verifications.append(self.validation_service.verify_inventory(ration.items))
            verifications.append(self.validation_service.verify_data_consistency(
                ration.original_data_hash, animal, formula, ration.ration_date
            ))

        return verifications


orchestrator = RationOrchestrator()
