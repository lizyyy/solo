from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from typing import Any

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
from .store import Store


class AttributionEngine:
    def __init__(self, store: Store) -> None:
        self._store = store

    def attribute(
        self,
        anomalies: list[AnomalyRecord],
        notes: str = "",
    ) -> AttributionRun:
        previous = self._store.check_previous_run(
            self._compute_hash(anomalies)
        )
        run = self._store.create_attribution_run(
            anomalies, status=RunStatus.COMPLETED, notes=notes
        )

        if previous:
            run.notes = f"重复批次(此前已有{len(previous)}次归因); {notes}".strip("; ")
            self._update_run_notes(run)

        for anomaly in anomalies:
            self._store.insert_anomaly_record(anomaly)
            result = self._attribute_single(run.run_id, anomaly)
            self._store.insert_attribution_result(result)

        return run

    def _compute_hash(self, anomalies: list[AnomalyRecord]) -> str:
        from .hasher import compute_batch_hash
        items = [
            {
                "anomaly_id": a.anomaly_id,
                "anomaly_type": a.anomaly_type.value,
                "telemetry_seg_id": a.telemetry_seg_id,
                "timestamp": a.timestamp.isoformat(),
            }
            for a in anomalies
        ]
        return compute_batch_hash(items)

    def _update_run_notes(self, run: AttributionRun) -> None:
        conn = self._store._get_conn()
        conn.execute(
            "UPDATE attribution_runs SET notes = ? WHERE run_id = ?",
            (run.notes, run.run_id),
        )
        conn.commit()

    def _attribute_single(
        self, run_id: str, anomaly: AnomalyRecord
    ) -> AttributionResult:
        evidence_links: list[EvidenceLink] = []
        cause_parts: list[str] = []
        reason_parts: list[str] = []

        seg = self._store.get_telemetry_segment(anomaly.telemetry_seg_id)
        if seg is not None:
            self._store.insert_telemetry_segment(seg)
            evidence_links.append(
                EvidenceLink(
                    link_id=str(uuid.uuid4()),
                    result_id="",
                    source_type=EvidenceType.TELEMETRY_SEGMENT,
                    source_id=seg.seg_id,
                    relevance="异常所在遥测段",
                    excerpt=f"帧计数{seg.frame_count}/{seg.expected_frames}, "
                            f"时段{seg.start_time.isoformat()}~{seg.end_time.isoformat()}",
                )
            )

            if anomaly.anomaly_type == AnomalyType.FRAME_DROP:
                drop_count = seg.expected_frames - seg.frame_count
                drop_pct = (drop_count / seg.expected_frames * 100) if seg.expected_frames > 0 else 0
                cause_parts.append(f"缺帧{drop_count}帧(丢帧率{drop_pct:.1f}%)")
                reason_parts.append(
                    f"遥测段{seg.seg_id}期望{seg.expected_frames}帧,实际{seg.frame_count}帧,缺{drop_count}帧"
                )

        faults = self._find_related_faults(anomaly)
        for fault in faults:
            evidence_links.append(
                EvidenceLink(
                    link_id=str(uuid.uuid4()),
                    result_id="",
                    source_type=EvidenceType.FAULT_RECORD,
                    source_id=fault.fault_id,
                    relevance="时间关联故障纪要",
                    excerpt=f"[{fault.timestamp.isoformat()}] {fault.subsystem}: {fault.description}",
                )
            )
            cause_parts.append(f"关联故障:{fault.subsystem}-{fault.description}")
            reason_parts.append(
                f"故障纪要{fault.fault_id}({fault.timestamp.isoformat()})记录"
                f"\"{fault.description}\",与异常时间差"
                f"{abs((anomaly.timestamp - fault.timestamp).total_seconds()):.0f}s"
            )

        orbitals = self._find_related_orbitals(anomaly)
        for orb in orbitals:
            evidence_links.append(
                EvidenceLink(
                    link_id=str(uuid.uuid4()),
                    result_id="",
                    source_type=EvidenceType.ORBITAL_ELEMENT,
                    source_id=orb.element_id,
                    relevance="时间邻近轨道根数",
                    excerpt=(
                        f"a={orb.semi_major_axis} e={orb.eccentricity} "
                        f"i={orb.inclination} Ω={orb.raan} "
                        f"ω={orb.arg_perigee} M={orb.mean_anomaly}"
                    ),
                )
            )
            if anomaly.anomaly_type == AnomalyType.OUT_OF_BOUNDS:
                cause_parts.append("轨道根数偏差可能导致遥测越限")
                reason_parts.append(
                    f"轨道根数{orb.element_id}({orb.timestamp.isoformat()})"
                    f"半长轴={orb.semi_major_axis},偏心率={orb.eccentricity}"
                )

        overlaps = self._find_window_overlaps(anomaly)
        for ov in overlaps:
            evidence_links.append(
                EvidenceLink(
                    link_id=str(uuid.uuid4()),
                    result_id="",
                    source_type=EvidenceType.WINDOW_ENTRY,
                    source_id=ov["window_id"],
                    relevance="窗口重叠可能干扰遥测",
                    excerpt=(
                        f"窗口{ov['window_id']}与{ov['overlap_with_id']}"
                        f"重叠{ov['overlap_seconds']:.0f}s"
                    ),
                )
            )
            cause_parts.append(f"窗口重叠干扰({ov['overlap_seconds']:.0f}s)")
            reason_parts.append(
                f"任务窗口{ov['window_id']}与{ov['overlap_with_id']}"
                f"重叠{ov['overlap_seconds']:.0f}s,可能竞争信道资源"
            )

        if not cause_parts:
            cause_parts.append("未找到明确关联原因")
            reason_parts.append(
                f"异常{anomaly.anomaly_id}({anomaly.anomaly_type.value})在当前数据中"
                f"未匹配到故障纪要/轨道根数/窗口重叠,建议人工复核"
            )

        attributed_cause = "; ".join(cause_parts)
        verifiable_reason = " | ".join(reason_parts)
        confidence = self._compute_confidence(evidence_links, anomaly)

        result_id = str(uuid.uuid4())
        for link in evidence_links:
            link.result_id = result_id

        return AttributionResult(
            result_id=result_id,
            run_id=run_id,
            anomaly_id=anomaly.anomaly_id,
            attributed_cause=attributed_cause,
            confidence=confidence,
            verifiable_reason=verifiable_reason,
            evidence_links=evidence_links,
        )

    def _find_related_faults(
        self, anomaly: AnomalyRecord, window_sec: float = 600
    ) -> list[FaultRecord]:
        seg = self._store.get_telemetry_segment(anomaly.telemetry_seg_id)
        subsystem = ""
        if seg is not None:
            subsystem = seg.metadata.get("subsystem", "")

        candidates = self._store.get_faults_for_subsystem(subsystem) if subsystem else []

        if not candidates:
            conn = self._store._get_conn()
            rows = conn.execute(
                "SELECT * FROM fault_records ORDER BY timestamp"
            ).fetchall()
            candidates = [
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

        related: list[FaultRecord] = []
        for fault in candidates:
            dt = abs((anomaly.timestamp - fault.timestamp).total_seconds())
            if dt <= window_sec:
                related.append(fault)
        return related

    def _find_related_orbitals(
        self, anomaly: AnomalyRecord, window_sec: float = 1800
    ) -> list[OrbitalElement]:
        conn = self._store._get_conn()
        rows = conn.execute(
            "SELECT * FROM orbital_elements ORDER BY timestamp"
        ).fetchall()

        related: list[OrbitalElement] = []
        for r in rows:
            ts = datetime.fromisoformat(r["timestamp"])
            dt = abs((anomaly.timestamp - ts).total_seconds())
            if dt <= window_sec:
                related.append(
                    OrbitalElement(
                        element_id=r["element_id"],
                        timestamp=ts,
                        semi_major_axis=r["semi_major_axis"],
                        eccentricity=r["eccentricity"],
                        inclination=r["inclination"],
                        raan=r["raan"],
                        arg_perigee=r["arg_perigee"],
                        mean_anomaly=r["mean_anomaly"],
                        metadata=json.loads(r["metadata"]),
                    )
                )
        return related

    def _find_window_overlaps(
        self, anomaly: AnomalyRecord
    ) -> list[dict[str, Any]]:
        seg = self._store.get_telemetry_segment(anomaly.telemetry_seg_id)
        if seg is None:
            return []

        subsystem = seg.metadata.get("subsystem", "")
        windows = self._store.get_windows_for_subsystem(subsystem) if subsystem else []

        overlaps: list[dict[str, Any]] = []
        for i, w1 in enumerate(windows):
            for w2 in windows[i + 1:]:
                if w2.start_time < w1.end_time and w1.start_time < w2.end_time:
                    overlap_start = max(w1.start_time, w2.start_time)
                    overlap_end = min(w1.end_time, w2.end_time)
                    overlap_sec = (overlap_end - overlap_start).total_seconds()

                    if (seg.start_time <= overlap_end and seg.end_time >= overlap_start):
                        overlaps.append({
                            "window_id": w1.window_id,
                            "overlap_with_id": w2.window_id,
                            "overlap_seconds": overlap_sec,
                            "overlap_start": overlap_start.isoformat(),
                            "overlap_end": overlap_end.isoformat(),
                        })
        return overlaps

    def _compute_confidence(
        self, links: list[EvidenceLink], anomaly: AnomalyRecord
    ) -> float:
        score = 0.3
        source_types = {l.source_type for l in links}

        if EvidenceType.FAULT_RECORD in source_types:
            score += 0.3
        if EvidenceType.ORBITAL_ELEMENT in source_types:
            score += 0.2
        if EvidenceType.WINDOW_ENTRY in source_types:
            score += 0.15
        if EvidenceType.TELEMETRY_SEGMENT in source_types:
            score += 0.05

        if anomaly.anomaly_type == AnomalyType.FRAME_DROP and EvidenceType.TELEMETRY_SEGMENT in source_types:
            score += 0.1

        return min(score, 1.0)
