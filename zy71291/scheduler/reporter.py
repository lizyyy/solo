from __future__ import annotations

import csv
import json
import os
from typing import Any, Dict, List, Optional

from .models import ScheduleInput, ScheduleResult


def generate_summary(data: ScheduleInput, result: ScheduleResult) -> Dict[str, Any]:
    total_orders = len(data.orders)
    assigned_orders = len(result.assignments)
    unassigned_orders = total_orders - assigned_orders
    machine_ids = set(m.id for m in data.machines)
    machines_used = set(a.machine_id for a in result.assignments)
    critical_violations = [v for v in result.violations if v.severity == "CRITICAL"]
    warning_violations = [v for v in result.violations if v.severity != "CRITICAL"]
    overload_violations = [v for v in result.violations if v.kind == "MACHINE_OVERLOAD"]
    deadline_violations = [v for v in result.violations if v.kind == "DEADLINE_INVERSION"]
    changeover_violations = [v for v in result.violations if v.kind == "CHANGEOVER_MISSING"]
    total_changeover = sum(a.changeover_before for a in result.assignments)
    summary = {
        "run_id": result.run_id,
        "timestamp": result.timestamp,
        "feasible": result.feasible,
        "solver_status": result.solver_status,
        "objective_value": result.objective_value,
        "input_hash": result.input_hash,
        "statistics": {
            "total_orders": total_orders,
            "assigned_orders": assigned_orders,
            "unassigned_orders": unassigned_orders,
            "total_machines": len(machine_ids),
            "machines_used": len(machines_used),
            "total_shifts": len(data.shifts),
            "available_shifts": len([s for s in data.shifts if s.available]),
            "total_changeover_hours": round(total_changeover, 4),
        },
        "violations_summary": {
            "total_violations": len(result.violations),
            "critical": len(critical_violations),
            "warnings": len(warning_violations),
            "machine_overload": len(overload_violations),
            "deadline_inversion": len(deadline_violations),
            "changeover_missing": len(changeover_violations),
        },
        "critical_violations": [v.to_dict() for v in critical_violations],
        "infeasibility_reasons": result.infeasibility_reasons if not result.feasible else [],
    }
    return summary


def generate_detail(data: ScheduleInput, result: ScheduleResult) -> Dict[str, Any]:
    machine_schedule: Dict[str, List[Dict]] = {}
    for a in result.assignments:
        machine_schedule.setdefault(a.machine_id, []).append(
            {
                "order_id": a.order_id,
                "shift_id": a.shift_id,
                "mold_id": a.mold_id,
                "start_time": a.start_time,
                "end_time": a.end_time,
                "changeover_before": a.changeover_before,
                "prev_order_id": a.prev_order_id,
            }
        )
    for mid in machine_schedule:
        machine_schedule[mid].sort(key=lambda x: x["start_time"])
    order_status = []
    for o in data.orders:
        assigned = None
        for a in result.assignments:
            if a.order_id == o.id:
                assigned = a
                break
        if assigned:
            order_status.append(
                {
                    "order_id": o.id,
                    "product": o.product,
                    "quantity": o.quantity,
                    "mold_id": o.mold_id,
                    "processing_time": o.total_processing_time,
                    "deadline": o.deadline,
                    "priority": o.priority,
                    "material_arrival": o.material_arrival,
                    "assigned_machine": assigned.machine_id,
                    "assigned_shift": assigned.shift_id,
                    "start_time": assigned.start_time,
                    "end_time": assigned.end_time,
                    "changeover_before": assigned.changeover_before,
                    "status": "ASSIGNED",
                }
            )
        else:
            order_status.append(
                {
                    "order_id": o.id,
                    "product": o.product,
                    "quantity": o.quantity,
                    "mold_id": o.mold_id,
                    "processing_time": o.total_processing_time,
                    "deadline": o.deadline,
                    "priority": o.priority,
                    "material_arrival": o.material_arrival,
                    "assigned_machine": None,
                    "assigned_shift": None,
                    "start_time": None,
                    "end_time": None,
                    "changeover_before": None,
                    "status": "UNASSIGNED",
                }
            )
    shift_utilization = []
    for s in data.shifts:
        if not s.available:
            continue
        machine = data.get_machine(s.machine_id)
        cap = min(s.duration, machine.capacity_per_shift) if machine else s.duration
        assigned_on_shift = [
            a for a in result.assignments if a.shift_id == s.id
        ]
        load = sum(a.end_time - a.start_time for a in assigned_on_shift)
        changeover = sum(a.changeover_before for a in assigned_on_shift)
        shift_utilization.append(
            {
                "shift_id": s.id,
                "machine_id": s.machine_id,
                "date": s.date,
                "hours": f"{s.start_hour}-{s.end_hour}",
                "capacity_hours": round(cap, 4),
                "load_hours": round(load, 4),
                "changeover_hours": round(changeover, 4),
                "utilization_pct": round(load / cap * 100, 2) if cap > 0 else 0,
                "order_count": len(assigned_on_shift),
            }
        )
    return {
        "run_id": result.run_id,
        "machine_schedule": machine_schedule,
        "order_status": order_status,
        "shift_utilization": shift_utilization,
        "all_violations": [v.to_dict() for v in result.violations],
    }


def format_summary_text(summary: Dict[str, Any]) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("  排产摘要报告")
    lines.append("=" * 60)
    lines.append(f"运行ID:     {summary['run_id']}")
    lines.append(f"时间:       {summary['timestamp']}")
    lines.append(f"可行:       {'是' if summary['feasible'] else '否'}")
    lines.append(f"求解状态:   {summary['solver_status']}")
    if summary.get("objective_value") is not None:
        lines.append(f"目标值:     {summary['objective_value']}")
    lines.append(f"输入哈希:   {summary['input_hash']}")
    lines.append("")
    lines.append("--- 统计 ---")
    s = summary["statistics"]
    lines.append(f"订单总数:   {s['total_orders']}")
    lines.append(f"已分配:     {s['assigned_orders']}")
    lines.append(f"未分配:     {s['unassigned_orders']}")
    lines.append(f"机器总数:   {s['total_machines']}")
    lines.append(f"使用机器:   {s['machines_used']}")
    lines.append(f"班次总数:   {s['total_shifts']}")
    lines.append(f"可用班次:   {s['available_shifts']}")
    lines.append(f"总换模时间: {s['total_changeover_hours']}h")
    lines.append("")
    v = summary["violations_summary"]
    lines.append("--- 违规 ---")
    lines.append(f"违规总数:       {v['total_violations']}")
    lines.append(f"严重:           {v['critical']}")
    lines.append(f"警告:           {v['warnings']}")
    lines.append(f"机器超载:       {v['machine_overload']}")
    lines.append(f"交期倒挂:       {v['deadline_inversion']}")
    lines.append(f"换模漏算:       {v['changeover_missing']}")
    if summary["critical_violations"]:
        lines.append("")
        lines.append("--- 严重违规详情 ---")
        for cv in summary["critical_violations"]:
            lines.append(f"  [{cv['kind']}] {cv['description']}")
    if summary["infeasibility_reasons"]:
        lines.append("")
        lines.append("--- 不可行原因 ---")
        for r in summary["infeasibility_reasons"]:
            lines.append(f"  - {r}")
    lines.append("=" * 60)
    return "\n".join(lines)


def format_detail_text(detail: Dict[str, Any]) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("  排产详细明细")
    lines.append("=" * 60)
    lines.append(f"运行ID: {detail['run_id']}")
    lines.append("")
    lines.append("--- 机器排程 ---")
    for mid, sched in sorted(detail["machine_schedule"].items()):
        lines.append(f"  机器 {mid}:")
        for entry in sched:
            chg = f" [换模{entry['changeover_before']:.2f}h]" if entry["changeover_before"] > 0 else ""
            prev = f" (接 {entry['prev_order_id']})" if entry.get("prev_order_id") else ""
            lines.append(
                f"    订单{entry['order_id']} | "
                f"班次{entry['shift_id']} | "
                f"模具{entry['mold_id']} | "
                f"{entry['start_time']:.2f}-{entry['end_time']:.2f}h"
                f"{chg}{prev}"
            )
    lines.append("")
    lines.append("--- 订单状态 ---")
    for o in detail["order_status"]:
        status_mark = "✓" if o["status"] == "ASSIGNED" else "✗"
        lines.append(
            f"  {status_mark} 订单{o['order_id']} | "
            f"{o['product']} | 数量{o['quantity']} | "
            f"模具{o['mold_id']} | 交期{o['deadline']}"
        )
        if o["status"] == "ASSIGNED":
            lines.append(
                f"      -> 机器{o['assigned_machine']} 班次{o['assigned_shift']} "
                f"{o['start_time']:.2f}-{o['end_time']:.2f}h"
            )
        else:
            lines.append("      -> 未分配")
    lines.append("")
    lines.append("--- 班次利用率 ---")
    for su in detail["shift_utilization"]:
        lines.append(
            f"  {su['shift_id']} | 机器{su['machine_id']} | "
            f"{su['date']} {su['hours']} | "
            f"负载{su['load_hours']}h/{su['capacity_hours']}h "
            f"({su['utilization_pct']}%) | "
            f"换模{su['changeover_hours']}h | {su['order_count']}单"
        )
    if detail["all_violations"]:
        lines.append("")
        lines.append("--- 全部违规 ---")
        for v in detail["all_violations"]:
            lines.append(f"  [{v['severity']}][{v['kind']}] {v['description']}")
    lines.append("=" * 60)
    return "\n".join(lines)


def export_reports(
    data: ScheduleInput,
    result: ScheduleResult,
    output_dir: str,
    formats: Optional[List[str]] = None,
) -> List[str]:
    if formats is None:
        formats = ["json", "csv", "text"]
    os.makedirs(output_dir, exist_ok=True)
    summary = generate_summary(data, result)
    detail = generate_detail(data, result)
    exported = []
    run_id = result.run_id
    if "json" in formats:
        path = os.path.join(output_dir, f"summary_{run_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        exported.append(path)
        path = os.path.join(output_dir, f"detail_{run_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(detail, f, ensure_ascii=False, indent=2)
        exported.append(path)
    if "csv" in formats:
        path = os.path.join(output_dir, f"assignments_{run_id}.csv")
        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "订单号", "机器", "班次", "模具", "开始时间",
                "结束时间", "换模时间", "前置订单",
            ])
            for a in result.assignments:
                writer.writerow([
                    a.order_id, a.machine_id, a.shift_id, a.mold_id,
                    a.start_time, a.end_time, a.changeover_before,
                    a.prev_order_id or "",
                ])
        exported.append(path)
        path = os.path.join(output_dir, f"violations_{run_id}.csv")
        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["类型", "严重度", "描述"])
            for v in result.violations:
                writer.writerow([v.kind, v.severity, v.description])
        exported.append(path)
        path = os.path.join(output_dir, f"utilization_{run_id}.csv")
        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "班次", "机器", "日期", "时段", "容量(h)",
                "负载(h)", "换模(h)", "利用率(%)", "订单数",
            ])
            for su in detail["shift_utilization"]:
                writer.writerow([
                    su["shift_id"], su["machine_id"], su["date"],
                    su["hours"], su["capacity_hours"], su["load_hours"],
                    su["changeover_hours"], su["utilization_pct"],
                    su["order_count"],
                ])
        exported.append(path)
    if "text" in formats:
        path = os.path.join(output_dir, f"report_{run_id}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(format_summary_text(summary))
            f.write("\n\n")
            f.write(format_detail_text(detail))
        exported.append(path)
    return exported
