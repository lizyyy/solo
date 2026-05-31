from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from .engine import AttributionEngine
from .export import export_mission_brief, export_mission_brief_json
from .models import (
    AnomalyRecord,
    AnomalyType,
    FaultRecord,
    OrbitalElement,
    Severity,
    TelemetrySegment,
    WindowEntry,
)
from .store import Store

_DEFAULT_DB = Path.cwd() / "tmat.db"


def _get_store(args: argparse.Namespace) -> Store:
    db_path = getattr(args, "db", None) or _DEFAULT_DB
    return Store(db_path)


def cmd_ingest(args: argparse.Namespace) -> None:
    store = _get_store(args)
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))

    for item in data.get("fault_records", []):
        rec = FaultRecord(
            fault_id=item["fault_id"],
            timestamp=datetime.fromisoformat(item["timestamp"]),
            subsystem=item["subsystem"],
            description=item["description"],
            severity=Severity(item["severity"]),
            metadata=item.get("metadata", {}),
        )
        store.insert_fault_record(rec)

    for item in data.get("telemetry_segments", []):
        seg = TelemetrySegment(
            seg_id=item["seg_id"],
            start_time=datetime.fromisoformat(item["start_time"]),
            end_time=datetime.fromisoformat(item["end_time"]),
            source=item["source"],
            frame_count=item["frame_count"],
            expected_frames=item["expected_frames"],
            metadata=item.get("metadata", {}),
        )
        store.insert_telemetry_segment(seg)

    for item in data.get("orbital_elements", []):
        elem = OrbitalElement(
            element_id=item["element_id"],
            timestamp=datetime.fromisoformat(item["timestamp"]),
            semi_major_axis=item.get("semi_major_axis"),
            eccentricity=item.get("eccentricity"),
            inclination=item.get("inclination"),
            raan=item.get("raan"),
            arg_perigee=item.get("arg_perigee"),
            mean_anomaly=item.get("mean_anomaly"),
            metadata=item.get("metadata", {}),
        )
        store.insert_orbital_element(elem)

    for item in data.get("window_entries", []):
        win = WindowEntry(
            window_id=item["window_id"],
            start_time=datetime.fromisoformat(item["start_time"]),
            end_time=datetime.fromisoformat(item["end_time"]),
            task_type=item["task_type"],
            subsystem=item["subsystem"],
            overlap_with=item.get("overlap_with", []),
            metadata=item.get("metadata", {}),
        )
        store.insert_window_entry(win)

    for item in data.get("anomaly_records", []):
        rec = AnomalyRecord(
            anomaly_id=item["anomaly_id"],
            timestamp=datetime.fromisoformat(item["timestamp"]),
            anomaly_type=AnomalyType(item["anomaly_type"]),
            telemetry_seg_id=item["telemetry_seg_id"],
            description=item["description"],
            severity=Severity(item["severity"]),
            observed_value=item.get("observed_value"),
            expected_value=item.get("expected_value"),
            metadata=item.get("metadata", {}),
        )
        store.insert_anomaly_record(rec)

    store.close()
    print(f"已导入: {len(data.get('fault_records', []))}故障纪要, "
          f"{len(data.get('telemetry_segments', []))}遥测段, "
          f"{len(data.get('orbital_elements', []))}轨道根数, "
          f"{len(data.get('window_entries', []))}窗口条目, "
          f"{len(data.get('anomaly_records', []))}异常记录")


def cmd_attribute(args: argparse.Namespace) -> None:
    store = _get_store(args)
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))

    anomalies = []
    for item in data.get("anomaly_records", []):
        anomalies.append(
            AnomalyRecord(
                anomaly_id=item["anomaly_id"],
                timestamp=datetime.fromisoformat(item["timestamp"]),
                anomaly_type=AnomalyType(item["anomaly_type"]),
                telemetry_seg_id=item["telemetry_seg_id"],
                description=item["description"],
                severity=Severity(item["severity"]),
                observed_value=item.get("observed_value"),
                expected_value=item.get("expected_value"),
                metadata=item.get("metadata", {}),
            )
        )

    engine = AttributionEngine(store)
    run = engine.attribute(anomalies, notes=args.notes or "")

    print(f"归因完成: 轮次={run.run_id[:8]}..., 异常数={run.input_anomaly_count}, "
          f"批次哈希={run.batch_hash[:16]}...")
    if "重复" in (run.notes or ""):
        print(f"注意: {run.notes}")

    results = store.get_attribution_results_for_run(run.run_id)
    for r in results:
        anomaly = store.get_anomaly_record(r.anomaly_id)
        atype = anomaly.anomaly_type.value if anomaly else "?"
        print(f"  {r.anomaly_id} ({atype}) -> {r.attributed_cause} [置信度{r.confidence:.0%}]")
        for link in r.evidence_links:
            print(f"    <- [{link.source_type.value}] {link.source_id}: {link.relevance}")

    store.close()


def cmd_export(args: argparse.Namespace) -> None:
    store = _get_store(args)
    run_id = args.run_id

    if run_id == "latest":
        runs = store.get_all_runs()
        if not runs:
            print("无归因记录")
            store.close()
            return
        run_id = runs[-1].run_id

    if args.json:
        brief = export_mission_brief_json(store, run_id)
        out_path = args.output
        if out_path:
            Path(out_path).write_text(brief, encoding="utf-8")
            print(f"已导出JSON简报: {out_path}")
        else:
            print(brief)
    else:
        out_path = args.output
        if out_path:
            with open(out_path, "w", encoding="utf-8") as f:
                export_mission_brief(store, run_id, output=f)
            print(f"已导出文本简报: {out_path}")
        else:
            export_mission_brief(store, run_id)

    store.close()


def cmd_trace(args: argparse.Namespace) -> None:
    store = _get_store(args)
    chain = store.trace_result_to_evidence(args.result_id)

    if not chain:
        print(f"未找到归因结果: {args.result_id}")
        store.close()
        return

    print(f"归因结果: {chain['result_id']}")
    print(f"异常: {chain['anomaly_id']}")
    print(f"归因结论: {chain['attributed_cause']}")
    print(f"可复核原因: {chain['verifiable_reason']}")
    print(f"置信度: {chain['confidence']:.0%}")
    print(f"证据链({len(chain['evidence'])}条):")

    for ev in chain["evidence"]:
        print(f"\n  [{ev['source_type']}] {ev['source_id']}")
        print(f"  关联: {ev['relevance']}")
        if ev["excerpt"]:
            print(f"  摘录: {ev['excerpt']}")
        if ev["source_detail"]:
            for k, v in ev["source_detail"].items():
                print(f"    {k}: {v}")

    store.close()


def cmd_history(args: argparse.Namespace) -> None:
    store = _get_store(args)
    runs = store.get_all_runs()

    if not runs:
        print("无归因历史")
        store.close()
        return

    print(f"共{len(runs)}次归因记录:")
    for run in runs:
        results = store.get_attribution_results_for_run(run.run_id)
        low_conf = sum(1 for r in results if r.confidence < 0.5)
        print(f"  {run.run_id[:8]}... | {run.run_timestamp.isoformat()} | "
              f"异常{run.input_anomaly_count}个 | 批次{run.batch_hash[:12]}... | "
              f"低置信度{low_conf}个 | {run.notes or '-'}")

    store.close()


def cmd_overlaps(args: argparse.Namespace) -> None:
    store = _get_store(args)
    overlaps = store.detect_window_overlaps()

    if not overlaps:
        print("未检测到窗口重叠")
    else:
        print(f"检测到{len(overlaps)}处窗口重叠:")
        for ov in overlaps:
            print(f"  {ov['window_a']} x {ov['window_b']} "
                  f"({ov['subsystem_a']} / {ov['subsystem_b']}) "
                  f"重叠{ov['overlap_seconds']:.0f}s "
                  f"({ov['overlap_start']}~{ov['overlap_end']})")

    store.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="tmat",
        description="遥测异常归因工具",
    )
    parser.add_argument("--db", default=None, help="数据库路径(默认: ./tmat.db)")

    sub = parser.add_subparsers(dest="command", required=True)

    p_ingest = sub.add_parser("ingest", help="导入原始数据")
    p_ingest.add_argument("input", help="JSON数据文件路径")

    p_attr = sub.add_parser("attribute", help="执行遥测异常归因")
    p_attr.add_argument("input", help="包含anomaly_records的JSON文件路径")
    p_attr.add_argument("--notes", default="", help="本次归因备注")

    p_export = sub.add_parser("export", help="导出任务简报")
    p_export.add_argument("run_id", help="归因轮次ID(或'latest')")
    p_export.add_argument("--output", "-o", default=None, help="输出文件路径")
    p_export.add_argument("--json", action="store_true", help="输出JSON格式")

    p_trace = sub.add_parser("trace", help="追溯归因结果的完整证据链")
    p_trace.add_argument("result_id", help="归因结果ID")

    p_hist = sub.add_parser("history", help="查看所有归因历史(不覆盖)")

    p_overlap = sub.add_parser("overlaps", help="检测窗口重叠")

    args = parser.parse_args()

    commands = {
        "ingest": cmd_ingest,
        "attribute": cmd_attribute,
        "export": cmd_export,
        "trace": cmd_trace,
        "history": cmd_history,
        "overlaps": cmd_overlaps,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
