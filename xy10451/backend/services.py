from datetime import datetime, date, timedelta
from typing import List, Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
import models
import schemas


async def check_resource_availability(
    db: AsyncSession,
    resource_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_reservation_id: Optional[int] = None
) -> bool:
    if start_time >= end_time:
        return False

    stmt = select(models.Reservation).where(
        models.Reservation.resource_id == resource_id,
        models.Reservation.status != "cancelled",
        models.Reservation.start_time < end_time,
        models.Reservation.end_time > start_time
    )

    if exclude_reservation_id is not None:
        stmt = stmt.where(models.Reservation.id != exclude_reservation_id)

    result = await db.execute(stmt)
    conflicts = result.scalars().all()
    return len(conflicts) == 0


async def check_resource_fault_status(
    db: AsyncSession,
    resource_id: int,
    start_time: datetime,
    end_time: datetime
) -> bool:
    stmt = select(models.FaultRecord).where(
        models.FaultRecord.resource_id == resource_id,
        models.FaultRecord.is_resolved == False,
        models.FaultRecord.fault_time < end_time,
        or_(
            models.FaultRecord.resolved_time == None,
            models.FaultRecord.resolved_time > start_time
        )
    )
    result = await db.execute(stmt)
    faults = result.scalars().all()
    return len(faults) == 0


async def check_cleaning_windows(
    db: AsyncSession,
    resource_id: int,
    start_time: datetime,
    end_time: datetime
) -> List[models.CleaningWindow]:
    stmt = select(models.CleaningWindow).where(
        models.CleaningWindow.resource_id == resource_id,
        models.CleaningWindow.start_time < end_time,
        models.CleaningWindow.end_time > start_time
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def validate_reservation(
    db: AsyncSession,
    reservation: schemas.ReservationCreate,
    exclude_reservation_id: Optional[int] = None
) -> schemas.ReservationValidationResult:
    conflicts: List[schemas.ReservationConflict] = []
    warnings: List[str] = []

    if reservation.start_time >= reservation.end_time:
        conflicts.append(schemas.ReservationConflict(
            type="time_invalid",
            message="结束时间必须晚于开始时间"
        ))
        return schemas.ReservationValidationResult(valid=False, conflicts=conflicts)

    is_available = await check_resource_availability(
        db, reservation.resource_id,
        reservation.start_time, reservation.end_time,
        exclude_reservation_id
    )
    if not is_available:
        stmt = select(models.Reservation).where(
            models.Reservation.resource_id == reservation.resource_id,
            models.Reservation.status != "cancelled",
            models.Reservation.start_time < reservation.end_time,
            models.Reservation.end_time > reservation.start_time
        )
        if exclude_reservation_id is not None:
            stmt = stmt.where(models.Reservation.id != exclude_reservation_id)
        result = await db.execute(stmt)
        conflicting_reservations = result.scalars().all()

        for conflict in conflicting_reservations:
            conflicts.append(schemas.ReservationConflict(
                type="resource_conflict",
                message=f"与预约 #{conflict.id} 时间冲突 ({conflict.start_time.strftime('%H:%M')} - {conflict.end_time.strftime('%H:%M')})",
                conflicting_reservation=schemas.Reservation.model_validate(conflict)
            ))

    has_fault = not await check_resource_fault_status(
        db, reservation.resource_id,
        reservation.start_time, reservation.end_time
    )
    if has_fault:
        conflicts.append(schemas.ReservationConflict(
            type="resource_fault",
            message="该资源在预约时间范围内存在未解决的故障"
        ))

    cleaning_windows = await check_cleaning_windows(
        db, reservation.resource_id,
        reservation.start_time, reservation.end_time
    )
    for cw in cleaning_windows:
        overlap_start = max(reservation.start_time, cw.start_time)
        overlap_end = min(reservation.end_time, cw.end_time)
        overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60

        if overlap_minutes > 0:
            warnings.append(
                f"预约与清洁窗口重叠 {int(overlap_minutes)} 分钟 (清洁窗口: {cw.start_time.strftime('%H:%M')} - {cw.end_time.strftime('%H:%M')})"
            )

    stmt_prev = select(models.Reservation).where(
        models.Reservation.resource_id == reservation.resource_id,
        models.Reservation.status != "cancelled",
        models.Reservation.end_time <= reservation.start_time,
        models.Reservation.end_time > reservation.start_time - timedelta(hours=2)
    ).order_by(models.Reservation.end_time.desc()).limit(1)
    result_prev = await db.execute(stmt_prev)
    prev_reservation = result_prev.scalar_one_or_none()

    if prev_reservation:
        gap_minutes = (reservation.start_time - prev_reservation.end_time).total_seconds() / 60
        if gap_minutes < 15:
            warnings.append(f"与上一预约间隔仅 {int(gap_minutes)} 分钟，建议预留至少15分钟清洁时间")

    return schemas.ReservationValidationResult(
        valid=len(conflicts) == 0,
        conflicts=conflicts,
        warnings=warnings
    )


async def calculate_overtime_fee(
    db: AsyncSession,
    reservation_id: int,
    actual_end_time: datetime,
    hourly_rate: float = 50.0
) -> Dict:
    stmt = select(models.Reservation).where(models.Reservation.id == reservation_id)
    result = await db.execute(stmt)
    reservation = result.scalar_one_or_none()

    if not reservation:
        return {"error": "Reservation not found"}

    if actual_end_time <= reservation.end_time:
        return {
            "overtime_minutes": 0,
            "overtime_fee": 0.0,
            "affected_reservation": None
        }

    overtime_minutes = int((actual_end_time - reservation.end_time).total_seconds() / 60)
    overtime_fee = (overtime_minutes / 60) * hourly_rate

    stmt_next = select(models.Reservation).where(
        models.Reservation.resource_id == reservation.resource_id,
        models.Reservation.id != reservation.id,
        models.Reservation.status != "cancelled",
        models.Reservation.start_time >= reservation.end_time,
        models.Reservation.start_time < actual_end_time
    ).order_by(models.Reservation.start_time).limit(1)

    result_next = await db.execute(stmt_next)
    next_reservation = result_next.scalar_one_or_none()

    return {
        "overtime_minutes": overtime_minutes,
        "overtime_fee": round(overtime_fee, 2),
        "affected_next_reservation_id": next_reservation.id if next_reservation else None
    }


async def get_daily_kanban_data(
    db: AsyncSession,
    target_date: date
) -> Dict:
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date, datetime.max.time())

    stmt_resources = select(models.Resource)
    result_resources = await db.execute(stmt_resources)
    resources = result_resources.scalars().all()

    stmt_reservations = select(models.Reservation).where(
        models.Reservation.date == target_date,
        models.Reservation.status != "cancelled"
    ).order_by(models.Reservation.start_time)
    result_reservations = await db.execute(stmt_reservations)
    reservations = result_reservations.scalars().all()

    stmt_cleaning = select(models.CleaningWindow).where(
        models.CleaningWindow.date == target_date
    )
    result_cleaning = await db.execute(stmt_cleaning)
    cleaning_windows = result_cleaning.scalars().all()

    stmt_overtime = select(models.OvertimeRecord).where(
        func.date(models.OvertimeRecord.created_at) == target_date
    )
    result_overtime = await db.execute(stmt_overtime)
    overtime_records = result_overtime.scalars().all()

    stmt_fees = select(models.MerchantFee).where(
        models.MerchantFee.date == target_date
    )
    result_fees = await db.execute(stmt_fees)
    merchant_fees = result_fees.scalars().all()

    time_slots: Dict[int, List[Dict]] = {}
    for resource in resources:
        resource_id = resource.id
        time_slots[resource_id] = []

        for r in reservations:
            if r.resource_id == resource_id:
                overtime_info = next(
                    (o for o in overtime_records if o.reservation_id == r.id),
                    None
                )
                time_slots[resource_id].append({
                    "type": "reservation",
                    "start_time": r.start_time,
                    "end_time": r.end_time,
                    "merchant_id": r.merchant_id,
                    "merchant_name": r.merchant.name if r.merchant else None,
                    "resource_id": r.resource_id,
                    "reservation_id": r.id,
                    "status": r.status,
                    "has_conflict": r.has_conflict,
                    "conflict_note": r.conflict_note,
                    "overtime_fee": overtime_info.overtime_fee if overtime_info else None
                })

        for cw in cleaning_windows:
            if cw.resource_id == resource_id:
                time_slots[resource_id].append({
                    "type": "cleaning",
                    "start_time": cw.start_time,
                    "end_time": cw.end_time,
                    "resource_id": cw.resource_id,
                    "status": "cleaning"
                })

        time_slots[resource_id].sort(key=lambda x: x["start_time"])

    stmt_faults = select(models.FaultRecord).where(
        models.FaultRecord.is_resolved == False,
        models.FaultRecord.fault_time <= end_of_day
    )
    result_faults = await db.execute(stmt_faults)
    active_faults = result_faults.scalars().all()

    conflicts = []
    for r in reservations:
        if r.has_conflict:
            conflicts.append({
                "reservation_id": r.id,
                "merchant_name": r.merchant.name if r.merchant else None,
                "resource_name": r.resource.name if r.resource else None,
                "conflict_note": r.conflict_note,
                "start_time": r.start_time.strftime("%H:%M"),
                "end_time": r.end_time.strftime("%H:%M")
            })

    for fault in active_faults:
        affected_reservations = [
            r for r in reservations
            if r.resource_id == fault.resource_id
        ]
        if affected_reservations:
            conflicts.append({
                "type": "fault_impact",
                "resource_id": fault.resource_id,
                "resource_name": fault.resource.name if fault.resource else None,
                "fault_description": fault.description,
                "affected_reservations": [
                    {
                        "reservation_id": r.id,
                        "merchant_name": r.merchant.name if r.merchant else None,
                        "start_time": r.start_time.strftime("%H:%M"),
                        "end_time": r.end_time.strftime("%H:%M")
                    }
                    for r in affected_reservations
                ]
            })

    return {
        "date": target_date,
        "resources": [schemas.Resource.model_validate(r) for r in resources],
        "time_slots": time_slots,
        "conflicts": conflicts,
        "merchant_fees": [schemas.MerchantFee.model_validate(f) for f in merchant_fees]
    }


async def export_daily_schedule(
    db: AsyncSession,
    target_date: date
) -> str:
    kanban_data = await get_daily_kanban_data(db, target_date)

    lines = []
    lines.append(f"=== 共享厨房排班表 - {target_date.strftime('%Y年%m月%d日')} ===")
    lines.append("=" * 60)
    lines.append("")

    lines.append("【资源列表】")
    for resource in kanban_data["resources"]:
        status = "可用" if resource.is_available else "不可用"
        lines.append(f"  {resource.name} ({resource.type}) - {status}")
    lines.append("")

    lines.append("-" * 60)
    lines.append("")

    for resource in kanban_data["resources"]:
        lines.append(f"【{resource.name}】")
        resource_slots = kanban_data["time_slots"].get(resource.id, [])
        if not resource_slots:
            lines.append("  (无安排)")
        else:
            for slot in sorted(resource_slots, key=lambda x: x["start_time"]):
                start = slot["start_time"].strftime("%H:%M")
                end = slot["end_time"].strftime("%H:%M")

                if slot["type"] == "cleaning":
                    lines.append(f"  {start} - {end}: 清洁时间")
                elif slot["type"] == "reservation":
                    merchant = slot.get("merchant_name", "未知商户")
                    status = slot.get("status", "")
                    conflict_tag = " [冲突]" if slot.get("has_conflict") else ""
                    overtime = slot.get("overtime_fee")
                    overtime_str = f" (超时费: ¥{overtime})" if overtime else ""
                    lines.append(f"  {start} - {end}: {merchant} - {status}{conflict_tag}{overtime_str}")
        lines.append("")

    lines.append("-" * 60)
    lines.append("")

    if kanban_data["conflicts"]:
        lines.append("【冲突/故障提醒】")
        for conflict in kanban_data["conflicts"]:
            if "type" in conflict and conflict["type"] == "fault_impact":
                lines.append(f"  ■ 故障资源: {conflict['resource_name']}")
                lines.append(f"     故障描述: {conflict['fault_description']}")
                lines.append(f"     影响预约:")
                for ar in conflict["affected_reservations"]:
                    lines.append(f"       - {ar['merchant_name']} ({ar['start_time']}-{ar['end_time']})")
            else:
                lines.append(f"  ■ 预约冲突: {conflict['merchant_name']} @ {conflict['resource_name']}")
                lines.append(f"     时间: {conflict['start_time']} - {conflict['end_time']}")
                lines.append(f"     备注: {conflict['conflict_note']}")
        lines.append("")

    if kanban_data["merchant_fees"]:
        lines.append("-" * 60)
        lines.append("")
        lines.append("【当日费用汇总】")
        total = 0.0
        for fee in kanban_data["merchant_fees"]:
            m_name = next(
                (r.name for r in kanban_data["resources"] if r.id == fee.merchant_id),
                f"商户#{fee.merchant_id}"
            )
            lines.append(f"  {m_name}:")
            lines.append(f"    预约费: ¥{fee.reservation_fee:.2f}")
            lines.append(f"    超时费: ¥{fee.overtime_fee:.2f}")
            lines.append(f"    总计: ¥{fee.total_fee:.2f}")
            total += fee.total_fee
        lines.append("")
        lines.append(f"  当日总费用: ¥{total:.2f}")

    lines.append("")
    lines.append("=" * 60)
    lines.append("导出时间: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    return "\n".join(lines)
