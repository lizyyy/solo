import click
from datetime import datetime

from .importer import DataImporter
from .reporter import Reporter
from .database import Database


@click.group(help="仓库退货质检分拣 CLI 工具")
def main():
    pass


@main.command("import", help="导入退货数据（CSV或Excel格式）")
@click.argument("file_path", type=click.Path(exists=True))
def import_command(file_path):
    click.echo("-" * 50)
    click.echo(f"开始导入文件: {file_path}")
    click.echo("-" * 50)

    importer = DataImporter()
    result = importer.import_file(file_path)
    importer.close()

    if not result["success"]:
        click.echo(click.style(result["message"], fg="yellow"))
        if "import_time" in result:
            click.echo(f"上次导入时间: {result['import_time']}")
            click.echo(f"记录数: {result['total_records']}")
        return

    click.echo(click.style(f"导入批次ID: {result['batch_id']}", fg="green"))
    click.echo(f"总记录数: {result['total_records']}")
    click.echo(f"成功导入: {result['success_records']}")
    if result.get("skipped_records", 0) > 0:
        click.echo(
            click.style(
                f"跳过重复: {result['skipped_records']} 条（已存在的订单+序列号组合不会重复导入）",
                fg="cyan"
            )
        )
    if result["failed_records"] > 0:
        click.echo(
            click.style(f"导入失败: {result['failed_records']}", fg="red")
        )

    if result["exceptions"]:
        click.echo("\n" + "-" * 50)
        click.echo(click.style("检测到异常:", fg="yellow"))
        click.echo("-" * 50)
        for ex in result["exceptions"]:
            if "row" in ex:
                click.echo(f"  第 {ex['row']} 行 | 订单 {ex.get('order_no', '未知')}")
            else:
                click.echo(f"  订单 {ex.get('order_no', '未知')}")
            click.echo(
                click.style(f"    类型: {ex['exception_type']}", fg="red")
            )
            click.echo(f"    说明: {ex['exception_detail']}")
    else:
        click.echo(click.style("  无异常 ✓", fg="green"))

    click.echo("\n提示: 执行 'wh-return exceptions' 查看所有异常")


@main.command("report", help="生成分拣报告")
@click.option("--output", "-o", help="输出文件路径")
def report_command(output):
    click.echo("生成分拣报告...")

    reporter = Reporter()
    output_path = reporter.generate_sorting_report(output)
    reporter.close()

    click.echo(click.style(f"报告已生成: {output_path}", fg="green"))


@main.command("exceptions", help="查看异常清单")
@click.option("--unresolved", "-u", is_flag=True, help="只显示待处理异常")
@click.option("--output", "-o", help="导出到文件")
def exceptions_command(unresolved, output):
    reporter = Reporter()
    exceptions = reporter.list_exceptions(unresolved_only=unresolved)

    if output:
        output_path = reporter.generate_exception_list(output)
        click.echo(click.style(f"异常清单已导出: {output_path}", fg="green"))
        return

    if not exceptions:
        click.echo("暂无异常记录")
        return

    title = "待处理异常" if unresolved else "所有异常"
    click.echo("=" * 60)
    click.echo(f"{title} ({len(exceptions)} 条)")
    click.echo("=" * 60)

    for ex in exceptions:
        status = "已解决" if ex["is_resolved"] else "待处理"
        status_color = "green" if ex["is_resolved"] else "red"
        click.echo(f"\nID: {ex['id']} [{click.style(status, fg=status_color)}]")
        click.echo(f"类型: {ex['exception_type']}")
        click.echo(f"订单: {ex['order_no']}  SN: {ex['serial_number']}")
        click.echo(f"问题: {ex['exception_detail']}")
        click.echo(f"发现时间: {ex['created_at']}")
        if ex["is_resolved"]:
            click.echo(f"处理: {ex['resolution_note']}")


@main.command("list", help="查看退货数据")
@click.option("--orders", is_flag=True, help="列出所有退货单")
@click.option("--items", is_flag=True, help="列出所有商品")
@click.option("--order", help="指定订单号查看详情")
def list_command(orders, items, order):
    reporter = Reporter()

    if order:
        items_list = reporter.list_items(order)
        if not items_list:
            click.echo(f"未找到订单: {order}")
            return
        click.echo(f"\n订单 {order} 商品明细:")
        click.echo("-" * 60)
        for item in items_list:
            click.echo(
                f"  SN: {item['serial_number']} | "
                f"质检: {item['quality_result'] or '未质检'} | "
                f"退款: {item['refund_status'] or '未知'} | "
                f"仓位: {item['warehouse_location'] or '未分配'}"
            )
        return

    if orders:
        orders_list = reporter.list_orders()
        if not orders_list:
            click.echo("暂无退货单")
            return
        click.echo("\n退货单列表:")
        click.echo("-" * 60)
        for o in orders_list:
            click.echo(
                f"  {o['order_no']} | {o['return_date']} | {o['customer_name'] or '未知客户'}"
            )
        return

    if items:
        items_list = reporter.list_items()
        if not items_list:
            click.echo("暂无商品记录")
            return
        click.echo(f"\n商品列表 ({len(items_list)} 件):")
        click.echo("-" * 60)
        for item in items_list:
            click.echo(
                f"  SN: {item['serial_number']} | "
                f"订单: {item['order_no']} | "
                f"质检: {item['quality_result'] or '未质检'}"
            )
        return

    click.echo("请指定 --orders 或 --items 或 --order <订单号>")


@main.command("fix", help="修正商品信息并记录")
@click.argument("serial_number")
@click.argument("field")
@click.argument("new_value")
@click.option("--operator", default="仓库人员", help="操作人姓名")
@click.option("--note", help="修正说明")
def fix_command(serial_number, field, new_value, operator, note):
    valid_fields = [
        "quality_result",
        "missing_parts_note",
        "refund_status",
        "warehouse_location",
        "repair_responsibility",
        "product_name",
        "sku",
    ]
    field_display = {
        "quality_result": "质检结果",
        "missing_parts_note": "缺件说明",
        "refund_status": "退款状态",
        "warehouse_location": "仓位",
        "repair_responsibility": "返修责任",
        "product_name": "商品名称",
        "sku": "SKU",
    }

    if field not in valid_fields:
        click.echo(click.style(f"不支持的字段: {field}", fg="red"))
        click.echo(f"支持的字段: {', '.join(valid_fields)}")
        return

    db = Database()
    items = db.get_item_by_serial(serial_number)
    if not items:
        click.echo(click.style(f"未找到序列号: {serial_number}", fg="red"))
        db.close()
        return

    if len(items) > 1:
        click.echo(click.style(f"该序列号存在多条记录:", fg="yellow"))
        for i, item in enumerate(items):
            click.echo(
                f"  {i+1}. 订单 {item['order_no']} | 导入批次 {item['import_batch_id'][:8]}..."
            )
        click.echo(click.style("请先处理序列号重复问题", fg="red"))
        db.close()
        return

    item = items[0]
    item_id = item["id"]

    try:
        db.update_item_field(item_id, field, new_value, operator, note or "人工修正")
        click.echo(click.style("修正成功 ✓", fg="green"))
        click.echo(f"  序列号: {serial_number}")
        click.echo(f"  订单: {item['order_no']}")
        click.echo(f"  字段: {field_display.get(field, field)}")
        click.echo(f"  原值: {item[field] or '空'}")
        click.echo(f"  新值: {new_value}")
        if note:
            click.echo(f"  说明: {note}")
    except Exception as e:
        click.echo(click.style(f"修正失败: {str(e)}", fg="red"))

    db.close()


@main.command("resolve", help="标记异常为已解决")
@click.argument("exception_id", type=int)
@click.argument("resolution_note")
@click.option("--operator", default="仓库人员", help="操作人姓名")
def resolve_command(exception_id, resolution_note, operator):
    db = Database()
    try:
        db.resolve_exception(exception_id, resolution_note, operator)
        click.echo(click.style(f"异常 {exception_id} 已标记为已解决", fg="green"))
        click.echo(f"处理说明: {resolution_note}")
    except Exception as e:
        click.echo(click.style(f"操作失败: {str(e)}", fg="red"))
    db.close()


@main.command("workflow", help="显示从入库到分拣报告的完整流程")
def workflow_command():
    click.echo("=" * 60)
    click.echo("          仓库退货质检分拣完整工作流程")
    click.echo("=" * 60)
    click.echo("")
    click.echo("【第1步】准备退货数据文件")
    click.echo("  将退货信息整理成Excel或CSV文件，必需列：")
    click.echo("    order_no (订单号)")
    click.echo("    serial_number (商品序列号)")
    click.echo("    return_date (退货日期)")
    click.echo("  可选列：")
    click.echo("    customer_name (客户姓名)")
    click.echo("    product_name (商品名称)")
    click.echo("    sku (商品编码)")
    click.echo("    quality_result (质检结果: 合格/不合格/需返修/报废)")
    click.echo("    missing_parts_note (缺件说明)")
    click.echo("    refund_status (退款状态: 待审核/已批准/已退款/已拒绝)")
    click.echo("    warehouse_location (仓位)")
    click.echo("    repair_responsibility (返修责任说明)")
    click.echo("")
    click.echo("【第2步】导入数据")
    click.echo("  wh-return import 退货清单.xlsx")
    click.echo("")
    click.echo("【第3步】查看异常")
    click.echo("  wh-return exceptions")
    click.echo("  或只看未解决的：")
    click.echo("  wh-return exceptions -u")
    click.echo("")
    click.echo("【第4步】处理异常（示例）")
    click.echo("  修正质检结果:")
    click.echo("    wh-return fix SN001 quality_result 合格")
    click.echo("  修正仓位:")
    click.echo("    wh-return fix SN002 warehouse_location A-03")
    click.echo("  补充返修责任:")
    click.echo("    wh-return fix SN003 repair_responsibility 厂方质量问题")
    click.echo("")
    click.echo("【第5步】标记异常已解决")
    click.echo("  wh-return resolve 1 \"序列号重复，确认是录入错误\"")
    click.echo("")
    click.echo("【第6步】生成分拣报告")
    click.echo("  wh-return report")
    click.echo("")
    click.echo("【第7步】客服核对退款")
    click.echo("  wh-return list --orders")
    click.echo("  wh-return list --order RT20260501001")
    click.echo("")
    click.echo("=" * 60)


if __name__ == "__main__":
    main()
