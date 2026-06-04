from datetime import datetime
from hydraulic_lift.database import db


class CalculationRecord(db.Model):
    __tablename__ = "calculation_records"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(50), default="draft")
    conclusion = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    parameters = db.relationship("Parameter", backref="record", lazy="dynamic")
    screenshots = db.relationship("Screenshot", backref="record", lazy="dynamic")
    audit_entries = db.relationship("AuditEntry", backref="record", lazy="dynamic")

    def has_unresolved_flags(self):
        return any(p.needs_review for p in self.parameters)

    def status_label(self):
        labels = {
            "draft": "草稿",
            "under_review": "复核中",
            "needs_engineer_review": "待设备工程师复核",
            "approved": "已通过",
            "rejected": "未通过",
        }
        return labels.get(self.status, self.status)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "status_label": self.status_label(),
            "conclusion": self.conclusion,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "has_unresolved_flags": self.has_unresolved_flags(),
            "parameter_count": self.parameters.count(),
            "screenshot_count": self.screenshots.count(),
            "audit_count": self.audit_entries.count(),
        }


class Parameter(db.Model):
    __tablename__ = "parameters"

    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey("calculation_records.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    display_name = db.Column(db.String(200), nullable=False)
    value = db.Column(db.Float, nullable=False)
    original_value = db.Column(db.Float, nullable=True)
    unit = db.Column(db.String(50), nullable=True)
    category = db.Column(db.String(50), default="input")
    source = db.Column(db.String(50), default="system_default")
    is_manual_override = db.Column(db.Boolean, default=False)
    override_reason = db.Column(db.Text, nullable=True)
    override_by = db.Column(db.String(100), nullable=True)
    sampling_interval_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    audit_entries = db.relationship("AuditEntry", backref="parameter", lazy="dynamic")

    @property
    def needs_review(self):
        return self.is_manual_override and not self.override_reason

    def flag_label(self):
        if not self.is_manual_override:
            return None
        if self.override_reason:
            return "已说明原因"
        return "人工改过系数但没写原因"

    def next_action(self):
        if self.needs_review:
            return "需要设备工程师复核：系数已人工修改但未写明原因"
        if self.is_manual_override and self.override_reason:
            return "已由{}说明原因，可继续".format(self.override_by or "相关人员")
        if not self.sampling_interval_note and self.category == "input":
            return "待训练教练补录采样间隔说明"
        return None

    def to_dict(self):
        return {
            "id": self.id,
            "record_id": self.record_id,
            "name": self.name,
            "display_name": self.display_name,
            "value": self.value,
            "original_value": self.original_value,
            "unit": self.unit,
            "category": self.category,
            "source": self.source,
            "is_manual_override": self.is_manual_override,
            "override_reason": self.override_reason,
            "override_by": self.override_by,
            "sampling_interval_note": self.sampling_interval_note,
            "needs_review": self.needs_review,
            "flag_label": self.flag_label(),
            "next_action": self.next_action(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Screenshot(db.Model):
    __tablename__ = "screenshots"

    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey("calculation_records.id"), nullable=False)
    filename = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text, nullable=True)
    source_chat = db.Column(db.String(200), nullable=True)
    extracted_summary = db.Column(db.Text, nullable=True)
    imported_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "record_id": self.record_id,
            "filename": self.filename,
            "description": self.description,
            "source_chat": self.source_chat,
            "extracted_summary": self.extracted_summary,
            "imported_at": self.imported_at.isoformat() if self.imported_at else None,
        }


class AuditEntry(db.Model):
    __tablename__ = "audit_entries"

    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey("calculation_records.id"), nullable=False)
    parameter_id = db.Column(db.Integer, db.ForeignKey("parameters.id"), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    old_value = db.Column(db.String(200), nullable=True)
    new_value = db.Column(db.String(200), nullable=True)
    reason = db.Column(db.Text, nullable=True)
    operator = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def action_label(self):
        labels = {
            "import_screenshot": "导入维修群截图",
            "manual_override": "人工修正系数",
            "supplement_interval": "补录采样间隔说明",
            "add_override_reason": "补充修正原因",
            "rerun": "重跑试算",
            "review": "复核确认",
            "create": "创建试算记录",
        }
        return labels.get(self.action, self.action)

    def to_dict(self):
        return {
            "id": self.id,
            "record_id": self.record_id,
            "parameter_id": self.parameter_id,
            "action": self.action,
            "action_label": self.action_label(),
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
            "operator": self.operator,
            "role": self.role,
            "note": self.note,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
