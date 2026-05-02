import json
from dataclasses import dataclass
from typing import List, Dict, Optional
from pathlib import Path

from bend_checker.models.part import Part, Bend, Hole, BendDirection, HoleType
from bend_checker.models.die import Die, DieSet
from bend_checker.models.machine import Machine, MachineLibrary
from bend_checker.models.material import Material, MaterialLibrary


@dataclass
class JSONImportResult:
    success: bool
    type: str  
    count: int
    errors: List[str]
    warnings: List[str]


class JSONImporter:
    
    @staticmethod
    def import_dies(file_path: str) -> JSONImportResult:
        errors = []
        warnings = []
        die_set = DieSet()
        
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                return JSONImportResult(
                    success=False,
                    type='die',
                    count=0,
                    errors=[f"文件不存在: {file_path}"],
                    warnings=[]
                )
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if 'dies' in data:
                dies_data = data['dies']
            else:
                dies_data = [data] if isinstance(data, dict) else data
            
            for i, die_data in enumerate(dies_data):
                try:
                    die = JSONImporter._parse_die(die_data)
                    die_set.add_die(die)
                except Exception as e:
                    errors.append(f"模具 {i} 解析错误: {str(e)}")
        
        except Exception as e:
            errors.append(f"文件读取错误: {str(e)}")
            return JSONImportResult(
                success=False,
                type='die',
                count=0,
                errors=errors,
                warnings=[]
            )
        
        return JSONImportResult(
            success=len(errors) == 0,
            type='die',
            count=len(die_set.dies),
            errors=errors,
            warnings=warnings
        )
    
    @staticmethod
    def import_machines(file_path: str) -> JSONImportResult:
        errors = []
        warnings = []
        library = MachineLibrary()
        
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                return JSONImportResult(
                    success=False,
                    type='machine',
                    count=0,
                    errors=[f"文件不存在: {file_path}"],
                    warnings=[]
                )
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if 'machines' in data:
                machines_data = data['machines']
            else:
                machines_data = [data] if isinstance(data, dict) else data
            
            for machine_data in machines_data:
                try:
                    machine = JSONImporter._parse_machine(machine_data)
                    library.add_machine(machine)
                except Exception as e:
                    errors.append(f"设备解析错误: {str(e)}")
        
        except Exception as e:
            errors.append(f"文件读取错误: {str(e)}")
            return JSONImportResult(
                success=False,
                type='machine',
                count=0,
                errors=errors,
                warnings=[]
            )
        
        return JSONImportResult(
            success=len(errors) == 0,
            type='machine',
            count=len(library.machines),
            errors=errors,
            warnings=warnings
        )
    
    @staticmethod
    def import_materials(file_path: str) -> JSONImportResult:
        errors = []
        warnings = []
        library = MaterialLibrary()
        
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                return JSONImportResult(
                    success=False,
                    type='material',
                    count=0,
                    errors=[f"文件不存在: {file_path}"],
                    warnings=[]
                )
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if 'materials' in data:
                materials_data = data['materials']
            else:
                materials_data = [data] if isinstance(data, dict) else data
            
            for material_data in materials_data:
                try:
                    material = JSONImporter._parse_material(material_data)
                    library.add_material(material)
                except Exception as e:
                    errors.append(f"材料解析错误: {str(e)}")
        
        except Exception as e:
            errors.append(f"文件读取错误: {str(e)}")
            return JSONImportResult(
                success=False,
                type='material',
                count=0,
                errors=errors,
                warnings=[]
            )
        
        return JSONImportResult(
            success=len(errors) == 0,
            type='material',
            count=len(library.materials),
            errors=errors,
            warnings=warnings
        )
    
    @staticmethod
    def _parse_die(data: Dict) -> Die:
        return Die(
            id=data.get('id', data.get('die_id', '')),
            die_type=data.get('die_type', 'v_die'),
            v_width=data.get('v_width', data.get('vWidth', 0.0)),
            v_angle=data.get('v_angle', data.get('vAngle', 90.0)),
            punch_radius=data.get('punch_radius'),
            die_radius=data.get('die_radius'),
            min_thickness=data.get('min_thickness'),
            max_thickness=data.get('max_thickness'),
            min_bend_radius=data.get('min_bend_radius'),
            max_bend_radius=data.get('max_bend_radius'),
            min_bend_length=data.get('min_bend_length'),
            description=data.get('description')
        )
    
    @staticmethod
    def _parse_machine(data: Dict) -> Machine:
        return Machine(
            id=data.get('id', data.get('machine_id', '')),
            name=data.get('name', ''),
            machine_type=data.get('machine_type', 'hydraulic'),
            max_tonnage=data.get('max_tonnage', data.get('maxTonnage', 0.0)),
            bed_length=data.get('bed_length', data.get('bedLength', 0.0)),
            stroke=data.get('stroke', 0.0),
            daylight=data.get('daylight', 0.0),
            min_thickness=data.get('min_thickness'),
            max_thickness=data.get('max_thickness'),
            compatible_dies=data.get('compatible_dies', []),
            description=data.get('description')
        )
    
    @staticmethod
    def _parse_material(data: Dict) -> Material:
        return Material(
            name=data.get('name', ''),
            grade=data.get('grade', ''),
            thickness=data.get('thickness', 0.0),
            tensile_strength=data.get('tensile_strength', data.get('tensileStrength', 400.0)),
            k_factor=data.get('k_factor', data.get('kFactor', 0.33)),
            min_bend_radius=data.get('min_bend_radius', data.get('minBendRadius', 0.0)),
            description=data.get('description')
        )
    
    @staticmethod
    def export_dies(die_set: DieSet, file_path: str) -> bool:
        try:
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
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({'dies': dies_data}, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def export_machines(library: MachineLibrary, file_path: str) -> bool:
        try:
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
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({'machines': machines_data}, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def export_materials(library: MaterialLibrary, file_path: str) -> bool:
        try:
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
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({'materials': materials_data}, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def generate_die_template(file_path: str) -> bool:
        template = {
            "dies": [
                {
                    "id": "V8",
                    "die_type": "v_die",
                    "v_width": 8.0,
                    "v_angle": 90.0,
                    "punch_radius": 1.0,
                    "die_radius": 1.2,
                    "min_thickness": 0.8,
                    "max_thickness": 1.5,
                    "min_bend_radius": 1.0,
                    "max_bend_radius": 2.0,
                    "min_bend_length": 5.0,
                    "description": "V8 标准90°下模"
                }
            ]
        }
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(template, f, indent=2, ensure_ascii=False)
            return True
        except Exception:
            return False
    
    @staticmethod
    def generate_machine_template(file_path: str) -> bool:
        template = {
            "machines": [
                {
                    "id": "AMADA_RG80",
                    "name": "Amada RG-80",
                    "machine_type": "hydraulic",
                    "max_tonnage": 80.0,
                    "bed_length": 2500.0,
                    "stroke": 150.0,
                    "daylight": 400.0,
                    "min_thickness": 0.8,
                    "max_thickness": 4.0,
                    "compatible_dies": ["V6", "V8", "V12", "V16"],
                    "description": "80吨中型液压折弯机"
                }
            ]
        }
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(template, f, indent=2, ensure_ascii=False)
            return True
        except Exception:
            return False
    
    @staticmethod
    def generate_material_template(file_path: str) -> bool:
        template = {
            "materials": [
                {
                    "name": "冷轧钢板",
                    "grade": "SPCC",
                    "thickness": 1.5,
                    "tensile_strength": 270.0,
                    "k_factor": 0.35,
                    "min_bend_radius": 1.0,
                    "description": "常用冷轧钢板"
                }
            ]
        }
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(template, f, indent=2, ensure_ascii=False)
            return True
        except Exception:
            return False
