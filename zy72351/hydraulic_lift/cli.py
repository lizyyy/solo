import json
import click
from hydraulic_lift.app import create_app
from hydraulic_lift.database import db
from hydraulic_lift.models import CalculationRecord, Parameter, Screenshot
from hydraulic_lift.engine import HydraulicLiftEngine
from hydraulic_lift.audit import log_audit, get_record_audit_trail


@click.group()
def cli():
    pass


@cli.command()
@click.option("--port", default=5000, help="端口号")
@click.option("--debug", is_flag=True, help="调试模式")
def serve(port, debug):
    app = create_app()
    app.run(port=port, debug=debug)


@cli.command("list")
def list_records():
    app = create_app()
    with app.app_context():
        records = CalculationRecord.query.order_by(CalculationRecord.updated_at.desc()).all()
        if not records:
            click.echo("暂无试算记录")
            return
        for r in records:
            flag = "⚠ 需复核" if r.has_unresolved_flags() else "✓"
            click.echo("[{}] {} | {} | {} | {}".format(
                r.id, r.name, r.status_label(), flag, r.updated_at.strftime("%Y-%m-%d %H:%M")))


@cli.command()
@click.argument("name")
def create(name):
    app = create_app()
    with app.app_context():
        record = CalculationRecord(name=name, status="draft")
        db.session.add(record)
        db.session.commit()
        log_audit(record.id, "create", "CLI用户", "system", note="创建试算记录")
        click.echo("已创建试算记录 #{}: {}".format(record.id, name))


@cli.command()
@click.argument("record_id", type=int)
def show(record_id):
    app = create_app()
    with app.app_context():
        record = CalculationRecord.query.get_or_404(record_id)
        click.echo("=" * 60)
        click.echo("试算记录 #{}: {}".format(record.id, record.name))
        click.echo("状态: {} | 结论: {}".format(record.status_label(), record.conclusion or "未计算"))
        click.echo("-" * 60)
        click.echo("输入参数:")
        for p in record.parameters.filter_by(category="input").all():
            flag = ""
            if p.needs_review:
                flag = " ⚠ [人工改过系数但没写原因-待设备工程师复核]"
            elif p.is_manual_override:
                flag = " [已修正:{}]".format(p.override_reason or "无原因")
            note = ""
            if p.sampling_interval_note:
                note = " (采样间隔说明: {})".format(p.sampling_interval_note)
            click.echo("  {} = {} {}{}{}".format(
                p.display_name, p.value, p.unit, flag, note))
        click.echo("-" * 60)
        click.echo("计算结果:")
        for p in record.parameters.filter_by(category="output").all():
            click.echo("  {} = {} {}".format(p.display_name, p.value, p.unit))
        click.echo("-" * 60)
        click.echo("维修群截图:")
        for s in record.screenshots.all():
            click.echo("  [{}] {} - {}".format(s.source_chat, s.filename, s.description or "无描述"))
        click.echo("-" * 60)
        click.echo("审计轨迹:")
        for a in get_record_audit_trail(record_id):
            click.echo("  {} | {}({}) | {}".format(
                a.created_at.strftime("%m-%d %H:%M"), a.operator, a.role, a.note or a.action_label()))


@cli.command()
@click.argument("record_id", type=int)
@click.argument("param_name")
@click.argument("value", type=float)
@click.option("--reason", default=None, help="修正原因")
@click.option("--operator", default="CLI用户", help="操作人")
def override(record_id, param_name, value, reason, operator):
    app = create_app()
    with app.app_context():
        record = CalculationRecord.query.get_or_404(record_id)
        param = Parameter.query.filter_by(record_id=record_id, name=param_name).first()
        if not param:
            click.echo("参数 {} 不存在".format(param_name))
            return

        old_value = param.value
        param.original_value = old_value
        param.value = value
        param.is_manual_override = True
        param.override_by = operator
        param.source = "manual_override"
        if reason:
            param.override_reason = reason
        param.updated_at = __import__("datetime").datetime.now()
        db.session.commit()

        action = "manual_override" if not reason else "add_override_reason"
        log_audit(record_id, action, operator, "training_coach",
                   parameter_id=param.id, old_value=str(old_value), new_value=str(value),
                   reason=reason, note="人工修正{}：{}→{}".format(param.display_name, old_value, value))

        if record.has_unresolved_flags():
            record.status = "needs_engineer_review"
            db.session.commit()

        from hydraulic_lift.app import _recalculate
        _recalculate(record_id)

        click.echo("已修正 {} = {} (原值: {})".format(param.display_name, value, old_value))
        if not reason:
            click.echo("⚠ 未填写修正原因，状态已标记为待设备工程师复核")


@cli.command()
@click.argument("record_id", type=int)
@click.argument("param_name")
@click.argument("note")
@click.option("--operator", default="训练教练老唐", help="操作人")
def supplement(record_id, param_name, note, operator):
    app = create_app()
    with app.app_context():
        record = CalculationRecord.query.get_or_404(record_id)
        param = Parameter.query.filter_by(record_id=record_id, name=param_name).first()
        if not param:
            click.echo("参数 {} 不存在".format(param_name))
            return

        old_note = param.sampling_interval_note
        param.sampling_interval_note = note
        param.updated_at = __import__("datetime").datetime.now()
        db.session.commit()

        log_audit(record_id, "supplement_interval", operator, "training_coach",
                   parameter_id=param.id, old_value=old_note, new_value=note,
                   note="补录{}采样间隔说明：{}".format(param.display_name, note))

        click.echo("已补录 {} 采样间隔说明：{}".format(param.display_name, note))


@cli.command()
@click.argument("record_id", type=int)
@click.argument("reason")
@click.option("--param-id", type=int, default=None, help="参数ID")
@click.option("--operator", default="设备工程师", help="操作人")
def add_reason(record_id, reason, param_id, operator):
    app = create_app()
    with app.app_context():
        record = CalculationRecord.query.get_or_404(record_id)
        if param_id:
            param = Parameter.query.get(param_id)
        else:
            param = Parameter.query.filter_by(
                record_id=record_id, is_manual_override=True, override_reason=None).first()

        if not param:
            click.echo("未找到需要补充原因的参数")
            return

        param.override_reason = reason
        param.updated_at = __import__("datetime").datetime.now()
        db.session.commit()

        log_audit(record_id, "add_override_reason", operator, "equipment_engineer",
                   parameter_id=param.id, reason=reason,
                   note="补充修正原因：{}——{}".format(param.display_name, reason))

        if not record.has_unresolved_flags():
            record.status = "under_review"
            db.session.commit()

        click.echo("已补充 {} 修正原因：{}".format(param.display_name, reason))


@cli.command()
@click.argument("record_id", type=int)
@click.option("--operator", default="训练教练老唐", help="操作人")
def rerun(record_id, operator):
    app = create_app()
    with app.app_context():
        record = CalculationRecord.query.get_or_404(record_id)
        from hydraulic_lift.app import _recalculate
        _recalculate(record_id)
        log_audit(record_id, "rerun", operator, "training_coach",
                   note="重跑载荷试算，结论：{}".format(record.conclusion))
        click.echo("重跑完成，结论：{}".format(record.conclusion))


@cli.command()
def demo():
    app = create_app()
    with app.app_context():
        from hydraulic_lift.demo import load_demo_data
        record = load_demo_data()
        click.echo("演示数据已加载，试算记录 #{}: {}".format(record.id, record.name))
        click.echo("运行 `python -m hydraulic_lift.cli show {}` 查看详情".format(record.id))


if __name__ == "__main__":
    cli()
