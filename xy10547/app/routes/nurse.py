from flask import Blueprint, request
from app import db
from app.models import Nurse
from app.utils import success_response, error_response, validate_request

bp = Blueprint('nurse', __name__)


@bp.route('', methods=['GET'])
def list_nurses():
    nurses = Nurse.query.all()
    return success_response([n.to_dict() for n in nurses])


@bp.route('/<nurse_id>', methods=['GET'])
def get_nurse(nurse_id):
    nurse = Nurse.query.get(nurse_id)
    if not nurse:
        return error_response('护理员不存在', 404, 'NOT_FOUND')
    return success_response(nurse.to_dict())


@bp.route('', methods=['POST'])
@validate_request(['id', 'name'])
def create_nurse():
    data = request.get_json()
    
    if Nurse.query.get(data['id']):
        return error_response('护理员ID已存在', 409, 'DUPLICATE_ID')
    
    nurse = Nurse(
        id=data['id'],
        name=data['name'],
        role=data.get('role'),
        phone=data.get('phone')
    )
    
    db.session.add(nurse)
    db.session.commit()
    
    return success_response(nurse.to_dict(), '护理员创建成功', 201)
