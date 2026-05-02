import os
import json
from dataclasses import dataclass, asdict, field
from typing import Dict, Optional, List
from pathlib import Path

from bend_checker.models.material import Material, MaterialLibrary
from bend_checker.models.machine import Machine, MachineLibrary
from bend_checker.models.die import Die, DieSet


@dataclass
class WorkshopConfig:
    workshop_name: str = "未命名车间"
    default_k_factor: float = 0.33
    safety_factor: float = 1.25
    default_bend_length: float = 100.0
    minimum_hole_distance_multiplier: float = 2.0
    material_library_path: Optional[str] = None
    machine_library_path: Optional[str] = None
    die_set_path: Optional[str] = None
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'WorkshopConfig':
        return cls(
            workshop_name=data.get('workshop_name', '未命名车间'),
            default_k_factor=data.get('default_k_factor', 0.33),
            safety_factor=data.get('safety_factor', 1.25),
            default_bend_length=data.get('default_bend_length', 100.0),
            minimum_hole_distance_multiplier=data.get('minimum_hole_distance_multiplier', 2.0),
            material_library_path=data.get('material_library_path'),
            machine_library_path=data.get('machine_library_path'),
            die_set_path=data.get('die_set_path'),
            notes=data.get('notes')
        )


class ConfigManager:
    
    CONFIG_FILE_NAME = "workshop_config.json"
    MATERIALS_FILE = "materials.json"
    MACHINES_FILE = "machines.json"
    DIES_FILE = "dies.json"
    
    def __init__(self, config_dir: Optional[str] = None):
        if config_dir is None:
            config_dir = os.getcwd()
        self.config_dir = Path(config_dir)
        self.config_file = self.config_dir / self.CONFIG_FILE_NAME
        self.materials_file = self.config_dir / self.MATERIALS_FILE
        self.machines_file = self.config_dir / self.MACHINES_FILE
        self.dies_file = self.config_dir / self.DIES_FILE
    
    def init_workshop(self, workshop_name: str = "默认车间") -> WorkshopConfig:
        config = WorkshopConfig(
            workshop_name=workshop_name,
            default_k_factor=0.33,
            safety_factor=1.25,
            default_bend_length=100.0,
            minimum_hole_distance_multiplier=2.0,
            material_library_path=str(self.materials_file),
            machine_library_path=str(self.machines_file),
            die_set_path=str(self.dies_file)
        )
        
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        self._save_config(config)
        
        material_lib = MaterialLibrary.create_default_library()
        self._save_materials(material_lib)
        
        machine_lib = MachineLibrary.create_default_library()
        self._save_machines(machine_lib)
        
        die_set = DieSet.create_default_die_set()
        self._save_dies(die_set)
        
        return config
    
    def load_config(self) -> WorkshopConfig:
        if not self.config_file.exists():
            return WorkshopConfig()
        
        with open(self.config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return WorkshopConfig.from_dict(data)
    
    def update_config(self, config: WorkshopConfig) -> None:
        self._save_config(config)
    
    def load_material_library(self) -> MaterialLibrary:
        if not self.materials_file.exists():
            return MaterialLibrary.create_default_library()
        
        with open(self.materials_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        library = MaterialLibrary()
        for mat_data in data.get('materials', []):
            material = Material(
                name=mat_data.get('name', ''),
                grade=mat_data.get('grade', ''),
                thickness=mat_data.get('thickness', 0.0),
                tensile_strength=mat_data.get('tensile_strength', 400.0),
                k_factor=mat_data.get('k_factor', 0.33),
                min_bend_radius=mat_data.get('min_bend_radius', 0.0),
                description=mat_data.get('description')
            )
            library.add_material(material)
        
        return library
    
    def save_material_library(self, library: MaterialLibrary) -> None:
        self._save_materials(library)
    
    def load_machine_library(self) -> MachineLibrary:
        if not self.machines_file.exists():
            return MachineLibrary.create_default_library()
        
        with open(self.machines_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        library = MachineLibrary()
        for machine_data in data.get('machines', []):
            machine = Machine(
                id=machine_data.get('id', ''),
                name=machine_data.get('name', ''),
                machine_type=machine_data.get('machine_type', 'hydraulic'),
                max_tonnage=machine_data.get('max_tonnage', 0.0),
                bed_length=machine_data.get('bed_length', 0.0),
                stroke=machine_data.get('stroke', 0.0),
                daylight=machine_data.get('daylight', 0.0),
                min_thickness=machine_data.get('min_thickness'),
                max_thickness=machine_data.get('max_thickness'),
                compatible_dies=machine_data.get('compatible_dies', []),
                description=machine_data.get('description')
            )
            library.add_machine(machine)
        
        return library
    
    def save_machine_library(self, library: MachineLibrary) -> None:
        self._save_machines(library)
    
    def load_die_set(self) -> DieSet:
        if not self.dies_file.exists():
            return DieSet.create_default_die_set()
        
        with open(self.dies_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        die_set = DieSet()
        for die_data in data.get('dies', []):
            die = Die(
                id=die_data.get('id', ''),
                die_type=die_data.get('die_type', 'v_die'),
                v_width=die_data.get('v_width', 0.0),
                v_angle=die_data.get('v_angle', 90.0),
                punch_radius=die_data.get('punch_radius'),
                die_radius=die_data.get('die_radius'),
                min_thickness=die_data.get('min_thickness'),
                max_thickness=die_data.get('max_thickness'),
                min_bend_radius=die_data.get('min_bend_radius'),
                max_bend_radius=die_data.get('max_bend_radius'),
                min_bend_length=die_data.get('min_bend_length'),
                description=die_data.get('description')
            )
            die_set.add_die(die)
        
        return die_set
    
    def save_die_set(self, die_set: DieSet) -> None:
        self._save_dies(die_set)
    
    def is_initialized(self) -> bool:
        return self.config_file.exists()
    
    def get_workshop_info(self) -> Dict:
        config = self.load_config()
        
        if self.is_initialized():
            materials = self.load_material_library()
            machines = self.load_machine_library()
            dies = self.load_die_set()
            num_materials = len(materials.materials)
            num_machines = len(machines.machines)
            num_dies = len(dies.dies)
        else:
            num_materials = 0
            num_machines = 0
            num_dies = 0
        
        return {
            'workshop_name': config.workshop_name,
            'config_file': str(self.config_file),
            'num_materials': num_materials,
            'num_machines': num_machines,
            'num_dies': num_dies,
            'default_k_factor': config.default_k_factor,
            'safety_factor': config.safety_factor
        }
    
    def _save_config(self, config: WorkshopConfig) -> None:
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config.to_dict(), f, indent=2, ensure_ascii=False)
    
    def _save_materials(self, library: MaterialLibrary) -> None:
        materials_data = []
        for material in library.materials.values():
            materials_data.append({
                'name': material.name,
                'grade': material.grade,
                'thickness': material.thickness,
                'tensile_strength': material.tensile_strength,
                'k_factor': material.k_factor,
                'min_bend_radius': material.min_bend_radius,
                'description': material.description
            })
        
        with open(self.materials_file, 'w', encoding='utf-8') as f:
            json.dump({'materials': materials_data}, f, indent=2, ensure_ascii=False)
    
    def _save_machines(self, library: MachineLibrary) -> None:
        machines_data = []
        for machine in library.machines.values():
            machines_data.append({
                'id': machine.id,
                'name': machine.name,
                'machine_type': machine.machine_type,
                'max_tonnage': machine.max_tonnage,
                'bed_length': machine.bed_length,
                'stroke': machine.stroke,
                'daylight': machine.daylight,
                'min_thickness': machine.min_thickness,
                'max_thickness': machine.max_thickness,
                'compatible_dies': machine.compatible_dies,
                'description': machine.description
            })
        
        with open(self.machines_file, 'w', encoding='utf-8') as f:
            json.dump({'machines': machines_data}, f, indent=2, ensure_ascii=False)
    
    def _save_dies(self, die_set: DieSet) -> None:
        dies_data = []
        for die in die_set.dies.values():
            dies_data.append({
                'id': die.id,
                'die_type': die.die_type,
                'v_width': die.v_width,
                'v_angle': die.v_angle,
                'punch_radius': die.punch_radius,
                'die_radius': die.die_radius,
                'min_thickness': die.min_thickness,
                'max_thickness': die.max_thickness,
                'min_bend_radius': die.min_bend_radius,
                'max_bend_radius': die.max_bend_radius,
                'min_bend_length': die.min_bend_length,
                'description': die.description
            })
        
        with open(self.dies_file, 'w', encoding='utf-8') as f:
            json.dump({'dies': dies_data}, f, indent=2, ensure_ascii=False)
