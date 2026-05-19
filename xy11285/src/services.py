import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from src.models import (
    Medicine, InventoryBatch, Pet, Doctor, Prescription, PrescriptionItem,
    BatchOperation, BatchOperationItem, PrescriptionStatus,
    BatchOperationStatus, ErrorType
)
from src.repositories import (
    MedicineRepository, InventoryBatchRepository, PetRepository,
    DoctorRepository, PrescriptionRepository, BatchOperationRepository
)
from src.config import settings


class DosageCalculationError(Exception):
    pass


class InventoryError(Exception):
    pass


class ValidationError(Exception):
    pass


class DosageService:
    @staticmethod
    def calculate_dosage(medicine: Medicine, pet_weight: float, weight_unit: str = "kg") -> Dict[str, Any]:
        if weight_unit != "kg":
            if weight_unit == "g":
                pet_weight = pet_weight / 1000
            elif weight_unit == "lb":
                pet_weight = pet_weight * 0.453592
            else:
                raise DosageCalculationError(f"不支持的体重单位: {weight_unit}")

        if pet_weight <= 0:
            raise DosageCalculationError("体重必须大于0")

        if medicine.dosage_per_kg is None:
            raise DosageCalculationError(f"药品 {medicine.name} 未设置每公斤剂量")

        base_dosage = pet_weight * medicine.dosage_per_kg

        if medicine.min_dosage is not None and base_dosage < medicine.min_dosage:
            adjusted_dosage = medicine.min_dosage
            dosage_note = f"小体重宠物，剂量从 {DosageService._format_decimal(base_dosage)} 调整至最低剂量"
        elif medicine.max_dosage is not None and base_dosage > medicine.max_dosage:
            adjusted_dosage = medicine.max_dosage
            dosage_note = f"大体重宠物，剂量从 {DosageService._format_decimal(base_dosage)} 调整至最高剂量"
        else:
            adjusted_dosage = base_dosage
            dosage_note = "正常剂量计算"

        if medicine.concentration:
            volume = adjusted_dosage / medicine.concentration
        else:
            volume = adjusted_dosage

        return {
            "pet_weight_kg": DosageService._format_decimal(pet_weight),
            "base_dosage": DosageService._format_decimal(base_dosage),
            "adjusted_dosage": DosageService._format_decimal(adjusted_dosage),
            "volume": DosageService._format_decimal(volume),
            "dosage_unit": medicine.dosage_unit,
            "concentration_unit": medicine.concentration_unit,
            "note": dosage_note
        }

    @staticmethod
    def _format_decimal(value: float, precision: int = 4) -> float:
        d = Decimal(str(value))
        return float(d.quantize(Decimal(f"0.{'0' * precision}"), rounding=ROUND_HALF_UP))


class InventoryService:
    def __init__(self, db: Session):
        self.db = db
        self.batch_repo = InventoryBatchRepository(db)

    def check_availability(self, medicine_id: int, quantity: float) -> Tuple[bool, List[InventoryBatch]]:
        batches = self.batch_repo.get_by_medicine(medicine_id)
        total_available = sum(b.quantity for b in batches)
        return total_available >= quantity, batches

    def allocate_batch(self, medicine_id: int, quantity: float) -> List[Dict[str, Any]]:
        available, batches = self.check_availability(medicine_id, quantity)
        if not available:
            raise InventoryError(f"药品库存不足，需要 {quantity}，可用 {sum(b.quantity for b in batches)}")

        allocations = []
        remaining = quantity

        for batch in batches:
            if remaining <= 0:
                break
            take = min(batch.quantity, remaining)
            allocations.append({
                "batch_id": batch.id,
                "batch_number": batch.batch_number,
                "quantity": take,
                "expiry_date": batch.expiry_date
            })
            remaining -= take

        return allocations

    def deduct_inventory(self, batch_id: int, quantity: float) -> InventoryBatch:
        batch = self.batch_repo.get_by_id(batch_id)
        if not batch:
            raise InventoryError(f"批次 {batch_id} 不存在")
        if batch.quantity < quantity:
            raise InventoryError(f"批次 {batch.batch_number} 库存不足")
        return self.batch_repo.update_quantity(batch_id, -quantity)


class PrescriptionService:
    def __init__(self, db: Session):
        self.db = db
        self.prescription_repo = PrescriptionRepository(db)
        self.medicine_repo = MedicineRepository(db)
        self.pet_repo = PetRepository(db)
        self.doctor_repo = DoctorRepository(db)
        self.inventory_service = InventoryService(db)
        self.dosage_service = DosageService()

    def create_prescription(self, pet_id: int, doctor_id: int,
                            items_data: List[Dict[str, Any]], created_by: str,
                            diagnosis: str = "", notes: str = "") -> Prescription:
        pet = self.pet_repo.get_by_id(pet_id)
        if not pet:
            raise ValidationError(f"宠物 {pet_id} 不存在")

        doctor = self.doctor_repo.get_by_id(doctor_id)
        if not doctor:
            raise ValidationError(f"医生 {doctor_id} 不存在")

        prescription_no = f"RX{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"

        prescription = Prescription(
            prescription_no=prescription_no,
            pet_id=pet_id,
            doctor_id=doctor_id,
            diagnosis=diagnosis,
            notes=notes,
            created_by=created_by,
            status=PrescriptionStatus.DRAFT
        )
        prescription = self.prescription_repo.create(prescription)

        for item_data in items_data:
            self._add_prescription_item(prescription.id, pet, item_data)

        return prescription

    def _add_prescription_item(self, prescription_id: int, pet: Pet,
                               item_data: Dict[str, Any]) -> PrescriptionItem:
        medicine = self.medicine_repo.get_by_id(item_data["medicine_id"])
        if not medicine:
            raise ValidationError(f"药品 {item_data['medicine_id']} 不存在")

        dosage_result = self.dosage_service.calculate_dosage(
            medicine, pet.weight, pet.weight_unit
        )

        quantity = item_data.get("quantity", dosage_result["volume"])

        available, _ = self.inventory_service.check_availability(medicine.id, quantity)
        if not available:
            raise InventoryError(f"药品 {medicine.name} 库存不足")

        item = PrescriptionItem(
            prescription_id=prescription_id,
            medicine_id=medicine.id,
            quantity=quantity,
            unit=medicine.dosage_unit,
            calculated_dosage=dosage_result["adjusted_dosage"],
            dosage_notes=dosage_result["note"],
            administration_route=item_data.get("administration_route", ""),
            frequency=item_data.get("frequency", ""),
            duration=item_data.get("duration", "")
        )
        return self.prescription_repo.add_item(item)

    def submit_for_review(self, prescription_id: int, operator: str) -> Prescription:
        return self.prescription_repo.update_status(
            prescription_id, PrescriptionStatus.PENDING_REVIEW, operator,
            "提交审核"
        )

    def approve(self, prescription_id: int, operator: str, notes: str = "") -> Prescription:
        prescription = self.prescription_repo.get_by_id(prescription_id)
        if not prescription:
            raise ValidationError(f"处方 {prescription_id} 不存在")

        for item in prescription.items:
            allocations = self.inventory_service.allocate_batch(
                item.medicine_id, item.quantity
            )
            if allocations:
                item.inventory_batch_id = allocations[0]["batch_id"]

        self.db.commit()
        return self.prescription_repo.update_status(
            prescription_id, PrescriptionStatus.APPROVED, operator, notes
        )

    def reject(self, prescription_id: int, operator: str, reason: str) -> Prescription:
        return self.prescription_repo.update_status(
            prescription_id, PrescriptionStatus.REJECTED, operator, reason
        )

    def dispense(self, prescription_id: int, operator: str) -> Prescription:
        prescription = self.prescription_repo.get_by_id(prescription_id)
        if not prescription:
            raise ValidationError(f"处方 {prescription_id} 不存在")
        if prescription.status != PrescriptionStatus.APPROVED:
            raise ValidationError(f"只有已批准的处方才能发药")

        for item in prescription.items:
            if item.inventory_batch_id:
                self.inventory_service.deduct_inventory(
                    item.inventory_batch_id, item.quantity
                )

        return self.prescription_repo.update_status(
            prescription_id, PrescriptionStatus.DISPENSED, operator, "完成发药"
        )

    def query_prescriptions(self, **kwargs) -> List[Prescription]:
        return self.prescription_repo.query(**kwargs)


class BatchOperationService:
    def __init__(self, db: Session):
        self.db = db
        self.batch_repo = BatchOperationRepository(db)
        self.prescription_service = PrescriptionService(db)

    def create_operation(self, operation_type: str, created_by: str,
                         items_data: List[Dict[str, Any]]) -> BatchOperation:
        operation_id = f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"

        operation = BatchOperation(
            operation_id=operation_id,
            operation_type=operation_type,
            total_count=len(items_data),
            created_by=created_by
        )
        operation = self.batch_repo.create(operation)

        for idx, item_data in enumerate(items_data):
            item = BatchOperationItem(
                operation_id=operation.id,
                row_index=idx,
                row_data=json.dumps(item_data, ensure_ascii=False),
                status="pending"
            )
            self.batch_repo.add_item(item)

        return operation

    def process_operation(self, operation_id: str) -> Dict[str, Any]:
        operation = self.batch_repo.get_by_operation_id(operation_id)
        if not operation:
            raise ValidationError(f"批量操作 {operation_id} 不存在")

        self.batch_repo.update_status(
            operation_id, BatchOperationStatus.PROCESSING,
            started_at=datetime.utcnow()
        )

        success_count = 0
        failed_count = 0
        errors = []

        for item in operation.items:
            if item.status == "success" and item.record_id:
                success_count += 1
                continue

            try:
                item_data = json.loads(item.row_data)
                record_id = self._process_item(operation.operation_type, item_data)

                self.batch_repo.update_item_status(
                    item.id, "success", record_id=record_id
                )
                success_count += 1
            except (ValidationError, DosageCalculationError, InventoryError) as e:
                error_type = self._map_error_type(e)
                self.batch_repo.update_item_status(
                    item.id, "failed", error_type=error_type, error_message=str(e)
                )
                failed_count += 1
                errors.append({
                    "row": item.row_index,
                    "error_type": error_type,
                    "error_message": str(e)
                })
            except Exception as e:
                self.batch_repo.update_item_status(
                    item.id, "failed", error_type=ErrorType.SYSTEM_ERROR,
                    error_message=f"系统错误: {str(e)}"
                )
                failed_count += 1
                errors.append({
                    "row": item.row_index,
                    "error_type": ErrorType.SYSTEM_ERROR,
                    "error_message": f"系统错误: {str(e)}"
                })

        if failed_count == 0:
            final_status = BatchOperationStatus.SUCCESS
        elif success_count == 0:
            final_status = BatchOperationStatus.FAILED
        else:
            final_status = BatchOperationStatus.PARTIAL_SUCCESS

        self.batch_repo.update_status(
            operation_id, final_status,
            success_count=success_count,
            failed_count=failed_count,
            error_summary=json.dumps(errors, ensure_ascii=False) if errors else None,
            completed=True
        )

        return {
            "operation_id": operation_id,
            "status": final_status,
            "total_count": operation.total_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "errors": errors
        }

    def _process_item(self, operation_type: str, item_data: Dict[str, Any]) -> int:
        if operation_type == "import_prescription":
            return self._import_prescription_item(item_data)
        else:
            raise ValidationError(f"不支持的操作类型: {operation_type}")

    def _import_prescription_item(self, item_data: Dict[str, Any]) -> int:
        required_fields = ["pet_name", "owner_name", "pet_weight", "doctor_employee_id", "items"]
        for field in required_fields:
            if field not in item_data:
                raise ValidationError(f"缺少必填字段: {field}")

        pet = self.prescription_service.pet_repo.get_by_name_and_owner(
            item_data["pet_name"], item_data["owner_name"]
        )
        if not pet:
            pet = Pet(
                name=item_data["pet_name"],
                species=item_data.get("species", "未知"),
                breed=item_data.get("breed", ""),
                weight=float(item_data["pet_weight"]),
                weight_unit=item_data.get("weight_unit", "kg"),
                owner_name=item_data["owner_name"],
                owner_phone=item_data.get("owner_phone", "")
            )
            pet = self.prescription_service.pet_repo.create(pet)

        doctor = self.prescription_service.doctor_repo.get_by_employee_id(
            item_data["doctor_employee_id"]
        )
        if not doctor:
            raise ValidationError(f"医生工号 {item_data['doctor_employee_id']} 不存在")

        items = []
        for med_item in item_data["items"]:
            medicine = self.prescription_service.medicine_repo.get_by_name(
                med_item["medicine_name"]
            )
            if not medicine:
                raise ValidationError(f"药品 {med_item['medicine_name']} 不存在")
            items.append({
                "medicine_id": medicine.id,
                "quantity": med_item.get("quantity"),
                "administration_route": med_item.get("administration_route", ""),
                "frequency": med_item.get("frequency", ""),
                "duration": med_item.get("duration", "")
            })

        prescription = self.prescription_service.create_prescription(
            pet_id=pet.id,
            doctor_id=doctor.id,
            items_data=items,
            created_by=item_data.get("created_by", "batch_import"),
            diagnosis=item_data.get("diagnosis", ""),
            notes=item_data.get("notes", "")
        )

        return prescription.id

    def _map_error_type(self, exception: Exception) -> ErrorType:
        if isinstance(exception, DosageCalculationError):
            return ErrorType.DOSAGE_ERROR
        elif isinstance(exception, InventoryError):
            return ErrorType.INVENTORY_ERROR
        elif isinstance(exception, ValidationError):
            return ErrorType.VALIDATION_ERROR
        else:
            return ErrorType.SYSTEM_ERROR

    def retry_failed_items(self, operation_id: str) -> Dict[str, Any]:
        operation = self.batch_repo.get_by_operation_id(operation_id)
        if not operation:
            raise ValidationError(f"批量操作 {operation_id} 不存在")

        failed_items = self.batch_repo.get_failed_items(operation_id)
        if not failed_items:
            return {"message": "没有需要重试的失败项"}

        for item in failed_items:
            if item.retry_count >= settings.RETRY_TIMES:
                continue

            try:
                item_data = json.loads(item.row_data)
                record_id = self._process_item(operation.operation_type, item_data)

                self.batch_repo.update_item_status(
                    item.id, "success", record_id=record_id
                )
                operation.success_count += 1
                operation.failed_count -= 1
            except Exception as e:
                item.retry_count += 1
                self.db.commit()

        if operation.failed_count == 0:
            operation.status = BatchOperationStatus.SUCCESS
        elif operation.success_count > 0:
            operation.status = BatchOperationStatus.PARTIAL_SUCCESS
        self.db.commit()

        return {
            "operation_id": operation_id,
            "status": operation.status,
            "success_count": operation.success_count,
            "failed_count": operation.failed_count
        }

    def query_operations(self, **kwargs) -> Tuple[List[BatchOperation], List[BatchOperationItem]]:
        return self.batch_repo.query(**kwargs)


class InitialDataService:
    def __init__(self, db: Session):
        self.db = db
        self.medicine_repo = MedicineRepository(db)
        self.batch_repo = InventoryBatchRepository(db)
        self.doctor_repo = DoctorRepository(db)

    def create_sample_data(self):
        medicines = [
            {
                "name": "头孢氨苄注射液",
                "generic_name": "Cefalexin Injection",
                "type": "injection",
                "manufacturer": "某制药厂",
                "specification": "100mg/ml",
                "dosage_unit": "mg",
                "dosage_per_kg": 10,
                "max_dosage": 500,
                "min_dosage": 25,
                "concentration": 100,
                "concentration_unit": "mg/ml"
            },
            {
                "name": "恩诺沙星片",
                "generic_name": "Enrofloxacin Tablets",
                "type": "oral",
                "manufacturer": "某制药厂",
                "specification": "25mg/片",
                "dosage_unit": "mg",
                "dosage_per_kg": 5,
                "max_dosage": 200,
                "min_dosage": 12.5,
                "concentration": 25,
                "concentration_unit": "mg/片"
            },
            {
                "name": "伊维菌素注射液",
                "generic_name": "Ivermectin Injection",
                "type": "injection",
                "manufacturer": "某制药厂",
                "specification": "10mg/ml",
                "dosage_unit": "mg",
                "dosage_per_kg": 0.2,
                "max_dosage": 20,
                "min_dosage": 0.5,
                "concentration": 10,
                "concentration_unit": "mg/ml"
            }
        ]

        created_medicines = []
        for med_data in medicines:
            med = Medicine(**med_data)
            med = self.medicine_repo.create(med)
            created_medicines.append(med)

        batches = [
            {"medicine_index": 0, "batch_number": "BATCH202401001", "quantity": 100, "unit": "ml"},
            {"medicine_index": 0, "batch_number": "BATCH202401002", "quantity": 200, "unit": "ml"},
            {"medicine_index": 1, "batch_number": "BATCH202402001", "quantity": 500, "unit": "片"},
            {"medicine_index": 2, "batch_number": "BATCH202403001", "quantity": 80, "unit": "ml"},
        ]

        for batch_data in batches:
            batch = InventoryBatch(
                medicine_id=created_medicines[batch_data["medicine_index"]].id,
                batch_number=batch_data["batch_number"],
                quantity=batch_data["quantity"],
                unit=batch_data["unit"],
                production_date=datetime(2024, 1, 1),
                expiry_date=datetime(2026, 1, 1),
                location="A区-01架",
                supplier="某供应商"
            )
            self.batch_repo.create(batch)

        doctors = [
            {"name": "张医生", "employee_id": "DOC001", "department": "内科"},
            {"name": "李医生", "employee_id": "DOC002", "department": "外科"},
            {"name": "王医生", "employee_id": "DOC003", "department": "皮肤科"},
        ]

        for doc_data in doctors:
            doc = Doctor(**doc_data)
            self.doctor_repo.create(doc)
