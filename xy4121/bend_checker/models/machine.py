from dataclasses import dataclass, field
from typing import Dict, Optional, List


@dataclass
class Machine:
    id: str
    name: str
    machine_type: str  
    max_tonnage: float  
    bed_length: float  
    stroke: float  
    daylight: float  
    min_thickness: Optional[float] = None
    max_thickness: Optional[float] = None
    compatible_dies: List[str] = field(default_factory=list)
    description: Optional[str] = None
    
    def can_handle_tonnage(self, tonnage: float) -> bool:
        return tonnage <= self.max_tonnage * 0.8  
    
    def can_handle_length(self, bend_length: float) -> bool:
        return bend_length <= self.bed_length
    
    def is_suitable_for(self, tonnage: float, bend_length: float) -> bool:
        return self.can_handle_tonnage(tonnage) and self.can_handle_length(bend_length)
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'name': self.name,
            'machine_type': self.machine_type,
            'max_tonnage': self.max_tonnage,
            'bed_length': self.bed_length,
            'stroke': self.stroke,
            'daylight': self.daylight,
            'min_thickness': self.min_thickness,
            'max_thickness': self.max_thickness,
            'compatible_dies': self.compatible_dies,
            'description': self.description
        }


@dataclass
class MachineLibrary:
    machines: Dict[str, Machine] = field(default_factory=dict)
    
    def add_machine(self, machine: Machine) -> None:
        self.machines[machine.id] = machine
    
    def get_machine(self, machine_id: str) -> Optional[Machine]:
        return self.machines.get(machine_id)
    
    def find_suitable_machines(self, 
                                tonnage: float, 
                                bend_length: float = 0.0) -> List[Machine]:
        suitable = []
        for machine in self.machines.values():
            if machine.is_suitable_for(tonnage, bend_length):
                suitable.append(machine)
        
        suitable.sort(key=lambda m: m.max_tonnage)
        return suitable
    
    def get_machines_by_type(self, machine_type: str) -> List[Machine]:
        return [m for m in self.machines.values() 
                if m.machine_type.lower() == machine_type.lower()]
    
    def get_all_machine_ids(self) -> List[str]:
        return list(self.machines.keys())
    
    def get_max_tonnage_available(self) -> float:
        if not self.machines:
            return 0.0
        return max(m.max_tonnage for m in self.machines.values())
    
    @classmethod
    def create_default_library(cls) -> 'MachineLibrary':
        library = cls()
        
        default_machines = [
            Machine(
                id="AMADA_RG35",
                name="Amada RG-35",
                machine_type="hydraulic",
                max_tonnage=35.0,
                bed_length=1250.0,
                stroke=100.0,
                daylight=300.0,
                min_thickness=0.5,
                max_thickness=3.0,
                compatible_dies=["V4", "V6", "V8", "V12", "V8_120"],
                description="35吨小型液压折弯机，适用于薄板和小零件"
            ),
            Machine(
                id="AMADA_RG80",
                name="Amada RG-80",
                machine_type="hydraulic",
                max_tonnage=80.0,
                bed_length=2500.0,
                stroke=150.0,
                daylight=400.0,
                min_thickness=0.8,
                max_thickness=4.0,
                compatible_dies=["V6", "V8", "V12", "V16", "V20", "V8_120", "V12_120"],
                description="80吨中型液压折弯机，适用于中厚板和中等尺寸零件"
            ),
            Machine(
                id="AMADA_RG100",
                name="Amada RG-100",
                machine_type="hydraulic",
                max_tonnage=100.0,
                bed_length=3000.0,
                stroke=200.0,
                daylight=450.0,
                min_thickness=1.0,
                max_thickness=6.0,
                compatible_dies=["V8", "V12", "V16", "V20", "V12_120"],
                description="100吨大型液压折弯机，适用于厚板和大尺寸零件"
            ),
            Machine(
                id="YANGLI_63",
                name="Yangli WC67Y-63",
                machine_type="hydraulic",
                max_tonnage=63.0,
                bed_length=2500.0,
                stroke=120.0,
                daylight=350.0,
                min_thickness=0.8,
                max_thickness=4.0,
                compatible_dies=["V6", "V8", "V12", "V16", "V8_120"],
                description="国产63吨液压折弯机"
            ),
        ]
        
        for machine in default_machines:
            library.add_machine(machine)
        
        return library
