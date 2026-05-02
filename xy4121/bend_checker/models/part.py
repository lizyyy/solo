from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum


class BendDirection(Enum):
    UP = "up"
    DOWN = "down"


class HoleType(Enum):
    CIRCULAR = "circular"
    RECTANGULAR = "rectangular"
    SLOTTED = "slotted"


@dataclass
class Bend:
    id: str
    bend_angle: float
    bend_radius: float
    flange_length: float  
    inside_length: float  
    direction: BendDirection = BendDirection.UP
    k_factor_override: Optional[float] = None
    die_v_width: Optional[float] = None
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'bend_angle': self.bend_angle,
            'bend_radius': self.bend_radius,
            'flange_length': self.flange_length,
            'inside_length': self.inside_length,
            'direction': self.direction.value,
            'k_factor_override': self.k_factor_override,
            'die_v_width': self.die_v_width,
            'notes': self.notes
        }


@dataclass
class Hole:
    id: str
    hole_type: HoleType
    diameter: Optional[float] = None  
    width: Optional[float] = None  
    height: Optional[float] = None  
    x_position: float = 0.0
    y_position: float = 0.0
    distance_to_nearest_bend: Optional[float] = None
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'hole_type': self.hole_type.value,
            'diameter': self.diameter,
            'width': self.width,
            'height': self.height,
            'x_position': self.x_position,
            'y_position': self.y_position,
            'distance_to_nearest_bend': self.distance_to_nearest_bend,
            'notes': self.notes
        }


@dataclass
class Part:
    part_number: str
    part_name: str
    material_grade: str
    material_thickness: float
    quantity: int = 1
    
    overall_length: float = 0.0
    overall_width: float = 0.0
    
    bends: List[Bend] = field(default_factory=list)
    holes: List[Hole] = field(default_factory=list)
    
    unfolded_length: Optional[float] = None
    unfolded_width: Optional[float] = None
    
    bend_sequence: List[str] = field(default_factory=list)
    
    calculated_tonnage: Optional[float] = None
    recommended_machine: Optional[str] = None
    recommended_die: Optional[str] = None
    
    issues: List[Dict] = field(default_factory=list)
    warnings: List[Dict] = field(default_factory=list)
    
    notes: Optional[str] = None
    
    def add_bend(self, bend: Bend) -> None:
        self.bends.append(bend)
    
    def add_hole(self, hole: Hole) -> None:
        self.holes.append(hole)
    
    def get_bend_by_id(self, bend_id: str) -> Optional[Bend]:
        for bend in self.bends:
            if bend.id == bend_id:
                return bend
        return None
    
    def get_unique_identifier(self) -> str:
        bend_specs = sorted([
            (b.bend_angle, b.bend_radius, b.flange_length, b.direction.value)
            for b in self.bends
        ])
        hole_specs = sorted([
            (h.hole_type.value, h.diameter or h.width, h.height, h.x_position, h.y_position)
            for h in self.holes
        ])
        return f"{self.material_grade}_{self.material_thickness}_{str(bend_specs)}_{str(hole_specs)}"
    
    def to_dict(self) -> Dict:
        return {
            'part_number': self.part_number,
            'part_name': self.part_name,
            'material_grade': self.material_grade,
            'material_thickness': self.material_thickness,
            'quantity': self.quantity,
            'overall_length': self.overall_length,
            'overall_width': self.overall_width,
            'bends': [b.to_dict() for b in self.bends],
            'holes': [h.to_dict() for h in self.holes],
            'unfolded_length': self.unfolded_length,
            'unfolded_width': self.unfolded_width,
            'bend_sequence': self.bend_sequence,
            'calculated_tonnage': self.calculated_tonnage,
            'recommended_machine': self.recommended_machine,
            'recommended_die': self.recommended_die,
            'issues': self.issues,
            'warnings': self.warnings,
            'notes': self.notes
        }
