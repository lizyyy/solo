import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Tuple, Any
from models import (
    BondRedemptionReminder,
    SupplementaryRecord,
    TailAdjustmentEntry,
    AuditLog,
    InstitutionAlias,
    HolidayConfig,
    RecordStatus,
    NextStep,
)
from storage import Storage


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


class HolidayAdjuster:
    def __init__(self, config: HolidayConfig):
        self.config = config

    def is_holiday_or_weekend(self, date_str: str) -> bool:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        if date.weekday() in self.config.weekend_days:
            return True
        return date_str in self.config.holiday_dates

    def adjust_date(self, date_str: str) -> Tuple[str, str]:
        original_date = date_str
        current_date = datetime.strptime(date_str, "%Y-%m-%d")
        adjustment_days = 0

        while self.is_holiday_or_weekend(current_date.strftime("%Y-%m-%d")):
            current_date += timedelta(days=1)
            adjustment_days += 1

        adjusted_date = current_date.strftime("%Y-%m-%d")

        if adjustment_days > 0:
            note = f"原回售日{original_date}遇节假日/周末，顺延{adjustment_days}天至{adjusted_date}"
        else:
            note = ""

        return adjusted_date, note


class AliasDetector:
    def __init__(self, aliases: List[InstitutionAlias]):
        self.aliases = aliases
        self._build_alias_map()

    def _build_alias_map(self):
        self.alias_to_standard = {}
        self.fullname_to_standard = {}
        for alias_config in self.aliases:
            self.fullname_to_standard[alias_config.full_name] = alias_config.standard_alias
            for alias in alias_config.aliases:
                self.alias_to_standard[alias] = alias_config.standard_alias

    def detect_mismatch(self, full_name: str, current_alias: str) -> Tuple[bool, str, str]:
        standard_alias = self.fullname_to_standard.get(full_name)
        if not standard_alias:
            return False, "", ""

        if current_alias != standard_alias:
            return True, standard_alias, f"机构简称不一致：录入为「{current_alias}」，标准简称为「{standard_alias}」，请财务复核人确认"

        return False, "", ""


class AuditTrailManager:
    @staticmethod
    def create_log(
        reminder_id: str,
        action: str,
        field_changed: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        operator: str,
        affected_results: str = "",
    ) -> AuditLog:
        return AuditLog(
            id=generate_id(),
            reminder_id=reminder_id,
            action=action,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            operator=operator,
            affected_results=affected_results,
        )


class ReminderManager:
    def __init__(self, storage: Storage):
        self.storage = storage
        self.holiday_config = storage.load_holiday_config()
        self.institution_aliases = storage.load_institution_aliases()
        self.holiday_adjuster = HolidayAdjuster(self.holiday_config)
        self.alias_detector = AliasDetector(self.institution_aliases)

    def reload_configs(self):
        self.holiday_config = self.storage.load_holiday_config()
        self.institution_aliases = self.storage.load_institution_aliases()
        self.holiday_adjuster = HolidayAdjuster(self.holiday_config)
        self.alias_detector = AliasDetector(self.institution_aliases)

    def import_reminder(
        self,
        bond_code: str,
        bond_name: str,
        institution_full_name: str,
        institution_alias: str,
        redemption_date: str,
        exercise_amount: float,
        coupon_rate: float,
        source: str,
        import_batch: str,
        raw_data: Optional[Dict[str, Any]] = None,
        operator: str = "system",
    ) -> BondRedemptionReminder:
        reminders = self.storage.load_reminders()

        existing = self._find_existing_reminder(reminders, bond_code, institution_full_name, redemption_date)

        if existing:
            return self._update_existing_reminder(existing, reminders, operator)

        adjusted_date, holiday_note = self.holiday_adjuster.adjust_date(redemption_date)
        has_alias_mismatch, detected_alias, mismatch_note = self.alias_detector.detect_mismatch(
            institution_full_name, institution_alias
        )

        status = RecordStatus.PENDING
        if has_alias_mismatch:
            status = RecordStatus.PENDING_REVIEW

        reminder = BondRedemptionReminder(
            id=generate_id(),
            bond_code=bond_code,
            bond_name=bond_name,
            institution_full_name=institution_full_name,
            institution_alias=institution_alias,
            redemption_date=adjusted_date,
            original_redemption_date=redemption_date,
            exercise_amount=exercise_amount,
            coupon_rate=coupon_rate,
            status=status,
            source=source,
            import_batch=import_batch,
            has_alias_mismatch=has_alias_mismatch,
            alias_mismatch_note=mismatch_note,
            detected_alias=detected_alias,
            has_holiday_adjustment=bool(holiday_note),
            holiday_adjustment_note=holiday_note,
            raw_data=raw_data or {},
        )

        self._create_initial_supplementary(reminder, operator)
        self._create_import_audit_log(reminder, operator)

        reminders.append(reminder)
        self.storage.save_reminders(reminders)

        return reminder

    def _find_existing_reminder(
        self,
        reminders: List[BondRedemptionReminder],
        bond_code: str,
        institution_full_name: str,
        redemption_date: str,
    ) -> Optional[BondRedemptionReminder]:
        for r in reminders:
            if (
                r.bond_code == bond_code
                and r.institution_full_name == institution_full_name
                and r.original_redemption_date == redemption_date
            ):
                return r
        return None

    def _update_existing_reminder(
        self,
        existing: BondRedemptionReminder,
        reminders: List[BondRedemptionReminder],
        operator: str,
    ) -> BondRedemptionReminder:
        old_import_count = existing.import_count
        existing.import_count += 1
        existing.last_rerun_at = datetime.now()
        existing.updated_at = datetime.now()

        audit_log = AuditTrailManager.create_log(
            reminder_id=existing.id,
            action="重跑导入",
            field_changed="import_count, last_rerun_at",
            old_value=f"count={old_import_count}, rerun_at=None",
            new_value=f"count={existing.import_count}, rerun_at={existing.last_rerun_at}",
            reason="重复导入同一条债券回售提醒，系统自动标记为重跑",
            operator=operator,
            affected_results="该记录导入次数增加，最后重跑时间更新，状态保持不变",
        )
        existing.audit_logs.append(audit_log)

        sup = self._get_latest_supplementary(existing)
        if sup:
            old_notes = sup.notes
            sup.notes = f"{old_notes}\n【{datetime.now().strftime('%Y-%m-%d %H:%M')}】第{existing.import_count}次重跑导入，记录已存在，状态保持"
            sup.updated_at = datetime.now()
            sup.updated_by = operator

        self.storage.save_reminders(reminders)
        return existing

    def _create_initial_supplementary(self, reminder: BondRedemptionReminder, operator: str):
        why_kept_parts = []
        missing_parts = []
        next_step = NextStep.HOLD

        if reminder.has_alias_mismatch:
            why_kept_parts.append(f"机构简称不一致：{reminder.alias_mismatch_note}")
            missing_parts.append("财务复核人确认机构简称正确性")
            next_step = NextStep.FINANCIAL_REVIEWER

        if reminder.has_holiday_adjustment:
            why_kept_parts.append(f"节假日顺延：{reminder.holiday_adjustment_note}")
            missing_parts.append("确认顺延日期是否正确")
            if next_step == NextStep.HOLD:
                next_step = NextStep.LINJIE

        if not why_kept_parts:
            why_kept_parts.append("新导入记录，等待初步核对")
            missing_parts.append("核对债券基本信息、回售金额、利率等")
            next_step = NextStep.LINJIE

        sup = SupplementaryRecord(
            id=generate_id(),
            reminder_id=reminder.id,
            why_kept="\n".join([f"• {p}" for p in why_kept_parts]),
            missing_materials="\n".join([f"• {p}" for p in missing_parts]),
            next_step=next_step,
            notes=f"【{datetime.now().strftime('%Y-%m-%d %H:%M')}】首次导入，系统自动检测完成",
            created_by=operator,
            updated_by=operator,
        )
        reminder.supplementary_records.append(sup)

    def _create_import_audit_log(self, reminder: BondRedemptionReminder, operator: str):
        affected = []
        if reminder.has_alias_mismatch:
            affected.append(f"标记为{RecordStatus.PENDING_REVIEW.value}")
        if reminder.has_holiday_adjustment:
            affected.append(f"回售日调整为{reminder.redemption_date}")
        if not affected:
            affected.append("状态为待处理")

        audit_log = AuditTrailManager.create_log(
            reminder_id=reminder.id,
            action="导入",
            field_changed="全部字段",
            old_value="无",
            new_value="完整债券回售提醒记录",
            reason="首次导入债券回售提醒数据",
            operator=operator,
            affected_results="; ".join(affected),
        )
        reminder.audit_logs.append(audit_log)

    def add_tail_adjustment(
        self,
        reminder_id: str,
        amount_diff: float,
        adjustment_reason: str,
        remark: str,
        operator: str,
    ) -> Optional[TailAdjustmentEntry]:
        reminders = self.storage.load_reminders()
        reminder = self._find_reminder_by_id(reminders, reminder_id)
        if not reminder:
            return None

        tail = TailAdjustmentEntry(
            id=generate_id(),
            reminder_id=reminder_id,
            amount_diff=amount_diff,
            adjustment_reason=adjustment_reason,
            remark=remark,
            created_by=operator,
        )

        old_amount = reminder.exercise_amount
        reminder.exercise_amount += amount_diff
        reminder.has_tail_adjustment = True
        reminder.tail_adjustments.append(tail)
        reminder.updated_at = datetime.now()

        audit_log = AuditTrailManager.create_log(
            reminder_id=reminder_id,
            action="尾差调整",
            field_changed="exercise_amount",
            old_value=old_amount,
            new_value=reminder.exercise_amount,
            reason=adjustment_reason,
            operator=operator,
            affected_results=f"行权金额由{old_amount}调整为{reminder.exercise_amount}，差额{amount_diff}。备注：{remark}",
        )
        reminder.audit_logs.append(audit_log)

        self._update_supplementary_after_tail(reminder, tail, operator)

        self.storage.save_reminders(reminders)
        return tail

    def _update_supplementary_after_tail(
        self,
        reminder: BondRedemptionReminder,
        tail: TailAdjustmentEntry,
        operator: str,
    ):
        sup = self._get_latest_supplementary(reminder)
        if not sup:
            sup = SupplementaryRecord(
                id=generate_id(),
                reminder_id=reminder.id,
                why_kept="",
                missing_materials="",
                next_step=NextStep.LINJIE,
                created_by=operator,
                updated_by=operator,
            )
            reminder.supplementary_records.append(sup)

        tail.linked_supplementary_id = sup.id

        why_kept_lines = sup.why_kept.split("\n") if sup.why_kept else []
        why_kept_lines.append(f"• 尾差调整条：{tail.adjustment_reason}，差额{tail.amount_diff}元")
        sup.why_kept = "\n".join(why_kept_lines)

        missing_lines = sup.missing_materials.split("\n") if sup.missing_materials else []
        missing_lines.append(f"• 复核尾差调整依据（{tail.remark}）")
        sup.missing_materials = "\n".join(missing_lines)

        sup.next_step = NextStep.LINJIE

        sup.notes = f"{sup.notes}\n【{datetime.now().strftime('%Y-%m-%d %H:%M')}】{operator}补录尾差调整条：{tail.adjustment_reason}，差额{tail.amount_diff}元。备注：{tail.remark}"
        sup.updated_at = datetime.now()
        sup.updated_by = operator

    def resolve_alias_mismatch(
        self,
        reminder_id: str,
        use_standard: bool,
        confirmed_alias: Optional[str],
        reason: str,
        operator: str,
    ) -> Optional[BondRedemptionReminder]:
        reminders = self.storage.load_reminders()
        reminder = self._find_reminder_by_id(reminders, reminder_id)
        if not reminder or not reminder.has_alias_mismatch:
            return None

        old_alias = reminder.institution_alias
        old_status = reminder.status

        if use_standard:
            new_alias = reminder.detected_alias
        else:
            new_alias = confirmed_alias or old_alias

        reminder.institution_alias = new_alias
        reminder.has_alias_mismatch = False
        reminder.alias_mismatch_note = f"原备注：{reminder.alias_mismatch_note}。{operator}复核确认：{reason}"
        reminder.detected_alias = ""

        if reminder.status == RecordStatus.PENDING_REVIEW:
            reminder.status = RecordStatus.REVIEWED

        reminder.updated_at = datetime.now()

        audit_log = AuditTrailManager.create_log(
            reminder_id=reminder_id,
            action="机构简称复核",
            field_changed="institution_alias, has_alias_mismatch, status",
            old_value=f"alias={old_alias}, mismatch=True, status={old_status.value}",
            new_value=f"alias={new_alias}, mismatch=False, status={reminder.status.value}",
            reason=reason,
            operator=operator,
            affected_results=f"机构简称由「{old_alias}」改为「{new_alias}」，状态由{old_status.value}变为{reminder.status.value}",
        )
        reminder.audit_logs.append(audit_log)

        sup = self._get_latest_supplementary(reminder)
        if sup:
            sup.notes = f"{sup.notes}\n【{datetime.now().strftime('%Y-%m-%d %H:%M')}】{operator}复核机构简称：{reason}，确认使用「{new_alias}」"
            sup.updated_at = datetime.now()
            sup.updated_by = operator

            why_kept_lines = [l for l in sup.why_kept.split("\n") if "机构简称不一致" not in l]
            sup.why_kept = "\n".join(why_kept_lines)

            missing_lines = [l for l in sup.missing_materials.split("\n") if "机构简称" not in l]
            sup.missing_materials = "\n".join(missing_lines)

            if not sup.missing_materials or sup.missing_materials.isspace():
                sup.next_step = NextStep.LINJIE

        self.storage.save_reminders(reminders)
        return reminder

    def send_to_linjie(
        self,
        reminder_id: str,
        message: str,
        operator: str,
    ) -> Optional[BondRedemptionReminder]:
        reminders = self.storage.load_reminders()
        reminder = self._find_reminder_by_id(reminders, reminder_id)
        if not reminder:
            return None

        old_status = reminder.status
        reminder.status = RecordStatus.PENDING_LINJIE
        reminder.updated_at = datetime.now()

        audit_log = AuditTrailManager.create_log(
            reminder_id=reminder_id,
            action="转交林姐",
            field_changed="status",
            old_value=old_status.value,
            new_value=RecordStatus.PENDING_LINJIE.value,
            reason=message,
            operator=operator,
            affected_results="记录转交基金会计林姐处理",
        )
        reminder.audit_logs.append(audit_log)

        sup = self._get_latest_supplementary(reminder)
        if sup:
            sup.next_step = NextStep.LINJIE
            sup.notes = f"{sup.notes}\n【{datetime.now().strftime('%Y-%m-%d %H:%M')}】{operator}转交林姐：{message}"
            sup.updated_at = datetime.now()
            sup.updated_by = operator

        self.storage.save_reminders(reminders)
        return reminder

    def linjie_confirm(
        self,
        reminder_id: str,
        confirmation: str,
        operator: str,
    ) -> Optional[BondRedemptionReminder]:
        reminders = self.storage.load_reminders()
        reminder = self._find_reminder_by_id(reminders, reminder_id)
        if not reminder:
            return None

        old_status = reminder.status
        reminder.status = RecordStatus.RESOLVED
        reminder.updated_at = datetime.now()

        audit_log = AuditTrailManager.create_log(
            reminder_id=reminder_id,
            action="林姐确认完成",
            field_changed="status",
            old_value=old_status.value,
            new_value=RecordStatus.RESOLVED.value,
            reason=confirmation,
            operator=operator,
            affected_results="记录处理完成",
        )
        reminder.audit_logs.append(audit_log)

        sup = self._get_latest_supplementary(reminder)
        if sup:
            sup.next_step = NextStep.COMPLETE
            sup.notes = f"{sup.notes}\n【{datetime.now().strftime('%Y-%m-%d %H:%M')}】{operator}确认完成：{confirmation}"
            sup.updated_at = datetime.now()
            sup.updated_by = operator

        self.storage.save_reminders(reminders)
        return reminder

    def manual_correction(
        self,
        reminder_id: str,
        field_name: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        operator: str,
        affected_results: str = "",
    ) -> Optional[BondRedemptionReminder]:
        reminders = self.storage.load_reminders()
        reminder = self._find_reminder_by_id(reminders, reminder_id)
        if not reminder:
            return None

        if hasattr(reminder, field_name):
            setattr(reminder, field_name, new_value)

        old_status = reminder.status
        reminder.status = RecordStatus.CORRECTED
        reminder.updated_at = datetime.now()

        audit_log = AuditTrailManager.create_log(
            reminder_id=reminder_id,
            action="人工修正",
            field_changed=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            operator=operator,
            affected_results=affected_results or f"{field_name}由{old_value}修正为{new_value}",
        )
        reminder.audit_logs.append(audit_log)

        sup = self._get_latest_supplementary(reminder)
        if sup:
            sup.notes = f"{sup.notes}\n【{datetime.now().strftime('%Y-%m-%d %H:%M')}】{operator}人工修正{field_name}：{reason}"
            sup.updated_at = datetime.now()
            sup.updated_by = operator

        self.storage.save_reminders(reminders)
        return reminder

    def rerun_reminder(
        self,
        reminder_id: str,
        reason: str,
        operator: str,
    ) -> Optional[BondRedemptionReminder]:
        reminders = self.storage.load_reminders()
        reminder = self._find_reminder_by_id(reminders, reminder_id)
        if not reminder:
            return None

        old_import_count = reminder.import_count
        old_status = reminder.status
        reminder.import_count += 1
        reminder.last_rerun_at = datetime.now()
        reminder.status = RecordStatus.RERUN
        reminder.updated_at = datetime.now()

        audit_log = AuditTrailManager.create_log(
            reminder_id=reminder_id,
            action="人工重跑",
            field_changed="import_count, last_rerun_at, status",
            old_value=f"count={old_import_count}, status={old_status.value}",
            new_value=f"count={reminder.import_count}, status={RecordStatus.RERUN.value}",
            reason=reason,
            operator=operator,
            affected_results=f"第{reminder.import_count}次重跑，状态由{old_status.value}变为{RecordStatus.RERUN.value}",
        )
        reminder.audit_logs.append(audit_log)

        sup = self._get_latest_supplementary(reminder)
        if sup:
            sup.notes = f"{sup.notes}\n【{datetime.now().strftime('%Y-%m-%d %H:%M')}】{operator}人工重跑：{reason}"
            sup.updated_at = datetime.now()
            sup.updated_by = operator

        self.storage.save_reminders(reminders)
        return reminder

    def _find_reminder_by_id(
        self,
        reminders: List[BondRedemptionReminder],
        reminder_id: str,
    ) -> Optional[BondRedemptionReminder]:
        for r in reminders:
            if r.id == reminder_id:
                return r
        return None

    def _get_latest_supplementary(
        self,
        reminder: BondRedemptionReminder,
    ) -> Optional[SupplementaryRecord]:
        if not reminder.supplementary_records:
            return None
        return reminder.supplementary_records[-1]

    def get_all_reminders(self) -> List[BondRedemptionReminder]:
        return self.storage.load_reminders()

    def get_reminder_by_id(self, reminder_id: str) -> Optional[BondRedemptionReminder]:
        reminders = self.storage.load_reminders()
        return self._find_reminder_by_id(reminders, reminder_id)

    def get_reminders_by_status(self, status: RecordStatus) -> List[BondRedemptionReminder]:
        reminders = self.storage.load_reminders()
        return [r for r in reminders if r.status == status]

    def get_pending_review_reminders(self) -> List[BondRedemptionReminder]:
        return self.get_reminders_by_status(RecordStatus.PENDING_REVIEW)

    def get_pending_linjie_reminders(self) -> List[BondRedemptionReminder]:
        return self.get_reminders_by_status(RecordStatus.PENDING_LINJIE)

    def generate_report(self) -> str:
        reminders = self.storage.load_reminders()
        if not reminders:
            return "暂无债券回售提醒记录"

        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("债券回售提醒核对报告")
        report_lines.append(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"记录总数：{len(reminders)}")
        report_lines.append("=" * 80)

        status_counts = {}
        for r in reminders:
            status_counts[r.status.value] = status_counts.get(r.status.value, 0) + 1

        report_lines.append("\n【状态统计】")
        for status, count in status_counts.items():
            report_lines.append(f"  {status}: {count}条")

        report_lines.append("\n" + "=" * 80)
        report_lines.append("详细记录")
        report_lines.append("=" * 80)

        for i, reminder in enumerate(reminders, 1):
            report_lines.append(f"\n【记录{i}】ID: {reminder.id} | 状态: {reminder.status.value}")
            report_lines.append(f"  债券代码: {reminder.bond_code} | 债券名称: {reminder.bond_name}")
            report_lines.append(f"  机构: {reminder.institution_full_name} ({reminder.institution_alias})")
            report_lines.append(f"  回售日期: {reminder.redemption_date} (原日期: {reminder.original_redemption_date})")
            report_lines.append(f"  行权金额: {reminder.exercise_amount} | 票面利率: {reminder.coupon_rate}%")
            report_lines.append(f"  导入批次: {reminder.import_batch} | 导入次数: {reminder.import_count}")
            report_lines.append(f"  来源: {reminder.source}")

            flags = []
            if reminder.has_alias_mismatch:
                flags.append("机构简称不一致")
            if reminder.has_holiday_adjustment:
                flags.append("节假日顺延")
            if reminder.has_tail_adjustment:
                flags.append("尾差调整")
            if flags:
                report_lines.append(f"  标记: {'、'.join(flags)}")

            if reminder.has_alias_mismatch:
                report_lines.append(f"  ⚠️  {reminder.alias_mismatch_note}")

            if reminder.has_holiday_adjustment:
                report_lines.append(f"  📅 {reminder.holiday_adjustment_note}")

            if reminder.tail_adjustments:
                report_lines.append(f"\n  【尾差调整条】({len(reminder.tail_adjustments)}条)")
                for j, tail in enumerate(reminder.tail_adjustments, 1):
                    report_lines.append(f"    调整{j}: 差额{tail.amount_diff}元 | 原因: {tail.adjustment_reason}")
                    report_lines.append(f"          备注: {tail.remark}")
                    report_lines.append(f"          操作人: {tail.created_by} | 时间: {tail.created_at.strftime('%Y-%m-%d %H:%M')}")

            if reminder.supplementary_records:
                report_lines.append(f"\n  【补录记录】")
                sup = reminder.supplementary_records[-1]
                report_lines.append(f"    为什么留下:")
                for line in sup.why_kept.split("\n"):
                    report_lines.append(f"      {line}")
                report_lines.append(f"    还缺什么材料:")
                for line in sup.missing_materials.split("\n"):
                    report_lines.append(f"      {line}")
                report_lines.append(f"    下一步: {sup.next_step.value}")
                if sup.notes:
                    report_lines.append(f"    处理日志:")
                    for line in sup.notes.split("\n"):
                        report_lines.append(f"      {line}")

            if reminder.audit_logs:
                report_lines.append(f"\n  【审计追踪】")
                for audit in reminder.audit_logs:
                    report_lines.append(
                        f"    [{audit.timestamp.strftime('%Y-%m-%d %H:%M')}] {audit.operator} {audit.action}: "
                        f"{audit.field_changed} {audit.old_value} → {audit.new_value}"
                    )
                    report_lines.append(f"      原因: {audit.reason}")
                    if audit.affected_results:
                        report_lines.append(f"      影响: {audit.affected_results}")

            report_lines.append("\n" + "-" * 80)

        report_lines.append("\n" + "=" * 80)
        report_lines.append("报告结束")
        report_lines.append("=" * 80)

        return "\n".join(report_lines)
