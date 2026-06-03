import click
import json
from typing import Optional

from .importer import (
    import_formula_screenshots,
    manual_edit_record,
    get_record_history,
    compare_versions,
)
from .boundary_rules import (
    init_boundary_rules,
    rollback_batch,
    get_abnormal_records,
)


@click.group()
def cli():
    pass


@cli.command()
@click.argument("file_path")
@click.option("--imported-by", default="阿兰", help="导入人姓名")
@click.option("--sheet-name", default=None, help="Excel工作表名称")
def import_file(file_path: str, imported_by: str, sheet_name: Optional[str]):
    result = import_formula_screenshots(file_path, imported_by, sheet_name)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.argument("screenshot_id", type=int)
@click.argument("field_name")
@click.argument("new_value")
@click.option("--edited-by", default="阿兰", help="编辑人姓名")
@click.option("--reason", required=True, help="修改原因")
def edit(screenshot_id: int, field_name: str, new_value: str, edited_by: str, reason: str):
    result = manual_edit_record(screenshot_id, field_name, new_value, edited_by, reason)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.argument("screenshot_id", type=int)
def history(screenshot_id: int):
    result = get_record_history(screenshot_id)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.argument("screenshot_id", type=int)
@click.argument("version1", type=int)
@click.argument("version2", type=int)
def diff(screenshot_id: int, version1: int, version2: int):
    result = compare_versions(screenshot_id, version1, version2)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.argument("batch_id")
@click.option("--reason", required=True, help="回滚原因")
@click.option("--by", default="系统管理员", help="回滚操作人")
def rollback(batch_id: str, reason: str, by: str):
    result = rollback_batch(batch_id, reason, by)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.option("--batch-id", default=None, help="指定批次ID")
def abnormal(batch_id: Optional[str]):
    result = get_abnormal_records(batch_id)
    if result:
        click.echo(f"发现 {len(result)} 条异常记录:")
        for r in result:
            click.echo(f"\nID: {r['id']}")
            click.echo(f"  批次: {r['batch_id']}")
            click.echo(f"  原始行号: {r['original_row_number']}")
            click.echo(f"  SKU: {r['sku_code']}")
            click.echo(f"  异常类型: {r['abnormal_type']}")
            click.echo(f"  异常说明: {r['abnormal_note']}")
    else:
        click.echo("没有异常记录")


@cli.command()
def init_rules():
    init_boundary_rules()
    click.echo("边界规则初始化完成")


if __name__ == "__main__":
    cli()
