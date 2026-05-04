import json
import csv
import math
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union
import config


@dataclass
class Parcel:
    id: str
    name: str
    land_use: str
    area_sqm: float
    current_far: float
    plan_far: float
    max_far: float
    building_area: float = 0.0
    residential_units: int = 0
    existing_population: int = 0
    age_distribution: str = ""
    building_age: str = ""
    height_limit: float = 0.0
    density_limit: float = 0.0
    geometry: Any = None
    estimated_population: int = 0
    calculated_building_area: float = 0.0
    modified: bool = False
    modifications: Dict[str, Any] = field(default_factory=dict)

    def calculate_metrics(self, far_type: str = 'plan'):
        if far_type == 'current':
            far = self.current_far
        elif far_type == 'plan':
            far = self.plan_far
        else:
            far = self.max_far
        
        self.calculated_building_area = self.area_sqm * far
        
        if self.land_use in ['R', 'R2', 'R3']:
            pop_per_ha = config.POPULATION_DENSITY.get(self.land_use, 80)
            area_ha = self.area_sqm / 10000.0
            self.estimated_population = int(area_ha * pop_per_ha * 10)
        else:
            self.estimated_population = 0

    def to_dict(self) -> Dict:
        data = asdict(self)
        if self.geometry:
            if hasattr(self.geometry, '__geo_interface__'):
                data['geometry'] = self.geometry.__geo_interface__
            elif isinstance(self.geometry, dict):
                data['geometry'] = self.geometry
        return data

    @classmethod
    def from_geojson_feature(cls, feature: Dict) -> 'Parcel':
        props = feature.get('properties', {})
        geom = feature.get('geometry')
        if geom:
            try:
                geom_obj = shape(geom)
            except Exception:
                geom_obj = geom
        else:
            geom_obj = None
        
        return cls(
            id=props.get('id', ''),
            name=props.get('name', ''),
            land_use=props.get('land_use', ''),
            area_sqm=float(props.get('area_sqm', 0)),
            current_far=float(props.get('current_far', 0)),
            plan_far=float(props.get('plan_far', 0)),
            max_far=float(props.get('max_far', 0)),
            building_area=float(props.get('building_area', 0)),
            residential_units=int(props.get('residential_units', 0)),
            existing_population=int(props.get('existing_population', 0)),
            age_distribution=props.get('age_distribution', ''),
            building_age=props.get('building_age', ''),
            height_limit=float(props.get('height_limit', 0)),
            density_limit=float(props.get('density_limit', 0)),
            geometry=geom_obj
        )


@dataclass
class Facility:
    id: str
    name: str
    type: str
    lon: float
    lat: float
    capacity: float
    status: str
    description: str = ""
    geometry: Any = None

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_csv_row(cls, row: Dict) -> 'Facility':
        point = Point(float(row['lon']), float(row['lat']))
        return cls(
            id=row['id'],
            name=row['name'],
            type=row['type'],
            lon=float(row['lon']),
            lat=float(row['lat']),
            capacity=float(row['capacity']) if row.get('capacity') else 0,
            status=row.get('status', 'active'),
            description=row.get('description', ''),
            geometry=point
        )


@dataclass
class PopulationData:
    parcel_id: str
    total_population: int
    age_0_17: int
    age_18_64: int
    age_65_plus: int
    male: int
    female: int
    households: int
    avg_household_size: float

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_csv_row(cls, row: Dict) -> 'PopulationData':
        return cls(
            parcel_id=row['parcel_id'],
            total_population=int(row['total_population']),
            age_0_17=int(row['age_0_17']),
            age_18_64=int(row['age_18_64']),
            age_65_plus=int(row['age_65_plus']),
            male=int(row['male']),
            female=int(row['female']),
            households=int(row['households']),
            avg_household_size=float(row['avg_household_size'])
        )


@dataclass
class ServiceGap:
    facility_type: str
    facility_name: str
    radius_meters: int
    demand: float
    supply: float
    gap: float
    gap_percentage: float
    severity: str
    affected_parcels: List[str]
    affected_population: int

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ConflictIssue:
    type: str
    severity: str
    description: str
    location: str
    parcel_id: Optional[str]
    current_value: Any
    limit_value: Any
    recommendation: str

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class Scheme:
    id: str
    name: str
    description: str
    created_at: str
    updated_at: str
    parcels: List[Dict]
    facilities: List[Dict]
    base_scheme_id: Optional[str]
    assessments: Dict = field(default_factory=dict)
    notes: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def create_new(cls, name: str, description: str = "") -> 'Scheme':
        now = datetime.now().isoformat()
        return cls(
            id=f"scheme_{int(datetime.now().timestamp())}",
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
            parcels=[],
            facilities=[],
            base_scheme_id=None
        )
