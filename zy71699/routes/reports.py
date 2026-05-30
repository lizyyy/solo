from flask import Blueprint, request, jsonify, send_file
from services.report_service import ReportService
from datetime import datetime, date, timedelta

bp = Blueprint('reports', __name__, url_prefix='/api/reports')


def parse_date(date_str):
    if date_str:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    return None


@bp.route('/schedule', methods=['GET'])
def get_schedule_report():
    start_date = parse_date(request.args.get('start_date'))
    end_date = parse_date(request.args.get('end_date'))
    report = ReportService.generate_schedule_report(start_date, end_date)

    response = {
        'report_period': {
            'start_date': str(report['report_period']['start_date']),
            'end_date': str(report['report_period']['end_date']),
            'generated_at': str(report['report_period']['generated_at']),
        },
        'summary': report['summary'],
        'repair_orders': [
            {
                'id': ro.id,
                'order_no': ro.order_no,
                'instrument': ro.instrument.name if ro.instrument else None,
                'status': ro.status.value,
                'priority': ro.priority,
                'technician': ro.technician.name if ro.technician else None,
                'created_at': str(ro.created_at),
                'scheduled_complete_date': str(ro.scheduled_complete_date) if ro.scheduled_complete_date else None,
                'return_deadline': str(ro.return_deadline) if ro.return_deadline else None
            } for ro in report['repair_orders']
        ],
        'instruments_in_repair': [
            {
                'id': i.id,
                'name': i.name,
                'category': i.category,
                'status': i.status.value
            } for i in report['instruments_in_repair']
        ],
        'upcoming_performances': [
            {
                'id': p.id,
                'name': p.name,
                'performance_date': str(p.performance_date),
                'venue': p.venue,
                'city': p.city,
                'required_instruments': p.required_instruments.count(),
                'at_risk_instruments': sum(
                    1 for pi in p.required_instruments
                    if pi.instrument and pi.instrument.status in ['维修中', '待备件']
                )
            } for p in report['upcoming_performances']
        ],
        'pending_spare_orders': [
            {
                'id': s.id,
                'order_no': s.order_no,
                'spare_part': s.spare_part.name if s.spare_part else None,
                'status': s.status.value,
                'quantity': s.quantity,
                'expected_arrival_date': str(s.expected_arrival_date)
            } for s in report['pending_spare_orders']
        ],
        'active_exceptions': [
            {
                'id': e.id,
                'exception_type': e.exception_type.value,
                'status': e.status.value,
                'description': e.description,
                'detected_at': str(e.detected_at)
            } for e in report['active_exceptions']
        ],
        'at_risk_instruments': [
            {
                'instrument_id': ar['instrument'].id,
                'instrument_name': ar['instrument'].name,
                'instrument_status': ar['instrument'].status.value,
                'performance_id': ar['performance'].id,
                'performance_name': ar['performance'].name,
                'performance_date': str(ar['performance'].performance_date),
                'repair_order_id': ar['repair_order'].id if ar['repair_order'] else None,
                'repair_order_no': ar['repair_order'].order_no if ar['repair_order'] else None,
                'repair_status': ar['repair_order'].status.value if ar['repair_order'] else None
            } for ar in report['at_risk_instruments']
        ],
        'unread_reminders': [
            {
                'id': r.id,
                'title': r.title,
                'content': r.content,
                'priority': r.priority,
                'reminder_type': r.reminder_type,
                'due_date': str(r.due_date) if r.due_date else None,
                'created_at': str(r.created_at)
            } for r in report['unread_reminders']
        ]
    }
    return jsonify(response)


@bp.route('/schedule/export', methods=['GET'])
def export_schedule_report():
    start_date = parse_date(request.args.get('start_date'))
    end_date = parse_date(request.args.get('end_date'))
    output = ReportService.export_schedule_report_to_excel(start_date, end_date)
    filename = f"维修排程报告_{date.today().strftime('%Y%m%d')}.xlsx"
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )


@bp.route('/repair-order/<int:id>', methods=['GET'])
def get_repair_order_report(id):
    report = ReportService.generate_repair_order_detail_report(id)
    if not report:
        return jsonify({'error': '工单不存在'}), 404

    order = report['repair_order']
    response = {
        'generated_at': str(report['generated_at']),
        'repair_order': {
            'id': order.id,
            'order_no': order.order_no,
            'instrument': order.instrument.name if order.instrument else None,
            'status': order.status.value,
            'priority': order.priority,
            'technician': order.technician.name if order.technician else None,
            'description': order.description,
            'created_at': str(order.created_at),
            'scheduled_start_date': str(order.scheduled_start_date) if order.scheduled_start_date else None,
            'scheduled_complete_date': str(order.scheduled_complete_date) if order.scheduled_complete_date else None,
            'actual_start_date': str(order.actual_start_date) if order.actual_start_date else None,
            'actual_complete_date': str(order.actual_complete_date) if order.actual_complete_date else None,
            'return_deadline': str(order.return_deadline) if order.return_deadline else None,
            'actual_return_date': str(order.actual_return_date) if order.actual_return_date else None,
            'estimated_hours': float(order.estimated_hours) if order.estimated_hours else None,
            'actual_hours': float(order.actual_hours) if order.actual_hours else None,
            'repair_note': order.repair_note,
            'quality_check_note': order.quality_check_note
        },
        'status_history': [
            {
                'id': h.id,
                'from_status': h.from_status,
                'to_status': h.to_status,
                'change_reason': h.change_reason,
                'operated_by': h.operated_by,
                'created_at': str(h.created_at)
            } for h in report['status_history']
        ],
        'spare_part_usages': [
            {
                'id': u.id,
                'spare_part': u.spare_part.name if u.spare_part else None,
                'quantity': u.quantity,
                'usage_date': str(u.usage_date),
                'used_by': u.used_by,
                'remarks': u.remarks
            } for u in report['spare_part_usages']
        ],
        'exceptions': [
            {
                'id': e.id,
                'exception_type': e.exception_type.value,
                'status': e.status.value,
                'description': e.description,
                'detected_at': str(e.detected_at),
                'acknowledged_by': e.acknowledged_by,
                'acknowledged_at': str(e.acknowledged_at) if e.acknowledged_at else None
            } for e in report['exceptions']
        ],
        'reminders': [
            {
                'id': r.id,
                'title': r.title,
                'content': r.content,
                'priority': r.priority,
                'reminder_type': r.reminder_type,
                'due_date': str(r.due_date) if r.due_date else None,
                'is_read': r.is_read,
                'created_at': str(r.created_at)
            } for r in report['reminders']
        ],
        'confirmations': [
            {
                'id': c.id,
                'confirmation_type': c.confirmation_type.value,
                'confirmed_at': str(c.confirmed_at),
                'confirmed_by': c.confirmed_by,
                'confirmation_note': c.confirmation_note,
                'has_snapshot': c.before_snapshot is not None
            } for c in report['confirmations']
        ]
    }
    return jsonify(response)


@bp.route('/repair-order/<int:id>/export', methods=['GET'])
def export_repair_order(id):
    output = ReportService.export_repair_order_to_excel(id)
    if not output:
        return jsonify({'error': '工单不存在'}), 404
    filename = f"维修工单_{id}.xlsx"
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )
