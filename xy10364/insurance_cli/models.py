from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime


@dataclass
class Equipment:
    equipment_id: str
    name: str
    model: str
    serial_number: Optional[str] = None


@dataclass
class EquipmentValue:
    equipment_id: str
    purchase_value: float
    replacement_value: float
    current_value: float


@dataclass
class RentalOrder:
    order_id: str
    customer_id: str
    customer_name: str
    rental_start: str
    rental_end: str
    equipments: List[Equipment]
    rental_fee: float


@dataclass
class DamageAssessment:
    assessment_id: str
    order_id: str
    equipment_id: str
    damage_level: str
    damage_description: str
    assessed_by: str
    assessment_date: str
    estimated_loss: float


@dataclass
class RepairQuote:
    quote_id: str
    order_id: str
    equipment_id: str
    vendor_name: str
    repair_cost: float
    labor_cost: float
    parts_cost: float
    total_cost: float
    quote_date: str


@dataclass
class InsuranceTerm:
    policy_id: str
    name: str
    deductible_per_claim: float
    deductible_per_item: float
    max_coverage_per_item: float
    max_coverage_per_claim: float
    covered_equipment_types: List[str]
    excluded_damage_types: List[str]


@dataclass
class DepositRecord:
    deposit_id: str
    order_id: str
    amount: float
    deposit_date: str
    status: str


@dataclass
class ClaimItem:
    equipment_id: str
    equipment_name: str
    damage_level: str
    damage_description: str
    assessed_loss: float
    repair_cost: float
    deductible_applied: float
    insurance_payout: float
    customer_payable: float
    deposit_deducted: float
    remaining_deposit: float
    is_insured: bool
    is_excluded: bool
    exclusion_reason: str


@dataclass
class ClaimSummary:
    claim_id: str
    order_id: str
    customer_id: str
    customer_name: str
    status: str
    total_assessed_loss: float
    total_repair_cost: float
    total_deductible: float
    total_insurance_payout: float
    total_customer_payable: float
    total_deposit_deducted: float
    total_deposit_remaining: float
    original_deposit: float
    items: List[ClaimItem]
    anomalies: List[Dict]
    created_at: str
    confirmed_at: Optional[str] = None
