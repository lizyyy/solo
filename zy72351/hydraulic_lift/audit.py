from hydraulic_lift.database import db
from hydraulic_lift.models import AuditEntry


def log_audit(record_id, action, operator, role, parameter_id=None,
              old_value=None, new_value=None, reason=None, note=None):
    entry = AuditEntry(
        record_id=record_id,
        parameter_id=parameter_id,
        action=action,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        reason=reason,
        operator=operator,
        role=role,
        note=note,
    )
    db.session.add(entry)
    db.session.commit()
    return entry


def get_record_audit_trail(record_id):
    return AuditEntry.query.filter_by(record_id=record_id).order_by(AuditEntry.created_at.asc()).all()


def get_parameter_audit_trail(parameter_id):
    return AuditEntry.query.filter_by(parameter_id=parameter_id).order_by(AuditEntry.created_at.asc()).all()
