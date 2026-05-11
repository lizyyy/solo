from datetime import datetime
from app import db
from app.models.equipment import (
    EquipmentBatch, Equipment,
    BatchStatus, EquipmentStatus
)
from app.services.exceptions import (
    BatchNotFoundError,
    BatchNotQualifiedError,
    EquipmentNotFoundError,
    EquipmentNotAvailableError,
    InvalidStatusTransitionError
)


class EquipmentService:
    @staticmethod
    def create_batch(data):
        arrival_date = datetime.strptime(data['arrival_date'], '%Y-%m-%d').date()
        batch = EquipmentBatch(
            batch_no=data['batch_no'],
            equipment_type=data['equipment_type'],
            supplier=data['supplier'],
            quantity=data['quantity'],
            arrival_date=arrival_date,
            status=BatchStatus.PENDING_INSPECTION
        )
        db.session.add(batch)
        db.session.commit()
        return batch

    @staticmethod
    def get_batch(batch_no):
        batch = EquipmentBatch.query.filter_by(batch_no=batch_no).first()
        if not batch:
            raise BatchNotFoundError(f'装备批次不存在: {batch_no}')
        return batch

    @staticmethod
    def inspect_batch(batch_no, inspector, inspection_report, is_qualified):
        batch = EquipmentService.get_batch(batch_no)
        if batch.status != BatchStatus.PENDING_INSPECTION:
            raise InvalidStatusTransitionError(
                f'批次已完成质检，当前状态: {batch.status}'
            )

        batch.inspector = inspector
        batch.inspection_report = inspection_report
        batch.inspection_date = datetime.utcnow().date()
        batch.status = BatchStatus.QUALIFIED if is_qualified else BatchStatus.UNQUALIFIED
        db.session.commit()
        return batch

    @staticmethod
    def verify_batch_qualified(batch_no):
        batch = EquipmentService.get_batch(batch_no)
        if not batch.is_qualified():
            raise BatchNotQualifiedError(
                f'装备批次未通过质检，无法领用',
                details={
                    'batch_no': batch_no,
                    'batch_status': batch.status
                }
            )
        return batch

    @staticmethod
    def create_equipment(data):
        batch = EquipmentService.get_batch(data['batch_no'])
        EquipmentService.verify_batch_qualified(data['batch_no'])

        equipment = Equipment(
            equipment_no=data['equipment_no'],
            batch_id=batch.id,
            equipment_type=batch.equipment_type,
            rfid_tag=data.get('rfid_tag'),
            status=EquipmentStatus.IN_STOCK
        )
        db.session.add(equipment)
        db.session.commit()
        return equipment

    @staticmethod
    def get_equipment(equipment_no):
        equipment = Equipment.query.filter_by(equipment_no=equipment_no).first()
        if not equipment:
            raise EquipmentNotFoundError(f'装备不存在: {equipment_no}')
        return equipment

    @staticmethod
    def verify_equipment_available(equipment_no):
        equipment = EquipmentService.get_equipment(equipment_no)
        if not equipment.is_available():
            raise EquipmentNotAvailableError(
                f'装备不可用，当前状态: {equipment.status}',
                details={
                    'equipment_no': equipment_no,
                    'status': equipment.status
                }
            )
        return equipment

    @staticmethod
    def list_batches(status=None, equipment_type=None):
        query = EquipmentBatch.query
        if status:
            query = query.filter_by(status=status)
        if equipment_type:
            query = query.filter_by(equipment_type=equipment_type)
        return query.all()

    @staticmethod
    def list_equipment(batch_no=None, status=None, equipment_type=None):
        query = Equipment.query
        if batch_no:
            batch = EquipmentService.get_batch(batch_no)
            query = query.filter_by(batch_id=batch.id)
        if status:
            query = query.filter_by(status=status)
        if equipment_type:
            query = query.filter_by(equipment_type=equipment_type)
        return query.all()

    @staticmethod
    def update_equipment_status(equipment_no, new_status):
        equipment = EquipmentService.get_equipment(equipment_no)
        
        valid_transitions = {
            EquipmentStatus.IN_STOCK: [EquipmentStatus.ISSUED],
            EquipmentStatus.ISSUED: [EquipmentStatus.RETURNED, EquipmentStatus.DAMAGED, EquipmentStatus.LOST],
            EquipmentStatus.RETURNED: [EquipmentStatus.IN_STOCK, EquipmentStatus.DAMAGED],
            EquipmentStatus.DAMAGED: [EquipmentStatus.COMPENSATED],
            EquipmentStatus.COMPENSATED: [],
            EquipmentStatus.LOST: []
        }

        if new_status not in valid_transitions.get(equipment.status, []):
            raise InvalidStatusTransitionError(
                f'无效的状态流转: {equipment.status} -> {new_status}'
            )

        equipment.status = new_status
        db.session.commit()
        return equipment

    @staticmethod
    def get_batch_verification_details(batch_no):
        batch = EquipmentService.get_batch(batch_no)
        
        equipments = Equipment.query.filter_by(batch_id=batch.id).all()
        
        status_counts = {}
        for eq in equipments:
            status_counts[eq.status] = status_counts.get(eq.status, 0) + 1

        return {
            'batch': batch.to_dict(),
            'is_qualified': batch.is_qualified(),
            'total_equipment': len(equipments),
            'equipment_status_breakdown': status_counts,
            'can_be_issued': batch.is_qualified() and any(
                eq.status == EquipmentStatus.IN_STOCK for eq in equipments
            )
        }
