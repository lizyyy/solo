from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
import shutil

from .config import RECORD_STATUS, PLAYBACK_SOURCE, OPERATOR_LAOCEN, OPERATOR_ENGINEER, PHOTO_DIR
from .models import (
    SensorRecord, SensorRecordCreate, SensorRecordDetail, RecordImportResult,
    ManualCorrection, ManualCorrectionCreate,
    WorkPhoto, WorkPhotoCreate,
    PlaybackRun, PlaybackRunCreate,
)
from . import database


def calculate_momentum(
    car_mass_kg: float,
    velocity_ms: float,
    friction_coeff: float,
    collision_efficiency: float,
) -> Tuple[float, float, float]:
    raw_momentum = car_mass_kg * velocity_ms
    corrected_momentum = raw_momentum * collision_efficiency * (1 - friction_coeff)
    energy_loss = raw_momentum - corrected_momentum
    return raw_momentum, corrected_momentum, energy_loss


async def import_sensor_record(record_data: SensorRecordCreate) -> RecordImportResult:
    existing = await database.get_sensor_record_by_sensor_no(record_data.sensor_no)
    if existing:
        return RecordImportResult(
            record_id=existing.id,
            sensor_no=existing.sensor_no,
            status=existing.status,
            has_pending_correction=await database.has_pending_correction(existing.id),
            message=f"传感器 {existing.sensor_no} 已存在",
        )

    record = await database.create_sensor_record(record_data)

    raw_momentum, corrected_momentum, energy_loss = calculate_momentum(
        record.car_mass_kg,
        record.velocity_ms,
        record.friction_coeff,
        record.collision_efficiency,
    )

    await database.update_sensor_record_corrected_momentum(
        record.id, corrected_momentum, has_manual_correction=False
    )

    playback_create = PlaybackRunCreate(
        record_id=record.id,
        parameters_used={
            "car_mass_kg": record.car_mass_kg,
            "velocity_ms": record.velocity_ms,
            "friction_coeff": record.friction_coeff,
            "collision_efficiency": record.collision_efficiency,
        },
        source=PLAYBACK_SOURCE["ORIGINAL"],
        run_by="系统自动",
    )
    await database.create_playback_run(playback_create, corrected_momentum, energy_loss)

    return RecordImportResult(
        record_id=record.id,
        sensor_no=record.sensor_no,
        status=RECORD_STATUS["NORMAL"],
        has_pending_correction=False,
        message=f"传感器 {record.sensor_no} 导入成功，已完成初始回放计算",
    )


async def apply_manual_correction(
    record_id: int,
    field_name: str,
    new_value: float,
    operator: str,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    record = await database.get_sensor_record(record_id)
    if not record:
        return {"success": False, "message": f"记录 {record_id} 不存在"}

    valid_fields = ["friction_coeff", "collision_efficiency", "car_mass_kg", "velocity_ms"]
    if field_name not in valid_fields:
        return {"success": False, "message": f"字段 {field_name} 不允许修改"}

    old_value = getattr(record, field_name)

    correction_create = ManualCorrectionCreate(
        record_id=record_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        operator=operator,
        reason=reason,
    )
    correction = await database.create_manual_correction(correction_create)

    await database.update_sensor_record_field(record_id, field_name, new_value)

    updated_record = await database.get_sensor_record(record_id)
    raw_momentum, corrected_momentum, energy_loss = calculate_momentum(
        updated_record.car_mass_kg,
        updated_record.velocity_ms,
        updated_record.friction_coeff,
        updated_record.collision_efficiency,
    )

    await database.update_sensor_record_corrected_momentum(
        record_id, corrected_momentum, has_manual_correction=True
    )

    if reason is None:
        await database.update_sensor_record_status(record_id, RECORD_STATUS["PENDING_REVIEW"])
        status_msg = "已标记为待复核（未填写修正原因）"
    else:
        status_msg = "修正已应用，原因已记录"

    playback_create = PlaybackRunCreate(
        record_id=record_id,
        parameters_used={
            "car_mass_kg": updated_record.car_mass_kg,
            "velocity_ms": updated_record.velocity_ms,
            "friction_coeff": updated_record.friction_coeff,
            "collision_efficiency": updated_record.collision_efficiency,
        },
        source=PLAYBACK_SOURCE["MANUAL_CORRECTION"],
        run_by=operator,
    )
    await database.create_playback_run(playback_create, corrected_momentum, energy_loss)

    return {
        "success": True,
        "message": status_msg,
        "correction_id": correction.id,
        "new_corrected_momentum": round(corrected_momentum, 4),
        "status": RECORD_STATUS["PENDING_REVIEW"] if reason is None else record.status,
    }


async def upload_work_photo(
    record_id: int,
    source_file_path: str,
    note: Optional[str] = None,
    extracted_friction_coeff: Optional[float] = None,
    uploader: str = OPERATOR_LAOCEN,
) -> Dict[str, Any]:
    record = await database.get_sensor_record(record_id)
    if not record:
        return {"success": False, "message": f"记录 {record_id} 不存在"}

    source_path = Path(source_file_path)
    if not source_path.exists():
        return {"success": False, "message": f"文件 {source_file_path} 不存在"}

    timestamp = int(datetime.now().timestamp())
    dest_filename = f"{record.sensor_no}_{timestamp}{source_path.suffix}"
    dest_path = PHOTO_DIR / dest_filename

    shutil.copy2(source_path, dest_path)

    photo_create = WorkPhotoCreate(
        record_id=record_id,
        photo_filename=dest_filename,
        note=note,
        extracted_friction_coeff=extracted_friction_coeff,
        uploader=uploader,
    )
    photo = await database.create_work_photo(photo_create)

    if extracted_friction_coeff is not None:
        await database.update_sensor_record_field(
            record_id, "friction_coeff", extracted_friction_coeff
        )

        updated_record = await database.get_sensor_record(record_id)
        raw_momentum, corrected_momentum, energy_loss = calculate_momentum(
            updated_record.car_mass_kg,
            updated_record.velocity_ms,
            updated_record.friction_coeff,
            updated_record.collision_efficiency,
        )

        await database.update_sensor_record_corrected_momentum(
            record_id, corrected_momentum, has_manual_correction=False
        )

        playback_create = PlaybackRunCreate(
            record_id=record_id,
            parameters_used={
                "car_mass_kg": updated_record.car_mass_kg,
                "velocity_ms": updated_record.velocity_ms,
                "friction_coeff": updated_record.friction_coeff,
                "collision_efficiency": updated_record.collision_efficiency,
                "source": "从工况照片提取的旧口径",
            },
            source=PLAYBACK_SOURCE["PHOTO_SUPPLEMENT"],
            run_by=uploader,
        )
        await database.create_playback_run(playback_create, corrected_momentum, energy_loss)

        return {
            "success": True,
            "message": "照片上传成功，已根据照片中的旧口径更新摩擦系数并重放",
            "photo_id": photo.id,
            "new_corrected_momentum": round(corrected_momentum, 4),
            "playback_updated": True,
        }

    return {
        "success": True,
        "message": "照片上传成功",
        "photo_id": photo.id,
        "playback_updated": False,
    }


async def run_playback(record_id: int, run_by: str) -> Dict[str, Any]:
    record = await database.get_sensor_record(record_id)
    if not record:
        return {"success": False, "message": f"记录 {record_id} 不存在"}

    raw_momentum, corrected_momentum, energy_loss = calculate_momentum(
        record.car_mass_kg,
        record.velocity_ms,
        record.friction_coeff,
        record.collision_efficiency,
    )

    source = PLAYBACK_SOURCE["ORIGINAL"]
    if record.has_manual_correction:
        source = PLAYBACK_SOURCE["MANUAL_CORRECTION"]

    playback_create = PlaybackRunCreate(
        record_id=record_id,
        parameters_used={
            "car_mass_kg": record.car_mass_kg,
            "velocity_ms": record.velocity_ms,
            "friction_coeff": record.friction_coeff,
            "collision_efficiency": record.collision_efficiency,
        },
        source=source,
        run_by=run_by,
    )
    playback = await database.create_playback_run(playback_create, corrected_momentum, energy_loss)

    await database.update_sensor_record_corrected_momentum(
        record_id, corrected_momentum, record.has_manual_correction
    )

    return {
        "success": True,
        "message": "回放计算完成",
        "playback_id": playback.id,
        "raw_momentum": round(raw_momentum, 4),
        "corrected_momentum": round(corrected_momentum, 4),
        "energy_loss": round(energy_loss, 4),
        "source": source,
    }


async def review_record(record_id: int, reviewer: str = OPERATOR_ENGINEER) -> Dict[str, Any]:
    record = await database.get_sensor_record(record_id)
    if not record:
        return {"success": False, "message": f"记录 {record_id} 不存在"}

    if record.status != RECORD_STATUS["PENDING_REVIEW"]:
        return {
            "success": False,
            "message": f"记录状态为 {record.status}，无需复核",
            "current_status": record.status,
        }

    await database.update_sensor_record_status(record_id, RECORD_STATUS["REVIEWED"])

    return {
        "success": True,
        "message": f"设备工程师 {reviewer} 已复核通过",
        "new_status": RECORD_STATUS["REVIEWED"],
    }


async def get_record_detail(record_id: int) -> Optional[SensorRecordDetail]:
    return await database.get_sensor_record_detail(record_id)


async def get_all_records() -> list[SensorRecord]:
    return await database.get_all_sensor_records()


async def get_all_record_details() -> list[SensorRecordDetail]:
    return await database.get_all_sensor_record_details()


def format_record_for_display(record: SensorRecordDetail) -> str:
    status_labels = {
        RECORD_STATUS["NORMAL"]: "✓ 正常",
        RECORD_STATUS["PENDING_REVIEW"]: "⚠ 待复核",
        RECORD_STATUS["REVIEWED"]: "✓ 已复核",
    }

    lines = [
        f"{'='*60}",
        f"传感器编号: {record.sensor_no}",
        f"碰撞时间: {record.collision_time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"状态: {status_labels.get(record.status, record.status)}",
        f"{'='*60}",
        f"  小车质量: {record.car_mass_kg} kg",
        f"  碰撞速度: {record.velocity_ms} m/s",
        f"  摩擦系数: {record.friction_coeff}",
        f"  碰撞效率: {record.collision_efficiency}",
        f"{'─'*60}",
        f"  原始动量: {record.raw_momentum:.4f} kg·m/s",
        f"  修正动量: {record.corrected_momentum:.4f} kg·m/s" if record.corrected_momentum else "  修正动量: 未计算",
        f"  有人工修正: {'是' if record.has_manual_correction else '否'}",
    ]

    if record.corrections:
        lines.append(f"{'─'*60}")
        lines.append(f"  人工修正记录 ({len(record.corrections)} 条):")
        for corr in record.corrections:
            reason_str = corr.reason if corr.reason else "⚠ 未填写原因"
            lines.append(
                f"    [{corr.created_at.strftime('%H:%M:%S')}] {corr.operator} 修改 {corr.field_name}: "
                f"{corr.old_value} → {corr.new_value} ({reason_str})"
            )

    if record.photos:
        lines.append(f"{'─'*60}")
        lines.append(f"  工况照片 ({len(record.photos)} 张):")
        for photo in record.photos:
            extra = ""
            if photo.extracted_friction_coeff is not None:
                extra = f" [提取摩擦系数: {photo.extracted_friction_coeff}]"
            lines.append(
                f"    [{photo.uploaded_at.strftime('%H:%M:%S')}] {photo.uploader} 上传 {photo.photo_filename}"
                f"{extra} - {photo.note if photo.note else '无备注'}"
            )

    if record.playbacks:
        lines.append(f"{'─'*60}")
        lines.append(f"  回放记录 ({len(record.playbacks)} 次):")
        source_labels = {
            PLAYBACK_SOURCE["ORIGINAL"]: "原始数据",
            PLAYBACK_SOURCE["MANUAL_CORRECTION"]: "人工修正",
            PLAYBACK_SOURCE["PHOTO_SUPPLEMENT"]: "照片补充",
        }
        for pb in record.playbacks:
            src_label = source_labels.get(pb.source, pb.source)
            lines.append(
                f"    [{pb.run_time.strftime('%H:%M:%S')}] {pb.run_by} ({src_label}): "
                f"动量={pb.result_momentum:.4f} kg·m/s, 能量损失={pb.result_energy_loss:.4f}"
            )

    if record.notes:
        lines.append(f"{'─'*60}")
        lines.append(f"  备注: {record.notes}")

    lines.append(f"{'='*60}")
    return "\n".join(lines)


async def get_pending_review_records() -> list[SensorRecordDetail]:
    all_details = await database.get_all_sensor_record_details()
    return [r for r in all_details if r.status == RECORD_STATUS["PENDING_REVIEW"]]
