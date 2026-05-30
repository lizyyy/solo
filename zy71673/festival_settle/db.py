import sqlite3
import os
from typing import List, Optional, Tuple
from decimal import Decimal
from .models import (
    Contract, BoxOfficeRecord, SponsorRecord, PaymentRecord,
    SettlementRecord, RecordStatus, PipelineStage, PipelineState
)

DB_FILENAME = ".festival_settle.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_name TEXT NOT NULL,
    guarantee_amount TEXT NOT NULL DEFAULT '0',
    revenue_share_ratio TEXT NOT NULL DEFAULT '0',
    sponsor_clause TEXT NOT NULL DEFAULT '',
    performance_slot TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'provisional',
    created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS box_office (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT '',
    artist_name TEXT NOT NULL,
    ticket_revenue TEXT NOT NULL DEFAULT '0',
    ticket_count INTEGER NOT NULL DEFAULT 0,
    performance_slot TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'provisional',
    created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sponsor_name TEXT NOT NULL DEFAULT '',
    artist_name TEXT NOT NULL,
    exposure_amount TEXT NOT NULL DEFAULT '0',
    deduction_amount TEXT NOT NULL DEFAULT '0',
    remarks TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'provisional',
    created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_name TEXT NOT NULL,
    amount TEXT NOT NULL DEFAULT '0',
    payment_date TEXT NOT NULL DEFAULT '',
    payment_type TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'provisional',
    created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_name TEXT NOT NULL,
    performance_slot TEXT NOT NULL DEFAULT '',
    guarantee_amount TEXT NOT NULL DEFAULT '0',
    box_office_revenue TEXT NOT NULL DEFAULT '0',
    revenue_share_ratio TEXT NOT NULL DEFAULT '0',
    revenue_share_amount TEXT NOT NULL DEFAULT '0',
    sponsor_deduction TEXT NOT NULL DEFAULT '0',
    total_entitlement TEXT NOT NULL DEFAULT '0',
    total_paid TEXT NOT NULL DEFAULT '0',
    net_due TEXT NOT NULL DEFAULT '0',
    issues TEXT NOT NULL DEFAULT '',
    variance_explanation TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'provisional',
    stage TEXT NOT NULL DEFAULT 'settlement_calculated',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pipeline_state (
    artist_name TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'contract_parsed',
    status TEXT NOT NULL DEFAULT 'provisional',
    updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_contracts_hash ON contracts(content_hash);
CREATE INDEX IF NOT EXISTS idx_contracts_artist ON contracts(artist_name);
CREATE INDEX IF NOT EXISTS idx_box_office_hash ON box_office(content_hash);
CREATE INDEX IF NOT EXISTS idx_box_office_artist ON box_office(artist_name);
CREATE INDEX IF NOT EXISTS idx_sponsors_hash ON sponsors(content_hash);
CREATE INDEX IF NOT EXISTS idx_sponsors_artist ON sponsors(artist_name);
CREATE INDEX IF NOT EXISTS idx_payments_hash ON payments(content_hash);
CREATE INDEX IF NOT EXISTS idx_payments_artist ON payments(artist_name);
CREATE INDEX IF NOT EXISTS idx_settlements_artist ON settlements(artist_name);
"""


class Database:
    def __init__(self, output_dir: str):
        self.db_path = os.path.join(output_dir, DB_FILENAME)
        self.conn: Optional[sqlite3.Connection] = None

    def connect(self):
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(SCHEMA_SQL)
        self.conn.commit()

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None

    def hash_exists(self, table: str, content_hash: str) -> bool:
        cur = self.conn.execute(
            f"SELECT 1 FROM {table} WHERE content_hash = ?", (content_hash,)
        )
        return cur.fetchone() is not None

    def insert_contract(self, c: Contract) -> int:
        cur = self.conn.execute(
            """INSERT OR IGNORE INTO contracts
            (artist_name, guarantee_amount, revenue_share_ratio, sponsor_clause,
             performance_slot, remarks, content_hash, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (c.artist_name, str(c.guarantee_amount), str(c.revenue_share_ratio),
             c.sponsor_clause, c.performance_slot, c.remarks,
             c.content_hash, c.status.value, c.created_at)
        )
        self.conn.commit()
        return cur.lastrowid

    def insert_box_office(self, r: BoxOfficeRecord) -> int:
        cur = self.conn.execute(
            """INSERT OR IGNORE INTO box_office
            (date, artist_name, ticket_revenue, ticket_count, performance_slot,
             remarks, content_hash, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (r.date, r.artist_name, str(r.ticket_revenue), r.ticket_count,
             r.performance_slot, r.remarks, r.content_hash,
             r.status.value, r.created_at)
        )
        self.conn.commit()
        return cur.lastrowid

    def insert_sponsor(self, r: SponsorRecord) -> int:
        cur = self.conn.execute(
            """INSERT OR IGNORE INTO sponsors
            (sponsor_name, artist_name, exposure_amount, deduction_amount,
             remarks, content_hash, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (r.sponsor_name, r.artist_name, str(r.exposure_amount),
             str(r.deduction_amount), r.remarks, r.content_hash,
             r.status.value, r.created_at)
        )
        self.conn.commit()
        return cur.lastrowid

    def insert_payment(self, r: PaymentRecord) -> int:
        cur = self.conn.execute(
            """INSERT OR IGNORE INTO payments
            (artist_name, amount, payment_date, payment_type, remarks,
             content_hash, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (r.artist_name, str(r.amount), r.payment_date, r.payment_type,
             r.remarks, r.content_hash, r.status.value, r.created_at)
        )
        self.conn.commit()
        return cur.lastrowid

    def get_contracts(self, status: Optional[str] = None) -> List[Contract]:
        if status:
            cur = self.conn.execute(
                "SELECT * FROM contracts WHERE status = ? ORDER BY artist_name",
                (status,)
            )
        else:
            cur = self.conn.execute("SELECT * FROM contracts ORDER BY artist_name")
        return [self._row_to_contract(row) for row in cur.fetchall()]

    def get_box_office(self, artist_name: Optional[str] = None) -> List[BoxOfficeRecord]:
        if artist_name:
            cur = self.conn.execute(
                "SELECT * FROM box_office WHERE artist_name = ? ORDER BY date",
                (artist_name,)
            )
        else:
            cur = self.conn.execute("SELECT * FROM box_office ORDER BY date")
        return [self._row_to_box_office(row) for row in cur.fetchall()]

    def get_sponsors(self, artist_name: Optional[str] = None) -> List[SponsorRecord]:
        if artist_name:
            cur = self.conn.execute(
                "SELECT * FROM sponsors WHERE artist_name = ? ORDER BY sponsor_name",
                (artist_name,)
            )
        else:
            cur = self.conn.execute("SELECT * FROM sponsors ORDER BY sponsor_name")
        return [self._row_to_sponsor(row) for row in cur.fetchall()]

    def get_payments(self, artist_name: Optional[str] = None) -> List[PaymentRecord]:
        if artist_name:
            cur = self.conn.execute(
                "SELECT * FROM payments WHERE artist_name = ? ORDER BY payment_date",
                (artist_name,)
            )
        else:
            cur = self.conn.execute("SELECT * FROM payments ORDER BY payment_date")
        return [self._row_to_payment(row) for row in cur.fetchall()]

    def upsert_settlement(self, s: SettlementRecord) -> int:
        existing = self.conn.execute(
            "SELECT id, status FROM settlements WHERE artist_name = ? AND performance_slot = ?",
            (s.artist_name, s.performance_slot)
        ).fetchone()
        if existing and existing["status"] in (RecordStatus.CONFIRMED.value, RecordStatus.REJECTED.value):
            return existing["id"]
        if existing:
            self.conn.execute(
                """UPDATE settlements SET
                guarantee_amount=?, box_office_revenue=?, revenue_share_ratio=?,
                revenue_share_amount=?, sponsor_deduction=?, total_entitlement=?,
                total_paid=?, net_due=?, issues=?, variance_explanation=?,
                remarks=?, stage=?, updated_at=?
                WHERE id=?""",
                (str(s.guarantee_amount), str(s.box_office_revenue),
                 str(s.revenue_share_ratio), str(s.revenue_share_amount),
                 str(s.sponsor_deduction), str(s.total_entitlement),
                 str(s.total_paid), str(s.net_due), s.issues,
                 s.variance_explanation, s.remarks,
                 s.stage.value, s.updated_at, existing["id"])
            )
            self.conn.commit()
            return existing["id"]
        cur = self.conn.execute(
            """INSERT INTO settlements
            (artist_name, performance_slot, guarantee_amount, box_office_revenue,
             revenue_share_ratio, revenue_share_amount, sponsor_deduction,
             total_entitlement, total_paid, net_due, issues,
             variance_explanation, remarks, status, stage, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (s.artist_name, s.performance_slot, str(s.guarantee_amount),
             str(s.box_office_revenue), str(s.revenue_share_ratio),
             str(s.revenue_share_amount), str(s.sponsor_deduction),
             str(s.total_entitlement), str(s.total_paid), str(s.net_due),
             s.issues, s.variance_explanation, s.remarks, s.status.value,
             s.stage.value, s.created_at, s.updated_at)
        )
        self.conn.commit()
        return cur.lastrowid

    def get_settlements(self, status: Optional[str] = None) -> List[SettlementRecord]:
        if status:
            cur = self.conn.execute(
                "SELECT * FROM settlements WHERE status = ? ORDER BY artist_name",
                (status,)
            )
        else:
            cur = self.conn.execute("SELECT * FROM settlements ORDER BY artist_name")
        return [self._row_to_settlement(row) for row in cur.fetchall()]

    def update_settlement_status(self, artist_name: str, performance_slot: str,
                                  status: RecordStatus, now: str):
        self.conn.execute(
            """UPDATE settlements SET status=?, updated_at=?
            WHERE artist_name=? AND performance_slot=?""",
            (status.value, now, artist_name, performance_slot)
        )
        self.conn.commit()

    def update_record_status(self, table: str, record_id: int, status: RecordStatus):
        self.conn.execute(
            f"UPDATE {table} SET status=? WHERE id=?",
            (status.value, record_id)
        )
        self.conn.commit()

    def upsert_pipeline_state(self, state: PipelineState):
        self.conn.execute(
            """INSERT INTO pipeline_state (artist_name, stage, status, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(artist_name) DO UPDATE SET
            stage=excluded.stage, status=excluded.status, updated_at=excluded.updated_at""",
            (state.artist_name, state.stage.value, state.status.value, state.updated_at)
        )
        self.conn.commit()

    def get_pipeline_state(self, artist_name: str) -> Optional[PipelineState]:
        cur = self.conn.execute(
            "SELECT * FROM pipeline_state WHERE artist_name = ?",
            (artist_name,)
        )
        row = cur.fetchone()
        if not row:
            return None
        return PipelineState(
            artist_name=row["artist_name"],
            stage=PipelineStage(row["stage"]),
            status=RecordStatus(row["status"]),
            updated_at=row["updated_at"]
        )

    def get_all_pipeline_states(self) -> List[PipelineState]:
        cur = self.conn.execute("SELECT * FROM pipeline_state ORDER BY artist_name")
        return [
            PipelineState(
                artist_name=row["artist_name"],
                stage=PipelineStage(row["stage"]),
                status=RecordStatus(row["status"]),
                updated_at=row["updated_at"]
            )
            for row in cur.fetchall()
        ]

    def clear_provisional(self, table: str):
        self.conn.execute(f"DELETE FROM {table} WHERE status = 'provisional'")
        self.conn.commit()

    def clear_provisional_settlements(self):
        self.clear_provisional("settlements")

    def _row_to_contract(self, row) -> Contract:
        return Contract(
            id=row["id"], artist_name=row["artist_name"],
            guarantee_amount=Decimal(row["guarantee_amount"]),
            revenue_share_ratio=Decimal(row["revenue_share_ratio"]),
            sponsor_clause=row["sponsor_clause"],
            performance_slot=row["performance_slot"],
            remarks=row["remarks"], content_hash=row["content_hash"],
            status=RecordStatus(row["status"]), created_at=row["created_at"]
        )

    def _row_to_box_office(self, row) -> BoxOfficeRecord:
        return BoxOfficeRecord(
            id=row["id"], date=row["date"], artist_name=row["artist_name"],
            ticket_revenue=Decimal(row["ticket_revenue"]),
            ticket_count=row["ticket_count"],
            performance_slot=row["performance_slot"],
            remarks=row["remarks"], content_hash=row["content_hash"],
            status=RecordStatus(row["status"]), created_at=row["created_at"]
        )

    def _row_to_sponsor(self, row) -> SponsorRecord:
        return SponsorRecord(
            id=row["id"], sponsor_name=row["sponsor_name"],
            artist_name=row["artist_name"],
            exposure_amount=Decimal(row["exposure_amount"]),
            deduction_amount=Decimal(row["deduction_amount"]),
            remarks=row["remarks"], content_hash=row["content_hash"],
            status=RecordStatus(row["status"]), created_at=row["created_at"]
        )

    def _row_to_payment(self, row) -> PaymentRecord:
        return PaymentRecord(
            id=row["id"], artist_name=row["artist_name"],
            amount=Decimal(row["amount"]),
            payment_date=row["payment_date"],
            payment_type=row["payment_type"],
            remarks=row["remarks"], content_hash=row["content_hash"],
            status=RecordStatus(row["status"]), created_at=row["created_at"]
        )

    def _row_to_settlement(self, row) -> SettlementRecord:
        return SettlementRecord(
            id=row["id"], artist_name=row["artist_name"],
            performance_slot=row["performance_slot"],
            guarantee_amount=Decimal(row["guarantee_amount"]),
            box_office_revenue=Decimal(row["box_office_revenue"]),
            revenue_share_ratio=Decimal(row["revenue_share_ratio"]),
            revenue_share_amount=Decimal(row["revenue_share_amount"]),
            sponsor_deduction=Decimal(row["sponsor_deduction"]),
            total_entitlement=Decimal(row["total_entitlement"]),
            total_paid=Decimal(row["total_paid"]),
            net_due=Decimal(row["net_due"]),
            issues=row["issues"],
            variance_explanation=row["variance_explanation"],
            remarks=row["remarks"],
            status=RecordStatus(row["status"]),
            stage=PipelineStage(row["stage"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
