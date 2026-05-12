from flask import Blueprint, request
from app import db
from app.models import (
    MedicationPlan, MedicationConfirmation, MissedDose, MakeupApproval,
    Prescription, Resident, Nurse, MedicationInventory, InventoryDeduction,
    ManualCorrection, ExceptionRecord, ExceptionType, ExceptionStatus,
    DoseStatus, PrescriptionStatus
)
from app.utils import (
    success_response, error_response, validate_request,
    generate_request_id, get_current_user, parse_date, parse_time,
    is_within_missed_window
)
from datetime import datetime, timedelta
from config import Config

bp = Blueprint('medication', __name__)


@bp.route('/plans', methods=['GET'])
def list_plans():
    resident_id = request.args.get('resident_id')
    date = request.args.get('date')
    status = request.args.get('status')
    
    query = MedicationPlan.query
    if resident_id:
        query = query.filter_by(resident_id=resident_id)
    if date:
        d = parse_date(date)
        if d:
            query = query.filter_by(dose_date=d)
    if status:
        try:
            status_enum = DoseStatus(status)
            query = query.filter_by(status=status_enum)
        except ValueError:
            pass
    
    plans = query.order_by(MedicationPlan.dose_date, MedicationPlan.dose_time).all()
    
    result = []
    for plan in plans:
        plan_dict = plan.to_dict(include_details=True)
        prescription = Prescription.query.get(plan.prescription_id)
        resident = Resident.query.get(plan.resident_id)
        if prescription:
            plan_dict['medication_name'] = prescription.medication_name
        if resident:
            plan_dict['resident_name'] = resident.name
        result.append(plan_dict)
    
    return success_response(result)


@bp.route('/plans/<plan_id>', methods=['GET'])
def get_plan(plan_id):
    plan = MedicationPlan.query.get(plan_id)
    if not plan:
        return error_response('用药计划不存在', 404, 'NOT_FOUND')
    
    plan_dict = plan.to_dict(include_details=True)
    prescription = Prescription.query.get(plan.prescription_id)
    resident = Resident.query.get(plan.resident_id)
    if prescription:
        plan_dict['medication_name'] = prescription.medication_name
    if resident:
        plan_dict['resident_name'] = resident.name
    
    return success_response(plan_dict)


@bp.route('/plans', methods=['POST'])
@validate_request(['id', 'resident_id', 'prescription_id', 'dose_date', 'dose_time'])
def create_plan():
    data = request.get_json()
    
    if MedicationPlan.query.get(data['id']):
        return error_response('用药计划ID已存在', 409, 'DUPLICATE_ID')
    
    prescription = Prescription.query.get(data['prescription_id'])
    if not prescription:
        return error_response('医嘱不存在', 400, 'PRESCRIPTION_NOT_FOUND')
    
    if prescription.status != PrescriptionStatus.ACTIVE:
        return error_response(
            f'医嘱状态为"{prescription.status.value}"，无法创建用药计划',
            400, 'PRESCRIPTION_NOT_ACTIVE'
        )
    
    if prescription.resident_id != data['resident_id']:
        return error_response('医嘱与老人不匹配', 400, 'RESIDENT_MISMATCH')
    
    if not Resident.query.get(data['resident_id']):
        return error_response('老人档案不存在', 400, 'RESIDENT_NOT_FOUND')
    
    plan = MedicationPlan(
        id=data['id'],
        resident_id=data['resident_id'],
        prescription_id=data['prescription_id'],
        dose_date=parse_date(data['dose_date']),
        dose_time=parse_time(data['dose_time']),
        dosage=data.get('dosage') or prescription.dosage,
        status=DoseStatus.SCHEDULED
    )
    
    db.session.add(plan)
    db.session.commit()
    
    return success_response(plan.to_dict(), '用药计划创建成功', 201)


@bp.route('/confirm', methods=['POST'])
@validate_request(['request_id', 'plan_id', 'nurse_id'])
def confirm_medication():
    data = request.get_json()
    request_id = data['request_id']
    
    existing = MedicationConfirmation.query.filter_by(request_id=request_id).first()
    if existing:
        plan = MedicationPlan.query.get(existing.medication_plan_id)
        return success_response({
            'is_idempotent': True,
            'existing_confirmation': existing.to_dict(),
            'current_status': plan.status.value if plan else None
        }, '重复请求，返回已存在的确认记录（幂等性保证）')
    
    plan = MedicationPlan.query.get(data['plan_id'])
    if not plan:
        return error_response('用药计划不存在', 404, 'NOT_FOUND')
    
    prescription = Prescription.query.get(plan.prescription_id)
    if prescription and prescription.status == PrescriptionStatus.DISCONTINUED:
        exception = ExceptionRecord(
            request_id=generate_request_id(),
            exception_type=ExceptionType.PRESCRIPTION_STOPPED,
            status=ExceptionStatus.OPEN,
            resident_id=plan.resident_id,
            medication_plan_id=plan.id,
            medication_name=prescription.medication_name if prescription else None,
            nurse_id=data['nurse_id'],
            description='尝试为已停用的医嘱确认用药',
            details=f'用药计划 {plan.id} 的医嘱 {plan.prescription_id} 已停用'
        )
        db.session.add(exception)
        db.session.commit()
        
        return error_response(
            '医嘱已停用，无法确认用药',
            400, 'PRESCRIPTION_DISCONTINUED',
            details={'exception_id': exception.id}
        )
    
    if plan.status == DoseStatus.CONFIRMED:
        nurse = Nurse.query.get(data['nurse_id'])
        exception = ExceptionRecord(
            request_id=generate_request_id(),
            exception_type=ExceptionType.DUPLICATE_CONFIRMATION,
            status=ExceptionStatus.OPEN,
            resident_id=plan.resident_id,
            medication_plan_id=plan.id,
            medication_name=prescription.medication_name if prescription else None,
            nurse_id=data['nurse_id'],
            nurse_name=nurse.name if nurse else None,
            description='同一时段重复确认用药',
            details=f'用药计划 {plan.id} 已经确认过，状态为已确认'
        )
        db.session.add(exception)
        db.session.commit()
        
        return error_response(
            '同一时段已确认过用药，请勿重复操作',
            400, 'DUPLICATE_CONFIRMATION',
            details={'exception_id': exception.id, 'current_status': plan.status.value}
        )
    
    if plan.status not in [DoseStatus.SCHEDULED, DoseStatus.MAKEUP_APPROVED]:
        return error_response(
            f'当前状态"{plan.status.value}"不允许确认',
            400, 'INVALID_STATUS'
        )
    
    if not Nurse.query.get(data['nurse_id']):
        return error_response('护理员不存在', 400, 'NURSE_NOT_FOUND')
    
    inventory_issue = None
    if prescription:
        inventory = MedicationInventory.query.filter_by(
            medication_name=prescription.medication_name
        ).first()
        
        if inventory:
            if inventory.quantity < 1:
                nurse = Nurse.query.get(data['nurse_id'])
                resident = Resident.query.get(plan.resident_id)
                
                exception = ExceptionRecord(
                    request_id=generate_request_id(),
                    exception_type=ExceptionType.INVENTORY_SHORTAGE,
                    status=ExceptionStatus.OPEN,
                    resident_id=plan.resident_id,
                    resident_name=resident.name if resident else None,
                    medication_plan_id=plan.id,
                    medication_name=prescription.medication_name,
                    nurse_id=data['nurse_id'],
                    nurse_name=nurse.name if nurse else None,
                    description='库存不足，无法发药',
                    details=f'药品 {prescription.medication_name} 当前库存为 {inventory.quantity} {inventory.unit}'
                )
                db.session.add(exception)
                db.session.commit()
                
                return error_response(
                    f'库存不足：{prescription.medication_name} 仅剩 {inventory.quantity} {inventory.unit}',
                    400, 'INVENTORY_SHORTAGE',
                    details={
                        'exception_id': exception.id,
                        'inventory_id': inventory.id,
                        'current_quantity': inventory.quantity
                    }
                )
            
            deduction_request_id = generate_request_id()
            deduction = InventoryDeduction(
                request_id=deduction_request_id,
                inventory_id=inventory.id,
                medication_plan_id=plan.id,
                quantity=1,
                nurse_id=data['nurse_id'],
                reason='正常发药'
            )
            db.session.add(deduction)
            
            inventory.quantity -= 1
            inventory_issue = {'deducted': True, 'inventory_id': inventory.id}
    
    is_makeup = plan.status == DoseStatus.MAKEUP_APPROVED
    
    confirmation = MedicationConfirmation(
        medication_plan_id=plan.id,
        request_id=request_id,
        nurse_id=data['nurse_id'],
        notes=data.get('notes'),
        is_makeup=is_makeup
    )
    db.session.add(confirmation)
    
    old_status = plan.status.value
    plan.status = DoseStatus.MAKEUP_ADMINISTERED if is_makeup else DoseStatus.CONFIRMED
    
    user_id, user_name = get_current_user()
    if is_makeup:
        status_change = ManualCorrection(
            request_id=generate_request_id(),
            corrected_by=user_id,
            corrected_by_name=user_name,
            target_model='MedicationPlan',
            target_id=plan.id,
            field_name='status',
            old_value=old_status,
            new_value=plan.status.value,
            reason='补服确认'
        )
        db.session.add(status_change)
    
    db.session.commit()
    
    result = plan.to_dict(include_details=True)
    result['confirmation'] = confirmation.to_dict()
    if inventory_issue:
        result['inventory_deduction'] = inventory_issue
    
    return success_response(result, f'用药确认成功（{"补服" if is_makeup else "正常服药"}）')


@bp.route('/missed', methods=['POST'])
@validate_request(['request_id', 'plan_id', 'nurse_id', 'reason'])
def register_missed():
    data = request.get_json()
    request_id = data['request_id']
    
    existing = MissedDose.query.filter_by(request_id=request_id).first()
    if existing:
        plan = MedicationPlan.query.get(existing.medication_plan_id)
        return success_response({
            'is_idempotent': True,
            'existing_record': existing.to_dict(),
            'current_status': plan.status.value if plan else None
        }, '重复请求，返回已存在的漏服记录（幂等性保证）')
    
    plan = MedicationPlan.query.get(data['plan_id'])
    if not plan:
        return error_response('用药计划不存在', 404, 'NOT_FOUND')
    
    if plan.status != DoseStatus.SCHEDULED:
        return error_response(
            f'当前状态"{plan.status.value}"不允许登记漏服',
            400, 'INVALID_STATUS'
        )
    
    if not Nurse.query.get(data['nurse_id']):
        return error_response('护理员不存在', 400, 'NURSE_NOT_FOUND')
    
    prescription = Prescription.query.get(plan.prescription_id)
    resident = Resident.query.get(plan.resident_id)
    nurse = Nurse.query.get(data['nurse_id'])
    
    scheduled_datetime = datetime.combine(plan.dose_date, plan.dose_time)
    within_window = is_within_missed_window(scheduled_datetime)
    
    missed = MissedDose(
        medication_plan_id=plan.id,
        request_id=request_id,
        registered_by=data['nurse_id'],
        reason=data['reason'],
        makeup_attempted=False,
        makeup_approved=False
    )
    db.session.add(missed)
    
    old_status = plan.status.value
    plan.status = DoseStatus.MISSED
    
    exception = ExceptionRecord(
        request_id=generate_request_id(),
        exception_type=ExceptionType.MISSED_DOSE,
        status=ExceptionStatus.OPEN,
        resident_id=plan.resident_id,
        resident_name=resident.name if resident else None,
        medication_plan_id=plan.id,
        medication_name=prescription.medication_name if prescription else None,
        nurse_id=data['nurse_id'],
        nurse_name=nurse.name if nurse else None,
        description='漏服登记',
        details=f'漏服原因: {data["reason"]}，补服窗口剩余: {"在窗口内" if within_window else "已超过窗口"}'
    )
    db.session.add(exception)
    
    if not within_window:
        window_exception = ExceptionRecord(
            request_id=generate_request_id(),
            exception_type=ExceptionType.MISSED_WINDOW_EXCEEDED,
            status=ExceptionStatus.OPEN,
            resident_id=plan.resident_id,
            resident_name=resident.name if resident else None,
            medication_plan_id=plan.id,
            medication_name=prescription.medication_name if prescription else None,
            description=f'漏服超过补服窗口（{Config.MISSED_DOSE_WINDOW_HOURS}小时）',
            details=f'计划时间: {scheduled_datetime}，超过补服窗口，无法补服'
        )
        db.session.add(window_exception)
    
    user_id, user_name = get_current_user()
    status_change = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='MedicationPlan',
        target_id=plan.id,
        field_name='status',
        old_value=old_status,
        new_value=DoseStatus.MISSED.value,
        reason=f'漏服登记: {data["reason"]}'
    )
    db.session.add(status_change)
    
    db.session.commit()
    
    result = plan.to_dict(include_details=True)
    result['missed_record'] = missed.to_dict()
    result['can_makeup'] = within_window
    result['window_hours'] = Config.MISSED_DOSE_WINDOW_HOURS
    
    return success_response(
        result, 
        f'漏服登记成功{"，可以申请补服" if within_window else "，已超过补服窗口"}'
    )


@bp.route('/makeup/request', methods=['POST'])
@validate_request(['request_id', 'plan_id', 'nurse_id'])
def request_makeup():
    data = request.get_json()
    request_id = data['request_id']
    
    existing = MakeupApproval.query.filter_by(request_id=request_id).first()
    if existing:
        return success_response({
            'is_idempotent': True,
            'existing_approval': existing.to_dict()
        }, '重复请求，返回已存在的申请记录（幂等性保证）')
    
    plan = MedicationPlan.query.get(data['plan_id'])
    if not plan:
        return error_response('用药计划不存在', 404, 'NOT_FOUND')
    
    if plan.status != DoseStatus.MISSED:
        return error_response(
            f'当前状态"{plan.status.value}"不允许申请补服',
            400, 'INVALID_STATUS'
        )
    
    scheduled_datetime = datetime.combine(plan.dose_date, plan.dose_time)
    if not is_within_missed_window(scheduled_datetime):
        prescription = Prescription.query.get(plan.prescription_id)
        resident = Resident.query.get(plan.resident_id)
        
        exception = ExceptionRecord(
            request_id=generate_request_id(),
            exception_type=ExceptionType.MISSED_WINDOW_EXCEEDED,
            status=ExceptionStatus.OPEN,
            resident_id=plan.resident_id,
            resident_name=resident.name if resident else None,
            medication_plan_id=plan.id,
            medication_name=prescription.medication_name if prescription else None,
            nurse_id=data['nurse_id'],
            description='尝试为超过补服窗口的漏服申请补服',
            details=f'计划时间: {scheduled_datetime}，已超过 {Config.MISSED_DOSE_WINDOW_HOURS} 小时补服窗口'
        )
        db.session.add(exception)
        db.session.commit()
        
        return error_response(
            f'已超过补服窗口（{Config.MISSED_DOSE_WINDOW_HOURS}小时），无法申请补服',
            400, 'WINDOW_EXCEEDED',
            details={'exception_id': exception.id}
        )
    
    old_status = plan.status.value
    plan.status = DoseStatus.MAKEUP_REQUESTED
    
    approval = MakeupApproval(
        medication_plan_id=plan.id,
        request_id=request_id,
        requested_by=data['nurse_id'],
        status='PENDING',
        reason=data.get('reason')
    )
    db.session.add(approval)
    
    missed = MissedDose.query.filter_by(medication_plan_id=plan.id).first()
    if missed:
        missed.makeup_attempted = True
    
    user_id, user_name = get_current_user()
    status_change = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='MedicationPlan',
        target_id=plan.id,
        field_name='status',
        old_value=old_status,
        new_value=DoseStatus.MAKEUP_REQUESTED.value,
        reason='补服申请'
    )
    db.session.add(status_change)
    
    db.session.commit()
    
    return success_response({
        'plan': plan.to_dict(include_details=True),
        'approval': approval.to_dict()
    }, '补服申请已提交，等待审批')


@bp.route('/makeup/approve', methods=['POST'])
@validate_request(['request_id', 'plan_id', 'nurse_id'])
def approve_makeup():
    data = request.get_json()
    request_id = data['request_id']
    
    plan = MedicationPlan.query.get(data['plan_id'])
    if not plan:
        return error_response('用药计划不存在', 404, 'NOT_FOUND')
    
    if plan.status != DoseStatus.MAKEUP_REQUESTED:
        return error_response(
            f'当前状态"{plan.status.value}"不允许审批补服',
            400, 'INVALID_STATUS'
        )
    
    approval = MakeupApproval.query.filter_by(
        medication_plan_id=plan.id,
        status='PENDING'
    ).first()
    
    if not approval:
        return error_response('没有待审批的补服申请', 400, 'NO_PENDING_APPROVAL')
    
    old_status = plan.status.value
    plan.status = DoseStatus.MAKEUP_APPROVED
    
    approval.approved_by = data['nurse_id']
    approval.approved_at = datetime.utcnow()
    approval.status = 'APPROVED'
    approval.request_id = request_id
    
    missed = MissedDose.query.filter_by(medication_plan_id=plan.id).first()
    if missed:
        missed.makeup_approved = True
    
    user_id, user_name = get_current_user()
    status_change = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='MedicationPlan',
        target_id=plan.id,
        field_name='status',
        old_value=old_status,
        new_value=DoseStatus.MAKEUP_APPROVED.value,
        reason='补服审批通过'
    )
    db.session.add(status_change)
    
    db.session.commit()
    
    return success_response({
        'plan': plan.to_dict(include_details=True),
        'approval': approval.to_dict()
    }, '补服申请已批准，可以执行补服')


@bp.route('/makeup/deny', methods=['POST'])
@validate_request(['request_id', 'plan_id', 'nurse_id', 'reason'])
def deny_makeup():
    data = request.get_json()
    request_id = data['request_id']
    
    plan = MedicationPlan.query.get(data['plan_id'])
    if not plan:
        return error_response('用药计划不存在', 404, 'NOT_FOUND')
    
    if plan.status != DoseStatus.MAKEUP_REQUESTED:
        return error_response(
            f'当前状态"{plan.status.value}"不允许拒绝补服',
            400, 'INVALID_STATUS'
        )
    
    approval = MakeupApproval.query.filter_by(
        medication_plan_id=plan.id,
        status='PENDING'
    ).first()
    
    if not approval:
        return error_response('没有待审批的补服申请', 400, 'NO_PENDING_APPROVAL')
    
    old_status = plan.status.value
    plan.status = DoseStatus.MAKEUP_DENIED
    
    approval.approved_by = data['nurse_id']
    approval.approved_at = datetime.utcnow()
    approval.status = 'DENIED'
    approval.request_id = request_id
    approval.reason = data['reason']
    
    user_id, user_name = get_current_user()
    status_change = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='MedicationPlan',
        target_id=plan.id,
        field_name='status',
        old_value=old_status,
        new_value=DoseStatus.MAKEUP_DENIED.value,
        reason=f'补服被拒绝: {data["reason"]}'
    )
    db.session.add(status_change)
    
    db.session.commit()
    
    return success_response({
        'plan': plan.to_dict(include_details=True),
        'approval': approval.to_dict()
    }, '补服申请已拒绝')
