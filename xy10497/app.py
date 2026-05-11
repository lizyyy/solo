#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
医院床位周转API
支持：病区管理、床位管理、预约入院、确认占床、转科、出院、清洁完成、释放床位
规则：同一床位并发分配拦截、未清洁不能入住、转科原床位释放、重复出院幂等
"""

from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_AS_ASCII'] = False

db = SQLAlchemy(app)


class Ward(db.Model):
    """病区表"""
    __tablename__ = 'wards'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    beds = db.relationship('Bed', backref='ward', lazy=True)


class Bed(db.Model):
    """床位表"""
    __tablename__ = 'beds'
    id = db.Column(db.Integer, primary_key=True)
    bed_number = db.Column(db.String(50), nullable=False)
    ward_id = db.Column(db.Integer, db.ForeignKey('wards.id'), nullable=False)
    status = db.Column(db.String(20), default='available', nullable=False)
    is_clean = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('ward_id', 'bed_number', name='uq_ward_bed'),)


class Patient(db.Model):
    """患者表"""
    __tablename__ = 'patients'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.String(10))
    age = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class BedOccupy(db.Model):
    """床位占用记录表 - 完整记录每次床位使用周期"""
    __tablename__ = 'bed_occupies'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    bed_id = db.Column(db.Integer, db.ForeignKey('beds.id'), nullable=False)
    
    reservation_id = db.Column(db.String(100), unique=True, nullable=False)
    admission_id = db.Column(db.String(100), unique=True)
    discharge_id = db.Column(db.String(100), unique=True)
    
    status = db.Column(db.String(30), nullable=False, default='reserved')
    is_transfer_source = db.Column(db.Boolean, default=False)
    is_transfer_target = db.Column(db.Boolean, default=False)
    transfer_from_id = db.Column(db.Integer, db.ForeignKey('bed_occupies.id'))
    
    reserved_at = db.Column(db.DateTime)
    admitted_at = db.Column(db.DateTime)
    discharged_at = db.Column(db.DateTime)
    cleaned_at = db.Column(db.DateTime)
    released_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    patient = db.relationship('Patient', backref=db.backref('occupies', lazy=True))
    bed = db.relationship('Bed', backref=db.backref('occupies', lazy=True))


STATUS_ORDER = ['reserved', 'admitted', 'discharged', 'cleaned', 'released']

BED_STATUS_AVAILABLE = 'available'
BED_STATUS_RESERVED = 'reserved'
BED_STATUS_OCCUPIED = 'occupied'
BED_STATUS_DIRTY = 'dirty'
BED_STATUS_CLEANING = 'cleaning'


def get_utc_now():
    return datetime.utcnow()


def is_valid_status_transition(current, target):
    if current == target:
        return True
    try:
        return STATUS_ORDER.index(target) >= STATUS_ORDER.index(current)
    except ValueError:
        return False


def serialize_model(obj, exclude=None):
    if exclude is None:
        exclude = []
    data = {}
    for column in obj.__table__.columns:
        if column.name in exclude:
            continue
        value = getattr(obj, column.name)
        if isinstance(value, datetime):
            data[column.name] = value.strftime('%Y-%m-%d %H:%M:%S') if value else None
        else:
            data[column.name] = value
    return data


@app.errorhandler(400)
def bad_request(error):
    return jsonify({'success': False, 'message': str(error.description), 'data': None}), 400


@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': str(error.description), 'data': None}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': '服务器内部错误', 'data': None}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'success': True, 'message': '服务正常', 'data': {'timestamp': get_utc_now().strftime('%Y-%m-%d %H:%M:%S')}})


@app.route('/api/wards', methods=['POST'])
def create_ward():
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'success': False, 'message': '病区名称不能为空', 'data': None}), 400
    
    try:
        ward = Ward(name=name, description=data.get('description'))
        db.session.add(ward)
        db.session.commit()
        return jsonify({'success': True, 'message': '创建成功', 'data': serialize_model(ward)}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'message': '病区名称已存在', 'data': None}), 400


@app.route('/api/wards', methods=['GET'])
def list_wards():
    wards = Ward.query.order_by(Ward.id).all()
    return jsonify({
        'success': True,
        'message': '查询成功',
        'data': [serialize_model(w) for w in wards]
    })


@app.route('/api/wards/<int:ward_id>', methods=['GET'])
def get_ward(ward_id):
    ward = Ward.query.get_or_404(ward_id)
    return jsonify({'success': True, 'message': '查询成功', 'data': serialize_model(ward)})


@app.route('/api/wards/<int:ward_id>', methods=['PUT'])
def update_ward(ward_id):
    ward = Ward.query.get_or_404(ward_id)
    data = request.get_json() or {}
    if 'name' in data:
        ward.name = data['name']
    if 'description' in data:
        ward.description = data['description']
    try:
        db.session.commit()
        return jsonify({'success': True, 'message': '更新成功', 'data': serialize_model(ward)})
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'message': '病区名称已存在', 'data': None}), 400


@app.route('/api/wards/<int:ward_id>', methods=['DELETE'])
def delete_ward(ward_id):
    ward = Ward.query.get_or_404(ward_id)
    if ward.beds:
        return jsonify({'success': False, 'message': '病区下存在床位，无法删除', 'data': None}), 400
    db.session.delete(ward)
    db.session.commit()
    return jsonify({'success': True, 'message': '删除成功', 'data': None})


@app.route('/api/beds', methods=['POST'])
def create_bed():
    data = request.get_json() or {}
    bed_number = data.get('bed_number')
    ward_id = data.get('ward_id')
    
    if not bed_number or not ward_id:
        return jsonify({'success': False, 'message': '床位号和病区ID不能为空', 'data': None}), 400
    
    ward = Ward.query.get(ward_id)
    if not ward:
        return jsonify({'success': False, 'message': '病区不存在', 'data': None}), 400
    
    try:
        bed = Bed(bed_number=bed_number, ward_id=ward_id)
        db.session.add(bed)
        db.session.commit()
        return jsonify({'success': True, 'message': '创建成功', 'data': serialize_model(bed)}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'message': '该病区下床位号已存在', 'data': None}), 400


@app.route('/api/beds', methods=['GET'])
def list_beds():
    ward_id = request.args.get('ward_id', type=int)
    query = Bed.query
    if ward_id:
        query = query.filter_by(ward_id=ward_id)
    beds = query.order_by(Bed.id).all()
    
    result = []
    for bed in beds:
        data = serialize_model(bed)
        data['ward_name'] = bed.ward.name
        result.append(data)
    
    return jsonify({'success': True, 'message': '查询成功', 'data': result})


@app.route('/api/beds/<int:bed_id>', methods=['GET'])
def get_bed(bed_id):
    bed = Bed.query.get_or_404(bed_id)
    data = serialize_model(bed)
    data['ward_name'] = bed.ward.name
    
    current_occupy = BedOccupy.query.filter(
        BedOccupy.bed_id == bed_id,
        BedOccupy.status.in_(['reserved', 'admitted'])
    ).order_by(BedOccupy.id.desc()).first()
    
    if current_occupy:
        data['current_patient'] = {
            'patient_id': current_occupy.patient.patient_id,
            'name': current_occupy.patient.name,
            'reservation_id': current_occupy.reservation_id,
            'status': current_occupy.status
        }
    else:
        data['current_patient'] = None
    
    return jsonify({'success': True, 'message': '查询成功', 'data': data})


@app.route('/api/beds/<int:bed_id>', methods=['DELETE'])
def delete_bed(bed_id):
    bed = Bed.query.get_or_404(bed_id)
    active_occupy = BedOccupy.query.filter(
        BedOccupy.bed_id == bed_id,
        BedOccupy.status.in_(['reserved', 'admitted'])
    ).first()
    if active_occupy:
        return jsonify({'success': False, 'message': '床位当前被占用，无法删除', 'data': None}), 400
    db.session.delete(bed)
    db.session.commit()
    return jsonify({'success': True, 'message': '删除成功', 'data': None})


@app.route('/api/patients', methods=['POST'])
def create_patient():
    data = request.get_json() or {}
    patient_id = data.get('patient_id')
    name = data.get('name')
    
    if not patient_id or not name:
        return jsonify({'success': False, 'message': '患者ID和姓名不能为空', 'data': None}), 400
    
    try:
        patient = Patient(
            patient_id=patient_id,
            name=name,
            gender=data.get('gender'),
            age=data.get('age')
        )
        db.session.add(patient)
        db.session.commit()
        return jsonify({'success': True, 'message': '创建成功', 'data': serialize_model(patient)}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'message': '患者ID已存在', 'data': None}), 400


@app.route('/api/patients', methods=['GET'])
def list_patients():
    patients = Patient.query.order_by(Patient.id.desc()).all()
    return jsonify({
        'success': True,
        'message': '查询成功',
        'data': [serialize_model(p) for p in patients]
    })


@app.route('/api/admissions/reserve', methods=['POST'])
def reserve_admission():
    data = request.get_json() or {}
    
    reservation_id = data.get('reservation_id')
    patient_id = data.get('patient_id')
    patient_name = data.get('patient_name')
    bed_id = data.get('bed_id')
    
    if not all([reservation_id, patient_id, patient_name, bed_id]):
        return jsonify({
            'success': False,
            'message': '缺少必要参数: reservation_id, patient_id, patient_name, bed_id',
            'data': None
        }), 400
    
    existing_reservation = BedOccupy.query.filter_by(reservation_id=reservation_id).first()
    if existing_reservation:
        return jsonify({
            'success': True,
            'message': '预约已存在（幂等）',
            'data': _serialize_occupy(existing_reservation)
        })
    
    existing_active = BedOccupy.query.filter(
        BedOccupy.bed_id == bed_id,
        BedOccupy.status.in_(['reserved', 'admitted'])
    ).with_for_update().first()
    
    if existing_active:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': '该床位已被预约或占用',
            'data': {'conflict_with': existing_active.reservation_id}
        }), 409
    
    bed = Bed.query.get(bed_id)
    if not bed:
        return jsonify({'success': False, 'message': '床位不存在', 'data': None}), 400
    
    if bed.status in [BED_STATUS_DIRTY, BED_STATUS_CLEANING] or not bed.is_clean:
        return jsonify({
            'success': False,
            'message': '床位未清洁，无法预约',
            'data': {'bed_status': bed.status, 'is_clean': bed.is_clean}
        }), 400
    
    patient = Patient.query.filter_by(patient_id=patient_id).first()
    if not patient:
        patient = Patient(patient_id=patient_id, name=patient_name,
                          gender=data.get('gender'), age=data.get('age'))
        db.session.add(patient)
        db.session.flush()
    
    occupy = BedOccupy(
        patient_id=patient.id,
        bed_id=bed_id,
        reservation_id=reservation_id,
        status='reserved',
        reserved_at=get_utc_now()
    )
    
    bed.status = BED_STATUS_RESERVED
    db.session.add(occupy)
    
    try:
        db.session.commit()
        return jsonify({
            'success': True,
            'message': '预约成功',
            'data': _serialize_occupy(occupy)
        }), 201
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'预约失败: {str(e)}', 'data': None}), 500


@app.route('/api/admissions/admit', methods=['POST'])
def admit_patient():
    data = request.get_json() or {}
    
    admission_id = data.get('admission_id')
    reservation_id = data.get('reservation_id')
    
    if not admission_id or not reservation_id:
        return jsonify({
            'success': False,
            'message': '缺少必要参数: admission_id, reservation_id',
            'data': None
        }), 400
    
    occupy = BedOccupy.query.filter_by(reservation_id=reservation_id).with_for_update().first()
    if not occupy:
        return jsonify({'success': False, 'message': '预约记录不存在', 'data': None}), 404
    
    if occupy.status == 'admitted':
        if occupy.admission_id == admission_id:
            return jsonify({
                'success': True,
                'message': '已确认占床（幂等）',
                'data': _serialize_occupy(occupy)
            })
        else:
            return jsonify({
                'success': False,
                'message': '该预约已使用其他入院ID确认',
                'data': {'existing_admission_id': occupy.admission_id}
            }), 400
    
    if occupy.status not in ['reserved']:
        return jsonify({
            'success': False,
            'message': f'当前状态[{occupy.status}]不允许确认占床',
            'data': None
        }), 400
    
    existing_admission = BedOccupy.query.filter_by(admission_id=admission_id).first()
    if existing_admission:
        return jsonify({
            'success': True,
            'message': '入院ID已存在（幂等）',
            'data': _serialize_occupy(existing_admission)
        })
    
    occupy.admission_id = admission_id
    occupy.status = 'admitted'
    occupy.admitted_at = get_utc_now()
    
    bed = Bed.query.get(occupy.bed_id)
    bed.status = BED_STATUS_OCCUPIED
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '确认占床成功',
        'data': _serialize_occupy(occupy)
    })


@app.route('/api/admissions/transfer', methods=['POST'])
def transfer_patient():
    data = request.get_json() or {}
    
    transfer_id = data.get('transfer_id')
    source_admission_id = data.get('source_admission_id')
    target_bed_id = data.get('target_bed_id')
    
    if not all([transfer_id, source_admission_id, target_bed_id]):
        return jsonify({
            'success': False,
            'message': '缺少必要参数: transfer_id, source_admission_id, target_bed_id',
            'data': None
        }), 400
    
    source_occupy = BedOccupy.query.filter_by(
        admission_id=source_admission_id,
        status='admitted'
    ).with_for_update().first()
    
    if not source_occupy:
        return jsonify({'success': False, 'message': '源住院记录不存在或状态不允许转科', 'data': None}), 404
    
    if source_occupy.is_transfer_source:
        existing_target = BedOccupy.query.filter_by(
            transfer_from_id=source_occupy.id
        ).first()
        if existing_target:
            return jsonify({
                'success': True,
                'message': '转科已执行（幂等）',
                'data': {
                    'source': _serialize_occupy(source_occupy),
                    'target': _serialize_occupy(existing_target)
                }
            })
    
    target_bed = Bed.query.get(target_bed_id)
    if not target_bed:
        return jsonify({'success': False, 'message': '目标床位不存在', 'data': None}), 400
    
    if target_bed.id == source_occupy.bed_id:
        return jsonify({'success': False, 'message': '目标床位不能与原床位相同', 'data': None}), 400
    
    target_active = BedOccupy.query.filter(
        BedOccupy.bed_id == target_bed_id,
        BedOccupy.status.in_(['reserved', 'admitted'])
    ).with_for_update().first()
    
    if target_active:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': '目标床位已被占用',
            'data': {'conflict_bed_id': target_bed_id}
        }), 409
    
    if target_bed.status in [BED_STATUS_DIRTY, BED_STATUS_CLEANING] or not target_bed.is_clean:
        return jsonify({
            'success': False,
            'message': '目标床位未清洁，无法转入',
            'data': {'bed_status': target_bed.status, 'is_clean': target_bed.is_clean}
        }), 400
    
    source_bed = Bed.query.get(source_occupy.bed_id)
    
    source_occupy.is_transfer_source = True
    source_occupy.status = 'discharged'
    source_occupy.discharged_at = get_utc_now()
    source_occupy.discharge_id = f'TRANSFER_OUT_{transfer_id}'
    
    source_bed.status = BED_STATUS_DIRTY
    source_bed.is_clean = False
    
    target_occupy = BedOccupy(
        patient_id=source_occupy.patient_id,
        bed_id=target_bed_id,
        reservation_id=f'TRANSFER_{transfer_id}',
        admission_id=f'TRANSFER_ADMIT_{transfer_id}',
        status='admitted',
        is_transfer_target=True,
        transfer_from_id=source_occupy.id,
        reserved_at=get_utc_now(),
        admitted_at=get_utc_now()
    )
    
    target_bed.status = BED_STATUS_OCCUPIED
    
    db.session.add(target_occupy)
    
    try:
        db.session.commit()
        return jsonify({
            'success': True,
            'message': '转科成功',
            'data': {
                'transfer_id': transfer_id,
                'source': _serialize_occupy(source_occupy),
                'target': _serialize_occupy(target_occupy)
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'转科失败: {str(e)}', 'data': None}), 500


@app.route('/api/admissions/discharge', methods=['POST'])
def discharge_patient():
    data = request.get_json() or {}
    
    discharge_id = data.get('discharge_id')
    admission_id = data.get('admission_id')
    
    if not discharge_id or not admission_id:
        return jsonify({
            'success': False,
            'message': '缺少必要参数: discharge_id, admission_id',
            'data': None
        }), 400
    
    occupy = BedOccupy.query.filter_by(
        admission_id=admission_id
    ).with_for_update().first()
    
    if not occupy:
        return jsonify({'success': False, 'message': '住院记录不存在', 'data': None}), 404
    
    if occupy.status == 'discharged':
        if occupy.discharge_id == discharge_id:
            return jsonify({
                'success': True,
                'message': '已出院（幂等）',
                'data': _serialize_occupy(occupy)
            })
        else:
            return jsonify({
                'success': False,
                'message': '该住院已使用其他出院ID办理',
                'data': {'existing_discharge_id': occupy.discharge_id}
            }), 400
    
    if occupy.status == 'released':
        return jsonify({
            'success': True,
            'message': '床位已释放，出院操作已完成',
            'data': _serialize_occupy(occupy)
        })
    
    if occupy.status not in ['admitted']:
        return jsonify({
            'success': False,
            'message': f'当前状态[{occupy.status}]不允许出院',
            'data': None
        }), 400
    
    existing_discharge = BedOccupy.query.filter_by(discharge_id=discharge_id).first()
    if existing_discharge:
        return jsonify({
            'success': True,
            'message': '出院ID已存在（幂等）',
            'data': _serialize_occupy(existing_discharge)
        })
    
    occupy.discharge_id = discharge_id
    occupy.status = 'discharged'
    occupy.discharged_at = get_utc_now()
    
    bed = Bed.query.get(occupy.bed_id)
    bed.status = BED_STATUS_DIRTY
    bed.is_clean = False
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '出院成功',
        'data': _serialize_occupy(occupy)
    })


@app.route('/api/beds/<int:bed_id>/clean', methods=['POST'])
def clean_bed(bed_id):
    data = request.get_json() or {}
    clean_id = data.get('clean_id')
    
    if not clean_id:
        return jsonify({'success': False, 'message': '缺少必要参数: clean_id', 'data': None}), 400
    
    bed = Bed.query.get(bed_id)
    if not bed:
        return jsonify({'success': False, 'message': '床位不存在', 'data': None}), 404
    
    if bed.is_clean and bed.status == BED_STATUS_AVAILABLE:
        return jsonify({
            'success': True,
            'message': '床位已清洁（幂等）',
            'data': serialize_model(bed)
        })
    
    latest_occupy = BedOccupy.query.filter_by(
        bed_id=bed_id
    ).order_by(BedOccupy.id.desc()).first()
    
    if latest_occupy and latest_occupy.status == 'cleaned':
        return jsonify({
            'success': True,
            'message': '已清洁（幂等）',
            'data': _serialize_occupy(latest_occupy)
        })
    
    if latest_occupy and latest_occupy.status not in ['discharged', 'cleaned']:
        return jsonify({
            'success': False,
            'message': f'当前床位占用状态[{latest_occupy.status}]不允许清洁',
            'data': None
        }), 400
    
    bed.is_clean = True
    bed.status = BED_STATUS_AVAILABLE
    
    if latest_occupy:
        latest_occupy.status = 'cleaned'
        latest_occupy.cleaned_at = get_utc_now()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '清洁完成',
        'data': {'bed': serialize_model(bed), 'clean_id': clean_id}
    })


@app.route('/api/beds/<int:bed_id>/release', methods=['POST'])
def release_bed(bed_id):
    data = request.get_json() or {}
    release_id = data.get('release_id')
    
    if not release_id:
        return jsonify({'success': False, 'message': '缺少必要参数: release_id', 'data': None}), 400
    
    bed = Bed.query.get(bed_id)
    if not bed:
        return jsonify({'success': False, 'message': '床位不存在', 'data': None}), 404
    
    latest_occupy = BedOccupy.query.filter_by(
        bed_id=bed_id
    ).order_by(BedOccupy.id.desc()).first()
    
    if latest_occupy:
        if latest_occupy.status == 'released':
            return jsonify({
                'success': True,
                'message': '已释放（幂等）',
                'data': _serialize_occupy(latest_occupy)
            })
        
        if latest_occupy.status not in ['cleaned', 'released']:
            return jsonify({
                'success': False,
                'message': f'当前状态[{latest_occupy.status}]不允许释放，必须先清洁',
                'data': None
            }), 400
        
        latest_occupy.status = 'released'
        latest_occupy.released_at = get_utc_now()
    else:
        if bed.status in [BED_STATUS_DIRTY, BED_STATUS_CLEANING] or not bed.is_clean:
            return jsonify({
                'success': False,
                'message': '床位未清洁，不能释放',
                'data': None
            }), 400
    
    bed.status = BED_STATUS_AVAILABLE
    bed.is_clean = True
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '床位释放成功',
        'data': {
            'bed_id': bed_id,
            'status': bed.status,
            'is_clean': bed.is_clean
        }
    })


@app.route('/api/stats/overview', methods=['GET'])
def stats_overview():
    ward_id = request.args.get('ward_id', type=int)
    
    bed_query = Bed.query
    if ward_id:
        bed_query = bed_query.filter_by(ward_id=ward_id)
    
    total_beds = bed_query.count()
    available_beds = bed_query.filter(
        Bed.status == BED_STATUS_AVAILABLE,
        Bed.is_clean == True
    ).count()
    dirty_beds = bed_query.filter(
        or_(Bed.status == BED_STATUS_DIRTY, Bed.is_clean == False)
    ).count()
    occupied_beds = bed_query.filter(Bed.status == BED_STATUS_OCCUPIED).count()
    reserved_beds = bed_query.filter(Bed.status == BED_STATUS_RESERVED).count()
    
    occupy_query = BedOccupy.query
    if ward_id:
        occupy_query = occupy_query.join(Bed).filter(Bed.ward_id == ward_id)
    
    completed_occupies = occupy_query.filter(
        BedOccupy.admitted_at.isnot(None),
        BedOccupy.discharged_at.isnot(None)
    ).all()
    
    avg_turnover_hours = None
    if completed_occupies:
        total_hours = 0
        count = 0
        for occ in completed_occupies:
            if occ.admitted_at and occ.discharged_at:
                delta = occ.discharged_at - occ.admitted_at
                total_hours += delta.total_seconds() / 3600
                count += 1
        if count > 0:
            avg_turnover_hours = round(total_hours / count, 2)
    
    abnormal_occupies = BedOccupy.query.filter(
        BedOccupy.status == 'discharged',
        BedOccupy.bed.has(is_clean=False)
    ).all()
    
    abnormal_list = []
    for occ in abnormal_occupies:
        abnormal_list.append({
            'occupy_id': occ.id,
            'patient_id': occ.patient.patient_id,
            'patient_name': occ.patient.name,
            'bed_id': occ.bed_id,
            'bed_number': occ.bed.bed_number,
            'ward_name': occ.bed.ward.name,
            'discharged_at': occ.discharged_at.strftime('%Y-%m-%d %H:%M:%S') if occ.discharged_at else None,
            'issue': '患者已出院但床位未清洁'
        })
    
    return jsonify({
        'success': True,
        'message': '查询成功',
        'data': {
            'ward_id': ward_id,
            'total_beds': total_beds,
            'available_beds': available_beds,
            'dirty_beds': dirty_beds,
            'occupied_beds': occupied_beds,
            'reserved_beds': reserved_beds,
            'avg_turnover_hours': avg_turnover_hours,
            'abnormal_occupies': abnormal_list
        }
    })


@app.route('/api/stats/transfer-history', methods=['GET'])
def transfer_history():
    patient_id = request.args.get('patient_id')
    admission_id = request.args.get('admission_id')
    
    query = BedOccupy.query.filter(
        or_(BedOccupy.is_transfer_source == True, BedOccupy.is_transfer_target == True)
    )
    
    if patient_id:
        patient = Patient.query.filter_by(patient_id=patient_id).first()
        if patient:
            query = query.filter_by(patient_id=patient.id)
        else:
            return jsonify({'success': True, 'message': '查询成功', 'data': []})
    
    if admission_id:
        source = BedOccupy.query.filter_by(admission_id=admission_id).first()
        if source:
            query = query.filter(
                or_(
                    BedOccupy.admission_id == admission_id,
                    BedOccupy.transfer_from_id == source.id
                )
            )
    
    records = query.order_by(BedOccupy.admitted_at).all()
    
    pairs = []
    processed = set()
    
    for rec in records:
        if rec.id in processed:
            continue
        
        if rec.is_transfer_source:
            target = BedOccupy.query.filter_by(transfer_from_id=rec.id).first()
            
            source_info = {
                'occupy_id': rec.id,
                'bed_id': rec.bed_id,
                'bed_number': rec.bed.bed_number,
                'ward_id': rec.bed.ward_id,
                'ward_name': rec.bed.ward.name,
                'admitted_at': rec.admitted_at.strftime('%Y-%m-%d %H:%M:%S') if rec.admitted_at else None,
                'discharged_at': rec.discharged_at.strftime('%Y-%m-%d %H:%M:%S') if rec.discharged_at else None,
                'status': rec.status
            }
            
            target_info = None
            if target:
                target_info = {
                    'occupy_id': target.id,
                    'bed_id': target.bed_id,
                    'bed_number': target.bed.bed_number,
                    'ward_id': target.bed.ward_id,
                    'ward_name': target.bed.ward.name,
                    'admitted_at': target.admitted_at.strftime('%Y-%m-%d %H:%M:%S') if target.admitted_at else None,
                    'status': target.status
                }
                processed.add(target.id)
            
            pairs.append({
                'patient_id': rec.patient.patient_id,
                'patient_name': rec.patient.name,
                'source_admission_id': rec.admission_id,
                'source': source_info,
                'target': target_info
            })
            processed.add(rec.id)
    
    return jsonify({
        'success': True,
        'message': '查询成功',
        'data': pairs
    })


@app.route('/api/occupies', methods=['GET'])
def list_occupies():
    patient_id = request.args.get('patient_id')
    bed_id = request.args.get('bed_id', type=int)
    status = request.args.get('status')
    
    query = BedOccupy.query
    
    if patient_id:
        patient = Patient.query.filter_by(patient_id=patient_id).first()
        if patient:
            query = query.filter_by(patient_id=patient.id)
        else:
            return jsonify({'success': True, 'message': '查询成功', 'data': []})
    
    if bed_id:
        query = query.filter_by(bed_id=bed_id)
    
    if status:
        query = query.filter_by(status=status)
    
    occupies = query.order_by(BedOccupy.id.desc()).all()
    
    return jsonify({
        'success': True,
        'message': '查询成功',
        'data': [_serialize_occupy(o) for o in occupies]
    })


def _serialize_occupy(occupy):
    data = serialize_model(occupy)
    data['patient_name'] = occupy.patient.name
    data['bed_number'] = occupy.bed.bed_number
    data['ward_id'] = occupy.bed.ward_id
    data['ward_name'] = occupy.bed.ward.name
    return data


def init_db():
    with app.app_context():
        db.create_all()


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)
