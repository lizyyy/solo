#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""流浪动物救助异常提醒 - 主入口CLI"""
import argparse
import json
import os
import sys
from collections import Counter, defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

from core.models import ProcessingStatus, AnomalyType
from core.weight_curve import WeightCurveManager
from core.anomaly_engine import AnomalyEngine
from core.data_loader import DataLoader
from core.exporter import Exporter

STYLE = {
    "红": "\033[31m", "绿": "\033[32m", "黄": "\033[33m", "蓝": "\033[34m",
    "紫": "\033[35m", "青": "\033[36m", "白": "\033[37m", "粗": "\033[1m",
    "重": "\033[91m", "关": "\033[0m"
}
S = STYLE


def _c(text, *colors):
    return "".join(S[c] for c in colors) + str(text) + S["关"]


def _short(s, n=30):
    s = str(s)
    return s if len(s) <= n else s[:n - 3] + "..."


def _load_context():
    curve_mgr = WeightCurveManager()
    loader = DataLoader(curve_mgr)
    engine = AnomalyEngine(curve_mgr)
    exporter = Exporter()
    return curve_mgr, loader, engine, exporter


def _load_source(loader, args):
    src = args.input or os.path.join(BASE, "data_incoming")
    if os.path.isdir(src):
        loader.load_directory(src)
    else:
        loader.load_file(src)
    return src


def _history_path(exporter):
    return os.path.join(exporter.output_dir, "变更历史.json")


def _anomaly_objects_path(exporter):
    return os.path.join(exporter.output_dir, "异常队列_完整对象.json")


def _pipeline(loader, engine, exporter, args, detect: bool = True):
    src = _load_source(loader, args)
    if detect:
        engine.detect_all()
    if os.path.exists(_anomaly_objects_path(exporter)):
        engine.load_anomaly_objects(_anomaly_objects_path(exporter))
    engine.load_history(_history_path(exporter))
    return src


def _persist_all(engine, exporter):
    engine.save_anomaly_objects(_anomaly_objects_path(exporter))
    engine.save_anomaly_queue(os.path.join(exporter.output_dir, "异常队列.json"))
    engine.save_history(_history_path(exporter))
    exporter.export_history_csv(engine.history)
    queue = engine.anomaly_queue_to_dicts()
    exporter.export_anomaly_queue_csv(queue, "异常队列.csv", filters_used={})


def cmd_load(args):
    curve_mgr, loader, engine, exporter = _load_context()
    print(_c(f"[加载数据 + 异常检测 + 合并已处理状态]", "蓝", "粗"))
    _pipeline(loader, engine, exporter, args, detect=True)
    print(_c(f"共加载 {len(curve_mgr.records)} 条记录，涉及 {len(curve_mgr.records_by_pet)} 只宠物", "蓝"))
    _print_anomaly_summary(engine.anomalies)
    _persist_all(engine, exporter)
    curve_mgr.save_curves_json(os.path.join(exporter.output_dir, "体重曲线.json"))
    exporter.export_records_debug(curve_mgr.records, "体重记录明细.csv")
    _print_file_locations(exporter)
    print(_c("\n[提示] 从下一行命令复制异常ID（anom_开头），"
            "queue/detail/confirm-unit/revise 都能用同一个ID", "青", "粗"))
    return curve_mgr, engine, exporter


def _print_anomaly_summary(anomalies):
    by_type = Counter(a.anomaly_type.value for a in anomalies)
    by_status = Counter(a.status.value for a in anomalies)
    total = len(anomalies)
    print()
    print(_c(f"═══════════════════════ 异常队列总览 ═══════════════════", "紫", "粗"))
    print(_c(f"  异常总数: {_c(total, '红', '粗')}", "白"))
    for tp, n in by_type.most_common():
        print(_c(f"   · {tp}: {_c(n, '黄')}", "白"))
    print(_c(f"  处理状态分布:", "白"))
    for st, n in by_status.most_common():
        color = "绿" if st in ("已解决", "已确认", "已改判", "已归档") else "红"
        print(_c(f"   · {st}: {_c(n, color)}", "白"))
    print(_c(f"═══════════════════════════════════════════════════════", "紫"))


def _print_file_locations(exporter):
    print()
    print(_c("[产物位置]", "绿", "粗"))
    for fn in sorted(os.listdir(exporter.output_dir)):
        fp = os.path.join(exporter.output_dir, fn)
        print(f"  · {fp}")


def cmd_queue(args):
    curve_mgr, loader, engine, exporter = _load_context()
    _pipeline(loader, engine, exporter, args, detect=True)

    filters = {}
    if args.status:
        filters["status"] = args.status
    if args.type:
        filters["anomaly_type"] = args.type
    if args.pet_id:
        filters["pet_id"] = args.pet_id
    if args.responsible:
        filters["responsible_role"] = args.responsible

    queue = engine.anomaly_queue_to_dicts(filters)
    print(_c(f"\n═══════════════ 异常队列 {'（筛选：'+str(filters)+'）' if filters else ''} ═══════════════", "青", "粗"))
    print(_c("（复制完整 anom_xxx ID，用于 detail / confirm-unit / revise 命令）", "青"))
    for idx, a in enumerate(queue, start=1):
        print(_c(f"\n  ┌─ 异常 #{idx}", "粗", "紫"))
        print(_c(f"  │ ID: ", "蓝") + _c(a["anomaly_id"], "黄", "粗"))
        print(_c(f"  │ 类型: ", "蓝") + _c(a["anomaly_type"], "红", "粗"))
        print(_c(f"  │ 宠物: ", "蓝") + f"{a['pet_name']}({a['pet_id']})")
        print(_c(f"  │ 状态: ", "蓝") + _c(a["status"], "黄"))
        print(_c(f"  │ 描述: ", "蓝") + _short(a["description"], 60))
        print(_c(f"  │ 卡住原因: ", "红") + _c(_short(a["block_reason"], 60), "红", "粗"))
        print(_c(f"  │ 下一步: ", "绿") + _short(a["next_step"], 60))
        print(_c(f"  │ 责任人: ", "蓝") + f"{a['responsible_role']} / 联系: {a['responsible_contact']}")
        print(_c(f"  │ 曲线跳转: ", "蓝") + _c(a["weight_curve_ref"], "青"))
        print(_c(f"  │ 计算口径: ", "蓝") + _short(a["calc_formula"], 60))
        srcs = a.get("来源文件清单") or a.get("source_file") or a.get("extra", {}).get("source_file", "")
        print(_c(f"  │ 来源: ", "蓝") + _short(srcs, 60))
        print(_c(f"  └ 涉及记录数: {len(a['involved_record_ids'])}", "蓝"))
    print(_c(f"\n共 {len(queue)} 条异常", "紫", "粗"))

    fmt = args.format or "csv"
    out_name = f"异常队列筛选.{fmt}"
    if fmt == "csv":
        path = exporter.export_anomaly_queue_csv(queue, out_name, filters)
    elif fmt in ("xlsx", "xls"):
        path = exporter.export_anomaly_queue_xlsx(queue, out_name, filters)
    else:
        path = os.path.join(exporter.output_dir, out_name + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(queue, f, ensure_ascii=False, indent=2)
    print(_c(f"\n已导出: {path}", "绿", "粗"))
    if fmt in ("csv", "xlsx"):
        print(_c("  [说明] 筛选口径与屏幕完全一致，导出文件附带筛选元信息（.filters.json）", "蓝"))


def cmd_detail(args):
    curve_mgr, loader, engine, exporter = _load_context()
    _pipeline(loader, engine, exporter, args, detect=True)

    aid = args.anomaly_id
    anomaly = engine._find_anomaly(aid)
    if not anomaly:
        print(_c(f"未找到异常ID匹配: {aid}", "红"))
        print(_c("可用命令: python3 rescue_anomaly.py queue --type \"单位混写\" 来获取异常ID", "蓝"))
        return

    print(_c(f"\n═══════════════ 异常详情 ═══════════════", "紫", "粗"))
    print(_c(f"异常ID: ", "蓝") + _c(anomaly.anomaly_id, "黄", "粗"))
    print(_c(f"类型: ", "蓝") + _c(anomaly.anomaly_type.value, "红", "粗"))
    print(_c(f"严重级: ", "蓝") + anomaly.severity)
    print(_c(f"宠物: ", "蓝") + f"{anomaly.pet_name} ({anomaly.pet_id})")
    print(_c(f"状态: ", "蓝") + _c(anomaly.status.value, "黄", "粗"))
    print(_c(f"描述: ", "蓝") + anomaly.description)
    print(_c(f"卡住原因: ", "红", "粗") + _c(anomaly.block_reason, "红"))
    print(_c(f"下一步指引: ", "绿", "粗") + anomaly.next_step)
    print(_c(f"责任人-角色: ", "蓝") + anomaly.responsible_role)
    print(_c(f"责任人-联系: ", "蓝") + anomaly.responsible_contact)
    print(_c(f"体重曲线索引: ", "蓝") + _c(anomaly.weight_curve_ref, "青"))
    print(_c(f"本次计算口径: ", "蓝") + _c(anomaly.calc_formula, "青"))
    print(_c(f"创建/更新: ", "蓝") + f"{anomaly.created_at} / {anomaly.updated_at}")
    if anomaly.resolved_at:
        print(_c(f"解决人/时间: ", "蓝") + f"{anomaly.resolved_by} / {anomaly.resolved_at}")

    print(_c(f"\n── 原始材料来源（{len(anomaly.involved_record_ids)} 条涉及记录） ──", "紫", "粗"))
    for i, rid in enumerate(anomaly.involved_record_ids, start=1):
        rec = engine._find_record(rid)
        if not rec:
            print(_c(f"  #{i} 记录ID={rid}（已不在当前数据中）", "黄"))
            continue
        print(_c(f"  #{i} 记录: ", "蓝") + f"{rec.pet_name}({rec.pet_id}) @ {rec.source_file}:{rec.source_row}")
        print(_c(f"     原始体重值: ", "蓝") + f"'{rec.raw_weight_value}'  单位字段: '{rec.raw_unit_value}'")
        print(_c(f"     解析后: ", "蓝") + f"{rec.weight_kg} kg (std_unit={rec.weight_unit})  状态: {rec.processing_status.value}")
        if rec.measure_date:
            print(_c(f"     测量日期: ", "蓝") + rec.measure_date.isoformat())
        if rec.remark:
            print(_c(f"     备注: ", "蓝") + rec.remark)
        if rec.data_source:
            print(_c(f"     来源: ", "蓝") + rec.data_source)

    print(_c(f"\n── 关联体重曲线（{anomaly.pet_name}） ──", "青", "粗"))
    snap = curve_mgr.build_curve(anomaly.pet_id)
    print(f"宠物: {snap.pet_name}({snap.pet_id})  趋势: {snap.trend}  基线: {snap.baseline_weight_kg}kg  最新: {snap.last_weight_kg}kg")
    print(f"计算说明: {snap.calc_note}")
    for p in snap.points:
        marker = ""
        if p["record_id"] in anomaly.involved_record_ids:
            marker = _c(" ◄── 关联异常（本次计算用到）", "红", "粗")
        st_color = "绿" if p["status"] in ("已确认",) else ("黄" if p["status"] == "需确认单位" else "红")
        print(_c(f"  [{p['date'][:10]}] {p['weight_kg']}kg  ", "白") +
              _c(f"[{p['status']}]", st_color) +
              _c(f"  来源:{p['source_file']}:{p['source_row']}", "蓝") + marker)

    hist = engine.get_history_for_anomaly(anomaly.anomaly_id)
    if hist:
        print(_c(f"\n── 变更历史（共{len(hist)}条，改判后可在此回看旧材料、新备注和改判原因） ──", "黄", "粗"))
        for i, h in enumerate(hist, start=1):
            print(_c(f"  #{i} [{h.changed_at}] {h.action}  by {h.changed_by}", "黄", "粗"))
            if h.revision_reason:
                print(_c(f"     改判原因: ", "黄") + _c(h.revision_reason, "黄", "粗"))
            if h.previous_conclusion or h.new_conclusion:
                print(_c(f"     原结论: ", "红") + h.previous_conclusion +
                      _c("  → 新结论: ", "绿") + _c(h.new_conclusion, "绿", "粗"))
            if h.old_values:
                for k, v in h.old_values.items():
                    nv = h.new_values.get(k)
                    print(_c(f"     [涉及记录 {k[:8]}...] 旧值: ", "红") + json.dumps(v, ensure_ascii=False) +
                          _c("  → 新值: ", "绿") + json.dumps(nv, ensure_ascii=False))
            if h.old_remark or h.new_remark:
                print(_c(f"     旧备注: ", "红") + h.old_remark)
                print(_c(f"     新备注: ", "绿") + h.new_remark)
            if h.source_materials_ref:
                print(_c(f"     源材料引用: ", "蓝") + ", ".join(h.source_materials_ref))
    else:
        print(_c("\n（尚无变更历史 — 做一次 confirm-unit 或 revise 后会在这里显示）", "黄"))


def cmd_curve(args):
    curve_mgr, loader, engine, exporter = _load_context()
    _pipeline(loader, engine, exporter, args, detect=True)
    curves = curve_mgr.build_all_curves()
    pet_id = args.pet_id
    if pet_id:
        snaps = [(pet_id, curves.get(pet_id))] if curves.get(pet_id) else []
    else:
        snaps = sorted(curves.items())
    for pid, snap in snaps:
        print(_c(f"\n═══════════════ 体重曲线: {snap.pet_name} ({pid}) ═══════════════", "青", "粗"))
        print(f"趋势: {snap.trend}  基线: {snap.baseline_weight_kg}kg  最新: {snap.last_weight_kg}kg")
        print(f"计算说明: {snap.calc_note}")
        for p in snap.points:
            st_color = "绿" if p["status"] in ("已确认",) else ("黄" if p["status"] in ("需确认单位",) else "红")
            print(_c(f"  [{p['date'][:10]}] {p['weight_kg'] if p['weight_kg'] else '?'}kg  ", "白") +
                  _c(f"[{p['status']}]", st_color) +
                  _c(f"  来源:{p['source_file']}:{p['source_row']}", "蓝"))
    out = exporter.export_curves_csv({pid: s.to_dict() for pid, s in curves.items()})
    print(_c(f"\n曲线JSON已导出: {out}", "绿"))


def cmd_confirm_unit(args):
    curve_mgr, loader, engine, exporter = _load_context()
    _pipeline(loader, engine, exporter, args, detect=True)
    result = engine.confirm_unit(args.anomaly_id, args.unit, args.operator or "阿岑", args.remark or "")
    if not result:
        print(_c(f"未找到异常ID匹配: {args.anomaly_id}", "红"))
        print(_c("可用命令: python3 rescue_anomaly.py queue --type \"单位混写\" 来获取异常ID", "蓝"))
        return
    _persist_all(engine, exporter)
    print(_c(f"已确认单位为: {args.unit}", "绿", "粗"))
    print(_c(f"变更历史已保存，再跑一次 detail {args.anomaly_id} 可以看到历史记录", "绿"))
    print(_c(f"涉及异常ID: {result.anomaly_id}", "蓝"))


def cmd_revise(args):
    curve_mgr, loader, engine, exporter = _load_context()
    _pipeline(loader, engine, exporter, args, detect=True)
    override = {}
    if args.new_weight_kg:
        override["weight_kg"] = float(args.new_weight_kg)
    result = engine.revise_conclusion(
        anomaly_id=args.anomaly_id,
        new_conclusion=args.new_conclusion,
        revision_reason=args.reason,
        operator=args.operator or "阿岑",
        new_remark=args.remark or "",
        override_values=override or None,
    )
    if not result:
        print(_c(f"未找到异常ID匹配: {args.anomaly_id}", "红"))
        print(_c("可用命令: python3 rescue_anomaly.py queue --status \"数据冲突待核\" 来获取异常ID", "蓝"))
        return
    _persist_all(engine, exporter)
    print(_c(f"已改判结论为: {args.new_conclusion}", "绿", "粗"))
    print(_c(f"改判原因: {args.reason}", "蓝"))
    print(_c(f"变更历史已保存，再跑一次 detail {args.anomaly_id} 可以看到旧材料、新备注和改判原因", "绿"))


def cmd_export(args):
    curve_mgr, loader, engine, exporter = _load_context()
    _pipeline(loader, engine, exporter, args, detect=True)

    filters = {}
    if args.status:
        filters["status"] = args.status
    if args.type:
        filters["anomaly_type"] = args.type
    if args.pet_id:
        filters["pet_id"] = args.pet_id
    if args.responsible:
        filters["responsible_role"] = args.responsible

    queue = engine.anomaly_queue_to_dicts(filters)
    fmt = args.format or "csv"
    fn = args.filename or f"异常队列.{fmt}"
    if fmt == "csv":
        path = exporter.export_anomaly_queue_csv(queue, fn, filters)
    elif fmt in ("xlsx", "xls"):
        path = exporter.export_anomaly_queue_xlsx(queue, fn, filters)
    else:
        path = os.path.join(exporter.output_dir, fn)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(queue, f, ensure_ascii=False, indent=2)
    print(_c(f"已导出: {path}", "绿", "粗"))
    print(_c(f"  共 {len(queue)} 条，筛选: {filters or '无'}", "蓝"))
    print(_c(f"  [口径一致性] 屏幕上筛到什么，文件里就对应什么；另存 .filters.json 记录生效条件", "蓝"))

    curves = curve_mgr.build_all_curves()
    curves_path = curve_mgr.save_curves_json(os.path.join(exporter.output_dir, "体重曲线.json"))
    hist_path = exporter.export_history_csv(engine.history, "变更历史.csv")
    eng_hist = os.path.join(exporter.output_dir, "变更历史.json")
    engine.save_history(eng_hist)
    print(_c(f"体重曲线: {curves_path}", "绿"))
    print(_c(f"变更历史: {hist_path}", "绿"))
    print(_c(f"变更历史(JSON): {eng_hist}", "绿"))


def cmd_summary(args):
    curve_mgr, loader, engine, exporter = _load_context()
    _pipeline(loader, engine, exporter, args, detect=True)
    curves = curve_mgr.build_all_curves()
    anomalies = engine.anomalies
    print(_c(f"\n═══════════════ 数据总览 ═══════════════", "紫", "粗"))
    print(_c(f"  加载记录数: ", "蓝") + f"{len(curve_mgr.records)}")
    print(_c(f"  涉及宠物数: ", "蓝") + f"{len(curves)}")
    st = Counter(r.processing_status.value for r in curve_mgr.records)
    print(_c(f"  记录状态分布: ", "蓝") + str(dict(st)))
    curves_issues = {pid: s for pid, s in curves.items() if len(s.points) < 3 or s.baseline_weight_kg is None}
    print(_c(f"  曲线点数不足或无基线: ", "黄") + f"{len(curves_issues)} 只")
    at = Counter(a.anomaly_type.value for a in anomalies)
    print(_c(f"  异常按类型: ", "红") + str(dict(at)))
    ast = Counter(a.status.value for a in anomalies)
    print(_c(f"  异常按状态: ", "黄") + str(dict(ast)))
    unresolved = [a for a in anomalies if a.status.value not in ("已解决", "已改判", "已确认", "已归档")]
    print(_c(f"  未解决异常数: ", "红", "粗") + _c(f"{len(unresolved)}", "红", "粗"))
    print(_c(f"\n═══════════════════════════════════════", "紫"))


def build_parser():
    p = argparse.ArgumentParser(prog="rescue_anomaly.py", description="流浪动物救助异常提醒 CLI")
    p.add_argument("-i", "--input", help="输入文件或目录（默认 data_incoming/）")
    sub = p.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("load", help="步骤1：加载数据 + 跑异常检测 + 生成首次异常队列")
    p1.set_defaults(func=cmd_load)

    p2 = sub.add_parser("queue", help="步骤2：查看/筛选 异常队列 并导出")
    p2.add_argument("--status", help="按处理状态筛：待处理/需确认单位/数据冲突待核/字段缺失/已确认/已解决/已改判")
    p2.add_argument("--type", help="按异常类型筛：单位混写/体重骤变/新旧记录冲突/必填字段缺失/离群值/重复记录")
    p2.add_argument("--pet-id", dest="pet_id")
    p2.add_argument("--responsible", help="按责任人角色：运营主管/宠物训练师/数据录入员")
    p2.add_argument("-f", "--format", choices=["csv", "xlsx", "json"], default="csv")
    p2.set_defaults(func=cmd_queue)

    p3 = sub.add_parser("detail", help="步骤3：追异常明细，回到体重曲线 + 计算口径")
    p3.add_argument("anomaly_id", help="异常ID前缀或完整ID")
    p3.set_defaults(func=cmd_detail)

    p4 = sub.add_parser("curve", help="查看体重曲线")
    p4.add_argument("--pet-id", dest="pet_id")
    p4.set_defaults(func=cmd_curve)

    p5 = sub.add_parser("confirm-unit", help="人工处理：确认单位（单位混写）")
    p5.add_argument("anomaly_id")
    p5.add_argument("unit", help="标准单位：kg/g/jin/lb")
    p5.add_argument("--operator", default="阿岑")
    p5.add_argument("--remark", default="")
    p5.set_defaults(func=cmd_confirm_unit)

    p6 = sub.add_parser("revise", help="人工处理：改判结论（新旧记录冲突）")
    p6.add_argument("anomaly_id")
    p6.add_argument("new_conclusion", help="改判后的结论描述")
    p6.add_argument("--reason", required=True, help="改判原因（必填）")
    p6.add_argument("--new-weight-kg", dest="new_weight_kg", help="修正后的体重kg")
    p6.add_argument("--operator", default="阿岑")
    p6.add_argument("--remark", default="")
    p6.set_defaults(func=cmd_revise)

    p7 = sub.add_parser("export", help="按屏幕筛选口径导出异常队列")
    p7.add_argument("--status")
    p7.add_argument("--type")
    p7.add_argument("--pet-id", dest="pet_id")
    p7.add_argument("--responsible")
    p7.add_argument("-f", "--format", choices=["csv", "xlsx", "json"], default="csv")
    p7.add_argument("--filename")
    p7.set_defaults(func=cmd_export)

    p8 = sub.add_parser("summary", help="数据总览（快速检查）")
    p8.set_defaults(func=cmd_summary)

    return p


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
