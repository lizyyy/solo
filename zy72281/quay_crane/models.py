"""数据库模型."""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class SafetyRadius(db.Model):
    """安全半径表 - 主材料数据."""

    __tablename__ = "safety_radius"

    id = db.Column(db.Integer, primary_key=True)
    record_no = db.Column(db.String(50), unique=True, nullable=False, comment="记录编号")
    crane_no = db.Column(db.String(20), nullable=False, comment="岸桥编号")
    operation_date = db.Column(db.Date, nullable=False, comment="作业日期")
    x = db.Column(db.Float, nullable=False, comment="X坐标")
    y = db.Column(db.Float, nullable=False, comment="Y坐标")
    z = db.Column(db.Float, nullable=False, comment="Z坐标")
    radius = db.Column(db.Float, nullable=False, comment="作业半径")
    z_axis_direction = db.Column(db.String(10), default="up", comment="Z轴方向")
    is_z_reversed = db.Column(db.Boolean, default=False, comment="Z轴是否按旧习惯写反")
    created_at = db.Column(db.DateTime, default=datetime.now)
    status = db.Column(
        db.String(20),
        default="pending",
        comment="状态: pending待处理, normal正常, z_reversed待复核, updated已补录"
    )
    source = db.Column(db.String(20), default="import", comment="来源: import导入, manual人工, origin补录")
    operation_record_id = db.Column(db.Integer, db.ForeignKey("operation_record.id"))
    origin_note_id = db.Column(db.Integer, db.ForeignKey("origin_note.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "record_no": self.record_no,
            "crane_no": self.crane_no,
            "operation_date": self.operation_date.isoformat() if self.operation_date else None,
            "x": self.x,
            "y": self.y,
            "z": self.z,
            "radius": self.radius,
            "z_axis_direction": self.z_axis_direction,
            "is_z_reversed": self.is_z_reversed,
            "status": self.status,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OriginNote(db.Model):
    """坐标原点说明 - 关键备注表."""

    __tablename__ = "origin_note"

    id = db.Column(db.Integer, primary_key=True)
    note_no = db.Column(db.String(50), unique=True, nullable=False, comment="说明编号")
    crane_no = db.Column(db.String(20), nullable=False, comment="岸桥编号")
    record_no = db.Column(db.String(50), nullable=False, comment="关联记录编号")
    origin_x = db.Column(db.Float, nullable=False, comment="原点X坐标")
    origin_y = db.Column(db.Float, nullable=False, comment="原点Y坐标")
    origin_z = db.Column(db.Float, nullable=False, comment="原点Z坐标")
    old_caliber = db.Column(db.Text, nullable=True, comment="旧口径说明")
    z_direction_note = db.Column(db.String(100), nullable=True, comment="Z轴方向备注")
    operator = db.Column(db.String(50), nullable=False, comment="补录人（许工）")
    supplementary_at = db.Column(db.DateTime, default=datetime.now)
    is_applied = db.Column(db.Boolean, default=False, comment="是否已应用到回放")

    def to_dict(self):
        return {
            "id": self.id,
            "note_no": self.note_no,
            "crane_no": self.crane_no,
            "record_no": self.record_no,
            "origin_x": self.origin_x,
            "origin_y": self.origin_y,
            "origin_z": self.origin_z,
            "old_caliber": self.old_caliber,
            "z_direction_note": self.z_direction_note,
            "operator": self.operator,
            "supplementary_at": self.supplementary_at.isoformat() if self.supplementary_at else None,
            "is_applied": self.is_applied,
        }


class OperationRecord(db.Model):
    """作业操作记录."""

    __tablename__ = "operation_record"

    id = db.Column(db.Integer, primary_key=True)
    operation_type = db.Column(
        db.String(20),
        nullable=False,
        comment="操作类型: import导入, manual_correction人工修正, rerun重跑, origin补录"
    )
    operator = db.Column(db.String(50), nullable=False, comment="操作人")
    operation_time = db.Column(db.DateTime, default=datetime.now)
    description = db.Column(db.Text, nullable=True)
    affected_count = db.Column(db.Integer, default=0)

    safety_radii = db.relationship("SafetyRadius", backref="operation_record")
    playback_paths = db.relationship("PlaybackPath", backref="operation_record")

    def to_dict(self):
        return {
            "id": self.id,
            "operation_type": self.operation_type,
            "operator": self.operator,
            "operation_time": self.operation_time.isoformat() if self.operation_time else None,
            "description": self.description,
            "affected_count": self.affected_count,
        }


class PlaybackPath(db.Model):
    """路径回放表."""

    __tablename__ = "playback_path"

    id = db.Column(db.Integer, primary_key=True)
    path_no = db.Column(db.String(50), unique=True, nullable=False, comment="路径编号")
    safety_radius_id = db.Column(db.Integer, db.ForeignKey("safety_radius.id"), nullable=False)
    record_no = db.Column(db.String(50), nullable=False, comment="关联记录编号")
    crane_no = db.Column(db.String(20), nullable=False)
    origin_x = db.Column(db.Float, nullable=False, comment="回放原点X")
    origin_y = db.Column(db.Float, nullable=False, comment="回放原点Y")
    origin_z = db.Column(db.Float, nullable=False, comment="回放原点Z")
    path_points = db.Column(db.Text, nullable=False, comment="路径点JSON")
    z_axis_applied = db.Column(db.String(10), default="up", comment="实际应用的Z轴方向")
    is_origin_applied = db.Column(db.Boolean, default=False, comment="是否应用了原点补录")
    playback_time = db.Column(db.DateTime, default=datetime.now)
    version = db.Column(db.Integer, default=1, comment="回放版本")
    operation_record_id = db.Column(db.Integer, db.ForeignKey("operation_record.id"))

    safety_radius = db.relationship("SafetyRadius", backref="playback_paths")

    def to_dict(self):
        return {
            "id": self.id,
            "path_no": self.path_no,
            "safety_radius_id": self.safety_radius_id,
            "record_no": self.record_no,
            "crane_no": self.crane_no,
            "origin_x": self.origin_x,
            "origin_y": self.origin_y,
            "origin_z": self.origin_z,
            "path_points": self.path_points,
            "z_axis_applied": self.z_axis_applied,
            "is_origin_applied": self.is_origin_applied,
            "playback_time": self.playback_time.isoformat() if self.playback_time else None,
            "version": self.version,
        }
