from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, CacheRule, PreheatBatch, InvalidationEvent, PerformanceReport, SourcePressureLog, CorrectionRecord
from datetime import datetime
import json

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cache_center.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
CORS(app)

with app.app_context():
    db.create_all()

@app.route('/api/rules', methods=['GET'])
def get_rules():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    keyword = request.args.get('keyword', '')
    
    query = CacheRule.query
    if status:
        query = query.filter(CacheRule.status == status)
    if keyword:
        query = query.filter(CacheRule.rule_key.like(f'%{keyword}%'))
    
    pagination = query.order_by(CacheRule.created_at.desc()).paginate(page=page, per_page=per_page)
    return jsonify({
        'data': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page
    })

@app.route('/api/rules', methods=['POST'])
def create_rule():
    data = request.json
    rule = CacheRule(
        rule_key=data['rule_key'],
        rule_pattern=data['rule_pattern'],
        original_input=json.dumps(data.get('original_input', {})),
        processed_result=json.dumps(data.get('processed_result', {})),
        description=data.get('description', ''),
        ttl=data.get('ttl', 3600),
        status='pending'
    )
    db.session.add(rule)
    db.session.commit()
    return jsonify(rule.to_dict()), 201

@app.route('/api/rules/<int:rule_id>', methods=['GET'])
def get_rule(rule_id):
    rule = CacheRule.query.get_or_404(rule_id)
    return jsonify(rule.to_dict())

@app.route('/api/rules/<int:rule_id>/preheat', methods=['POST'])
def start_preheat(rule_id):
    rule = CacheRule.query.get_or_404(rule_id)
    if rule.status in ['preheating', 'ready']:
        return jsonify({'error': 'Invalid status transition'}), 400
    
    data = request.json
    batch = PreheatBatch(
        rule_id=rule_id,
        batch_key=f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        total_keys=data.get('total_keys', 0),
        status='running'
    )
    rule.status = 'preheating'
    db.session.add(batch)
    db.session.commit()
    return jsonify(batch.to_dict())

@app.route('/api/batches/<int:batch_id>/complete', methods=['POST'])
def complete_batch(batch_id):
    batch = PreheatBatch.query.get_or_404(batch_id)
    if batch.status != 'running':
        return jsonify({'error': 'Batch not in running status'}), 400
    
    data = request.json
    batch.success_keys = data.get('success_keys', 0)
    batch.failed_keys = data.get('failed_keys', 0)
    batch.hit_rate = data.get('hit_rate', 0)
    batch.status = 'completed'
    batch.completed_at = datetime.utcnow()
    
    rule = CacheRule.query.get(batch.rule_id)
    rule.status = 'ready'
    rule.current_hit_rate = batch.hit_rate
    
    db.session.commit()
    return jsonify(batch.to_dict())

@app.route('/api/rules/<int:rule_id>/invalidate', methods=['POST'])
def create_invalidation(rule_id):
    rule = CacheRule.query.get_or_404(rule_id)
    
    data = request.json
    event = InvalidationEvent(
        rule_id=rule_id,
        event_key=f"INVALID-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        reason=data.get('reason', ''),
        operator=data.get('operator', 'system'),
        status='pending'
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201

@app.route('/api/invalidations/<int:event_id>/execute', methods=['POST'])
def execute_invalidation(event_id):
    event = InvalidationEvent.query.get_or_404(event_id)
    if event.status != 'pending':
        return jsonify({'error': 'Event already processed'}), 400
    
    data = request.json
    event.status = 'processing'
    db.session.commit()
    
    pressure_log = SourcePressureLog(
        rule_id=event.rule_id,
        event_id=event_id,
        pressure_level=data.get('pressure_level', 'medium'),
        estimated_qps=data.get('estimated_qps', 0),
        reason=data.get('reason', ''),
        status='recorded'
    )
    db.session.add(pressure_log)
    db.session.commit()
    
    return jsonify({
        'event': event.to_dict(),
        'pressure_log': pressure_log.to_dict()
    })

@app.route('/api/invalidations/<int:event_id>/complete', methods=['POST'])
def complete_invalidation(event_id):
    event = InvalidationEvent.query.get_or_404(event_id)
    if event.status != 'processing':
        return jsonify({'error': 'Invalid status'}), 400
    
    data = request.json
    success = data.get('success', True)
    
    if success:
        event.status = 'completed'
        rule = CacheRule.query.get(event.rule_id)
        rule.status = 'pending'
        rule.last_invalidated_at = datetime.utcnow()
    else:
        event.status = 'failed'
        event.failure_reason = data.get('failure_reason', '')
    
    event.completed_at = datetime.utcnow()
    db.session.commit()
    return jsonify(event.to_dict())

@app.route('/api/invalidations/<int:event_id>/correct', methods=['POST'])
def correct_invalidation(event_id):
    event = InvalidationEvent.query.get_or_404(event_id)
    if event.status != 'failed':
        return jsonify({'error': 'Only failed events can be corrected'}), 400
    
    data = request.json
    correction = CorrectionRecord(
        event_id=event_id,
        correction_reason=data['correction_reason'],
        handler=data.get('handler', ''),
        handler_comment=data.get('comment', '')
    )
    db.session.add(correction)
    
    event.status = 'corrected'
    db.session.commit()
    return jsonify({
        'event': event.to_dict(),
        'correction': correction.to_dict()
    }), 201

@app.route('/api/reports', methods=['POST'])
def create_report():
    data = request.json
    report = PerformanceReport(
        rule_id=data['rule_id'],
        report_key=f"REPORT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        avg_hit_rate=data.get('avg_hit_rate', 0),
        total_preheat_batches=data.get('total_preheat_batches', 0),
        total_invalidations=data.get('total_invalidations', 0),
        report_data=json.dumps(data.get('report_data', {}))
    )
    db.session.add(report)
    db.session.commit()
    return jsonify(report.to_dict()), 201

@app.route('/api/reports/<int:report_id>', methods=['GET'])
def get_report(report_id):
    report = PerformanceReport.query.get_or_404(report_id)
    return jsonify(report.to_dict())

@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    total_rules = CacheRule.query.count()
    preheating = CacheRule.query.filter_by(status='preheating').count()
    ready = CacheRule.query.filter_by(status='ready').count()
    avg_hit_rate = db.session.query(db.func.avg(CacheRule.current_hit_rate)).scalar() or 0
    
    return jsonify({
        'total_rules': total_rules,
        'preheating': preheating,
        'ready': ready,
        'avg_hit_rate': round(avg_hit_rate, 2)
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
