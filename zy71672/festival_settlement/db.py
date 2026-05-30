import sqlite3
import json
import decimal
from datetime import date, datetime
from contextlib import contextmanager
from typing import Optional, List

from .models import (
    ArtistContract, BoxOfficeTransaction, SponsorTerm,
    PerformanceSchedule, PaymentRecord, SettlementLine,
    NoteEntry, AnomalyItem, RecordStatus,
)


DECIMAL_CTX = decimal.Context(prec=28, rounding=decimal.ROUND_HALF_UP)


def _dec(val) -> decimal.Decimal:
    if isinstance(val, decimal.Decimal):
        return val
    return DECIMAL_CTX.create_decimal(str(val))


class Database:
    SCHEMA_VERSION = 1

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None
        self._connect()
        self._ensure_schema()

    def _connect(self):
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")

    @contextmanager
    def _cursor(self):
        cur = self._conn.cursor()
        try:
            yield cur
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise
        finally:
            cur.close()

    def _ensure_schema(self):
        with self._cursor() as cur:
            cur.executescript("""
                CREATE TABLE IF NOT EXISTS schema_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );

                CREATE TABLE IF NOT EXISTS contracts (
                    contract_id TEXT PRIMARY KEY,
                    artist_id TEXT NOT NULL,
                    artist_name TEXT NOT NULL,
                    guarantee_amount TEXT NOT NULL,
                    revenue_share_ratio TEXT NOT NULL,
                    contract_date TEXT NOT NULL,
                    stage TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    source_file TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS boxoffice (
                    txn_id TEXT PRIMARY KEY,
                    txn_date TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    ticket_type TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    unit_price TEXT NOT NULL,
                    total_amount TEXT NOT NULL,
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    source_file TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS sponsors (
                    sponsor_id TEXT PRIMARY KEY,
                    sponsor_name TEXT NOT NULL,
                    exposure_type TEXT NOT NULL,
                    amount TEXT NOT NULL,
                    artist_ids TEXT DEFAULT '[]',
                    deduction_ratio TEXT DEFAULT '0',
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    source_file TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS schedules (
                    schedule_id TEXT PRIMARY KEY,
                    artist_id TEXT NOT NULL,
                    artist_name TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    performance_date TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT NOT NULL,
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    source_file TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS payments (
                    payment_id TEXT PRIMARY KEY,
                    artist_id TEXT NOT NULL,
                    amount TEXT NOT NULL,
                    payment_date TEXT NOT NULL,
                    payment_type TEXT NOT NULL,
                    reference_id TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    source_file TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS settlements (
                    settlement_id TEXT PRIMARY KEY,
                    artist_id TEXT NOT NULL,
                    artist_name TEXT NOT NULL,
                    guarantee_amount TEXT NOT NULL,
                    box_office_share TEXT NOT NULL,
                    sponsor_deduction TEXT NOT NULL,
                    total_due TEXT NOT NULL,
                    total_paid TEXT NOT NULL,
                    variance TEXT NOT NULL,
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    created_at TEXT DEFAULT '',
                    updated_at TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS notes (
                    note_id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    author TEXT DEFAULT 'system'
                );

                CREATE TABLE IF NOT EXISTS anomalies (
                    anomaly_id TEXT PRIMARY KEY,
                    anomaly_type TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    description TEXT NOT NULL,
                    severity TEXT DEFAULT 'warning',
                    resolved INTEGER DEFAULT 0,
                    resolution_note TEXT DEFAULT ''
                );
            """)
            cur.execute(
                "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)",
                ("version", str(self.SCHEMA_VERSION)),
            )

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    # ---- Contracts ----

    def upsert_contract(self, c: ArtistContract):
        with self._cursor() as cur:
            cur.execute("""
                INSERT INTO contracts (contract_id, artist_id, artist_name, guarantee_amount,
                    revenue_share_ratio, contract_date, stage, notes, status, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(contract_id) DO UPDATE SET
                    artist_id=excluded.artist_id, artist_name=excluded.artist_name,
                    guarantee_amount=excluded.guarantee_amount,
                    revenue_share_ratio=excluded.revenue_share_ratio,
                    contract_date=excluded.contract_date, stage=excluded.stage,
                    notes=excluded.notes, status=excluded.status,
                    source_file=excluded.source_file
            """, (c.contract_id, c.artist_id, c.artist_name, str(c.guarantee_amount),
                  str(c.revenue_share_ratio), c.contract_date.isoformat(), c.stage,
                  c.notes, c.status.value, c.source_file))

    def get_contracts(self, status: Optional[str] = None) -> List[ArtistContract]:
        with self._cursor() as cur:
            if status:
                cur.execute("SELECT * FROM contracts WHERE status=?", (status,))
            else:
                cur.execute("SELECT * FROM contracts ORDER BY artist_id")
            return [self._row_to_contract(row) for row in cur.fetchall()]

    def get_contract(self, contract_id: str) -> Optional[ArtistContract]:
        with self._cursor() as cur:
            cur.execute("SELECT * FROM contracts WHERE contract_id=?", (contract_id,))
            row = cur.fetchone()
            return self._row_to_contract(row) if row else None

    def update_contract_status(self, contract_id: str, status: RecordStatus):
        with self._cursor() as cur:
            cur.execute("UPDATE contracts SET status=? WHERE contract_id=?",
                        (status.value, contract_id))

    def _row_to_contract(self, row) -> ArtistContract:
        return ArtistContract(
            contract_id=row["contract_id"], artist_id=row["artist_id"],
            artist_name=row["artist_name"], guarantee_amount=_dec(row["guarantee_amount"]),
            revenue_share_ratio=_dec(row["revenue_share_ratio"]),
            contract_date=date.fromisoformat(row["contract_date"]),
            stage=row["stage"], notes=row["notes"],
            status=RecordStatus(row["status"]), source_file=row["source_file"],
        )

    # ---- Box Office ----

    def upsert_boxoffice(self, t: BoxOfficeTransaction):
        with self._cursor() as cur:
            cur.execute("""
                INSERT INTO boxoffice (txn_id, txn_date, stage, ticket_type, quantity,
                    unit_price, total_amount, notes, status, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(txn_id) DO UPDATE SET
                    txn_date=excluded.txn_date, stage=excluded.stage,
                    ticket_type=excluded.ticket_type, quantity=excluded.quantity,
                    unit_price=excluded.unit_price, total_amount=excluded.total_amount,
                    notes=excluded.notes, status=excluded.status,
                    source_file=excluded.source_file
            """, (t.txn_id, t.txn_date.isoformat(), t.stage, t.ticket_type,
                  t.quantity, str(t.unit_price), str(t.total_amount),
                  t.notes, t.status.value, t.source_file))

    def get_boxoffice(self, status: Optional[str] = None) -> List[BoxOfficeTransaction]:
        with self._cursor() as cur:
            if status:
                cur.execute("SELECT * FROM boxoffice WHERE status=? ORDER BY txn_date, stage", (status,))
            else:
                cur.execute("SELECT * FROM boxoffice ORDER BY txn_date, stage")
            return [self._row_to_boxoffice(row) for row in cur.fetchall()]

    def update_boxoffice_status(self, txn_id: str, status: RecordStatus):
        with self._cursor() as cur:
            cur.execute("UPDATE boxoffice SET status=? WHERE txn_id=?",
                        (status.value, txn_id))

    def _row_to_boxoffice(self, row) -> BoxOfficeTransaction:
        return BoxOfficeTransaction(
            txn_id=row["txn_id"],
            txn_date=date.fromisoformat(row["txn_date"]),
            stage=row["stage"], ticket_type=row["ticket_type"],
            quantity=row["quantity"], unit_price=_dec(row["unit_price"]),
            total_amount=_dec(row["total_amount"]), notes=row["notes"],
            status=RecordStatus(row["status"]), source_file=row["source_file"],
        )

    # ---- Sponsors ----

    def upsert_sponsor(self, s: SponsorTerm):
        with self._cursor() as cur:
            cur.execute("""
                INSERT INTO sponsors (sponsor_id, sponsor_name, exposure_type, amount,
                    artist_ids, deduction_ratio, notes, status, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(sponsor_id) DO UPDATE SET
                    sponsor_name=excluded.sponsor_name, exposure_type=excluded.exposure_type,
                    amount=excluded.amount, artist_ids=excluded.artist_ids,
                    deduction_ratio=excluded.deduction_ratio, notes=excluded.notes,
                    status=excluded.status, source_file=excluded.source_file
            """, (s.sponsor_id, s.sponsor_name, s.exposure_type, str(s.amount),
                  json.dumps(s.artist_ids), str(s.deduction_ratio),
                  s.notes, s.status.value, s.source_file))

    def get_sponsors(self, status: Optional[str] = None) -> List[SponsorTerm]:
        with self._cursor() as cur:
            if status:
                cur.execute("SELECT * FROM sponsors WHERE status=?", (status,))
            else:
                cur.execute("SELECT * FROM sponsors ORDER BY sponsor_id")
            return [self._row_to_sponsor(row) for row in cur.fetchall()]

    def update_sponsor_status(self, sponsor_id: str, status: RecordStatus):
        with self._cursor() as cur:
            cur.execute("UPDATE sponsors SET status=? WHERE sponsor_id=?",
                        (status.value, sponsor_id))

    def _row_to_sponsor(self, row) -> SponsorTerm:
        return SponsorTerm(
            sponsor_id=row["sponsor_id"], sponsor_name=row["sponsor_name"],
            exposure_type=row["exposure_type"], amount=_dec(row["amount"]),
            artist_ids=json.loads(row["artist_ids"]),
            deduction_ratio=_dec(row["deduction_ratio"]),
            notes=row["notes"], status=RecordStatus(row["status"]),
            source_file=row["source_file"],
        )

    # ---- Schedules ----

    def upsert_schedule(self, s: PerformanceSchedule):
        with self._cursor() as cur:
            cur.execute("""
                INSERT INTO schedules (schedule_id, artist_id, artist_name, stage,
                    performance_date, start_time, end_time, notes, status, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(schedule_id) DO UPDATE SET
                    artist_id=excluded.artist_id, artist_name=excluded.artist_name,
                    stage=excluded.stage, performance_date=excluded.performance_date,
                    start_time=excluded.start_time, end_time=excluded.end_time,
                    notes=excluded.notes, status=excluded.status,
                    source_file=excluded.source_file
            """, (s.schedule_id, s.artist_id, s.artist_name, s.stage,
                  s.performance_date.isoformat(), s.start_time, s.end_time,
                  s.notes, s.status.value, s.source_file))

    def get_schedules(self, status: Optional[str] = None) -> List[PerformanceSchedule]:
        with self._cursor() as cur:
            if status:
                cur.execute("SELECT * FROM schedules WHERE status=?", (status,))
            else:
                cur.execute("SELECT * FROM schedules ORDER BY performance_date, start_time")
            return [self._row_to_schedule(row) for row in cur.fetchall()]

    def _row_to_schedule(self, row) -> PerformanceSchedule:
        return PerformanceSchedule(
            schedule_id=row["schedule_id"], artist_id=row["artist_id"],
            artist_name=row["artist_name"], stage=row["stage"],
            performance_date=date.fromisoformat(row["performance_date"]),
            start_time=row["start_time"], end_time=row["end_time"],
            notes=row["notes"], status=RecordStatus(row["status"]),
            source_file=row["source_file"],
        )

    # ---- Payments ----

    def upsert_payment(self, p: PaymentRecord):
        with self._cursor() as cur:
            cur.execute("""
                INSERT INTO payments (payment_id, artist_id, amount, payment_date,
                    payment_type, reference_id, notes, status, source_file)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(payment_id) DO UPDATE SET
                    artist_id=excluded.artist_id, amount=excluded.amount,
                    payment_date=excluded.payment_date, payment_type=excluded.payment_type,
                    reference_id=excluded.reference_id, notes=excluded.notes,
                    status=excluded.status, source_file=excluded.source_file
            """, (p.payment_id, p.artist_id, str(p.amount),
                  p.payment_date.isoformat(), p.payment_type,
                  p.reference_id, p.notes, p.status.value, p.source_file))

    def get_payments(self, artist_id: Optional[str] = None,
                     status: Optional[str] = None) -> List[PaymentRecord]:
        with self._cursor() as cur:
            clauses = []
            params = []
            if artist_id:
                clauses.append("artist_id=?")
                params.append(artist_id)
            if status:
                clauses.append("status=?")
                params.append(status)
            where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            cur.execute(f"SELECT * FROM payments{where} ORDER BY payment_date", params)
            return [self._row_to_payment(row) for row in cur.fetchall()]

    def update_payment_status(self, payment_id: str, status: RecordStatus):
        with self._cursor() as cur:
            cur.execute("UPDATE payments SET status=? WHERE payment_id=?",
                        (status.value, payment_id))

    def _row_to_payment(self, row) -> PaymentRecord:
        return PaymentRecord(
            payment_id=row["payment_id"], artist_id=row["artist_id"],
            amount=_dec(row["amount"]),
            payment_date=date.fromisoformat(row["payment_date"]),
            payment_type=row["payment_type"], reference_id=row["reference_id"],
            notes=row["notes"], status=RecordStatus(row["status"]),
            source_file=row["source_file"],
        )

    # ---- Settlements ----

    def upsert_settlement(self, s: SettlementLine):
        now = datetime.now().isoformat()
        if not s.created_at:
            s.created_at = now
        s.updated_at = now
        with self._cursor() as cur:
            cur.execute("""
                INSERT INTO settlements (settlement_id, artist_id, artist_name,
                    guarantee_amount, box_office_share, sponsor_deduction,
                    total_due, total_paid, variance, notes, status,
                    created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(settlement_id) DO UPDATE SET
                    artist_id=excluded.artist_id, artist_name=excluded.artist_name,
                    guarantee_amount=excluded.guarantee_amount,
                    box_office_share=excluded.box_office_share,
                    sponsor_deduction=excluded.sponsor_deduction,
                    total_due=excluded.total_due, total_paid=excluded.total_paid,
                    variance=excluded.variance, notes=excluded.notes,
                    status=excluded.status, updated_at=excluded.updated_at
            """, (s.settlement_id, s.artist_id, s.artist_name,
                  str(s.guarantee_amount), str(s.box_office_share),
                  str(s.sponsor_deduction), str(s.total_due), str(s.total_paid),
                  str(s.variance), s.notes, s.status.value,
                  s.created_at, s.updated_at))

    def get_settlements(self, status: Optional[str] = None) -> List[SettlementLine]:
        with self._cursor() as cur:
            if status:
                cur.execute("SELECT * FROM settlements WHERE status=?", (status,))
            else:
                cur.execute("SELECT * FROM settlements ORDER BY artist_id")
            return [self._row_to_settlement(row) for row in cur.fetchall()]

    def get_settlement(self, settlement_id: str) -> Optional[SettlementLine]:
        with self._cursor() as cur:
            cur.execute("SELECT * FROM settlements WHERE settlement_id=?", (settlement_id,))
            row = cur.fetchone()
            return self._row_to_settlement(row) if row else None

    def update_settlement_status(self, settlement_id: str, status: RecordStatus):
        now = datetime.now().isoformat()
        with self._cursor() as cur:
            cur.execute("UPDATE settlements SET status=?, updated_at=? WHERE settlement_id=?",
                        (status.value, now, settlement_id))

    def _row_to_settlement(self, row) -> SettlementLine:
        return SettlementLine(
            settlement_id=row["settlement_id"], artist_id=row["artist_id"],
            artist_name=row["artist_name"], guarantee_amount=_dec(row["guarantee_amount"]),
            box_office_share=_dec(row["box_office_share"]),
            sponsor_deduction=_dec(row["sponsor_deduction"]),
            total_due=_dec(row["total_due"]), total_paid=_dec(row["total_paid"]),
            variance=_dec(row["variance"]), notes=row["notes"],
            status=RecordStatus(row["status"]), created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ---- Notes ----

    def add_note(self, n: NoteEntry):
        with self._cursor() as cur:
            cur.execute("""
                INSERT INTO notes (note_id, entity_type, entity_id, content, created_at, author)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(note_id) DO UPDATE SET
                    content=excluded.content, author=excluded.author
            """, (n.note_id, n.entity_type, n.entity_id, n.content,
                  n.created_at, n.author))

    def get_notes(self, entity_type: Optional[str] = None,
                  entity_id: Optional[str] = None) -> List[NoteEntry]:
        with self._cursor() as cur:
            clauses = []
            params = []
            if entity_type:
                clauses.append("entity_type=?")
                params.append(entity_type)
            if entity_id:
                clauses.append("entity_id=?")
                params.append(entity_id)
            where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            cur.execute(f"SELECT * FROM notes{where} ORDER BY created_at", params)
            return [self._row_to_note(row) for row in cur.fetchall()]

    def _row_to_note(self, row) -> NoteEntry:
        return NoteEntry(
            note_id=row["note_id"], entity_type=row["entity_type"],
            entity_id=row["entity_id"], content=row["content"],
            created_at=row["created_at"], author=row["author"],
        )

    # ---- Anomalies ----

    def upsert_anomaly(self, a: AnomalyItem):
        with self._cursor() as cur:
            cur.execute("""
                INSERT INTO anomalies (anomaly_id, anomaly_type, entity_type, entity_id,
                    description, severity, resolved, resolution_note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(anomaly_id) DO UPDATE SET
                    anomaly_type=excluded.anomaly_type, entity_type=excluded.entity_type,
                    entity_id=excluded.entity_id, description=excluded.description,
                    severity=excluded.severity, resolved=excluded.resolved,
                    resolution_note=excluded.resolution_note
            """, (a.anomaly_id, a.anomaly_type, a.entity_type, a.entity_id,
                  a.description, a.severity, 1 if a.resolved else 0,
                  a.resolution_note))

    def get_anomalies(self, resolved: Optional[bool] = None) -> List[AnomalyItem]:
        with self._cursor() as cur:
            if resolved is not None:
                cur.execute("SELECT * FROM anomalies WHERE resolved=? ORDER BY anomaly_id",
                            (1 if resolved else 0,))
            else:
                cur.execute("SELECT * FROM anomalies ORDER BY anomaly_id")
            return [self._row_to_anomaly(row) for row in cur.fetchall()]

    def resolve_anomaly(self, anomaly_id: str, resolution_note: str = ""):
        with self._cursor() as cur:
            cur.execute("UPDATE anomalies SET resolved=1, resolution_note=? WHERE anomaly_id=?",
                        (resolution_note, anomaly_id))

    def _row_to_anomaly(self, row) -> AnomalyItem:
        return AnomalyItem(
            anomaly_id=row["anomaly_id"], anomaly_type=row["anomaly_type"],
            entity_type=row["entity_type"], entity_id=row["entity_id"],
            description=row["description"], severity=row["severity"],
            resolved=bool(row["resolved"]), resolution_note=row["resolution_note"],
        )
