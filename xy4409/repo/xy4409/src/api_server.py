from datetime import datetime, date
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
from typing import Dict, Any, List

from .config import Config
from .database import init_db, db_session
from .models import (
    Pet, MedicationRecord, Note, CameraImage, AbnormalCall,
    Risk, RiskType, RiskStatus, Confirmation, ProcessedFile, FileStatus
)
from .archiver import Archiver
from .risk_detector import RiskDetector
from .exporter import Exporter


def create_app(config: Config = None) -> Flask:
    if config is None:
        config = Config()
    
    app = Flask(__name__)
    CORS(app)
    
    init_db()
    archiver = Archiver(config)
    risk_detector = RiskDetector(config)
    exporter = Exporter(config)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'ok',
            'timestamp': datetime.now().isoformat(),
            'incoming_dir': str(config.incoming_dir),
            'archive_dir': str(config.archive_dir)
        })

    @app.route('/api/scan', methods=['POST'])
    def scan_incoming():
        results = archiver.scan_incoming_directory()
        
        detection_results = risk_detector.run_all_detections()
        
        total_risks = sum(len(v) for v in detection_results.values())
        
        return jsonify({
            'success': True,
            'files_processed': len(results),
            'files': results,
            'risks_detected': total_risks,
            'risk_details': detection_results,
            'timestamp': datetime.now().isoformat()
        })

    @app.route('/api/risks', methods=['GET'])
    def get_risks():
        status_filter = request.args.get('status')
        risk_type_filter = request.args.get('type')
        pet_id_filter = request.args.get('pet_id')
        
        with db_session() as session:
            query = session.query(Risk)
            
            if status_filter:
                try:
                    status_enum = RiskStatus(status_filter)
                    query = query.filter(Risk.status == status_enum)
                except ValueError:
                    pass
            
            if risk_type_filter:
                try:
                    type_enum = RiskType(risk_type_filter)
                    query = query.filter(Risk.risk_type == type_enum)
                except ValueError:
                    pass
            
            if pet_id_filter:
                try:
                    query = query.filter(Risk.pet_id == int(pet_id_filter))
                except ValueError:
                    pass
            
            risks = query.order_by(Risk.severity.desc(), Risk.detected_at.desc()).all()
            
            result = []
            for risk in risks:
                risk_dict = risk.to_dict()
                pet = session.query(Pet).filter(Pet.id == risk.pet_id).first()
                risk_dict['pet_name'] = pet.name if pet else "Unknown"
                result.append(risk_dict)
            
            return jsonify({
                'success': True,
                'count': len(result),
                'risks': result
            })

    @app.route('/api/risks/<int:risk_id>', methods=['GET'])
    def get_risk(risk_id: int):
        with db_session() as session:
            risk = session.query(Risk).filter(Risk.id == risk_id).first()
            
            if not risk:
                return jsonify({'success': False, 'error': 'Risk not found'}), 404
            
            risk_dict = risk.to_dict()
            pet = session.query(Pet).filter(Pet.id == risk.pet_id).first()
            risk_dict['pet_name'] = pet.name if pet else "Unknown"
            
            return jsonify({
                'success': True,
                'risk': risk_dict
            })

    @app.route('/api/risks/<int:risk_id>/confirm', methods=['POST'])
    def confirm_risk(risk_id: int):
        with db_session() as session:
            risk = risk_detector.confirm_risk(session, risk_id)
            
            if not risk:
                return jsonify({'success': False, 'error': 'Risk not found'}), 404
            
            return jsonify({
                'success': True,
                'risk': risk.to_dict()
            })

    @app.route('/api/risks/<int:risk_id>/resolve', methods=['POST'])
    def resolve_risk(risk_id: int):
        data = request.get_json() or {}
        resolved_by = data.get('resolved_by', 'System')
        notes = data.get('notes')
        
        with db_session() as session:
            risk = risk_detector.resolve_risk(session, risk_id, resolved_by, notes)
            
            if not risk:
                return jsonify({'success': False, 'error': 'Risk not found'}), 404
            
            return jsonify({
                'success': True,
                'risk': risk.to_dict()
            })

    @app.route('/api/risks/<int:risk_id>/dismiss', methods=['POST'])
    def dismiss_risk(risk_id: int):
        data = request.get_json() or {}
        dismissed_by = data.get('dismissed_by', 'System')
        reason = data.get('reason')
        
        with db_session() as session:
            risk = risk_detector.dismiss_risk(session, risk_id, dismissed_by, reason)
            
            if not risk:
                return jsonify({'success': False, 'error': 'Risk not found'}), 404
            
            return jsonify({
                'success': True,
                'risk': risk.to_dict()
            })

    @app.route('/api/pets', methods=['GET'])
    def get_pets():
        with db_session() as session:
            pets = session.query(Pet).filter(Pet.check_out_date.is_(None)).all()
            
            result = []
            for pet in pets:
                pet_dict = pet.to_dict()
                
                med_count = session.query(MedicationRecord).filter(
                    MedicationRecord.pet_id == pet.id
                ).count()
                note_count = session.query(Note).filter(
                    Note.pet_id == pet.id
                ).count()
                risk_count = session.query(Risk).filter(
                    Risk.pet_id == pet.id,
                    Risk.status.in_([RiskStatus.PENDING, RiskStatus.CONFIRMED])
                ).count()
                
                pet_dict['medication_count'] = med_count
                pet_dict['note_count'] = note_count
                pet_dict['pending_risk_count'] = risk_count
                
                result.append(pet_dict)
            
            return jsonify({
                'success': True,
                'count': len(result),
                'pets': result
            })

    @app.route('/api/pets/<int:pet_id>', methods=['GET'])
    def get_pet(pet_id: int):
        with db_session() as session:
            pet = session.query(Pet).filter(Pet.id == pet_id).first()
            
            if not pet:
                return jsonify({'success': False, 'error': 'Pet not found'}), 404
            
            pet_dict = pet.to_dict()
            
            medications = session.query(MedicationRecord).filter(
                MedicationRecord.pet_id == pet.id
            ).order_by(MedicationRecord.scheduled_time.desc()).limit(20).all()
            
            notes = session.query(Note).filter(
                Note.pet_id == pet.id
            ).order_by(Note.created_at.desc()).limit(20).all()
            
            risks = session.query(Risk).filter(
                Risk.pet_id == pet.id
            ).order_by(Risk.detected_at.desc()).limit(20).all()
            
            images = session.query(CameraImage).filter(
                CameraImage.pet_id == pet.id
            ).order_by(CameraImage.capture_time.desc()).limit(10).all()
            
            calls = session.query(AbnormalCall).filter(
                AbnormalCall.pet_id == pet.id
            ).order_by(AbnormalCall.call_time.desc()).limit(10).all()
            
            pet_dict['recent_medications'] = [m.to_dict() for m in medications]
            pet_dict['recent_notes'] = [n.to_dict() for n in notes]
            pet_dict['recent_risks'] = [r.to_dict() for r in risks]
            pet_dict['recent_images'] = [i.to_dict() for i in images]
            pet_dict['recent_calls'] = [c.to_dict() for c in calls]
            
            return jsonify({
                'success': True,
                'pet': pet_dict
            })

    @app.route('/api/confirmations', methods=['POST'])
    def add_confirmation():
        data = request.get_json()
        
        required_fields = ['pet_id', 'confirmation_type', 'confirmed_by']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        with db_session() as session:
            pet = session.query(Pet).filter(Pet.id == data['pet_id']).first()
            
            if not pet:
                return jsonify({'success': False, 'error': 'Pet not found'}), 404
            
            confirmation = Confirmation(
                pet_id=data['pet_id'],
                risk_id=data.get('risk_id'),
                confirmation_type=data['confirmation_type'],
                content=data.get('content'),
                confirmed_by=data['confirmed_by'],
                notes=data.get('notes')
            )
            session.add(confirmation)
            session.flush()
            
            if data.get('note_id'):
                note = session.query(Note).filter(Note.id == data['note_id']).first()
                if note:
                    note.is_confirmed = True
                    note.confirmed_by = data['confirmed_by']
                    note.confirmed_at = datetime.now()
            
            return jsonify({
                'success': True,
                'confirmation': confirmation.to_dict()
            })

    @app.route('/api/confirmations', methods=['GET'])
    def get_confirmations():
        pet_id_filter = request.args.get('pet_id')
        risk_id_filter = request.args.get('risk_id')
        limit = request.args.get('limit', 50)
        
        try:
            limit = int(limit)
        except ValueError:
            limit = 50
        
        with db_session() as session:
            query = session.query(Confirmation)
            
            if pet_id_filter:
                try:
                    query = query.filter(Confirmation.pet_id == int(pet_id_filter))
                except ValueError:
                    pass
            
            if risk_id_filter:
                try:
                    query = query.filter(Confirmation.risk_id == int(risk_id_filter))
                except ValueError:
                    pass
            
            confirmations = query.order_by(Confirmation.confirmed_at.desc()).limit(limit).all()
            
            result = []
            for conf in confirmations:
                conf_dict = conf.to_dict()
                pet = session.query(Pet).filter(Pet.id == conf.pet_id).first()
                conf_dict['pet_name'] = pet.name if pet else "Unknown"
                result.append(conf_dict)
            
            return jsonify({
                'success': True,
                'count': len(result),
                'confirmations': result
            })

    @app.route('/api/export/markdown', methods=['GET'])
    def export_markdown():
        date_str = request.args.get('date')
        
        target_date = date.today()
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        try:
            file_path = exporter.export_markdown_handover(target_date)
            
            return jsonify({
                'success': True,
                'date': target_date.strftime('%Y-%m-%d'),
                'file_path': str(file_path),
                'file_name': file_path.name
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/export/json', methods=['GET'])
    def export_json():
        date_str = request.args.get('date')
        
        target_date = date.today()
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        try:
            file_path = exporter.export_json_audit(target_date)
            
            return jsonify({
                'success': True,
                'date': target_date.strftime('%Y-%m-%d'),
                'file_path': str(file_path),
                'file_name': file_path.name
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/export/all', methods=['GET'])
    def export_all():
        date_str = request.args.get('date')
        
        target_date = date.today()
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        try:
            results = exporter.export_all(target_date)
            
            return jsonify({
                'success': True,
                'date': target_date.strftime('%Y-%m-%d'),
                'exports': {
                    'markdown_handover': {
                        'file_path': str(results['markdown_handover']),
                        'file_name': results['markdown_handover'].name
                    },
                    'json_audit': {
                        'file_path': str(results['json_audit']),
                        'file_name': results['json_audit'].name
                    }
                }
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/stats', methods=['GET'])
    def get_stats():
        with db_session() as session:
            total_pets = session.query(Pet).filter(Pet.check_out_date.is_(None)).count()
            
            pending_risks = session.query(Risk).filter(
                Risk.status.in_([RiskStatus.PENDING, RiskStatus.CONFIRMED])
            ).count()
            
            high_severity_risks = session.query(Risk).filter(
                Risk.status.in_([RiskStatus.PENDING, RiskStatus.CONFIRMED]),
                Risk.severity >= 2
            ).count()
            
            unconfirmed_notes = session.query(Note).filter(
                Note.is_confirmed == False
            ).count()
            
            today = date.today()
            start_time = datetime.combine(today, datetime.min.time())
            
            today_files = session.query(ProcessedFile).filter(
                ProcessedFile.created_at >= start_time
            ).count()
            
            today_risks = session.query(Risk).filter(
                Risk.detected_at >= start_time
            ).count()
            
            today_confirmations = session.query(Confirmation).filter(
                Confirmation.confirmed_at >= start_time
            ).count()
            
            return jsonify({
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'current': {
                    'total_pets': total_pets,
                    'pending_risks': pending_risks,
                    'high_severity_risks': high_severity_risks,
                    'unconfirmed_notes': unconfirmed_notes
                },
                'today': {
                    'files_processed': today_files,
                    'risks_detected': today_risks,
                    'confirmations_made': today_confirmations
                }
            })

    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.error(f"Unhandled exception: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }), 500

    return app
