from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from .hasher import compute_batch_hash
from .models import (
    AnomalyRecord,
    AnomalyType,
    AttributionResult,
    AttributionRun,
    EvidenceLink,
    EvidenceType,
    FaultRecord,
    OrbitalElement,
    RunStatus,
    Severity,
    TelemetrySegment,
    WindowEntry,
)

_DB_SCHEMA = """
CREATE TABLE IF NOT EXISTS fault_records (
    fault_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    subsystem TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS telemetry_segments (
    seg_id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    source TEXT NOT NULL,
    frame_count INTEGER NOT NULL,
    expected_frames INTEGER NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS orbital_elements (
    element_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    semi_major_axis REAL,
    eccentricity REAL,
    inclination REAL,
    raan REAL,
    arg_perigee REAL,
    mean_anomaly REAL,
    metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS window_entries (
    window_id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    task_type TEXT NOT NULL,
    subsystem TEXT NOT NULL,
    overlap_with TEXT NOT NULL DEFAULT '[]',
    metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS anomaly_records (
    anomaly_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    telemetry_seg_id TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    observed_value TEXT,
    expected_value TEXT,
    metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS attribution_runs (
    run_id TEXT PRIMARY KEY,
    run_timestamp TEXT NOT NULL,
    batch_hash TEXT NOT NULL,
    input_anomaly_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS attribution_results (
    result_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    anomaly_id TEXT NOT NULL,
    attributed_cause TEXT NOT NULL,
    confidence REAL NOT NULL,
    verifiable_reason TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (run_id) REFERENCES attribution_runs(run_id),
    FOREIGN KEY (anomaly_id) REFERENCES anomaly_records(anomaly_id)
);

CREATE TABLE IF NOT EXISTS evidence_links (
    link_id TEXT PRIMARY KEY,
    result_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    relevance TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (result_id) REFERENCES attribution_results(result_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_batch_hash ON attribution_runs(batch_hash);
CREATE INDEX IF NOT EXISTS idx_results_run_id ON attribution_results(run_id);
CREATE INDEX IF NOT EXISTS idx_results_anomaly_id ON attribution_results(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_links_result_id ON evidence_links(result_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_seg_id ON anomaly_records(telemetry_seg_id);
CREATE INDEX IF NOT EXISTS idx_fault_subsystem ON fault_records(subsystem);
CREATE INDEX IF NOT EXISTS idx_window_subsystem ON window_entries(subsystem);
"""


class Store:
    def __init__(self, db_path: str | Path) -> None:
        self._db_path = Path(db_path)
        self._conn: sqlite3.Connection | None = None

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._db_path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(str(self._db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.executescript(_DB_SCHEMA)
        return self._conn

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def _upsert(self, table: str, data: dict[str, Any]) -> None:
        conn = self._get_conn()
        cols = ", ".join(data.keys())
        placeholders = ", ".join(f":{k}" for k in data.keys())
        sql = f"INSERT OR REPLACE INTO {table} ({cols}) VALUES ({placeholders})"
        conn.execute(sql, data)
        conn.commit()

    def insert_fault_record(self, rec: FaultRecord) -> None:
        self._upsert("fault_records", {
            "fault_id": rec.fault_id,
            "timestamp": rec.timestamp.isoformat(),
            "subsystem": rec.subsystem,
            "description": rec.description,
            "severity": rec.severity.value,
            "metadata": json.dumps(rec.metadata, ensure_ascii=False),
        })

    def insert_telemetry_segment(self, seg: TelemetrySegment) -> None:
        self._upsert("telemetry_segments", {
            "seg_id": seg.seg_id,
            "start_time": seg.start_time.isoformat(),
            "end_time": seg.end_time.isoformat(),
            "source": seg.source,
            "frame_count": seg.frame_count,
            "expected_frames": seg.expected_frames,
            "metadata": json.dumps(seg.metadata, ensure_ascii=False),
        })

    def insert_orbital_element(self, elem: OrbitalElement) -> None:
        self._upsert("orbital_elements", {
            "element_id": elem.element_id,
            "timestamp": elem.timestamp.isoformat(),
            "semi_major_axis": elem.semi_major_axis,
            "eccentricity": elem.eccentricity,
            "inclination": elem.inclination,
            "raan": elem.raan,
            "arg_perigee": elem.arg_perigee,
            "mean_anomaly": elem.mean_anomaly,
            "metadata": json.dumps(elem.metadata, ensure_ascii=False),
        })

    def insert_window_entry(self, win: WindowEntry) -> None:
        self._upsert("window_entries", {
            "window_id": win.window_id,
            "start_time": win.start_time.isoformat(),
            "end_time": win.end_time.isoformat(),
            "task_type": win.task_type,
            "subsystem": win.subsystem,
            "overlap_with": json.dumps(win.overlap_with, ensure_ascii=False),
            "metadata": json.dumps(win.metadata, ensure_ascii=False),
        })

    def insert_anomaly_record(self, rec: AnomalyRecord) -> None:
        self._upsert("anomaly_records", {
            "anomaly_id": rec.anomaly_id,
            "timestamp": rec.timestamp.isoformat(),
            "anomaly_type": rec.anomaly_type.value,
            "telemetry_seg_id": rec.telemetry_seg_id,
            "description": rec.description,
            "severity": rec.severity.value,
            "observed_value": json.dumps(rec.observed_value, ensure_ascii=False) if rec.observed_value is not None else None,
            "expected_value": json.dumps(rec.expected_value, ensure_ascii=False) if rec.expected_value is not None else None,
            "metadata": json.dumps(rec.metadata, ensure_ascii=False),
        })

    def check_previous_run(self, batch_hash: str) -> list[AttributionRun]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM attribution_runs WHERE batch_hash = ? ORDER BY run_timestamp",
            (batch_hash,),
        ).fetchall()
        return [
            AttributionRun(
                run_id=r["run_id"],
                run_timestamp=datetime.fromisoformat(r["run_timestamp"]),
                batch_hash=r["batch_hash"],
                input_anomaly_count=r["input_anomaly_count"],
                status=RunStatus(r["status"]),
                notes=r["notes"],
                metadata=json.loads(r["metadata"]),
            )
            for r in rows
        ]

    def create_attribution_run(
        self,
        anomalies: list[AnomalyRecord],
        status: RunStatus = RunStatus.COMPLETED,
        notes: str = "",
    ) -> AttributionRun:
        batch_items = [
            {
                "anomaly_id": a.anomaly_id,
                "anomaly_type": a.anomaly_type.value,
                "telemetry_seg_id": a.telemetry_seg_id,
                "timestamp": a.timestamp.isoformat(),
            }
            for a in anomalies
        ]
        batch_hash = compute_batch_hash(batch_items)
        run = AttributionRun(
            run_id=str(uuid.uuid4()),
            run_timestamp=datetime.now(),
            batch_hash=batch_hash,
            input_anomaly_count=len(anomalies),
            status=status,
            notes=notes,
        )
        self._upsert("attribution_runs", {
            "run_id": run.run_id,
            "run_timestamp": run.run_timestamp.isoformat(),
            "batch_hash": run.batch_hash,
            "input_anomaly_count": run.input_anomaly_count,
            "status": run.status.value,
            "notes": run.notes,
            "metadata": json.dumps(run.metadata, ensure_ascii=False),
        })
        return run

    def insert_attribution_result(self, result: AttributionResult) -> None:
        conn = self._get_conn()
        conn.execute(
            """INSERT INTO attribution_results
               (result_id, run_id, anomaly_id, attributed_cause, confidence, verifiable_reason, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                result.result_id,
                result.run_id,
                result.anomaly_id,
                result.attributed_cause,
                result.confidence,
                result.verifiable_reason,
                json.dumps(result.metadata, ensure_ascii=False),
            ),
        )
        for link in result.evidence_links:
            conn.execute(
                """INSERT INTO evidence_links
                   (link_id, result_id, source_type, source_id, relevance, excerpt)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    link.link_id,
                    result.result_id,
                    link.source_type.value,
                    link.source_id,
                    link.relevance,
                    link.excerpt,
                ),
            )
        conn.commit()

    def get_fault_record(self, fault_id: str) -> FaultRecord | None:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM fault_records WHERE fault_id = ?", (fault_id,)).fetchone()
        if row is None:
            return None
        return FaultRecord(
            fault_id=row["fault_id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            subsystem=row["subsystem"],
            description=row["description"],
            severity=Severity(row["severity"]),
            metadata=json.loads(row["metadata"]),
        )

    def get_telemetry_segment(self, seg_id: str) -> TelemetrySegment | None:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM telemetry_segments WHERE seg_id = ?", (seg_id,)).fetchone()
        if row is None:
            return None
        return TelemetrySegment(
            seg_id=row["seg_id"],
            start_time=datetime.fromisoformat(row["start_time"]),
            end_time=datetime.fromisoformat(row["end_time"]),
            source=row["source"],
            frame_count=row["frame_count"],
            expected_frames=row["expected_frames"],
            metadata=json.loads(row["metadata"]),
        )

    def get_orbital_element(self, element_id: str) -> OrbitalElement | None:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM orbital_elements WHERE element_id = ?", (element_id,)).fetchone()
        if row is None:
            return None
        return OrbitalElement(
            element_id=row["element_id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            semi_major_axis=row["semi_major_axis"],
            eccentricity=row["eccentricity"],
            inclination=row["inclination"],
            raan=row["raan"],
            arg_perigee=row["arg_perigee"],
            mean_anomaly=row["mean_anomaly"],
            metadata=json.loads(row["metadata"]),
        )

    def get_window_entry(self, window_id: str) -> WindowEntry | None:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM window_entries WHERE window_id = ?", (window_id,)).fetchone()
        if row is None:
            return None
        return WindowEntry(
            window_id=row["window_id"],
            start_time=datetime.fromisoformat(row["start_time"]),
            end_time=datetime.fromisoformat(row["end_time"]),
            task_type=row["task_type"],
            subsystem=row["subsystem"],
            overlap_with=json.loads(row["overlap_with"]),
            metadata=json.loads(row["metadata"]),
        )

    def get_anomaly_record(self, anomaly_id: str) -> AnomalyRecord | None:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM anomaly_records WHERE anomaly_id = ?", (anomaly_id,)).fetchone()
        if row is None:
            return None
        return AnomalyRecord(
            anomaly_id=row["anomaly_id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            anomaly_type=AnomalyType(row["anomaly_type"]),
            telemetry_seg_id=row["telemetry_seg_id"],
            description=row["description"],
            severity=Severity(row["severity"]),
            observed_value=json.loads(row["observed_value"]) if row["observed_value"] else None,
            expected_value=json.loads(row["expected_value"]) if row["expected_value"] else None,
            metadata=json.loads(row["metadata"]),
        )

    def get_attribution_results_for_run(self, run_id: str) -> list[AttributionResult]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM attribution_results WHERE run_id = ?", (run_id,)
        ).fetchall()
        results = []
        for r in rows:
            link_rows = conn.execute(
                "SELECT * FROM evidence_links WHERE result_id = ?", (r["result_id"],)
            ).fetchall()
            links = [
                EvidenceLink(
                    link_id=lr["link_id"],
                    result_id=lr["result_id"],
                    source_type=EvidenceType(lr["source_type"]),
                    source_id=lr["source_id"],
                    relevance=lr["relevance"],
                    excerpt=lr["excerpt"],
                )
                for lr in link_rows
            ]
            results.append(
                AttributionResult(
                    result_id=r["result_id"],
                    run_id=r["run_id"],
                    anomaly_id=r["anomaly_id"],
                    attributed_cause=r["attributed_cause"],
                    confidence=r["confidence"],
                    verifiable_reason=r["verifiable_reason"],
                    evidence_links=links,
                    metadata=json.loads(r["metadata"]),
                )
            )
        return results

    def get_all_runs(self) -> list[AttributionRun]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM attribution_runs ORDER BY run_timestamp"
        ).fetchall()
        return [
            AttributionRun(
                run_id=r["run_id"],
                run_timestamp=datetime.fromisoformat(r["run_timestamp"]),
                batch_hash=r["batch_hash"],
                input_anomaly_count=r["input_anomaly_count"],
                status=RunStatus(r["status"]),
                notes=r["notes"],
                metadata=json.loads(r["metadata"]),
            )
            for r in rows
        ]

    def get_anomalies_for_segment(self, seg_id: str) -> list[AnomalyRecord]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM anomaly_records WHERE telemetry_seg_id = ?", (seg_id,)
        ).fetchall()
        return [
            AnomalyRecord(
                anomaly_id=r["anomaly_id"],
                timestamp=datetime.fromisoformat(r["timestamp"]),
                anomaly_type=AnomalyType(r["anomaly_type"]),
                telemetry_seg_id=r["telemetry_seg_id"],
                description=r["description"],
                severity=Severity(r["severity"]),
                observed_value=json.loads(r["observed_value"]) if r["observed_value"] else None,
                expected_value=json.loads(r["expected_value"]) if r["expected_value"] else None,
                metadata=json.loads(r["metadata"]),
            )
            for r in rows
        ]

    def get_faults_for_subsystem(self, subsystem: str) -> list[FaultRecord]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM fault_records WHERE subsystem = ? ORDER BY timestamp", (subsystem,)
        ).fetchall()
        return [
            FaultRecord(
                fault_id=r["fault_id"],
                timestamp=datetime.fromisoformat(r["timestamp"]),
                subsystem=r["subsystem"],
                description=r["description"],
                severity=Severity(r["severity"]),
                metadata=json.loads(r["metadata"]),
            )
            for r in rows
        ]

    def get_windows_for_subsystem(self, subsystem: str) -> list[WindowEntry]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM window_entries WHERE subsystem = ? ORDER BY start_time", (subsystem,)
        ).fetchall()
        return [
            WindowEntry(
                window_id=r["window_id"],
                start_time=datetime.fromisoformat(r["start_time"]),
                end_time=datetime.fromisoformat(r["end_time"]),
                task_type=r["task_type"],
                subsystem=r["subsystem"],
                overlap_with=json.loads(r["overlap_with"]),
                metadata=json.loads(r["metadata"]),
            )
            for r in rows
        ]

    def trace_result_to_evidence(self, result_id: str) -> dict[str, Any]:
        conn = self._get_conn()
        result_row = conn.execute(
            "SELECT * FROM attribution_results WHERE result_id = ?", (result_id,)
        ).fetchone()
        if result_row is None:
            return {}

        link_rows = conn.execute(
            "SELECT * FROM evidence_links WHERE result_id = ?", (result_id,)
        ).fetchall()

        evidence_chain: dict[str, Any] = {
            "result_id": result_id,
            "anomaly_id": result_row["anomaly_id"],
            "attributed_cause": result_row["attributed_cause"],
            "verifiable_reason": result_row["verifiable_reason"],
            "confidence": result_row["confidence"],
            "evidence": [],
        }

        for lr in link_rows:
            source_type = lr["source_type"]
            source_id = lr["source_id"]
            detail: dict[str, Any] = {
                "link_id": lr["link_id"],
                "source_type": source_type,
                "source_id": source_id,
                "relevance": lr["relevance"],
                "excerpt": lr["excerpt"],
                "source_detail": None,
            }

            if source_type == EvidenceType.FAULT_RECORD.value:
                rec = self.get_fault_record(source_id)
                if rec:
                    detail["source_detail"] = {
                        "timestamp": rec.timestamp.isoformat(),
                        "subsystem": rec.subsystem,
                        "description": rec.description,
                        "severity": rec.severity.value,
                    }
            elif source_type == EvidenceType.ORBITAL_ELEMENT.value:
                rec = self.get_orbital_element(source_id)
                if rec:
                    detail["source_detail"] = {
                        "timestamp": rec.timestamp.isoformat(),
                        "semi_major_axis": rec.semi_major_axis,
                        "eccentricity": rec.eccentricity,
                        "inclination": rec.inclination,
                        "raan": rec.raan,
                        "arg_perigee": rec.arg_perigee,
                        "mean_anomaly": rec.mean_anomaly,
                    }
            elif source_type == EvidenceType.TELEMETRY_SEGMENT.value:
                rec = self.get_telemetry_segment(source_id)
                if rec:
                    detail["source_detail"] = {
                        "start_time": rec.start_time.isoformat(),
                        "end_time": rec.end_time.isoformat(),
                        "source": rec.source,
                        "frame_count": rec.frame_count,
                        "expected_frames": rec.expected_frames,
                    }
            elif source_type == EvidenceType.WINDOW_ENTRY.value:
                rec = self.get_window_entry(source_id)
                if rec:
                    detail["source_detail"] = {
                        "start_time": rec.start_time.isoformat(),
                        "end_time": rec.end_time.isoformat(),
                        "task_type": rec.task_type,
                        "overlap_with": rec.overlap_with,
                    }

            evidence_chain["evidence"].append(detail)

        return evidence_chain

    def detect_window_overlaps(self) -> list[dict[str, Any]]:
        conn = self._get_conn()
        windows = conn.execute(
            "SELECT * FROM window_entries ORDER BY start_time"
        ).fetchall()

        overlaps: list[dict[str, Any]] = []
        window_list = list(windows)

        for i, w1 in enumerate(window_list):
            for w2 in window_list[i + 1:]:
                w1_start = datetime.fromisoformat(w1["start_time"])
                w1_end = datetime.fromisoformat(w1["end_time"])
                w2_start = datetime.fromisoformat(w2["start_time"])
                w2_end = datetime.fromisoformat(w2["end_time"])

                if w2_start < w1_end and w1_start < w2_end:
                    overlap_start = max(w1_start, w2_start)
                    overlap_end = min(w1_end, w2_end)
                    overlaps.append({
                        "window_a": w1["window_id"],
                        "window_b": w2["window_id"],
                        "subsystem_a": w1["subsystem"],
                        "subsystem_b": w2["subsystem"],
                        "overlap_start": overlap_start.isoformat(),
                        "overlap_end": overlap_end.isoformat(),
                        "overlap_seconds": (overlap_end - overlap_start).total_seconds(),
                    })

        return overlaps
