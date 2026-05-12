from flask import Blueprint, request
from app import db
from app.models import Resident, ManualCorrection
from app.utils import (
    success_response, error_response, validate_request,
    generate_request_id, get_current_user, parse_date
)

bp = Blueprint('resident', __name__)


@bp.route('', methods=['GET'])
def list_residents():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = Resident.query.paginate(page=page, per_page=per_page, error_out=False)
    
    return success_response({
        'items': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@bp.route('/<resident_id>', methods=['GET'])
def get_resident(resident_id):
    resident = Resident.query.get(resident_id)
    if not resident:
        return error_response('老人档案不存在', 404, 'NOT_FOUND')
    
    return success_response(resident.to_dict())


@bp.route('', methods=['POST'])
@validate_request(['id', 'name'])
def create_resident():
    data = request.get_json()
    
    if Resident.query.get(data['id']):
        return error_response('老人ID已存在', 409, 'DUPLICATE_ID')
    
    resident = Resident(
        id=data['id'],
        name=data['name'],
        gender=data.get('gender'),
        age=data.get('age'),
        room_number=data.get('room_number'),
        bed_number=data.get('bed_number'),
        admission_date=parse_date(data.get('admission_date')),
        notes=data.get('notes')
    )
    
    db.session.add(resident)
    db.session.commit()
    
    return success_response(resident.to_dict(), '老人档案创建成功', 201)


@bp.route('/<resident_id>', methods=['PUT'])
def update_resident(resident_id):
    resident = Resident.query.get(resident_id)
    if not resident:
        return error_response('老人档案不存在', 404, 'NOT_FOUND')
    
    data = request.get_json()
    user_id, user_name = get_current_user()
    
    changes = []
    fields = ['name', 'gender', 'age', 'room_number', 'bed_number', 'notes']
    
    for field in fields:
        if field in data and getattr(resident, field) != data[field]:
            old_val = str(getattr(resident, field))
            new_val = str(data[field])
            
            changes.append({
                'field': field,
                'old': old_val,
                'new': new_val
            })
            
            setattr(resident, field, data[field])
    
    if 'admission_date' in data:
        new_date = parse_date(data['admission_date'])
        if resident.admission_date != new_date:
            changes.append({
                'field': 'admission_date',
                'old': str(resident.admission_date),
                'new': str(new_date)
            })
            resident.admission_date = new_date
    
    for change in changes:
        correction = ManualCorrection(
            request_id=generate_request_id(),
            corrected_by=user_id,
            corrected_by_name=user_name,
            target_model='Resident',
            target_id=resident_id,
            field_name=change['field'],
            old_value=change['old'],
            new_value=change['new'],
            reason='老人信息更新'
        )
        db.session.add(correction)
    
    db.session.commit()
    
    return success_response({
        'resident': resident.to_dict(),
        'changes': changes
    }, '老人档案更新成功')


@bp.route('/<resident_id>', methods=['DELETE'])
def delete_resident(resident_id):
    resident = Resident.query.get(resident_id)
    if not resident:
        return error_response('老人档案不存在', 404, 'NOT_FOUND')
    
    db.session.delete(resident)
    db.session.commit()
    
    return success_response(message='老人档案已删除')
