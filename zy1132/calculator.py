import json
import csv
import math
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import os

import config
from models import (
    Parcel, Facility, PopulationData, ServiceGap, ConflictIssue, Scheme
)


def haversine_distance(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def get_parcel_centroid(parcel: Parcel) -> Tuple[float, float]:
    if not parcel.geometry:
        return 116.387, 39.916
    
    try:
        if hasattr(parcel.geometry, 'centroid'):
            centroid = parcel.geometry.centroid
            return centroid.x, centroid.y
    except Exception:
        pass
    
    return 116.387, 39.916


class DataLoader:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.parcels: List[Parcel] = []
        self.facilities: List[Facility] = []
        self.population_data: Dict[str, PopulationData] = {}
        self.plan_rules: Dict = {}

    def load_all(self):
        self.load_parcels()
        self.load_facilities()
        self.load_population()
        self.load_plan_rules()
        return self

    def load_parcels(self) -> List[Parcel]:
        filepath = os.path.join(self.data_dir, 'parcels.geojson')
        if not os.path.exists(filepath):
            return []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.parcels = []
        for feature in data.get('features', []):
            parcel = Parcel.from_geojson_feature(feature)
            parcel.calculate_metrics('plan')
            self.parcels.append(parcel)
        
        return self.parcels

    def load_facilities(self) -> List[Facility]:
        filepath = os.path.join(self.data_dir, 'facilities.csv')
        if not os.path.exists(filepath):
            return []
        
        self.facilities = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                facility = Facility.from_csv_row(row)
                self.facilities.append(facility)
        
        return self.facilities

    def load_population(self) -> Dict[str, PopulationData]:
        filepath = os.path.join(self.data_dir, 'population.csv')
        if not os.path.exists(filepath):
            return {}
        
        self.population_data = {}
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                pop_data = PopulationData.from_csv_row(row)
                self.population_data[pop_data.parcel_id] = pop_data
        
        return self.population_data

    def load_plan_rules(self) -> Dict:
        filepath = os.path.join(self.data_dir, 'plan-rules.json')
        if not os.path.exists(filepath):
            self.plan_rules = {}
            return {}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            self.plan_rules = json.load(f)
        
        return self.plan_rules


class ServiceCalculator:
    def __init__(self, parcels: List[Parcel], facilities: List[Facility], 
                 population_data: Dict[str, PopulationData], plan_rules: Dict):
        self.parcels = parcels
        self.facilities = facilities
        self.population_data = population_data
        self.plan_rules = plan_rules
        self.service_radius = plan_rules.get('service_radius', config.SERVICE_RADIUS)

    def calculate_total_population(self) -> int:
        total = 0
        for parcel in self.parcels:
            if parcel.land_use in ['R', 'R2', 'R3']:
                pop_data = self.population_data.get(parcel.id)
                if pop_data:
                    total += pop_data.total_population
                else:
                    total += parcel.existing_population or parcel.estimated_population
        return total

    def get_facilities_by_type(self, facility_type: str) -> List[Facility]:
        return [f for f in self.facilities if f.type == facility_type]

    def calculate_service_coverage(self, facility_type: str) -> Dict:
        radius_config = self.service_radius.get(facility_type, {})
        radius = radius_config.get('radius_meters', 500)
        
        facilities = self.get_facilities_by_type(facility_type)
        covered_parcels = set()
        uncovered_parcels = []
        
        for parcel in self.parcels:
            if parcel.land_use not in ['R', 'R2', 'R3']:
                continue
            
            px, py = get_parcel_centroid(parcel)
            is_covered = False
            
            for facility in facilities:
                dist = haversine_distance(px, py, facility.lon, facility.lat)
                if dist <= radius:
                    is_covered = True
                    covered_parcels.add(parcel.id)
                    break
            
            if not is_covered:
                uncovered_parcels.append(parcel.id)
        
        total_residential = len([p for p in self.parcels if p.land_use in ['R', 'R2', 'R3']])
        coverage_rate = len(covered_parcels) / total_residential if total_residential > 0 else 0
        
        return {
            'facility_type': facility_type,
            'radius_meters': radius,
            'total_facilities': len(facilities),
            'total_residential_parcels': total_residential,
            'covered_parcels': list(covered_parcels),
            'uncovered_parcels': uncovered_parcels,
            'coverage_rate': coverage_rate,
            'coverage_percentage': round(coverage_rate * 100, 1)
        }

    def calculate_service_gap(self, facility_type: str) -> ServiceGap:
        radius_config = self.service_radius.get(facility_type, {})
        radius = radius_config.get('radius_meters', 500)
        capacity_per_1000 = radius_config.get('capacity_per_1000', 0)
        unit = radius_config.get('unit', '单位')
        
        facilities = self.get_facilities_by_type(facility_type)
        
        total_supply = sum(f.capacity for f in facilities)
        
        total_population = self.calculate_total_population()
        total_demand = (total_population / 1000) * capacity_per_1000 if capacity_per_1000 > 0 else 0
        
        affected_parcels = []
        affected_population = 0
        
        for parcel in self.parcels:
            if parcel.land_use not in ['R', 'R2', 'R3']:
                continue
            
            px, py = get_parcel_centroid(parcel)
            has_coverage = False
            
            for facility in facilities:
                dist = haversine_distance(px, py, facility.lon, facility.lat)
                if dist <= radius:
                    has_coverage = True
                    break
            
            if not has_coverage:
                affected_parcels.append(parcel.id)
                pop_data = self.population_data.get(parcel.id)
                if pop_data:
                    affected_population += pop_data.total_population
                else:
                    affected_population += parcel.existing_population or parcel.estimated_population
        
        gap = max(0, total_demand - total_supply)
        gap_percentage = (gap / total_demand * 100) if total_demand > 0 else 0
        
        if gap_percentage > 50:
            severity = 'critical'
        elif gap_percentage > 30:
            severity = 'high'
        elif gap_percentage > 10:
            severity = 'medium'
        else:
            severity = 'low'
        
        return ServiceGap(
            facility_type=facility_type,
            facility_name=radius_config.get('name', facility_type),
            radius_meters=radius,
            demand=round(total_demand, 1),
            supply=round(total_supply, 1),
            gap=round(gap, 1),
            gap_percentage=round(gap_percentage, 1),
            severity=severity,
            affected_parcels=affected_parcels,
            affected_population=affected_population
        )

    def calculate_all_gaps(self) -> List[ServiceGap]:
        gaps = []
        facility_types = [
            'school_primary', 'school_secondary', 'kindergarten',
            'elderly', 'park', 'market', 'bus_stop', 'community_center'
        ]
        
        for ft in facility_types:
            gap = self.calculate_service_gap(ft)
            gaps.append(gap)
        
        return gaps


class ConflictChecker:
    def __init__(self, parcels: List[Parcel], plan_rules: Dict,
                 original_parcels: Optional[List[Parcel]] = None):
        self.parcels = parcels
        self.plan_rules = plan_rules
        self.original_parcels = original_parcels or []
        self.land_use_rules = plan_rules.get('land_use_rules', {})
        self.conflict_checks = plan_rules.get('conflict_checks', {})

    def check_far_exceed_max(self) -> List[ConflictIssue]:
        issues = []
        check_config = self.conflict_checks.get('far_exceed_max', {})
        if not check_config.get('enabled', True):
            return issues
        
        for parcel in self.parcels:
            rule = self.land_use_rules.get(parcel.land_use, {})
            max_far = rule.get('max_far', parcel.max_far)
            
            if parcel.plan_far > max_far:
                issues.append(ConflictIssue(
                    type='far_exceed_max',
                    severity=check_config.get('severity', 'high'),
                    description=f"容积率超过控规上限",
                    location=parcel.name,
                    parcel_id=parcel.id,
                    current_value=parcel.plan_far,
                    limit_value=max_far,
                    recommendation=f"建议将容积率调整至 {max_far} 或以下，或申请控规调整"
                ))
        
        return issues

    def check_height_exceed_limit(self) -> List[ConflictIssue]:
        issues = []
        check_config = self.conflict_checks.get('height_exceed_limit', {})
        if not check_config.get('enabled', True):
            return issues
        
        for parcel in self.parcels:
            rule = self.land_use_rules.get(parcel.land_use, {})
            max_height = rule.get('max_height', parcel.height_limit)
            
            estimated_height = parcel.plan_far * 3
            
            if max_height > 0 and estimated_height > max_height:
                issues.append(ConflictIssue(
                    type='height_exceed_limit',
                    severity=check_config.get('severity', 'high'),
                    description=f"估算建筑高度超过限高",
                    location=parcel.name,
                    parcel_id=parcel.id,
                    current_value=round(estimated_height, 1),
                    limit_value=max_height,
                    recommendation=f"建议降低容积率或采用退台设计，控制建筑高度在 {max_height} 米以内"
                ))
        
        return issues

    def check_density_exceed_limit(self) -> List[ConflictIssue]:
        issues = []
        check_config = self.conflict_checks.get('density_exceed_limit', {})
        if not check_config.get('enabled', True):
            return issues
        
        for parcel in self.parcels:
            rule = self.land_use_rules.get(parcel.land_use, {})
            max_density = rule.get('max_density', parcel.density_limit)
            
            if max_density > 0 and parcel.plan_far > (max_density / 10):
                estimated_density = min(parcel.plan_far * 10, 60)
                if estimated_density > max_density:
                    issues.append(ConflictIssue(
                        type='density_exceed_limit',
                        severity=check_config.get('severity', 'medium'),
                        description=f"建筑密度可能超过上限",
                        location=parcel.name,
                        parcel_id=parcel.id,
                        current_value=round(estimated_density, 1),
                        limit_value=max_density,
                        recommendation=f"建议优化建筑布局，增加绿地和开敞空间"
                    ))
        
        return issues

    def check_all_conflicts(self) -> List[ConflictIssue]:
        all_issues = []
        all_issues.extend(self.check_far_exceed_max())
        all_issues.extend(self.check_height_exceed_limit())
        all_issues.extend(self.check_density_exceed_limit())
        
        return all_issues


class AssessmentEngine:
    def __init__(self, parcels: List[Parcel], facilities: List[Facility],
                 population_data: Dict[str, PopulationData], plan_rules: Dict):
        self.parcels = parcels
        self.facilities = facilities
        self.population_data = population_data
        self.plan_rules = plan_rules
        
        self.service_calc = ServiceCalculator(parcels, facilities, population_data, plan_rules)
        self.conflict_checker = ConflictChecker(parcels, plan_rules)
        self.weights = plan_rules.get('assessment_weights', {
            'education': 0.25,
            'healthcare_elderly': 0.20,
            'green_space': 0.15,
            'commerce_market': 0.15,
            'transportation': 0.15,
            'community_services': 0.10
        })

    def calculate_parcel_metrics(self) -> Dict:
        metrics = {
            'total_parcels': len(self.parcels),
            'total_area_sqm': 0,
            'total_residential_area_sqm': 0,
            'total_commercial_area_sqm': 0,
            'total_public_area_sqm': 0,
            'total_green_area_sqm': 0,
            'estimated_total_population': 0,
            'existing_total_population': 0,
            'total_building_area': 0,
            'land_use_breakdown': {}
        }
        
        for parcel in self.parcels:
            metrics['total_area_sqm'] += parcel.area_sqm
            metrics['total_building_area'] += parcel.calculated_building_area or parcel.building_area
            
            if parcel.land_use in ['R', 'R2', 'R3']:
                metrics['total_residential_area_sqm'] += parcel.area_sqm
                metrics['estimated_total_population'] += parcel.estimated_population
                metrics['existing_total_population'] += parcel.existing_population
            elif parcel.land_use in ['B', 'B1', 'B2']:
                metrics['total_commercial_area_sqm'] += parcel.area_sqm
            elif parcel.land_use in ['A', 'A3', 'A5', 'A6']:
                metrics['total_public_area_sqm'] += parcel.area_sqm
            elif parcel.land_use in ['G', 'G1']:
                metrics['total_green_area_sqm'] += parcel.area_sqm
            
            land_use_name = config.LAND_USE_TYPES.get(parcel.land_use, parcel.land_use)
            if land_use_name not in metrics['land_use_breakdown']:
                metrics['land_use_breakdown'][land_use_name] = {
                    'count': 0,
                    'area_sqm': 0
                }
            metrics['land_use_breakdown'][land_use_name]['count'] += 1
            metrics['land_use_breakdown'][land_use_name]['area_sqm'] += parcel.area_sqm
        
        total_area = metrics['total_area_sqm'] or 1
        for lu in metrics['land_use_breakdown']:
            metrics['land_use_breakdown'][lu]['percentage'] = round(
                metrics['land_use_breakdown'][lu]['area_sqm'] / total_area * 100, 1
            )
        
        metrics['green_space_ratio'] = round(
            metrics['total_green_area_sqm'] / total_area * 100, 1
        ) if total_area > 0 else 0
        
        return metrics

    def calculate_service_scores(self) -> Dict:
        scores = {}
        
        education_types = ['school_primary', 'school_secondary', 'kindergarten']
        education_gaps = [self.service_calc.calculate_service_gap(ft) for ft in education_types]
        avg_gap_pct = sum(g.gap_percentage for g in education_gaps) / len(education_gaps)
        scores['education'] = max(0, 100 - avg_gap_pct)
        
        elderly_gap = self.service_calc.calculate_service_gap('elderly')
        scores['healthcare_elderly'] = max(0, 100 - elderly_gap.gap_percentage)
        
        park_coverage = self.service_calc.calculate_service_coverage('park')
        scores['green_space'] = park_coverage['coverage_percentage']
        
        market_gap = self.service_calc.calculate_service_gap('market')
        scores['commerce_market'] = max(0, 100 - market_gap.gap_percentage)
        
        bus_coverage = self.service_calc.calculate_service_coverage('bus_stop')
        scores['transportation'] = bus_coverage['coverage_percentage']
        
        cc_coverage = self.service_calc.calculate_service_coverage('community_center')
        scores['community_services'] = cc_coverage['coverage_percentage']
        
        total_score = sum(scores[k] * self.weights.get(k, 0.1) for k in scores)
        
        return {
            'category_scores': scores,
            'total_score': round(total_score, 1),
            'weights': self.weights
        }

    def generate_full_assessment(self) -> Dict:
        return {
            'parcel_metrics': self.calculate_parcel_metrics(),
            'service_scores': self.calculate_service_scores(),
            'service_gaps': [g.to_dict() for g in self.service_calc.calculate_all_gaps()],
            'conflicts': [c.to_dict() for c in self.conflict_checker.check_all_conflicts()]
        }
