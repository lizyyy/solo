from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

from config import Config
from models import db, Batch, RawMaterial, QualityCheckRecord, ProcessLog, WriteBackTask
from services import (
    generate_material_hash, find_duplicate, validate_raw_content,
    parse_raw_content, check_duplicate_appeal_number
)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    CORS(app)

    with app.app_context():
        db.create_all()

    register_routes(app)
    return app


def register_routes(app):

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})

    @app.route('/api/batches', methods=['POST'])
    def create_batch():
        data = request.get_json(force=True)
        batch_number = data.get('batch_number', '').strip()
        name = data.get('name', '').strip()
        source_system = data.get('source_system', '').strip()
        created_by = data.get('created_by', '').strip()

        if not batch_number or not name:
            return jsonify({'error': 'batch_number 和 name 为必填字段'}), 400
        if not created_by:
            return jsonify({'error': 'created_by 为必填字段'}), 400

        existing = Batch.query.filter_by(batch_number=batch_number).first()
        if existing:
            return jsonify({'error': f'批次号 {batch_number} 已存在', 'batch_id': existing.id}), 409

        batch = Batch(
            batch_number=batch_number,
            name=name,
            source_system=source_system or None,
            created_by=created_by,
            status='pending'
        )
        db.session.add(batch)
        db.session.commit()

        return jsonify(batch.to_dict()), 201

    @app.route('/api/batches', methods=['GET'])
    def list_batches():
        status = request.args.get('status')
        query = Batch.query
        if status:
            query = query.filter_by(status=status)
        batches = query.order_by(Batch.created_at.desc()).all()
        return jsonify([b.to_dict() for b in batches])

    @app.route('/api/batches/<int:batch_id>', methods=['GET'])
    def get_batch(batch_id):
        batch = Batch.query.get_or_404(batch_id)
        return jsonify(batch.to_dict())

    @app.route('/api/batches/<int:batch_id>/materials', methods=['POST'])
    def upload_materials(batch_id):
        batch = Batch.query.get_or_404(batch_id)
        data = request.get_json(force=True)
        materials = data.get('materials', [])
        source_system = data.get('source_system', batch.source_system)
        operator = data.get('operator', batch.created_by)

        if not materials or not isinstance(materials, list):
            return jsonify({'error': 'materials 必须是非空数组'}), 400

        results = {
            'processed': [],
            'duplicates': [],
            'errors': [],
        }

        total = len(materials)
        valid_count = 0
        error_count = 0
        duplicate_count = 0

        for idx, raw_content in enumerate(materials):
            line_number = idx + 1
            validation_errors = validate_raw_content(raw_content, line_number)

            if validation_errors:
                error_count += 1
                material_hash = generate_material_hash(raw_content)
                error_raw = RawMaterial(
                    batch_id=batch_id,
                    material_hash=material_hash,
                    line_number=line_number,
                    source_system=source_system,
                    raw_content=raw_content,
                    is_duplicate=False,
                    has_errors=True,
                    validation_errors=validation_errors,
                )
                db.session.add(error_raw)
                results['errors'].append({
                    'line_number': line_number,
                    'raw_content': raw_content,
                    'errors': validation_errors,
                })
                continue

            material_hash = generate_material_hash(raw_content)

            existing_raw = find_duplicate(material_hash)

            if existing_raw:
                duplicate_count += 1
                dup_raw = RawMaterial(
                    batch_id=batch_id,
                    material_hash=material_hash,
                    line_number=line_number,
                    source_system=source_system,
                    raw_content=raw_content,
                    is_duplicate=True,
                    original_raw_material_id=existing_raw.id,
                    has_errors=False,
                    validation_errors=None,
                )
                db.session.add(dup_raw)

                existing_record = QualityCheckRecord.query.filter_by(
                    raw_material_id=existing_raw.id
                ).first()

                results['duplicates'].append({
                    'line_number': line_number,
                    'appeal_number': raw_content.get('appeal_number'),
                    'original_raw_material_id': existing_raw.id,
                    'original_batch_id': existing_raw.batch_id,
                    'existing_record': existing_record.to_dict() if existing_record else None,
                    'message': '材料已处理过，返回原有结果',
                })
                continue

            appeal_number = str(raw_content.get('appeal_number', ''))
            dup_appeal = check_duplicate_appeal_number(appeal_number)
            if dup_appeal:
                error_count += 1
                dup_error_raw = RawMaterial(
                    batch_id=batch_id,
                    material_hash=material_hash,
                    line_number=line_number,
                    source_system=source_system,
                    raw_content=raw_content,
                    is_duplicate=False,
                    has_errors=True,
                    validation_errors=[{
                        'type': 'duplicate_appeal_number',
                        'line_number': line_number,
                        'field': 'appeal_number',
                        'value': appeal_number,
                        'message': f'申诉编号 {appeal_number} 已存在于记录 ID: {dup_appeal.id}',
                    }],
                )
                db.session.add(dup_error_raw)
                results['errors'].append({
                    'line_number': line_number,
                    'raw_content': raw_content,
                    'errors': [{
                        'type': 'duplicate_appeal_number',
                        'line_number': line_number,
                        'field': 'appeal_number',
                        'value': appeal_number,
                        'message': f'申诉编号 {appeal_number} 已存在于记录 ID: {dup_appeal.id}',
                    }],
                })
                continue

            raw_mat = RawMaterial(
                batch_id=batch_id,
                material_hash=material_hash,
                line_number=line_number,
                source_system=source_system,
                raw_content=raw_content,
                is_duplicate=False,
                has_errors=False,
                validation_errors=None,
            )
            db.session.add(raw_mat)
            db.session.flush()

            parsed = parse_raw_content(raw_content)
            record = QualityCheckRecord(
                raw_material_id=raw_mat.id,
                **parsed,
                status='valid',
            )
            db.session.add(record)
            db.session.flush()

            valid_count += 1
            results['processed'].append({
                'line_number': line_number,
                'raw_material_id': raw_mat.id,
                'record_id': record.id,
                'appeal_number': appeal_number,
            })

        batch.total_count += total
        batch.valid_count += valid_count
        batch.error_count += error_count
        batch.duplicate_count += duplicate_count
        batch.status = 'completed'
        batch.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            'batch_id': batch_id,
            'total': total,
            'valid_count': valid_count,
            'error_count': error_count,
            'duplicate_count': duplicate_count,
            'results': results,
        }), 200

    @app.route('/api/batches/<int:batch_id>/materials', methods=['GET'])
    def list_materials(batch_id):
        batch = Batch.query.get_or_404(batch_id)
        include_duplicates = request.args.get('include_duplicates', 'true').lower() == 'true'
        include_errors = request.args.get('include_errors', 'true').lower() == 'true'
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))

        query = RawMaterial.query.filter_by(batch_id=batch_id)
        if not include_duplicates:
            query = query.filter_by(is_duplicate=False)
        query = query.order_by(RawMaterial.line_number)

        materials = query.offset((page - 1) * per_page).limit(per_page).all()
        return jsonify({
            'batch_id': batch_id,
            'page': page,
            'per_page': per_page,
            'total': query.count(),
            'items': [m.to_dict() for m in materials],
        })

    @app.route('/api/batches/<int:batch_id>/records', methods=['GET'])
    def list_records(batch_id):
        batch = Batch.query.get_or_404(batch_id)
        status = request.args.get('status')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))

        raw_ids = [m.id for m in RawMaterial.query.filter_by(
            batch_id=batch_id, is_duplicate=False
        ).all()]

        query = QualityCheckRecord.query.filter(
            QualityCheckRecord.raw_material_id.in_(raw_ids)
        ) if raw_ids else QualityCheckRecord.query.filter(False)

        if status:
            query = query.filter_by(status=status)
        query = query.order_by(QualityCheckRecord.created_at.desc())

        records = query.offset((page - 1) * per_page).limit(per_page).all()
        return jsonify({
            'batch_id': batch_id,
            'page': page,
            'per_page': per_page,
            'total': query.count(),
            'items': [r.to_dict() for r in records],
        })

    @app.route('/api/batches/<int:batch_id>/writeback', methods=['POST'])
    def trigger_writeback(batch_id):
        batch = Batch.query.get_or_404(batch_id)
        data = request.get_json(force=True)
        target_system = data.get('target_system', '').strip()
        triggered_by = data.get('triggered_by', '').strip()

        if not target_system:
            return jsonify({'error': 'target_system 为必填字段'}), 400
        if not triggered_by:
            return jsonify({'error': 'triggered_by 为必填字段'}), 400

        raw_materials = RawMaterial.query.filter_by(
            batch_id=batch_id, is_duplicate=False
        ).all()

        valid_records = QualityCheckRecord.query.filter(
            QualityCheckRecord.raw_material_id.in_([m.id for m in raw_materials])
        ).filter(
            QualityCheckRecord.status.in_(['valid', 'appealed', 'upheld', 'reversed'])
        ).all()

        if not valid_records:
            return jsonify({'error': '没有可回写的有效记录'}), 400

        task = WriteBackTask(
            batch_id=batch_id,
            target_system=target_system,
            status='running',
            total_count=len(valid_records),
            success_count=0,
            failed_count=0,
            triggered_by=triggered_by,
            started_at=datetime.utcnow(),
        )
        db.session.add(task)
        db.session.commit()

        success_count = 0
        failed_count = 0
        error_details = []

        for record in valid_records:
            try:
                success_count += 1
                process_log = ProcessLog(
                    record_id=record.id,
                    action_type='writeback',
                    field_name=None,
                    old_value=record.to_dict(),
                    new_value={'writeback_system': target_system, 'writeback_time': datetime.utcnow().isoformat()},
                    operator=triggered_by,
                    reason=f'回写到系统: {target_system}',
                )
                db.session.add(process_log)
            except Exception as e:
                failed_count += 1
                error_details.append({
                    'record_id': record.id,
                    'appeal_number': record.appeal_number,
                    'error': str(e),
                })

        task.status = 'success' if failed_count == 0 else 'failed'
        task.success_count = success_count
        task.failed_count = failed_count
        task.error_details = error_details if error_details else None
        task.completed_at = datetime.utcnow()
        batch.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify(task.to_dict()), 200

    @app.route('/api/batches/<int:batch_id>/writeback-tasks', methods=['GET'])
    def list_writeback_tasks(batch_id):
        batch = Batch.query.get_or_404(batch_id)
        tasks = WriteBackTask.query.filter_by(batch_id=batch_id).order_by(
            WriteBackTask.created_at.desc()
        ).all()
        return jsonify([t.to_dict() for t in tasks])

    @app.route('/api/records/<int:record_id>', methods=['GET'])
    def get_record(record_id):
        record = QualityCheckRecord.query.get_or_404(record_id)
        result = record.to_dict()
        result['raw_material'] = record.raw_material.to_dict() if record.raw_material else None
        return jsonify(result)

    @app.route('/api/records/<int:record_id>', methods=['PATCH'])
    def update_record(record_id):
        record = QualityCheckRecord.query.get_or_404(record_id)
        data = request.get_json(force=True)
        operator = data.get('operator', '').strip()
        reason = data.get('reason', '').strip()

        if not operator:
            return jsonify({'error': 'operator 为必填字段'}), 400
        if not reason:
            return jsonify({'error': 'reason 为必填字段（必须说明修改原因）'}), 400

        updatable_fields = [
            'current_score', 'current_conclusion',
            'final_score', 'final_conclusion',
            'appeal_type', 'appeal_reason',
            'agent_name', 'team_name', 'call_duration',
        ]

        old_values = {}
        new_values = {}

        for field in updatable_fields:
            if field in data:
                old_val = getattr(record, field)
                new_val = data[field]
                if old_val != new_val:
                    old_values[field] = old_val
                    new_values[field] = new_val
                    setattr(record, field, new_val)

        if not old_values:
            return jsonify({'error': '没有检测到字段变更'}), 400

        record.status = 'appealed'
        record.updated_at = datetime.utcnow()

        log = ProcessLog(
            record_id=record.id,
            action_type='update',
            field_name=None,
            old_value=old_values,
            new_value=new_values,
            operator=operator,
            reason=reason,
        )
        db.session.add(log)
        db.session.commit()

        return jsonify({
            'record': record.to_dict(),
            'change_log': log.to_dict(),
            'changed_fields': list(old_values.keys()),
        }), 200

    @app.route('/api/records/<int:record_id>/finalize', methods=['POST'])
    def finalize_record(record_id):
        record = QualityCheckRecord.query.get_or_404(record_id)
        data = request.get_json(force=True)
        operator = data.get('operator', '').strip()
        reason = data.get('reason', '').strip()
        final_score = data.get('final_score')
        final_conclusion = data.get('final_conclusion', '').strip()

        if not operator:
            return jsonify({'error': 'operator 为必填字段'}), 400
        if not reason:
            return jsonify({'error': 'reason 为必填字段'}), 400

        old_values = {
            'final_score': record.final_score,
            'final_conclusion': record.final_conclusion,
            'status': record.status,
        }

        record.final_score = final_score
        record.final_conclusion = final_conclusion
        record.status = 'upheld' if final_conclusion == record.original_conclusion else 'reversed'
        record.updated_at = datetime.utcnow()

        new_values = {
            'final_score': final_score,
            'final_conclusion': final_conclusion,
            'status': record.status,
        }

        log = ProcessLog(
            record_id=record.id,
            action_type='finalize',
            field_name=None,
            old_value=old_values,
            new_value=new_values,
            operator=operator,
            reason=reason,
        )
        db.session.add(log)
        db.session.commit()

        return jsonify({
            'record': record.to_dict(),
            'change_log': log.to_dict(),
        }), 200

    @app.route('/api/records/<int:record_id>/trace', methods=['GET'])
    def get_record_trace(record_id):
        record = QualityCheckRecord.query.get_or_404(record_id)

        raw_material = record.raw_material
        process_logs = ProcessLog.query.filter_by(
            record_id=record.id
        ).order_by(ProcessLog.created_at.asc()).all()

        writeback_logs = [
            pl for pl in process_logs if pl.action_type == 'writeback'
        ]

        field_trace = []
        field_mapping = {
            'agent_id': 'agent_id',
            'agent_name': 'agent_name',
            'team_name': 'team_name',
            'call_time': 'call_time',
            'call_duration': 'call_duration',
            'appeal_type': 'appeal_type',
            'appeal_reason': 'appeal_reason',
            'original_score': 'original_score',
            'original_conclusion': 'original_conclusion',
            'current_score': 'current_score',
            'current_conclusion': 'current_conclusion',
            'final_score': 'final_score',
            'final_conclusion': 'final_conclusion',
        }

        raw_content = raw_material.raw_content if raw_material else {}

        for display_name, field_key in field_mapping.items():
            trace_entry = {
                'field': display_name,
                'source_value': raw_content.get(field_key, raw_content.get(display_name)),
                'current_value': getattr(record, field_key, None),
                'history': [],
            }

            for log_entry in process_logs:
                if log_entry.old_value and field_key in (log_entry.old_value or {}):
                    trace_entry['history'].append({
                        'changed_at': log_entry.created_at.isoformat(),
                        'old_value': log_entry.old_value.get(field_key),
                        'new_value': (log_entry.new_value or {}).get(field_key),
                        'operator': log_entry.operator,
                        'reason': log_entry.reason,
                        'action': log_entry.action_type,
                    })

            field_trace.append(trace_entry)

        return jsonify({
            'record_id': record.id,
            'appeal_number': record.appeal_number,
            'raw_material': {
                'id': raw_material.id,
                'batch_id': raw_material.batch_id,
                'line_number': raw_material.line_number,
                'source_system': raw_material.source_system,
                'raw_content': raw_material.raw_content,
                'created_at': raw_material.created_at.isoformat(),
            },
            'field_trace': field_trace,
            'process_logs': [pl.to_dict() for pl in process_logs],
            'writeback_history': [wl.to_dict() for wl in writeback_logs],
        })

    @app.route('/api/records/<int:record_id>/history', methods=['GET'])
    def get_record_history(record_id):
        record = QualityCheckRecord.query.get_or_404(record_id)
        logs = ProcessLog.query.filter_by(
            record_id=record.id
        ).order_by(ProcessLog.created_at.asc()).all()
        return jsonify([l.to_dict() for l in logs])

    @app.route('/api/batches/<int:batch_id>/error-details', methods=['GET'])
    def get_batch_errors(batch_id):
        batch = Batch.query.get_or_404(batch_id)
        error_materials = RawMaterial.query.filter(
            RawMaterial.batch_id == batch_id,
            RawMaterial.has_errors == True,
        ).order_by(RawMaterial.line_number).all()

        return jsonify({
            'batch_id': batch_id,
            'total_errors': len(error_materials),
            'items': [
                {
                    'line_number': m.line_number,
                    'raw_content': m.raw_content,
                    'errors': m.validation_errors,
                }
                for m in error_materials
            ],
        })

    @app.route('/api/batches/<int:batch_id>/duplicate-details', methods=['GET'])
    def get_batch_duplicates(batch_id):
        batch = Batch.query.get_or_404(batch_id)
        dup_materials = RawMaterial.query.filter_by(
            batch_id=batch_id, is_duplicate=True
        ).order_by(RawMaterial.line_number).all()

        results = []
        for m in dup_materials:
            existing_record = QualityCheckRecord.query.filter_by(
                raw_material_id=m.original_raw_material_id
            ).first()
            results.append({
                'line_number': m.line_number,
                'appeal_number': m.raw_content.get('appeal_number'),
                'original_raw_material_id': m.original_raw_material_id,
                'existing_record': existing_record.to_dict() if existing_record else None,
            })

        return jsonify({
            'batch_id': batch_id,
            'total_duplicates': len(results),
            'items': results,
        })
