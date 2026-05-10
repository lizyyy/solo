import uuid
import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from .models import (
    RentalOrder, DamageAssessment, RepairQuote, InsuranceTerm,
    DepositRecord, ClaimItem, ClaimSummary
)
from .importer import DataImporter


class ClaimCalculator:
    DAMAGE_LEVEL_COEFFICIENTS = {
        'minor': 0.1,
        'moderate': 0.3,
        'severe': 0.6,
        'total_loss': 1.0
    }

    def __init__(self, importer: DataImporter, claims_dir: str = 'claims'):
        self.importer = importer
        self.claims_dir = claims_dir
        self._ensure_claims_dir()

    def _ensure_claims_dir(self):
        if not os.path.exists(self.claims_dir):
            os.makedirs(self.claims_dir)

    def _get_claim_path(self, order_id: str) -> str:
        return os.path.join(self.claims_dir, f'{order_id}_claim.json')

    def claim_exists(self, order_id: str) -> bool:
        return os.path.exists(self._get_claim_path(order_id))

    def load_claim(self, order_id: str) -> Optional[dict]:
        path = self._get_claim_path(order_id)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def save_claim(self, claim: dict):
        path = self._get_claim_path(claim['order_id'])
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(claim, f, ensure_ascii=False, indent=2)

    def calculate(
        self,
        order_id: str,
        insurance_term: Optional[InsuranceTerm] = None,
        overrides: Optional[Dict[str, str]] = None
    ) -> ClaimSummary:
        overrides = overrides or {}
        
        order = self.importer.get_order(order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found")

        assessments = self.importer.get_damage_assessments(order_id)
        if not assessments:
            raise ValueError(f"No damage assessments found for order {order_id}")

        insurance = insurance_term or self.importer.get_default_insurance()
        if not insurance:
            raise ValueError("No insurance terms found")

        deposit = self.importer.get_deposit(order_id)

        claim_items = []
        anomalies = []
        remaining_deposit = deposit.amount if deposit else 0.0
        total_assessed_loss = 0.0
        total_repair_cost = 0.0
        total_deductible = 0.0
        total_insurance_payout = 0.0
        total_customer_payable = 0.0
        total_deposit_deducted = 0.0

        existing_claim = self.load_claim(order_id)
        if existing_claim and existing_claim.get('status') == 'confirmed':
            total_deposit_deducted = existing_claim.get('total_deposit_deducted', 0.0)
            remaining_deposit = existing_claim.get('total_deposit_remaining', 0.0)

        for assessment in assessments:
            equipment_id = assessment.equipment_id
            equipment = self._find_equipment(order, equipment_id)
            if not equipment:
                continue

            quote = self.importer.get_repair_quote(order_id, equipment_id)
            
            damage_level = overrides.get(equipment_id, assessment.damage_level)
            
            assessed_loss = self._calculate_assessed_loss(assessment, damage_level, equipment_id)
            
            repair_cost = quote.total_cost if quote else 0.0
            
            is_insured = self._is_equipment_insured(equipment, insurance)
            is_excluded = False
            exclusion_reason = ''
            
            if not is_insured:
                is_excluded = True
                exclusion_reason = 'Equipment type not covered by insurance policy'
                anomalies.append({
                    'equipment_id': equipment_id,
                    'equipment_name': equipment.name,
                    'type': 'insurance_exclusion',
                    'message': f'{equipment.name} ({equipment_id}) is not covered by insurance policy'
                })

            deductible_applied = 0.0
            insurance_payout = 0.0

            if repair_cost == 0.0:
                anomalies.append({
                    'equipment_id': equipment_id,
                    'equipment_name': equipment.name,
                    'type': 'missing_quote',
                    'message': f'No repair quote found for {equipment.name} ({equipment_id})'
                })

            if is_insured and not is_excluded:
                deductible_applied = min(
                    insurance.deductible_per_item,
                    repair_cost if repair_cost > 0 else assessed_loss
                )

                if deductible_applied >= (repair_cost if repair_cost > 0 else assessed_loss):
                    is_excluded = True
                    exclusion_reason = 'Deductible exceeds loss amount'
                    anomalies.append({
                        'equipment_id': equipment_id,
                        'equipment_name': equipment.name,
                        'type': 'deductible_exceeds_loss',
                        'message': f'Deductible ({deductible_applied}) exceeds loss amount for {equipment.name}'
                    })
                    deductible_applied = 0.0
                else:
                    max_coverage = min(
                        insurance.max_coverage_per_item,
                        insurance.max_coverage_per_claim - total_insurance_payout
                    )
                    loss_amount = repair_cost if repair_cost > 0 else assessed_loss
                    insurance_payout = min(
                        max_coverage,
                        loss_amount - deductible_applied
                    )

            total_assessed_loss += assessed_loss
            total_repair_cost += repair_cost
            total_deductible += deductible_applied
            total_insurance_payout += insurance_payout

            if is_excluded:
                customer_payable = repair_cost if repair_cost > 0 else assessed_loss
            else:
                customer_payable = deductible_applied

            deposit_deducted = 0.0
            if existing_claim and existing_claim.get('status') == 'confirmed':
                for item in existing_claim.get('items', []):
                    if item['equipment_id'] == equipment_id:
                        deposit_deducted = item.get('deposit_deducted', 0.0)
                        break
            else:
                if customer_payable > 0 and remaining_deposit > 0:
                    deposit_deducted = min(customer_payable, remaining_deposit)
                    remaining_deposit -= deposit_deducted
                    total_deposit_deducted += deposit_deducted

            total_customer_payable += customer_payable

            claim_item = ClaimItem(
                equipment_id=equipment_id,
                equipment_name=equipment.name,
                damage_level=damage_level,
                damage_description=assessment.damage_description,
                assessed_loss=assessed_loss,
                repair_cost=repair_cost,
                deductible_applied=deductible_applied,
                insurance_payout=insurance_payout,
                customer_payable=customer_payable,
                deposit_deducted=deposit_deducted,
                remaining_deposit=remaining_deposit,
                is_insured=is_insured,
                is_excluded=is_excluded,
                exclusion_reason=exclusion_reason
            )
            claim_items.append(claim_item)

        claim_id = str(uuid.uuid4())[:8].upper()
        if existing_claim:
            claim_id = existing_claim.get('claim_id', claim_id)

        claim_summary = ClaimSummary(
            claim_id=claim_id,
            order_id=order_id,
            customer_id=order.customer_id,
            customer_name=order.customer_name,
            status='draft',
            total_assessed_loss=round(total_assessed_loss, 2),
            total_repair_cost=round(total_repair_cost, 2),
            total_deductible=round(total_deductible, 2),
            total_insurance_payout=round(total_insurance_payout, 2),
            total_customer_payable=round(total_customer_payable, 2),
            total_deposit_deducted=round(total_deposit_deducted, 2),
            total_deposit_remaining=round(remaining_deposit, 2),
            original_deposit=round(deposit.amount, 2) if deposit else 0.0,
            items=claim_items,
            anomalies=anomalies,
            created_at=datetime.now().isoformat()
        )

        return claim_summary

    def _find_equipment(self, order: RentalOrder, equipment_id: str):
        for eq in order.equipments:
            if eq.equipment_id == equipment_id:
                return eq
        return None

    def _calculate_assessed_loss(
        self,
        assessment: DamageAssessment,
        damage_level: str,
        equipment_id: str
    ) -> float:
        coefficient = self.DAMAGE_LEVEL_COEFFICIENTS.get(
            damage_level, 
            self.DAMAGE_LEVEL_COEFFICIENTS['moderate']
        )
        
        if assessment.estimated_loss > 0:
            return assessment.estimated_loss
        
        eq_value = self.importer.get_equipment_value(equipment_id)
        if eq_value:
            return eq_value.current_value * coefficient
        
        return 0.0

    def _is_equipment_insured(
        self,
        equipment,
        insurance: InsuranceTerm
    ) -> bool:
        eq_type = equipment.name.lower()
        for covered_type in insurance.covered_equipment_types:
            if covered_type.lower() in eq_type:
                return True
        return False

    def confirm_claim(self, order_id: str) -> dict:
        existing_claim = self.load_claim(order_id)
        if not existing_claim:
            raise ValueError(f"No claim found for order {order_id}")
        
        if existing_claim.get('status') == 'confirmed':
            raise ValueError(f"Claim for order {order_id} is already confirmed")

        existing_claim['status'] = 'confirmed'
        existing_claim['confirmed_at'] = datetime.now().isoformat()
        
        self.save_claim(existing_claim)
        return existing_claim

    def update_damage_level(
        self,
        order_id: str,
        equipment_id: str,
        new_level: str
    ) -> dict:
        if new_level not in self.DAMAGE_LEVEL_COEFFICIENTS:
            raise ValueError(
                f"Invalid damage level. Must be one of: {list(self.DAMAGE_LEVEL_COEFFICIENTS.keys())}"
            )
        
        existing_claim = self.load_claim(order_id)
        if not existing_claim:
            raise ValueError(f"No claim found for order {order_id}")
        
        if existing_claim.get('status') == 'confirmed':
            raise ValueError("Cannot modify confirmed claim")

        claim = self.calculate(order_id, overrides={equipment_id: new_level})
        claim_dict = self._claim_to_dict(claim)
        claim_dict['created_at'] = existing_claim.get('created_at', claim_dict['created_at'])
        self.save_claim(claim_dict)
        return claim_dict

    def _claim_to_dict(self, claim: ClaimSummary) -> dict:
        return {
            'claim_id': claim.claim_id,
            'order_id': claim.order_id,
            'customer_id': claim.customer_id,
            'customer_name': claim.customer_name,
            'status': claim.status,
            'total_assessed_loss': claim.total_assessed_loss,
            'total_repair_cost': claim.total_repair_cost,
            'total_deductible': claim.total_deductible,
            'total_insurance_payout': claim.total_insurance_payout,
            'total_customer_payable': claim.total_customer_payable,
            'total_deposit_deducted': claim.total_deposit_deducted,
            'total_deposit_remaining': claim.total_deposit_remaining,
            'original_deposit': claim.original_deposit,
            'items': [
                {
                    'equipment_id': item.equipment_id,
                    'equipment_name': item.equipment_name,
                    'damage_level': item.damage_level,
                    'damage_description': item.damage_description,
                    'assessed_loss': item.assessed_loss,
                    'repair_cost': item.repair_cost,
                    'deductible_applied': item.deductible_applied,
                    'insurance_payout': item.insurance_payout,
                    'customer_payable': item.customer_payable,
                    'deposit_deducted': item.deposit_deducted,
                    'remaining_deposit': item.remaining_deposit,
                    'is_insured': item.is_insured,
                    'is_excluded': item.is_excluded,
                    'exclusion_reason': item.exclusion_reason
                }
                for item in claim.items
            ],
            'anomalies': claim.anomalies,
            'created_at': claim.created_at,
            'confirmed_at': claim.confirmed_at
        }
