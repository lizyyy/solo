from flask import Blueprint, request
from app import db
from app.models import (
    ShiftHandover, HandoverChecklist, MedicationPlan, Prescription,
    Resident, Nurse, DoseStatus, ShiftStatus, ExceptionRecord,
    ExceptionType, ExceptionStatus, ManualCorrection
)
from app.utils import (
    success_response, error_response, validate_request,
    generate_request_id, get_current_user, parse_date
)
from datetime import datetime

bp = Blueprint('handover', __name__)


@bp.route('', methods=['GET'])
def list_handovers():
    date = request.args.get('date')
    status = request.args.get('status')
    
    query = ShiftHandover.query
    if date:
        d = parse_date(date)
        if d:
            query = query.filter_by(shift_date=d)
    if status:
        try:
            status_enum = ShiftStatus(status)
            query = query.filter_by(status=status_enum)
        except ValueError:
            pass
    
    handovers = query.order_by(ShiftHandover.shift_date.desc()).all()
    return success_response([h.to_dict() for h in handovers])


@bp.route('/<handover_id>', methods=['GET'])
def get_handover(handover_id):
    handover = ShiftHandover.query.get(handover_id)
    if not handover:
        return error_response('交接班记录不存在', 404, 'NOT_FOUND')
    
    include_checklist = request.args.get('checklist', 'false').lower() == 'true'
    return success_response(handover.to_dict(include_checklist=include_checklist))


@bp.route('/create', methods=['POST'])
@validate_request(['id', 'shift_date', 'shift_type', 'outgoing_nurse_id'])
def create_handover():
    data = request.get_json()
    
    if ShiftHandover.query.get(data['id']):
        return error_response('交接班ID已存在', 409, 'DUPLICATE_ID')
    
    shift_date = parse_date(data['shift_date'])
    shift_type = data['shift_type']
    
    time_ranges = {
        'morning': ('06:00', '14:00'),
        'afternoon': ('14:00', '22:00'),
        'night': ('22:00', '06:00')
    }
    
    handover = ShiftHandover(
        id=data['id'],
        shift_date=shift_date,
        shift_type=shift_type,
        outgoing_nurse_id=data['outgoing_nurse_id'],
        incoming_nurse_id=data.get('incoming_nurse_id'),
        status=ShiftStatus.PENDING,
        notes=data.get('notes')
    )
    db.session.add(handover)
    
    start_time, end_time = time_ranges.get(shift_type, ('00:00', '23:59'))
    
    if shift_type == 'night':
        next_day = shift_date
        from datetime import timedelta
        end_date = shift_date + timedelta(days=1)
        
        plans = MedicationPlan.query.filter(
            (
                (MedicationPlan.dose_date == shift_date) &
                (MedicationPlan.dose_time >= start_time)
            ) | (
                (MedicationPlan.dose_date == end_date) &
                (MedicationPlan.dose_time <= end_time)
            )
        ).all()
    else:
        plans = MedicationPlan.query.filter_by(dose_date=shift_date).all()
        plans = [p for p in plans if start_time <= str(p.dose_time)[:5] <= end_time]
    
    for plan in plans:
        prescription = Prescription.query.get(plan.prescription_id)
        resident = Resident.query.get(plan.resident_id)
        
        checklist = HandoverChecklist(
            handover_id=handover.id,
            medication_plan_id=plan.id,
            resident_name=resident.name if resident else None,
            medication_name=prescription.medication_name if prescription else None,
            dose_time=str(plan.dose_time)[:5],
            planned_status=plan.status.value,
            actual_status=plan.status.value,
            checked=False
        )
        db.session.add(checklist)
    
    db.session.commit()
    
    return success_response(
        handover.to_dict(include_checklist=True),
        f'交接班已创建，包含 {len(plans)} 条用药计划'
    )


@bp.route('/<handover_id>/check', methods=['POST'])
@validate_request(['checklist_id', 'checked', 'nurse_id'])
def update_checklist(handover_id):
    data = request.get_json()
    
    handover = ShiftHandover.query.get(handover_id)
    if not handover:
        return error_response('交接班记录不存在', 404, 'NOT_FOUND')
    
    if handover.status == ShiftStatus.CONFIRMED:
        return error_response('交接班已确认，无法修改', 400, 'ALREADY_CONFIRMED')
    
    checklist = HandoverChecklist.query.get(data['checklist_id'])
    if not checklist or checklist.handover_id != handover_id:
        return error_response('核对项不存在', 404, 'NOT_FOUND')
    
    old_checked = checklist.checked
    checklist.checked = data['checked']
    if 'notes' in data:
        checklist.notes = data['notes']
    
    user_id, user_name = get_current_user()
    correction = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='HandoverChecklist',
        target_id=str(checklist.id),
        field_name='checked',
        old_value=str(old_checked),
        new_value=str(data['checked']),
        reason='交接班核对'
    )
    db.session.add(correction)
    
    db.session.commit()
    
    return success_response(checklist.to_dict(), '核对项已更新')


@bp.route('/<handover_id>/confirm', methods=['POST'])
@validate_request(['incoming_nurse_id'])
def confirm_handover(handover_id):
    handover = ShiftHandover.query.get(handover_id)
    if not handover:
        return error_response('交接班记录不存在', 404, 'NOT_FOUND')
    
    if handover.status == ShiftStatus.CONFIRMED:
        return success_response({
            'is_idempotent': True,
            'handover': handover.to_dict()
        }, '重复请求，交接班已确认（幂等性保证）')
    
    handover.incoming_nurse_id = data['incoming_nurse_id']
    
    checklist = HandoverChecklist.query.filter_by(handover_id=handover_id).all()
    unchecked = [c for c in checklist if not c.checked]
    
    has_abnormal = False
    for item in checklist:
        plan = MedicationPlan.query.get(item.medication_plan_id)
        if plan and plan.status in [DoseStatus.MISSED, DoseStatus.SKIPPED]:
            has_abnormal = True
            item.actual_status = plan.status.value
        
        if item.planned_status != item.actual_status:
            has_abnormal = True
    
    old_status = handover.status.value
    handover.status = ShiftStatus.ABNORMAL if has_abnormal else ShiftStatus.CONFIRMED
    handover.confirmed_at = datetime.utcnow()
    
    user_id, user_name = get_current_user()
    correction = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='ShiftHandover',
        target_id=handover_id,
        field_name='status',
        old_value=old_status,
        new_value=handover.status.value,
        reason='交接班确认'
    )
    db.session.add(correction)
    
    if unchecked:
        exception = ExceptionRecord(
            request_id=generate_request_id(),
            exception_type=ExceptionType.SHIFT_NOT_CONFIRMED,
            status=ExceptionStatus.OPEN,
            description=f'交接班有 {len(unchecked)} 个核对项未确认',
            details=f'未确认项: {[c.id for c in unchecked]}'
        )
        db.session.add(exception)
    
    db.session.commit()
    
    return success_response(
        handover.to_dict(include_checklist=True),
        f'交接班确认完成（状态: {handover.status.value}），未确认项: {len(unchecked)}'
    )
