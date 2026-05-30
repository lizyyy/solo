from datetime import datetime, date
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Enum
import enum

db = SQLAlchemy()


class InstrumentStatus(str, enum.Enum):
    AVAILABLE = "可用"
    IN_REPAIR = "维修中"
    WAITING_SPARE = "待备件"
    REPAIRED = "已修好"
    LOANED = "外借"
    RETIRED = "报废"


class RepairOrderStatus(str, enum.Enum):
    DRAFT = "待派工"
    ASSIGNED = "已派工"
    IN_PROGRESS = "维修中"
    WAITING_SPARE = "待备件"
    COMPLETED = "维修完成"
    RETURNED = "已归还"
    CANCELLED = "已取消"


class SparePartOrderStatus(str, enum.Enum):
    ORDERED = "已下单"
    SHIPPED = "运输中"
    DELAYED = "已延误"
    ARRIVED = "已到货"
    RECEIVED = "已领用"
    CANCELLED = "已取消"


class ExceptionType(str, enum.Enum):
    SPARE_PART_DELAY = "备件晚到"
    DUPLICATE_REPAIR = "重复派修"
    NOT_RETURNED_BEFORE_PERFORMANCE = "演出前未归还"
    SCHEDULE_CONFLICT = "维修师排班冲突"


class ExceptionStatus(str, enum.Enum):
    DETECTED = "已发现"
    ACKNOWLEDGED = "已确认"
    RESOLVED = "已解决"
    ESCALATED = "已升级"


class ConfirmationType(str, enum.Enum):
    SPARE_PART_DELAY_ACK = "备件延误确认"
    DUPLICATE_REPAIR_ACK = "重复派修确认"
    OVERRIDE_RETURN_DEADLINE = "归还期限豁免"
    REPAIR_COMPLETION = "维修完成确认"
    INSTRUMENT_RETURN = "乐器归还确认"


class Instrument(db.Model):
    __tablename__ = "instruments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    brand = db.Column(db.String(100))
    model = db.Column(db.String(100))
    serial_number = db.Column(db.String(100), unique=True, nullable=False)
    purchase_date = db.Column(db.Date)
    purchase_price = db.Column(db.Numeric(10, 2))
    status = db.Column(db.Enum(InstrumentStatus), default=InstrumentStatus.AVAILABLE)
    location = db.Column(db.String(100))
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    fault_records = db.relationship("FaultRecord", backref="instrument", lazy="dynamic")
    repair_orders = db.relationship("RepairOrder", backref="instrument", lazy="dynamic")


class FaultRecord(db.Model):
    __tablename__ = "fault_records"

    id = db.Column(db.Integer, primary_key=True)
    instrument_id = db.Column(db.Integer, db.ForeignKey("instruments.id"), nullable=False)
    fault_date = db.Column(db.Date, nullable=False, default=date.today)
    reporter = db.Column(db.String(100), nullable=False)
    fault_type = db.Column(db.String(50))
    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default="一般")
    fault_location = db.Column(db.String(100))
    is_resolved = db.Column(db.Boolean, default=False)
    resolution_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    repair_orders = db.relationship("RepairOrder", backref="fault_record", lazy="dynamic")


class SparePart(db.Model):
    __tablename__ = "spare_parts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    sku = db.Column(db.String(50), unique=True)
    category = db.Column(db.String(50))
    compatible_instruments = db.Column(db.String(200))
    unit = db.Column(db.String(20), default="个")
    stock_quantity = db.Column(db.Integer, default=0)
    safety_stock = db.Column(db.Integer, default=5)
    unit_price = db.Column(db.Numeric(10, 2))
    supplier = db.Column(db.String(200))
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    orders = db.relationship("SparePartOrder", backref="spare_part", lazy="dynamic")


class SparePartOrder(db.Model):
    __tablename__ = "spare_part_orders"

    id = db.Column(db.Integer, primary_key=True)
    spare_part_id = db.Column(db.Integer, db.ForeignKey("spare_parts.id"), nullable=False)
    order_no = db.Column(db.String(50), unique=True, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2))
    total_amount = db.Column(db.Numeric(10, 2))
    supplier = db.Column(db.String(200))
    order_date = db.Column(db.Date, nullable=False, default=date.today)
    expected_arrival_date = db.Column(db.Date, nullable=False)
    actual_arrival_date = db.Column(db.Date)
    status = db.Column(db.Enum(SparePartOrderStatus), default=SparePartOrderStatus.ORDERED)
    tracking_no = db.Column(db.String(100))
    receiver = db.Column(db.String(100))
    remarks = db.Column(db.Text)
    repair_order_id = db.Column(db.Integer, db.ForeignKey("repair_orders.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    status_histories = db.relationship(
        "StatusHistory",
        primaryjoin="and_(StatusHistory.entity_type=='SparePartOrder', "
                    "foreign(StatusHistory.entity_id)==SparePartOrder.id)",
        lazy="dynamic"
    )

    repair_order = db.relationship("RepairOrder", backref="spare_part_orders")
    spare_part_rel = db.relationship("SparePart", backref="orders_rel")


class Performance(db.Model):
    __tablename__ = "performances"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    performance_date = db.Column(db.Date, nullable=False)
    performance_time = db.Column(db.Time)
    venue = db.Column(db.String(200), nullable=False)
    city = db.Column(db.String(100))
    program = db.Column(db.Text)
    conductor = db.Column(db.String(100))
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    required_instruments = db.relationship(
        "PerformanceInstrument", backref="performance", cascade="all, delete-orphan", lazy="dynamic"
    )


class PerformanceInstrument(db.Model):
    __tablename__ = "performance_instruments"

    id = db.Column(db.Integer, primary_key=True)
    performance_id = db.Column(db.Integer, db.ForeignKey("performances.id"), nullable=False)
    instrument_id = db.Column(db.Integer, db.ForeignKey("instruments.id"), nullable=False)
    player = db.Column(db.String(100))
    call_time = db.Column(db.Time)
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)

    instrument = db.relationship("Instrument")


class Technician(db.Model):
    __tablename__ = "technicians"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    specialty = db.Column(db.String(200))
    skill_level = db.Column(db.String(20), default="中级")
    is_active = db.Column(db.Boolean, default=True)
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    schedules = db.relationship("TechnicianSchedule", backref="technician", lazy="dynamic")
    repair_orders = db.relationship("RepairOrder", backref="technician", lazy="dynamic")


class TechnicianSchedule(db.Model):
    __tablename__ = "technician_schedules"

    id = db.Column(db.Integer, primary_key=True)
    technician_id = db.Column(db.Integer, db.ForeignKey("technicians.id"), nullable=False)
    schedule_date = db.Column(db.Date, nullable=False)
    shift_type = db.Column(db.String(20), default="白班")
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    is_on_leave = db.Column(db.Boolean, default=False)
    leave_reason = db.Column(db.String(200))
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        db.UniqueConstraint("technician_id", "schedule_date", name="uix_tech_date"),
    )


class RepairOrder(db.Model):
    __tablename__ = "repair_orders"

    id = db.Column(db.Integer, primary_key=True)
    order_no = db.Column(db.String(50), unique=True, nullable=False)
    instrument_id = db.Column(db.Integer, db.ForeignKey("instruments.id"), nullable=False)
    fault_record_id = db.Column(db.Integer, db.ForeignKey("fault_records.id"))
    technician_id = db.Column(db.Integer, db.ForeignKey("technicians.id"))
    priority = db.Column(db.String(20), default="普通")
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum(RepairOrderStatus), default=RepairOrderStatus.DRAFT)
    repair_type = db.Column(db.String(50))
    estimated_hours = db.Column(db.Numeric(5, 1))
    actual_hours = db.Column(db.Numeric(5, 1))
    scheduled_start_date = db.Column(db.Date)
    scheduled_complete_date = db.Column(db.Date)
    actual_start_date = db.Column(db.Date)
    actual_complete_date = db.Column(db.Date)
    return_deadline = db.Column(db.Date)
    actual_return_date = db.Column(db.Date)
    repair_note = db.Column(db.Text)
    quality_check_note = db.Column(db.Text)
    created_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    status_histories = db.relationship(
        "StatusHistory",
        primaryjoin="and_(StatusHistory.entity_type=='RepairOrder', "
                    "foreign(StatusHistory.entity_id)==RepairOrder.id)",
        lazy="dynamic"
    )
    spare_part_usages = db.relationship(
        "SparePartUsage", backref="repair_order", cascade="all, delete-orphan", lazy="dynamic"
    )
    exceptions = db.relationship(
        "RepairException",
        primaryjoin="and_(RepairException.repair_order_id==RepairOrder.id)",
        lazy="dynamic"
    )
    reminders = db.relationship(
        "Reminder",
        primaryjoin="and_(Reminder.entity_type=='RepairOrder', "
                    "foreign(Reminder.entity_id)==RepairOrder.id)",
        lazy="dynamic"
    )


class SparePartUsage(db.Model):
    __tablename__ = "spare_part_usages"

    id = db.Column(db.Integer, primary_key=True)
    repair_order_id = db.Column(db.Integer, db.ForeignKey("repair_orders.id"), nullable=False)
    spare_part_id = db.Column(db.Integer, db.ForeignKey("spare_parts.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    usage_date = db.Column(db.Date, default=date.today)
    used_by = db.Column(db.String(100))
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)

    spare_part = db.relationship("SparePart")


class StatusHistory(db.Model):
    __tablename__ = "status_histories"

    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=False)
    from_status = db.Column(db.String(100))
    to_status = db.Column(db.String(100), nullable=False)
    change_reason = db.Column(db.Text)
    operated_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.now, nullable=False)

    __table_args__ = (
        db.Index("ix_status_entity", "entity_type", "entity_id"),
    )


class RepairException(db.Model):
    __tablename__ = "repair_exceptions"

    id = db.Column(db.Integer, primary_key=True)
    exception_type = db.Column(db.Enum(ExceptionType), nullable=False)
    status = db.Column(db.Enum(ExceptionStatus), default=ExceptionStatus.DETECTED)
    repair_order_id = db.Column(db.Integer, db.ForeignKey("repair_orders.id"))
    spare_part_order_id = db.Column(db.Integer, db.ForeignKey("spare_part_orders.id"))
    performance_id = db.Column(db.Integer, db.ForeignKey("performances.id"))
    technician_id = db.Column(db.Integer, db.ForeignKey("technicians.id"))
    description = db.Column(db.Text, nullable=False)
    detected_at = db.Column(db.DateTime, default=datetime.now)
    acknowledged_at = db.Column(db.DateTime)
    acknowledged_by = db.Column(db.String(100))
    acknowledge_note = db.Column(db.Text)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.String(100))
    resolution_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    status_histories = db.relationship(
        "StatusHistory",
        primaryjoin="and_(StatusHistory.entity_type=='RepairException', "
                    "foreign(StatusHistory.entity_id)==RepairException.id)",
        lazy="dynamic"
    )
    confirmations = db.relationship(
        "ConfirmationRecord",
        primaryjoin="and_(ConfirmationRecord.exception_id==RepairException.id)",
        lazy="dynamic"
    )


class ConfirmationRecord(db.Model):
    __tablename__ = "confirmation_records"

    id = db.Column(db.Integer, primary_key=True)
    confirmation_type = db.Column(db.Enum(ConfirmationType), nullable=False)
    repair_order_id = db.Column(db.Integer, db.ForeignKey("repair_orders.id"))
    exception_id = db.Column(db.Integer, db.ForeignKey("repair_exceptions.id"))
    before_snapshot = db.Column(db.Text)
    after_snapshot = db.Column(db.Text)
    confirmed_by = db.Column(db.String(100), nullable=False)
    confirmed_at = db.Column(db.DateTime, default=datetime.now, nullable=False)
    confirmation_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)


class Reminder(db.Model):
    __tablename__ = "reminders"

    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=False)
    reminder_type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    priority = db.Column(db.String(20), default="普通")
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    read_by = db.Column(db.String(100))
    due_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.now)
