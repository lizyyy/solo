from flask import Blueprint, request, jsonify, make_response
import io
import json
from openpyxl import Workbook
from datetime import datetime
from app import db
from app.models import (
    Batch, MarginCall, STATUS_CONFIRMED, STATUS_EXCEPTION, STATUS_CLOSED
)
from app.services import (
    create_batch, import_batch_records, import_single_record,
    update_record_status, add_note_to_record, generate_export_report,
    get_record_versions, get_operation_logs
)

api_bp = Blueprint('api', __name__)


@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'service': '外汇保证金穿仓复盘系统'
    })


@api_bp.route('/batches', methods=['GET'])
def list_batches():
    batches = Batch.query.order_by(Batch.created_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [b.to_dict() for b in batches]
    })


@api_bp.route('/batches/<int:batch_id>', methods=['GET'])
def get_batch(batch_id):
    batch = Batch.query.get(batch_id)
    if not batch:
        return jsonify({'success': False, 'error': '批次不存在'}), 404
    include_records = request.args.get('include_records', 'false').lower() == 'true'
    return jsonify({
        'success': True,
        'data': batch.to_dict(include_records=include_records)
    })


@api_bp.route('/batches', methods=['POST'])
def create_batch_api():
    data = request.get_json() or {}
    required = ['batch_no', 'name']
    for f in required:
        if not data.get(f):
            return jsonify({'success': False, 'error': f'缺少必填字段: {f}'}), 400

    existing = Batch.query.filter_by(batch_no=data['batch_no']).first()
    if existing:
        return jsonify({'success': False, 'error': f'批次号已存在: {data["batch_no"]}'}), 400

    try:
        batch = create_batch(
            batch_no=data['batch_no'],
            name=data['name'],
            description=data.get('description'),
            created_by=data.get('operator', 'SYSTEM')
        )
        db.session.commit()
        return jsonify({
            'success': True,
            'data': batch.to_dict(),
            'message': '批次创建成功'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/batches/<int:batch_id>/import', methods=['POST'])
def import_records_api(batch_id):
    data = request.get_json() or {}
    records = data.get('records', [])
    source = data.get('source', 'CONTRACT_SCAN')
    operator = data.get('operator', 'SYSTEM')

    if not records:
        return jsonify({'success': False, 'error': '没有要导入的记录'}), 400

    result = import_batch_records(batch_id, records, source, operator)
    return jsonify(result)


@api_bp.route('/batches/<int:batch_id>/import-late', methods=['POST'])
def import_late_attachment_api(batch_id):
    data = request.get_json() or {}
    record_data = data.get('record', {})
    source = data.get('source', 'LATE_ATTACHMENT')
    operator = data.get('operator', 'SYSTEM')

    if not record_data:
        return jsonify({'success': False, 'error': '缺少记录数据'}), 400

    result = import_single_record(
        batch_id=batch_id,
        record_data=record_data,
        source=source,
        operator=operator,
        is_late_attachment=True
    )

    if result.get('success'):
        db.session.commit()

    return jsonify(result)


@api_bp.route('/records', methods=['GET'])
def list_records():
    batch_id = request.args.get('batch_id', type=int)
    status = request.args.get('status')
    has_exception = request.args.get('has_exception')

    query = MarginCall.query
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    if status:
        query = query.filter_by(current_status=status)
    if has_exception is not None:
        query = query.filter_by(has_exception=(has_exception.lower() == 'true'))

    records = query.order_by(MarginCall.created_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [r.to_dict() for r in records]
    })


@api_bp.route('/records/<int:record_id>', methods=['GET'])
def get_record(record_id):
    record = MarginCall.query.get(record_id)
    if not record:
        return jsonify({'success': False, 'error': '记录不存在'}), 404
    include_history = request.args.get('include_history', 'true').lower() == 'true'
    return jsonify({
        'success': True,
        'data': record.to_dict(include_history=include_history)
    })


@api_bp.route('/records/<int:record_id>/status', methods=['PUT'])
def update_status_api(record_id):
    data = request.get_json() or {}
    new_status = data.get('new_status')
    operator = data.get('operator', 'SYSTEM')
    change_reason = data.get('change_reason', '')
    source = data.get('source', 'SYSTEM')
    manual_notes = data.get('manual_notes')

    if not new_status:
        return jsonify({'success': False, 'error': '缺少新状态'}), 400

    valid_statuses = ['PENDING', 'NEEDS_CONFIRM', 'CONFIRMED', 'EXCEPTION', 'CLOSED']
    if new_status not in valid_statuses:
        return jsonify({'success': False, 'error': f'无效状态，必须是: {valid_statuses}'}), 400

    result = update_record_status(
        record_id=record_id,
        new_status=new_status,
        operator=operator,
        change_reason=change_reason,
        source=source,
        manual_notes=manual_notes
    )
    return jsonify(result)


@api_bp.route('/records/<int:record_id>/notes', methods=['POST'])
def add_note_api(record_id):
    data = request.get_json() or {}
    note_content = data.get('note_content')
    note_type = data.get('note_type', 'MANUAL_NOTE')
    operator = data.get('operator', 'SYSTEM')
    source = data.get('source', 'MANUAL_NOTE')
    is_original = data.get('is_original', False)

    if not note_content:
        return jsonify({'success': False, 'error': '缺少备注内容'}), 400

    result = add_note_to_record(
        record_id=record_id,
        note_content=note_content,
        note_type=note_type,
        operator=operator,
        source=source,
        is_original=is_original
    )
    return jsonify(result)


@api_bp.route('/records/<record_no>/versions', methods=['GET'])
def get_versions_api(record_no):
    batch_id = request.args.get('batch_id', type=int)
    versions = get_record_versions(record_no, batch_id)
    return jsonify({
        'success': True,
        'data': versions
    })


@api_bp.route('/export/report', methods=['GET'])
def export_report_api():
    batch_id = request.args.get('batch_id', type=int)
    status_filter = request.args.get('status')
    format_type = request.args.get('format', 'json')

    report = generate_export_report(batch_id, status_filter)

    if format_type == 'excel':
        output = io.BytesIO()
        wb = Workbook()
        ws_summary = wb.active
        ws_summary.title = '汇总'

        ws_summary.append(['外汇保证金穿仓复盘报告'])
        ws_summary.append(['导出时间', report['export_time']])
        ws_summary.append([])
        ws_summary.append(['汇总统计'])
        summary = report['summary']
        ws_summary.append(['总记录数', summary['total_records']])
        ws_summary.append(['保证金总额', summary['total_margin']])
        ws_summary.append(['穿仓总额', summary['total_shortfall']])
        ws_summary.append(['已缴总额', summary['total_payment']])
        ws_summary.append(['应退总额', summary['total_refund']])
        ws_summary.append(['净穿仓金额', summary['net_shortfall']])
        ws_summary.append(['例外记录数', summary['exception_count']])
        ws_summary.append(['晚到附件数', summary['late_attachment_count']])
        ws_summary.append(['待人工确认数', summary['needs_confirm_count']])
        ws_summary.append([])
        ws_summary.append(['按状态分布'])
        for k, v in summary['by_status'].items():
            ws_summary.append([k, v])
        ws_summary.append([])
        ws_summary.append(['按数据质量分布'])
        for k, v in summary['by_quality'].items():
            ws_summary.append([k, v])

        ws_records = wb.create_sheet('明细数据')
        if report['records']:
            headers = list(report['records'][0].keys())
            ws_records.append(headers)
            for r in report['records']:
                ws_records.append([r.get(h, '') for h in headers])

        wb.save(output)
        output.seek(0)

        filename = f"穿仓复盘报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    return jsonify({
        'success': True,
        'data': report
    })


@api_bp.route('/logs', methods=['GET'])
def get_logs_api():
    batch_id = request.args.get('batch_id', type=int)
    margin_call_id = request.args.get('margin_call_id', type=int)
    limit = request.args.get('limit', 100, type=int)

    logs = get_operation_logs(batch_id, margin_call_id, limit)
    return jsonify({
        'success': True,
        'data': logs
    })


@api_bp.route('/batches/<int:batch_id>/close', methods=['POST'])
def close_batch_api(batch_id):
    data = request.get_json() or {}
    operator = data.get('operator', 'SYSTEM')

    batch = Batch.query.get(batch_id)
    if not batch:
        return jsonify({'success': False, 'error': '批次不存在'}), 404

    pending = batch.records.filter(MarginCall.current_status.in_(['PENDING', 'NEEDS_CONFIRM'])).count()
    if pending > 0:
        return jsonify({
            'success': False,
            'error': f'还有 {pending} 条记录未处理完成，无法结批'
        }), 400

    batch.status = STATUS_CLOSED
    batch.updated_at = datetime.now()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': '批次已完结',
        'data': batch.to_dict()
    })
