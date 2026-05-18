from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text
from database import Base
import enum


class WaitlistStatus(str, enum.Enum):
    WAITING = "waiting"
    CONFIRMED = "confirmed"
    ADMITTED = "admitted"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class AdmissionType(str, enum.Enum):
    NORMAL_WAITLIST = "normal_waitlist"
    MANUAL_ADMISSION = "manual_admission"
    SPECIAL_ARRANGEMENT = "special_arrangement"


class DataSource(str, enum.Enum):
    SPREADSHEET = "spreadsheet"
    SCREENSHOT = "screenshot"
    VERBAL = "verbal"
    SYSTEM = "system"


class LectureWaitlist(Base):
    __tablename__ = "lecture_waitlist"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lecture_id = Column(String(50), nullable=False, index=True)
    lecture_title = Column(String(200), nullable=False)
    lecture_date = Column(DateTime, nullable=False)
    lecture_venue = Column(String(100), nullable=False)

    reader_id = Column(String(50), nullable=False, index=True)
    reader_name = Column(String(100), nullable=False)
    reader_phone = Column(String(20), nullable=False)
    reader_department = Column(String(100))

    waitlist_number = Column(Integer, nullable=False)
    waitlist_time = Column(DateTime, nullable=False, default=datetime.now)
    status = Column(Enum(WaitlistStatus), nullable=False, default=WaitlistStatus.WAITING)

    admission_type = Column(Enum(AdmissionType))
    admission_time = Column(DateTime)
    admission_operator = Column(String(100))
    admission_remark = Column(Text)

    data_source = Column(Enum(DataSource), nullable=False, default=DataSource.SYSTEM)
    source_note = Column(String(200))

    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "lecture_id": self.lecture_id,
            "lecture_title": self.lecture_title,
            "lecture_date": self.lecture_date.isoformat() if self.lecture_date else None,
            "lecture_venue": self.lecture_venue,
            "reader_id": self.reader_id,
            "reader_name": self.reader_name,
            "reader_phone": self.reader_phone,
            "reader_department": self.reader_department,
            "waitlist_number": self.waitlist_number,
            "waitlist_time": self.waitlist_time.isoformat() if self.waitlist_time else None,
            "status": self.status.value,
            "admission_type": self.admission_type.value if self.admission_type else None,
            "admission_time": self.admission_time.isoformat() if self.admission_time else None,
            "admission_operator": self.admission_operator,
            "admission_remark": self.admission_remark,
            "data_source": self.data_source.value,
            "source_note": self.source_note,
            "version": self.version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
