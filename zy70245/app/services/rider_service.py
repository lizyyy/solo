from datetime import datetime
from app import db
from app.models.rider import Rider, RiderStatus
from app.models.record import EquipmentRecord, RecordType, RecordStatus
from app.models.equipment import EquipmentStatus
from app.services.exceptions import (
    RiderNotFoundError,
    RiderNotActiveError,
    InvalidStatusTransitionError,
    RiderHasOutstandingEquipmentError
)


class RiderService:
    @staticmethod
    def create_rider(data):
        join_date = datetime.strptime(data['join_date'], '%Y-%m-%d').date()
        rider = Rider(
            rider_id=data['rider_id'],
            name=data['name'],
            phone=data['phone'],
            id_card=data['id_card'],
            station_id=data['station_id'],
            station_name=data['station_name'],
            status=RiderStatus.PENDING,
            join_date=join_date
        )
        db.session.add(rider)
        db.session.commit()
        return rider

    @staticmethod
    def get_rider(rider_id):
        rider = Rider.query.filter_by(rider_id=rider_id).first()
        if not rider:
            raise RiderNotFoundError(f'骑手不存在: {rider_id}')
        return rider

    @staticmethod
    def verify_rider_active(rider_id):
        rider = RiderService.get_rider(rider_id)
        if not rider.is_active():
            raise RiderNotActiveError(
                f'骑手档案未生效，当前状态: {rider.status}',
                details={'rider_status': rider.status}
            )
        return rider

    @staticmethod
    def activate_rider(rider_id):
        rider = RiderService.get_rider(rider_id)
        if rider.status != RiderStatus.PENDING:
            raise InvalidStatusTransitionError(
                f'无法激活骑手，当前状态: {rider.status}'
            )
        rider.status = RiderStatus.ACTIVE
        db.session.commit()
        return rider

    @staticmethod
    def deactivate_rider(rider_id):
        rider = RiderService.get_rider(rider_id)
        if rider.status not in [RiderStatus.ACTIVE, RiderStatus.INACTIVE]:
            raise InvalidStatusTransitionError(
                f'无法停用骑手，当前状态: {rider.status}'
            )
        rider.status = RiderStatus.INACTIVE
        db.session.commit()
        return rider

    @staticmethod
    def resign_rider(rider_id, resignation_date=None):
        rider = RiderService.get_rider(rider_id)
        
        outstanding_equipment = EquipmentRecord.query.filter(
            EquipmentRecord.rider_id == rider.id,
            EquipmentRecord.record_type == RecordType.ISSUE,
            EquipmentRecord.status == RecordStatus.CONFIRMED,
            ~EquipmentRecord.equipment.has(status=EquipmentStatus.RETURNED)
        ).all()

        if outstanding_equipment:
            equipment_list = [f'{rec.equipment.equipment_no} ({rec.equipment.equipment_type})' 
                            for rec in outstanding_equipment]
            raise RiderHasOutstandingEquipmentError(
                '骑手存在未归还的装备，无法办理离职',
                details={'outstanding_equipment': equipment_list}
            )

        rider.status = RiderStatus.RESIGNED
        rider.resignation_date = datetime.strptime(
            resignation_date, '%Y-%m-%d'
        ).date() if resignation_date else datetime.utcnow().date()
        db.session.commit()
        return rider

    @staticmethod
    def list_riders(status=None, station_id=None):
        query = Rider.query
        if status:
            query = query.filter_by(status=status)
        if station_id:
            query = query.filter_by(station_id=station_id)
        return query.all()

    @staticmethod
    def get_rider_equipment_status(rider_id):
        rider = RiderService.get_rider(rider_id)
        
        records = EquipmentRecord.query.filter_by(
            rider_id=rider.id
        ).order_by(EquipmentRecord.created_at.desc()).all()

        issued_equipment = []
        returned_equipment = []
        
        for record in records:
            if record.record_type == RecordType.ISSUE and record.status == RecordStatus.CONFIRMED:
                if record.equipment.status != EquipmentStatus.RETURNED:
                    issued_equipment.append({
                        'equipment_no': record.equipment.equipment_no,
                        'equipment_type': record.equipment.equipment_type,
                        'issue_date': record.operation_date.isoformat(),
                        'status': record.equipment.status
                    })
            elif record.record_type == RecordType.RETURN and record.status == RecordStatus.CONFIRMED:
                returned_equipment.append({
                    'equipment_no': record.equipment.equipment_no,
                    'equipment_type': record.equipment.equipment_type,
                    'return_date': record.operation_date.isoformat(),
                    'return_condition': record.return_condition
                })

        return {
            'rider': rider.to_dict(),
            'issued_equipment': issued_equipment,
            'returned_equipment': returned_equipment,
            'can_resign': len(issued_equipment) == 0
        }
