from datetime import date
from typing import Dict, Optional, List, Any
from uuid import UUID

from .models import (
    Animal,
    FeedFormula,
    HealthCorrectionRule,
    FeedInventory,
    DailyRation,
    RationItem,
    VerificationResult
)
from .enums import Season, AnimalStatus, DailyRationStatus


class InMemoryStore:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_store()
        return cls._instance

    def _init_store(self):
        self.animals: Dict[UUID, Animal] = {}
        self.formulas: Dict[UUID, FeedFormula] = {}
        self.correction_rules: Dict[UUID, HealthCorrectionRule] = {}
        self.inventories: Dict[str, FeedInventory] = {}
        self.ratons: Dict[UUID, DailyRation] = {}

    def get_animal(self, animal_id: UUID) -> Optional[Animal]:
        return self.animals.get(animal_id)

    def save_animal(self, animal: Animal):
        self.animals[animal.id] = animal

    def get_all_animals(self) -> List[Animal]:
        return list(self.animals.values())

    def get_formula_for_species_and_season(
        self,
        species: str,
        season: Season
    ) -> Optional[FeedFormula]:
        for formula in self.formulas.values():
            if formula.species == species and formula.season == season and formula.is_active:
                return formula
        return None

    def save_formula(self, formula: FeedFormula):
        self.formulas[formula.id] = formula

    def get_all_formulas(self) -> List[FeedFormula]:
        return list(self.formulas.values())

    def get_correction_rules_for_animal(
        self,
        animal: Animal
    ) -> List[HealthCorrectionRule]:
        rules = [
            rule for rule in self.correction_rules.values()
            if rule.applies_to(animal)
        ]
        rules.sort(key=lambda r: r.priority, reverse=True)
        return rules

    def save_correction_rule(self, rule: HealthCorrectionRule):
        self.correction_rules[rule.id] = rule

    def get_inventory(self, feed_name: str) -> Optional[FeedInventory]:
        return self.inventories.get(feed_name)

    def save_inventory(self, inventory: FeedInventory):
        self.inventories[inventory.feed_name] = inventory

    def get_all_inventories(self) -> List[FeedInventory]:
        return list(self.inventories.values())

    def save_ration(self, ration: DailyRation):
        self.ratons[ration.id] = ration

    def get_ration(self, ration_id: UUID) -> Optional[DailyRation]:
        return self.ratons.get(ration_id)

    def get_ratons_by_date(self, ration_date: date) -> List[DailyRation]:
        return [
            r for r in self.ratons.values()
            if r.ration_date == ration_date
        ]

    def get_ration_by_animal_and_date(
        self,
        animal_id: UUID,
        ration_date: date
    ) -> Optional[DailyRation]:
        for r in self.ratons.values():
            if r.animal_id == animal_id and r.ration_date == ration_date:
                return r
        return None


store = InMemoryStore()
