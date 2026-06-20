"""CLI 入口命令(行为与 README 一致)：
   1) 先跑：python -m blade_attribution run          # 一键归因并生成异常队列(含稳定签名)
   2) 看链路：python -m blade_attribution version    # 看持久化的 旧处理/后补备注/最新导出 演进
   3) 看队列：python -m blade_attribution show-queues
   4) 复核：python -m blade_attribution check --queue-file output/queues/anomaly_queue_*.json
   另提供：boundary / spares / trace 子命令
"""
import os
import sys
import json
import click
from datetime import datetime
from typing import List

from .engine import AttributionEngine, load_thresholds
from .boundary_tracker import BoundaryTracker
from .version_manager import VersionManager, HISTORY_PATH
from .spare_marker import SparePartMarker
from .queue import AnomalyQueue, QUEUE_DIR, EXPORT_DIR
from .sample_data import sample_measurements, sample_spare_parts, sample_handover_notes
from .models import AttributionRecord, AnomalyLevel, RecordStatus


sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _build_all():
    """纯函数：归因判定 + 加载持久化版本历史(只读挂载，不修改历史)。
    每次调用都从样例材料+阈值+history.json 复现同一批判断与版本状态。"""
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

    records: List[AttributionRecord] = []
    for m in measurements:
        key = f"{m.turbine_id}-B{m.blade_no}"
        parts, window = spare_map.get(m.turbine_id, ([], "2026-06-11"))
        notes = notes_map.get(key, "")
        rec = engine.attribute(m, parts, window, notes)
        vmgr.attach_latest(rec)
        records.append(rec)

    return engine, tracker, vmgr, sm, queue, records


@click.group(help="风机叶片异常归因系统 CLI")
def cli():
    pass


@cli.command("run", help="【第1步】先跑：一键归因并生成异常队列(带稳定判定签名)")
@click.option("--with-rerun", is_flag=True, help="真实追加一次现场复核(后补备注)到持久化历史")
@click.option("--reset-history", is_flag=True, help="先重置版本历史为样例播种状态")
def cmd_run(with_rerun, reset_history):
    if reset_history:
        VersionManager().reset()
        click.echo("♻️  已重置版本历史为样例播种状态(旧处理/后补备注/最新导出)")

    click.echo("=" * 64)
    click.echo("【STEP 1/4】加载阈值配置与现场样例，开始归因判定...")
    engine, tracker, vmgr, sm, queue, records = _build_all()

    if with_rerun:
        click.echo("【STEP 1b】真实追加一次现场复核(后补备注)到持久化历史 history.json ...")
        run_id = vmgr.new_run_id()
        note = f"[{datetime.now().strftime('%m-%d %H:%M')}] 现场复核后补：补充振动频谱图，确认非共振"
        for r in records:
            vmgr.append_run(r, RecordStatus.APPENDED, appended_note=note, run_id=run_id)
        for r in records:
            vmgr.attach_latest(r)
        click.echo(f"      已为 {len(records)} 份材料追加后补备注(运行ID={run_id})")

    click.echo("【STEP 2/4】归因完成，等级统计：")
    level_cnt = {}
    for r in records:
        level_cnt.setdefault(r.level.value, 0)
        level_cnt[r.level.value] += 1
    for lv, cnt in sorted(level_cnt.items(), key=lambda x: -x[1]):
        click.echo(f"  · {lv}: {cnt} 条")

    vs = vmgr.version_summary(records)
    click.echo(f"【STEP 3/4】版本状态(读自 history.json)：{vs['distribution']}")
    click.echo(f"      持久化版本条目：{vs['total_version_entries']} 条 / {vs['unique_materials']} 份材料")
    click.echo(f"      history.json: {HISTORY_PATH}")

    click.echo("【STEP 4/4】生成异常队列(预警/严重/边界)，输出到 output/queues/ ...")
    q, sig = queue.build_queue(records)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = queue.save_queue_csv(q, f"anomaly_queue_{ts}.csv")
    json_path = queue.save_queue_json(q, sig, f"anomaly_queue_{ts}.json", len(q))
    xlsx_path = queue.export_attribution_xlsx(records, f"blade_attribution_{ts}.xlsx")

    pending = tracker.pending_list(records)
    click.echo("")
    click.echo("=" * 64)
    click.echo("✅ 全流程完成")
    click.echo(f"   异常队列(CSV):   {csv_path}")
    click.echo(f"   异常队列(JSON):  {json_path}")
    click.echo(f"   归因导出(XLSX):  {xlsx_path}")
    click.echo(f"   判定签名(稳定):  {sig}")
    click.echo(f"   待人工边界样本:  {len(pending)} 条")
    if pending:
        click.echo("   边界样本卡点：")
        for p in pending:
            click.echo(f"     - {p['record_id']} 卡在【{p['stuck_at']}】{p['stuck_detail']}")
    click.echo("")
    click.echo("👉 下一步:")
    click.echo("   看版本链路:  python -m blade_attribution version")
    click.echo("   看队列列表:  python -m blade_attribution show-queues")
    click.echo(f"   复核一致性:  python -m blade_attribution check --queue-file {os.path.basename(json_path)}")


@cli.command("version", help="【第2步】查看版本链路(旧处理/后补备注/最新导出)，读自持久化 history.json")
def cmd_version():
    engine, tracker, vmgr, sm, queue, records = _build_all()
    click.echo("=" * 64)
    click.echo(f"📂 版本历史文件: {HISTORY_PATH}")
    click.echo(f"   共 {len(records)} 份材料，每份含旧处理→后补备注→最新导出 演进")
    click.echo("=" * 64)
    for r in records:
        vs = vmgr.get_material_versions(r)
        click.echo(f"\n🔄 {r.record_id} ({r.measurement.turbine_id}-B{r.measurement.blade_no}) 版本链（{len(vs)} 版）")
        for v in vs:
            tags = []
            if v["is_latest_export"]:
                tags.append("⭐最新导出")
            if v["is_old_processed"]:
                tags.append("📜旧处理")
            if v["is_appended"]:
                tags.append("📝后补备注")
            tag_str = " ".join(tags) if tags else "  "
            click.echo(f"   [{v['order']}] {v['run_id']}")
            click.echo(f"       状态: {v['status']}  {tag_str}  @ {v['created_at']}")
            if v["previous_run"]:
                click.echo(f"       承接上一版: {v['previous_run']}")
            if v["appended_note"]:
                click.echo(f"       后补内容: {v['appended_note']}")


@cli.command("show-queues", help="【第3步】查看已生成的异常队列列表(output/queues/)与导出文件")
def cmd_show_queues():
    queues = AnomalyQueue.list_queues()
    click.echo("=" * 64)
    click.echo(f"📋 异常队列目录: {QUEUE_DIR}")
    click.echo("-" * 64)
    if not queues:
        click.echo("   (空) 请先执行  python -m blade_attribution run  生成队列")
    else:
        click.echo(f"   {'文件名':<42} {'大小(KB)':>10} {'修改时间':>20}")
        for q in queues:
            click.echo(f"   {q['filename']:<42} {q['size_kb']:>10} {q['mtime']:>20}")
    click.echo("-" * 64)
    click.echo(f"📦 导出目录: {EXPORT_DIR}")
    if os.path.exists(EXPORT_DIR):
        for f in sorted(os.listdir(EXPORT_DIR)):
            fp = os.path.join(EXPORT_DIR, f)
            if not os.path.isfile(fp):
                continue
            sz = round(os.path.getsize(fp) / 1024, 1)
            mt = datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S")
            click.echo(f"   {f:<42} {sz:>10} {mt:>20}")


@cli.command("check", help="【第4步】用已导出的队列JSON复核异常判断是否一致(稳定签名，不怕重启/时间戳)")
@click.option("--queue-file", type=click.Path(exists=True), help="已生成的队列JSON文件路径")
def cmd_check(queue_file):
    engine, tracker, vmgr, sm, queue, records = _build_all()
    current_sig = queue.judgment_signature(records)

    if queue_file:
        stored_sig, stored_records, stored_hashes, is_new = AnomalyQueue.load_queue_envelope(queue_file)
        source_label = f"队列文件: {os.path.basename(queue_file)}"
        if not is_new:
            click.echo("⚠️  该队列是旧格式(不稳定 hash)，无法稳定复核，请重新执行 run 生成新队列后再次 check。")
            return
    else:
        stored_sig, stored_hashes = current_sig, queue.per_record_judgment_hashes(records)
        source_label = "本次内存队列(未指定 --queue-file)"

    ok, report = queue.check_consistency(records, stored_sig, stored_hashes)
    click.echo("=" * 64)
    click.echo(f"🔗 一致性复核 | 来源: {source_label}")
    click.echo(f"   结果: {'✅ 一致' if ok else '❌ 不一致(两套话)'}")
    click.echo(f"   整批签名匹配: {'是' if report['signature_match'] else '否'}")
    click.echo(f"   逐条签名匹配: {'是' if report['per_record_match'] else '否'}")
    click.echo(f"   队列签名:   {stored_sig[:24]}{'...' if len(stored_sig) > 24 else ''}")
    click.echo(f"   当前签名:   {current_sig[:24]}{'...' if len(current_sig) > 24 else ''}")
    click.echo(f"   复核时间:   {report['check_time']}")
    if not ok:
        click.echo("   差异记录:")
        for m in report["mismatched_records"]:
            click.echo(f"     - {m['record_id']}: {m['detail']}")
    else:
        click.echo("   队列里的异常判断 == 工具重新复核的判断，不会两套话。")


@cli.command("boundary", help="列出边界样本并说明卡点(公式/单位/阈值)，可提交人工结论")
@click.option("--submit", nargs=4, metavar="RECORD_ID STATUS OPERATOR REASON",
              help="提交人工结论: 记录ID 人工状态 操作人 原因")
def cmd_boundary(submit):
    engine, tracker, vmgr, sm, queue, records = _build_all()

    if submit:
        rec_id, status, operator, reason = submit
        verdict = tracker.submit_verdict(rec_id, status, operator, reason)
        click.echo(f"✅ 已提交人工结论: {json.dumps(verdict, ensure_ascii=False, indent=2)}")
        return

    pending = tracker.pending_list(records)
    click.echo("=" * 64)
    click.echo(f"🔍 边界样本卡点说明（共 {len(pending)} 条待处理）")
    click.echo("-" * 64)
    for p in pending:
        click.echo(f"  � {p['record_id']} ({p['turbine']}-{p['blade']})")
        click.echo(f"     卡点类型: {p['stuck_at']}")
        click.echo(f"     详细说明: {p['stuck_detail']}")
        click.echo(f"     当前结论来源: {p['final_verdict_source']}")
        click.echo("")
    if pending:
        click.echo("💡 提交人工结论示例:")
        click.echo(f"   python -m blade_attribution boundary --submit {pending[0]['record_id']} '人工确认-预警' '张工' '容差内确认按预警处理'")


@cli.command("spares", help="查看备件型号替换标记和到货延迟情况")
def cmd_spares():
    engine, tracker, vmgr, sm, queue, records = _build_all()
    click.echo("=" * 64)
    click.echo("🔧 备件清单（含型号替换标记 / 到货延迟）")
    click.echo("-" * 64)
    for r in records:
        rows = sm.to_export_rows(r.spare_parts)
        if not rows:
            continue
        click.echo(f"\n🌀 {r.measurement.turbine_id} 叶片B{r.measurement.blade_no}:")
        for s in rows:
            repl_icon = "🔁" if s["is_replacement"] else "  "
            late_icon = "⚠️ " if s["is_late"] else "  "
            click.echo(f"  {repl_icon}{late_icon} {s['marker_text']}  交期{s['lead_time_days']}天  延迟{s['arrival_delay_days']}天  需{s['required_date']}→到{s['arrival_date']}")


@cli.command("trace", help="查看单条记录的完整证据链(不靠班组交接凑结论)")
@click.argument("record_id", required=False)
def cmd_trace(record_id):
    engine, tracker, vmgr, sm, queue, records = _build_all()
    targets = [r for r in records if r.level == AnomalyLevel.BOUNDARY] or records
    target = next((r for r in targets if r.record_id == record_id), targets[0])
    t = tracker.build_evidence_trace(target)
    click.echo("=" * 64)
    click.echo(f"🧾 证据链追踪: {t['record_id']} ({t['turbine']}-{t['blade']})")
    click.echo(f"   测量时间: {t['timestamp']}")
    click.echo(f"   数据源: {', '.join(t['data_sources'])}")
    click.echo(f"   班组交接仅参考: {'是' if t['handover_notes_presence'] else '无'}")
    click.echo(f"   证据链完整: {'✅ 完整' if t['trace_complete'] else '❌ 不完整(仅靠交接)'}")
    click.echo("-" * 64)
    for step in t["calculation_steps"]:
        click.echo(f"  [{step['order']}] {step['name']}")
        click.echo(f"      公式: {step['formula']}")
    click.echo("-" * 64)
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
