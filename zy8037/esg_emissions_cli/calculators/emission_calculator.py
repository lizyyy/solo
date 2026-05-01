"""
Emission calculation engine with unit conversion, factor matching,
duplicate detection and cross-month adjustment handling
"""

from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from ..models.data_models import (
    EnergyBill, EmissionFactor, OrganizationBoundary,
    AdjustmentItem, EmissionResult
)


UNIT_CONVERSIONS = {
    ('kWh', 'MWh'): 0.001,
    ('MWh', 'kWh'): 1000.0,
    ('GJ', 'MWh'): 0.277778,
    ('MWh', 'GJ'): 3.6,
    ('kWh', 'GJ'): 0.0036,
    ('GJ', 'kWh'): 277.778,
    ('m³', 'kWh'): 10.0,
    ('kWh', 'm³'): 0.1,
    ('t', 'kWh'): 3222.0,
    ('kWh', 't'): 0.0003105,
}

EMISSION_FACTOR_DEFAULTS = {
    'electricity': {'Scope 2': 0.581, 'unit': 'kgCO2/kWh'},
    'natural_gas': {'Scope 1': 2.02, 'unit': 'kgCO2/m³'},
    'diesel': {'Scope 1': 2.68, 'unit': 'kgCO2/L'},
    'gasoline': {'Scope 1': 2.31, 'unit': 'kgCO2/L'},
    'coal': {'Scope 1': 2.42, 'unit': 'kgCO2/kg'},
}


class EmissionCalculator:
    def __init__(
        self,
        factors: List[EmissionFactor],
        org_boundary: OrganizationBoundary
    ):
        self.factors = factors
        self.org_boundary = org_boundary
        self._factor_index = self._build_factor_index()

    def _build_factor_index(self) -> Dict[str, List[EmissionFactor]]:
        index = defaultdict(list)
        for f in self.factors:
            index[f.energy_type].append(f)
        return index

    def _normalize_unit(self, unit: str) -> str:
        u = unit.strip().lower()
        unit_map = {
            'kwh': 'kWh', 'mwh': 'MWh', 'gj': 'GJ',
            'm³': 'm³', 'm3': 'm³',
            'kg': 'kg', 't': 't', 'l': 'L'
        }
        return unit_map.get(u, unit)

    def _convert_unit(self, value: float, from_unit: str, to_unit: str) -> Tuple[float, bool]:
        if from_unit == to_unit:
            return value, True

        from_u = self._normalize_unit(from_unit)
        to_u = self._normalize_unit(to_unit)

        key = (from_u, to_u)
        if key in UNIT_CONVERSIONS:
            return value * UNIT_CONVERSIONS[key], True

        return value, False

    def _find_factor(
        self,
        energy_type: str,
        month: str,
        scope: str
    ) -> Optional[EmissionFactor]:
        candidates = self._factor_index.get(energy_type.lower(), [])

        year, mon = None, None
        if month:
            parts = month.split('-')
            if len(parts) == 2:
                year, mon = parts[0], parts[1]

        best_match = None
        for f in candidates:
            if f.scope != scope:
                continue

            if year and mon and f.effective_date:
                eff_parts = f.effective_date.split('-')
                if len(eff_parts) >= 2:
                    eff_year, eff_mon = eff_parts[0], eff_parts[1]
                    if eff_year <= year and eff_mon <= mon:
                        if best_match is None or eff_year > best_match.effective_date.split('-')[0]:
                            best_match = f

        if not best_match and candidates:
            for f in candidates:
                if f.scope == scope:
                    best_match = f
                    break

        return best_match

    def _get_default_factor(
        self,
        energy_type: str,
        scope: str
    ) -> Optional[EmissionFactor]:
        defaults = EMISSION_FACTOR_DEFAULTS.get(energy_type.lower())
        if defaults and defaults.get('scope') == scope:
            return EmissionFactor(
                energy_type=energy_type,
                factor_value=defaults['factor_value'],
                unit=defaults['unit'],
                scope=scope,
                version='default',
                effective_date='1970-01'
            )
        return None

    def _detect_duplicates(self, bills: List[EnergyBill]) -> List[Tuple[EnergyBill, EnergyBill]]:
        seen = {}
        duplicates = []

        for bill in bills:
            key = (bill.site, bill.month, bill.energy_type, bill.consumption)
            if key in seen:
                duplicates.append((seen[key], bill))
            else:
                seen[key] = bill

        return duplicates

    def _match_cross_month_adjustments(
        self,
        bills: List[EnergyBill],
        adjustments: List[AdjustmentItem]
    ) -> Dict[str, List[AdjustmentItem]]:
        bill_months = defaultdict(list)
        for bill in bills:
            key = f"{bill.site}|{bill.energy_type}"
            bill_months[key].append(bill.month)

        matched = defaultdict(list)
        for adj in adjustments:
            key = f"{adj.site}|{adj.energy_type}"
            if key in bill_months:
                matched[key].append(adj)

        return dict(matched)

    def _normalize_bill_site(self, bill: EnergyBill) -> str:
        normalized = self.org_boundary.normalize_site(bill.site)
        return normalized if normalized else bill.site

    def calculate(
        self,
        bills: List[EnergyBill],
        adjustments: List[AdjustmentItem],
        anomalies: List[Dict]
    ) -> List[Dict]:
        results = []
        seen_bill_keys = {}

        duplicates = self._detect_duplicates(bills)
        for dup in duplicates:
            anomalies.append({
                'type': '重复账单',
                'site': dup[0].site,
                'severity': 'warning',
                'description': f"检测到重复账单: {dup[0].bill_id} 和 {dup[1].bill_id}, "
                              f"用量 {dup[0].consumption} {dup[0].unit}"
            })

        cross_month_adj = self._match_cross_month_adjustments(bills, adjustments)
        for key, adjs in cross_month_adj.items():
            if len(adjs) > 1:
                site, energy_type = key.split('|', 1)
                anomalies.append({
                    'type': '跨月调整',
                    'site': site,
                    'severity': 'warning',
                    'description': f"同一站点 {site} 能源类型 {energy_type} 有 {len(adjs)} 条跨月调整"
                })

        aggregated = defaultdict(lambda: {
            'consumption': 0.0,
            'unit': None,
            'bills': [],
            'site': None,
            'scope': None,
            'energy_type': None,
            'month': None
        })

        for bill in bills:
            normalized_site = self._normalize_bill_site(bill)
            scope = self.org_boundary.get_site_scope(normalized_site)
            key = f"{normalized_site}|{bill.month}|{bill.energy_type}|{scope}"

            agg = aggregated[key]
            agg['consumption'] += bill.consumption
            agg['unit'] = bill.unit
            agg['bills'].append(bill)
            agg['site'] = normalized_site
            agg['scope'] = scope
            agg['energy_type'] = bill.energy_type
            agg['month'] = bill.month

        for key, agg in aggregated.items():
            if agg['unit'] is None:
                continue

            target_unit = 'kWh'
            if agg['energy_type'] in ['natural_gas', 'gas', 'diesel', 'gasoline']:
                target_unit = agg['unit']
            elif agg['energy_type'] in ['coal']:
                target_unit = 'kg'

            consumption = agg['consumption']
            if agg['unit'] != target_unit:
                consumption, converted = self._convert_unit(
                    agg['consumption'], agg['unit'], target_unit
                )
                if not converted:
                    consumption = agg['consumption']
                    target_unit = agg['unit']

            factor = self._find_factor(agg['energy_type'], agg['month'], agg['scope'])

            if factor is None:
                factor = self._get_default_factor(agg['energy_type'], agg['scope'])
                if factor:
                    anomalies.append({
                        'type': '因子缺失',
                        'site': agg['site'],
                        'severity': 'warning',
                        'description': f"能源类型 {agg['energy_type']} 范围 {agg['scope']} "
                                      f"使用默认因子 {factor.factor_value} {factor.unit}"
                    })
                else:
                    anomalies.append({
                        'type': '因子缺失',
                        'site': agg['site'],
                        'severity': 'error',
                        'description': f"能源类型 {agg['energy_type']} 范围 {agg['scope']} "
                                        f"无法找到排放因子"
                    })
                    continue

            factor_in_target = factor.factor_value
            factor_unit = factor.unit

            if 'kgCO2' in factor_unit and 'kWh' in factor_unit:
                if target_unit == 'MWh':
                    factor_in_target = factor.factor_value
                elif target_unit == 'GJ':
                    factor_in_target = factor.factor_value * 0.0036
            elif 'kgCO2' in factor_unit and 'm³' in factor_unit:
                if target_unit == 'kWh':
                    factor_in_target = factor.factor_value / 10.0
            elif 'kgCO2' in factor_unit and 'kg' in factor_unit:
                if target_unit == 't':
                    factor_in_target = factor.factor_value

            emissions = consumption * factor_in_target / 1000.0

            for adj in adjustments:
                adj_site_norm = self._normalize_bill_site(
                    EnergyBill(adj.site, adj.month, adj.energy_type, 0, '', '')
                )
                if (adj_site_norm == agg['site'] and
                    adj.month == agg['month'] and
                    adj.energy_type == agg['energy_type']):

                    emissions += adj.amount
                    if adj.is_negative_reversal():
                        anomalies.append({
                            'type': '负数冲回',
                            'site': agg['site'],
                            'severity': 'info',
                            'description': f"应用负数冲回 {adj.amount} tCO2e, 原因: {adj.reason}"
                        })

            results.append({
                'site': agg['site'],
                'scope': agg['scope'],
                'month': agg['month'],
                'energy_type': agg['energy_type'],
                'consumption': consumption,
                'unit': target_unit,
                'factor_value': factor_in_target,
                'emissions': emissions,
                'factor_version': factor.version,
                'warnings': []
            })

            for bill in agg['bills']:
                bill_key = bill.get_key()
                if bill_key in seen_bill_keys:
                    continue
                seen_bill_keys[bill_key] = True

        return results

    def generate_summary(
        self,
        results: List[Dict],
        month: Optional[str]
    ) -> Dict:
        summary = {
            'month': month or 'N/A',
            'site_count': len(set(r['site'] for r in results)),
            'total_emissions': sum(r['emissions'] for r in results),
            'by_scope': defaultdict(float),
            'by_site': []
        }

        for r in results:
            summary['by_scope'][r['scope']] += r['emissions']

        summary['by_scope'] = dict(summary['by_scope'])

        by_site_scope = defaultdict(lambda: defaultdict(float))
        for r in results:
            by_site_scope[r['site']][r['scope']] += r['emissions']

        for site, scopes in by_site_scope.items():
            for scope, emissions in scopes.items():
                summary['by_site'].append({
                    'site': site,
                    'scope': scope,
                    'month': r.get('month', 'N/A'),
                    'emissions': emissions
                })

        return summary
