from flask import Blueprint, request, jsonify
from models import db, Particle, Batch, AuditLog
from services import MicroplasticClassifier
from config import Config
from datetime import datetime

particles_bp = Blueprint('particles', __name__)

@particles_bp.route('/<particle_id>', methods=['GET'])
def get_particle(particle_id):
    try:
        particle = Particle.query.filter_by(particle_id=particle_id).first()
        if not particle:
            return jsonify({'success': False, 'error': '颗粒不存在'}), 404
        
        return jsonify({
            'success': True,
            'data': particle.to_dict(include_batch=True)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@particles_bp.route('/<particle_id>/review', methods=['POST'])
def review_particle(particle_id):
    try:
        particle = Particle.query.filter_by(particle_id=particle_id).first()
        if not particle:
            return jsonify({'success': False, 'error': '颗粒不存在'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '缺少请求数据'}), 400
        
        manual_classification = data.get('classification')
        if manual_classification and manual_classification not in Config.CLASSIFICATION_CLASSES:
            return jsonify({'success': False, 'error': f'无效的分类类型。有效值: {Config.CLASSIFICATION_CLASSES}'}), 400
        
        manual_confidence = data.get('confidence')
        if manual_confidence is not None:
            try:
                manual_confidence = float(manual_confidence)
                if manual_confidence < 0 or manual_confidence > 1:
                    manual_confidence = max(0, min(1, manual_confidence))
            except:
                return jsonify({'success': False, 'error': '置信度必须是 0-1 之间的数值'}), 400
        
        review_notes = data.get('notes', '').strip()
        reviewed_by = data.get('reviewed_by', 'anonymous').strip()
        
        old_classification = particle.manual_classification
        old_confidence = particle.manual_confidence
        
        particle.manual_classification = manual_classification
        particle.manual_confidence = manual_confidence
        particle.reviewed_by = reviewed_by
        particle.reviewed_at = datetime.utcnow()
        particle.review_notes = review_notes
        
        if manual_classification:
            features = {
                'area': particle.area,
                'perimeter': particle.perimeter,
                'aspect_ratio': particle.aspect_ratio,
                'circularity': particle.circularity,
                'solidity': particle.solidity,
                'extent': particle.extent,
                'mean_intensity': particle.mean_intensity,
            }
            particle.risk_level = MicroplasticClassifier.assess_risk(manual_classification, features)
        
        audit_details = f'复核颗粒 {particle.particle_id}'
        if old_classification != manual_classification:
            audit_details += f'，分类从 {old_classification} 改为 {manual_classification}'
        if old_confidence != manual_confidence:
            audit_details += f'，置信度从 {old_confidence} 改为 {manual_confidence}'
        
        audit_log = AuditLog(
            action='review',
            entity_type='particle',
            entity_id=particle.id,
            details=audit_details,
            user=reviewed_by
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': particle.to_dict(include_batch=True)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@particles_bp.route('/<particle_id>/flag', methods=['POST'])
def flag_particle(particle_id):
    try:
        particle = Particle.query.filter_by(particle_id=particle_id).first()
        if not particle:
            return jsonify({'success': False, 'error': '颗粒不存在'}), 404
        
        data = request.get_json() or {}
        is_flagged = data.get('is_flagged', not particle.is_flagged)
        user = data.get('user', 'system')
        
        particle.is_flagged = is_flagged
        
        audit_log = AuditLog(
            action='flag' if is_flagged else 'unflag',
            entity_type='particle',
            entity_id=particle.id,
            details=f'{"标记" if is_flagged else "取消标记"}颗粒 {particle.particle_id}',
            user=user
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': particle.to_dict()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@particles_bp.route('/<particle_id>/reclassify', methods=['POST'])
def reclassify_particle(particle_id):
    try:
        particle = Particle.query.filter_by(particle_id=particle_id).first()
        if not particle:
            return jsonify({'success': False, 'error': '颗粒不存在'}), 404
        
        features = {
            'area': particle.area,
            'perimeter': particle.perimeter,
            'aspect_ratio': particle.aspect_ratio,
            'circularity': particle.circularity,
            'solidity': particle.solidity,
            'extent': particle.extent,
            'mean_intensity': particle.mean_intensity,
        }
        
        new_class, new_conf = MicroplasticClassifier.classify(features)
        new_risk = MicroplasticClassifier.assess_risk(new_class, features)
        
        old_class = particle.auto_classification
        old_conf = particle.auto_confidence
        
        particle.auto_classification = new_class
        particle.auto_confidence = new_conf
        particle.risk_level = new_risk
        
        if particle.manual_classification:
            final_risk = MicroplasticClassifier.assess_risk(particle.manual_classification, features)
            particle.risk_level = final_risk
        
        audit_log = AuditLog(
            action='reclassify',
            entity_type='particle',
            entity_id=particle.id,
            details=f'重新分类颗粒 {particle.particle_id}: {old_class}({old_conf:.2f}) -> {new_class}({new_conf:.2f})',
            user='system'
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'particle': particle.to_dict(),
                'old_classification': old_class,
                'old_confidence': old_conf,
                'new_classification': new_class,
                'new_confidence': new_conf
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@particles_bp.route('/batch-reviews', methods=['POST'])
def batch_review():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '缺少请求数据'}), 400
        
        particle_ids = data.get('particle_ids', [])
        if not particle_ids:
            return jsonify({'success': False, 'error': '缺少颗粒编号列表'}), 400
        
        classification = data.get('classification')
        if classification and classification not in Config.CLASSIFICATION_CLASSES:
            return jsonify({'success': False, 'error': f'无效的分类类型。有效值: {Config.CLASSIFICATION_CLASSES}'}), 400
        
        confidence = data.get('confidence')
        if confidence is not None:
            try:
                confidence = float(confidence)
                confidence = max(0, min(1, confidence))
            except:
                return jsonify({'success': False, 'error': '置信度必须是 0-1 之间的数值'}), 400
        
        reviewed_by = data.get('reviewed_by', 'anonymous').strip()
        
        updated_count = 0
        for particle_id in particle_ids:
            particle = Particle.query.filter_by(particle_id=particle_id).first()
            if particle:
                particle.manual_classification = classification
                particle.manual_confidence = confidence
                particle.reviewed_by = reviewed_by
                particle.reviewed_at = datetime.utcnow()
                
                if classification:
                    features = {
                        'area': particle.area,
                        'perimeter': particle.perimeter,
                        'aspect_ratio': particle.aspect_ratio,
                        'circularity': particle.circularity,
                        'solidity': particle.solidity,
                        'extent': particle.extent,
                        'mean_intensity': particle.mean_intensity,
                    }
                    particle.risk_level = MicroplasticClassifier.assess_risk(classification, features)
                
                updated_count += 1
        
        audit_log = AuditLog(
            action='batch_review',
            entity_type='particle',
            details=f'批量复核 {updated_count} 个颗粒，分类设为 {classification}',
            user=reviewed_by
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'updated_count': updated_count,
                'total_requested': len(particle_ids)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
