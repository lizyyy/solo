import click
import json
import sys
from pathlib import Path

from .service import PromptVersionService
from .report import ReportGenerator


@click.group()
@click.pass_context
def cli(ctx):
    """模型提示版本实验流量命中摘要排查CLI"""
    ctx.ensure_object(dict)
    ctx.obj["service"] = PromptVersionService()


@cli.command()
@click.argument("template_name")
@click.argument("version_id")
@click.argument("content_file", type=click.Path(exists=True))
@click.option("--publisher", "-p", required=True, help="发布人")
@click.option("--description", "-d", default="", help="版本描述")
@click.pass_context
def publish(ctx, template_name, version_id, content_file, publisher, description):
    """发布新版本"""
    try:
        with open(content_file, "r", encoding="utf-8") as f:
            content = f.read()
        
        service = ctx.obj["service"]
        version = service.publish_version(
            template_name=template_name,
            version_id=version_id,
            content=content,
            publisher=publisher,
            description=description
        )
        click.echo(f"✅ 版本发布成功: {version.version_id}")
        click.echo(f"   模板: {version.template_name}")
        click.echo(f"   内容哈希: {version.content_hash()}")
    except Exception as e:
        click.echo(f"❌ 发布失败: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("template_name")
@click.argument("allocations_json")
@click.option("--operator", "-o", required=True, help="操作人")
@click.pass_context
def traffic(ctx, template_name, allocations_json, operator):
    """分配流量
    
    ALLOCATIONS_JSON: JSON格式的流量分配，如 '{"v1": 70, "v2": 30}'
    """
    try:
        allocations = json.loads(allocations_json)
        service = ctx.obj["service"]
        result = service.allocate_traffic(template_name, allocations, operator)
        click.echo(f"✅ 流量分配成功")
        for vid, weight in result.allocations.items():
            click.echo(f"   {vid}: {weight}%")
    except json.JSONDecodeError:
        click.echo("❌ JSON格式错误", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ 流量分配失败: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("request_id")
@click.argument("template_name")
@click.argument("version_id")
@click.option("--content", "-c", default="", help="请求内容")
@click.pass_context
def hit(ctx, request_id, template_name, version_id, content):
    """记录命中"""
    try:
        service = ctx.obj["service"]
        result = service.record_hit(request_id, template_name, version_id, content)
        click.echo(f"✅ 命中记录成功: {result.request_id}")
        click.echo(f"   版本: {result.version_id}")
    except Exception as e:
        click.echo(f"❌ 记录失败: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("template_name")
@click.argument("from_version")
@click.argument("to_version")
@click.option("--operator", "-o", required=True, help="操作人")
@click.option("--reason", "-r", default="", help="回滚原因")
@click.pass_context
def rollback(ctx, template_name, from_version, to_version, operator, reason):
    """回滚版本"""
    try:
        service = ctx.obj["service"]
        result = service.rollback_version(template_name, from_version, to_version, operator, reason)
        click.echo(f"✅ 回滚成功: {result.rollback_id}")
        click.echo(f"   {result.from_version} -> {result.to_version}")
    except Exception as e:
        click.echo(f"❌ 回滚失败: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("template_name")
@click.option("--format", "-f", type=click.Choice(["human", "machine", "both"]), default="human", help="输出格式")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
@click.pass_context
def summary(ctx, template_name, format, output):
    """生成命中摘要"""
    try:
        service = ctx.obj["service"]
        summary_data = service.get_hit_summary(template_name)
        
        human_report = ReportGenerator.generate_human_report(summary_data)
        machine_report = ReportGenerator.generate_machine_report(summary_data)
        
        if format == "human" or format == "both":
            if output:
                human_file = Path(output).with_suffix(".txt")
                human_file.parent.mkdir(parents=True, exist_ok=True)
                with open(human_file, "w", encoding="utf-8") as f:
                    f.write(human_report)
                click.echo(f"✅ 人类可读报告已保存: {human_file}")
            else:
                click.echo(human_report)
        
        if format == "machine" or format == "both":
            if output:
                machine_file = Path(output).with_suffix(".json")
                machine_file.parent.mkdir(parents=True, exist_ok=True)
                with open(machine_file, "w", encoding="utf-8") as f:
                    f.write(machine_report)
                click.echo(f"✅ 机器可读报告已保存: {machine_file}")
            else:
                click.echo(machine_report)
        
        if format == "both":
            validation = ReportGenerator.validate_consistency(human_report, machine_report)
            if validation["valid"]:
                click.echo(f"✅ 报告一致性验证通过")
            else:
                click.echo(f"⚠️  报告一致性验证失败", err=True)
                for check in validation["checks"]:
                    if not check["passed"]:
                        click.echo(f"   - {check['field']}: 期望 {check['expected']}")
            
    except Exception as e:
        click.echo(f"❌ 生成摘要失败: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("template_name")
@click.argument("version_id")
@click.argument("content_file", type=click.Path(exists=True))
@click.pass_context
def verify(ctx, template_name, version_id, content_file):
    """验证版本内容"""
    try:
        with open(content_file, "r", encoding="utf-8") as f:
            expected_content = f.read()
        
        service = ctx.obj["service"]
        valid, message = service.verify_version(template_name, version_id, expected_content)
        
        if valid:
            click.echo(f"✅ {message}")
        else:
            click.echo(f"❌ {message}", err=True)
            sys.exit(1)
    except Exception as e:
        click.echo(f"❌ 验证失败: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("template_name")
@click.pass_context
def list_versions(ctx, template_name):
    """列出所有版本"""
    try:
        service = ctx.obj["service"]
        versions = service.storage.list_versions(template_name)
        
        if not versions:
            click.echo("(无版本数据)")
            return
        
        click.echo(f"模板 {template_name} 的版本列表:")
        for v in versions:
            status = "✓" if v.is_active else "✗"
            click.echo(f"  {status} {v.version_id} - {v.publisher} - {v.description[:30]}")
    except Exception as e:
        click.echo(f"❌ 查询失败: {e}", err=True)
        sys.exit(1)


@cli.command()
def list_templates():
    """列出所有模板"""
    try:
        service = PromptVersionService()
        templates = service.storage.list_templates()
        
        if not templates:
            click.echo("(无模板数据)")
            return
        
        click.echo("模板列表:")
        for t in templates:
            click.echo(f"  - {t}")
    except Exception as e:
        click.echo(f"❌ 查询失败: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    cli()
