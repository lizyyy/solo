from datetime import datetime
import hashlib
from app import db
from app.models.rider import Rider
from app.models.equipment import Equipment, EquipmentStatus
from app.models.record import (
    EquipmentRecord, RecordType, RecordStatus
)
from app.services.rider_service import RiderService
from app.services.equipment_service import EquipmentService
from app.services.exceptions import (
    RecordNotFoundError,
    SignatureMismatchError,
    RecordAlreadyConfirmedError,
    SignatureMismatchError,
    InvalidStatusTransitionError
)


class RecordService:
    @staticmethod
    def _generate_record_no():
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        hash_suffix = hashlib.md5(str(datetime.utcnow().timestamp()).encode()).hexdigest()[:6]
        return f'ER-{timestamp}-{hash_suffix}'

    @staticmethod
    def _generate_signature(rider_id, equipment_no, operation_date):
        date_str = operation_date.strftime('%Y-%m-%d')
        sign_str = f'{rider_id}|{equipment_no}|{date_str}'
        return hashlib.sha256(sign_str.encode()).hexdigest()[:16]

    @staticmethod
    def create_issue_record(data):
        rider = RiderService.verify_rider_active(data['rider_id'])
        equipment = EquipmentService.verify_equipment_available(data['equipment_no'])

        EquipmentService.verify_batch_qualified(equipment.batch.batch_no)

        operation_date = datetime.strptime(
            data.get('operation_date', datetime.utcnow().isoformat()),
            '%Y-%m-%dT%H:%M:%S'
        ) if data.get('operation_date') else datetime.utcnow()

        record = EquipmentRecord(
            record_no=RecordService._generate_record_no(),
            rider_id=rider.id,
            equipment_id=equipment.id,
            record_type=RecordType.ISSUE,
            operator=data['operator'],
            operation_date=operation_date,
            status=RecordStatus.PENDING
        )

        db.session.add(record)
        db.session.commit()
        return record

    @staticmethod
    def create_return_record(data):
        rider = RiderService.verify_rider_active(data['rider_id'])
        equipment = EquipmentService.get_equipment(data['equipment_no'])

        if equipment.status != EquipmentStatus.ISSUED:
            raise InvalidStatusTransitionError(
                f'装备当前状态为 {equipment.status}，无法执行归还'
            )

        operation_date = datetime.strptime(
            data.get('operation_date', datetime.utcnow().isoformat()),
            '%Y-%m-%dT%H:%M:%S'
        ) if data.get('operation_date') else datetime.utcnow()

        record = EquipmentRecord(
            record_no=RecordService._generate_record_no(),
            rider_id=rider.id,
            equipment_id=equipment.id,
            record_type=RecordType.RETURN,
            operator=data['operator'],
            operation_date=operation_date,
            return_condition=data.get('return_condition'),
            damage_level=data.get('damage_level'),
            remarks=data.get('remarks'),
            status=RecordStatus.PENDING
        )

        db.session.add(record)
        db.session.commit()
        return record

    @staticmethod
    def get_record(record_no):
        record = EquipmentRecord.query.filter_by(record_no=record_no).first()
        if not record:
            raise RecordNotFoundError(f'记录不存在: {record_no}')
        return record

    @staticmethod
    def confirm_record(record_no, signature):
        record = RecordService.get_record(record_no)

        if record.status != RecordStatus.PENDING:
            raise RecordAlreadyConfirmedError(
                f'记录状态为 {record.status}，无法重复确认'
            )

        expected_signature = RecordService._generate_signature(
            record.rider.rider_id,
            record.equipment.equipment_no,
            record.operation_date
        )

        if signature != expected_signature:
            record.status = RecordStatus.ANOMALY
            record.verification_result = f'签名校验失败'
            db.session.commit()
            raise SignatureMismatchError(
                '签收签名与原始数据不匹配，已标记为异常',
                details={
                    'expected_signature': expected_signature,
                    'provided_signature': signature,
                    'original_data': {
                        'rider_id': record.rider.rider_id,
                        'equipment_no': record.equipment.equipment_no,
                        'operation_date': record.operation_date.isoformat()
                    }
                }
            )

        record.signature = signature
        record.signature_timestamp = datetime.utcnow()
        record.status = RecordStatus.CONFIRMED
        record.verification_result = '校验通过'

        if record.record_type == RecordType.ISSUE:
            record.equipment.status = EquipmentStatus.ISSUED
        elif record.record_type == RecordType.RETURN:
            if record.damage_level and record.damage_level != 'none':
                record.equipment.status = EquipmentStatus.DAMAGED
            else:
                record.equipment.status = EquipmentStatus.RETURNED

        db.session.commit()
        return record

    @staticmethod
    def reject_record(record_no, reason):
        record = RecordService.get_record(record_no)

        if record.status != RecordStatus.PENDING:
            raise RecordAlreadyConfirmedError(
                f'记录状态为 {record.status}，无法拒绝'
            )

        record.status = RecordStatus.REJECTED
        record.verification_result = f'拒绝原因: {reason}'
        db.session.commit()
        return record

    @staticmethod
    def list_records(rider_id=None, record_type=None, status=None):
        query = EquipmentRecord.query
        if rider_id:
            rider = RiderService.get_rider(rider_id)
            query = query.filter_by(rider_id=rider.id)
        if record_type:
            query = query.filter_by(record_type=record_type)
        if status:
            query = query.filter_by(status=status)
        return query.order_by(EquipmentRecord.created_at.desc()).all()

    @staticmethod
    def verify_record_consistency(record_no):
        record = RecordService.get_record(record_no)

        expected_signature = RecordService._generate_signature(
            record.rider.rider_id,
            record.equipment.equipment_no,
            record.operation_date
        )

        is_consistent = record.signature == expected_signature

        issues = []
        if not is_consistent:
            issues.append('签名不匹配')

        if record.record_type == RecordType.ISSUE:
            if record.equipment.status != EquipmentStatus.ISSUED and record.status == RecordStatus.CONFIRMED:
                issues.append('装备状态与领用记录不一致')

        if record.record_type == RecordType.RETURN:
            if record.equipment.status not in [EquipmentStatus.RETURNED, EquipmentStatus.DAMAGED] and record.status == RecordStatus.CONFIRMED:
                issues.append('装备状态与归还记录不一致')

        return {
            'record': record.to_dict(),
            'is_consistent': is_consistent,
            'expected_signature': expected_signature,
            'actual_signature': record.signature,
            'issues': issues,
            'requires_manual_review': len(issues) > 0
        }

    @staticmethod
    def get_reconciliation_report():
        all_records = EquipmentRecord.query.all()

        inconsistent_records = []
        for record in all_records:
            verification = RecordService.verify_record_consistency(record.record_no)
            if not verification['is_consistent']:
                inconsistent_records.append(verification)

        status_breakdown = {}
        for record in all_records:
            key = (record.record_type, record.status)
            status_breakdown[key] = status_breakdown.get(key, 0) + 1

        return {
            'total_records': len(all_records),
            'inconsistent_count': len(inconsistent_records),
            'status_breakdown': {f'{k[0]}_{k[1]}': v for k, v in status_breakdown.items()},
            'inconsistent_records': inconsistent_records,
            'reconciliation_status': 'clean' if len(inconsistent_records) == 0 else 'needs_review'
        }
