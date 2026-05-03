import os
import json
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, TypeVar, Type, Any
from decimal import Decimal
import shutil

from colorproof_checker.models import (
    ProofTask, ColorMeasurement, InkFormula, PaperBatch,
    DryingRecord, CustomerTolerance, WorkspaceState,
    ProofStatus, RiskLevel
)

T = TypeVar('T')


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        if isinstance(obj, ProofStatus):
            return obj.value
        if isinstance(obj, RiskLevel):
            return obj.value
        return super().default(obj)


class DecimalDecoder(json.JSONDecoder):
    def __init__(self, *args, **kwargs):
        super().__init__(object_hook=self.object_hook, *args, **kwargs)
    
    def object_hook(self, obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, str):
                    try:
                        if '.' in value or '-' in value:
                            obj[key] = Decimal(value)
                    except:
                        pass
        return obj


def parse_decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def parse_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


class WorkspaceManager:
    def __init__(self, workspace_path: Optional[str] = None):
        if workspace_path is None:
            workspace_path = os.getcwd()
        self.workspace_path = Path(workspace_path).absolute()
        self.config_dir = self.workspace_path / ".colorproof"
        self.data_dir = self.config_dir / "data"
        self.imports_dir = self.config_dir / "imports"
        self.exports_dir = self.config_dir / "exports"
        self.state_file = self.config_dir / "state.json"
        
        self._ensure_dirs()
    
    def _ensure_dirs(self) -> None:
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.imports_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)
    
    def is_initialized(self) -> bool:
        return self.config_dir.exists() and self.state_file.exists()
    
    def initialize(self) -> WorkspaceState:
        self._ensure_dirs()
        
        state = WorkspaceState(
            workspace_path=str(self.workspace_path),
            last_updated=datetime.now()
        )
        
        self._save_state(state)
        return state
    
    def get_state(self) -> WorkspaceState:
        if not self.state_file.exists():
            return self.initialize()
        
        with open(self.state_file, 'r', encoding='utf-8') as f:
            data = json.load(f, cls=DecimalDecoder)
        
        return WorkspaceState(
            workspace_path=data.get('workspace_path', str(self.workspace_path)),
            last_updated=parse_datetime(data.get('last_updated')) or datetime.now(),
            active_proof_ids=data.get('active_proof_ids', []),
            import_snapshots=data.get('import_snapshots', []),
            release_history=data.get('release_history', [])
        )
    
    def _save_state(self, state: WorkspaceState) -> None:
        state.last_updated = datetime.now()
        data = {
            'workspace_path': state.workspace_path,
            'last_updated': state.last_updated,
            'active_proof_ids': state.active_proof_ids,
            'import_snapshots': state.import_snapshots,
            'release_history': state.release_history
        }
        
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DecimalEncoder, indent=2, ensure_ascii=False)
    
    def update_state(self, **kwargs) -> None:
        state = self.get_state()
        for key, value in kwargs.items():
            if hasattr(state, key):
                setattr(state, key, value)
        self._save_state(state)


class DataStore:
    def __init__(self, workspace: WorkspaceManager):
        self.workspace = workspace
        self.data_dir = workspace.data_dir
        
        self.proofs_dir = self.data_dir / "proofs"
        self.measurements_dir = self.data_dir / "measurements"
        self.formulas_dir = self.data_dir / "formulas"
        self.paper_batches_dir = self.data_dir / "paper_batches"
        self.drying_records_dir = self.data_dir / "drying_records"
        self.tolerances_dir = self.data_dir / "tolerances"
        
        self._ensure_dirs()
    
    def _ensure_dirs(self) -> None:
        self.proofs_dir.mkdir(parents=True, exist_ok=True)
        self.measurements_dir.mkdir(parents=True, exist_ok=True)
        self.formulas_dir.mkdir(parents=True, exist_ok=True)
        self.paper_batches_dir.mkdir(parents=True, exist_ok=True)
        self.drying_records_dir.mkdir(parents=True, exist_ok=True)
        self.tolerances_dir.mkdir(parents=True, exist_ok=True)
    
    def _save_json(self, filepath: Path, data: Dict[str, Any]) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DecimalEncoder, indent=2, ensure_ascii=False)
    
    def _load_json(self, filepath: Path) -> Dict[str, Any]:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f, cls=DecimalDecoder)
    
    def generate_id(self) -> str:
        return uuid.uuid4().hex[:12]
    
    def save_proof_task(self, proof: ProofTask) -> str:
        if not proof.id:
            proof.id = self.generate_id()
        
        filepath = self.proofs_dir / f"{proof.id}.json"
        
        data = {
            'id': proof.id,
            'task_number': proof.task_number,
            'customer_id': proof.customer_id,
            'customer_name': proof.customer_name,
            'color_code': proof.color_code,
            'color_name': proof.color_name,
            'paper_batch_number': proof.paper_batch_number,
            'ink_formula_id': proof.ink_formula_id,
            'create_time': proof.create_time,
            'status': proof.status,
            'color_measurement_id': proof.color_measurement_id,
            'drying_record_id': proof.drying_record_id,
            'check_results': proof.check_results,
            'risk_level': proof.risk_level,
            'risks': proof.risks,
            'release_time': proof.release_time,
            'released_by': proof.released_by,
            'rollback_time': proof.rollback_time,
            'rolled_back_by': proof.rolled_back_by,
            'rollback_reason': proof.rollback_reason,
            'notes': proof.notes,
            'metadata': proof.metadata
        }
        
        self._save_json(filepath, data)
        
        state = self.workspace.get_state()
        if proof.id not in state.active_proof_ids:
            state.active_proof_ids.append(proof.id)
            self.workspace._save_state(state)
        
        return proof.id
    
    def get_proof_task(self, proof_id: str) -> Optional[ProofTask]:
        filepath = self.proofs_dir / f"{proof_id}.json"
        if not filepath.exists():
            return None
        
        data = self._load_json(filepath)
        
        status = ProofStatus(data['status']) if data.get('status') else ProofStatus.PENDING
        risk_level = RiskLevel(data['risk_level']) if data.get('risk_level') else RiskLevel.SAFE
        
        return ProofTask(
            id=data['id'],
            task_number=data['task_number'],
            customer_id=data['customer_id'],
            customer_name=data['customer_name'],
            color_code=data['color_code'],
            color_name=data['color_name'],
            paper_batch_number=data['paper_batch_number'],
            ink_formula_id=data['ink_formula_id'],
            create_time=parse_datetime(data.get('create_time')) or datetime.now(),
            status=status,
            color_measurement_id=data.get('color_measurement_id'),
            drying_record_id=data.get('drying_record_id'),
            check_results=data.get('check_results', {}),
            risk_level=risk_level,
            risks=data.get('risks', []),
            release_time=parse_datetime(data.get('release_time')),
            released_by=data.get('released_by'),
            rollback_time=parse_datetime(data.get('rollback_time')),
            rolled_back_by=data.get('rolled_back_by'),
            rollback_reason=data.get('rollback_reason'),
            notes=data.get('notes'),
            metadata=data.get('metadata', {})
        )
    
    def list_proof_tasks(self) -> List[ProofTask]:
        proofs = []
        for filepath in self.proofs_dir.glob("*.json"):
            proof = self.get_proof_task(filepath.stem)
            if proof:
                proofs.append(proof)
        return proofs
    
    def save_color_measurement(self, measurement: ColorMeasurement) -> str:
        if not measurement.id:
            measurement.id = self.generate_id()
        
        filepath = self.measurements_dir / f"{measurement.id}.json"
        
        data = {
            'id': measurement.id,
            'sample_name': measurement.sample_name,
            'batch_number': measurement.batch_number,
            'color_code': measurement.color_code,
            'delta_e': measurement.delta_e,
            'delta_l': measurement.delta_l,
            'delta_a': measurement.delta_a,
            'delta_b': measurement.delta_b,
            'delta_c': measurement.delta_c,
            'delta_h': measurement.delta_h,
            'lab_l': measurement.lab_l,
            'lab_a': measurement.lab_a,
            'lab_b': measurement.lab_b,
            'measurement_date': measurement.measurement_date,
            'notes': measurement.notes
        }
        
        self._save_json(filepath, data)
        return measurement.id
    
    def get_color_measurement(self, measurement_id: str) -> Optional[ColorMeasurement]:
        filepath = self.measurements_dir / f"{measurement_id}.json"
        if not filepath.exists():
            return None
        
        data = self._load_json(filepath)
        
        return ColorMeasurement(
            id=data['id'],
            sample_name=data['sample_name'],
            batch_number=data['batch_number'],
            color_code=data['color_code'],
            delta_e=parse_decimal(data.get('delta_e')),
            delta_l=parse_decimal(data.get('delta_l')) if data.get('delta_l') else None,
            delta_a=parse_decimal(data.get('delta_a')) if data.get('delta_a') else None,
            delta_b=parse_decimal(data.get('delta_b')) if data.get('delta_b') else None,
            delta_c=parse_decimal(data.get('delta_c')) if data.get('delta_c') else None,
            delta_h=parse_decimal(data.get('delta_h')) if data.get('delta_h') else None,
            lab_l=parse_decimal(data.get('lab_l')) if data.get('lab_l') else None,
            lab_a=parse_decimal(data.get('lab_a')) if data.get('lab_a') else None,
            lab_b=parse_decimal(data.get('lab_b')) if data.get('lab_b') else None,
            measurement_date=parse_datetime(data.get('measurement_date')),
            notes=data.get('notes')
        )
    
    def save_ink_formula(self, formula: InkFormula) -> str:
        if not formula.id:
            formula.id = self.generate_id()
        
        filepath = self.formulas_dir / f"{formula.id}.json"
        
        data = {
            'id': formula.id,
            'color_code': formula.color_code,
            'color_name': formula.color_name,
            'customer_id': formula.customer_id,
            'customer_name': formula.customer_name,
            'pantone_code': formula.pantone_code,
            'base_inks': formula.base_inks,
            'total_weight': formula.total_weight,
            'viscosity': formula.viscosity,
            'ph_value': formula.ph_value,
            'create_date': formula.create_date,
            'notes': formula.notes
        }
        
        self._save_json(filepath, data)
        return formula.id
    
    def get_ink_formula(self, formula_id: str) -> Optional[InkFormula]:
        filepath = self.formulas_dir / f"{formula_id}.json"
        if not filepath.exists():
            return None
        
        data = self._load_json(filepath)
        
        base_inks = {}
        for k, v in data.get('base_inks', {}).items():
            base_inks[k] = parse_decimal(v)
        
        return InkFormula(
            id=data['id'],
            color_code=data['color_code'],
            color_name=data['color_name'],
            customer_id=data['customer_id'],
            customer_name=data['customer_name'],
            pantone_code=data.get('pantone_code'),
            base_inks=base_inks,
            total_weight=parse_decimal(data.get('total_weight', '100')),
            viscosity=parse_decimal(data.get('viscosity')) if data.get('viscosity') else None,
            ph_value=parse_decimal(data.get('ph_value')) if data.get('ph_value') else None,
            create_date=parse_date(data.get('create_date')),
            notes=data.get('notes')
        )
    
    def list_ink_formulas(self) -> List[InkFormula]:
        formulas = []
        for filepath in self.formulas_dir.glob("*.json"):
            formula = self.get_ink_formula(filepath.stem)
            if formula:
                formulas.append(formula)
        return formulas
    
    def save_paper_batch(self, batch: PaperBatch) -> str:
        if not batch.id:
            batch.id = self.generate_id()
        
        filepath = self.paper_batches_dir / f"{batch.id}.json"
        
        data = {
            'id': batch.id,
            'batch_number': batch.batch_number,
            'paper_type': batch.paper_type,
            'paper_name': batch.paper_name,
            'grammage': batch.grammage,
            'width': batch.width,
            'length': batch.length,
            'supplier': batch.supplier,
            'manufacture_date': batch.manufacture_date,
            'expiry_date': batch.expiry_date,
            'received_date': batch.received_date,
            'total_quantity': batch.total_quantity,
            'used_quantity': batch.used_quantity,
            'warehouse_location': batch.warehouse_location,
            'notes': batch.notes
        }
        
        self._save_json(filepath, data)
        return batch.id
    
    def get_paper_batch(self, batch_id: str) -> Optional[PaperBatch]:
        filepath = self.paper_batches_dir / f"{batch_id}.json"
        if not filepath.exists():
            return None
        
        data = self._load_json(filepath)
        
        return PaperBatch(
            id=data['id'],
            batch_number=data['batch_number'],
            paper_type=data['paper_type'],
            paper_name=data['paper_name'],
            grammage=data.get('grammage', 0),
            width=data.get('width'),
            length=data.get('length'),
            supplier=data.get('supplier'),
            manufacture_date=parse_date(data.get('manufacture_date')),
            expiry_date=parse_date(data.get('expiry_date')),
            received_date=parse_date(data.get('received_date')),
            total_quantity=parse_decimal(data.get('total_quantity')) if data.get('total_quantity') else None,
            used_quantity=parse_decimal(data.get('used_quantity')) if data.get('used_quantity') else None,
            warehouse_location=data.get('warehouse_location'),
            notes=data.get('notes')
        )
    
    def get_paper_batch_by_number(self, batch_number: str) -> Optional[PaperBatch]:
        for filepath in self.paper_batches_dir.glob("*.json"):
            batch = self.get_paper_batch(filepath.stem)
            if batch and batch.batch_number == batch_number:
                return batch
        return None
    
    def save_drying_record(self, record: DryingRecord) -> str:
        if not record.id:
            record.id = self.generate_id()
        
        filepath = self.drying_records_dir / f"{record.id}.json"
        
        data = {
            'id': record.id,
            'proof_id': record.proof_id,
            'batch_number': record.batch_number,
            'print_time': record.print_time,
            'drying_start_time': record.drying_start_time,
            'drying_end_time': record.drying_end_time,
            'drying_method': record.drying_method,
            'drying_temperature': record.drying_temperature,
            'drying_humidity': record.drying_humidity,
            'coating_type': record.coating_type,
            'coating_amount': record.coating_amount,
            'operator_name': record.operator_name,
            'visual_check_result': record.visual_check_result,
            'touch_check_result': record.touch_check_result,
            'notes': record.notes
        }
        
        self._save_json(filepath, data)
        return record.id
    
    def get_drying_record(self, record_id: str) -> Optional[DryingRecord]:
        filepath = self.drying_records_dir / f"{record_id}.json"
        if not filepath.exists():
            return None
        
        data = self._load_json(filepath)
        
        return DryingRecord(
            id=data['id'],
            proof_id=data['proof_id'],
            batch_number=data['batch_number'],
            print_time=parse_datetime(data.get('print_time')) or datetime.now(),
            drying_start_time=parse_datetime(data.get('drying_start_time')) or datetime.now(),
            drying_end_time=parse_datetime(data.get('drying_end_time')),
            drying_method=data.get('drying_method', '自然晾干'),
            drying_temperature=parse_decimal(data.get('drying_temperature')) if data.get('drying_temperature') else None,
            drying_humidity=parse_decimal(data.get('drying_humidity')) if data.get('drying_humidity') else None,
            coating_type=data.get('coating_type'),
            coating_amount=parse_decimal(data.get('coating_amount')) if data.get('coating_amount') else None,
            operator_name=data.get('operator_name'),
            visual_check_result=data.get('visual_check_result'),
            touch_check_result=data.get('touch_check_result'),
            notes=data.get('notes')
        )
    
    def save_customer_tolerance(self, tolerance: CustomerTolerance) -> str:
        filepath = self.tolerances_dir / f"{tolerance.customer_id}.json"
        
        special_tolerances = {}
        for k, v in tolerance.special_tolerances.items():
            special_tolerances[k] = v
        
        data = {
            'customer_id': tolerance.customer_id,
            'customer_name': tolerance.customer_name,
            'delta_e_tolerance': tolerance.delta_e_tolerance,
            'delta_l_tolerance': tolerance.delta_l_tolerance,
            'delta_a_tolerance': tolerance.delta_a_tolerance,
            'delta_b_tolerance': tolerance.delta_b_tolerance,
            'special_tolerances': special_tolerances,
            'min_drying_hours': tolerance.min_drying_hours,
            'notes': tolerance.notes
        }
        
        self._save_json(filepath, data)
        return tolerance.customer_id
    
    def get_customer_tolerance(self, customer_id: str) -> Optional[CustomerTolerance]:
        filepath = self.tolerances_dir / f"{customer_id}.json"
        if not filepath.exists():
            return None
        
        data = self._load_json(filepath)
        
        special_tolerances = {}
        for k, v in data.get('special_tolerances', {}).items():
            special_tolerances[k] = parse_decimal(v)
        
        return CustomerTolerance(
            customer_id=data['customer_id'],
            customer_name=data['customer_name'],
            delta_e_tolerance=parse_decimal(data.get('delta_e_tolerance', '2.0')),
            delta_l_tolerance=parse_decimal(data.get('delta_l_tolerance')) if data.get('delta_l_tolerance') else None,
            delta_a_tolerance=parse_decimal(data.get('delta_a_tolerance')) if data.get('delta_a_tolerance') else None,
            delta_b_tolerance=parse_decimal(data.get('delta_b_tolerance')) if data.get('delta_b_tolerance') else None,
            special_tolerances=special_tolerances,
            min_drying_hours=parse_decimal(data.get('min_drying_hours', '4')),
            notes=data.get('notes')
        )
    
    def list_customer_tolerances(self) -> List[CustomerTolerance]:
        tolerances = []
        for filepath in self.tolerances_dir.glob("*.json"):
            tolerance = self.get_customer_tolerance(filepath.stem)
            if tolerance:
                tolerances.append(tolerance)
        return tolerances
