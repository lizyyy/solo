from flask import Blueprint, request, jsonify
from backend.services.clustering_service import ClusteringService

clustering_bp = Blueprint('clustering', __name__)


@clustering_bp.route('/run', methods=['POST'])
def run_clustering():
    try:
        data = request.get_json() or {}
        version_name = data.get('version_name')
        description = data.get('description')
        
        result = ClusteringService.run_clustering(version_name, description)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@clustering_bp.route('/clusters', methods=['GET'])
def list_clusters():
    try:
        version_id = request.args.get('version_id', type=int)
        clusters = ClusteringService.get_clusters(version_id)
        return jsonify({
            'success': True,
            'data': clusters
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@clustering_bp.route('/clusters/<int:cluster_id>', methods=['GET'])
def get_cluster(cluster_id):
    try:
        cluster = ClusteringService.get_cluster(cluster_id)
        if not cluster:
            return jsonify({'error': 'Cluster not found'}), 404
        return jsonify({
            'success': True,
            'data': cluster
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400
