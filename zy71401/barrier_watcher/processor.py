from __future__ import annotations

from datetime import date, datetime

from .models import (
    BarrierJudgment,
    Contract,
    HistoryEntry,
    JudgmentStatus,
    NormalRecord,
    ObservationPrice,
    ProblemRecord,
    ProblemType,
    Reminder,
    ReminderEventType,
    DailyReport,
)
from .engine import BarrierEngine
from .calendar import fill_observation_calendar, missing_observation_dates
from .reminder import ReminderManager
from .history import HistoryManager


class BatchProcessor:
    def __init__(
        self,
        engine: BarrierEngine,
        reminder_mgr: ReminderManager,
        history_mgr: HistoryManager,
        timestamp_tolerance_hours: int = 24,
    ):
        self._engine = engine
        self._reminder_mgr = reminder_mgr
        self._history_mgr = history_mgr
        self._ts_tolerance = timestamp_tolerance_hours

    def process(
        self,
        report_date: date,
        contracts: list[Contract],
        prices: dict[str, list[ObservationPrice]],
        existing_judgments: dict[str, BarrierJudgment],
        existing_reminders: dict[str, Reminder],
        holidays: set[date] | None = None,
        changed_by: str = "system",
    ) -> DailyReport:
        normal_records: list[NormalRecord] = []
        problem_records: list[ProblemRecord] = []
        new_judgments: list[BarrierJudgment] = []
        new_reminders: list[Reminder] = []
        all_history: list[HistoryEntry] = []
        reminded_set: set[str] = set()

        for contract in contracts:
            fill_observation_calendar(contract, holidays)

            contract_prices = prices.get(contract.contract_id, [])

            judgments, problems = self._engine.process_contract(
                contract,
                contract_prices,
                existing_judgments,
                self._ts_tolerance,
            )

            problem_records.extend(problems)

            for j in judgments:
                existing_judgments[j.judgment_id] = j
                new_judgments.append(j)

                if j.status == JudgmentStatus.PENDING:
                    continue

                normal_records.append(
                    NormalRecord(
                        contract_id=j.contract_id,
                        observation_date=j.observation_date,
                        price=j.price_at_observation or 0.0,
                        barrier_level=j.barrier_level_used or 0.0,
                        barrier_direction=contract.barrier_direction.value
                        if contract.barrier_direction
                        else "",
                        judgment=j.status.value,
                        barrier_type=contract.barrier_type.value
                        if contract.barrier_type
                        else "",
                        manually_overridden=j.manually_overridden,
                    )
                )

                all_history.append(
                    HistoryEntry(
                        contract_id=j.contract_id,
                        field_changed="barrier_judgment",
                        old_value=None,
                        new_value=j.status.value,
                        changed_by=changed_by,
                        changed_at=j.determined_at or datetime.now(),
                    )
                )

            for problem in problems:
                reminder = self._build_problem_reminder(
                    contract, problem
                )
                if reminder and reminder.reminder_id not in reminded_set:
                    reminded_set.add(reminder.reminder_id)
                    result = self._reminder_mgr.add_reminder(
                        reminder, existing_reminders
                    )
                    if result.is_new:
                        new_reminders.append(result.reminder)
                    if result.reminder.reminder_id not in {
                        r.reminder_id for r in new_reminders
                    }:
                        pass

            for j in judgments:
                if j.status == JudgmentStatus.BREACHED:
                    reminder = Reminder(
                        client_id=contract.client_id,
                        contract_id=contract.contract_id,
                        event_type=ReminderEventType.BARRIER_BREACH,
                        message=(
                            f"合约 {contract.contract_id} 于 "
                            f"{j.observation_date.isoformat()} 障碍触碰，"
                            f"类型={j.breach_type}，"
                            f"观察价格={j.price_at_observation}，"
                            f"障碍水平={j.barrier_level_used}"
                        ),
                        observation_date=j.observation_date,
                        created_at=datetime.now(),
                    )
                    if reminder.reminder_id not in reminded_set:
                        reminded_set.add(reminder.reminder_id)
                        result = self._reminder_mgr.add_reminder(
                            reminder, existing_reminders
                        )
                        if result.is_new:
                            new_reminders.append(result.reminder)

        existing_reminder_list = [
            r for rid, r in existing_reminders.items()
            if rid not in reminded_set
        ]

        return DailyReport(
            report_date=report_date,
            normal_records=sorted(
                normal_records,
                key=lambda r: (r.contract_id, r.observation_date),
            ),
            problem_records=sorted(
                problem_records,
                key=lambda r: (r.contract_id, r.observation_date or date.min),
            ),
            new_reminders=new_reminders,
            existing_reminders=existing_reminder_list,
            history_entries=all_history,
        )

    def _build_problem_reminder(
        self,
        contract: Contract,
        problem: ProblemRecord,
    ) -> Reminder | None:
        event_map = {
            ProblemType.MISSING_BARRIER_CONDITION: ReminderEventType.MISSING_CONDITION,
            ProblemType.MISSING_OBSERVATION_PRICE: ReminderEventType.MISSING_OBSERVATION,
            ProblemType.PRICE_TIMESTAMP_MISMATCH: ReminderEventType.PRICE_TIMESTAMP_ERROR,
        }
        event_type = event_map.get(problem.problem_type)
        if event_type is None:
            return None
        return Reminder(
            client_id=contract.client_id,
            contract_id=contract.contract_id,
            event_type=event_type,
            message=problem.detail,
            observation_date=problem.observation_date,
            created_at=datetime.now(),
        )


def format_report(report: DailyReport) -> str:
    lines: list[str] = []
    lines.append(f"期权障碍观察日报 {report.report_date.isoformat()}")
    lines.append("=" * 60)

    lines.append("")
    lines.append("一、障碍判定")
    lines.append("-" * 40)

    if report.normal_records:
        lines.append("[正常记录]")
        for r in report.normal_records:
            override_tag = " [手动覆盖]" if r.manually_overridden else ""
            lines.append(
                f"  合约 {r.contract_id} | 观察日 {r.observation_date.isoformat()} | "
                f"价格 {r.price:.4f} | 障碍水平 {r.barrier_level:.4f} | "
                f"方向 {r.barrier_direction} | 判定 {r.judgment}{override_tag}"
            )

    if report.problem_records:
        lines.append("")
        lines.append("[问题记录]")
        for r in report.problem_records:
            date_str = (
                r.observation_date.isoformat() if r.observation_date else "N/A"
            )
            lines.append(
                f"  合约 {r.contract_id} | 观察日 {date_str} | "
                f"类型 {r.problem_type.value}"
            )
            lines.append(f"    详情: {r.detail}")
            lines.append(f"    关联材料: {r.related_material}")

    if not report.normal_records and not report.problem_records:
        lines.append("  无记录")

    lines.append("")
    lines.append("二、提醒")
    lines.append("-" * 40)

    if report.new_reminders:
        lines.append("[新增提醒]")
        for r in report.new_reminders:
            date_str = (
                r.observation_date.isoformat() if r.observation_date else "N/A"
            )
            lines.append(
                f"  客户 {r.client_id} | 合约 {r.contract_id} | "
                f"观察日 {date_str} | 类型 {r.event_type.value}"
            )
            lines.append(f"    {r.message}")

    if report.existing_reminders:
        lines.append("[已有提醒(不重复发送)]")
        for r in report.existing_reminders:
            date_str = (
                r.observation_date.isoformat() if r.observation_date else "N/A"
            )
            lines.append(
                f"  客户 {r.client_id} | 合约 {r.contract_id} | "
                f"观察日 {date_str} | 类型 {r.event_type.value}"
            )

    if not report.new_reminders and not report.existing_reminders:
        lines.append("  无提醒")

    lines.append("")
    lines.append("三、变更历史")
    lines.append("-" * 40)

    if report.history_entries:
        for h in report.history_entries:
            old_str = h.old_value if h.old_value is not None else "(无)"
            lines.append(
                f"  {h.changed_at.isoformat()} | 合约 {h.contract_id} | "
                f"字段 {h.field_changed} | {old_str} → {h.new_value} | "
                f"操作人 {h.changed_by}"
            )
    else:
        lines.append("  无变更")

    lines.append("")
    lines.append("=" * 60)
    return "\n".join(lines)
