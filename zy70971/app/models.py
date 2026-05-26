from datetime import datetime

from .extensions import db


BATCH_STATUSES = ("processing", "failed", "manual_review", "exported")
RECORD_STATUSES = ("normal", "need_replenish", "blocked")


class Batch(db.Model):
    __tablename__ = "batches"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    created_by = db.Column(db.String(64), nullable=False, default="unknown")
    status = db.Column(db.String(32), nullable=False, default="processing")
    raw_payload = db.Column(db.Text, nullable=True)
    total_count = db.Column(db.Integer, nullable=False, default=0)
    normal_count = db.Column(db.Integer, nullable=False, default=0)
    need_replenish_count = db.Column(db.Integer, nullable=False, default=0)
    blocked_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records = db.relationship("Record", backref="batch", cascade="all, delete-orphan")
    audit_logs = db.relationship("AuditLog", backref="batch", cascade="all, delete-orphan")


class Record(db.Model):
    __tablename__ = "records"

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey("batches.id"), nullable=False)
    seq = db.Column(db.Integer, nullable=False)

    raw_data = db.Column(db.Text, nullable=True)

    region = db.Column(db.String(128))
    pesticide_code = db.Column(db.String(64))
    pesticide_name = db.Column(db.String(128))
    dosage = db.Column(db.Float)
    dosage_unit = db.Column(db.String(16), default="kg/ha")
    standard_dosage = db.Column(db.Float)
    wind_speed = db.Column(db.Float)
    safety_interval_hours = db.Column(db.Integer)
    reentry_hours = db.Column(db.Integer)
    operator = db.Column(db.String(64))
    sprayed_at = db.Column(db.String(32))

    status = db.Column(db.String(32), nullable=False, default="need_replenish")
    reason = db.Column(db.String(512))
    action_taken = db.Column(db.String(256))

    final_verdict = db.Column(db.String(32))
    reviewed_by = db.Column(db.String(64))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey("batches.id"))
    record_id = db.Column(db.Integer)
    operator = db.Column(db.String(64), nullable=False)
    field_name = db.Column(db.String(64), nullable=False)
    old_value = db.Column(db.String(512))
    new_value = db.Column(db.String(512))
    reason = db.Column(db.String(512))
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
