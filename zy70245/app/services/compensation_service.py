from datetime import datetime
import hashlib
from app import db
from app.models.equipment import EquipmentStatus
from app.models.record import RecordStatus
from app.models.compensation import CompensationRecord, CompensationStatus
from app.services.rider_service import RiderService
from app.services.equipment_service import EquipmentService
from app.services.record_service import RecordService
from app.services.exceptions import (
    CompensationNotFoundError,
    InvalidStatusTransitionError,
    ReconciliationError
)


class CompensationService:
    @staticmethod
    def _generate_compensation_no():
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        hash_suffix = hashlib.md5(str(datetime.utcnow().timestamp()).encode()).hexdigest()[:6]
        return f'CR-{timestamp}-{hash_suffix}'

    @staticmethod
    def _calculate_compensation_amount(damage_level, equipment_type):
        base_prices = {
            'helmet': 150.0,
            'food_box': 200.0,
            'raincoat': 80.0
        }

        damage_multipliers = {
            'minor': 0.3,
            'moderate': 0.6,
            'severe': 1.0
        }

        base_price = base_prices.get(equipment_type, 100.0)
        multiplier = damage_multipliers.get(damage_level, 1.0)
        return round(base_price * multiplier, 2)

    @staticmethod
    def create_compensation(data):
        rider = RiderService.get_rider(data['rider_id'])
        equipment = EquipmentService.get_equipment(data['equipment_no'])

        if equipment.status not in [EquipmentStatus.DAMAGED, EquipmentStatus.LOST]:
            raise InvalidStatusTransitionError(
                f'装备状态为 {equipment.status}，无法创建赔付记录'
            )

        return_record = None
        records = equipment.records.filter_by(
            record_type='return',
            status=RecordStatus.CONFIRMED
        ).order_by(db.desc('created_at')).first()

        amount = data.get('amount')
        if not amount:
            amount = CompensationService._calculate_compensation_amount(
                data['damage_level'],
                equipment.equipment_type
            )

        compensation = CompensationRecord(
            compensation_no=CompensationService._generate_compensation_no(),
            rider_id=rider.id,
            equipment_record_id=records.id if records else None,
            equipment_no=equipment.equipment_no,
            damage_reason=data['damage_reason'],
            damage_level=data['damage_level'],
            compensation_amount=amount,
            remarks=data.get('remarks'),
            status=CompensationStatus.PENDING,
            reconciliation_status='pending'
        )

        db.session.add(compensation)
        db.session.commit()
        return compensation

    @staticmethod
    def get_compensation(compensation_no):
        compensation = CompensationRecord.query.filter_by(
            compensation_no=compensation_no
        ).first()
        if not compensation:
            raise CompensationNotFoundError(f'赔付记录不存在: {compensation_no}')
        return compensation

    @staticmethod
    def mark_paid(compensation_no, payment_method='cash'):
        compensation = CompensationService.get_compensation(compensation_no)

        if compensation.status != CompensationStatus.PENDING:
            raise InvalidStatusTransitionError(
                f'赔付记录状态为 {compensation.status}，无法标记已支付'
            )

        compensation.status = CompensationStatus.PAID
        compensation.payment_method = payment_method
        compensation.payment_date = datetime.utcnow()

        equipment = EquipmentService.get_equipment(compensation.equipment_no)
        if equipment.status == EquipmentStatus.DAMAGED:
            equipment.status = EquipmentStatus.COMPENSATED

        db.session.commit()
        return compensation

    @staticmethod
    def waive_compensation(compensation_no, reason):
        compensation = CompensationService.get_compensation(compensation_no)

        if compensation.status != CompensationStatus.PENDING:
            raise InvalidStatusTransitionError(
                f'赔付记录状态为 {compensation.status}，无法豁免'
            )

        compensation.status = CompensationStatus.WAIVED
        compensation.remarks = (compensation.remarks or '') + f'; 豁免原因: {reason}'

        db.session.commit()
        return compensation

    @staticmethod
    def list_compensations(rider_id=None, status=None, reconciliation_status=None):
        query = CompensationRecord.query
        if rider_id:
            rider = RiderService.get_rider(rider_id)
            query = query.filter_by(rider_id=rider.id)
        if status:
            query = query.filter_by(status=status)
        if reconciliation_status:
            query = query.filter_by(reconciliation_status=reconciliation_status)
        return query.order_by(CompensationRecord.created_at.desc()).all()

    @staticmethod
    def reconcile_compensation(compensation_no, is_valid, remarks=None):
        compensation = CompensationService.get_compensation(compensation_no)

        if is_valid:
            compensation.reconciliation_status = 'validated'
            if compensation.status == CompensationStatus.PAID:
                compensation.reconciliation_status = 'reconciled'
        else:
            compensation.reconciliation_status = 'discrepancy'

        if remarks:
            compensation.reconciliation_remarks = remarks

        db.session.commit()
        return compensation

    @staticmethod
    def get_compensation_reconciliation_report():
        all_compensations = CompensationRecord.query.all()

        status_breakdown = {}
        reconciliation_breakdown = {}

        for comp in all_compensations:
            status_breakdown[comp.status] = status_breakdown.get(comp.status, 0) + 1
            reconciliation_breakdown[comp.reconciliation_status] = reconciliation_breakdown.get(
                comp.reconciliation_status, 0
            ) + 1

        total_pending = sum(
            c.compensation_amount for c in all_compensations
            if c.status == CompensationStatus.PENDING
        )

        total_paid = sum(
            c.compensation_amount for c in all_compensations
            if c.status == CompensationStatus.PAID
        )

        total_waived = sum(
            c.compensation_amount for c in all_compensations
            if c.status == CompensationStatus.WAIVED
        )

        unreconciled = [
            c.to_dict() for c in all_compensations
            if c.reconciliation_status in ['pending', 'discrepancy']
        ]

        return {
            'total_compensations': len(all_compensations),
            'status_breakdown': status_breakdown,
            'reconciliation_breakdown': reconciliation_breakdown,
            'amounts': {
                'pending': round(total_pending, 2),
                'paid': round(total_paid, 2),
                'waived': round(total_waived, 2),
                'total': round(total_pending + total_paid + total_waived, 2)
            },
            'unreconciled_records': unreconciled,
            'reconciliation_complete': len(unreconciled) == 0
        }
