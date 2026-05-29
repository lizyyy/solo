from __future__ import annotations

import json
import os
import shutil
import tempfile
from datetime import date, datetime, timedelta
from unittest import TestCase

from barrier_watcher.models import (
    BarrierDirection,
    BarrierJudgment,
    BarrierType,
    Contract,
    HistoryEntry,
    JudgmentStatus,
    NormalRecord,
    ObservationFreq,
    ObservationPrice,
    ProblemRecord,
    ProblemType,
    Reminder,
    ReminderEventType,
)
from barrier_watcher.calendar import (
    fill_observation_calendar,
    generate_observation_dates,
    missing_observation_dates,
)
from barrier_watcher.engine import BarrierEngine, check_barrier_breach, judge_observation
from barrier_watcher.history import HistoryManager
from barrier_watcher.processor import BatchProcessor, format_report
from barrier_watcher.reminder import ReminderManager
from barrier_watcher.store import Store


class TestBarrierBreach(TestCase):
    def test_up_barrier_breached(self):
        self.assertTrue(check_barrier_breach(112.0, 110.0, BarrierDirection.UP))

    def test_up_barrier_not_breached(self):
        self.assertFalse(check_barrier_breach(108.0, 110.0, BarrierDirection.UP))

    def test_down_barrier_breached(self):
        self.assertTrue(check_barrier_breach(88.0, 90.0, BarrierDirection.DOWN))

    def test_down_barrier_not_breached(self):
        self.assertFalse(check_barrier_breach(92.0, 90.0, BarrierDirection.DOWN))

    def test_exact_touch_counts(self):
        self.assertTrue(check_barrier_breach(110.0, 110.0, BarrierDirection.UP))
        self.assertTrue(check_barrier_breach(90.0, 90.0, BarrierDirection.DOWN))


class TestJudgeObservation(TestCase):
    def _make_contract(self, **kwargs):
        defaults = dict(
            contract_id="C001",
            client_id="CLT001",
            underlying="HS300",
            option_type="call",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 30),
            barrier_type=BarrierType.KNOCK_OUT,
            barrier_level=110.0,
            barrier_direction=BarrierDirection.UP,
            observation_dates=[date(2024, 1, 10), date(2024, 1, 11)],
        )
        defaults.update(kwargs)
        return Contract(**defaults)

    def test_knock_out_breached(self):
        c = self._make_contract()
        p = ObservationPrice(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            price=112.0,
            timestamp=datetime(2024, 1, 10, 15, 0),
        )
        j = judge_observation(c, p)
        self.assertEqual(j.status, JudgmentStatus.BREACHED)
        self.assertEqual(j.breach_type, "knocked_out")

    def test_knock_in_breached(self):
        c = self._make_contract(barrier_type=BarrierType.KNOCK_IN)
        p = ObservationPrice(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            price=112.0,
            timestamp=datetime(2024, 1, 10, 15, 0),
        )
        j = judge_observation(c, p)
        self.assertEqual(j.status, JudgmentStatus.BREACHED)
        self.assertEqual(j.breach_type, "knocked_in")

    def test_not_breached(self):
        c = self._make_contract()
        p = ObservationPrice(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            price=105.0,
            timestamp=datetime(2024, 1, 10, 15, 0),
        )
        j = judge_observation(c, p)
        self.assertEqual(j.status, JudgmentStatus.NOT_BREACHED)
        self.assertIsNone(j.breach_type)

    def test_no_barrier_condition_returns_pending(self):
        c = self._make_contract(barrier_type=None, barrier_level=None, barrier_direction=None)
        p = ObservationPrice(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            price=105.0,
            timestamp=datetime(2024, 1, 10, 15, 0),
        )
        j = judge_observation(c, p)
        self.assertEqual(j.status, JudgmentStatus.PENDING)


class TestObservationCalendar(TestCase):
    def test_daily_generation(self):
        dates = generate_observation_dates(date(2024, 1, 1), date(2024, 1, 7), ObservationFreq.DAILY)
        weekdays = [d for d in dates if d.weekday() < 5]
        self.assertEqual(dates, weekdays)

    def test_weekly_generation(self):
        dates = generate_observation_dates(date(2024, 1, 1), date(2024, 1, 31), ObservationFreq.WEEKLY)
        self.assertTrue(len(dates) >= 3)

    def test_fill_calendar_skips_if_already_set(self):
        c = Contract(
            contract_id="C001", client_id="CLT001", underlying="HS300",
            option_type="call", start_date=date(2024, 1, 1), end_date=date(2024, 1, 31),
            observation_dates=[date(2024, 1, 10)],
        )
        result = fill_observation_calendar(c)
        self.assertEqual(result.observation_dates, [date(2024, 1, 10)])

    def test_missing_observation_dates(self):
        c = Contract(
            contract_id="C001", client_id="CLT001", underlying="HS300",
            option_type="call", start_date=date(2024, 1, 1), end_date=date(2024, 1, 31),
            observation_dates=[date(2024, 1, 10), date(2024, 1, 11), date(2024, 1, 12)],
        )
        available = {date(2024, 1, 10), date(2024, 1, 12)}
        missing = missing_observation_dates(c, available)
        self.assertEqual(missing, [date(2024, 1, 11)])


class TestReminderIdempotency(TestCase):
    def test_same_reminder_id_for_same_inputs(self):
        r1 = Reminder(
            client_id="CLT001", contract_id="C001",
            event_type=ReminderEventType.BARRIER_BREACH,
            message="test", observation_date=date(2024, 1, 10),
        )
        r2 = Reminder(
            client_id="CLT001", contract_id="C001",
            event_type=ReminderEventType.BARRIER_BREACH,
            message="test", observation_date=date(2024, 1, 10),
        )
        self.assertEqual(r1.reminder_id, r2.reminder_id)

    def test_different_reminder_id_for_different_date(self):
        r1 = Reminder(
            client_id="CLT001", contract_id="C001",
            event_type=ReminderEventType.BARRIER_BREACH,
            message="test", observation_date=date(2024, 1, 10),
        )
        r2 = Reminder(
            client_id="CLT001", contract_id="C001",
            event_type=ReminderEventType.BARRIER_BREACH,
            message="test", observation_date=date(2024, 1, 11),
        )
        self.assertNotEqual(r1.reminder_id, r2.reminder_id)

    def test_reminder_manager_dedup(self):
        mgr = ReminderManager()
        existing: dict[str, Reminder] = {}
        r1 = Reminder(
            client_id="CLT001", contract_id="C001",
            event_type=ReminderEventType.BARRIER_BREACH,
            message="breach", observation_date=date(2024, 1, 10),
        )
        result1 = mgr.add_reminder(r1, existing)
        self.assertTrue(result1.is_new)

        r2 = Reminder(
            client_id="CLT001", contract_id="C001",
            event_type=ReminderEventType.BARRIER_BREACH,
            message="breach", observation_date=date(2024, 1, 10),
        )
        result2 = mgr.add_reminder(r2, existing)
        self.assertFalse(result2.is_new)

    def test_client_contract_dedup(self):
        mgr = ReminderManager()
        reminders = [
            Reminder(client_id="CLT001", contract_id="C001",
                     event_type=ReminderEventType.MISSING_OBSERVATION, message="a",
                     observation_date=date(2024, 1, 10)),
            Reminder(client_id="CLT001", contract_id="C001",
                     event_type=ReminderEventType.MISSING_OBSERVATION, message="b",
                     observation_date=date(2024, 1, 11)),
        ]
        deduped = mgr.dedup_by_client_contract(reminders)
        self.assertEqual(len(deduped), 1)


class TestPriceTimestampValidation(TestCase):
    def test_timestamp_mismatch_detected(self):
        from barrier_watcher.engine import validate_price_timestamp
        p = ObservationPrice(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            price=105.0,
            timestamp=datetime(2024, 1, 12, 15, 0),
        )
        problem = validate_price_timestamp(p, date(2024, 1, 10))
        self.assertIsNotNone(problem)
        self.assertEqual(problem.problem_type, ProblemType.PRICE_TIMESTAMP_MISMATCH)
        self.assertIn("C001", problem.related_material)

    def test_timestamp_ok(self):
        from barrier_watcher.engine import validate_price_timestamp
        p = ObservationPrice(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            price=105.0,
            timestamp=datetime(2024, 1, 10, 15, 0),
        )
        problem = validate_price_timestamp(p, date(2024, 1, 10))
        self.assertIsNone(problem)


class TestBatchProcessor(TestCase):
    def _make_contract(self, cid="C001", client="CLT001", **kwargs):
        defaults = dict(
            contract_id=cid, client_id=client, underlying="HS300",
            option_type="call", start_date=date(2024, 1, 1), end_date=date(2024, 1, 31),
            barrier_type=BarrierType.KNOCK_OUT, barrier_level=110.0,
            barrier_direction=BarrierDirection.UP,
            observation_dates=[date(2024, 1, 10), date(2024, 1, 11)],
        )
        defaults.update(kwargs)
        return Contract(**defaults)

    def test_normal_processing(self):
        engine = BarrierEngine(datetime(2024, 1, 15, 10, 0))
        reminder_mgr = ReminderManager()
        history_mgr = HistoryManager()
        processor = BatchProcessor(engine, reminder_mgr, history_mgr)

        c = self._make_contract()
        prices = {
            "C001": [
                ObservationPrice("C001", date(2024, 1, 10), 105.0, datetime(2024, 1, 10, 15, 0)),
                ObservationPrice("C001", date(2024, 1, 11), 112.0, datetime(2024, 1, 11, 15, 0)),
            ]
        }
        report = processor.process(
            report_date=date(2024, 1, 15),
            contracts=[c],
            prices=prices,
            existing_judgments={},
            existing_reminders={},
        )
        self.assertEqual(len(report.normal_records), 2)
        self.assertEqual(len(report.problem_records), 0)
        self.assertTrue(any(r.judgment == "breached" for r in report.normal_records))

    def test_missing_price_creates_problem(self):
        engine = BarrierEngine(datetime(2024, 1, 15, 10, 0))
        reminder_mgr = ReminderManager()
        history_mgr = HistoryManager()
        processor = BatchProcessor(engine, reminder_mgr, history_mgr)

        c = self._make_contract(
            observation_dates=[date(2024, 1, 10), date(2024, 1, 11), date(2024, 1, 12)]
        )
        prices = {
            "C001": [
                ObservationPrice("C001", date(2024, 1, 10), 105.0, datetime(2024, 1, 10, 15, 0)),
            ]
        }
        report = processor.process(
            report_date=date(2024, 1, 15),
            contracts=[c],
            prices=prices,
            existing_judgments={},
            existing_reminders={},
        )
        missing_problems = [
            p for p in report.problem_records
            if p.problem_type == ProblemType.MISSING_OBSERVATION_PRICE
        ]
        self.assertTrue(len(missing_problems) >= 2)

    def test_missing_barrier_condition_creates_problem(self):
        engine = BarrierEngine(datetime(2024, 1, 15, 10, 0))
        reminder_mgr = ReminderManager()
        history_mgr = HistoryManager()
        processor = BatchProcessor(engine, reminder_mgr, history_mgr)

        c = self._make_contract(barrier_type=None, barrier_level=None, barrier_direction=None)
        prices = {
            "C001": [
                ObservationPrice("C001", date(2024, 1, 10), 105.0, datetime(2024, 1, 10, 15, 0)),
            ]
        }
        report = processor.process(
            report_date=date(2024, 1, 15),
            contracts=[c],
            prices=prices,
            existing_judgments={},
            existing_reminders={},
        )
        condition_problems = [
            p for p in report.problem_records
            if p.problem_type == ProblemType.MISSING_BARRIER_CONDITION
        ]
        self.assertTrue(len(condition_problems) >= 1)

    def test_incremental_does_not_overwrite(self):
        engine = BarrierEngine(datetime(2024, 1, 15, 10, 0))
        reminder_mgr = ReminderManager()
        history_mgr = HistoryManager()
        processor = BatchProcessor(engine, reminder_mgr, history_mgr)

        c = self._make_contract(
            observation_dates=[date(2024, 1, 10), date(2024, 1, 11)]
        )
        prices = {
            "C001": [
                ObservationPrice("C001", date(2024, 1, 10), 105.0, datetime(2024, 1, 10, 15, 0)),
            ]
        }

        existing_judgment = BarrierJudgment(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            status=JudgmentStatus.BREACHED,
            breach_type="knocked_out",
            price_at_observation=105.0,
            barrier_level_used=110.0,
            determined_at=datetime(2024, 1, 10, 16, 0),
            manually_overridden=True,
            override_reason="manual fix",
        )
        existing_judgments = {existing_judgment.judgment_id: existing_judgment}

        report = processor.process(
            report_date=date(2024, 1, 15),
            contracts=[c],
            prices=prices,
            existing_judgments=existing_judgments,
            existing_reminders={},
        )

        c001_0110 = [r for r in report.normal_records if r.observation_date == date(2024, 1, 10)]
        self.assertEqual(len(c001_0110), 0)

    def test_problem_record_has_specific_material(self):
        engine = BarrierEngine(datetime(2024, 1, 15, 10, 0))
        reminder_mgr = ReminderManager()
        history_mgr = HistoryManager()
        processor = BatchProcessor(engine, reminder_mgr, history_mgr)

        c = self._make_contract(barrier_type=None, barrier_level=None, barrier_direction=None)
        prices = {"C001": []}
        report = processor.process(
            report_date=date(2024, 1, 15),
            contracts=[c],
            prices=prices,
            existing_judgments={},
            existing_reminders={},
        )
        for p in report.problem_records:
            self.assertTrue(len(p.related_material) > 0)
            self.assertIn("C001", p.related_material)

    def test_same_client_no_duplicate_reminder(self):
        engine = BarrierEngine(datetime(2024, 1, 15, 10, 0))
        reminder_mgr = ReminderManager()
        history_mgr = HistoryManager()
        processor = BatchProcessor(engine, reminder_mgr, history_mgr)

        c1 = self._make_contract(cid="C001", client="CLT001")
        c2 = self._make_contract(cid="C002", client="CLT001", barrier_level=115.0,
                                 observation_dates=[date(2024, 1, 10)])
        prices = {
            "C001": [
                ObservationPrice("C001", date(2024, 1, 10), 112.0, datetime(2024, 1, 10, 15, 0)),
            ],
            "C002": [],
        }
        report = processor.process(
            report_date=date(2024, 1, 15),
            contracts=[c1, c2],
            prices=prices,
            existing_judgments={},
            existing_reminders={},
        )
        client_reminders = [r for r in report.new_reminders if r.client_id == "CLT001"]
        breach_reminders = [r for r in client_reminders if r.event_type == ReminderEventType.BARRIER_BREACH]
        self.assertTrue(len(breach_reminders) >= 1)


class TestStoreIdempotency(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.store = Store(self.tmpdir)
        self.store.init_workspace()

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_upsert_contracts_preserves_conditions(self):
        c1 = Contract(
            contract_id="C001", client_id="CLT001", underlying="HS300",
            option_type="call", start_date=date(2024, 1, 1), end_date=date(2024, 1, 31),
            barrier_type=BarrierType.KNOCK_OUT, barrier_level=110.0,
            barrier_direction=BarrierDirection.UP,
        )
        self.store.upsert_contracts([c1])

        c2 = Contract(
            contract_id="C001", client_id="CLT001", underlying="HS300",
            option_type="call", start_date=date(2024, 1, 1), end_date=date(2024, 1, 31),
        )
        self.store.upsert_contracts([c2])

        loaded = self.store.load_contracts()
        self.assertEqual(loaded["C001"].barrier_level, 110.0)
        self.assertEqual(loaded["C001"].barrier_type, BarrierType.KNOCK_OUT)

    def test_judgments_not_overwritten(self):
        j1 = BarrierJudgment(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            status=JudgmentStatus.BREACHED,
            determined_at=datetime(2024, 1, 10, 16, 0),
        )
        self.store.save_judgments({j1.judgment_id: j1})

        added, skipped = self.store.upsert_judgments([j1])
        self.assertEqual(skipped, 1)
        self.assertEqual(added, 0)

    def test_manual_override_not_overwritten(self):
        j1 = BarrierJudgment(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            status=JudgmentStatus.BREACHED,
            determined_at=datetime(2024, 1, 10, 16, 0),
            manually_overridden=True,
            override_reason="manual correction",
        )
        self.store.save_judgments({j1.judgment_id: j1})

        j2 = BarrierJudgment(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            status=JudgmentStatus.NOT_BREACHED,
            determined_at=datetime(2024, 1, 11, 10, 0),
        )
        added, skipped = self.store.upsert_judgments([j2])
        self.assertEqual(skipped, 1)

        loaded = self.store.load_judgments()
        j = loaded[j1.judgment_id]
        self.assertEqual(j.status, JudgmentStatus.BREACHED)
        self.assertTrue(j.manually_overridden)

    def test_add_prices_idempotent(self):
        p1 = ObservationPrice(
            "C001", date(2024, 1, 10), 105.0, datetime(2024, 1, 10, 15, 0),
        )
        added1 = self.store.add_prices([p1])
        self.assertEqual(added1, 1)

        added2 = self.store.add_prices([p1])
        self.assertEqual(added2, 0)

    def test_history_append_idempotent(self):
        e1 = HistoryEntry(
            contract_id="C001",
            field_changed="barrier_judgment",
            old_value=None,
            new_value="not_breached",
            changed_by="system",
            changed_at=datetime(2024, 1, 10, 16, 0),
        )
        self.store.append_history([e1])
        self.store.append_history([e1])

        loaded = self.store.load_history()
        self.assertEqual(len(loaded), 1)

    def test_double_process_same_result(self):
        c = Contract(
            contract_id="C001", client_id="CLT001", underlying="HS300",
            option_type="call", start_date=date(2024, 1, 1), end_date=date(2024, 1, 31),
            barrier_type=BarrierType.KNOCK_OUT, barrier_level=110.0,
            barrier_direction=BarrierDirection.UP,
            observation_dates=[date(2024, 1, 10)],
        )
        self.store.upsert_contracts([c])

        p = ObservationPrice(
            "C001", date(2024, 1, 10), 105.0, datetime(2024, 1, 10, 15, 0),
        )
        self.store.add_prices([p])

        engine = BarrierEngine(datetime(2024, 1, 15, 10, 0))
        reminder_mgr = ReminderManager()
        history_mgr = HistoryManager()
        processor = BatchProcessor(engine, reminder_mgr, history_mgr)

        def run_process():
            contracts = self.store.load_contracts()
            prices = self.store.load_prices()
            existing_judgments = self.store.load_judgments()
            existing_reminders = self.store.load_reminders()
            report = processor.process(
                report_date=date(2024, 1, 15),
                contracts=list(contracts.values()),
                prices=prices,
                existing_judgments=existing_judgments,
                existing_reminders=existing_reminders,
            )
            new_judgments = []
            for nr in report.normal_records:
                jid = f"{nr.contract_id}:{nr.observation_date.isoformat()}"
                if jid not in existing_judgments:
                    j = BarrierJudgment(
                        contract_id=nr.contract_id,
                        observation_date=nr.observation_date,
                        status=JudgmentStatus(nr.judgment),
                        barrier_level_used=nr.barrier_level,
                        price_at_observation=nr.price,
                        determined_at=datetime(2024, 1, 15, 10, 0),
                    )
                    new_judgments.append(j)
            self.store.upsert_judgments(new_judgments)
            for r in report.new_reminders:
                existing_reminders[r.reminder_id] = r
            self.store.save_reminders(existing_reminders)
            self.store.append_history(report.history_entries)
            return report

        report1 = run_process()
        report2 = run_process()

        judgments1 = self.store.load_judgments()
        j_count_1 = len(judgments1)

        report3 = run_process()
        judgments2 = self.store.load_judgments()
        j_count_2 = len(judgments2)

        self.assertEqual(j_count_1, j_count_2)

    def test_export_history_csv(self):
        e = HistoryEntry(
            contract_id="C001",
            field_changed="test",
            old_value="old",
            new_value="new",
            changed_by="tester",
            changed_at=datetime(2024, 1, 10, 16, 0),
        )
        self.store.append_history([e])
        output_path = os.path.join(self.tmpdir, "history.csv")
        count = self.store.export_history_csv(output_path)
        self.assertEqual(count, 1)
        self.assertTrue(os.path.exists(output_path))


class TestHistoryOverride(TestCase):
    def test_override_creates_history(self):
        mgr = HistoryManager()
        old = BarrierJudgment(
            contract_id="C001",
            observation_date=date(2024, 1, 10),
            status=JudgmentStatus.NOT_BREACHED,
            determined_at=datetime(2024, 1, 10, 16, 0),
        )
        entry = mgr.record_override(
            old_judgment=old,
            new_status=JudgmentStatus.BREACHED,
            new_breach_type="knocked_out",
            changed_by="trader_zhang",
            reason="盘后确认价格穿线",
        )
        self.assertEqual(entry.field_changed, "barrier_judgment_override")
        self.assertEqual(entry.old_value, "not_breached")
        self.assertEqual(entry.new_value, "breached")
        self.assertEqual(entry.changed_by, "trader_zhang")
        self.assertEqual(entry.reason, "盘后确认价格穿线")


class TestFormatReport(TestCase):
    def test_report_format(self):
        from barrier_watcher.processor import DailyReport
        report = DailyReport(
            report_date=date(2024, 1, 15),
            normal_records=[
                NormalRecord(
                    contract_id="C001",
                    observation_date=date(2024, 1, 10),
                    price=105.0,
                    barrier_level=110.0,
                    barrier_direction="up",
                    judgment="not_breached",
                    barrier_type="knock_out",
                )
            ],
            problem_records=[
                ProblemRecord(
                    contract_id="C002",
                    problem_type=ProblemType.MISSING_OBSERVATION_PRICE,
                    detail="合约 C002 观察日 2024-01-10 缺少观察价格",
                    related_material="观察价格[C002/2024-01-10]",
                    observation_date=date(2024, 1, 10),
                )
            ],
            new_reminders=[
                Reminder(
                    client_id="CLT001",
                    contract_id="C002",
                    event_type=ReminderEventType.MISSING_OBSERVATION,
                    message="缺少观察价格",
                    observation_date=date(2024, 1, 10),
                )
            ],
            existing_reminders=[],
            history_entries=[],
        )
        text = format_report(report)
        self.assertIn("期权障碍观察日报", text)
        self.assertIn("正常记录", text)
        self.assertIn("问题记录", text)
        self.assertIn("C002", text)
        self.assertIn("观察价格[C002/2024-01-10]", text)
