import json
import os
from typing import Dict, List, Optional
from .models import (
    RentalOrder, Equipment, EquipmentValue, DamageAssessment,
    RepairQuote, InsuranceTerm, DepositRecord
)


class DataImporter:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.orders: Dict[str, RentalOrder] = {}
        self.equipment_values: Dict[str, EquipmentValue] = {}
        self.damage_assessments: Dict[str, List[DamageAssessment]] = {}
        self.repair_quotes: Dict[str, List[RepairQuote]] = {}
        self.insurance_terms: Dict[str, InsuranceTerm] = {}
        self.deposit_records: Dict[str, DepositRecord] = {}

    def load_all(self):
        self.load_rental_orders()
        self.load_equipment_values()
        self.load_damage_assessments()
        self.load_repair_quotes()
        self.load_insurance_terms()
        self.load_deposit_records()

    def load_rental_orders(self):
        orders_dir = os.path.join(self.data_dir, 'rental_orders')
        if not os.path.exists(orders_dir):
            return

        for filename in os.listdir(orders_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(orders_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                equipments = [
                    Equipment(**eq) for eq in data.get('equipments', [])
                ]
                
                order = RentalOrder(
                    order_id=data['order_id'],
                    customer_id=data['customer_id'],
                    customer_name=data['customer_name'],
                    rental_start=data['rental_start'],
                    rental_end=data['rental_end'],
                    equipments=equipments,
                    rental_fee=data['rental_fee']
                )
                self.orders[order.order_id] = order

    def load_equipment_values(self):
        values_dir = os.path.join(self.data_dir, 'equipment_values')
        if not os.path.exists(values_dir):
            return

        for filename in os.listdir(values_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(values_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                value = EquipmentValue(**data)
                self.equipment_values[value.equipment_id] = value

    def load_damage_assessments(self):
        assessments_dir = os.path.join(self.data_dir, 'damage_assessments')
        if not os.path.exists(assessments_dir):
            return

        for filename in os.listdir(assessments_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(assessments_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                assessment = DamageAssessment(**data)
                if assessment.order_id not in self.damage_assessments:
                    self.damage_assessments[assessment.order_id] = []
                self.damage_assessments[assessment.order_id].append(assessment)

    def load_repair_quotes(self):
        quotes_dir = os.path.join(self.data_dir, 'repair_quotes')
        if not os.path.exists(quotes_dir):
            return

        for filename in os.listdir(quotes_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(quotes_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                quote = RepairQuote(**data)
                if quote.order_id not in self.repair_quotes:
                    self.repair_quotes[quote.order_id] = []
                self.repair_quotes[quote.order_id].append(quote)

    def load_insurance_terms(self):
        terms_dir = os.path.join(self.data_dir, 'insurance_terms')
        if not os.path.exists(terms_dir):
            return

        for filename in os.listdir(terms_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(terms_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                term = InsuranceTerm(**data)
                self.insurance_terms[term.policy_id] = term

    def load_deposit_records(self):
        deposits_dir = os.path.join(self.data_dir, 'deposits')
        if not os.path.exists(deposits_dir):
            return

        for filename in os.listdir(deposits_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(deposits_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                deposit = DepositRecord(**data)
                self.deposit_records[deposit.order_id] = deposit

    def get_order(self, order_id: str) -> Optional[RentalOrder]:
        return self.orders.get(order_id)

    def get_damage_assessments(self, order_id: str) -> List[DamageAssessment]:
        return self.damage_assessments.get(order_id, [])

    def get_repair_quotes(self, order_id: str) -> List[RepairQuote]:
        return self.repair_quotes.get(order_id, [])

    def get_repair_quote(self, order_id: str, equipment_id: str) -> Optional[RepairQuote]:
        quotes = self.repair_quotes.get(order_id, [])
        for quote in quotes:
            if quote.equipment_id == equipment_id:
                return quote
        return None

    def get_deposit(self, order_id: str) -> Optional[DepositRecord]:
        return self.deposit_records.get(order_id)

    def get_equipment_value(self, equipment_id: str) -> Optional[EquipmentValue]:
        return self.equipment_values.get(equipment_id)

    def get_insurance_term(self, policy_id: str) -> Optional[InsuranceTerm]:
        return self.insurance_terms.get(policy_id)

    def get_default_insurance(self) -> Optional[InsuranceTerm]:
        if self.insurance_terms:
            return list(self.insurance_terms.values())[0]
        return None
