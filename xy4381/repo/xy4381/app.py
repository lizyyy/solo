import os
from datetime import datetime, date, timedelta
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, flash
from werkzeug.utils import secure_filename
from functools import wraps

from config import Config
from models import (
    db, Tank, WaterQualityRecord, FeedingRecord, 
    WaterChangeRecord, FishRecord, Observation, Risk,
    RISK_TYPES, RISK_LEVELS, REVIEW_STATUSES
)
from importers import (
    import_water_quality_csv, import_feeding_json,
    import_water_change_plan, import_observations,
    import_fish_records
)
from risk_detector import (
    detect_all_risks, get_recent_risks, update_risk_review
)
from exporters import (
    export_markdown_handover, export_csv_risk_list,
    export_json_audit_package, list_exports
)

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)

with app.app_context():
    db.create_all()

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def parse_date_param(date_str):
    if not date_str:
        return date.today()
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return date.today()

@app.route('/')
def index():
    today = date.today()
    
    tanks = Tank.query.order_by(Tank.tank_code).all()
    
    today_risks = Risk.query.filter(
        Risk.detected_date == today,
        Risk.resolution_status != 'resolved'
    ).order_by(Risk.risk_level.desc(), Risk.created_at.desc()).all()
    
    critical_count = sum(1 for r in today_risks if r.risk_level == 'critical')
    warning_count = sum(1 for r in today_risks if r.risk_level == 'warning')
    info_count = sum(1 for r in today_risks if r.risk_level == 'info')
    
    recent_feedings = FeedingRecord.query.filter(
        FeedingRecord.record_date == today
    ).all()
    fed_tank_ids = set(f.tank_id for f in recent_feedings)
    unfed_count = len(tanks) - len(fed_tank_ids)
    
    stats = {
        'total_tanks': len(tanks),
        'today_risks_count': len(today_risks),
        'critical_count': critical_count,
        'warning_count': warning_count,
        'info_count': info_count,
        'unfed_count': unfed_count
    }
    
    return render_template('index.html', 
                         stats=stats, 
                         today_risks=today_risks,
                         tanks=tanks,
                         today=today,
                         RISK_TYPES=RISK_TYPES,
                         RISK_LEVELS=RISK_LEVELS,
                         REVIEW_STATUSES=REVIEW_STATUSES)

@app.route('/api/tanks', methods=['GET'])
def api_get_tanks():
    tanks = Tank.query.order_by(Tank.tank_code).all()
    return jsonify([t.to_dict() for t in tanks])

@app.route('/api/tanks', methods=['POST'])
def api_create_tank():
    data = request.get_json() or request.form
    
    tank_code = data.get('tank_code', '').strip()
    if not tank_code:
        return jsonify({'success': False, 'error': '展缸编号不能为空'}), 400
    
    existing = Tank.query.filter_by(tank_code=tank_code).first()
    if existing:
        return jsonify({'success': False, 'error': '展缸编号已存在'}), 400
    
    tank = Tank(
        tank_code=tank_code,
        tank_name=data.get('tank_name'),
        tank_type=data.get('tank_type'),
        location=data.get('location'),
        volume_liters=data.get('volume_liters')
    )
    
    db.session.add(tank)
    db.session.commit()
    
    return jsonify({'success': True, 'tank': tank.to_dict()})

@app.route('/api/risks', methods=['GET'])
def api_get_risks():
    days = request.args.get('days', 7, type=int)
    include_resolved = request.args.get('include_resolved', 'false').lower() == 'true'
    
    risks = get_recent_risks(days=days, include_resolved=include_resolved)
    return jsonify({'success': True, 'risks': risks})

@app.route('/api/risks/<int:risk_id>/review', methods=['POST'])
def api_review_risk(risk_id):
    data = request.get_json() or request.form
    
    review_status = data.get('review_status')
    if not review_status or review_status not in REVIEW_STATUSES:
        return jsonify({'success': False, 'error': '无效的复核状态'}), 400
    
    result = update_risk_review(
        risk_id=risk_id,
        review_status=review_status,
        review_comment=data.get('review_comment'),
        reviewed_by=data.get('reviewed_by')
    )
    
    if not result:
        return jsonify({'success': False, 'error': '风险记录不存在'}), 404
    
    return jsonify({'success': True, 'risk': result})

@app.route('/api/detect-risks', methods=['POST'])
def api_detect_risks():
    data = request.get_json() or request.form
    check_date = parse_date_param(data.get('check_date'))
    
    tank_ids = data.get('tank_ids')
    if tank_ids and isinstance(tank_ids, str):
        try:
            import json
            tank_ids = json.loads(tank_ids)
        except:
            tank_ids = None
    
    results = detect_all_risks(check_date=check_date, tank_ids=tank_ids)
    return jsonify({'success': True, **results})

@app.route('/api/import/<import_type>', methods=['POST'])
def api_import(import_type):
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '未选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': '不支持的文件格式'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        if import_type == 'water_quality':
            result = import_water_quality_csv(filepath)
        elif import_type == 'feeding':
            result = import_feeding_json(filepath)
        elif import_type == 'water_change':
            result = import_water_change_plan(filepath)
        elif import_type == 'observations':
            result = import_observations(filepath)
        elif import_type == 'fish':
            result = import_fish_records(filepath)
        else:
            return jsonify({'success': False, 'error': '无效的导入类型'}), 400
        
        return jsonify({'success': True, 'result': result})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export/<export_type>', methods=['GET', 'POST'])
def api_export(export_type):
    data = request.args.to_dict()
    if request.method == 'POST':
        data = request.get_json() or request.form or data
    
    try:
        if export_type == 'handover':
            export_date = parse_date_param(data.get('export_date'))
            reviewer_name = data.get('reviewer_name')
            result = export_markdown_handover(export_date=export_date, reviewer_name=reviewer_name)
            return send_file(result['filepath'], 
                           as_attachment=True,
                           download_name=result['filename'],
                           mimetype='text/markdown')
        
        elif export_type == 'risks_csv':
            days = data.get('days', 7, type=int) if isinstance(data.get('days'), int) else int(data.get('days', 7))
            include_resolved = str(data.get('include_resolved', 'false')).lower() == 'true'
            result = export_csv_risk_list(days=days, include_resolved=include_resolved)
            return send_file(result['filepath'],
                           as_attachment=True,
                           download_name=result['filename'],
                           mimetype='text/csv')
        
        elif export_type == 'audit':
            export_date = parse_date_param(data.get('export_date'))
            result = export_json_audit_package(export_date=export_date)
            return send_file(result['filepath'],
                           as_attachment=True,
                           download_name=result['filename'],
                           mimetype='application/json')
        
        else:
            return jsonify({'success': False, 'error': '无效的导出类型'}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/exports', methods=['GET'])
def api_list_exports():
    exports = list_exports()
    return jsonify({'success': True, 'exports': exports})

@app.route('/api/tanks/<int:tank_id>/records', methods=['GET'])
def api_get_tank_records(tank_id):
    tank = Tank.query.get(tank_id)
    if not tank:
        return jsonify({'success': False, 'error': '展缸不存在'}), 404
    
    days = request.args.get('days', 7, type=int)
    cutoff_date = date.today() - timedelta(days=days)
    
    water_quality = WaterQualityRecord.query.filter(
        WaterQualityRecord.tank_id == tank_id,
        WaterQualityRecord.record_date >= cutoff_date
    ).order_by(WaterQualityRecord.record_date.desc()).all()
    
    feedings = FeedingRecord.query.filter(
        FeedingRecord.tank_id == tank_id,
        FeedingRecord.record_date >= cutoff_date
    ).order_by(FeedingRecord.record_date.desc()).all()
    
    water_changes = WaterChangeRecord.query.filter(
        WaterChangeRecord.tank_id == tank_id
    ).order_by(WaterChangeRecord.change_date.desc()).limit(5).all()
    
    fish = FishRecord.query.filter_by(tank_id=tank_id).all()
    
    observations = Observation.query.filter(
        Observation.tank_id == tank_id,
        Observation.observation_date >= cutoff_date
    ).order_by(Observation.observation_date.desc()).all()
    
    return jsonify({
        'success': True,
        'tank': tank.to_dict(),
        'water_quality': [r.to_dict() for r in water_quality],
        'feedings': [r.to_dict() for r in feedings],
        'water_changes': [r.to_dict() for r in water_changes],
        'fish': [f.to_dict() for f in fish],
        'observations': [o.to_dict() for o in observations]
    })

@app.route('/api/stats', methods=['GET'])
def api_get_stats():
    today = date.today()
    
    total_tanks = Tank.query.count()
    
    today_risks = Risk.query.filter(
        Risk.detected_date == today,
        Risk.resolution_status != 'resolved'
    ).all()
    
    risk_counts = {
        'critical': sum(1 for r in today_risks if r.risk_level == 'critical'),
        'warning': sum(1 for r in today_risks if r.risk_level == 'warning'),
        'info': sum(1 for r in today_risks if r.risk_level == 'info')
    }
    
    today_feedings = FeedingRecord.query.filter_by(record_date=today).all()
    fed_tank_ids = set(f.tank_id for f in today_feedings)
    unfed_count = total_tanks - len(fed_tank_ids)
    
    overdue_water_changes = 0
    tanks = Tank.query.all()
    for tank in tanks:
        latest = WaterChangeRecord.query.filter_by(tank_id=tank.id).order_by(
            WaterChangeRecord.change_date.desc()
        ).first()
        if latest:
            expected = latest.next_scheduled_date or (latest.change_date + timedelta(days=Config.WATER_CHANGE_INTERVAL_DAYS))
            if today > expected:
                overdue_water_changes += 1
    
    return jsonify({
        'success': True,
        'stats': {
            'total_tanks': total_tanks,
            'today_risks': len(today_risks),
            'risk_counts': risk_counts,
            'unfed_count': unfed_count,
            'overdue_water_changes': overdue_water_changes,
            'today': today.isoformat()
        }
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)
