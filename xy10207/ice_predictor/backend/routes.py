import os
import io
import json
import pandas as pd
from datetime import datetime
from flask import request, jsonify, send_file, Blueprint
from sqlalchemy import func
from .config import EXPORTS_DIR
from .models import db, DataImport, Location, SalesRecord, IcePrediction, ExportLog
from .data_processor import calculate_file_hash, save_imported_data
from .predictor import run_prediction_for_import, generate_route_suggestions, review_prediction

api = Blueprint('api', __name__)

@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})

@api.route('/imports', methods=['GET'])
def list_imports():
    imports = DataImport.query.order_by(DataImport.import_time.desc()).all()
    result = []
    for imp in imports:
        result.append({
            'id': imp.id,
            'filename': imp.filename,
            'file_hash': imp.file_hash[:16] + '...',
            'row_count': imp.row_count,
            'processed_count': imp.processed_count,
            'import_time': imp.import_time.isoformat() if imp.import_time else None,
            'status': imp.status,
            'predictions_count': len(imp.predictions),
            'reviews_pending': sum(1 for p in imp.predictions if p.review_status == 'pending')
        })
    return jsonify(result)

@api.route('/imports/<int:import_id>', methods=['GET'])
def get_import_detail(import_id):
    imp = DataImport.query.get(import_id)
    if not imp:
        return jsonify({'error': '未找到'}), 404
    
    return jsonify({
        'id': imp.id,
        'filename': imp.filename,
        'row_count': imp.row_count,
        'processed_count': imp.processed_count,
        'status': imp.status,
        'import_time': imp.import_time.isoformat() if imp.import_time else None
    })

@api.route('/import/upload', methods=['POST'])
def upload_data():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': '无效文件'}), 400
    
    file_content = file.read()
    file_hash = calculate_file_hash(file_content)
    
    existing = DataImport.query.filter_by(file_hash=file_hash).first()
    if existing:
        return jsonify({
            'duplicate': True,
            'existing_import_id': existing.id,
            'message': '该文件已导入过，状态: ' + existing.status
        }), 200
    
    try:
        filename = file.filename
        if filename.endswith('.xlsx'):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            df = pd.read_csv(io.BytesIO(file_content))
    except Exception as e:
        return jsonify({'error': f'解析文件失败: {str(e)}'}), 400
    
    import_obj = DataImport(
        filename=filename,
        file_hash=file_hash,
        row_count=len(df),
        status='imported'
    )
    db.session.add(import_obj)
    db.session.commit()
    
    try:
        saved = save_imported_data(import_obj, df)
    except Exception as e:
        db.session.delete(import_obj)
        db.session.commit()
        return jsonify({'error': f'保存数据失败: {str(e)}'}), 500
    
    return jsonify({
        'success': True,
        'import_id': import_obj.id,
        'row_count': len(df),
        'processed_count': saved,
        'status': import_obj.status
    })

@api.route('/imports/<int:import_id>/predict', methods=['POST'])
def run_prediction(import_id):
    result = run_prediction_for_import(import_id)
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result)

@api.route('/predictions', methods=['GET'])
def list_predictions():
    import_id = request.args.get('import_id', type=int)
    priority = request.args.get('priority')
    reviewed = request.args.get('reviewed')
    
    query = IcePrediction.query
    
    if import_id:
        query = query.filter(IcePrediction.import_id == import_id)
    if priority:
        query = query.filter(IcePrediction.priority_level == priority)
    if reviewed == 'true':
        query = query.filter(IcePrediction.human_reviewed == True)
    elif reviewed == 'false':
        query = query.filter(IcePrediction.human_reviewed == False)
    
    predictions = query.order_by(IcePrediction.urgency_score.desc()).all()
    
    result = []
    for p in predictions:
        result.append({
            'id': p.id,
            'location_name': p.location.name,
            'location_id': p.location.location_id,
            'prediction_date': p.prediction_date.isoformat(),
            'prediction_hour': p.prediction_hour,
            'urgency_score': p.urgency_score,
            'priority_level': p.priority_level,
            'recommended_refill': p.recommended_refill,
            'ice_remaining': p.ice_remaining,
            'predicted_depletion_hours': p.predicted_depletion_hours,
            'prediction_reason': p.prediction_reason,
            'human_reviewed': p.human_reviewed,
            'review_status': p.review_status,
            'review_note': p.review_note
        })
    return jsonify(result)

@api.route('/predictions/<int:prediction_id>/review', methods=['POST'])
def review(prediction_id):
    data = request.get_json() or {}
    status = data.get('status')
    note = data.get('note', '')
    
    if not status:
        return jsonify({'error': '缺少 status 参数'}), 400
    
    result = review_prediction(prediction_id, status, note)
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result)

@api.route('/imports/<int:import_id>/route', methods=['GET'])
def get_route(import_id):
    limit = request.args.get('limit', 10, type=int)
    result = generate_route_suggestions(import_id, limit)
    return jsonify(result)

@api.route('/locations', methods=['GET'])
def list_locations():
    locations = Location.query.all()
    result = []
    for loc in locations:
        result.append({
            'id': loc.id,
            'location_id': loc.location_id,
            'name': loc.name,
            'zone': loc.zone,
            'capacity': loc.capacity,
            'is_outdoor': loc.is_outdoor,
            'priority': loc.priority,
            'latitude': loc.latitude,
            'longitude': loc.longitude
        })
    return jsonify(result)

@api.route('/imports/<int:import_id>/export', methods=['POST'])
def export_results(import_id):
    data = request.get_json() or {}
    include_reviewed_only = data.get('reviewed_only', False)
    
    imp = DataImport.query.get(import_id)
    if not imp:
        return jsonify({'error': '导入记录不存在'}), 404
    
    query = IcePrediction.query.filter(IcePrediction.import_id == import_id)
    if include_reviewed_only:
        query = query.filter(IcePrediction.human_reviewed == True)
    
    predictions = query.order_by(IcePrediction.urgency_score.desc()).all()
    
    rows = []
    for p in predictions:
        rows.append({
            '投放点ID': p.location.location_id,
            '投放点名称': p.location.name,
            '是否户外': '是' if p.location.is_outdoor else '否',
            '预测日期': p.prediction_date.isoformat(),
            '预测时刻': f'{p.prediction_hour}:00' if p.prediction_hour else '',
            '紧急度分数': p.urgency_score,
            '优先级': p.priority_level,
            '建议补冰量': p.recommended_refill,
            '剩余冰量': p.ice_remaining,
            '预计缺冰小时数': p.predicted_depletion_hours,
            '预测原因': p.prediction_reason,
            '是否已复核': '是' if p.human_reviewed else '否',
            '复核状态': p.review_status,
            '复核备注': p.review_note or ''
        })
    
    if not rows:
        return jsonify({'error': '没有可导出的数据'}), 400
    
    df = pd.DataFrame(rows)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'predictions_import_{import_id}_{timestamp}.xlsx'
    filepath = os.path.join(EXPORTS_DIR, filename)
    
    df.to_excel(filepath, index=False, engine='openpyxl')
    
    export_log = ExportLog(
        import_id=import_id,
        filename=filename,
        record_count=len(rows),
        status='success'
    )
    db.session.add(export_log)
    db.session.commit()
    
    return send_file(
        filepath,
        as_attachment=True,
        download_name=filename,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

@api.route('/stats', methods=['GET'])
def get_stats():
    total_imports = DataImport.query.count()
    total_locations = Location.query.count()
    total_predictions = IcePrediction.query.count()
    pending_reviews = IcePrediction.query.filter_by(human_reviewed=False).count()
    
    priority_counts = db.session.query(
        IcePrediction.priority_level,
        func.count(IcePrediction.id)
    ).group_by(IcePrediction.priority_level).all()
    
    priority_stats = {level: count for level, count in priority_counts}
    
    return jsonify({
        'imports': total_imports,
        'locations': total_locations,
        'predictions': total_predictions,
        'pending_reviews': pending_reviews,
        'priority_breakdown': priority_stats
    })
