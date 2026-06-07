import click
import json
from datetime import datetime
from .models import ConstructionNotice, RampRecord, Role, RecordStatus
from .store import store
from .scoring import calculate_score, check_score_changed
from .suggestions import generate_suggestion, update_workflow_after_supplement
from .demo_data import load_demo_data, demo_step2_supplement_ramp, demo_step3_manual_correction, demo_step4_rerun


def _print_separator():
    click.echo("=" * 70)


def _print_header(text):
    _print_separator()
    click.echo(f"  {text}")
    _print_separator()


@click.group()
def cli():
    """公交夜班覆盖缺口 - 无障碍坡道复核系统"""
    pass


@cli.command()
@click.option("--full", is_flag=True, help="运行完整演示流程")
def demo(full):
    """加载演示数据并展示完整流程"""
    _print_header("加载演示数据 - 公交夜班覆盖缺口")

    notice_id = load_demo_data()
    click.echo(f"✅ 施工告示已导入，ID: {notice_id}")

    notice = store.get_notice(notice_id)
    click.echo(f"   路段: {notice.road_name}")
    click.echo(f"   施工类型: {notice.construction_type}")
    click.echo(f"   原始备注（保留）: {notice.raw_notes[:80]}...")

    _show_status(notice_id)

    if not full:
        click.echo()
        click.echo("💡 使用 --full 参数运行完整演示流程")
        click.echo("   或逐步运行: bus-night-gap demo-step2 | demo-step3 | demo-step4")
        return

    click.echo()
    click.echo("⏭️  进入步骤2：社区书记周姐补看无障碍坡道记录")
    demo_step2_supplement_ramp(notice_id)
    _show_status(notice_id)

    click.echo()
    click.echo("⏭️  进入步骤3：交通协管人工修正，补充完整信息")
    demo_step3_manual_correction(notice_id)
    _show_status(notice_id)

    click.echo()
    click.echo("⏭️  进入步骤4：重跑生成最终报告")
    demo_step4_rerun(notice_id)
    _show_status(notice_id)

    click.echo()
    _print_header("演示流程完成！")
    click.echo("📋 完整审计日志:")
    _show_audit_logs(notice_id)


@cli.command()
def demo_step2():
    """演示步骤2：社区书记周姐补看无障碍坡道记录"""
    notice_id = _ensure_demo_loaded()
    demo_step2_supplement_ramp(notice_id)
    _show_status(notice_id)


@cli.command()
def demo_step3():
    """演示步骤3：交通协管人工修正"""
    notice_id = _ensure_demo_loaded()
    demo_step3_manual_correction(notice_id)
    _show_status(notice_id)


@cli.command()
def demo_step4():
    """演示步骤4：重跑生成最终报告"""
    notice_id = _ensure_demo_loaded()
    demo_step4_rerun(notice_id)
    _show_status(notice_id)


def _ensure_demo_loaded():
    if not store.list_notices():
        return load_demo_data()
    return store.list_notices()[0].id


@cli.command()
@click.argument("notice_id", required=False)
def status(notice_id):
    """查看当前状态和整改建议"""
    if not notice_id:
        notices = store.list_notices()
        if not notices:
            click.echo("暂无数据，请先运行 bus-night-gap demo 加载演示数据")
            return
        notice_id = notices[0].id

    _show_status(notice_id)


def _show_status(notice_id: str):
    notice = store.get_notice(notice_id)
    if not notice:
        click.echo(f"未找到告示 {notice_id}")
        return

    workflow = store.get_workflow(notice_id)
    latest_score = store.get_latest_score(notice_id)
    suggestion = store.get_latest_suggestion(notice_id)
    all_scores = store.get_all_scores(notice_id)
    ramp_records = store.get_ramp_records_for_notice(notice_id)

    _print_header(f"状态概览 - {notice.road_name}")

    if workflow:
        status_color = "yellow"
        if workflow.status == RecordStatus.SCORE_UNCHANGED:
            status_color = "red"
        elif workflow.status == RecordStatus.RESOLVED:
            status_color = "green"
        click.echo(f"📍 当前步骤: {workflow.step} - {workflow.step_description}")
        click.echo(f"📊 状态: {click.style(workflow.status.value, fg=status_color)}")
        if workflow.current_assignee:
            click.echo(f"👤 当前负责人: {workflow.current_assignee.value}")

    click.echo()
    click.echo(f"📝 施工告示信息:")
    click.echo(f"   路段: {notice.road_name}")
    click.echo(f"   类型: {notice.construction_type}")
    click.echo(f"   工期: {notice.start_date} ~ {notice.end_date}")

    if notice.raw_notes:
        click.echo(f"   💬 原始备注（未清洗）: ")
        click.echo(f"      {notice.raw_notes}")

    click.echo()
    click.echo(f"♿ 坡道记录 ({len(ramp_records)} 条):")
    for r in ramp_records:
        supplement_tag = " [补录]" if r.is_supplement else ""
        status_str = "✅ 有坡道" if r.has_ramp else "❌ 无坡道"
        click.echo(f"   • {r.location}{supplement_tag} - {status_str}")
        if r.ramp_condition:
            click.echo(f"     状况: {r.ramp_condition}, 宽度: {r.width_cm}cm")
        if r.raw_notes:
            click.echo(f"     💬 原始备注: {r.raw_notes}")
        click.echo(f"     录入人: {r.recorded_by.value}, 时间: {r.recorded_at.strftime('%H:%M:%S')}")

    click.echo()
    click.echo(f"🎯 评分历史 ({len(all_scores)} 个版本):")
    for idx, s in enumerate(all_scores):
        marker = " →" if idx == len(all_scores) - 1 else "   "
        click.echo(f"{marker} 版本{s.version}: {s.score:.1f}/{s.max_score}分")
        if idx > 0:
            prev = all_scores[idx - 1]
            diff = s.score - prev.score
            if abs(diff) < 0.001:
                click.echo(f"      ⚠️  {click.style('评分未变化', fg='red')} - 需交通协管复核")
            else:
                click.echo(f"      变化: {diff:+.1f}分")

    if suggestion:
        click.echo()
        _print_header("📋 整改建议")
        click.echo(f"版本: {suggestion.version} | 状态: {suggestion.status.value}")
        click.echo()
        click.echo(f"❓ 为什么这条被留下:")
        click.echo(f"   {suggestion.why_kept}")
        click.echo()
        if suggestion.missing_materials:
            click.echo(f"📦 还缺什么材料:")
            for m in suggestion.missing_materials:
                click.echo(f"   ☐ {m}")
            click.echo()
        click.echo(f"📞 下一步该找谁:")
        click.echo(f"   👉 {suggestion.next_action_person} ({suggestion.next_action.value})")
        if suggestion.notes:
            click.echo()
            click.echo(f"📝 保留的原始备注材料:")
            for line in suggestion.notes.split("\n"):
                click.echo(f"   {line}")


@cli.command()
@click.argument("notice_id", required=False)
@click.option("--entity-type", help="过滤实体类型")
def audit(notice_id, entity_type):
    """查看审计日志（谁改了什么、为什么改）"""
    if not notice_id:
        notices = store.list_notices()
        if not notices:
            click.echo("暂无数据")
            return
        notice_id = notices[0].id

    _show_audit_logs(notice_id, entity_type)


def _show_audit_logs(notice_id: str, entity_type=None):
    logs = store.get_audit_logs(entity_id=notice_id)
    if entity_type:
        logs = [l for l in logs if l.entity_type == entity_type]

    _print_header(f"审计日志 - {notice_id}")
    for log in logs:
        time_str = log.changed_at.strftime("%H:%M:%S")
        click.echo(f"[{time_str}] {log.changed_by.value} {log.action} {log.entity_type}")
        if log.reason:
            click.echo(f"      原因: {log.reason}")
        if log.old_value or log.new_value:
            if log.old_value:
                old_keys = [k for k in log.old_value.keys()][:3]
                click.echo(f"      旧值字段: {', '.join(old_keys)}...")
            if log.new_value:
                new_keys = [k for k in log.new_value.keys()][:3]
                click.echo(f"      新值字段: {', '.join(new_keys)}...")


@cli.command(name="list")
def list_notices():
    """列出所有施工告示"""
    notices = store.list_notices()
    if not notices:
        click.echo("暂无数据，请先运行 bus-night-gap demo 加载演示数据")
        return

    _print_header("施工告示列表")
    for n in notices:
        workflow = store.get_workflow(n.id)
        status = workflow.status.value if workflow else "unknown"
        click.echo(f"• {n.id} | {n.road_name} | {status}")


@cli.command()
@click.option("--road", required=True, help="路段名称")
@click.option("--type", "ctype", required=True, help="施工类型")
@click.option("--start", required=True, help="开始日期")
@click.option("--end", required=True, help="结束日期")
@click.option("--raw-notes", default="", help="原始备注（不要清洗）")
def import_notice(road, ctype, start, end, raw_notes):
    """导入施工告示"""
    notice = ConstructionNotice(
        road_name=road,
        construction_type=ctype,
        start_date=start,
        end_date=end,
        notes=raw_notes[:50] + "..." if len(raw_notes) > 50 else raw_notes,
        raw_notes=raw_notes,
    )
    store.add_notice(notice)
    calculate_score(notice.id)
    generate_suggestion(notice.id)

    click.echo(f"✅ 已导入施工告示: {notice.id}")
    _show_status(notice.id)


@cli.command()
@click.argument("notice_id")
@click.option("--location", required=True, help="坡道位置")
@click.option("--has-ramp/--no-ramp", default=True, help="是否有坡道")
@click.option("--condition", help="坡道状况 (good/fair/poor)")
@click.option("--width", type=int, help="宽度（厘米）")
@click.option("--raw-notes", default="", help="原始备注（保留）")
@click.option("--by", "by_role", default="community_secretary",
              type=click.Choice(["community_secretary", "traffic_coordinator"]),
              help="录入人角色")
def supplement(notice_id, location, has_ramp, condition, width, raw_notes, by_role):
    """补录无障碍坡道记录"""
    record = RampRecord(
        notice_id=notice_id,
        location=location,
        has_ramp=has_ramp,
        ramp_condition=condition,
        width_cm=width,
        notes=raw_notes[:50] + "..." if len(raw_notes) > 50 else raw_notes,
        raw_notes=raw_notes,
        recorded_by=Role(by_role),
        is_supplement=True,
    )
    store.add_ramp_record(record)
    calculate_score(notice_id)
    update_workflow_after_supplement(notice_id)
    generate_suggestion(notice_id)

    click.echo(f"✅ 已补录坡道记录: {record.id}")

    score_changed, latest, previous = check_score_changed(notice_id)
    if not score_changed and latest and previous:
        click.echo()
        click.echo(click.style("⚠️  重要：补录后评分没有变化！", fg="red", bold=True))
        click.echo(f"   补录前: {previous.score:.1f}分")
        click.echo(f"   补录后: {latest.score:.1f}分")
        click.echo("   已标记为待交通协管复核，不会自动归为正常")

    _show_status(notice_id)


@cli.command()
@click.argument("notice_id")
def rerun(notice_id):
    """重跑评分和整改建议"""
    calculate_score(notice_id)
    suggestion = generate_suggestion(notice_id)
    click.echo(f"✅ 已重跑，生成整改建议版本 {suggestion.version}")
    _show_status(notice_id)


@cli.command()
@click.argument("notice_id", required=False)
@click.option("--output", "-o", help="输出文件路径")
def report(notice_id, output):
    """生成完整报告"""
    if not notice_id:
        notices = store.list_notices()
        if not notices:
            click.echo("暂无数据")
            return
        notice_id = notices[0].id

    notice = store.get_notice(notice_id)
    workflow = store.get_workflow(notice_id)
    suggestion = store.get_latest_suggestion(notice_id)
    all_scores = store.get_all_scores(notice_id)
    ramp_records = store.get_ramp_records_for_notice(notice_id)
    audit_logs = store.get_audit_logs(entity_id=notice_id)

    report_data = {
        "report_title": "公交夜班覆盖缺口 - 无障碍坡道复核报告",
        "generated_at": datetime.now().isoformat(),
        "notice": notice.model_dump(mode="json"),
        "workflow": workflow.model_dump(mode="json") if workflow else None,
        "latest_suggestion": suggestion.model_dump(mode="json") if suggestion else None,
        "score_history": [s.model_dump(mode="json") for s in all_scores],
        "ramp_records": [r.model_dump(mode="json") for r in ramp_records],
        "audit_logs": [l.model_dump(mode="json") for l in audit_logs],
    }

    report_str = json.dumps(report_data, ensure_ascii=False, indent=2)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(report_str)
        click.echo(f"✅ 报告已保存到: {output}")
    else:
        _print_header("完整报告")
        click.echo(report_str)


@cli.command()
def dashboard():
    """启动小看板（HTML界面）"""
    from .dashboard import run_dashboard
    run_dashboard()


if __name__ == "__main__":
    cli()
