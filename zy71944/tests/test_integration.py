from __future__ import annotations

import json
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from tmat.engine import AttributionEngine
from tmat.export import export_mission_brief, export_mission_brief_json
from tmat.models import (
    AnomalyRecord,
    AnomalyType,
    FaultRecord,
    OrbitalElement,
    Severity,
    TelemetrySegment,
    WindowEntry,
)
from tmat.store import Store


def _make_store() -> Store:
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    store = Store(tmp.name)
    return store


def _seed_data(store: Store) -> None:
    t0 = datetime(2026, 5, 31, 8, 0, 0)

    store.insert_telemetry_segment(TelemetrySegment(
        seg_id="seg-001",
        start_time=t0,
        end_time=t0 + timedelta(minutes=30),
        source="测控站A",
        frame_count=850,
        expected_frames=1000,
        metadata={"subsystem": "数传"},
    ))

    store.insert_fault_record(FaultRecord(
        fault_id="fault-001",
        timestamp=t0 + timedelta(seconds=30),
        subsystem="数传",
        description="数传通道1偶发丢帧",
        severity=Severity.MEDIUM,
    ))

    store.insert_orbital_element(OrbitalElement(
        element_id="orb-001",
        timestamp=t0 - timedelta(minutes=5),
        semi_major_axis=6778.0,
        eccentricity=0.0012,
        inclination=97.4,
        raan=45.0,
        arg_perigee=90.0,
        mean_anomaly=0.0,
    ))

    store.insert_window_entry(WindowEntry(
        window_id="win-001",
        start_time=t0,
        end_time=t0 + timedelta(minutes=20),
        task_type="数传",
        subsystem="数传",
    ))

    store.insert_window_entry(WindowEntry(
        window_id="win-002",
        start_time=t0 + timedelta(minutes=15),
        end_time=t0 + timedelta(minutes=35),
        task_type="测距",
        subsystem="数传",
    ))


def _make_anomalies(t0: datetime) -> list[AnomalyRecord]:
    return [
        AnomalyRecord(
            anomaly_id="anom-001",
            timestamp=t0 + timedelta(minutes=5),
            anomaly_type=AnomalyType.FRAME_DROP,
            telemetry_seg_id="seg-001",
            description="数传帧丢失150帧",
            severity=Severity.HIGH,
            observed_value=850,
            expected_value=1000,
        ),
    ]


def test_repeat_run_preserves_history():
    store = _make_store()
    _seed_data(store)
    t0 = datetime(2026, 5, 31, 8, 0, 0)
    engine = AttributionEngine(store)

    anomalies = _make_anomalies(t0)
    run1 = engine.attribute(anomalies, notes="第一次归因")
    assert "重复" not in (run1.notes or "")

    run2 = engine.attribute(anomalies, notes="第二次归因")
    assert "重复" in (run2.notes or "")

    all_runs = store.get_all_runs()
    assert len(all_runs) == 2, f"期望2次归因记录,实际{len(all_runs)}"

    results1 = store.get_attribution_results_for_run(run1.run_id)
    results2 = store.get_attribution_results_for_run(run2.run_id)
    assert len(results1) == 1
    assert len(results2) == 1

    assert results1[0].result_id != results2[0].result_id

    store.close()


def test_evidence_traceability():
    store = _make_store()
    _seed_data(store)
    t0 = datetime(2026, 5, 31, 8, 0, 0)
    engine = AttributionEngine(store)

    anomalies = _make_anomalies(t0)
    run = engine.attribute(anomalies)
    results = store.get_attribution_results_for_run(run.run_id)
    result = results[0]

    chain = store.trace_result_to_evidence(result.result_id)
    assert chain["result_id"] == result.result_id
    assert len(chain["evidence"]) >= 1

    source_types = {ev["source_type"] for ev in chain["evidence"]}
    assert "telemetry_segment" in source_types

    for ev in chain["evidence"]:
        assert ev["source_detail"] is not None, (
            f"证据{ev['source_id']}缺少source_detail,无法追溯"
        )

    store.close()


def test_frame_drop_verifiable_reason():
    store = _make_store()
    _seed_data(store)
    t0 = datetime(2026, 5, 31, 8, 0, 0)
    engine = AttributionEngine(store)

    anomalies = _make_anomalies(t0)
    run = engine.attribute(anomalies)
    results = store.get_attribution_results_for_run(run.run_id)
    result = results[0]

    assert result.verifiable_reason
    assert "期望1000帧" in result.verifiable_reason
    assert "实际850帧" in result.verifiable_reason
    assert "缺150帧" in result.verifiable_reason

    store.close()


def test_fault_record_linked():
    store = _make_store()
    _seed_data(store)
    t0 = datetime(2026, 5, 31, 8, 0, 0)
    engine = AttributionEngine(store)

    anomalies = _make_anomalies(t0)
    run = engine.attribute(anomalies)
    results = store.get_attribution_results_for_run(run.run_id)
    result = results[0]

    source_types = {link.source_type.value for link in result.evidence_links}
    assert "fault_record" in source_types

    fault_links = [l for l in result.evidence_links if l.source_type.value == "fault_record"]
    assert any("fault-001" in l.source_id for l in fault_links)

    chain = store.trace_result_to_evidence(result.result_id)
    fault_evidence = [e for e in chain["evidence"] if e["source_type"] == "fault_record"]
    assert len(fault_evidence) >= 1
    assert fault_evidence[0]["source_detail"]["description"] == "数传通道1偶发丢帧"

    store.close()


def test_window_overlap_detection():
    store = _make_store()
    _seed_data(store)

    overlaps = store.detect_window_overlaps()
    assert len(overlaps) >= 1
    overlap_ids = {(o["window_a"], o["window_b"]) for o in overlaps}
    assert ("win-001", "win-002") in overlap_ids
    assert overlaps[0]["overlap_seconds"] == 300.0

    store.close()


def test_export_mission_brief():
    store = _make_store()
    _seed_data(store)
    t0 = datetime(2026, 5, 31, 8, 0, 0)
    engine = AttributionEngine(store)

    anomalies = _make_anomalies(t0)
    run = engine.attribute(anomalies)

    import io
    buf = io.StringIO()
    export_mission_brief(store, run.run_id, output=buf)
    brief = buf.getvalue()

    assert "遥测异常归因" in brief
    assert "anom-001" in brief
    assert "可复核原因" in brief
    assert "证据链" in brief

    store.close()


def test_export_mission_brief_json():
    store = _make_store()
    _seed_data(store)
    t0 = datetime(2026, 5, 31, 8, 0, 0)
    engine = AttributionEngine(store)

    anomalies = _make_anomalies(t0)
    run = engine.attribute(anomalies)

    json_str = export_mission_brief_json(store, run.run_id)
    data = json.loads(json_str)

    assert data["brief_type"] == "telemetry_anomaly_attribution"
    assert len(data["results"]) == 1
    assert data["results"][0]["anomaly_type"] == "frame_drop"
    assert len(data["results"][0]["evidence"]) >= 1

    store.close()


def test_batch_hash_consistency():
    from tmat.hasher import compute_batch_hash

    items = [
        {"anomaly_id": "a1", "type": "frame_drop"},
        {"anomaly_id": "a2", "type": "signal_loss"},
    ]
    hash1 = compute_batch_hash(items)
    hash2 = compute_batch_hash(items)
    assert hash1 == hash2

    items_different = [
        {"anomaly_id": "a1", "type": "frame_drop"},
        {"anomaly_id": "a2", "type": "out_of_bounds"},
    ]
    hash3 = compute_batch_hash(items_different)
    assert hash1 != hash3


if __name__ == "__main__":
    test_repeat_run_preserves_history()
    print("PASS: repeat_run_preserves_history")

    test_evidence_traceability()
    print("PASS: evidence_traceability")

    test_frame_drop_verifiable_reason()
    print("PASS: frame_drop_verifiable_reason")

    test_fault_record_linked()
    print("PASS: fault_record_linked")

    test_window_overlap_detection()
    print("PASS: window_overlap_detection")

    test_export_mission_brief()
    print("PASS: export_mission_brief")

    test_export_mission_brief_json()
    print("PASS: export_mission_brief_json")

    test_batch_hash_consistency()
    print("PASS: batch_hash_consistency")

    print("\n全部测试通过!")
