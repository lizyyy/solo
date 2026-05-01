"""
Data models for ESG Emissions CLI
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
import re


@dataclass
class EnergyBill:
    site: str
    month: str
    energy_type: str
    consumption: float
    unit: str
    bill_id: str
    amount: float = 0.0
    currency: str = 'CNY'
    meta: Dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def from_dict(d: Dict) -> 'EnergyBill':
        return EnergyBill(
            site=str(d.get('site', '')).strip(),
            month=d.get('month', ''),
            energy_type=str(d.get('energy_type', '')).strip().lower(),
            consumption=float(d.get('consumption', 0)),
            unit=str(d.get('unit', 'kWh')).strip(),
            bill_id=str(d.get('bill_id', '')).strip(),
            amount=float(d.get('amount', 0)),
            currency=str(d.get('currency', 'CNY')),
            meta={k: v for k, v in d.items()
                  if k not in ['site', 'month', 'energy_type', 'consumption', 'unit', 'bill_id', 'amount', 'currency']}
        )

    def get_key(self) -> str:
        return f"{self.site}|{self.month}|{self.energy_type}|{self.consumption}"


@dataclass
class OrganizationBoundary:
    sites: Dict[str, Dict]
    aliases: Dict[str, List[str]]

    @staticmethod
    def from_dict(d: Dict) -> 'OrganizationBoundary':
        sites = d.get('sites', {})
        aliases = d.get('site_aliases', {})
        return OrganizationBoundary(sites=sites, aliases=aliases)

    def normalize_site(self, site_name: str) -> Optional[str]:
        site_name = site_name.strip()
        if site_name in self.sites:
            return site_name
        for canonical, alias_list in self.aliases.items():
            if site_name in alias_list:
                return canonical
        return None

    def get_site_scope(self, site: str) -> str:
        site_info = self.sites.get(site, {})
        return site_info.get('scope', 'Scope 2')

    def is_valid_site(self, site: str) -> bool:
        return self.normalize_site(site) is not None


@dataclass
class EmissionFactor:
    energy_type: str
    factor_value: float
    unit: str
    scope: str
    version: str
    effective_date: str
    source: str = ''

    @staticmethod
    def from_dict(d: Dict) -> 'EmissionFactor':
        return EmissionFactor(
            energy_type=str(d.get('energy_type', '')).strip().lower(),
            factor_value=float(d.get('factor_value', 0)),
            unit=str(d.get('unit', 'kgCO2/kWh')).strip(),
            scope=str(d.get('scope', 'Scope 2')).strip(),
            version=str(d.get('version', 'v1.0')).strip(),
            effective_date=str(d.get('effective_date', '')).strip(),
            source=d.get('source', '')
        )

    def matches_energy_type(self, energy_type: str) -> bool:
        return energy_type.strip().lower() == self.energy_type


@dataclass
class AdjustmentItem:
    site: str
    month: str
    energy_type: str
    adjustment_type: str
    amount: float
    reason: str
    related_bill_id: Optional[str] = None

    @staticmethod
    def from_dict(d: Dict) -> 'AdjustmentItem':
        return AdjustmentItem(
            site=str(d.get('site', '')).strip(),
            month=str(d.get('month', '')).strip(),
            energy_type=str(d.get('energy_type', '')).strip().lower(),
            adjustment_type=str(d.get('adjustment_type', 'correction')).strip(),
            amount=float(d.get('amount', 0)),
            reason=str(d.get('reason', '')).strip(),
            related_bill_id=d.get('related_bill_id')
        )

    def is_negative_reversal(self) -> bool:
        return self.amount < 0


@dataclass
class EmissionResult:
    site: str
    scope: str
    month: str
    energy_type: str
    consumption: float
    unit: str
    factor_value: float
    emissions: float
    factor_version: str = ''
    warnings: List[str] = field(default_factory=list)
