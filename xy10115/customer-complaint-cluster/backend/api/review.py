from flask import Blueprint, request, jsonify
from backend.services.review_service import ReviewService

review_bp = Blueprint('review', __name__)


@review_bp.route('/move', methods=['POST'])
def move_complaint():
    try:
        data = request.get_json()
        complaint_id = data['complaint_id']
        target_cluster_id = data['target_cluster_id']
        reason = data.get('reason')
        
        result = ReviewService.move_complaint(complaint_id, target_cluster_id, reason)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@review_bp.route('/cluster', methods=['POST'])
def create_cluster():
    try:
        data = request.get_json()
        name = data['name']
        description = data.get('description')
        complaint_ids = data.get('complaint_ids')
        reason = data.get('reason')
        
        result = ReviewService.create_cluster(name, description, complaint_ids, reason)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@review_bp.route('/cluster/<int:cluster_id>', methods=['PUT'])
def update_cluster(cluster_id):
    try:
        data = request.get_json()
        name = data.get('name')
        description = data.get('description')
        reason = data.get('reason')
        
        result = ReviewService.update_cluster(cluster_id, name, description, reason)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400
