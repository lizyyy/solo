from flask import Blueprint, request, jsonify
from models import db, Reminder
from services.reminder_service import ReminderService

bp = Blueprint('reminders', __name__, url_prefix='/api/reminders')


@bp.route('', methods=['GET'])
def list_reminders():
    is_read = request.args.get('is_read')
    entity_type = request.args.get('entity_type')
    priority = request.args.get('priority')
    query = Reminder.query
    if is_read is not None:
        query = query.filter_by(is_read=(is_read.lower() == 'true'))
    if entity_type:
        query = query.filter_by(entity_type=entity_type)
    if priority:
        query = query.filter_by(priority=priority)
    items = query.order_by(Reminder.created_at.desc()).all()
    return jsonify([{
        'id': r.id,
        'entity_type': r.entity_type,
        'entity_id': r.entity_id,
        'reminder_type': r.reminder_type,
        'title': r.title,
        'content': r.content,
        'priority': r.priority,
        'is_read': r.is_read,
        'due_date': str(r.due_date) if r.due_date else None,
        'created_at': str(r.created_at)
    } for r in items])


@bp.route('/<int:id>/read', methods=['POST'])
def mark_read(id):
    data = request.get_json() or {}
    read_by = data.get('read_by')
    reminder = ReminderService.mark_read(id, read_by)
    db.session.commit()
    return jsonify({'status': 'success'})


@bp.route('/check', methods=['POST'])
def check_reminders():
    ReminderService.check_and_create_return_deadline_reminders()
    ReminderService.check_and_create_spare_arrival_reminders()
    db.session.commit()
    return jsonify({'status': 'success'})
