import json
import sys
from typing import Optional

import click

from . import __version__
from .auditor import run_audit, get_registered_rules
from .config import (
    EXIT_AUDIT_HAS_ANOMALIES,
    EXIT_IMPORT_ERROR,
    EXIT_INVALID_ARGS,
    EXIT_OK,
    EXIT_RUNTIME_ERROR,
    REPORT_OUTPUT_DIR,
)
from .db import init_db
from .importer import import_from_file, import_records
from .reporter import render_markdown, save_report


def _print_json(data: dict):
    click.echo(json.dumps(data, ensure_ascii=False, indent=2))


def _print_err(msg: str):
    click.echo(msg, err=True)


@click.group()
@click.version_option(__version__, prog_name="pet-training-audit")
@click.option("--db", "db_path", envvar="PET_TRAINING_DB", default=None,
              help="SQLite 数据库文件路径，也可用 PET_TRAINING_DB 环境变量")
@click.pass_context
def cli(ctx, db_path: Optional[str]):
    """宠物训练课记录复核工具 — 供值班脚本稳定调用"""
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db_path
    try:
        init_db(db_path)
    except Exception as e:
        _print_err(f"[INIT_ERROR] 数据库初始化失败: {e}")
        sys.exit(EXIT_RUNTIME_ERROR)


@cli.command("init")
@click.pass_context
def cmd_init(ctx):
    """仅初始化数据库（建表），不做任何业务操作"""
    init_db(ctx.obj["db_path"])
    _print_json({
        "ok": True,
        "db_path": ctx.obj["db_path"] or "(默认)",
        "message": "数据库已初始化",
    })
    sys.exit(EXIT_OK)


@cli.command("import")
@click.option("--file", "file_path", type=click.Path(exists=True, dir_okay=False),
              help="JSON 文件路径，数组或单对象均可")
@click.option("--inline", "inline_json", type=str, default=None,
              help="直接传入 JSON 字符串（单条/数组），值班脚本便于管道调用")
@click.option("--fail-fast/--no-fail-fast", default=False,
              help="遇到错误立即停止（默认 false，即尽量导入全部）")
@click.pass_context
def cmd_import(ctx, file_path: Optional[str], inline_json: Optional[str], fail_fast: bool):
    """导入训练课记录（旧材料 or 新样本）

    同 record_id 重复导入会自动递增 version，旧版本全部保留。
    """
    if not file_path and not inline_json:
        _print_err("[IMPORT_ERROR] 必须提供 --file 或 --inline 之一")
        sys.exit(EXIT_INVALID_ARGS)
    if file_path and inline_json:
        _print_err("[IMPORT_ERROR] --file 与 --inline 不可同时使用")
        sys.exit(EXIT_INVALID_ARGS)

    try:
        if inline_json:
            records = json.loads(inline_json)
            if not isinstance(records, list):
                records = [records]
            result = import_records(records, db_path=ctx.obj["db_path"])
        else:
            result = import_from_file(file_path, db_path=ctx.obj["db_path"])
    except json.JSONDecodeError as e:
        _print_err(f"[IMPORT_ERROR] JSON 解析失败: {e}")
        sys.exit(EXIT_IMPORT_ERROR)
    except FileNotFoundError as e:
        _print_err(f"[IMPORT_ERROR] 文件不存在: {e}")
        sys.exit(EXIT_IMPORT_ERROR)
    except Exception as e:
        _print_err(f"[IMPORT_ERROR] 导入异常: {e}")
        sys.exit(EXIT_RUNTIME_ERROR)

    payload = {
        "ok": result.failed == 0,
        **result.to_dict(),
    }
    _print_json(payload)
    if result.failed > 0 or (fail_fast and result.errors):
        sys.exit(EXIT_IMPORT_ERROR)
    sys.exit(EXIT_OK)


@cli.command("audit")
@click.option("--run-tag", type=str, default=None,
              help="本次复核唯一标识，不传则自动生成（建议传灰度语义的标签）")
@click.option("--triggered-by", type=str, default="scheduled",
              help="触发者，例如: 'scheduled' / 'gray-release-v1' / 'wen-manual'")
@click.option("--baseline", "baseline_run_tag", type=str, default=None,
              help="基线 run_tag，用于灰度前对比人工确认前后的差异")
@click.pass_context
def cmd_audit(ctx, run_tag, triggered_by, baseline_run_tag):
    """对全部最新版本记录执行复核，输出 run_tag 与统计"""
    try:
        result = run_audit(
            run_tag=run_tag,
            triggered_by=triggered_by,
            baseline_run_tag=baseline_run_tag,
            db_path=ctx.obj["db_path"],
        )
    except Exception as e:
        _print_err(f"[AUDIT_ERROR] 复核执行异常: {e}")
        sys.exit(EXIT_RUNTIME_ERROR)

    payload = {
        "ok": True,
        **result.to_dict(),
    }
    _print_json(payload)
    if result.total_anomalies > 0:
        sys.exit(EXIT_AUDIT_HAS_ANOMALIES)
    sys.exit(EXIT_OK)


@cli.command("report")
@click.option("--run-tag", type=str, required=True, help="要输出报告的复核 run_tag")
@click.option("--output", "output_file", type=click.Path(dir_okay=False), default=None,
              help="输出 Markdown 文件路径，默认写到 $PET_TRAINING_REPORT_DIR/audit_report_<run_tag>.md")
@click.option("--stdout/--no-stdout", default=False,
              help="同时把 Markdown 打印到标准输出（方便值班脚本发邮件/IM）")
@click.pass_context
def cmd_report(ctx, run_tag, output_file, stdout):
    """生成 Markdown 格式的复核报告"""
    try:
        if output_file:
            import pathlib
            pathlib.Path(output_file).parent.mkdir(parents=True, exist_ok=True)
            md = render_markdown(run_tag, db_path=ctx.obj["db_path"])
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(md)
            final_path = output_file
        else:
            final_path = save_report(run_tag, db_path=ctx.obj["db_path"])
    except ValueError as e:
        _print_err(f"[REPORT_ERROR] {e}")
        sys.exit(EXIT_INVALID_ARGS)
    except Exception as e:
        _print_err(f"[REPORT_ERROR] 报告生成异常: {e}")
        sys.exit(EXIT_RUNTIME_ERROR)

    if stdout:
        click.echo(render_markdown(run_tag, db_path=ctx.obj["db_path"]))

    _print_json({
        "ok": True,
        "run_tag": run_tag,
        "report_path": final_path,
    })
    sys.exit(EXIT_OK)


@cli.command("rules")
def cmd_rules():
    """列出当前已注册的所有复核规则，方便负责人对齐口径"""
    rules = get_registered_rules()
    payload = {
        "count": len(rules),
        "rules": rules,
    }
    _print_json(payload)
    sys.exit(EXIT_OK)


def main():
    try:
        cli(obj={})
    except SystemExit:
        raise
    except Exception as e:
        _print_err(f"[RUNTIME_ERROR] 未捕获异常: {e}")
        sys.exit(EXIT_RUNTIME_ERROR)


if __name__ == "__main__":
    main()
