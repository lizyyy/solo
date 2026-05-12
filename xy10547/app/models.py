from datetime import datetime, date, time
from app import db
from sqlalchemy import Enum as SQLAlchemyEnum
from enum import Enum


class MedicationType(Enum):
    ORAL = "口服"
    INJECTION = "注射"
    TOPICAL = "外用"
    OTHER = "其他"


class PrescriptionStatus(Enum):
    ACTIVE = "有效"
    DISCONTINUED = "已停用"
    EXPIRED = "已过期"


class DoseStatus(Enum):
    SCHEDULED = "待执行"
    CONFIRMED = "已确认"
    MISSED = "已漏服"
    MAKEUP_REQUESTED = "补服申请中"
    MAKEUP_APPROVED = "补服已批准"
    MAKEUP_ADMINISTERED = "补服已执行"
    MAKEUP_DENIED = "补服已拒绝"
    SKIPPED = "已跳过"


class ShiftStatus(Enum):
    PENDING = "待确认"
    CONFIRMED = "已确认"
    ABNORMAL = "有异常"


class ExceptionType(Enum):
    INVENTORY_SHORTAGE = "库存不足"
    PRESCRIPTION_STOPPED = "医嘱停用"
    MISSED_DOSE = "漏服"
    MISSED_WINDOW_EXCEEDED = "超过补服窗口"
    SHIFT_NOT_CONFIRMED = "交接班未确认"
    DUPLICATE_CONFIRMATION = "同一时段重复确认"
    INVALID_OPERATION = "操作错误"


class ExceptionStatus(Enum):
    OPEN = "待处理"
    RESOLVED = "已处理"
    IGNORED = "已忽略"


class Resident(db.Model):
    __tablename__ = 'residents'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.String(10))
    age = db.Column(db.Integer)
    room_number = db.Column(db.String(50))
    bed_number = db.Column(db.String(50))
    admission_date = db.Column(db.Date)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    prescriptions = db.relationship('Prescription', backref='resident', lazy=True)
    medication_plans = db.relationship('MedicationPlan', backref='resident', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'gender': self.gender,
            'age': self.age,
            'room_number': self.room_number,
            'bed_number': self.bed_number,
            'admission_date': self.admission_date.isoformat() if self.admission_date else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Nurse(db.Model):
    __tablename__ = 'nurses'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'role': self.role,
            'phone': self.phone,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Prescription(db.Model):
    __tablename__ = 'prescriptions'
    
    id = db.Column(db.String(50), primary_key=True)
    resident_id = db.Column(db.String(50), db.ForeignKey('residents.id'), nullable=False)
    medication_name = db.Column(db.String(200), nullable=False)
    medication_type = db.Column(SQLAlchemyEnum(MedicationType), default=MedicationType.ORAL)
    dosage = db.Column(db.String(100), nullable=False)
    frequency = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date)
    status = db.Column(SQLAlchemyEnum(PrescriptionStatus), default=PrescriptionStatus.ACTIVE)
    prescribed_by = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    medication_plans = db.relationship('MedicationPlan', backref='prescription', lazy=True)
    history = db.relationship('PrescriptionHistory', backref='prescription', lazy=True,
                              order_by='PrescriptionHistory.created_at.desc()')
    
    def to_dict(self, include_history=False):
        result = {
            'id': self.id,
            'resident_id': self.resident_id,
            'medication_name': self.medication_name,
            'medication_type': self.medication_type.value if self.medication_type else None,
            'dosage': self.dosage,
            'frequency': self.frequency,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status.value if self.status else None,
            'prescribed_by': self.prescribed_by,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_history:
            result['history'] = [h.to_dict() for h in self.history]
        return result


class PrescriptionHistory(db.Model):
    __tablename__ = 'prescription_history'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    prescription_id = db.Column(db.String(50), db.ForeignKey('prescriptions.id'), nullable=False)
    field_name = db.Column(db.String(100))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    changed_by = db.Column(db.String(100))
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'prescription_id': self.prescription_id,
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'changed_by': self.changed_by,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class MedicationPlan(db.Model):
    __tablename__ = 'medication_plans'
    
    id = db.Column(db.String(50), primary_key=True)
    resident_id = db.Column(db.String(50), db.ForeignKey('residents.id'), nullable=False)
    prescription_id = db.Column(db.String(50), db.ForeignKey('prescriptions.id'), nullable=False)
    dose_date = db.Column(db.Date, nullable=False)
    dose_time = db.Column(db.Time, nullable=False)
    dosage = db.Column(db.String(100))
    status = db.Column(SQLAlchemyEnum(DoseStatus), default=DoseStatus.SCHEDULED)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    confirmations = db.relationship('MedicationConfirmation', backref='medication_plan', lazy=True,
                                     order_by='MedicationConfirmation.confirmed_at.desc()')
    missed_doses = db.relationship('MissedDose', backref='medication_plan', lazy=True,
                                   order_by='MissedDose.registered_at.desc()')
    makeup_approvals = db.relationship('MakeupApproval', backref='medication_plan', lazy=True,
                                       order_by='MakeupApproval.requested_at.desc()')
    inventory_deductions = db.relationship('InventoryDeduction', backref='medication_plan', lazy=True)
    
    def to_dict(self, include_details=False):
        result = {
            'id': self.id,
            'resident_id': self.resident_id,
            'prescription_id': self.prescription_id,
            'dose_date': self.dose_date.isoformat() if self.dose_date else None,
            'dose_time': self.dose_time.isoformat() if self.dose_time else None,
            'dosage': self.dosage,
            'status': self.status.value if self.status else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_details:
            result['confirmations'] = [c.to_dict() for c in self.confirmations]
            result['missed_doses'] = [m.to_dict() for m in self.missed_doses]
            result['makeup_approvals'] = [a.to_dict() for a in self.makeup_approvals]
        return result


class MedicationConfirmation(db.Model):
    __tablename__ = 'medication_confirmations'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    medication_plan_id = db.Column(db.String(50), db.ForeignKey('medication_plans.id'), nullable=False)
    request_id = db.Column(db.String(100), nullable=False, unique=True)
    nurse_id = db.Column(db.String(50), db.ForeignKey('nurses.id'), nullable=False)
    confirmed_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)
    is_makeup = db.Column(db.Boolean, default=False)
    
    nurse = db.relationship('Nurse', backref='confirmations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'medication_plan_id': self.medication_plan_id,
            'request_id': self.request_id,
            'nurse_id': self.nurse_id,
            'nurse_name': self.nurse.name if self.nurse else None,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'notes': self.notes,
            'is_makeup': self.is_makeup
        }


class MissedDose(db.Model):
    __tablename__ = 'missed_doses'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    medication_plan_id = db.Column(db.String(50), db.ForeignKey('medication_plans.id'), nullable=False)
    request_id = db.Column(db.String(100), nullable=False, unique=True)
    registered_by = db.Column(db.String(50), db.ForeignKey('nurses.id'), nullable=False)
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)
    reason = db.Column(db.Text)
    makeup_attempted = db.Column(db.Boolean, default=False)
    makeup_approved = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'medication_plan_id': self.medication_plan_id,
            'request_id': self.request_id,
            'registered_by': self.registered_by,
            'registered_at': self.registered_at.isoformat() if self.registered_at else None,
            'reason': self.reason,
            'makeup_attempted': self.makeup_attempted,
            'makeup_approved': self.makeup_approved
        }


class MakeupApproval(db.Model):
    __tablename__ = 'makeup_approvals'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    medication_plan_id = db.Column(db.String(50), db.ForeignKey('medication_plans.id'), nullable=False)
    request_id = db.Column(db.String(100), nullable=False, unique=True)
    requested_by = db.Column(db.String(50), db.ForeignKey('nurses.id'))
    approved_by = db.Column(db.String(50), db.ForeignKey('nurses.id'))
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime)
    status = db.Column(db.String(50))
    reason = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'medication_plan_id': self.medication_plan_id,
            'request_id': self.request_id,
            'requested_by': self.requested_by,
            'approved_by': self.approved_by,
            'requested_at': self.requested_at.isoformat() if self.requested_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'status': self.status,
            'reason': self.reason
        }


class MedicationInventory(db.Model):
    __tablename__ = 'medication_inventory'
    
    id = db.Column(db.String(50), primary_key=True)
    medication_name = db.Column(db.String(200), nullable=False)
    batch_number = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=0)
    unit = db.Column(db.String(50))
    expiry_date = db.Column(db.Date)
    location = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    deductions = db.relationship('InventoryDeduction', backref='inventory', lazy=True,
                                 order_by='InventoryDeduction.created_at.desc()')
    
    def to_dict(self, include_history=False):
        result = {
            'id': self.id,
            'medication_name': self.medication_name,
            'batch_number': self.batch_number,
            'quantity': self.quantity,
            'unit': self.unit,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'location': self.location,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_history:
            result['deductions'] = [d.to_dict() for d in self.deductions]
        return result


class InventoryDeduction(db.Model):
    __tablename__ = 'inventory_deductions'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    request_id = db.Column(db.String(100), nullable=False, unique=True)
    inventory_id = db.Column(db.String(50), db.ForeignKey('medication_inventory.id'), nullable=False)
    medication_plan_id = db.Column(db.String(50), db.ForeignKey('medication_plans.id'))
    quantity = db.Column(db.Integer, nullable=False)
    nurse_id = db.Column(db.String(50), db.ForeignKey('nurses.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reason = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'inventory_id': self.inventory_id,
            'medication_plan_id': self.medication_plan_id,
            'quantity': self.quantity,
            'nurse_id': self.nurse_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'reason': self.reason
        }


class ShiftHandover(db.Model):
    __tablename__ = 'shift_handovers'
    
    id = db.Column(db.String(50), primary_key=True)
    shift_date = db.Column(db.Date, nullable=False)
    shift_type = db.Column(db.String(50), nullable=False)
    outgoing_nurse_id = db.Column(db.String(50), db.ForeignKey('nurses.id'))
    incoming_nurse_id = db.Column(db.String(50), db.ForeignKey('nurses.id'))
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    confirmed_at = db.Column(db.DateTime)
    status = db.Column(SQLAlchemyEnum(ShiftStatus), default=ShiftStatus.PENDING)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    medication_checklist = db.relationship('HandoverChecklist', backref='handover', lazy=True)
    
    outgoing_nurse = db.relationship('Nurse', foreign_keys=[outgoing_nurse_id])
    incoming_nurse = db.relationship('Nurse', foreign_keys=[incoming_nurse_id])
    
    def to_dict(self, include_checklist=False):
        result = {
            'id': self.id,
            'shift_date': self.shift_date.isoformat() if self.shift_date else None,
            'shift_type': self.shift_type,
            'outgoing_nurse_id': self.outgoing_nurse_id,
            'outgoing_nurse_name': self.outgoing_nurse.name if self.outgoing_nurse else None,
            'incoming_nurse_id': self.incoming_nurse_id,
            'incoming_nurse_name': self.incoming_nurse.name if self.incoming_nurse else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'status': self.status.value if self.status else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_checklist:
            result['checklist'] = [c.to_dict() for c in self.medication_checklist]
        return result


class HandoverChecklist(db.Model):
    __tablename__ = 'handover_checklist'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    handover_id = db.Column(db.String(50), db.ForeignKey('shift_handovers.id'), nullable=False)
    medication_plan_id = db.Column(db.String(50), db.ForeignKey('medication_plans.id'), nullable=False)
    resident_name = db.Column(db.String(100))
    medication_name = db.Column(db.String(200))
    dose_time = db.Column(db.String(50))
    planned_status = db.Column(db.String(50))
    actual_status = db.Column(db.String(50))
    checked = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'handover_id': self.handover_id,
            'medication_plan_id': self.medication_plan_id,
            'resident_name': self.resident_name,
            'medication_name': self.medication_name,
            'dose_time': self.dose_time,
            'planned_status': self.planned_status,
            'actual_status': self.actual_status,
            'checked': self.checked,
            'notes': self.notes
        }


class ExceptionRecord(db.Model):
    __tablename__ = 'exception_records'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    request_id = db.Column(db.String(100), unique=True)
    exception_type = db.Column(SQLAlchemyEnum(ExceptionType), nullable=False)
    status = db.Column(SQLAlchemyEnum(ExceptionStatus), default=ExceptionStatus.OPEN)
    resident_id = db.Column(db.String(50))
    resident_name = db.Column(db.String(100))
    medication_plan_id = db.Column(db.String(50))
    medication_name = db.Column(db.String(200))
    nurse_id = db.Column(db.String(50))
    nurse_name = db.Column(db.String(100))
    description = db.Column(db.Text, nullable=False)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.String(50))
    resolution_notes = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'exception_type': self.exception_type.value if self.exception_type else None,
            'status': self.status.value if self.status else None,
            'resident_id': self.resident_id,
            'resident_name': self.resident_name,
            'medication_plan_id': self.medication_plan_id,
            'medication_name': self.medication_name,
            'nurse_id': self.nurse_id,
            'nurse_name': self.nurse_name,
            'description': self.description,
            'details': self.details,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_by': self.resolved_by,
            'resolution_notes': self.resolution_notes
        }


class ManualCorrection(db.Model):
    __tablename__ = 'manual_corrections'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    request_id = db.Column(db.String(100), nullable=False, unique=True)
    corrected_by = db.Column(db.String(50), nullable=False)
    corrected_by_name = db.Column(db.String(100))
    corrected_at = db.Column(db.DateTime, default=datetime.utcnow)
    target_model = db.Column(db.String(100), nullable=False)
    target_id = db.Column(db.String(100), nullable=False)
    field_name = db.Column(db.String(100))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    reason = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'corrected_by': self.corrected_by,
            'corrected_by_name': self.corrected_by_name,
            'corrected_at': self.corrected_at.isoformat() if self.corrected_at else None,
            'target_model': self.target_model,
            'target_id': self.target_id,
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'reason': self.reason
        }
