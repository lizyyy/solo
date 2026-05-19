import click
import json
from pathlib import Path
from .engine import TranslationMemoryEngine
from .report import ReportGenerator
from .models import RollbackReason, EntryStatus


def get_engine(db_path: str):
    return TranslationMemoryEngine(db_path)


@click.group()
@click.option("--db", default="memory_db.json", help="记忆库数据库文件路径")
@click.pass_context
def cli(ctx, db):
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db
    ctx.obj["engine"] = get_engine(db)


@cli.command()
@click.argument("file_path")
@click.option("--format", "-f", "output_format", default="table", 
              type=click.Choice(["table", "json"]), help="输出格式")
@click.pass_context
def import_file(ctx, file_path, output_format):
    engine = ctx.obj["engine"]
    result = engine.import_from_file(file_path)
    report = ReportGenerator.format_import_result(result.to_dict(), output_format)
    click.echo(report)


@cli.command()
@click.option("--key", "-k", required=True, help="词条Key")
@click.option("--source-lang", "-s", required=True, help="源语言")
@click.option("--target-lang", "-t", required=True, help="目标语言")
@click.option("--reason", "-r", required=True, 
              type=click.Choice([r.value for r in RollbackReason]),
              help="回滚原因")
@click.option("--note", "-n", default="", help="回滚说明")
@click.option("--rollback-batch", "-b", default="manual", help="回滚批次号")
@click.option("--format", "-f", "output_format", default="table", 
              type=click.Choice(["table", "json"]), help="输出格式")
@click.pass_context
def rollback(ctx, key, source_lang, target_lang, reason, note, rollback_batch, output_format):
    engine = ctx.obj["engine"]
    reason_enum = RollbackReason(reason)
    result = engine.rollback_by_key(key, source_lang, target_lang, reason_enum, note, rollback_batch)
    report = ReportGenerator.format_rollback_result(result.to_dict(), output_format)
    click.echo(report)


@cli.command()
@click.option("--batch", "-b", required=True, help="版本批次号")
@click.option("--reason", "-r", required=True, 
              type=click.Choice([r.value for r in RollbackReason]),
              help="回滚原因")
@click.option("--note", "-n", default="", help="回滚说明")
@click.option("--rollback-batch", "-rb", default="batch_rollback", help="回滚批次号")
@click.option("--format", "-f", "output_format", default="table", 
              type=click.Choice(["table", "json"]), help="输出格式")
@click.pass_context
def rollback_batch(ctx, batch, reason, note, rollback_batch, output_format):
    engine = ctx.obj["engine"]
    reason_enum = RollbackReason(reason)
    result = engine.rollback_by_batch(batch, reason_enum, note, rollback_batch)
    report = ReportGenerator.format_rollback_result(result.to_dict(), output_format)
    click.echo(report)


@cli.command()
@click.option("--format", "-f", "output_format", default="table", 
              type=click.Choice(["table", "json"]), help="输出格式")
@click.option("--output", "-o", help="输出文件路径")
@click.pass_context
def check(ctx, output_format, output):
    engine = ctx.obj["engine"]
    report = engine.generate_report("json")
    formatted = ReportGenerator.format_consistency_report(report, output_format)
    
    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(formatted)
        click.echo(f"报告已保存到: {output}")
    else:
        click.echo(formatted)


@cli.command()
@click.option("--key", "-k", required=True, help="词条Key")
@click.option("--source-lang", "-s", required=True, help="源语言")
@click.option("--target-lang", "-t", required=True, help="目标语言")
@click.option("--format", "-f", "output_format", default="table", 
              type=click.Choice(["table", "json"]), help="输出格式")
@click.pass_context
def history(ctx, key, source_lang, target_lang, output_format):
    engine = ctx.obj["engine"]
    history_data = engine.get_entry_history(key, source_lang, target_lang)
    formatted = ReportGenerator.format_entry_history(history_data, output_format)
    click.echo(formatted)


@cli.command()
@click.option("--keyword", "-k", default="", help="搜索关键词")
@click.option("--status", "-s", type=click.Choice(["active", "rollbacked"]), help="词条状态")
@click.option("--source-lang", "-sl", help="源语言过滤")
@click.option("--target-lang", "-tl", help="目标语言过滤")
@click.option("--format", "-f", "output_format", default="table", 
              type=click.Choice(["table", "json"]), help="输出格式")
@click.pass_context
def search(ctx, keyword, status, source_lang, target_lang, output_format):
    engine = ctx.obj["engine"]
    status_enum = EntryStatus(status) if status else None
    results = engine.search_entries(keyword, status_enum, source_lang, target_lang)
    formatted = ReportGenerator.format_search_results(results, output_format)
    click.echo(formatted)


@cli.command()
@click.argument("output_file", default="sample_data.json")
def generate_sample(output_file):
    sample_data = [
        {
            "key": "login.button",
            "source_lang": "en",
            "target_lang": "zh",
            "source_text": "Login",
            "target_text": "登录",
            "version_batch": "v1.0.0"
        },
        {
            "key": "logout.button",
            "source_lang": "en",
            "target_lang": "zh",
            "source_text": "Logout",
            "target_text": "退出登录",
            "version_batch": "v1.0.0"
        },
        {
            "key": "welcome.message",
            "source_lang": "en",
            "target_lang": "zh",
            "source_text": "Welcome back!",
            "target_text": "欢迎回来！",
            "version_batch": "v1.0.1"
        }
    ]
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)
    
    click.echo(f"样例数据已生成: {output_file}")


@cli.command()
@click.argument("sample_type", type=click.Choice(["normal", "dirty", "conflict", "empty"]))
@click.argument("output_file")
def generate_test_data(sample_type, output_file):
    if sample_type == "normal":
        data = [
            {
                "key": "home.title",
                "source_lang": "en",
                "target_lang": "zh",
                "source_text": "Home",
                "target_text": "首页",
                "version_batch": "v2.0.0"
            },
            {
                "key": "home.subtitle",
                "source_lang": "en",
                "target_lang": "zh",
                "source_text": "Your dashboard",
                "target_text": "您的控制面板",
                "version_batch": "v2.0.0"
            }
        ]
    elif sample_type == "dirty":
        data = [
            {
                "key": "",
                "source_lang": "english",
                "target_lang": "zh",
                "source_text": "Hello",
                "target_text": "你好",
                "version_batch": "v2.0.0"
            },
            {
                "key": "valid.key",
                "source_lang": "en",
                "target_lang": "zh",
                "source_text": "Valid",
                "target_text": "有效",
                "version_batch": "v2.0.0"
            },
            {
                "key": "missing.fields",
                "source_lang": "en",
                "target_text": "测试",
                "version_batch": ""
            }
        ]
    elif sample_type == "conflict":
        data = [
            {
                "key": "error.msg",
                "source_lang": "en",
                "target_lang": "zh",
                "source_text": "Error occurred",
                "target_text": "发生错误",
                "version_batch": "v1.9.0"
            },
            {
                "key": "error.msg",
                "source_lang": "en",
                "target_lang": "zh",
                "source_text": "Error occurred",
                "target_text": "出错了",
                "version_batch": "v2.0.0"
            }
        ]
    else:
        data = []
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    click.echo(f"{sample_type} 测试数据已生成: {output_file}")


if __name__ == "__main__":
    cli()
