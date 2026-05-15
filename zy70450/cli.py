#!/usr/bin/env python3
import click
import json
import os
from datetime import datetime
from data_diff_tool import Storage, DataProcessor, generate_sample_data


@click.group()
@click.option("--data-dir", default="./data", help="数据存储目录")
@click.pass_context
def cli(ctx, data_dir):
    """数据导入差异比较命令行工具"""
    ctx.ensure_object(dict)
    ctx.obj["storage"] = Storage(data_dir)
    ctx.obj["processor"] = DataProcessor(ctx.obj["storage"])


@cli.command()
@click.argument("output_file", default="./sample_repair_orders.json")
def generate_samples(output_file):
    """生成物业报修单样例数据"""
    generate_sample_data(output_file)


@cli.command()
@click.argument("input_file")
@click.pass_context
def import_batch(ctx, input_file):
    """批量导入数据"""
    processor = ctx.obj["processor"]
    
    click.echo(f"开始导入文件: {input_file}")
    result = processor.import_batch(input_file)
    
    click.echo(f"\n导入完成!")
    click.echo(f"  批次ID: {result.batch_id}")
    click.echo(f"  总记录数: {result.total_records}")
    click.echo(f"  成功: {result.success_count}")
    click.echo(f"  失败: {result.failed_count}")
    click.echo(f"  差异: {result.diff_count}")
    
    if result.failed_count > 0:
        failed_file = f"./failed_{result.batch_id}.json"
        ctx.obj["storage"].export_failed_records(failed_file)
        click.echo(f"\n失败记录已保存到: {failed_file}")
    
    return result.batch_id


@cli.command()
@click.argument("batch_id")
@click.argument("output_file")
@click.pass_context
def generate_report(ctx, batch_id, output_file):
    """生成导入报告"""
    processor = ctx.obj["processor"]
    
    click.echo(f"生成报告: {output_file}")
    processor.generate_report(batch_id, output_file)
    click.echo("报告生成完成!")


@cli.command()
@click.pass_context
def list_batches(ctx):
    """列出所有导入批次"""
    storage = ctx.obj["storage"]
    results = storage.get_all_import_results()
    
    if not results:
        click.echo("暂无导入批次")
        return
    
    click.echo("导入批次列表:")
    for r in sorted(results, key=lambda x: x.started_at, reverse=True):
        status = "完成" if r.completed_at else "进行中"
        click.echo(f"\n  批次ID: {r.batch_id}")
        click.echo(f"    开始时间: {r.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"    状态: {status}")
        click.echo(f"    统计: 总数{r.total_records} 成功{r.success_count} 失败{r.failed_count} 差异{r.diff_count}")


@cli.command()
@click.argument("order_id")
@click.pass_context
def show_order(ctx, order_id):
    """显示工单详情（包含字段溯源）"""
    storage = ctx.obj["storage"]
    order = storage.get_repair_order(order_id)
    
    if not order:
        click.echo(f"找不到工单: {order_id}")
        return
    
    click.echo(f"工单详情: {order_id}")
    click.echo(f"  来源系统: {order.source_system}")
    click.echo(f"  报修日期: {order.report_date}")
    click.echo(f"  报修类型: {order.repair_type}")
    click.echo(f"  楼栋: {order.building}")
    click.echo(f"  房间: {order.room}")
    click.echo(f"  描述: {order.description}")
    click.echo(f"  状态: {order.status}")
    click.echo(f"  处理人: {order.assignee}")
    
    if order.field_sources:
        click.echo("\n字段溯源信息:")
        for fs in order.field_sources:
            if fs.field_path != "_meta" and not fs.field_path.startswith("_meta."):
                click.echo(f"  {fs.field_path}:")
                click.echo(f"    来源: {fs.source}")
                click.echo(f"    来源类型: {fs.source_type}")
                if fs.processing_rule:
                    click.echo(f"    处理规则: {fs.processing_rule}")


@cli.command()
@click.argument("order_id")
@click.argument("field_path")
@click.argument("new_value")
@click.argument("reason")
@click.argument("source")
@click.argument("processing_basis")
@click.option("--gray-release", is_flag=True, help="是否为灰度发布备忘")
@click.pass_context
def add_correction(ctx, order_id, field_path, new_value, reason, source, processing_basis, gray_release):
    """添加人工修正记录"""
    processor = ctx.obj["processor"]
    
    correction = processor.add_manual_correction(
        order_id=order_id,
        field_path=field_path,
        new_value=new_value,
        reason=reason,
        source=source,
        processing_basis=processing_basis,
        is_gray_release=gray_release
    )
    
    click.echo("人工修正记录已添加!")
    click.echo(f"  修正ID: {correction.correction_id}")
    click.echo(f"  工单ID: {correction.order_id}")
    click.echo(f"  字段路径: {correction.field_path}")
    click.echo(f"  原值: {correction.old_value}")
    click.echo(f"  新值: {correction.new_value}")
    click.echo(f"  原因: {correction.reason}")
    click.echo(f"  来源: {correction.source}")
    click.echo(f"  处理依据: {correction.processing_basis}")
    click.echo(f"  灰度发布备忘: {'是' if correction.is_gray_release else '否'}")


@cli.command()
@click.argument("batch_id", required=False)
@click.pass_context
def show_failures(ctx, batch_id):
    """显示失败记录"""
    storage = ctx.obj["storage"]
    failures = storage.get_failed_records(batch_id)
    
    if not failures:
        click.echo("暂无失败记录")
        return
    
    click.echo(f"失败记录总数: {len(failures)}")
    for i, failed in enumerate(failures, 1):
        click.echo(f"\n[{i}] 失败记录ID: {failed.record_id}")
        click.echo(f"    工单ID: {failed.order_id}")
        click.echo(f"    错误类型: {failed.error_type}")
        click.echo(f"    错误信息: {failed.error_message}")
        click.echo(f"    失败时间: {failed.failed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"    建议: {failed.suggestion}")
        
        if failed.field_sources:
            click.echo("    字段溯源:")
            for fs in failed.field_sources[:3]:
                if fs.field_path != "_meta" and not fs.field_path.startswith("_meta."):
                    click.echo(f"      {fs.field_path}: {fs.source} -> {fs.processed_value}")


@cli.command()
@click.argument("order_id", required=False)
@click.pass_context
def list_corrections(ctx, order_id):
    """列出人工修正记录"""
    storage = ctx.obj["storage"]
    corrections = storage.get_manual_corrections(order_id)
    
    if not corrections:
        click.echo("暂无人工修正记录")
        return
    
    click.echo(f"人工修正记录总数: {len(corrections)}")
    for c in corrections:
        gray_flag = "[灰度发布]" if c.is_gray_release else ""
        click.echo(f"\n  {gray_flag}{c.corrected_at.strftime('%Y-%m-%d %H:%M')}")
        click.echo(f"    工单: {c.order_id} | 字段: {c.field_path}")
        click.echo(f"    变更: {c.old_value} -> {c.new_value}")
        click.echo(f"    原因: {c.reason}")
        click.echo(f"    来源: {c.source}")
        click.echo(f"    处理依据: {c.processing_basis}")


@cli.command()
@click.argument("output_file", default="./full_run_report.json")
@click.pass_context
def full_demo(ctx, output_file):
    """完整演示流程：生成样例 -> 导入 -> 生成报告"""
    sample_file = "./demo_repair_orders.json"
    click.echo("步骤1: 生成样例数据...")
    generate_sample_data(sample_file)
    
    click.echo("\n步骤2: 批量导入数据...")
    processor = ctx.obj["processor"]
    result = processor.import_batch(sample_file)
    
    click.echo(f"\n步骤3: 添加灰度发布备忘人工修正记录...")
    processor.add_manual_correction(
        order_id="WO2024051011",
        field_path="status",
        new_value="已完成",
        reason="灰度发布测试-状态更新异常修正",
        source="运维团队人工介入",
        processing_basis="根据灰度发布备忘录第3条：跨系统工单状态同步异常修正规则",
        is_gray_release=True
    )
    
    click.echo("\n步骤4: 生成完整报告...")
    processor.generate_report(result.batch_id, output_file)
    
    if result.failed_count > 0:
        failed_file = f"./demo_failed_records.json"
        ctx.obj["storage"].export_failed_records(failed_file)
        click.echo(f"\n失败记录已保存到: {failed_file}")
    
    click.echo(f"\n演示完成! 报告已保存到: {output_file}")
    click.echo(f"\n统计摘要:")
    click.echo(f"  总记录: {result.total_records}")
    click.echo(f"  成功: {result.success_count}")
    click.echo(f"  失败: {result.failed_count}")
    click.echo(f"  差异: {result.diff_count}")
    click.echo(f"\n提示: 重启程序后仍然可以查询历史数据!")
    click.echo(f"  使用 'python cli.py list-batches' 查看所有批次")
    click.echo(f"  使用 'python cli.py show-order WO2024051011' 查看工单详情")
    click.echo(f"  使用 'python cli.py show-failures' 查看失败记录")
    click.echo(f"  使用 'python cli.py list-corrections' 查看人工修正记录")


if __name__ == "__main__":
    cli()
