from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import argparse

from .models import (
    DataQuality,
    DiagnosisInput,
    DoorEvent,
    EquipmentInfo,
    IceProductionRecord,
    PowerRecord,
    TemperatureRecord,
)
from .engine import DiagnosisEngine
from .audit import AuditTrail
from .report import ReportGenerator


def parse_dt(val: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析时间: {val}")


def load_data(filepath: str) -> DiagnosisInput:
    with open(filepath, "r", encoding="utf-8") as f:
        raw = json.load(f)

    eq_raw = raw["equipment"]
    equipment = EquipmentInfo(
        equipment_id=eq_raw["equipment_id"],
        model=eq_raw["model"],
        rated_power_kw=float(eq_raw["rated_power_kw"]),
        rated_production_kg_h=float(eq_raw["rated_production_kg_h"]),
        install_date=parse_dt(eq_raw["install_date"]) if eq_raw.get("install_date") else None,
        baseline_sec_kwh_per_kg=float(eq_raw["baseline_sec_kwh_per_kg"]) if eq_raw.get("baseline_sec_kwh_per_kg") else None,
    )

    power_records = []
    for r in raw.get("power_records", []):
        quality = DataQuality(r.get("quality", "measured"))
        power_records.append(PowerRecord(
            timestamp=parse_dt(r["timestamp"]),
            power_kw=float(r["power_kw"]),
            cumulative_kwh=float(r["cumulative_kwh"]) if r.get("cumulative_kwh") is not None else None,
            quality=quality,
        ))

    temperature_records = []
    for r in raw.get("temperature_records", []):
        quality = DataQuality(r.get("quality", "measured"))
        temperature_records.append(TemperatureRecord(
            timestamp=parse_dt(r["timestamp"]),
            temperature_c=float(r["temperature_c"]),
            quality=quality,
        ))

    door_events = []
    for r in raw.get("door_events", []):
        quality = DataQuality(r.get("quality", "measured"))
        door_events.append(DoorEvent(
            timestamp=parse_dt(r["timestamp"]),
            is_open=bool(r["is_open"]),
            duration_s=float(r["duration_s"]) if r.get("duration_s") is not None else None,
            quality=quality,
        ))

    ice_production = []
    for r in raw.get("ice_production", []):
        quality = DataQuality(r.get("quality", "measured"))
        prod_kg = float(r["production_kg"]) if r.get("production_kg") is not None else None
        if r.get("quality") == "missing":
            quality = DataQuality.MISSING
            prod_kg = None
        ice_production.append(IceProductionRecord(
            timestamp=parse_dt(r["timestamp"]),
            production_kg=prod_kg,
            quality=quality,
            imputed_method=r.get("imputed_method"),
        ))

    return DiagnosisInput(
        equipment=equipment,
        power_records=power_records,
        temperature_records=temperature_records,
        door_events=door_events,
        ice_production=ice_production,
    )


def cmd_diagnose(args) -> None:
    data = load_data(args.input)

    errors = data.validate_all()
    if errors:
        print(f"数据校验发现 {len(errors)} 个问题:")
        for e in errors:
            print(f"  - {e}")
        if args.strict:
            print("严格模式下终止诊断")
            sys.exit(1)
        print("继续诊断 (脏数据将被处理并记录审计日志)")

    audit = AuditTrail()
    engine = DiagnosisEngine(audit_trail=audit)
    result = engine.diagnose(data)

    report_gen = ReportGenerator(result)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    base_name = f"diagnosis_{result.equipment_id}_{result.diagnosis_time.strftime('%Y%m%d_%H%M%S')}"

    json_path = output_dir / f"{base_name}.json"
    report_gen.to_json(str(json_path))
    print(f"JSON报告已导出: {json_path}")

    csv_path = output_dir / f"{base_name}.csv"
    report_gen.to_csv(str(csv_path))
    print(f"CSV报告已导出: {csv_path} (含 _anomalies.csv, _attribution.csv, _audit.csv)")

    text_path = output_dir / f"{base_name}.txt"
    report_gen.to_text(str(text_path))
    print(f"文本报告已导出: {text_path}")

    audit_path = output_dir / f"{base_name}_audit.jsonl"
    audit.save(str(audit_path))
    print(f"审计日志已导出: {audit_path}")

    if args.print_summary:
        print()
        print(report_gen.to_text())


def cmd_validate(args) -> None:
    data = load_data(args.input)
    errors = data.validate_all()
    if errors:
        print(f"数据校验发现 {len(errors)} 个问题:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("数据校验通过")


def cmd_explain(args) -> None:
    print(DiagnosisEngine.__doc__)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="ice-machine-diagnosis",
        description="制冰机能耗异常诊断工具",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    diag_parser = subparsers.add_parser("diagnose", help="执行诊断")
    diag_parser.add_argument("-i", "--input", required=True, help="输入数据文件路径 (JSON)")
    diag_parser.add_argument("-o", "--output-dir", default="./output", help="输出目录 (默认: ./output)")
    diag_parser.add_argument("--strict", action="store_true", help="严格模式, 校验不通过则终止")
    diag_parser.add_argument("--print-summary", action="store_true", help="在终端打印诊断摘要")
    diag_parser.set_defaults(func=cmd_diagnose)

    val_parser = subparsers.add_parser("validate", help="仅校验数据")
    val_parser.add_argument("-i", "--input", required=True, help="输入数据文件路径 (JSON)")
    val_parser.set_defaults(func=cmd_validate)

    explain_parser = subparsers.add_parser("explain", help="查看公式与处理口径说明")
    explain_parser.set_defaults(func=cmd_explain)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
