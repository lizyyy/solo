"""命令行入口（CLI）."""
import json
import click
from flask import Blueprint

from .models import db, SafetyRadius, OriginNote, OperationRecord, PlaybackPath
from .services.radius_import import RadiusImportService
from .services.origin_note import OriginNoteService
from .services.playback import PlaybackService

bp = Blueprint("cli", __name__)


@bp.cli.command("init-demo")
def init_demo():
    """初始化演示数据."""
    from demo_data.init_demo import init_demo_data
    from .app import create_app
    app = create_app()
    init_demo_data(app)


@bp.cli.command("import-csv")
@click.argument("csv_path")
@click.option("--operator", default="班组", help="操作人")
@click.option("--description", default="安全半径表CSV导入", help="操作描述")
def import_csv(csv_path, operator, description):
    """从CSV文件导入安全半径表."""
    from flask import current_app
    op_record, results = RadiusImportService.import_from_csv(csv_path, operator, description)
    click.echo(f"导入完成，操作记录ID: {op_record.id}")
    for res in results:
        status_icon = "✓" if res["status"] == "normal" else "⚠" if res["status"] == "z_reversed" else "⊘"
        click.echo(f"  {status_icon} {res['record_no']}: {res['message']}")


@bp.cli.command("import-json")
@click.argument("json_path")
@click.option("--operator", default="班组", help="操作人")
def import_json(json_path, operator):
    """从JSON文件导入安全半径表."""
    from flask import current_app
    with open(json_path, "r", encoding="utf-8") as f:
        records = json.load(f)
    op_record, results = RadiusImportService.import_from_records(records, operator)
    click.echo(f"导入完成，操作记录ID: {op_record.id}")
    for res in results:
        status_icon = "✓" if res["status"] == "normal" else "⚠" if res["status"] == "z_reversed" else "⊘"
        click.echo(f"  {status_icon} {res['record_no']}: {res['message']}")


@bp.cli.command("list-radius")
@click.option("--status", default=None, help="筛选状态: normal/z_reversed/updated/pending")
def list_radius(status):
    """列出安全半径记录."""
    query = SafetyRadius.query
    if status:
        query = query.filter_by(status=status)
    records = query.all()
    if not records:
        click.echo("无记录")
        return
    click.echo(f"{'编号':<12} {'岸桥':<8} {'日期':<12} {'X':<8} {'Y':<8} {'Z':<8} {'半径':<8} {'方向':<6} {'状态':<12} {'来源':<8}")
    click.echo("-" * 100)
    for r in records:
        click.echo(
            f"{r.record_no:<12} {r.crane_no:<8} {r.operation_date.isoformat():<12} "
            f"{r.x:<8.1f} {r.y:<8.1f} {r.z:<8.1f} {r.radius:<8.1f} "
            f"{r.z_axis_direction:<6} {r.status:<12} {r.source:<8}"
        )


@bp.cli.command("add-origin-note")
@click.option("--note-no", required=True, help="说明编号")
@click.option("--crane-no", required=True, help="岸桥编号")
@click.option("--record-no", required=True, help="关联记录编号")
@click.option("--origin-x", type=float, required=True, help="原点X")
@click.option("--origin-y", type=float, required=True, help="原点Y")
@click.option("--origin-z", type=float, required=True, help="原点Z")
@click.option("--old-caliber", default=None, help="旧口径说明")
@click.option("--z-note", default=None, help="Z轴方向备注")
@click.option("--operator", default="许工", help="补录人")
def add_origin_note(note_no, crane_no, record_no, origin_x, origin_y, origin_z, old_caliber, z_note, operator):
    """补录坐标原点说明."""
    note = OriginNoteService.add_note(
        note_no=note_no,
        crane_no=crane_no,
        record_no=record_no,
        origin_x=origin_x,
        origin_y=origin_y,
        origin_z=origin_z,
        old_caliber=old_caliber,
        z_direction_note=z_note,
        operator=operator
    )
    click.echo(f"补录完成：{note.note_no}，关联记录 {note.record_no}")


@bp.cli.command("manual-correct")
@click.argument("record_id", type=int)
@click.option("--correct-z", type=float, default=None, help="修正Z值")
@click.option("--correct-direction", default=None, help="修正方向")
@click.option("--operator", default="许工", help="操作人")
def manual_correct(record_id, correct_z, correct_direction, operator):
    """人工修正Z轴记录."""
    op_record, sr = RadiusImportService.manual_correct(record_id, correct_z, correct_direction, operator)
    click.echo(f"修正完成：{sr.record_no}，状态: {sr.status}")


@bp.cli.command("generate-playback")
@click.option("--record-id", type=int, default=None, help="指定安全半径记录ID，不填则全量")
@click.option("--apply-origin/--no-apply-origin", default=True, help="是否应用坐标原点说明")
@click.option("--operator", default="许工", help="操作人")
@click.option("--description", default="路径回放", help="操作描述")
def generate_playback(record_id, apply_origin, operator, description):
    """生成路径回放."""
    op_record, playbacks = PlaybackService.generate_playback(
        safety_radius_id=record_id,
        operator=operator,
        apply_origin=apply_origin,
        description=description
    )
    click.echo(f"回放生成完成，操作记录ID: {op_record.id}")
    for pp in playbacks:
        origin_str = f"原点({pp.origin_x},{pp.origin_y},{pp.origin_z})" if pp.is_origin_applied else "原点未应用"
        click.echo(f"  {pp.path_no}: 记录{pp.record_no}, Z轴{pp.z_axis_applied}, {origin_str}")


@bp.cli.command("rerun-with-origin")
@click.option("--operator", default="许工", help="操作人")
def rerun_with_origin(operator):
    """补录坐标原点说明后重跑回放."""
    op_record, playbacks = PlaybackService.rerun_with_origin(operator)
    click.echo(f"重跑完成，操作记录ID: {op_record.id}")
    for pp in playbacks:
        origin_str = f"原点已应用({pp.origin_x},{pp.origin_y},{pp.origin_z})" if pp.is_origin_applied else "原点未应用"
        click.echo(f"  V{pp.version} {pp.path_no}: {pp.record_no}, Z轴{pp.z_axis_applied}, {origin_str}")


@bp.cli.command("compare")
@click.argument("record_no")
def compare(record_no):
    """对比记录的不同处理结果."""
    comparison = PlaybackService.compare_results(record_no)
    click.echo(f"记录 {record_no} 对比结果：")
    for key, val in comparison.get("comparison", {}).items():
        click.echo(f"  {key}: Z轴={val['z_axis']}, 原点应用={val['origin_applied']}, 原点={val['origin']}")


@bp.cli.command("pending-review")
def pending_review():
    """查看待现场班组复核的Z轴写反记录."""
    records = RadiusImportService.get_pending_review()
    if not records:
        click.echo("无待复核记录")
        return
    click.echo(f"待复核记录 ({len(records)} 条)：")
    for r in records:
        click.echo(f"  {r.record_no}: 岸桥{r.crane_no}, Z={r.z}, 方向={r.z_axis_direction}, 状态={r.status}")
        click.echo(f"    → 不归正，留给现场班组复核")


@bp.cli.command("list-origin-notes")
def list_origin_notes():
    """列出坐标原点说明."""
    notes = OriginNote.query.all()
    if not notes:
        click.echo("无原点说明记录")
        return
    for n in notes:
        applied = "已应用" if n.is_applied else "未应用"
        click.echo(f"  {n.note_no}: 岸桥{n.crane_no}, 关联{n.record_no}, 原点({n.origin_x},{n.origin_y},{n.origin_z}), {applied}")
        if n.old_caliber:
            click.echo(f"    旧口径: {n.old_caliber}")


@bp.cli.command("run-full-demo")
def run_full_demo():
    """运行完整演示流程."""
    from demo_data.init_demo import init_demo_data
    from .app import create_app
    app = create_app()
    init_demo_data(app)
