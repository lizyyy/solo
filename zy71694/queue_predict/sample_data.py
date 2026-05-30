from __future__ import annotations

from datetime import date, time, datetime, timedelta
from typing import Dict, Any, List

from .models import (
    Registration,
    DoctorSchedule,
    SkipRecord,
    AddOnRequest,
    ClinicRoom,
    PipelineContext,
    AnomalyType,
)


def create_sample_data() -> PipelineContext:
    clinic_date = date(2026, 5, 30)

    schedules = [
        DoctorSchedule(
            doctor_id="D001",
            doctor_name="张医生",
            dept="内科",
            clinic_date=clinic_date,
            shift="morning",
            start_time=time(8, 0),
            end_time=time(12, 0),
            room_id="R001",
            avg_consult_minutes=10.0,
            max_addon_slots=5,
        ),
        DoctorSchedule(
            doctor_id="D002",
            doctor_name="李医生",
            dept="内科",
            clinic_date=clinic_date,
            shift="morning",
            start_time=time(8, 0),
            end_time=time(12, 0),
            room_id="R001",
            avg_consult_minutes=12.0,
            max_addon_slots=3,
        ),
        DoctorSchedule(
            doctor_id="D003",
            doctor_name="王医生",
            dept="外科",
            clinic_date=clinic_date,
            shift="morning",
            start_time=time(8, 30),
            end_time=time(11, 30),
            room_id="R002",
            avg_consult_minutes=15.0,
            is_suspended=True,
        ),
    ]

    regs = [
        Registration(
            reg_id="REG001", patient_name="患者A", patient_id="P001",
            doctor_id="D001", doctor_name="张医生", dept="内科",
            clinic_date=clinic_date, queue_number=1,
            reg_time=datetime(2026, 5, 30, 7, 50),
            status=AnomalyType.NONE and Registration.__dataclass_fields__["status"].default,
        ),
        Registration(
            reg_id="REG002", patient_name="患者B", patient_id="P002",
            doctor_id="D001", doctor_name="张医生", dept="内科",
            clinic_date=clinic_date, queue_number=2,
            reg_time=datetime(2026, 5, 30, 7, 55),
        ),
        Registration(
            reg_id="REG003", patient_name="患者C", patient_id="P003",
            doctor_id="D001", doctor_name="张医生", dept="内科",
            clinic_date=clinic_date, queue_number=3,
            reg_time=datetime(2026, 5, 30, 8, 0),
        ),
        Registration(
            reg_id="REG004", patient_name="患者D", patient_id="P004",
            doctor_id="D002", doctor_name="李医生", dept="内科",
            clinic_date=clinic_date, queue_number=1,
            reg_time=datetime(2026, 5, 30, 7, 50),
        ),
        Registration(
            reg_id="REG005", patient_name="患者E", patient_id="P005",
            doctor_id="D003", doctor_name="王医生", dept="外科",
            clinic_date=clinic_date, queue_number=1,
            reg_time=datetime(2026, 5, 30, 8, 20),
        ),
        Registration(
            reg_id="REG006", patient_name="患者F", patient_id="P006",
            doctor_id="D003", doctor_name="王医生", dept="外科",
            clinic_date=clinic_date, queue_number=2,
            reg_time=datetime(2026, 5, 30, 8, 25),
        ),
        Registration(
            reg_id="REG007", patient_name="患者G", patient_id="P007",
            doctor_id="D001", doctor_name="张医生", dept="内科",
            clinic_date=clinic_date, queue_number=5,
            is_addon=True,
            reg_time=datetime(2026, 5, 30, 8, 30),
        ),
        Registration(
            reg_id="REG008", patient_name="患者H", patient_id="P008",
            doctor_id="D004", doctor_name="赵医生", dept="骨科",
            clinic_date=clinic_date, queue_number=1,
            reg_time=datetime(2026, 5, 30, 8, 0),
        ),
    ]

    from .models import RecordStatus
    for r in regs:
        r.status = RecordStatus.RECEIVED

    skips = [
        SkipRecord(
            skip_id="SKIP001",
            reg_id="REG002",
            doctor_id="D001",
            clinic_date=clinic_date,
            skip_time=datetime(2026, 5, 30, 8, 5),
            skip_count=1,
        ),
        SkipRecord(
            skip_id="SKIP002",
            reg_id="REG002",
            doctor_id="D001",
            clinic_date=clinic_date,
            skip_time=datetime(2026, 5, 30, 8, 7),
            is_duplicate=True,
            skip_count=2,
        ),
        SkipRecord(
            skip_id="SKIP003",
            reg_id="REG003",
            doctor_id="D001",
            clinic_date=clinic_date,
            skip_time=datetime(2026, 5, 30, 8, 15),
            skip_count=1,
        ),
    ]

    addons = [
        AddOnRequest(
            request_id="ADDON001",
            reg_id="REG007",
            doctor_id="D001",
            patient_name="患者G",
            clinic_date=clinic_date,
            request_time=datetime(2026, 5, 30, 8, 30),
            approved=True,
            priority=1,
            insert_position=1,
            is_queue_jump=True,
        ),
    ]

    rooms = [
        ClinicRoom(room_id="R001", room_name="诊室1", dept="内科", is_available=True, current_doctor_id="D001"),
        ClinicRoom(room_id="R002", room_name="诊室2", dept="外科", is_available=True, current_doctor_id="D003"),
    ]

    return PipelineContext(
        registrations=regs,
        schedules=schedules,
        skips=skips,
        addons=addons,
        rooms=rooms,
    )
