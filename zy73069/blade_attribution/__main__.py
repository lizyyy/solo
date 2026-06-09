"""CLI 入口命令：
   1) 先跑：python -m blade_attribution run          # 一键跑完整流程并生成异常队列
   2) 再看：python -m blade_attribution show-queues  # 看 output/queues 下哪份异常队列
   另提供：rerun / export / boundary / version / check 等子命令
"""
import os
import sys
import json
import click
from datetime import datetime
from typing import List

from .engine import AttributionEngine, load_thresholds
from .boundary_tracker import BoundaryTracker, VerdictStatus
from .version_manager import VersionManager
from .spare_marker import SparePartMarker, parse_replacement_rules
from .queue import AnomalyQueue, QUEUE_DIR, EXPORT_DIR
from .sample_data import sample_measurements, sample_spare_parts, sample_handover_notes
from .models import AttributionRecord, Measurement, SparePart, AnomalyLevel, RecordStatus


sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _build_all():
    """运行全流程：归因→边界追踪→版本→备件标记→队列生成"""
    cfg = load_thresholds()
    engine = AttributionEngine(cfg)
    tracker = BoundaryTracker()
    vmgr = VersionManager()
    sm_rules = cfg.get("spare_parts", {}).get("replacement_markers", [])
    sm = SparePartMarker(sm_rules)
    queue = AnomalyQueue(tracker, vmgr, sm)

    measurements = sample_measurements()
    spare_map = {tid: (parts, win) for tid, parts, win in sample_spare_parts()}
    notes_map = sample_handover_notes()

    run_id = vmgr.new_run_id()
    records: List[AttributionRecord] = []

    for idx, m in enumerate(measurements):
        key = f"{m.turbine_id}-B{m.blade_no}"
        parts, window = spare_map.get(m.turbine_id, ([], "2026-06-11"))
        notes = notes_map.get(key, "")
        rec = engine.attribute(m, parts, window, notes)
        rec = vmgr.register_run(rec, run_id=run_id, is_rerun=(idx >= 4))
        records.append(rec)

    return engine, tracker, vmgr, sm, queue, records, run_id


@click.group(help="风机叶片异常归因系统 CLI")
def cli():
    pass


@cli.command("run", help="【第1步】先跑：一键归因并生成异常队列（输出到 output/queues/）")
@click.option("--with-rerun", is_flag=True, help="模拟同材料重跑（追加后补备注、生成最新导出版本）")
def cmd_run(with_rerun):
    click.echo("=" * 60)
    click.echo("【STEP 1/4】加载阈值配置与示例数据，开始归因判定...")
    engine, tracker, vmgr, sm, queue, records, run_id = _build_all()

    if with_rerun:
        click.echo("【STEP 1b/4】模拟同样材料重跑（追加后补备注 + 标记最新导出）...")
        for i, r in enumerate(records[:3]):
            rerun = engine.attribute(r.measurement, r.spare_parts, "2026-06-11", r.handover_notes)
            rerun = vmgr.register_run(rerun, is_rerun=True,
                                      appended_note=f"[{datetime.now().strftime('%m-%d %H:%M')}] 现场复核后补：补充振动频谱图，确认非共振")
            records.append(vmgr.mark_exported(rerun))

    click.echo("【STEP 2/4】归因完成，统计如下：")
    level_cnt = {}
    for r in records:
        level_cnt.setdefault(r.level.value, 0)
        level_cnt[r.level.value] += 1
    for lv, cnt in level_cnt.items():
        click.echo(f"  · {lv}: {cnt} 条")

    vs = vmgr.version_summary(records)
    click.echo(f"【STEP 3/4】版本状态：{vs['distribution']}")

    click.echo("【STEP 4/4】生成异常队列（预警/严重/边界），输出到 output/queues/ ...")
    q = queue.build_queue(records)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = queue.save_queue_csv(q, f"anomaly_queue_{ts}.csv")
    json_path = queue.save_queue_json(q, f"anomaly_queue_{ts}.json")
    xlsx_path = queue.export_attribution_xlsx(records, f"blade_attribution_{ts}.xlsx")

    pending = tracker.pending_list(records)
    click.echo("")
    click.echo("=" * 60)
    click.echo(f"✅ 全流程完成 | 运行ID: {run_id}")
    click.echo(f"   异常队列(CSV):   {csv_path}")
    click.echo(f"   异常队列(JSON):  {json_path}")
    click.echo(f"   归因导出(XLSX):  {xlsx_path}")
    click.echo(f"   待人工边界样本:  {len(pending)} 条")
    if pending:
        click.echo("   边界样本卡点：")
        for p in pending:
            click.echo(f"     - {p['record_id']} 卡在【{p['stuck_at']}】{p['stuck_detail']}")
    click.echo("")
    click.echo(f"👉 【第2步】再看哪份异常队列：执行  python -m blade_attribution show-queues")
    return records, q


@cli.command("show-queues", help="【第2步】查看已生成的异常队列列表（output/queues/）")
def cmd_show_queues():
    queues = AnomalyQueue.list_queues()
    click.echo("=" * 60)
    click.echo(f"📋 异常队列目录: {QUEUE_DIR}")
    click.echo("-" * 60)
    if not queues:
        click.echo("   (空) 请先执行  python -m blade_attribution run  生成队列")
    else:
        click.echo(f"   {'文件名':<40} {'大小(KB)':>10} {'修改时间':>20}")
        for q in queues:
            click.echo(f"   {q['filename']:<40} {q['size_kb']:>10} {q['mtime']:>20}")
    click.echo("-" * 60)
    click.echo(f"📦 导出目录: {EXPORT_DIR}")
    if os.path.exists(EXPORT_DIR):
        for f in sorted(os.listdir(EXPORT_DIR)):
            fp = os.path.join(EXPORT_DIR, f)
            sz = round(os.path.getsize(fp) / 1024, 1)
            mt = datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S")
            click.echo(f"   {f:<40} {sz:>10} {mt:>20}")


@cli.command("boundary", help="列出边界样本并说明卡点（公式/单位/阈值）")
@click.option("--submit", nargs=4, metavar="RECORD_ID STATUS OPERATOR REASON",
              help="提交人工结论: 记录ID 人工状态 操作人 原因")
def cmd_boundary(submit):
    engine, tracker, vmgr, sm, queue, records, rid = _build_all()

    if submit:
        rec_id, status, operator, reason = submit
        verdict = tracker.submit_verdict(rec_id, status, operator, reason)
        click.echo(f"✅ 已提交人工结论: {json.dumps(verdict, ensure_ascii=False, indent=2)}")
        return

    pending = tracker.pending_list(records)
    click.echo("=" * 60)
    click.echo(f"🔍 边界样本卡点说明（共 {len(pending)} 条待处理）")
    click.echo("-" * 60)
    for p in pending:
        click.echo(f"  📌 {p['record_id']} ({p['turbine']}-{p['blade']})")
        click.echo(f"     卡点类型: {p['stuck_at']}")
        click.echo(f"     详细说明: {p['stuck_detail']}")
        click.echo(f"     当前结论来源: {p['final_verdict_source']}")
        click.echo("")

    click.echo("💡 提交人工结论示例:")
    click.echo(f"   python -m blade_attribution boundary --submit {pending[0]['record_id'] if pending else 'BA-XXX'} '人工确认-预警' '张工' '容差内确认按预警处理'")


@cli.command("version", help="查看同一份材料的版本差异（旧处理/后补备注/最新导出）")
def cmd_version():
    engine, tracker, vmgr, sm, queue, records, rid = _build_all()

    for r in records[:3]:
        vs = vmgr.get_material_versions(r)
        click.echo("=" * 60)
        click.echo(f"🔄 材料 {r.record_id} 的处理版本链（共 {len(vs)} 版）")
        for v in vs:
            tags = []
            if v["is_latest_export"]:
                tags.append("⭐最新导出")
            if v["is_old_processed"]:
                tags.append("📜旧处理")
            if v["is_appended"]:
                tags.append("📝后补备注")
            tag_str = " ".join(tags)
            click.echo(f"   [{v['order']}] RUN={v['run_id']} 状态={v['status']} {tag_str}")
            if v["appended_note"]:
                click.echo(f"        后补内容: {v['appended_note']}")


@cli.command("check", help="校验异常队列与当前页面判断是否一致（防止两套话）")
@click.option("--queue-file", type=click.Path(exists=True), help="已生成的队列JSON文件路径")
def cmd_check(queue_file):
    engine, tracker, vmgr, sm, queue, records, rid = _build_all()
    q = queue.build_queue(records)

    if queue_file:
        with open(queue_file, "r", encoding="utf-8") as f:
            old_queue = json.load(f)
        old_sig = old_queue[0]["_consistency_signature"] if old_queue else ""
    else:
        old_sig = q[0]["_consistency_signature"] if q else ""

    ok, report = queue.check_consistency(records, old_sig)
    click.echo("=" * 60)
    click.echo(f"🔗 一致性校验结果: {'✅ 一致' if ok else '❌ 不一致！两套话！'}")
    click.echo(f"   队列签名:   {report['queue_signature']}")
    click.echo(f"   当前签名:   {report['current_signature']}")
    click.echo(f"   校验时间:   {report['check_time']}")
    if not ok:
        click.echo("   差异记录:")
        for m in report["mismatched_records"]:
            click.echo(f"     - {m['record_id']}: 当前={m['current_level']}/{m['current_status']}")


@cli.command("spares", help="查看备件型号替换标记和到货延迟情况")
def cmd_spares():
    engine, tracker, vmgr, sm, queue, records, rid = _build_all()
    click.echo("=" * 60)
    click.echo("🔧 备件清单（含型号替换标记 / 到货延迟）")
    click.echo("-" * 60)
    for r in records:
        rows = sm.to_export_rows(r.spare_parts)
        if not rows:
            continue
        click.echo(f"\n🌀 {r.measurement.turbine_id} 叶片B{r.measurement.blade_no}:")
        for s in rows:
            repl_icon = "🔁" if s["is_replacement"] else "  "
            late_icon = "⚠️ " if s["is_late"] else "  "
            click.echo(f"  {repl_icon}{late_icon} {s['marker_text']}  交期{s['lead_time_days']}天  延迟{s['arrival_delay_days']}天  需{s['required_date']}→到{s['arrival_date']}")


@cli.command("trace", help="查看单条记录的完整证据链（不靠班组交接凑结论）")
@click.argument("record_id", required=False)
def cmd_trace(record_id):
    engine, tracker, vmgr, sm, queue, records, rid = _build_all()
    targets = [r for r in records if r.level == AnomalyLevel.BOUNDARY] or records
    target = next((r for r in targets if r.record_id == record_id), targets[0])
    t = tracker.build_evidence_trace(target)
    click.echo("=" * 60)
    click.echo(f"🧾 证据链追踪: {t['record_id']} ({t['turbine']}-{t['blade']})")
    click.echo(f"   测量时间: {t['timestamp']}")
    click.echo(f"   数据源: {', '.join(t['data_sources'])}")
    click.echo(f"   班组交接仅参考: {'是' if t['handover_notes_presence'] else '无'}")
    click.echo(f"   证据链完整: {'✅ 完整' if t['trace_complete'] else '❌ 不完整(仅靠交接)'}")
    click.echo("-" * 60)
    for step in t["calculation_steps"]:
        click.echo(f"  [{step['order']}] {step['name']}")
        click.echo(f"      公式: {step['formula']}")
    click.echo("-" * 60)
    fv = t["final_verdict"]
    click.echo(f"   最终判定: {fv['level']} | {fv['root_cause']}")
    click.echo(f"   结论: {fv['conclusion']}")
    click.echo(f"   结论来源: {fv['source']}")
    if fv.get("manual_status"):
        click.echo(f"   人工状态: {fv.get('manual_status')}")


def main():
    cli()


if __name__ == "__main__":
    main()
