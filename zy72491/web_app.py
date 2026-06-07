from flask import Flask, render_template, jsonify, request
from datetime import datetime
import json

from models import EvaluationRecord, RecordStatus, DataSource
from processor import RecordProcessor
from data_import import (
    create_demo_data, create_night_supplement_points,
    create_ramp_supplement
)

app = Flask(__name__)
app.secret_key = 'sponge-city-demo-key'

processor = RecordProcessor()
_records_loaded = False
records = []


def ensure_demo_data():
    global _records_loaded, records
    if not _records_loaded:
        raw_records = create_demo_data()
        records = [processor.initial_import(r) for r in raw_records]
        _records_loaded = True


def record_to_dict(record: EvaluationRecord) -> dict:
    return {
        'id': record.id,
        'road_name': record.road_name,
        'district': record.district,
        'score': round(record.score, 1),
        'previous_score': round(record.previous_score, 1) if record.previous_score else None,
        'status': record.status.value,
        'status_code': record.status.name,
        'sampling_points': [
            {
                'id': p.id,
                'name': p.name,
                'data_source': p.data_source.value,
                'permeability_rate': round(p.permeability_rate, 2),
                'has_remarks': p.has_remarks,
                'remarks': p.remarks,
                'collected_at': p.collected_at.strftime('%Y-%m-%d %H:%M') if p.collected_at else None
            }
            for p in record.sampling_points
        ],
        'ramp': {
            'id': record.ramp.id,
            'location': record.ramp.location,
            'has_ramp': record.ramp.has_ramp,
            'ramp_slope': record.ramp.ramp_slope,
            'ramp_remarks': record.ramp.ramp_remarks
        } if record.ramp else None,
        'rectification_suggestions': record.rectification_suggestions,
        'previous_suggestions': record.previous_suggestions,
        'version': record.version,
        'is_rerun': record.is_rerun,
        'has_manual_correction': record.has_manual_correction,
        'review_night_supplemented': record.review_night_supplemented,
        'updated_at': record.updated_at.strftime('%Y-%m-%d %H:%M'),
        'created_at': record.created_at.strftime('%Y-%m-%d %H:%M')
    }


@app.route('/')
def index():
    ensure_demo_data()
    return render_template('dashboard.html')


@app.route('/api/records')
def api_records():
    ensure_demo_data()
    return jsonify([record_to_dict(r) for r in records])


@app.route('/api/records/<record_id>')
def api_record_detail(record_id):
    ensure_demo_data()
    target = next((r for r in records if r.id == record_id), None)
    if not target:
        return jsonify({'error': '记录不存在'}), 404
    return jsonify(record_to_dict(target))


@app.route('/api/records/<record_id>/supplement-ramp', methods=['POST'])
def api_supplement_ramp(record_id):
    ensure_demo_data()
    target = next((r for r in records if r.id == record_id), None)
    if not target:
        return jsonify({'error': '记录不存在'}), 404
    
    ramp_data = request.json or {}
    new_ramp = create_ramp_supplement()
    if ramp_data.get('location'):
        new_ramp.location = ramp_data['location']
    if ramp_data.get('ramp_slope'):
        new_ramp.ramp_slope = float(ramp_data['ramp_slope'])
    if ramp_data.get('ramp_remarks'):
        new_ramp.ramp_remarks = ramp_data['ramp_remarks']
    
    updated = processor.supplement_ramp(target, new_ramp)
    idx = records.index(target)
    records[idx] = updated
    
    return jsonify(record_to_dict(updated))


@app.route('/api/records/<record_id>/supplement-night', methods=['POST'])
def api_supplement_night(record_id):
    ensure_demo_data()
    target = next((r for r in records if r.id == record_id), None)
    if not target:
        return jsonify({'error': '记录不存在'}), 404
    
    night_points = create_night_supplement_points()
    updated = processor.supplement_night_sampling(target, night_points)
    idx = records.index(target)
    records[idx] = updated
    
    return jsonify(record_to_dict(updated))


@app.route('/api/records/<record_id>/confirm-review', methods=['POST'])
def api_confirm_review(record_id):
    ensure_demo_data()
    target = next((r for r in records if r.id == record_id), None)
    if not target:
        return jsonify({'error': '记录不存在'}), 404
    
    updated = processor.confirm_ramp_review(target)
    idx = records.index(target)
    records[idx] = updated
    
    return jsonify(record_to_dict(updated))


@app.route('/api/records/<record_id>/rerun', methods=['POST'])
def api_rerun(record_id):
    ensure_demo_data()
    target = next((r for r in records if r.id == record_id), None)
    if not target:
        return jsonify({'error': '记录不存在'}), 404
    
    updated = processor.rerun_evaluation(target)
    idx = records.index(target)
    records[idx] = updated
    
    return jsonify(record_to_dict(updated))


@app.route('/api/logs')
def api_logs():
    ensure_demo_data()
    log_list = []
    for log in processor.process_logs:
        log_list.append({
            'record_id': log.record_id,
            'action': log.action,
            'operator': log.operator,
            'details': log.details,
            'timestamp': log.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        })
    return jsonify(log_list)


@app.route('/api/reset', methods=['POST'])
def api_reset():
    global _records_loaded, records
    _records_loaded = False
    processor.process_logs.clear()
    ensure_demo_data()
    return jsonify({'message': '数据已重置', 'count': len(records)})


if __name__ == '__main__':
    print("海绵城市透水铺装 - 小看板启动中...")
    print("访问 http://localhost:5001 查看看板")
    app.run(debug=False, port=5001, host='0.0.0.0')
