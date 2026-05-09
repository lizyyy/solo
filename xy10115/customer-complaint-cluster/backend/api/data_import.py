from flask import Blueprint, request, jsonify
from backend.services.data_import_service import DataImportService

data_import_bp = Blueprint('data_import', __name__)


@data_import_bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        file_path = DataImportService.save_uploaded_file(file)
        text_column = request.form.get('text_column', 'text')
        tag_column = request.form.get('tag_column', 'tags')
        id_column = request.form.get('id_column')
        
        result = DataImportService.import_from_file(file_path, text_column, tag_column, id_column)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@data_import_bp.route('/complaints', methods=['GET'])
def list_complaints():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        cluster_id = request.args.get('cluster_id', type=int)
        
        result = DataImportService.get_complaints(page=page, per_page=per_page, cluster_id=cluster_id)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@data_import_bp.route('/complaints/<int:complaint_id>', methods=['GET'])
def get_complaint(complaint_id):
    try:
        complaint = DataImportService.get_complaint(complaint_id)
        if not complaint:
            return jsonify({'error': 'Complaint not found'}), 404
        return jsonify({
            'success': True,
            'data': complaint
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@data_import_bp.route('/stats', methods=['GET'])
def get_stats():
    try:
        stats = DataImportService.get_stats()
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400
