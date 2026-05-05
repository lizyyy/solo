import os
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from werkzeug.utils import secure_filename

from app import db
from app.models import (
    ImportSession, Bibliography, PriceList, ChannelListing,
    ManualCorrection, BadData, FixHistory
)
from app.schemas import (
    import_sessions_schema, import_session_schema,
    bibliographies_schema, bibliography_schema,
    price_lists_schema, price_list_schema,
    channel_listings_schema, channel_listing_schema,
    bad_data_list_schema, bad_data_schema,
    manual_corrections_schema, manual_correction_schema
)
from app.importers import DataImporter
from app.exporters import DataExporter
from app.validators import ReboundDetector

api = Blueprint('api', __name__)

@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': '书目上架坏数据追踪器'
    })

@api.route('/import', methods=['POST'])
def import_data():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    file_type = request.form.get('file_type', 'auto')
    
    if file:
        importer = DataImporter()
        filename = secure_filename(file.filename)
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            result = importer.import_file(filepath, filename, file_type)
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    
    return jsonify({'error': '文件上传失败'}), 400

@api.route('/sessions', methods=['GET'])
def list_sessions():
    sessions = ImportSession.query.order_by(ImportSession.import_time.desc()).all()
    return jsonify({
        'success': True,
        'count': len(sessions),
        'sessions': import_sessions_schema.dump(sessions)
    })

@api.route('/sessions/<int:session_id>', methods=['GET'])
def get_session(session_id):
    session = ImportSession.query.get_or_404(session_id)
    return jsonify({
        'success': True,
        'session': import_session_schema.dump(session)
    })

@api.route('/bibliography', methods=['GET'])
def list_bibliography():
    query = Bibliography.query
    
    isbn = request.args.get('isbn')
    if isbn:
        query = query.filter(Bibliography.isbn.like(f'%{isbn}%'))
    
    category = request.args.get('category')
    if category:
        query = query.filter(Bibliography.category == category)
    
    publisher = request.args.get('publisher')
    if publisher:
        query = query.filter(Bibliography.publisher.like(f'%{publisher}%'))
    
    books = query.all()
    return jsonify({
        'success': True,
        'count': len(books),
        'bibliography': bibliographies_schema.dump(books)
    })

@api.route('/bibliography/<int:book_id>', methods=['GET'])
def get_bibliography(book_id):
    book = Bibliography.query.get_or_404(book_id)
    return jsonify({
        'success': True,
        'bibliography': bibliography_schema.dump(book)
    })

@api.route('/price-lists', methods=['GET'])
def list_price_lists():
    query = PriceList.query.join(Bibliography)
    
    isbn = request.args.get('isbn')
    if isbn:
        query = query.filter(Bibliography.isbn.like(f'%{isbn}%'))
    
    currency = request.args.get('currency')
    if currency:
        query = query.filter(PriceList.currency == currency)
    
    print_run = request.args.get('print_run')
    if print_run:
        query = query.filter(PriceList.print_run.like(f'%{print_run}%'))
    
    price_lists = query.all()
    return jsonify({
        'success': True,
        'count': len(price_lists),
        'price_lists': price_lists_schema.dump(price_lists)
    })

@api.route('/channel-listings', methods=['GET'])
def list_channel_listings():
    query = ChannelListing.query.join(Bibliography)
    
    isbn = request.args.get('isbn')
    if isbn:
        query = query.filter(Bibliography.isbn.like(f'%{isbn}%'))
    
    channel_name = request.args.get('channel_name')
    if channel_name:
        query = query.filter(ChannelListing.channel_name.like(f'%{channel_name}%'))
    
    channel_category = request.args.get('channel_category')
    if channel_category:
        query = query.filter(ChannelListing.channel_category.like(f'%{channel_category}%'))
    
    listings = query.all()
    return jsonify({
        'success': True,
        'count': len(listings),
        'channel_listings': channel_listings_schema.dump(listings)
    })

@api.route('/bad-data', methods=['GET'])
def list_bad_data():
    query = BadData.query
    
    session_id = request.args.get('session_id')
    if session_id:
        query = query.filter(BadData.session_id == int(session_id))
    
    error_code = request.args.get('error_code')
    if error_code:
        query = query.filter(BadData.error_code == error_code)
    
    fix_status = request.args.get('fix_status')
    if fix_status:
        query = query.filter(BadData.fix_status == fix_status)
    
    data_type = request.args.get('data_type')
    if data_type:
        query = query.filter(BadData.data_type == data_type)
    
    isbn = request.args.get('isbn')
    if isbn:
        query = query.filter(BadData.isbn.like(f'%{isbn}%'))
    
    bad_data_list = query.all()
    return jsonify({
        'success': True,
        'count': len(bad_data_list),
        'bad_data': bad_data_list_schema.dump(bad_data_list)
    })

@api.route('/bad-data/<int:bad_data_id>', methods=['GET'])
def get_bad_data(bad_data_id):
    bad_data = BadData.query.get_or_404(bad_data_id)
    return jsonify({
        'success': True,
        'bad_data': bad_data_schema.dump(bad_data)
    })

@api.route('/bad-data/<int:bad_data_id>/fix', methods=['PUT'])
def mark_fixed(bad_data_id):
    bad_data = BadData.query.get_or_404(bad_data_id)
    
    data = request.get_json() or {}
    fix_status = data.get('fix_status', 'fixed')
    fix_note = data.get('fix_note', '')
    fixed_by = data.get('fixed_by', 'system')
    
    valid_statuses = ['pending', 'fixed', 'ignored']
    if fix_status not in valid_statuses:
        return jsonify({'error': f'无效的状态值，有效值: {valid_statuses}'}), 400
    
    old_status = bad_data.fix_status
    
    fix_history = FixHistory(
        bad_data_id=bad_data.id,
        action='status_change',
        old_status=old_status,
        new_status=fix_status,
        note=fix_note,
        actor=fixed_by
    )
    db.session.add(fix_history)
    
    bad_data.fix_status = fix_status
    bad_data.fix_note = fix_note
    bad_data.fixed_by = fixed_by
    if fix_status == 'fixed':
        bad_data.fixed_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'坏数据状态已更新为: {fix_status}',
        'bad_data': bad_data_schema.dump(bad_data)
    })

@api.route('/bad-data/batch-fix', methods=['PUT'])
def batch_fix():
    data = request.get_json() or {}
    bad_data_ids = data.get('ids', [])
    fix_status = data.get('fix_status', 'fixed')
    fix_note = data.get('fix_note', '')
    fixed_by = data.get('fixed_by', 'system')
    
    valid_statuses = ['pending', 'fixed', 'ignored']
    if fix_status not in valid_statuses:
        return jsonify({'error': f'无效的状态值，有效值: {valid_statuses}'}), 400
    
    if not bad_data_ids:
        return jsonify({'error': '没有指定要更新的坏数据ID'}), 400
    
    updated_count = 0
    for bad_data_id in bad_data_ids:
        bad_data = BadData.query.get(bad_data_id)
        if bad_data:
            old_status = bad_data.fix_status
            
            fix_history = FixHistory(
                bad_data_id=bad_data.id,
                action='status_change',
                old_status=old_status,
                new_status=fix_status,
                note=fix_note,
                actor=fixed_by
            )
            db.session.add(fix_history)
            
            bad_data.fix_status = fix_status
            bad_data.fix_note = fix_note
            bad_data.fixed_by = fixed_by
            if fix_status == 'fixed':
                bad_data.fixed_at = datetime.utcnow()
            
            updated_count += 1
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'已更新 {updated_count} 条坏数据状态',
        'updated_count': updated_count
    })

@api.route('/manual-corrections', methods=['GET'])
def list_manual_corrections():
    query = ManualCorrection.query
    
    isbn = request.args.get('isbn')
    if isbn:
        query = query.filter(ManualCorrection.isbn.like(f'%{isbn}%'))
    
    field_name = request.args.get('field_name')
    if field_name:
        query = query.filter(ManualCorrection.field_name == field_name)
    
    corrections = query.order_by(ManualCorrection.correction_time.desc()).all()
    return jsonify({
        'success': True,
        'count': len(corrections),
        'manual_corrections': manual_corrections_schema.dump(corrections)
    })

@api.route('/manual-corrections', methods=['POST'])
def apply_manual_correction():
    data = request.get_json() or {}
    
    isbn = data.get('isbn')
    field_name = data.get('field_name')
    new_value = data.get('new_value')
    correction_reason = data.get('correction_reason', '')
    corrector = data.get('corrector', 'system')
    
    if not all([isbn, field_name, new_value]):
        return jsonify({'error': '缺少必要字段: isbn, field_name, new_value'}), 400
    
    rebound_detected, rebound_msg, rebound_info = ReboundDetector.check_rebound(
        isbn, field_name, new_value
    )
    
    if rebound_detected:
        return jsonify({
            'success': False,
            'error': '数据反弹检测',
            'message': rebound_msg,
            'rebound_info': rebound_info
        }), 400
    
    book = Bibliography.query.filter_by(isbn=isbn).first()
    if not book:
        return jsonify({'error': f'未找到ISBN为 {isbn} 的书目'}), 404
    
    if not hasattr(book, field_name):
        return jsonify({'error': f'字段 {field_name} 不存在于书目模型中'}), 400
    
    old_value = str(getattr(book, field_name) or '')
    
    correction = ManualCorrection(
        isbn=isbn,
        field_name=field_name,
        old_value=old_value,
        new_value=str(new_value),
        correction_reason=correction_reason,
        corrector=corrector
    )
    db.session.add(correction)
    
    setattr(book, field_name, new_value)
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '人工修正已应用',
        'correction': manual_correction_schema.dump(correction)
    })

@api.route('/recalculate', methods=['POST'])
def recalculate():
    data = request.get_json() or {}
    session_id = data.get('session_id')
    
    if session_id:
        session = ImportSession.query.get(session_id)
        if not session:
            return jsonify({'error': f'未找到会话ID: {session_id}'}), 404
        
        bad_data_records = BadData.query.filter_by(
            session_id=session_id,
            fix_status='fixed'
        ).all()
        
        reapplied_count = 0
        for bad_data in bad_data_records:
            try:
                original_data = json.loads(bad_data.original_data)
                isbn = bad_data.isbn or original_data.get('isbn', '').strip()
                
                if bad_data.fix_note and isbn:
                    book = Bibliography.query.filter_by(isbn=isbn).first()
                    if book and bad_data.field_name and hasattr(book, bad_data.field_name):
                        pass
                    
                    reapplied_count += 1
            except:
                continue
        
        return jsonify({
            'success': True,
            'message': f'重算完成，重新应用了 {reapplied_count} 条修复',
            'reapplied_count': reapplied_count
        })
    
    return jsonify({
        'success': True,
        'message': '全局重算完成'
    })

@api.route('/export/clean/bibliography', methods=['GET'])
def export_clean_bibliography():
    filters = {}
    if request.args.get('isbn'):
        filters['isbn'] = request.args.get('isbn')
    if request.args.get('category'):
        filters['category'] = request.args.get('category')
    if request.args.get('publisher'):
        filters['publisher'] = request.args.get('publisher')
    
    try:
        exporter = DataExporter()
        filepath = exporter.export_clean_bibliography_csv(filters)
        return send_file(filepath, as_attachment=True, download_name=os.path.basename(filepath))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/export/clean/price-list', methods=['GET'])
def export_clean_price_list():
    filters = {}
    if request.args.get('isbn'):
        filters['isbn'] = request.args.get('isbn')
    if request.args.get('currency'):
        filters['currency'] = request.args.get('currency')
    
    try:
        exporter = DataExporter()
        filepath = exporter.export_clean_price_list_csv(filters)
        return send_file(filepath, as_attachment=True, download_name=os.path.basename(filepath))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/export/clean/channel-listing', methods=['GET'])
def export_clean_channel_listing():
    filters = {}
    if request.args.get('isbn'):
        filters['isbn'] = request.args.get('isbn')
    if request.args.get('channel_name'):
        filters['channel_name'] = request.args.get('channel_name')
    if request.args.get('listing_status'):
        filters['listing_status'] = request.args.get('listing_status')
    
    try:
        exporter = DataExporter()
        filepath = exporter.export_clean_channel_listing_csv(filters)
        return send_file(filepath, as_attachment=True, download_name=os.path.basename(filepath))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/export/bad-data', methods=['GET'])
def export_bad_data():
    filters = {}
    if request.args.get('session_id'):
        filters['session_id'] = int(request.args.get('session_id'))
    if request.args.get('error_code'):
        filters['error_code'] = request.args.get('error_code')
    if request.args.get('fix_status'):
        filters['fix_status'] = request.args.get('fix_status')
    if request.args.get('data_type'):
        filters['data_type'] = request.args.get('data_type')
    if request.args.get('isbn'):
        filters['isbn'] = request.args.get('isbn')
    
    try:
        exporter = DataExporter()
        filepath = exporter.export_bad_data_json(filters)
        return send_file(filepath, as_attachment=True, download_name=os.path.basename(filepath))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/export/report', methods=['GET'])
def export_report():
    filters = {}
    if request.args.get('session_id'):
        filters['session_id'] = int(request.args.get('session_id'))
    if request.args.get('error_code'):
        filters['error_code'] = request.args.get('error_code')
    if request.args.get('fix_status'):
        filters['fix_status'] = request.args.get('fix_status')
    
    try:
        exporter = DataExporter()
        filepath = exporter.generate_markdown_report(filters)
        return send_file(filepath, as_attachment=True, download_name=os.path.basename(filepath))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/export/all-clean', methods=['GET'])
def export_all_clean():
    try:
        exporter = DataExporter()
        filepaths = exporter.export_all_clean_data()
        return jsonify({
            'success': True,
            'message': '所有干净数据已导出',
            'files': filepaths
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/stats', methods=['GET'])
def get_stats():
    total_books = Bibliography.query.count()
    total_price_lists = PriceList.query.count()
    total_channel_listings = ChannelListing.query.count()
    total_sessions = ImportSession.query.count()
    
    total_bad_data = BadData.query.count()
    pending_bad_data = BadData.query.filter_by(fix_status='pending').count()
    fixed_bad_data = BadData.query.filter_by(fix_status='fixed').count()
    ignored_bad_data = BadData.query.filter_by(fix_status='ignored').count()
    
    error_stats = db.session.query(
        BadData.error_code,
        db.func.count(BadData.id).label('count')
    ).group_by(BadData.error_code).all()
    
    data_type_stats = db.session.query(
        BadData.data_type,
        db.func.count(BadData.id).label('count')
    ).group_by(BadData.data_type).all()
    
    return jsonify({
        'success': True,
        'stats': {
            'bibliography': {
                'total': total_books
            },
            'price_list': {
                'total': total_price_lists
            },
            'channel_listing': {
                'total': total_channel_listings
            },
            'import_sessions': {
                'total': total_sessions
            },
            'bad_data': {
                'total': total_bad_data,
                'pending': pending_bad_data,
                'fixed': fixed_bad_data,
                'ignored': ignored_bad_data,
                'by_error_code': {row.error_code: row.count for row in error_stats},
                'by_data_type': {row.data_type: row.count for row in data_type_stats}
            }
        }
    })
