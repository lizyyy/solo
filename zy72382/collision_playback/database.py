import aiosqlite
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from .config import DB_PATH, RECORD_STATUS, PLAYBACK_SOURCE
from .models import (
    SensorRecord, SensorRecordCreate, SensorRecordDetail,
    ManualCorrection, ManualCorrectionCreate,
    WorkPhoto, WorkPhotoCreate,
    PlaybackRun, PlaybackRunCreate,
    RecordImportResult,
)


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sensor_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sensor_no TEXT NOT NULL UNIQUE,
                collision_time TEXT NOT NULL,
                car_mass_kg REAL NOT NULL,
                velocity_ms REAL NOT NULL,
                friction_coeff REAL NOT NULL,
                collision_efficiency REAL NOT NULL,
                raw_momentum REAL NOT NULL,
                corrected_momentum REAL,
                status TEXT NOT NULL DEFAULT 'normal',
                has_manual_correction INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS manual_corrections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                field_name TEXT NOT NULL,
                old_value REAL NOT NULL,
                new_value REAL NOT NULL,
                operator TEXT NOT NULL,
                reason TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (record_id) REFERENCES sensor_records (id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS work_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                photo_filename TEXT NOT NULL,
                note TEXT,
                extracted_friction_coeff REAL,
                uploader TEXT NOT NULL,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY (record_id) REFERENCES sensor_records (id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS playback_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                parameters_used TEXT NOT NULL,
                source TEXT NOT NULL,
                result_momentum REAL NOT NULL,
                result_energy_loss REAL NOT NULL,
                run_by TEXT NOT NULL,
                run_time TEXT NOT NULL,
                FOREIGN KEY (record_id) REFERENCES sensor_records (id)
            )
        """)

        await db.commit()


def _row_to_sensor_record(row: tuple) -> SensorRecord:
    return SensorRecord(
        id=row[0],
        sensor_no=row[1],
        collision_time=datetime.fromisoformat(row[2]),
        car_mass_kg=row[3],
        velocity_ms=row[4],
        friction_coeff=row[5],
        collision_efficiency=row[6],
        raw_momentum=row[7],
        corrected_momentum=row[8],
        status=row[9],
        has_manual_correction=bool(row[10]),
        notes=row[11],
        created_at=datetime.fromisoformat(row[12]),
        updated_at=datetime.fromisoformat(row[13]),
    )


def _row_to_manual_correction(row: tuple) -> ManualCorrection:
    return ManualCorrection(
        id=row[0],
        record_id=row[1],
        field_name=row[2],
        old_value=row[3],
        new_value=row[4],
        operator=row[5],
        reason=row[6],
        created_at=datetime.fromisoformat(row[7]),
    )


def _row_to_work_photo(row: tuple) -> WorkPhoto:
    return WorkPhoto(
        id=row[0],
        record_id=row[1],
        photo_filename=row[2],
        note=row[3],
        extracted_friction_coeff=row[4],
        uploader=row[5],
        uploaded_at=datetime.fromisoformat(row[6]),
    )


def _row_to_playback_run(row: tuple) -> PlaybackRun:
    return PlaybackRun(
        id=row[0],
        record_id=row[1],
        parameters_used=json.loads(row[2]),
        source=row[3],
        result_momentum=row[4],
        result_energy_loss=row[5],
        run_by=row[6],
        run_time=datetime.fromisoformat(row[7]),
    )


async def create_sensor_record(record: SensorRecordCreate) -> SensorRecord:
    now = datetime.now().isoformat()
    raw_momentum = record.car_mass_kg * record.velocity_ms
    status = RECORD_STATUS["NORMAL"]

    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """INSERT INTO sensor_records
               (sensor_no, collision_time, car_mass_kg, velocity_ms,
                friction_coeff, collision_efficiency, raw_momentum,
                status, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                record.sensor_no,
                record.collision_time.isoformat(),
                record.car_mass_kg,
                record.velocity_ms,
                record.friction_coeff,
                record.collision_efficiency,
                raw_momentum,
                status,
                record.notes,
                now,
                now,
            ),
        )
        await db.commit()
        record_id = cursor.lastrowid

        cursor = await db.execute(
            "SELECT * FROM sensor_records WHERE id = ?",
            (record_id,),
        )
        row = await cursor.fetchone()
        return _row_to_sensor_record(row)


async def get_sensor_record(record_id: int) -> Optional[SensorRecord]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM sensor_records WHERE id = ?",
            (record_id,),
        )
        row = await cursor.fetchone()
        return _row_to_sensor_record(row) if row else None


async def get_sensor_record_by_sensor_no(sensor_no: str) -> Optional[SensorRecord]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM sensor_records WHERE sensor_no = ?",
            (sensor_no,),
        )
        row = await cursor.fetchone()
        return _row_to_sensor_record(row) if row else None


async def get_all_sensor_records() -> List[SensorRecord]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM sensor_records ORDER BY collision_time DESC"
        )
        rows = await cursor.fetchall()
        return [_row_to_sensor_record(row) for row in rows]


async def update_sensor_record_status(record_id: int, status: str) -> None:
    now = datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE sensor_records SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, record_id),
        )
        await db.commit()


async def update_sensor_record_corrected_momentum(
    record_id: int, corrected_momentum: float, has_manual_correction: bool
) -> None:
    now = datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """UPDATE sensor_records
               SET corrected_momentum = ?, has_manual_correction = ?, updated_at = ?
               WHERE id = ?""",
            (corrected_momentum, 1 if has_manual_correction else 0, now, record_id),
        )
        await db.commit()


async def update_sensor_record_field(record_id: int, field_name: str, value: float) -> None:
    now = datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE sensor_records SET {field_name} = ?, updated_at = ? WHERE id = ?",
            (value, now, record_id),
        )
        await db.commit()


async def create_manual_correction(correction: ManualCorrectionCreate) -> ManualCorrection:
    now = datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """INSERT INTO manual_corrections
               (record_id, field_name, old_value, new_value, operator, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                correction.record_id,
                correction.field_name,
                correction.old_value,
                correction.new_value,
                correction.operator,
                correction.reason,
                now,
            ),
        )
        await db.commit()
        correction_id = cursor.lastrowid

        cursor = await db.execute(
            "SELECT * FROM manual_corrections WHERE id = ?",
            (correction_id,),
        )
        row = await cursor.fetchone()
        return _row_to_manual_correction(row)


async def get_manual_corrections_by_record(record_id: int) -> List[ManualCorrection]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM manual_corrections WHERE record_id = ? ORDER BY created_at DESC",
            (record_id,),
        )
        rows = await cursor.fetchall()
        return [_row_to_manual_correction(row) for row in rows]


async def has_pending_correction(record_id: int) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """SELECT COUNT(*) FROM manual_corrections
               WHERE record_id = ? AND reason IS NULL""",
            (record_id,),
        )
        row = await cursor.fetchone()
        return row[0] > 0


async def create_work_photo(photo: WorkPhotoCreate) -> WorkPhoto:
    now = datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """INSERT INTO work_photos
               (record_id, photo_filename, note, extracted_friction_coeff, uploader, uploaded_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                photo.record_id,
                photo.photo_filename,
                photo.note,
                photo.extracted_friction_coeff,
                photo.uploader,
                now,
            ),
        )
        await db.commit()
        photo_id = cursor.lastrowid

        cursor = await db.execute(
            "SELECT * FROM work_photos WHERE id = ?",
            (photo_id,),
        )
        row = await cursor.fetchone()
        return _row_to_work_photo(row)


async def get_work_photos_by_record(record_id: int) -> List[WorkPhoto]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM work_photos WHERE record_id = ? ORDER BY uploaded_at DESC",
            (record_id,),
        )
        rows = await cursor.fetchall()
        return [_row_to_work_photo(row) for row in rows]


async def create_playback_run(playback: PlaybackRunCreate, result_momentum: float, result_energy_loss: float) -> PlaybackRun:
    now = datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """INSERT INTO playback_runs
               (record_id, parameters_used, source, result_momentum, result_energy_loss, run_by, run_time)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                playback.record_id,
                json.dumps(playback.parameters_used),
                playback.source,
                result_momentum,
                result_energy_loss,
                playback.run_by,
                now,
            ),
        )
        await db.commit()
        playback_id = cursor.lastrowid

        cursor = await db.execute(
            "SELECT * FROM playback_runs WHERE id = ?",
            (playback_id,),
        )
        row = await cursor.fetchone()
        return _row_to_playback_run(row)


async def get_playback_runs_by_record(record_id: int) -> List[PlaybackRun]:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT * FROM playback_runs WHERE record_id = ? ORDER BY run_time DESC",
            (record_id,),
        )
        rows = await cursor.fetchall()
        return [_row_to_playback_run(row) for row in rows]


async def get_sensor_record_detail(record_id: int) -> Optional[SensorRecordDetail]:
    record = await get_sensor_record(record_id)
    if not record:
        return None

    corrections = await get_manual_corrections_by_record(record_id)
    photos = await get_work_photos_by_record(record_id)
    playbacks = await get_playback_runs_by_record(record_id)

    return SensorRecordDetail(
        **record.model_dump(),
        corrections=corrections,
        photos=photos,
        playbacks=playbacks,
    )


async def get_all_sensor_record_details() -> List[SensorRecordDetail]:
    records = await get_all_sensor_records()
    details = []
    for record in records:
        detail = await get_sensor_record_detail(record.id)
        if detail:
            details.append(detail)
    return details


async def clear_all_data() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM playback_runs")
        await db.execute("DELETE FROM work_photos")
        await db.execute("DELETE FROM manual_corrections")
        await db.execute("DELETE FROM sensor_records")
        await db.commit()
