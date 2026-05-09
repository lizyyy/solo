from flask import Blueprint, request, jsonify
from backend.services.history_service import HistoryService

history_bp = Blueprint('history', __name__)


@history_bp.route('/versions', methods=['GET'])
def list_versions():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        result = HistoryService.get_versions(page=page, per_page=per_page)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@history_bp.route('/versions/<int:version_id>', methods=['GET'])
def get_version(version_id):
    try:
        version = HistoryService.get_version(version_id)
        if not version:
            return jsonify({'error': 'Version not found'}), 404
        return jsonify({
            'success': True,
            'data': version
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@history_bp.route('/versions/<int:version_id>/rollback', methods=['POST'])
def rollback_to_version(version_id):
    try:
        data = request.get_json() or {}
        reason = data.get('reason')
        
        result = HistoryService.rollback_to_version(version_id, reason)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@history_bp.route('/complaint/<int:complaint_id>', methods=['GET'])
def get_complaint_history(complaint_id):
    try:
        history = HistoryService.get_complaint_history(complaint_id)
        if not history:
            return jsonify({'error': 'Complaint not found'}), 404
        return jsonify({
            'success': True,
            'data': history
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400
