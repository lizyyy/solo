"""本地 API 服务"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from flask import Flask, request, jsonify, g
from flask_cors import CORS

from ..config import get_config, Config
from ..storage.repository import DataRepository
from ..storage.models import Sample, DefectGroupModel, AnomalyModel


def create_app(db_path: Optional[str] = None, config: Optional[Config] = None):
    """创建 Flask 应用"""
    config = config or get_config()
    db_path = db_path or config.database.db_path

    app = Flask(__name__)
    CORS(app)

    def get_repo():
        if 'repo' not in g:
            g.repo = DataRepository(db_path, config)
        return g.repo

    @app.teardown_appcontext
    def close_repo(exception=None):
        repo = g.pop('repo', None)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        """健康检查"""
        return jsonify({
            'status': 'ok',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '0.1.0'
        })

    @app.route('/api/batches', methods=['GET'])
    def list_batches():
        """列出所有批次"""
        repo = get_repo()
        limit = request.args.get('limit', 100, type=int)

        batches = repo.list_batches(limit)
        result = []

        for batch in batches:
            result.append({
                'id': batch.id,
                'batch_id': batch.batch_id,
                'name': batch.name,
                'created_at': batch.created_at.isoformat() if batch.created_at else None,
                'updated_at': batch.updated_at.isoformat() if batch.updated_at else None,
            })

        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        })

    @app.route('/api/batches/<batch_id>', methods=['GET'])
    def get_batch(batch_id: str):
        """获取批次详情"""
        repo = get_repo()

        batch = repo.get_batch(batch_id)
        if not batch:
            return jsonify({
                'success': False,
                'error': f'Batch not found: {batch_id}'
            }), 404

        samples = repo.get_samples_by_batch(batch_id)
        groups = repo.get_groups_by_batch(batch_id)
        anomalies = repo.get_anomalies_by_batch(batch_id)

        samples_data = []
        for sample in samples:
            samples_data.append(_sample_to_dict(sample))

        groups_data = []
        for group in groups:
            groups_data.append(_group_to_dict(group, samples))

        anomalies_data = []
        for anomaly in anomalies:
            anomalies_data.append(_anomaly_to_dict(anomaly))

        return jsonify({
            'success': True,
            'data': {
                'batch': {
                    'batch_id': batch.batch_id,
                    'name': batch.name,
                    'created_at': batch.created_at.isoformat() if batch.created_at else None,
                },
                'samples': samples_data,
                'groups': groups_data,
                'anomalies': anomalies_data,
                'summary': {
                    'total_samples': len(samples),
                    'total_groups': len(groups),
                    'total_anomalies': len(anomalies),
                }
            }
        })

    @app.route('/api/samples/<sample_id>', methods=['GET'])
    def get_sample(sample_id: str):
        """获取试样详情"""
        repo = get_repo()

        sample = repo.get_sample(sample_id)
        if not sample:
            return jsonify({
                'success': False,
                'error': f'Sample not found: {sample_id}'
            }), 404

        history = repo.get_verification_history(sample_id)
        history_data = []
        for h in history:
            history_data.append({
                'action': h.action,
                'old_group_id': h.old_group_id,
                'new_group_id': h.new_group_id,
                'notes': h.notes,
                'performed_by': h.performed_by,
                'performed_at': h.performed_at.isoformat() if h.performed_at else None,
            })

        return jsonify({
            'success': True,
            'data': {
                'sample': _sample_to_dict(sample),
                'verification_history': history_data,
            }
        })

    @app.route('/api/samples/<sample_id>/group', methods=['PUT'])
    def update_sample_group(sample_id: str):
        """更新试样分组"""
        repo = get_repo()

        data = request.get_json()
        if not data or 'group_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing group_id in request body'
            }), 400

        new_group_id = data['group_id']
        notes = data.get('notes', '')
        performed_by = data.get('performed_by', 'api_user')

        sample = repo.get_sample(sample_id)
        if not sample:
            return jsonify({
                'success': False,
                'error': f'Sample not found: {sample_id}'
            }), 404

        old_group = None
        if sample.group_id:
            old_group = repo.get_defect_group(sample.group_id)

        result = repo.update_sample_group(
            sample_id=sample_id,
            new_group_id=new_group_id,
            notes=notes,
            performed_by=performed_by
        )

        if not result:
            return jsonify({
                'success': False,
                'error': 'Failed to update sample group'
            }), 500

        new_group = repo.get_defect_group(new_group_id)

        return jsonify({
            'success': True,
            'data': {
                'sample_id': sample_id,
                'old_group': {
                    'group_id': old_group.group_id if old_group else None,
                    'name': old_group.name if old_group else None,
                },
                'new_group': {
                    'group_id': new_group.group_id if new_group else new_group_id,
                    'name': new_group.name if new_group else None,
                },
                'notes': notes,
                'performed_by': performed_by,
                'performed_at': datetime.utcnow().isoformat(),
            }
        })

    @app.route('/api/samples/<sample_id>/verify', methods=['POST'])
    def verify_sample(sample_id: str):
        """确认试样"""
        repo = get_repo()

        data = request.get_json() or {}
        verified = data.get('verified', True)
        notes = data.get('notes', '')
        verified_by = data.get('verified_by', 'api_user')

        sample = repo.get_sample(sample_id)
        if not sample:
            return jsonify({
                'success': False,
                'error': f'Sample not found: {sample_id}'
            }), 404

        result = repo.verify_sample(
            sample_id=sample_id,
            verified=verified,
            notes=notes,
            verified_by=verified_by
        )

        if not result:
            return jsonify({
                'success': False,
                'error': 'Failed to verify sample'
            }), 500

        return jsonify({
            'success': True,
            'data': {
                'sample_id': sample_id,
                'verified': verified,
                'notes': notes,
                'verified_by': verified_by,
                'verified_at': datetime.utcnow().isoformat(),
            }
        })

    @app.route('/api/groups', methods=['GET'])
    def list_groups():
        """获取分组列表"""
        repo = get_repo()
        batch_id = request.args.get('batch_id')

        if not batch_id:
            return jsonify({
                'success': False,
                'error': 'Missing batch_id parameter'
            }), 400

        groups = repo.get_groups_by_batch(batch_id)
        samples = repo.get_samples_by_batch(batch_id)

        result = []
        for group in groups:
            result.append(_group_to_dict(group, samples))

        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        })

    @app.route('/api/groups', methods=['POST'])
    def create_group():
        """创建手动分组"""
        repo = get_repo()

        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Missing request body'
            }), 400

        batch_id = data.get('batch_id')
        name = data.get('name')
        description = data.get('description', '')
        created_by = data.get('created_by', 'api_user')

        if not batch_id or not name:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: batch_id and name'
            }), 400

        group = repo.create_manual_group(
            batch_id=batch_id,
            name=name,
            description=description,
            created_by=created_by
        )

        if not group:
            return jsonify({
                'success': False,
                'error': 'Failed to create group'
            }), 500

        return jsonify({
            'success': True,
            'data': {
                'group_id': group.group_id,
                'name': group.name,
                'description': group.description,
                'is_manual': group.is_manual,
                'created_by': group.created_by,
                'created_at': group.created_at.isoformat() if group.created_at else None,
            }
        })

    @app.route('/api/groups/<group_id>', methods=['GET'])
    def get_group(group_id: str):
        """获取分组详情"""
        repo = get_repo()

        group = repo.get_defect_group(group_id)
        if not group:
            return jsonify({
                'success': False,
                'error': f'Group not found: {group_id}'
            }), 404

        with repo.get_session() as session:
            samples = session.query(Sample).filter(
                Sample.group_id == group.id
            ).all()

        samples_data = []
        for sample in samples:
            samples_data.append(_sample_to_dict(sample))

        return jsonify({
            'success': True,
            'data': {
                'group': _group_to_dict(group, samples),
                'samples': samples_data,
            }
        })

    @app.route('/api/anomalies', methods=['GET'])
    def list_anomalies():
        """获取异常列表"""
        repo = get_repo()
        batch_id = request.args.get('batch_id')
        reviewed = request.args.get('reviewed')

        if not batch_id:
            return jsonify({
                'success': False,
                'error': 'Missing batch_id parameter'
            }), 400

        anomalies = repo.get_anomalies_by_batch(batch_id)

        if reviewed is not None:
            is_reviewed = reviewed.lower() == 'true'
            anomalies = [a for a in anomalies if a.is_reviewed == is_reviewed]

        result = []
        for anomaly in anomalies:
            result.append(_anomaly_to_dict(anomaly))

        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        })

    @app.route('/api/anomalies/<anomaly_id>/review', methods=['POST'])
    def review_anomaly(anomaly_id: str):
        """复核异常"""
        repo = get_repo()

        data = request.get_json() or {}
        notes = data.get('notes', '')
        reviewed_by = data.get('reviewed_by', 'api_user')

        result = repo.review_anomaly(
            anomaly_id=anomaly_id,
            notes=notes,
            reviewed_by=reviewed_by
        )

        if not result:
            return jsonify({
                'success': False,
                'error': f'Anomaly not found: {anomaly_id}'
            }), 404

        return jsonify({
            'success': True,
            'data': {
                'anomaly_id': anomaly_id,
                'is_reviewed': True,
                'notes': notes,
                'reviewed_by': reviewed_by,
                'reviewed_at': datetime.utcnow().isoformat(),
            }
        })

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'error': 'Not found'
        }), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

    return app


def _sample_to_dict(sample: Sample) -> Dict[str, Any]:
    """将 Sample 转换为字典"""
    result = {
        'sample_id': sample.sample_id,
        'image_path': sample.image_path,
        'formula': sample.formula,
        'notes': sample.notes,
        'is_verified': sample.is_verified,
        'verified_at': sample.verified_at.isoformat() if sample.verified_at else None,
        'verified_by': sample.verified_by,
        'verification_notes': sample.verification_notes,
        'created_at': sample.created_at.isoformat() if sample.created_at else None,
    }

    if sample.image_features:
        img = sample.image_features
        result['image_features'] = {
            'width': img.width,
            'height': img.height,
            'avg_lab': [img.avg_lab_l, img.avg_lab_a, img.avg_lab_b],
            'color_contrast': img.color_contrast,
            'brightness': img.brightness,
            'bubble_count': img.bubble_count,
            'bubble_area_ratio': img.bubble_area_ratio,
        }

    if sample.text_features:
        txt = sample.text_features
        result['text_features'] = {
            'has_defect': txt.has_defect,
            'defect_categories': txt.defect_categories,
            'defect_keywords': txt.defect_keywords,
            'sentiment_score': txt.sentiment_score,
        }

    if sample.group:
        result['group'] = {
            'group_id': sample.group.group_id,
            'name': sample.group.name,
            'dominant_defect_type': sample.group.dominant_defect_type,
        }

    return result


def _group_to_dict(group: DefectGroupModel, samples: List[Sample]) -> Dict[str, Any]:
    """将 DefectGroupModel 转换为字典"""
    group_samples = [s for s in samples if s.group_id == group.id]
    sample_ids = [s.sample_id for s in group_samples]

    return {
        'group_id': group.group_id,
        'name': group.name,
        'description': group.description,
        'dominant_defect_type': group.dominant_defect_type,
        'similarity_score': group.similarity_score,
        'is_manual': group.is_manual,
        'sample_ids': sample_ids,
        'sample_count': len(sample_ids),
        'features_summary': group.features_summary,
        'created_at': group.created_at.isoformat() if group.created_at else None,
        'updated_at': group.updated_at.isoformat() if group.updated_at else None,
    }


def _anomaly_to_dict(anomaly: AnomalyModel) -> Dict[str, Any]:
    """将 AnomalyModel 转换为字典"""
    return {
        'anomaly_id': anomaly.anomaly_id,
        'sample_id': anomaly.sample_id,
        'anomaly_type': anomaly.anomaly_type,
        'severity': anomaly.severity,
        'description': anomaly.description,
        'comparison_samples': anomaly.comparison_samples,
        'details': anomaly.details,
        'is_reviewed': anomaly.is_reviewed,
        'reviewed_at': anomaly.reviewed_at.isoformat() if anomaly.reviewed_at else None,
        'reviewed_by': anomaly.reviewed_by,
        'review_notes': anomaly.review_notes,
        'created_at': anomaly.created_at.isoformat() if anomaly.created_at else None,
    }
