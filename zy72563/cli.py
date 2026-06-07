import json
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from manager import DropoutManager
from models import DropoutStatus

console = Console()
manager = DropoutManager()


@click.group()
def cli():
    pass


@cli.group()
def snapshot():
    pass


@snapshot.command("import")
@click.option('--file', '-f', type=click.Path(exists=True), help='JSON文件路径')
@click.option('--imported-by', '-u', required=True, help='导入人')
def import_snapshots(file, imported_by):
    with open(file, 'r') as f:
        snapshots = json.load(f)
    result = manager.import_feature_snapshots(snapshots, imported_by)
    console.print(Panel.fit(
        f"[green]导入完成[/green]\n"
        f"成功导入: {result['imported_count']}\n"
        f"跳过(重复): {result['skipped_count']}\n"
        f"说明: {result['note']}"
    ))


@snapshot.command("show")
@click.option('--snapshot-id', '-s', required=True, help='快照ID')
def show_snapshot(snapshot_id):
    snap = manager.storage.get_snapshot(snapshot_id)
    if snap:
        console.print_json(json.dumps(snap.model_dump(mode='json'), indent=2, ensure_ascii=False))
    else:
        console.print(f"[red]未找到快照: {snapshot_id}[/red]")


@snapshot.command("list")
@click.option('--client-id', '-c', help='客户端ID')
def list_snapshots(client_id):
    snapshots = manager.storage.list_snapshots(client_id=client_id)
    table = Table(title="特征快照列表")
    table.add_column("快照ID")
    table.add_column("客户端")
    table.add_column("轮次")
    table.add_column("时间戳")
    table.add_column("特征数")
    for s in snapshots:
        table.add_row(s.snapshot_id, s.client_id, str(s.round_num),
                      s.timestamp.strftime('%Y-%m-%d %H:%M:%S'), str(s.feature_count))
    console.print(table)


@cli.group()
def log():
    pass


@log.command("show")
@click.option('--log-id', '-l', required=True, help='日志ID')
def show_log(log_id):
    log_item = manager.storage.get_training_log(log_id)
    if log_item:
        console.print_json(json.dumps(log_item.model_dump(mode='json'), indent=2, ensure_ascii=False))
    else:
        console.print(f"[red]未找到日志: {log_id}[/red]")


@log.command("list")
@click.option('--client-id', '-c', help='客户端ID')
@click.option('--round-num', '-r', type=int, help='轮次')
def list_logs(client_id, round_num):
    logs = manager.storage.list_training_logs(client_id=client_id, round_num=round_num)
    table = Table(title="训练日志列表")
    table.add_column("日志ID")
    table.add_column("客户端")
    table.add_column("轮次")
    table.add_column("时间戳")
    table.add_column("Loss")
    table.add_column("Accuracy")
    for l in logs:
        table.add_row(l.log_id, l.client_id, str(l.round_num),
                      l.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                      f"{l.loss:.4f}", f"{l.accuracy:.4f}")
    console.print(table)


@cli.group()
def record():
    pass


@record.command("create")
@click.option('--client-id', '-c', required=True, help='客户端ID')
@click.option('--round-num', '-r', type=int, required=True, help='轮次')
@click.option('--detected-by', '-u', required=True, help='检测人')
@click.option('--remarks', '-m', default='', help='备注')
def create_record(client_id, round_num, detected_by, remarks):
    record = manager.detect_and_create_record(client_id, round_num, detected_by, remarks)
    console.print(Panel.fit(
        f"[green]掉队记录已创建[/green]\n"
        f"记录ID: {record.record_id}\n"
        f"状态: [yellow]{record.status.value}[/yellow]\n"
        f"时间窗穿越: {'[red]是[/red]' if record.time_window_crossed else '[green]否[/green]'}\n"
        f"异常分数: {record.anomaly_score:.2f}\n"
        f"关联快照数: {len(record.snapshot_ids)}\n"
        f"关联日志数: {len(record.log_ids)}"
    ))


@record.command("show")
@click.option('--record-id', '-r', required=True, help='记录ID')
def show_record(record_id):
    data = manager.get_record_with_context(record_id)
    if not data:
        console.print(f"[red]未找到记录: {record_id}[/red]")
        return
    console.print_json(json.dumps(data, indent=2, ensure_ascii=False))


@record.command("list")
@click.option('--status', '-s', type=click.Choice([e.value for e in DropoutStatus]), help='状态过滤')
@click.option('--client-id', '-c', help='客户端ID')
def list_records(status, client_id):
    status_enum = DropoutStatus(status) if status else None
    records = manager.storage.list_dropout_records(status=status_enum, client_id=client_id)
    table = Table(title="掉队记录列表")
    table.add_column("记录ID")
    table.add_column("客户端")
    table.add_column("轮次")
    table.add_column("状态")
    table.add_column("时间窗穿越")
    table.add_column("异常分数")
    table.add_column("检测时间")
    for r in records:
        status_color = "yellow" if r.status == DropoutStatus.PENDING_REVIEW else "green"
        tw_color = "red" if r.time_window_crossed else "green"
        table.add_row(
            r.record_id, r.client_id, str(r.round_num),
            f"[{status_color}]{r.status.value}[/{status_color}]",
            f"[{tw_color}]{'是' if r.time_window_crossed else '否'}[/{tw_color}]",
            f"{r.anomaly_score:.2f}",
            r.detected_at.strftime('%Y-%m-%d %H:%M:%S')
        )
    console.print(table)


@record.command("remarks")
@click.option('--record-id', '-r', required=True, help='记录ID')
@click.option('--new-remarks', '-m', required=True, help='新备注')
@click.option('--updated-by', '-u', required=True, help='修改人')
def update_remarks(record_id, new_remarks, updated_by):
    record = manager.update_remarks(record_id, new_remarks, updated_by)
    if record:
        console.print("[green]备注已更新[/green]")
    else:
        console.print("[red]更新失败[/red]")


@record.command("history")
@click.option('--record-id', '-r', required=True, help='记录ID')
def show_history(record_id):
    history = manager.get_record_history(record_id)
    if not history:
        console.print("[yellow]暂无历史记录[/yellow]")
        return
    table = Table(title=f"记录历史 - {record_id}")
    table.add_column("时间")
    table.add_column("修改人")
    table.add_column("字段")
    table.add_column("原值")
    table.add_column("新值")
    for h in history:
        table.add_row(
            h['changed_at'][:19],
            h['changed_by'],
            h['field_name'],
            str(h['old_value']),
            str(h['new_value'])
        )
    console.print(table)


@record.command("review")
@click.option('--record-id', '-r', required=True, help='记录ID')
@click.option('--decision', '-d', required=True,
              type=click.Choice(['confirm_dropout', 'mark_normal', 'rollback']),
              help='复核决定')
@click.option('--reviewer', '-u', required=True, help='复核人')
@click.option('--notes', '-n', default='', help='复核说明')
def review_record(record_id, decision, reviewer, notes):
    record = manager.review_record(record_id, decision, reviewer, notes)
    if record:
        console.print(f"[green]复核完成，状态已更新为: {record.status.value}[/green]")
    else:
        console.print("[red]复核失败[/red]")


@record.command("pending")
def list_pending():
    records = manager.list_pending_reviews()
    console.print(Panel.fit(f"待复核记录数: [yellow]{len(records)}[/yellow]"))
    if records:
        table = Table(title="待复核记录")
        table.add_column("记录ID")
        table.add_column("客户端")
        table.add_column("轮次")
        table.add_column("异常分数")
        table.add_column("检测时间")
        for r in records:
            table.add_row(r.record_id, r.client_id, str(r.round_num),
                          f"{r.anomaly_score:.2f}",
                          r.detected_at.strftime('%Y-%m-%d %H:%M:%S'))
        console.print(table)


@record.command("viz")
@click.option('--record-id', '-r', required=True, help='记录ID')
def show_viz(record_id):
    data = manager.get_visualization_with_backrefs(record_id)
    if data:
        console.print_json(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        console.print("[red]未找到记录[/red]")


@record.command("replay")
@click.option('--record-id', '-r', required=True, help='记录ID')
def show_replay(record_id):
    data = manager.get_record_with_context(record_id)
    if not data:
        console.print("[red]未找到记录[/red]")
        return
    console.print(Panel.fit(
        "[bold]复盘命令清单[/bold]\n" + "\n".join(data.get('replay_commands', []))
    ))


if __name__ == '__main__':
    cli()
