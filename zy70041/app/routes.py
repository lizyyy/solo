from flask import Blueprint, request, jsonify
from datetime import datetime
from app import db
from models import (
    InspectionItem, DefectTicket, WorkOrder, Reinspection,
    DowntimeRecord, ImpactStatistics, TicketStatus, DefectSeverity
)

bp = Blueprint('api', __name__, url_prefix='/api')


def validate_version(ticket, expected_version):
    if expected_version != ticket.version:
        raise ValueError(
            f'工单版本冲突：当前版本 {ticket.version}，您的版本 {expected_version}，请刷新后重试'
        )


def validate_transition(ticket, new_status):
    if not ticket.can_transition_to(new_status):
        valid_next = [s.value for s in TicketStatus if ticket.can_transition_to(s)]
        if not valid_next:
            valid_next = ['无（已关闭）']
        raise ValueError(
            f'状态流转无效：从 {ticket.status.value} 不能直接转到 {new_status.value}，'
            f'允许的下一个状态：{", ".join(valid_next)}'
        )


@bp.errorhandler(Exception)
def handle_exception(e):
    db.session.rollback()
    return jsonify({'error': str(e)}), 400


@bp.route('/inspection-items', methods=['GET'])
def list_inspection_items():
    items = InspectionItem.query.all()
    return jsonify([item.to_dict() for item in items])


@bp.route('/inspection-items', methods=['POST'])
def create_inspection_item():
    data = request.json
    item = InspectionItem(
        name=data['name'],
        equipment=data['equipment'],
        description=data.get('description')
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@bp.route('/tickets', methods=['GET'])
def list_tickets():
    tickets = DefectTicket.query.order_by(DefectTicket.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tickets])


@bp.route('/tickets/<int:ticket_id>', methods=['GET'])
def get_ticket(ticket_id):
    ticket = DefectTicket.query.get_or_404(ticket_id)
    return jsonify(ticket.to_dict())


@bp.route('/tickets', methods=['POST'])
def create_ticket():
    data = request.json
    item = InspectionItem.query.get_or_404(data['inspection_item_id'])

    ticket = DefectTicket(
        inspection_item_id=data['inspection_item_id'],
        severity=DefectSeverity[data['severity']],
        description=data['description'],
        created_by=data['created_by']
    )
    db.session.add(ticket)
    db.session.commit()
    return jsonify(ticket.to_dict()), 201


@bp.route('/tickets/<int:ticket_id>/assign', methods=['POST'])
def assign_ticket(ticket_id):
    data = request.json
    ticket = DefectTicket.query.get_or_404(ticket_id)
    validate_version(ticket, data['version'])
    validate_transition(ticket, TicketStatus.ASSIGNED)

    work_order = WorkOrder(
        defect_ticket_id=ticket.id,
        assignee=data['assignee'],
        instructions=data.get('instructions')
    )

    ticket.assigned_to = data['assignee']
    ticket.status = TicketStatus.ASSIGNED

    db.session.add(work_order)
    db.session.commit()
    return jsonify({
        'ticket': ticket.to_dict(),
        'work_order': work_order.to_dict()
    })


@bp.route('/tickets/<int:ticket_id>/start-work', methods=['POST'])
def start_work(ticket_id):
    data = request.json
    ticket = DefectTicket.query.get_or_404(ticket_id)
    validate_version(ticket, data['version'])
    validate_transition(ticket, TicketStatus.IN_PROGRESS)

    work_order = WorkOrder.query.filter_by(defect_ticket_id=ticket.id).order_by(
        WorkOrder.created_at.desc()
    ).first()
    if not work_order:
        raise ValueError('工单还没有派单记录，请先派单')

    work_order.started_at = datetime.utcnow()
    ticket.status = TicketStatus.IN_PROGRESS

    db.session.commit()
    return jsonify(ticket.to_dict())


@bp.route('/tickets/<int:ticket_id>/complete-work', methods=['POST'])
def complete_work(ticket_id):
    data = request.json
    ticket = DefectTicket.query.get_or_404(ticket_id)
    validate_version(ticket, data['version'])
    validate_transition(ticket, TicketStatus.COMPLETED)

    work_order = WorkOrder.query.filter_by(defect_ticket_id=ticket.id).order_by(
        WorkOrder.created_at.desc()
    ).first()
    if not work_order:
        raise ValueError('工单还没有派单记录')

    work_order.completed_at = datetime.utcnow()
    work_order.notes = data.get('notes')
    ticket.status = TicketStatus.COMPLETED

    db.session.commit()
    return jsonify(ticket.to_dict())


@bp.route('/tickets/<int:ticket_id>/reinspect', methods=['POST'])
def reinspect_ticket(ticket_id):
    data = request.json
    ticket = DefectTicket.query.get_or_404(ticket_id)
    validate_version(ticket, data['version'])

    result = data['result']
    if result:
        validate_transition(ticket, TicketStatus.REINSPECTED)
        new_status = TicketStatus.REINSPECTED
    else:
        validate_transition(ticket, TicketStatus.REOPENED)
        new_status = TicketStatus.REOPENED

    reinspection = Reinspection(
        defect_ticket_id=ticket.id,
        inspector=data['inspector'],
        result=result,
        comments=data.get('comments')
    )
    db.session.add(reinspection)

    ticket.status = new_status
    if new_status == TicketStatus.REOPENED:
        ticket.assigned_to = None

    db.session.commit()
    return jsonify({
        'ticket': ticket.to_dict(),
        'reinspection': reinspection.to_dict()
    })


@bp.route('/tickets/<int:ticket_id>/close', methods=['POST'])
def close_ticket(ticket_id):
    data = request.json
    ticket = DefectTicket.query.get_or_404(ticket_id)
    validate_version(ticket, data['version'])
    validate_transition(ticket, TicketStatus.CLOSED)

    ticket.status = TicketStatus.CLOSED
    db.session.commit()
    return jsonify(ticket.to_dict())


@bp.route('/tickets/<int:ticket_id>/downtime', methods=['POST'])
def record_downtime(ticket_id):
    data = request.json
    ticket = DefectTicket.query.get_or_404(ticket_id)

    start_time = datetime.fromisoformat(data['start_time'])
    end_time = datetime.fromisoformat(data['end_time']) if data.get('end_time') else None

    if end_time and end_time <= start_time:
        raise ValueError('结束时间必须大于开始时间')

    duration = None
    if end_time:
        duration = (end_time - start_time).total_seconds() / 3600.0

    downtime = DowntimeRecord(
        defect_ticket_id=ticket.id,
        start_time=start_time,
        end_time=end_time,
        duration_hours=duration,
        reason=data.get('reason')
    )
    db.session.add(downtime)

    if duration:
        total_downtime = db.session.query(
            db.func.coalesce(db.func.sum(DowntimeRecord.duration_hours), 0)
        ).filter_by(defect_ticket_id=ticket.id).scalar()
        ticket.downtime_hours = total_downtime + duration

    db.session.commit()
    return jsonify(downtime.to_dict()), 201


@bp.route('/tickets/<int:ticket_id>/downtime', methods=['GET'])
def list_downtime(ticket_id):
    records = DowntimeRecord.query.filter_by(defect_ticket_id=ticket_id).all()
    return jsonify([r.to_dict() for r in records])


@bp.route('/statistics', methods=['GET'])
def list_statistics():
    stats = ImpactStatistics.query.order_by(ImpactStatistics.generated_at.desc()).all()
    return jsonify([s.to_dict() for s in stats])
