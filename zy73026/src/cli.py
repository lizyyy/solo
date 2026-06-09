#!/usr/bin/env python3
from __future__ import annotations
"""
异宠温控异常提醒 —— CLI 入口
参数名与错误码保持稳定，便于日常脚本调度。
查看帮助:  python -m src.cli --help
"""
import sys
import json
import click
from pathlib import Path

from .config import (
    DATA_DIR, VACCINE_PHOTO_DIR, MEDICATION_IMPORT_DIR,
    ALERT_IMPORT_DIR, REPORT_DIR, err, ALERT_STATUSES
)
from . import importer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _print(obj, output: str):
    if output == "json":
        click.echo(json.dumps(obj, ensure_ascii=False, indent=2))
    else:
        for k, v in obj.items():
            click.echo(f"{k}: {v}")


@click.group(help="异宠温控异常提醒 管理脚本")
@click.option("--db-path", default=None, hidden=True,
              help="（预留）数据库路径，默认 ./data/alertdb.sqlite3")
@click.option("--output", type=click.Choice(["text", "json"]),
              default="text", help="输出格式 text|json（默认 text）")
@click.pass_context
def cli(ctx, db_path, output):
    ctx.ensure_object(dict)
    ctx.obj["output"] = output


@cli.command("pet-add", help="登记/确认宠物信息")
@click.option("--pet-id", required=True, help="宠物唯一ID")
@click.option("--pet-name", default="", help="宠物昵称")
@click.option("--species", default="", help="物种")
@click.pass_context
def pet_add(ctx, pet_id, pet_name, species):
    try:
        importer.ensure_pet(pet_id, pet_name, species)
        _print({"status": "ok", "pet_id": pet_id,
                "reason": "宠物已登记"}, ctx.obj["output"])
    except Exception as e:
        click.echo(f"[E006] {err('E006', detail=str(e))}", err=True)
        sys.exit(6)


@cli.command("photo-import", help="导入疫苗本照片（分批次，source_id幂等）")
@click.option("--pet-id", required=True, help="宠物ID")
@click.option("--photo-source-id", required=True,
              help="照片来源唯一ID（幂等键）")
@click.option("--photo-path", required=True,
              help=f"照片原始路径。归档目录: {VACCINE_PHOTO_DIR}/<pet-id>/")
@click.option("--photo-batch", default="",
              help="批次号（分几次凑齐的材料用不同批次区分）")
@click.option("--notes", default="", help="照片备注")
@click.pass_context
def photo_import(ctx, pet_id, photo_source_id, photo_path,
                 photo_batch, notes):
    try:
        r = importer.import_vaccine_photo(
            pet_id, photo_source_id, photo_path, photo_batch, notes)
        _print({"status": "ok" if not r["skipped"] else "skipped", **r},
               ctx.obj["output"])
    except ValueError as e:
        click.echo(str(e), err=True); sys.exit(1)
    except FileNotFoundError as e:
        click.echo(str(e), err=True); sys.exit(2)
    except Exception as e:
        click.echo(f"[E006] {err('E006', detail=str(e))}", err=True)
        sys.exit(6)


@cli.command("med-import", help="导入用药记录（剂量变更自动触发待复核）")
@click.option("--pet-id", required=True, help="宠物ID")
@click.option("--med-source-id", required=True,
              help="用药记录来源唯一ID（幂等键）")
@click.option("--med-name", required=True, help="药品名称")
@click.option("--dosage", required=True, help="剂量（与上次不同则触发E005）")
@click.option("--frequency", default="", help="频次")
@click.option("--start-date", default="", help="开始日期 YYYY-MM-DD")
@click.option("--end-date", default="", help="结束日期 YYYY-MM-DD")
@click.pass_context
def med_import(ctx, pet_id, med_source_id, med_name, dosage,
               frequency, start_date, end_date):
    try:
        r = importer.import_medication(
            pet_id, med_source_id, med_name, dosage,
            frequency, start_date, end_date)
        code = 5 if r.get("updated") and r["reason"].startswith("[E005]") else 0
        _print({"status": "updated" if r.get("updated")
                else ("skipped" if r["skipped"] else "ok"), **r},
               ctx.obj["output"])
        sys.exit(code)
    except ValueError as e:
        click.echo(str(e), err=True); sys.exit(1)
    except Exception as e:
        click.echo(f"[E006] {err('E006', detail=str(e))}", err=True); sys.exit(6)


@cli.command("alert-import", help="导入温控异常提醒（source_id幂等，不翻倍）")
@click.option("--pet-id", required=True, help="宠物ID")
@click.option("--alert-source-id", required=True,
              help="提醒来源唯一ID（幂等键）")
@click.option("--alert-time", required=True, help="异常时间 ISO或YYYY-MM-DD HH:MM")
@click.option("--temperature-c", required=True, type=float, help="温度(摄氏度)")
@click.option("--initial-status",
              type=click.Choice(list(ALERT_STATUSES.keys())),
              default="PENDING", help="初始状态（默认 PENDING）")
@click.pass_context
def alert_import(ctx, pet_id, alert_source_id, alert_time,
                 temperature_c, initial_status):
    try:
        r = importer.import_temp_alert(
            pet_id, alert_source_id, alert_time,
            temperature_c, initial_status)
        _print({"status": "ok" if not r["skipped"] else "skipped", **r},
               ctx.obj["output"])
    except ValueError as e:
        click.echo(str(e), err=True); sys.exit(1)
    except Exception as e:
        click.echo(f"[E006] {err('E006', detail=str(e))}", err=True); sys.exit(6)


@cli.command("alert-status", help="修改提醒状态/结论（自动写历史）")
@click.option("--alert-id", required=True, help="提醒ID")
@click.option("--new-status", required=True,
              type=click.Choice(list(ALERT_STATUSES.keys())),
              help="新状态")
@click.option("--reason", default="", help="变更原因（会写进历史）")
@click.option("--author", default="system", help="操作人")
@click.option("--conclusion", default=None, help="结论文案（留空=不修改）")
@click.pass_context
def alert_status(ctx, alert_id, new_status, reason, author, conclusion):
    try:
        r = importer.update_alert_status(
            alert_id, new_status, reason=reason,
            author=author, conclusion=conclusion)
        _print({"status": "ok", **r}, ctx.obj["output"])
    except ValueError as e:
        click.echo(str(e), err=True); sys.exit(1)
    except KeyError as e:
        click.echo(str(e), err=True); sys.exit(9)
    except Exception as e:
        click.echo(f"[E006] {err('E006', detail=str(e))}", err=True); sys.exit(6)


@cli.command("alert-note", help="追加人工备注（同source不覆盖）")
@click.option("--alert-id", required=True, help="提醒ID")
@click.option("--note", required=True, help="备注内容")
@click.option("--author", default="system", help="作者")
@click.option("--source-note-id", default=None,
              help="备注来源唯一ID（同一ID不会重复追加）")
@click.pass_context
def alert_note(ctx, alert_id, note, author, source_note_id):
    try:
        r = importer.add_alert_note(alert_id, note, author, source_note_id)
        _print({"status": "ok" if not r["skipped"] else "skipped", **r},
               ctx.obj["output"])
    except ValueError as e:
        click.echo(str(e), err=True); sys.exit(1)
    except Exception as e:
        click.echo(f"[E006] {err('E006', detail=str(e))}", err=True); sys.exit(6)


@cli.command("link", help="建立疫苗照片与用药记录的关系")
@click.option("--pet-id", required=True, help="宠物ID")
@click.option("--photo-id", default=None, help="疫苗照片ID")
@click.option("--med-id", default=None, help="用药ID")
@click.option("--relation-type", default="关联提醒",
              help="关系类型（默认 关联提醒）")
@click.pass_context
def link_cmd(ctx, pet_id, photo_id, med_id, relation_type):
    try:
        importer.link_vaccine_medication(
            photo_id, med_id, pet_id, relation_type)
        _print({"status": "ok", "pet_id": pet_id,
                "photo_id": photo_id, "med_id": med_id},
               ctx.obj["output"])
    except ValueError as e:
        click.echo(str(e), err=True); sys.exit(1)


@cli.command("list", help="列出提醒，支持 --pet-id 过滤")
@click.option("--pet-id", default=None, help="按宠物过滤")
@click.option("--with-history/--no-history", default=False,
              help="是否附带状态历史")
@click.pass_context
def list_cmd(ctx, pet_id, with_history):
    alerts = importer.list_alerts(pet_id)
    out = []
    for a in alerts:
        item = dict(a)
        if with_history:
            item["history"] = importer.get_alert_history(a["alert_id"])
            item["notes"] = importer.get_alert_notes(a["alert_id"])
            item["pending_reason"] = importer.get_pending_review_reason(
                a["alert_id"])
        out.append(item)
    if ctx.obj["output"] == "json":
        click.echo(json.dumps(out, ensure_ascii=False, indent=2,
                              default=str))
    else:
        for a in out:
            click.echo("-" * 60)
            for k in ["alert_id", "pet_id", "pet_name", "alert_time",
                      "temperature_c", "status", "conclusion"]:
                click.echo(f"  {k:16s}: {a.get(k)}")
            if with_history and a.get("pending_reason"):
                click.echo(f"  待复核原因        : {a['pending_reason']}")
            if with_history and a.get("history"):
                click.echo(f"  --- 状态历史 ---")
                for h in a["history"]:
                    click.echo(
                        f"    [{h['changed_at']}] {h['author']} "
                        f"{h.get('old_status')} → {h['new_status']} "
                        f"| {h.get('reason','')}")
            if with_history and a.get("notes"):
                click.echo(f"  --- 人工备注 ---")
                for n in a["notes"]:
                    click.echo(
                        f"    [{n['created_at']}] {n['author']}: "
                        f"{n['note_content']}")


@cli.command("report", help="生成HTML报告")
@click.option("--pet-id", default=None, help="按宠物过滤")
@click.option("--out", default=None,
              help=f"输出路径，默认 {REPORT_DIR}/report-<timestamp>.html")
@click.pass_context
def report(ctx, pet_id, out):
    from . import webapp
    html = webapp.render_report(pet_id=pet_id)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if out is None:
        import time
        out = str(REPORT_DIR / f"report-{int(time.time())}.html")
    Path(out).write_text(html, encoding="utf-8")
    _print({"status": "ok", "report_path": str(out)}, ctx.obj["output"])


@cli.command("dirs", help="显示所有约定目录位置（给项目经理用）")
def dirs_cmd():
    info = {
        "项目根目录": str(Path(__file__).resolve().parent.parent),
        "数据库文件": str(DATA_DIR / "alertdb.sqlite3"),
        "疫苗本照片归档目录": str(VACCINE_PHOTO_DIR),
        "  (按宠物分子目录)": f"{VACCINE_PHOTO_DIR}/<pet-id>/",
        "用药导入JSON存档": str(MEDICATION_IMPORT_DIR),
        "提醒导入JSON存档": str(ALERT_IMPORT_DIR),
        "报告输出目录": str(REPORT_DIR),
    }
    for k, v in info.items():
        click.echo(f"{k:24s}: {v}")


@cli.command("web", help="启动Web报告页面（默认 http://127.0.0.1:5000 ）")
@click.option("--host", default="127.0.0.1", help="监听地址")
@click.option("--port", default=5000, type=int, help="监听端口")
def web_cmd(host, port):
    from . import webapp
    webapp.app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    cli(obj={})
