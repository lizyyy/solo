from flask import Blueprint, request, jsonify
from app import db
from app.models import TemperatureRecord, Cabinet
from app.rules import TemperatureRule
from app.audit_log import AuditLogger
from datetime import datetime
import json

bp = Blueprint('temperature', __name__, url_prefix='/api/temperature')


@bp.route('/', methods=['GET'])
def get_records():
    records = TemperatureRecord.query.all()
    return jsonify([{
        'id': r.id,
        'cabinet_id': r.cabinet_id,
        'cabinet_code': r.cabinet.cabinet_code if r.cabinet else None,
        'temperature': r.temperature,
        'record_time': r.record_time.isoformat() if r.record_time else None,
        'is_alert': r.is_alert,
        'alert_reason': r.alert_reason
    } for r in records])


@bp.route('/', methods=['POST'])
def create_record():
    data = request.get_json()
    
    cabinet = Cabinet.query.get(data['cabinet_id'])
    if not cabinet:
        return jsonify({'error': '柜位不存在'}), 404
    
    temperature = float(data['temperature'])
    
    record_time = datetime.utcnow()
    if 'record_time' in data:
        try:
            record_time = datetime.strptime(data['record_time'], '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                record_time = datetime.fromisoformat(data['record_time'])
            except ValueError:
                pass
    
    temp_check = TemperatureRule.check_temperature_range(cabinet, temperature, record_time)
    continuity_check = TemperatureRule.check_continuity(cabinet)
    
    is_alert = not temp_check.valid
    alert_reason = temp_check.message if not temp_check.valid else None
    
    if not continuity_check.valid:
        is_alert = True
        alert_reason = (alert_reason + '; ' if alert_reason else '') + continuity_check.message
    
    record = TemperatureRecord(
        cabinet_id=cabinet.id,
        temperature=temperature,
        record_time=record_time,
        is_alert=is_alert,
        alert_reason=alert_reason
    )
    
    db.session.add(record)
    db.session.commit()
    
    alerts = []
    if not temp_check.valid:
        alerts.append(temp_check.to_dict())
    if not continuity_check.valid:
        alerts.append(continuity_check.to_dict())
    
    AuditLogger.log(
        action='REPORT_TEMPERATURE',
        resource_type='TemperatureRecord',
        resource_id=str(record.id),
        user_name=data.get('reported_by', 'system'),
        details=json.dumps({
            'cabinet_code': cabinet.cabinet_code,
            'temperature': temperature,
            'is_alert': is_alert,
            'alert_reason': alert_reason
        }, ensure_ascii=False)
    )
    
    response_data = {
        'message': '温度记录创建成功' if not is_alert else '温度记录已保存，存在告警',
        'record_id': record.id,
        'temperature_check': temp_check.to_dict(),
        'continuity_check': continuity_check.to_dict()
    }
    
    if is_alert:
        response_data['alerts'] = alerts
        return jsonify(response_data), 200
    
    return jsonify(response_data), 201


@bp.route('/alerts', methods=['GET'])
def get_alerts():
    records = TemperatureRecord.query.filter_by(
        is_alert=True
    ).order_by(TemperatureRecord.record_time.desc()).all()
    
    return jsonify([{
        'id': r.id,
        'cabinet_code': r.cabinet.cabinet_code if r.cabinet else None,
        'cabinet_name': r.cabinet.name if r.cabinet else None,
        'temperature': r.temperature,
        'record_time': r.record_time.isoformat() if r.record_time else None,
        'alert_reason': r.alert_reason
    } for r in records])


@bp.route('/cabinet/<int:cabinet_id>/check', methods=['GET'])
def check_cabinet_status(cabinet_id):
    cabinet = Cabinet.query.get_or_404(cabinet_id)
    
    continuity_check = TemperatureRule.check_continuity(cabinet)
    
    latest_record = TemperatureRecord.query.filter_by(
        cabinet_id=cabinet.id
    ).order_by(TemperatureRecord.record_time.desc()).first()
    
    return jsonify({
        'cabinet_code': cabinet.cabinet_code,
        'cabinet_name': cabinet.name,
        'is_low_temp': cabinet.is_low_temp,
        'min_temp': cabinet.min_temp,
        'max_temp': cabinet.max_temp,
        'latest_temperature': latest_record.temperature if latest_record else None,
        'latest_record_time': latest_record.record_time.isoformat() if latest_record and latest_record.record_time else None,
        'continuity_check': continuity_check.to_dict()
    })
