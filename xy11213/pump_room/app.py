from flask import Flask, request, jsonify
from config import Config
from models import db, PumpRoom, Staff, Repair, Reinspection, OperationLog, BatchOperation, RepairStatus
from services import RepairService, BatchService
from datetime import datetime

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})

@app.route('/api/pump-rooms', methods=['GET', 'POST'])
def pump_rooms():
    if request.method == 'GET':
        rooms = PumpRoom.query.all()
        return jsonify({'data': [r.to_dict() for r in rooms]})
    
    data = request.json
    room = PumpRoom(name=data['name'], location=data.get('location', ''))
    db.session.add(room)
    db.session.commit()
    return jsonify({'success': True, 'data': room.to_dict()}), 201

@app.route('/api/pump-rooms/<int:room_id>', methods=['GET', 'PUT', 'DELETE'])
def pump_room_detail(room_id):
    room = PumpRoom.query.get_or_404(room_id)
    
    if request.method == 'GET':
        return jsonify({'data': room.to_dict()})
    
    if request.method == 'PUT':
        data = request.json
        room.name = data.get('name', room.name)
        room.location = data.get('location', room.location)
        if 'status' in data:
            room.status = data['status']
        db.session.commit()
        return jsonify({'success': True, 'data': room.to_dict()})
    
    db.session.delete(room)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/staff', methods=['GET', 'POST'])
def staff_list():
    if request.method == 'GET':
        staff = Staff.query.all()
        return jsonify({'data': [s.to_dict() for s in staff]})
    
    data = request.json
    staff = Staff(name=data['name'], phone=data.get('phone', ''), role=data.get('role', ''))
    db.session.add(staff)
    db.session.commit()
    return jsonify({'success': True, 'data': staff.to_dict()}), 201

@app.route('/api/repairs', methods=['GET', 'POST'])
def repairs():
    if request.method == 'GET':
        status = request.args.get('status')
        pump_room_id = request.args.get('pump_room_id')
        query = Repair.query
        
        if status:
            query = query.filter(Repair.status == status)
        if pump_room_id:
            query = query.filter(Repair.pump_room_id == pump_room_id)
        
        repairs = query.order_by(Repair.created_at.desc()).all()
        return jsonify({'data': [r.to_dict() for r in repairs]})
    
    data = request.json
    result = RepairService.create_repair(
        pump_room_id=data['pump_room_id'],
        report_source=data.get('report_source', ''),
        problem_type=data['problem_type'],
        description=data.get('description', ''),
        reporter=data.get('reporter', ''),
        reporter_phone=data.get('reporter_phone', ''),
        operator=data.get('operator', 'system')
    )
    
    if result['success']:
        return jsonify(result), 201
    return jsonify(result), 400

@app.route('/api/repairs/<int:repair_id>', methods=['GET'])
def repair_detail(repair_id):
    repair = Repair.query.get_or_404(repair_id)
    logs = OperationLog.query.filter_by(repair_id=repair_id).order_by(OperationLog.created_at.desc()).all()
    reinspections = Reinspection.query.filter_by(repair_id=repair_id).order_by(Reinspection.created_at.desc()).all()
    
    return jsonify({
        'data': repair.to_dict(),
        'logs': [l.to_dict() for l in logs],
        'reinspections': [r.to_dict() for r in reinspections]
    })

@app.route('/api/repairs/<int:repair_id>/assign', methods=['POST'])
def assign_repair(repair_id):
    data = request.json
    result = RepairService.assign_repair(
        repair_id=repair_id,
        staff_id=data['staff_id'],
        operator=data.get('operator', 'system')
    )
    
    if result['success']:
        return jsonify(result)
    return jsonify(result), 400

@app.route('/api/repairs/<int:repair_id>/arrive', methods=['POST'])
def mark_arrived(repair_id):
    data = request.json or {}
    result = RepairService.mark_arrived(
        repair_id=repair_id,
        operator=data.get('operator', 'system')
    )
    
    if result['success']:
        return jsonify(result)
    return jsonify(result), 400

@app.route('/api/repairs/<int:repair_id>/reinspect', methods=['POST'])
def reinspect(repair_id):
    data = request.json
    result = RepairService.reinspect(
        repair_id=repair_id,
        inspector=data.get('inspector', ''),
        result=data['result'],
        description=data.get('description', ''),
        is_passed=data['is_passed'],
        operator=data.get('operator', 'system')
    )
    
    if result['success']:
        return jsonify(result)
    return jsonify(result), 400

@app.route('/api/repairs/<int:repair_id>/close', methods=['POST'])
def close_repair(repair_id):
    data = request.json or {}
    result = RepairService.close_repair(
        repair_id=repair_id,
        operator=data.get('operator', 'system')
    )
    
    if result['success']:
        return jsonify(result)
    return jsonify(result), 400

@app.route('/api/repairs/escalate-timeout', methods=['POST'])
def escalate_timeout():
    data = request.json or {}
    timeout_hours = data.get('timeout_hours', 4)
    escalated = RepairService.escalate_if_timeout(timeout_hours)
    return jsonify({
        'success': True,
        'escalated_count': len(escalated),
        'escalated': escalated
    })

@app.route('/api/batch/create-repairs', methods=['POST'])
def batch_create_repairs():
    data = request.json
    result = BatchService.batch_operation(
        operation_type='batch_create',
        items=data['items'],
        processor=BatchService.batch_create_processor,
        operator=data.get('operator', 'system')
    )
    return jsonify({'success': True, 'data': result})

@app.route('/api/batch/assign-repairs', methods=['POST'])
def batch_assign_repairs():
    data = request.json
    result = BatchService.batch_operation(
        operation_type='batch_assign',
        items=data['items'],
        processor=BatchService.batch_assign_processor,
        operator=data.get('operator', 'system')
    )
    return jsonify({'success': True, 'data': result})

@app.route('/api/batch/<batch_id>', methods=['GET'])
def get_batch_result(batch_id):
    batch = BatchOperation.query.filter_by(batch_id=batch_id).first()
    if not batch:
        return jsonify({'success': False, 'error': 'NOT_FOUND', 'message': '批量操作记录不存在'}), 404
    return jsonify({'success': True, 'data': batch.to_dict()})

@app.route('/api/logs', methods=['GET'])
def get_logs():
    repair_id = request.args.get('repair_id')
    batch_id = request.args.get('batch_id')
    query = OperationLog.query
    
    if repair_id:
        query = query.filter_by(repair_id=repair_id)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    logs = query.order_by(OperationLog.created_at.desc()).all()
    return jsonify({'data': [l.to_dict() for l in logs]})

@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'NOT_FOUND', 'message': '资源不存在'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'success': False, 'error': 'SERVER_ERROR', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
