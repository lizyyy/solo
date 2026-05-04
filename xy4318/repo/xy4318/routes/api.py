import os
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename
from services.file_service import FileService
from services.analysis_service import AnalysisService
from services.report_service import ReportService
from config import Config

api_bp = Blueprint('api', __name__)

ALLOWED_EXTENSIONS = {'csv', 'json', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@api_bp.route('/upload/temperature', methods=['POST'])
def upload_temperature():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '没有上传文件'}), 400
    
    file = request.files['file']
    batch_number = request.form.get('batch_number', '')
    
    if file.filename == '':
        return jsonify({'success': False, 'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': '不支持的文件格式'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        result = FileService.import_temperature_csv(filepath, batch_number if batch_number else None)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@api_bp.route('/upload/transfer', methods=['POST'])
def upload_transfer():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '没有上传文件'}), 400
    
    file = request.files['file']
    batch_number = request.form.get('batch_number', '')
    
    if file.filename == '':
        return jsonify({'success': False, 'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': '不支持的文件格式'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        result = FileService.import_sample_transfer_json(filepath, batch_number if batch_number else None)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@api_bp.route('/upload/alarm', methods=['POST'])
def upload_alarm():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '没有上传文件'}), 400
    
    file = request.files['file']
    batch_number = request.form.get('batch_number', '')
    
    if file.filename == '':
        return jsonify({'success': False, 'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': '不支持的文件格式'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        result = FileService.import_alarm_csv(filepath, batch_number if batch_number else None)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@api_bp.route('/upload/review', methods=['POST'])
def upload_review():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '没有上传文件'}), 400
    
    file = request.files['file']
    batch_number = request.form.get('batch_number', '')
    
    if file.filename == '':
        return jsonify({'success': False, 'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': '不支持的文件格式'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        result = FileService.import_review_csv(filepath, batch_number if batch_number else None)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@api_bp.route('/import/history', methods=['GET'])
def get_import_history():
    history = FileService.get_import_history()
    return jsonify({'success': True, 'history': history})

@api_bp.route('/batches', methods=['GET'])
def get_batches():
    batches = FileService.get_batch_numbers()
    return jsonify({'success': True, 'batches': batches})

@api_bp.route('/batches/<batch_number>/overview', methods=['GET'])
def get_batch_overview(batch_number):
    overview = AnalysisService.get_batch_overview(batch_number)
    return jsonify({'success': True, 'overview': overview})

@api_bp.route('/analysis/run', methods=['POST'])
def run_analysis():
    data = request.get_json() or {}
    batch_number = data.get('batch_number')
    
    result = AnalysisService.run_full_analysis(batch_number)
    return jsonify(result)

@api_bp.route('/risks', methods=['GET'])
def get_risks():
    batch_number = request.args.get('batch_number')
    risks = AnalysisService.get_risk_analysis(batch_number)
    return jsonify({'success': True, 'risks': risks})

@api_bp.route('/risks/<int:risk_id>', methods=['GET'])
def get_risk_detail(risk_id):
    risks = AnalysisService.get_risk_analysis()
    for risk in risks:
        if risk['id'] == risk_id:
            return jsonify({'success': True, 'risk': risk})
    return jsonify({'success': False, 'error': '风险记录不存在'}), 404

@api_bp.route('/risks/<int:risk_id>/status', methods=['PUT'])
def update_risk_status(risk_id):
    data = request.get_json() or {}
    status = data.get('status', 'pending')
    
    result = AnalysisService.update_risk_status(risk_id, status)
    if result.get('success'):
        return jsonify(result)
    return jsonify(result), 404

@api_bp.route('/risks/<int:risk_id>/conclusions', methods=['POST'])
def add_conclusion(risk_id):
    data = request.get_json() or {}
    
    result = AnalysisService.add_review_conclusion(risk_id, data)
    if result.get('success'):
        return jsonify(result)
    return jsonify(result), 404

@api_bp.route('/risks/<int:risk_id>/todos', methods=['POST'])
def add_todo(risk_id):
    data = request.get_json() or {}
    
    result = AnalysisService.add_todo_item(risk_id, data)
    if result.get('success'):
        return jsonify(result)
    return jsonify(result), 404

@api_bp.route('/export/markdown', methods=['GET'])
def export_markdown():
    batch_number = request.args.get('batch_number')
    
    try:
        report_content = ReportService.generate_markdown_report(batch_number)
        filepath = ReportService.save_report_to_file(report_content, 'markdown')
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=os.path.basename(filepath),
            mimetype='text/markdown'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/export/csv', methods=['GET'])
def export_csv():
    batch_number = request.args.get('batch_number')
    
    try:
        csv_content = ReportService.generate_csv_issues(batch_number)
        filepath = ReportService.save_report_to_file(csv_content, 'csv')
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=os.path.basename(filepath),
            mimetype='text/csv'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/export/preview/markdown', methods=['GET'])
def preview_markdown():
    batch_number = request.args.get('batch_number')
    
    try:
        report_content = ReportService.generate_markdown_report(batch_number)
        return jsonify({'success': True, 'content': report_content})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/preview/import/samples', methods=['GET'])
def get_sample_files():
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'samples')
    
    samples = []
    if os.path.exists(sample_dir):
        for filename in os.listdir(sample_dir):
            if filename.endswith(('.csv', '.json')):
                samples.append({
                    'name': filename,
                    'type': 'csv' if filename.endswith('.csv') else 'json',
                    'url': f'/sample_data/{filename}'
                })
    
    return jsonify({'success': True, 'samples': samples})

@api_bp.route('/config', methods=['GET'])
def get_config():
    return jsonify({
        'success': True,
        'config': {
            'temperature_lower_threshold': Config.TEMPERATURE_LOWER_THRESHOLD,
            'temperature_upper_threshold': Config.TEMPERATURE_UPPER_THRESHOLD,
            'overtemp_duration_threshold': Config.OVERTEMP_DURATION_THRESHOLD
        }
    })
