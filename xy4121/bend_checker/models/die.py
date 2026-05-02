from dataclasses import dataclass, field
from typing import Dict, Optional, List


@dataclass
class Die:
    id: str
    die_type: str  
    v_width: float  
    v_angle: float = 90.0  
    punch_radius: Optional[float] = None
    die_radius: Optional[float] = None
    min_thickness: Optional[float] = None
    max_thickness: Optional[float] = None
    min_bend_radius: Optional[float] = None
    max_bend_radius: Optional[float] = None
    min_bend_length: Optional[float] = None
    description: Optional[str] = None
    
    def is_suitable_for(self, 
                        material_thickness: float, 
                        bend_radius: float,
                        bend_angle: float) -> bool:
        if self.min_thickness and material_thickness < self.min_thickness:
            return False
        if self.max_thickness and material_thickness > self.max_thickness:
            return False
        if self.min_bend_radius and bend_radius < self.min_bend_radius:
            return False
        if self.max_bend_radius and bend_radius > self.max_bend_radius:
            return False
        
        if self.die_type == 'v_die':
            recommended_v_width = material_thickness * 8
            if self.v_width < recommended_v_width * 0.8 or self.v_width > recommended_v_width * 1.2:
                return False
        
        return True
    
    def calculate_recommended_thickness_range(self) -> tuple:
        min_t = self.v_width / 12
        max_t = self.v_width / 6
        return (min_t, max_t)
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'die_type': self.die_type,
            'v_width': self.v_width,
            'v_angle': self.v_angle,
            'punch_radius': self.punch_radius,
            'die_radius': self.die_radius,
            'min_thickness': self.min_thickness,
            'max_thickness': self.max_thickness,
            'min_bend_radius': self.min_bend_radius,
            'max_bend_radius': self.max_bend_radius,
            'min_bend_length': self.min_bend_length,
            'description': self.description
        }


@dataclass
class DieSet:
    dies: Dict[str, Die] = field(default_factory=dict)
    
    def add_die(self, die: Die) -> None:
        self.dies[die.id] = die
    
    def get_die(self, die_id: str) -> Optional[Die]:
        return self.dies.get(die_id)
    
    def find_suitable_dies(self, 
                           material_thickness: float, 
                           bend_radius: float,
                           bend_angle: float = 90.0) -> List[Die]:
        suitable = []
        for die in self.dies.values():
            if die.is_suitable_for(material_thickness, bend_radius, bend_angle):
                suitable.append(die)
        
        suitable.sort(key=lambda d: abs(d.v_width - material_thickness * 8))
        return suitable
    
    def get_dies_by_v_width(self, min_v: float, max_v: float) -> List[Die]:
        return [d for d in self.dies.values() 
                if min_v <= d.v_width <= max_v]
    
    def get_all_die_ids(self) -> List[str]:
        return list(self.dies.keys())
    
    @classmethod
    def create_default_die_set(cls) -> 'DieSet':
        die_set = cls()
        
        default_dies = [
            Die(
                id="V4",
                die_type="v_die",
                v_width=4.0,
                v_angle=90.0,
                punch_radius=0.5,
                die_radius=0.8,
                min_thickness=0.5,
                max_thickness=0.8,
                min_bend_radius=0.5,
                max_bend_radius=1.0,
                min_bend_length=3.0,
                description="V4 标准90°下模，适用于薄板"
            ),
            Die(
                id="V6",
                die_type="v_die",
                v_width=6.0,
                v_angle=90.0,
                punch_radius=0.8,
                die_radius=1.0,
                min_thickness=0.6,
                max_thickness=1.0,
                min_bend_radius=0.8,
                max_bend_radius=1.5,
                min_bend_length=4.0,
                description="V6 标准90°下模"
            ),
            Die(
                id="V8",
                die_type="v_die",
                v_width=8.0,
                v_angle=90.0,
                punch_radius=1.0,
                die_radius=1.2,
                min_thickness=0.8,
                max_thickness=1.5,
                min_bend_radius=1.0,
                max_bend_radius=2.0,
                min_bend_length=5.0,
                description="V8 标准90°下模，适用于1.0-1.5mm板厚"
            ),
            Die(
                id="V12",
                die_type="v_die",
                v_width=12.0,
                v_angle=90.0,
                punch_radius=1.5,
                die_radius=2.0,
                min_thickness=1.2,
                max_thickness=2.0,
                min_bend_radius=1.5,
                max_bend_radius=3.0,
                min_bend_length=7.0,
                description="V12 标准90°下模，适用于1.5-2.0mm板厚"
            ),
            Die(
                id="V16",
                die_type="v_die",
                v_width=16.0,
                v_angle=90.0,
                punch_radius=2.0,
                die_radius=2.5,
                min_thickness=1.5,
                max_thickness=3.0,
                min_bend_radius=2.0,
                max_bend_radius=4.0,
                min_bend_length=9.0,
                description="V16 标准90°下模，适用于2.0-3.0mm板厚"
            ),
            Die(
                id="V20",
                die_type="v_die",
                v_width=20.0,
                v_angle=90.0,
                punch_radius=2.5,
                die_radius=3.0,
                min_thickness=2.0,
                max_thickness=4.0,
                min_bend_radius=2.5,
                max_bend_radius=5.0,
                min_bend_length=11.0,
                description="V20 标准90°下模，适用于3.0-4.0mm板厚"
            ),
            Die(
                id="V8_120",
                die_type="v_die",
                v_width=8.0,
                v_angle=120.0,
                punch_radius=1.0,
                die_radius=1.2,
                min_thickness=0.8,
                max_thickness=1.5,
                min_bend_radius=1.0,
                max_bend_radius=2.0,
                min_bend_length=5.0,
                description="V8 120°下模，适用于大角度折弯"
            ),
            Die(
                id="V12_120",
                die_type="v_die",
                v_width=12.0,
                v_angle=120.0,
                punch_radius=1.5,
                die_radius=2.0,
                min_thickness=1.2,
                max_thickness=2.0,
                min_bend_radius=1.5,
                max_bend_radius=3.0,
                min_bend_length=7.0,
                description="V12 120°下模"
            ),
        ]
        
        for die in default_dies:
            die_set.add_die(die)
        
        return die_set
