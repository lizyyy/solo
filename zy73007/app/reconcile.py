from datetime import date, datetime, timedelta
from typing import Tuple, Dict, Optional
from .models import (
    BoardingRegister, VaccineSchedule, ReconcileItem, ReconcileStatus,
    AbnormalType, AbnormalQueueItem
)
from .sample_data import MANUAL_OVERRIDE_RECORDS


def _calc_impact_scope(
    reg: BoardingRegister, schedule: Optional[VaccineSchedule],
    abnormal_types: list
) -> str:
    parts: list[str] = []
    if AbnormalType.DATE_MISSING in abnormal_types:
        parts.append("无法推算下次排程，寄养期间存在免疫空档风险")
    if AbnormalType.SUPPLEMENT_MISMATCH in abnormal_types:
        parts.append(
            f"主人补充日期({reg.supplement_vaccine_date or '空'})与旧记录"
            f"({reg.vaccine_last_date or '空'})不一致，免疫有效期起算点存疑"
        )
    if AbnormalType.MANUAL_OVERRIDE in abnormal_types:
        parts.append("已人工改判，原排程作废，按实际接种日期重算有效期")
    if AbnormalType.SCHEDULE_OFFSET in abnormal_types:
        if schedule and schedule.plan_date and schedule.plan_date < date.today():
            overdue_days = (date.today() - schedule.plan_date).days
            parts.append(f"计划接种日期已超期{overdue_days}天，寄养期间需补打")
    if not parts:
        parts.append("疫苗信息一致，排程正常")
    return "；".join(parts)


def _source_line_ref(reg: BoardingRegister, line_no: int) -> str:
    return (
        f"[登记表行#{line_no}] {reg.reg_id} | {reg.dog_name} | "
        f"入住:{reg.checkin_date} | 旧疫苗:{reg.vaccine_last_date or '空'}"
        f"({reg.vaccine_type_old or '-'}) | 主人补充原话:「{reg.owner_supplement or '无'}」"
    )


def run_reconcile(
    registers: list[BoardingRegister],
    schedules: list[VaccineSchedule],
    reconcile_month: Optional[str] = None,
    overrides: Optional[Dict] = None
) -> Tuple[list, list]:
    if reconcile_month is None:
        reconcile_month = date.today().strftime("%Y-%m")
    if overrides is None:
        overrides = MANUAL_OVERRIDE_RECORDS

    sch_map: Dict[str, VaccineSchedule] = {s.reg_id: s for s in schedules}
    reg_by_idx = {r.reg_id: (i + 1, r) for i, r in enumerate(registers)}

    reconcile_items: list[ReconcileItem] = []
    abnormal_queue: list[AbnormalQueueItem] = []

    for idx, reg in enumerate(registers, start=1):
        schedule = sch_map.get(reg.reg_id)
        abnormal_types: list[AbnormalType] = []
        old_date = reg.vaccine_last_date
        sup_date = reg.supplement_vaccine_date

        if old_date is None and sup_date is None:
            abnormal_types.append(AbnormalType.DATE_MISSING)

        if old_date and sup_date and old_date != sup_date:
            abnormal_types.append(AbnormalType.SUPPLEMENT_MISMATCH)

        if reg.reg_id in overrides:
            abnormal_types.append(AbnormalType.MANUAL_OVERRIDE)

        if schedule and schedule.plan_date and schedule.plan_date < date.today() \
                and not (schedule.actual_date and schedule.actual_date <= date.today()):
            abnormal_types.append(AbnormalType.SCHEDULE_OFFSET)

        final_date = None
        override_flag = False
        override_reason = None
        handler = None
        handled_at = None

        if reg.reg_id in overrides:
            ov = overrides[reg.reg_id]
            override_flag = True
            override_reason = ov["override_reason"]
            handler = ov["handler"]
            handled_at = ov["handled_at"]
            final_date = sup_date or old_date
        elif abnormal_types:
            if AbnormalType.DATE_MISSING in abnormal_types:
                final_date = None
            elif AbnormalType.SUPPLEMENT_MISMATCH in abnormal_types:
                final_date = None
            else:
                final_date = old_date or sup_date
        else:
            final_date = old_date or sup_date

        if override_flag:
            status = ReconcileStatus.CONFIRMED
        elif AbnormalType.DATE_MISSING in abnormal_types:
            status = ReconcileStatus.REJECTED
        elif AbnormalType.SUPPLEMENT_MISMATCH in abnormal_types:
            if "补" in (reg.owner_supplement or "") or "忘带" in (reg.owner_supplement or ""):
                status = ReconcileStatus.PENDING_DOC
            else:
                status = ReconcileStatus.PENDING
        elif not abnormal_types:
            status = ReconcileStatus.CONFIRMED
        else:
            status = ReconcileStatus.PENDING

        if schedule and schedule.actual_date and schedule.actual_date <= date.today():
            if status == ReconcileStatus.PENDING:
                status = ReconcileStatus.CONFIRMED

        impact = _calc_impact_scope(reg, schedule, abnormal_types)
        source_lines = [_source_line_ref(reg, idx)]

        item = ReconcileItem(
            reconcile_id=f"REC-{reg.reg_id.replace('REG-', '')}",
            reg_id=reg.reg_id,
            schedule_id=schedule.schedule_id if schedule else None,
            dog_name=reg.dog_name,
            owner_name=reg.owner_name,
            status=status,
            abnormal_types=abnormal_types,
            old_vaccine_date=old_date,
            supplement_vaccine_date=sup_date,
            final_vaccine_date=final_date,
            impact_scope=impact,
            source_lines=source_lines,
            owner_supplement_raw=reg.owner_supplement,
            manual_override_flag=override_flag,
            override_reason=override_reason,
            handler=handler,
            handled_at=handled_at,
            reconcile_month=reconcile_month
        )
        reconcile_items.append(item)

        if abnormal_types:
            summary_parts = [t.value for t in abnormal_types]
            if override_flag:
                summary_parts.append(f"→已改判{status.value}")
            queue_item = AbnormalQueueItem(
                queue_id=f"Q-{item.reconcile_id}",
                reconcile_id=item.reconcile_id,
                reg_id=reg.reg_id,
                dog_name=reg.dog_name,
                status=status,
                abnormal_types=abnormal_types,
                summary=" | ".join(summary_parts),
                owner_supplement_raw=reg.owner_supplement,
                source_register_ref=f"{reg.reg_id} 行#{idx}",
                impact_scope=impact,
                created_at=datetime.now()
            )
            abnormal_queue.append(queue_item)

    return reconcile_items, abnormal_queue
