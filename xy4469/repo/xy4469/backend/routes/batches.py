from flask import Blueprint, request, jsonify
from models import db, Batch, Particle, Control, AuditLog
from services import DataImporter, DataExporter
from config import Config
import os
from werkzeug.utils import secure_filename
from datetime import datetime

batches_bp = Blueprint('batches', __name__)

@batches_bp.route('', methods=['GET'])
def list_batches():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '').strip()
        
        query = Batch.query
        
        if search:
            query = query.filter(
                db.or_(
                    Batch.batch_id.contains(search),
                    Batch.sample_name.contains(search),
                    Batch.location.contains(search)
                )
            )
        
        pagination = query.order_by(Batch.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        batches = []
        for batch in pagination.items:
            batch_dict = batch.to_dict()
            batches.append(batch_dict)
        
        return jsonify({
            'success': True,
            'data': {
                'batches': batches,
                'total': pagination.total,
                'pages': pagination.pages,
                'current_page': page,
                'per_page': per_page
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@batches_bp.route('/<batch_id>', methods=['GET'])
def get_batch(batch_id):
    try:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        if not batch:
            return jsonify({'success': False, 'error': '批次不存在'}), 404
        
        particles = Particle.query.filter_by(batch_id=batch.id).all()
        controls = Control.query.filter_by(batch_id=batch.id).all()
        
        result = batch.to_dict()
        result['particles'] = [p.to_dict() for p in particles]
        result['controls'] = [c.to_dict() for c in controls]
        
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@batches_bp.route('/<batch_id>/particles', methods=['GET'])
def get_batch_particles(batch_id):
    try:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        if not batch:
            return jsonify({'success': False, 'error': '批次不存在'}), 404
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        classification = request.args.get('classification', '').strip()
        risk_level = request.args.get('risk_level', '').strip()
        is_reviewed = request.args.get('is_reviewed', None)
        search = request.args.get('search', '').strip()
        
        query = Particle.query.filter_by(batch_id=batch.id)
        
        if classification:
            query = query.filter(Particle.get_final_classification() == classification)
        
        if risk_level:
            query = query.filter_by(risk_level=risk_level)
        
        if is_reviewed is not None:
            if is_reviewed.lower() in ['true', '1']:
                query = query.filter(Particle.manual_classification.isnot(None))
            else:
                query = query.filter(Particle.manual_classification.is_(None))
        
        if search:
            query = query.filter(Particle.particle_id.contains(search))
        
        pagination = query.order_by(Particle.created_at.asc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        particles = [p.to_dict() for p in pagination.items]
        
        return jsonify({
            'success': True,
            'data': {
                'particles': particles,
                'total': pagination.total,
                'pages': pagination.pages,
                'current_page': page,
                'per_page': per_page,
                'batch_info': batch.to_dict()
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@batches_bp.route('/import', methods=['POST'])
def import_batch():
    try:
        if 'batch_file' not in request.files:
            return jsonify({'success': False, 'error': '缺少批次文件'}), 400
        
        batch_file = request.files['batch_file']
        annotations_file = request.files.get('annotations_file')
        controls_file = request.files.get('controls_file')
        user = request.form.get('user', 'system')
        
        if batch_file.filename == '':
            return jsonify({'success': False, 'error': '未选择文件'}), 400
        
        if not DataImporter.allowed_file(batch_file.filename):
            return jsonify({'success': False, 'error': '不支持的文件格式'}), 400
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        batch_filename = secure_filename(f'{timestamp}_{batch_file.filename}')
        batch_path = os.path.join(Config.UPLOAD_FOLDER, batch_filename)
        batch_file.save(batch_path)
        
        annotations_path = None
        if annotations_file and annotations_file.filename:
            if DataImporter.allowed_file(annotations_file.filename):
                annot_filename = secure_filename(f'{timestamp}_{annotations_file.filename}')
                annotations_path = os.path.join(Config.UPLOAD_FOLDER, annot_filename)
                annotations_file.save(annotations_path)
        
        controls_path = None
        if controls_file and controls_file.filename:
            if DataImporter.allowed_file(controls_file.filename):
                ctrl_filename = secure_filename(f'{timestamp}_{controls_file.filename}')
                controls_path = os.path.join(Config.UPLOAD_FOLDER, ctrl_filename)
                controls_file.save(controls_path)
        
        batch, particles, controls = DataImporter.import_from_csv(
            batch_path, annotations_path, controls_path, user
        )
        
        return jsonify({
            'success': True,
            'data': {
                'batch': batch.to_dict(),
                'particles_count': len(particles),
                'controls_count': len(controls)
            }
        })
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@batches_bp.route('/import-examples', methods=['POST'])
def import_examples():
    try:
        user = request.form.get('user', 'system')
        
        examples_dir = Config.EXAMPLES_FOLDER
        
        batch_csv = os.path.join(examples_dir, 'batch_info.csv')
        annotations_csv = os.path.join(examples_dir, 'annotations.csv')
        controls_csv = os.path.join(examples_dir, 'controls.csv')
        
        if not os.path.exists(batch_csv):
            return jsonify({'success': False, 'error': '示例数据文件不存在'}), 404
        
        batch, particles, controls = DataImporter.import_from_csv(
            batch_csv,
            annotations_csv if os.path.exists(annotations_csv) else None,
            controls_csv if os.path.exists(controls_csv) else None,
            user
        )
        
        return jsonify({
            'success': True,
            'data': {
                'batch': batch.to_dict(),
                'particles_count': len(particles),
                'controls_count': len(controls)
            }
        })
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@batches_bp.route('/<batch_id>', methods=['DELETE'])
def delete_batch(batch_id):
    try:
        batch = Batch.query.filter_by(batch_id=batch_id).first()
        if not batch:
            return jsonify({'success': False, 'error': '批次不存在'}), 404
        
        audit_log = AuditLog(
            action='delete',
            entity_type='batch',
            entity_id=batch.id,
            details=f'删除批次 {batch.batch_id}',
            user=request.args.get('user', 'system')
        )
        
        db.session.delete(batch)
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({'success': True, 'message': f'批次 {batch_id} 已删除'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
