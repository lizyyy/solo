from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Text, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
import enum

from .database import Base


class RiskType(enum.Enum):
    MISSED_MEDICATION = "missed_medication"
    UNCONFIRMED_NOTE = "unconfirmed_note"
    MIXED_CAGE = "mixed_cage"
    NIGHT_ABNORMAL_CALL = "night_abnormal_call"


class RiskStatus(enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class FileStatus(enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"
    ARCHIVED = "archived"


class Pet(Base):
    __tablename__ = 'pets'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    species = Column(String(50), default="dog")
    breed = Column(String(100), nullable=True)
    owner_name = Column(String(100), nullable=True)
    owner_phone = Column(String(50), nullable=True)
    cage_number = Column(String(20), nullable=True)
    check_in_date = Column(Date, default=date.today)
    check_out_date = Column(Date, nullable=True)
    medication_schedule = Column(Text, nullable=True)
    special_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    medication_records = relationship("MedicationRecord", back_populates="pet")
    notes = relationship("Note", back_populates="pet")
    camera_images = relationship("CameraImage", back_populates="pet")
    abnormal_calls = relationship("AbnormalCall", back_populates="pet")
    risks = relationship("Risk", back_populates="pet")
    confirmations = relationship("Confirmation", back_populates="pet")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'species': self.species,
            'breed': self.breed,
            'owner_name': self.owner_name,
            'owner_phone': self.owner_phone,
            'cage_number': self.cage_number,
            'check_in_date': str(self.check_in_date) if self.check_in_date else None,
            'check_out_date': str(self.check_out_date) if self.check_out_date else None,
            'medication_schedule': self.medication_schedule,
            'special_notes': self.special_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class MedicationRecord(Base):
    __tablename__ = 'medication_records'

    id = Column(Integer, primary_key=True, autoincrement=True)
    pet_id = Column(Integer, ForeignKey('pets.id'), nullable=False, index=True)
    medication_name = Column(String(100), nullable=False)
    dosage = Column(String(50), nullable=True)
    scheduled_time = Column(DateTime, nullable=False, index=True)
    administered_time = Column(DateTime, nullable=True)
    administered_by = Column(String(100), nullable=True)
    is_administered = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    source_file = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pet = relationship("Pet", back_populates="medication_records")
    risks = relationship("Risk", back_populates="medication_record")

    def to_dict(self):
        return {
            'id': self.id,
            'pet_id': self.pet_id,
            'medication_name': self.medication_name,
            'dosage': self.dosage,
            'scheduled_time': self.scheduled_time.isoformat() if self.scheduled_time else None,
            'administered_time': self.administered_time.isoformat() if self.administered_time else None,
            'administered_by': self.administered_by,
            'is_administered': self.is_administered,
            'notes': self.notes,
            'source_file': self.source_file,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Note(Base):
    __tablename__ = 'notes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    pet_id = Column(Integer, ForeignKey('pets.id'), nullable=False, index=True)
    note_type = Column(String(50), default="owner_note")
    content = Column(Text, nullable=False)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    is_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    source_file = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pet = relationship("Pet", back_populates="notes")
    risks = relationship("Risk", back_populates="note")

    def to_dict(self):
        return {
            'id': self.id,
            'pet_id': self.pet_id,
            'note_type': self.note_type,
            'content': self.content,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_confirmed': self.is_confirmed,
            'confirmed_by': self.confirmed_by,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'source_file': self.source_file
        }


class CameraImage(Base):
    __tablename__ = 'camera_images'

    id = Column(Integer, primary_key=True, autoincrement=True)
    pet_id = Column(Integer, ForeignKey('pets.id'), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    original_path = Column(String(500), nullable=False)
    archive_path = Column(String(500), nullable=True)
    capture_time = Column(DateTime, nullable=False, index=True)
    camera_location = Column(String(100), nullable=True)
    detected_pets = Column(Text, nullable=True)
    has_other_pets = Column(Boolean, default=False)
    is_analyzed = Column(Boolean, default=False)
    analysis_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pet = relationship("Pet", back_populates="camera_images")
    risks = relationship("Risk", back_populates="camera_image")

    def to_dict(self):
        return {
            'id': self.id,
            'pet_id': self.pet_id,
            'file_name': self.file_name,
            'original_path': self.original_path,
            'archive_path': self.archive_path,
            'capture_time': self.capture_time.isoformat() if self.capture_time else None,
            'camera_location': self.camera_location,
            'detected_pets': self.detected_pets,
            'has_other_pets': self.has_other_pets,
            'is_analyzed': self.is_analyzed,
            'analysis_notes': self.analysis_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AbnormalCall(Base):
    __tablename__ = 'abnormal_calls'

    id = Column(Integer, primary_key=True, autoincrement=True)
    pet_id = Column(Integer, ForeignKey('pets.id'), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    original_path = Column(String(500), nullable=False)
    archive_path = Column(String(500), nullable=True)
    call_time = Column(DateTime, nullable=False, index=True)
    call_type = Column(String(50), nullable=True)
    transcription = Column(Text, nullable=True)
    duration_seconds = Column(Float, default=0)
    is_night_time = Column(Boolean, default=False)
    is_analyzed = Column(Boolean, default=False)
    analysis_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pet = relationship("Pet", back_populates="abnormal_calls")
    risks = relationship("Risk", back_populates="abnormal_call")

    def to_dict(self):
        return {
            'id': self.id,
            'pet_id': self.pet_id,
            'file_name': self.file_name,
            'original_path': self.original_path,
            'archive_path': self.archive_path,
            'call_time': self.call_time.isoformat() if self.call_time else None,
            'call_type': self.call_type,
            'transcription': self.transcription,
            'duration_seconds': self.duration_seconds,
            'is_night_time': self.is_night_time,
            'is_analyzed': self.is_analyzed,
            'analysis_notes': self.analysis_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Risk(Base):
    __tablename__ = 'risks'

    id = Column(Integer, primary_key=True, autoincrement=True)
    pet_id = Column(Integer, ForeignKey('pets.id'), nullable=False, index=True)
    risk_type = Column(Enum(RiskType), nullable=False, index=True)
    status = Column(Enum(RiskStatus), default=RiskStatus.PENDING, index=True)
    severity = Column(Integer, default=1)
    description = Column(Text, nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    medication_record_id = Column(Integer, ForeignKey('medication_records.id'), nullable=True)
    note_id = Column(Integer, ForeignKey('notes.id'), nullable=True)
    camera_image_id = Column(Integer, ForeignKey('camera_images.id'), nullable=True)
    abnormal_call_id = Column(Integer, ForeignKey('abnormal_calls.id'), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pet = relationship("Pet", back_populates="risks")
    medication_record = relationship("MedicationRecord", back_populates="risks")
    note = relationship("Note", back_populates="risks")
    camera_image = relationship("CameraImage", back_populates="risks")
    abnormal_call = relationship("AbnormalCall", back_populates="risks")
    confirmations = relationship("Confirmation", back_populates="risk")

    def to_dict(self):
        return {
            'id': self.id,
            'pet_id': self.pet_id,
            'risk_type': self.risk_type.value if self.risk_type else None,
            'status': self.status.value if self.status else None,
            'severity': self.severity,
            'description': self.description,
            'detected_at': self.detected_at.isoformat() if self.detected_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_by': self.resolved_by,
            'resolution_notes': self.resolution_notes,
            'medication_record_id': self.medication_record_id,
            'note_id': self.note_id,
            'camera_image_id': self.camera_image_id,
            'abnormal_call_id': self.abnormal_call_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Confirmation(Base):
    __tablename__ = 'confirmations'

    id = Column(Integer, primary_key=True, autoincrement=True)
    pet_id = Column(Integer, ForeignKey('pets.id'), nullable=False, index=True)
    risk_id = Column(Integer, ForeignKey('risks.id'), nullable=True, index=True)
    confirmation_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=True)
    confirmed_by = Column(String(100), nullable=False)
    confirmed_at = Column(DateTime, default=datetime.utcnow, index=True)
    source_file = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pet = relationship("Pet", back_populates="confirmations")
    risk = relationship("Risk", back_populates="confirmations")

    def to_dict(self):
        return {
            'id': self.id,
            'pet_id': self.pet_id,
            'risk_id': self.risk_id,
            'confirmation_type': self.confirmation_type,
            'content': self.content,
            'confirmed_by': self.confirmed_by,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'source_file': self.source_file,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ProcessedFile(Base):
    __tablename__ = 'processed_files'

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_name = Column(String(255), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=True)
    file_size = Column(Integer, default=0)
    file_hash = Column(String(64), nullable=True, index=True)
    status = Column(Enum(FileStatus), default=FileStatus.PENDING, index=True)
    process_started_at = Column(DateTime, nullable=True)
    process_completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    related_pet_ids = Column(Text, nullable=True)
    archive_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'file_hash': self.file_hash,
            'status': self.status.value if self.status else None,
            'process_started_at': self.process_started_at.isoformat() if self.process_started_at else None,
            'process_completed_at': self.process_completed_at.isoformat() if self.process_completed_at else None,
            'error_message': self.error_message,
            'related_pet_ids': self.related_pet_ids,
            'archive_path': self.archive_path,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
