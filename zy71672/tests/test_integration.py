import json
import os
import shutil
import tempfile
import decimal
import pytest

from festival_settlement.contract import load_contracts
from festival_settlement.boxoffice import load_boxoffice, load_schedules, aggregate_by_artist
from festival_settlement.sponsor import load_sponsors, calculate_deductions
from festival_settlement.payment import load_payments
from festival_settlement.detector import detect_anomalies
from festival_settlement.settlement import calculate_settlement, explain_variance
from festival_settlement.notes import add_note
from festival_settlement.report import export_reports, build_summary
from festival_settlement.db import Database
from festival_settlement.models import RecordStatus


SAMPLE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sample_data")


@pytest.fixture
def tmp_dirs():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "output")
    db_path = os.path.join(tmp, "test.db")
    yield tmp, out, db_path
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture
def db(tmp_dirs):
    _, _, db_path = tmp_dirs
    d = Database(db_path)
    yield d
    d.close()


class TestContractLoading:
    def test_load_contracts(self):
        contracts = load_contracts(SAMPLE_DIR)
        assert len(contracts) >= 4
        c0 = next(c for c in contracts if c.contract_id == "CT001")
        assert c0.artist_name == "陈粒"
        assert c0.guarantee_amount == decimal.Decimal("200000")
        assert c0.revenue_share_ratio == decimal.Decimal("0.15")
        assert c0.status == RecordStatus.PENDING

    def test_duplicate_contract_detected(self):
        contracts = load_contracts(SAMPLE_DIR)
        art002 = [c for c in contracts if c.artist_id == "ART002"]
        assert len(art002) == 2


class TestBoxOffice:
    def test_load_transactions(self):
        txns = load_boxoffice(SAMPLE_DIR)
        assert len(txns) >= 3

    def test_aggregate_by_artist(self):
        txns = load_boxoffice(SAMPLE_DIR)
        schedules = load_schedules(SAMPLE_DIR)
        agg = aggregate_by_artist(txns, schedules)
        assert "ART001" in agg
        assert "ART002" in agg
        assert agg["ART001"] > decimal.Decimal("0")


class TestSponsor:
    def test_load_sponsors(self):
        sponsors = load_sponsors(SAMPLE_DIR)
        assert len(sponsors) >= 2

    def test_calculate_deductions(self):
        sponsors = load_sponsors(SAMPLE_DIR)
        all_artists = ["ART001", "ART002", "ART003", "ART005"]
        ded = calculate_deductions(sponsors, all_artists)
        assert "ART001" in ded
        assert ded["ART001"] > decimal.Decimal("0")


class TestAnomalyDetection:
    def test_duplicate_guarantee(self):
        contracts = load_contracts(SAMPLE_DIR)
        sponsors = load_sponsors(SAMPLE_DIR)
        txns = load_boxoffice(SAMPLE_DIR)
        schedules = load_schedules(SAMPLE_DIR)
        agg = aggregate_by_artist(txns, schedules)
        all_artists = list({c.artist_id for c in contracts})
        ded = calculate_deductions(sponsors, all_artists)
        anomalies = detect_anomalies(contracts, sponsors, agg, ded)
        dup = [a for a in anomalies if a.anomaly_type == "duplicate_guarantee"]
        assert len(dup) >= 1

    def test_suspicious_ratio(self):
        contracts = load_contracts(SAMPLE_DIR)
        sponsors = load_sponsors(SAMPLE_DIR)
        txns = load_boxoffice(SAMPLE_DIR)
        schedules = load_schedules(SAMPLE_DIR)
        agg = aggregate_by_artist(txns, schedules)
        all_artists = list({c.artist_id for c in contracts})
        ded = calculate_deductions(sponsors, all_artists)
        anomalies = detect_anomalies(contracts, sponsors, agg, ded)
        sus = [a for a in anomalies if a.anomaly_type == "suspicious_share_ratio"]
        assert len(sus) >= 1


class TestSettlement:
    def test_calculate_settlement(self, db):
        contracts = load_contracts(SAMPLE_DIR)
        for c in contracts:
            db.upsert_contract(c)

        txns = load_boxoffice(SAMPLE_DIR)
        schedules = load_schedules(SAMPLE_DIR)
        payments = load_payments(SAMPLE_DIR)

        agg = aggregate_by_artist(txns, schedules)
        all_artists = list({c.artist_id for c in contracts})
        ded = calculate_deductions(load_sponsors(SAMPLE_DIR), all_artists)

        settlements = calculate_settlement(contracts, agg, ded, payments, db)
        assert len(settlements) >= 3

        art001 = next(s for s in settlements if s.artist_id == "ART001")
        assert art001.guarantee_amount > decimal.Decimal("0")
        assert art001.total_due > decimal.Decimal("0")

    def test_explain_variance(self):
        from festival_settlement.models import SettlementLine
        zero_v = SettlementLine(
            settlement_id="T1", artist_id="A1", artist_name="T",
            guarantee_amount=decimal.Decimal("100"),
            box_office_share=decimal.Decimal("50"),
            sponsor_deduction=decimal.Decimal("10"),
            total_due=decimal.Decimal("140"),
            total_paid=decimal.Decimal("140"),
            variance=decimal.Decimal("0"),
        )
        assert explain_variance(zero_v) == "完全匹配"

        pos_v = SettlementLine(
            settlement_id="T2", artist_id="A2", artist_name="T",
            guarantee_amount=decimal.Decimal("100"),
            box_office_share=decimal.Decimal("0"),
            sponsor_deduction=decimal.Decimal("0"),
            total_due=decimal.Decimal("100"),
            total_paid=decimal.Decimal("120"),
            variance=decimal.Decimal("20"),
        )
        assert "多付" in explain_variance(pos_v)


class TestFullPipeline:
    def test_full_run(self, tmp_dirs):
        tmp, out, db_path = tmp_dirs
        db = Database(db_path)

        contracts = load_contracts(SAMPLE_DIR)
        for c in contracts:
            db.upsert_contract(c)

        txns = load_boxoffice(SAMPLE_DIR)
        schedules = load_schedules(SAMPLE_DIR)
        sponsors = load_sponsors(SAMPLE_DIR)
        payments = load_payments(SAMPLE_DIR)

        for t in txns:
            db.upsert_boxoffice(t)
        for s in schedules:
            db.upsert_schedule(s)
        for sp in sponsors:
            db.upsert_sponsor(sp)
        for p in payments:
            db.upsert_payment(p)

        agg = aggregate_by_artist(txns, schedules)
        all_artists = list({c.artist_id for c in contracts})
        ded = calculate_deductions(sponsors, all_artists)
        anomalies = detect_anomalies(contracts, sponsors, agg, ded)
        for a in anomalies:
            db.upsert_anomaly(a)

        settlements = calculate_settlement(contracts, agg, ded, payments, db)
        for sl in settlements:
            db.upsert_settlement(sl)

        all_notes = db.get_notes()
        result = export_reports(out, settlements, anomalies, all_notes, db)

        assert os.path.isfile(result["settlement_json"])
        assert os.path.isfile(result["settlement_csv"])
        assert os.path.isfile(result["anomalies_json"])
        assert os.path.isfile(result["summary_json"])

        summary = result["summary"]
        assert summary.total_artists > 0
        assert summary.total_guarantee > decimal.Decimal("0")

        db.close()

    def test_deterministic(self, tmp_dirs):
        tmp, out, db_path = tmp_dirs

        def run_once(db_path):
            db = Database(db_path)
            contracts = load_contracts(SAMPLE_DIR)
            txns = load_boxoffice(SAMPLE_DIR)
            schedules = load_schedules(SAMPLE_DIR)
            sponsors = load_sponsors(SAMPLE_DIR)
            payments = load_payments(SAMPLE_DIR)

            agg = aggregate_by_artist(txns, schedules)
            all_artists = list({c.artist_id for c in contracts})
            ded = calculate_deductions(sponsors, all_artists)
            settlements = calculate_settlement(contracts, agg, ded, payments, db)
            db.close()
            return [(s.artist_id, str(s.total_due), str(s.variance)) for s in settlements]

        r1 = run_once(db_path)
        r2 = run_once(db_path)
        assert r1 == r2

    def test_state_persistence(self, tmp_dirs):
        tmp, out, db_path = tmp_dirs
        db = Database(db_path)

        contracts = load_contracts(SAMPLE_DIR)
        for c in contracts:
            db.upsert_contract(c)

        db.update_contract_status("CT001", RecordStatus.CONFIRMED)
        db.close()

        db2 = Database(db_path)
        c = db2.get_contract("CT001")
        assert c.status == RecordStatus.CONFIRMED
        db2.close()

    def test_note_persistence(self, tmp_dirs):
        _, _, db_path = tmp_dirs
        db = Database(db_path)

        add_note(db, "contract", "CT001", "人工复核通过", author="tester")
        notes = db.get_notes(entity_type="contract", entity_id="CT001")
        assert len(notes) == 1
        assert notes[0].content == "人工复核通过"
        db.close()

    def test_anomaly_resolve(self, tmp_dirs):
        _, _, db_path = tmp_dirs
        db = Database(db_path)

        contracts = load_contracts(SAMPLE_DIR)
        sponsors = load_sponsors(SAMPLE_DIR)
        txns = load_boxoffice(SAMPLE_DIR)
        schedules = load_schedules(SAMPLE_DIR)
        agg = aggregate_by_artist(txns, schedules)
        all_artists = list({c.artist_id for c in contracts})
        ded = calculate_deductions(sponsors, all_artists)
        anomalies = detect_anomalies(contracts, sponsors, agg, ded)
        for a in anomalies:
            db.upsert_anomaly(a)

        unresolved = db.get_anomalies(resolved=False)
        assert len(unresolved) > 0

        if unresolved:
            db.resolve_anomaly(unresolved[0].anomaly_id, "确认处理")
            still_unresolved = db.get_anomalies(resolved=False)
            assert len(still_unresolved) == len(anomalies) - 1

        db.close()
