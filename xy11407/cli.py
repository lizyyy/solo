import sys
import json
import csv
from datetime import datetime
from typing import Optional
import click
from tabulate import tabulate
from core import QueueService
from models import (
    MedicineRecordCreate, QueueStatus, RetryCategory, DirtyType
)

EXIT_SUCCESS = 0
EXIT_ERROR = 1
EXIT_NOT_FOUND = 2
EXIT_INVALID = 3


def get_service():
    return QueueService()


def print_json(data):
    click.echo(json.dumps(data, ensure_ascii=False, indent=2, default=str))


@click.group()
@click.option("--db", default="sqlite:///pharmacy_queue.db", help="数据库连接字符串")
@click.pass_context
def cli(ctx, db):
    """乡镇药房近效期重试补偿队列 CLI"""
    ctx.ensure_object(dict)
    ctx.obj["db_url"] = db


@cli.group()
def record():
    """药品记录管理"""
    pass


@record.command("create")
@click.option("--store-id", required=True, help="门店ID")
@click.option("--store-name", required=True, help="门店名称")
@click.option("--medicine-id", required=True, help="药品ID")
@click.option("--medicine-name", required=True, help="药品名称")
@click.option("--batch-no", required=True, help="批号")
@click.option("--expiry-date", required=True, help="有效期")
@click.option("--quantity", type=float, required=True, help="数量")
@click.option("--amount", type=float, required=True, help="金额")
@click.option("--source-type", required=True, help="来源类型")
@click.option("--source-ref", help="来源参考")
@click.option("--operator", help="操作人")
@click.pass_context
def create_record(ctx, store_id, store_name, medicine_id, medicine_name,
                  batch_no, expiry_date, quantity, amount, source_type,
                  source_ref, operator):
    """创建药品记录"""
    try:
        service = QueueService(ctx.obj["db_url"])
        data = MedicineRecordCreate(
            store_id=store_id,
            store_name=store_name,
            medicine_id=medicine_id,
            medicine_name=medicine_name,
            batch_no=batch_no,
            expiry_date=expiry_date,
            quantity=quantity,
            amount=amount,
            source_type=source_type,
            source_ref=source_ref
        )
        record = service.create_medicine_record(data, operator)
        click.echo(f"记录创建成功: ID={record.id}, 编号={record.record_no}")
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@record.command("enqueue")
@click.argument("record_id", type=int)
@click.option("--region-id", help="区域ID")
@click.option("--max-retries", type=int, default=5, help="最大重试次数")
@click.pass_context
def enqueue_record(ctx, record_id, region_id, max_retries):
    """将记录加入队列"""
    try:
        service = QueueService(ctx.obj["db_url"])
        item = service.enqueue_record(record_id, region_id, max_retries)
        click.echo(f"入队成功: 队列编号={item.queue_no}, 状态={item.status}")
        sys.exit(EXIT_SUCCESS)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@cli.group()
def queue():
    """队列管理"""
    pass


@queue.command("list")
@click.option("--status", help="按状态过滤")
@click.option("--store-id", help="按门店过滤")
@click.option("--region-id", help="按区域过滤")
@click.option("--limit", type=int, default=50, help="显示数量")
@click.option("--format", "fmt", default="table", type=click.Choice(["table", "json"]))
@click.pass_context
def list_queue(ctx, status, store_id, region_id, limit, fmt):
    """列出队列项"""
    try:
        service = QueueService(ctx.obj["db_url"])
        items = service.list_queue_items(status, store_id, region_id, limit)
        
        if fmt == "json":
            data = [
                {
                    "id": item.id,
                    "queue_no": item.queue_no,
                    "status": item.status,
                    "retry_count": item.retry_count,
                    "store_id": item.store_id,
                    "created_at": item.created_at.isoformat()
                }
                for item in items
            ]
            print_json(data)
        else:
            headers = ["ID", "队列编号", "状态", "重试次数", "门店ID", "创建时间"]
            rows = [
                [
                    item.id,
                    item.queue_no,
                    item.status,
                    item.retry_count,
                    item.store_id,
                    item.created_at.strftime("%Y-%m-%d %H:%M")
                ]
                for item in items
            ]
            click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
        
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@queue.command("show")
@click.argument("queue_item_id", type=int)
@click.pass_context
def show_queue(ctx, queue_item_id):
    """查看队列项详情"""
    try:
        service = QueueService(ctx.obj["db_url"])
        detail = service.get_queue_item_detail(queue_item_id)
        print_json(detail)
        sys.exit(EXIT_SUCCESS)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@queue.command("history")
@click.argument("queue_item_id", type=int)
@click.pass_context
def show_history(ctx, queue_item_id):
    """查看状态变更历史"""
    try:
        service = QueueService(ctx.obj["db_url"])
        history = service.get_queue_item_history(queue_item_id)
        print_json(history)
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@queue.command("receipt")
@click.argument("queue_item_id", type=int)
@click.option("--receipt-no", required=True, help="回执编号")
@click.option("--receipt-data", required=True, help="回执数据(JSON)")
@click.option("--operator", help="操作人")
@click.pass_context
def submit_receipt(ctx, queue_item_id, receipt_no, receipt_data, operator):
    """提交外部回执"""
    try:
        service = QueueService(ctx.obj["db_url"])
        data = json.loads(receipt_data)
        item = service.submit_external_receipt(queue_item_id, receipt_no, data, operator)
        click.echo(f"回执提交成功: 状态={item.status}")
        sys.exit(EXIT_SUCCESS)
    except json.JSONDecodeError:
        click.echo("错误: receipt_data 不是有效的JSON", err=True)
        sys.exit(EXIT_INVALID)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@queue.command("retry")
@click.argument("queue_item_id", type=int)
@click.option("--category", "category", required=True,
              type=click.Choice([c.value for c in RetryCategory]),
              help="重试分类")
@click.option("--error", help="错误信息")
@click.option("--response", help="响应数据(JSON)")
@click.option("--success", is_flag=True, help="重试成功")
@click.pass_context
def process_retry(ctx, queue_item_id, category, error, response, success):
    """处理重试"""
    try:
        service = QueueService(ctx.obj["db_url"])
        resp_data = json.loads(response) if response else None
        item, log = service.process_retry(
            queue_item_id, RetryCategory(category), error, resp_data, success
        )
        click.echo(f"重试处理完成: 状态={item.status}, 尝试次数={item.retry_count}, 成功={success}")
        sys.exit(EXIT_SUCCESS)
    except json.JSONDecodeError:
        click.echo("错误: response 不是有效的JSON", err=True)
        sys.exit(EXIT_INVALID)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@queue.command("manual")
@click.argument("queue_item_id", type=int)
@click.option("--handler", required=True, help="处理人")
@click.option("--notes", help="备注")
@click.pass_context
def manual_takeover(ctx, queue_item_id, handler, notes):
    """人工接管"""
    try:
        service = QueueService(ctx.obj["db_url"])
        item = service.manual_takeover(queue_item_id, handler, notes)
        click.echo(f"人工接管完成: 处理人={item.handler}, 状态={item.status}")
        sys.exit(EXIT_SUCCESS)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@queue.command("compensate")
@click.argument("queue_item_id", type=int)
@click.option("--quantity", type=float, required=True, help="补偿数量")
@click.option("--amount", type=float, required=True, help="补偿金额")
@click.option("--rules", required=True, help="补偿规则(JSON)")
@click.option("--operator", required=True, help="操作人")
@click.option("--notes", help="备注")
@click.pass_context
def compensate(ctx, queue_item_id, quantity, amount, rules, operator, notes):
    """补偿入账"""
    try:
        service = QueueService(ctx.obj["db_url"])
        rules_data = json.loads(rules)
        item, comp = service.compensate_record(
            queue_item_id, quantity, amount, rules_data, operator, notes
        )
        click.echo(
            f"补偿完成: 补偿编号={comp.compensation_no}, "
            f"剩余数量={item.current_quantity}, 剩余金额={item.current_amount}"
        )
        sys.exit(EXIT_SUCCESS)
    except json.JSONDecodeError:
        click.echo("错误: rules 不是有效的JSON", err=True)
        sys.exit(EXIT_INVALID)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@queue.command("close")
@click.argument("queue_item_id", type=int)
@click.option("--operator", required=True, help="操作人")
@click.option("--reason", required=True, help="关闭原因")
@click.pass_context
def close_item(ctx, queue_item_id, operator, reason):
    """关闭队列项"""
    try:
        service = QueueService(ctx.obj["db_url"])
        item = service.close_queue_item(queue_item_id, operator, reason)
        click.echo(f"已关闭: 状态={item.status}")
        sys.exit(EXIT_SUCCESS)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@queue.command("dead-letter")
@click.argument("queue_item_id", type=int)
@click.option("--operator", required=True, help="操作人")
@click.option("--reason", required=True, help="原因")
@click.pass_context
def dead_letter(ctx, queue_item_id, operator, reason):
    """移入死信"""
    try:
        service = QueueService(ctx.obj["db_url"])
        item = service.move_to_dead_letter(queue_item_id, operator, reason)
        click.echo(f"已移入死信: 状态={item.status}")
        sys.exit(EXIT_SUCCESS)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@cli.group()
def supervisor():
    """督导视图"""
    pass


@supervisor.command("stats")
@click.option("--region-id", help="区域ID")
@click.pass_context
def show_stats(ctx, region_id):
    """查看督导统计"""
    try:
        service = QueueService(ctx.obj["db_url"])
        stats = service.get_supervisor_stats(region_id)
        print_json(stats.dict())
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@cli.group()
def export():
    """数据导出"""
    pass


@export.command("json")
@click.option("--status", help="按状态过滤")
@click.option("--region-id", help="按区域过滤")
@click.option("--output", "-o", type=click.File("w"), default="-", help="输出文件")
@click.pass_context
def export_json(ctx, status, region_id, output):
    """导出为JSON"""
    try:
        service = QueueService(ctx.obj["db_url"])
        data = service.export_queue_data(status, region_id)
        json.dump(data, output, ensure_ascii=False, indent=2, default=str)
        output.write("\n")
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


@export.command("csv")
@click.option("--status", help="按状态过滤")
@click.option("--region-id", help="按区域过滤")
@click.option("--output", "-o", type=click.File("w"), default="-", help="输出文件")
@click.pass_context
def export_csv(ctx, status, region_id, output):
    """导出为CSV"""
    try:
        service = QueueService(ctx.obj["db_url"])
        data = service.export_queue_data(status, region_id)
        
        writer = csv.writer(output)
        writer.writerow([
            "队列编号", "状态", "重试次数", "门店ID",
            "药品名称", "批号", "有效期", "原始数量", "原始金额",
            "当前数量", "当前金额", "外部回执号", "创建时间"
        ])
        
        for item in data:
            writer.writerow([
                item["queue_no"],
                item["status"],
                item["retry_count"],
                item["store_id"],
                item["medicine"]["medicine_name"],
                item["medicine"]["batch_no"],
                item["medicine"]["expiry_date"],
                item["medicine"]["quantity"],
                item["medicine"]["amount"],
                item["current"]["quantity"],
                item["current"]["amount"],
                item["external"]["receipt_no"] or "",
                item["created_at"]
            ])
        
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(EXIT_ERROR)


if __name__ == "__main__":
    cli()
