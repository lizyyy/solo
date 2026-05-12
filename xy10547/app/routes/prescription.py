from flask import Blueprint, request
from app import db
from app.models import (
    Prescription, PrescriptionHistory, Resident, MedicationPlan,
    ManualCorrection, ExceptionRecord, ExceptionType, ExceptionStatus,
    DoseStatus, PrescriptionStatus
)
from app.utils import (
    success_response, error_response, validate_request,
    generate_request_id, get_current_user, parse_date
)
from datetime import datetime

bp = Blueprint('prescription', __name__)


@bp.route('', methods=['GET'])
def list_prescriptions():
    resident_id = request.args.get('resident_id')
    status = request.args.get('status')
    
    query = Prescription.query
    if resident_id:
        query = query.filter_by(resident_id=resident_id)
    if status:
        try:
            status_enum = PrescriptionStatus(status)
            query = query.filter_by(status=status_enum)
        except ValueError:
            pass
    
    prescriptions = query.all()
    return success_response([p.to_dict() for p in prescriptions])


@bp.route('/<prescription_id>', methods=['GET'])
def get_prescription(prescription_id):
    prescription = Prescription.query.get(prescription_id)
    if not prescription:
        return error_response('医嘱不存在', 404, 'NOT_FOUND')
    
    include_history = request.args.get('history', 'false').lower() == 'true'
    return success_response(prescription.to_dict(include_history=include_history))


@bp.route('', methods=['POST'])
@validate_request(['id', 'resident_id', 'medication_name', 'dosage', 'frequency', 'start_date'])
def create_prescription():
    data = request.get_json()
    
    if Prescription.query.get(data['id']):
        return error_response('医嘱ID已存在', 409, 'DUPLICATE_ID')
    
    if not Resident.query.get(data['resident_id']):
        return error_response('老人档案不存在', 400, 'RESIDENT_NOT_FOUND')
    
    medication_type = data.get('medication_type', '口服')
    try:
        from app.models import MedicationType
        med_type_enum = MedicationType(medication_type)
    except ValueError:
        med_type_enum = MedicationType.ORAL
    
    prescription = Prescription(
        id=data['id'],
        resident_id=data['resident_id'],
        medication_name=data['medication_name'],
        medication_type=med_type_enum,
        dosage=data['dosage'],
        frequency=data['frequency'],
        start_date=parse_date(data['start_date']),
        end_date=parse_date(data.get('end_date')),
        status=PrescriptionStatus.ACTIVE,
        prescribed_by=data.get('prescribed_by'),
        notes=data.get('notes')
    )
    
    db.session.add(prescription)
    db.session.commit()
    
    return success_response(prescription.to_dict(), '医嘱创建成功', 201)


@bp.route('/<prescription_id>/discontinue', methods=['POST'])
@validate_request(['reason'])
def discontinue_prescription(prescription_id):
    prescription = Prescription.query.get(prescription_id)
    if not prescription:
        return error_response('医嘱不存在', 404, 'NOT_FOUND')
    
    if prescription.status == PrescriptionStatus.DISCONTINUED:
        return error_response('医嘱已经停用', 400, 'ALREADY_DISCONTINUED')
    
    data = request.get_json()
    user_id, user_name = get_current_user()
    
    old_status = prescription.status.value
    prescription.status = PrescriptionStatus.DISCONTINUED
    
    history = PrescriptionHistory(
        prescription_id=prescription_id,
        field_name='status',
        old_value=old_status,
        new_value=PrescriptionStatus.DISCONTINUED.value,
        changed_by=user_name,
        reason=data['reason']
    )
    db.session.add(history)
    
    affected_plans = MedicationPlan.query.filter_by(
        prescription_id=prescription_id,
        status=DoseStatus.SCHEDULED
    ).all()
    
    for plan in affected_plans:
        plan.status = DoseStatus.SKIPPED
        
        exception = ExceptionRecord(
            request_id=generate_request_id(),
            exception_type=ExceptionType.PRESCRIPTION_STOPPED,
            status=ExceptionStatus.RESOLVED,
            resident_id=prescription.resident_id,
            resident_name=prescription.resident.name if prescription.resident else None,
            medication_plan_id=plan.id,
            medication_name=prescription.medication_name,
            description=f'医嘱停用，跳过用药计划: {plan.dose_date} {plan.dose_time}',
            details=f'医嘱 {prescription_id} 已停用，原因: {data["reason"]}',
            resolved_at=datetime.utcnow(),
            resolved_by=user_name,
            resolution_notes='医嘱停用自动处理'
        )
        db.session.add(exception)
    
    correction = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='Prescription',
        target_id=prescription_id,
        field_name='status',
        old_value=old_status,
        new_value=PrescriptionStatus.DISCONTINUED.value,
        reason=data['reason']
    )
    db.session.add(correction)
    
    db.session.commit()
    
    return success_response({
        'prescription': prescription.to_dict(include_history=True),
        'affected_plans_count': len(affected_plans),
        'affected_plans': [p.id for p in affected_plans]
    }, f'医嘱已停用，影响 {len(affected_plans)} 个待执行用药计划')


@bp.route('/<prescription_id>', methods=['PUT'])
def update_prescription(prescription_id):
    prescription = Prescription.query.get(prescription_id)
    if not prescription:
        return error_response('医嘱不存在', 404, 'NOT_FOUND')
    
    data = request.get_json()
    user_id, user_name = get_current_user()
    
    changes = []
    
    for field in ['medication_name', 'dosage', 'frequency', 'prescribed_by', 'notes']:
        if field in data and getattr(prescription, field) != data[field]:
            old_val = str(getattr(prescription, field))
            new_val = str(data[field])
            
            changes.append({'field': field, 'old': old_val, 'new': new_val})
            setattr(prescription, field, data[field])
    
    for field in ['start_date', 'end_date']:
        if field in data:
            new_date = parse_date(data[field])
            if getattr(prescription, field) != new_date:
                changes.append({
                    'field': field,
                    'old': str(getattr(prescription, field)),
                    'new': str(new_date)
                })
                setattr(prescription, field, new_date)
    
    for change in changes:
        history = PrescriptionHistory(
            prescription_id=prescription_id,
            field_name=change['field'],
            old_value=change['old'],
            new_value=change['new'],
            changed_by=user_name,
            reason='医嘱更新'
        )
        db.session.add(history)
        
        correction = ManualCorrection(
            request_id=generate_request_id(),
            corrected_by=user_id,
            corrected_by_name=user_name,
            target_model='Prescription',
            target_id=prescription_id,
            field_name=change['field'],
            old_value=change['old'],
            new_value=change['new'],
            reason='医嘱更新'
        )
        db.session.add(correction)
    
    db.session.commit()
    
    return success_response({
        'prescription': prescription.to_dict(include_history=True),
        'changes': changes
    }, '医嘱更新成功')
