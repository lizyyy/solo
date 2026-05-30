from flask_marshmallow import Marshmallow
from marshmallow import fields, validate
from models import (
    Instrument, FaultRecord, SparePart, SparePartOrder,
    Performance, PerformanceInstrument, Technician, TechnicianSchedule,
    RepairOrder, SparePartUsage, StatusHistory, RepairException,
    ConfirmationRecord, Reminder
)

ma = Marshmallow()


class InstrumentSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Instrument
        include_fk = True
        load_instance = True


class FaultRecordSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = FaultRecord
        include_fk = True
        load_instance = True

    instrument_name = fields.String(dump_only=True)


class SparePartSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = SparePart
        include_fk = True
        load_instance = True


class SparePartOrderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = SparePartOrder
        include_fk = True
        load_instance = True

    spare_part_name = fields.String(dump_only=True)


class PerformanceInstrumentSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = PerformanceInstrument
        include_fk = True
        load_instance = True

    instrument_name = fields.String(dump_only=True)


class PerformanceSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Performance
        include_fk = True
        load_instance = True

    required_instruments = fields.Nested(PerformanceInstrumentSchema, many=True)


class TechnicianSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Technician
        include_fk = True
        load_instance = True


class TechnicianScheduleSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = TechnicianSchedule
        include_fk = True
        load_instance = True

    technician_name = fields.String(dump_only=True)


class SparePartUsageSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = SparePartUsage
        include_fk = True
        load_instance = True

    spare_part_name = fields.String(dump_only=True)


class StatusHistorySchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = StatusHistory
        include_fk = True
        load_instance = True


class ConfirmationRecordSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = ConfirmationRecord
        include_fk = True
        load_instance = True


class ReminderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Reminder
        include_fk = True
        load_instance = True


class RepairExceptionSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = RepairException
        include_fk = True
        load_instance = True

    status_histories = fields.Nested(StatusHistorySchema, many=True, dump_only=True)
    confirmations = fields.Nested(ConfirmationRecordSchema, many=True, dump_only=True)


class RepairOrderSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = RepairOrder
        include_fk = True
        load_instance = True

    instrument_name = fields.String(dump_only=True)
    technician_name = fields.String(dump_only=True)
    status_histories = fields.Nested(StatusHistorySchema, many=True, dump_only=True)
    spare_part_usages = fields.Nested(SparePartUsageSchema, many=True, dump_only=True)
    exceptions = fields.Nested(RepairExceptionSchema, many=True, dump_only=True)
    reminders = fields.Nested(ReminderSchema, many=True, dump_only=True)
