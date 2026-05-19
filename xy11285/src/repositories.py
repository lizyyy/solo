from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from src.models import (
    Medicine, InventoryBatch, Pet, Doctor, Prescription, PrescriptionItem,
    BatchOperation, BatchOperationItem, PrescriptionOperationLog,
    PrescriptionStatus, BatchOperationStatus, ErrorType
)


class BaseRepository:
    def __init__(self, db: Session):
        self.db = db


class MedicineRepository(BaseRepository):
    def create(self, medicine: Medicine) -> Medicine:
        self.db.add(medicine)
        self.db.commit()
        self.db.refresh(medicine)
        return medicine

    def get_by_id(self, medicine_id: int) -> Optional[Medicine]:
        return self.db.query(Medicine).filter(Medicine.id == medicine_id).first()

    def get_by_name(self, name: str) -> Optional[Medicine]:
        return self.db.query(Medicine).filter(Medicine.name == name).first()

    def list_all(self, active_only: bool = True) -> List[Medicine]:
        query = self.db.query(Medicine)
        if active_only:
            query = query.filter(Medicine.is_active == True)
        return query.all()


class InventoryBatchRepository(BaseRepository):
    def create(self, batch: InventoryBatch) -> InventoryBatch:
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def get_by_id(self, batch_id: int) -> Optional[InventoryBatch]:
        return self.db.query(InventoryBatch).filter(InventoryBatch.id == batch_id).first()

    def get_by_batch_number(self, batch_number: str) -> Optional[InventoryBatch]:
        return self.db.query(InventoryBatch).filter(InventoryBatch.batch_number == batch_number).first()

    def get_by_medicine(self, medicine_id: int) -> List[InventoryBatch]:
        return self.db.query(InventoryBatch).filter(
            InventoryBatch.medicine_id == medicine_id,
            InventoryBatch.quantity > 0
        ).order_by(InventoryBatch.expiry_date).all()

    def update_quantity(self, batch_id: int, quantity_change: float) -> Optional[InventoryBatch]:
        batch = self.get_by_id(batch_id)
        if batch:
            batch.quantity += quantity_change
            self.db.commit()
            self.db.refresh(batch)
        return batch


class PetRepository(BaseRepository):
    def create(self, pet: Pet) -> Pet:
        self.db.add(pet)
        self.db.commit()
        self.db.refresh(pet)
        return pet

    def get_by_id(self, pet_id: int) -> Optional[Pet]:
        return self.db.query(Pet).filter(Pet.id == pet_id).first()

    def get_by_name_and_owner(self, name: str, owner_name: str) -> Optional[Pet]:
        return self.db.query(Pet).filter(
            Pet.name == name,
            Pet.owner_name == owner_name
        ).first()


class DoctorRepository(BaseRepository):
    def create(self, doctor: Doctor) -> Doctor:
        self.db.add(doctor)
        self.db.commit()
        self.db.refresh(doctor)
        return doctor

    def get_by_id(self, doctor_id: int) -> Optional[Doctor]:
        return self.db.query(Doctor).filter(Doctor.id == doctor_id).first()

    def get_by_employee_id(self, employee_id: str) -> Optional[Doctor]:
        return self.db.query(Doctor).filter(Doctor.employee_id == employee_id).first()

    def list_all(self, active_only: bool = True) -> List[Doctor]:
        query = self.db.query(Doctor)
        if active_only:
            query = query.filter(Doctor.is_active == True)
        return query.all()


class PrescriptionRepository(BaseRepository):
    def create(self, prescription: Prescription) -> Prescription:
        self.db.add(prescription)
        self.db.commit()
        self.db.refresh(prescription)
        return prescription

    def get_by_id(self, prescription_id: int) -> Optional[Prescription]:
        return self.db.query(Prescription).filter(Prescription.id == prescription_id).first()

    def get_by_prescription_no(self, prescription_no: str) -> Optional[Prescription]:
        return self.db.query(Prescription).filter(Prescription.prescription_no == prescription_no).first()

    def update_status(self, prescription_id: int, status: PrescriptionStatus, operator: str, notes: str = "") -> Optional[Prescription]:
        prescription = self.get_by_id(prescription_id)
        if prescription:
            old_status = prescription.status
            prescription.status = status
            if status == PrescriptionStatus.APPROVED or status == PrescriptionStatus.REJECTED:
                prescription.reviewed_by = operator
                prescription.reviewed_at = datetime.utcnow()
            if status == PrescriptionStatus.DISPENSED:
                prescription.dispensed_by = operator
                prescription.dispensed_at = datetime.utcnow()

            log = PrescriptionOperationLog(
                prescription_id=prescription_id,
                operation="status_change",
                operator=operator,
                old_status=old_status,
                new_status=status,
                notes=notes
            )
            self.db.add(log)
            self.db.commit()
            self.db.refresh(prescription)
        return prescription

    def query(self,
              status: Optional[PrescriptionStatus] = None,
              created_by: Optional[str] = None,
              reviewed_by: Optional[str] = None,
              start_date: Optional[datetime] = None,
              end_date: Optional[datetime] = None,
              doctor_id: Optional[int] = None) -> List[Prescription]:
        query = self.db.query(Prescription)
        if status:
            query = query.filter(Prescription.status == status)
        if created_by:
            query = query.filter(Prescription.created_by == created_by)
        if reviewed_by:
            query = query.filter(Prescription.reviewed_by == reviewed_by)
        if start_date:
            query = query.filter(Prescription.created_at >= start_date)
        if end_date:
            query = query.filter(Prescription.created_at <= end_date)
        if doctor_id:
            query = query.filter(Prescription.doctor_id == doctor_id)
        return query.order_by(Prescription.created_at.desc()).all()

    def add_item(self, item: PrescriptionItem) -> PrescriptionItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item


class BatchOperationRepository(BaseRepository):
    def create(self, operation: BatchOperation) -> BatchOperation:
        self.db.add(operation)
        self.db.commit()
        self.db.refresh(operation)
        return operation

    def get_by_operation_id(self, operation_id: str) -> Optional[BatchOperation]:
        return self.db.query(BatchOperation).filter(BatchOperation.operation_id == operation_id).first()

    def add_item(self, item: BatchOperationItem) -> BatchOperationItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update_status(self, operation_id: str, status: BatchOperationStatus,
                      success_count: int = None, failed_count: int = None,
                      error_summary: str = None, completed: bool = False):
        operation = self.get_by_operation_id(operation_id)
        if operation:
            operation.status = status
            if success_count is not None:
                operation.success_count = success_count
            if failed_count is not None:
                operation.failed_count = failed_count
            if error_summary:
                operation.error_summary = error_summary
            if completed:
                operation.completed_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(operation)
        return operation

    def update_item_status(self, item_id: int, status: str, error_type: ErrorType = None,
                           error_message: str = None, record_id: int = None):
        item = self.db.query(BatchOperationItem).filter(BatchOperationItem.id == item_id).first()
        if item:
            item.status = status
            if error_type:
                item.error_type = error_type
            if error_message:
                item.error_message = error_message
            if record_id:
                item.record_id = record_id
            self.db.commit()
            self.db.refresh(item)
        return item

    def query(self,
              status: Optional[BatchOperationStatus] = None,
              operation_type: Optional[str] = None,
              created_by: Optional[str] = None,
              error_type: Optional[ErrorType] = None,
              start_date: Optional[datetime] = None,
              end_date: Optional[datetime] = None) -> Tuple[List[BatchOperation], List[BatchOperationItem]]:
        query = self.db.query(BatchOperation)
        if status:
            query = query.filter(BatchOperation.status == status)
        if operation_type:
            query = query.filter(BatchOperation.operation_type == operation_type)
        if created_by:
            query = query.filter(BatchOperation.created_by == created_by)
        if start_date:
            query = query.filter(BatchOperation.created_at >= start_date)
        if end_date:
            query = query.filter(BatchOperation.created_at <= end_date)

        operations = query.order_by(BatchOperation.created_at.desc()).all()

        item_query = self.db.query(BatchOperationItem).join(BatchOperation)
        if status:
            item_query = item_query.filter(BatchOperation.status == status)
        if operation_type:
            item_query = item_query.filter(BatchOperation.operation_type == operation_type)
        if created_by:
            item_query = item_query.filter(BatchOperation.created_by == created_by)
        if error_type:
            item_query = item_query.filter(BatchOperationItem.error_type == error_type)
        if start_date:
            item_query = item_query.filter(BatchOperation.created_at >= start_date)
        if end_date:
            item_query = item_query.filter(BatchOperation.created_at <= end_date)

        items = item_query.order_by(BatchOperationItem.created_at.desc()).all()

        return operations, items

    def get_failed_items(self, operation_id: str) -> List[BatchOperationItem]:
        return self.db.query(BatchOperationItem).filter(
            BatchOperationItem.operation_id == operation_id,
            BatchOperationItem.status == "failed"
        ).all()
