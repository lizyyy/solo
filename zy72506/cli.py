import click
import json
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from src.storage import init_db
from src.models import VerificationStatus, ConflictType
from src import importer, engine, storage, result_reader

console = Console()


@click.group()
def cli():
    """工单摘要事实校验系统"""
    init_db()


@cli.command()
@click.argument("file_path")
@click.option("--name", "-n", required=True, help="批次名称")
@click.option("--model-version", "-v", required=True, help="模型版本")
@click.option("--operator", "-o", default="system", help="操作人")
@click.option("--description", "-d", default="", help="批次描述")
def import_model(file_path, name, model_version, operator, description):
    """第一步：导入模型输出片段"""
    try:
        batch, results = importer.import_model_output(
            file_path, name, model_version, operator, description=description
        )
        console.print(f"[green]批次创建成功:[/green] {batch.batch_id} ({batch.name})")

        success_count = sum(1 for r in results if r["status"] == "success")
        conflict_count = sum(1 for r in results if r.get("conflict_type") == ConflictType.MODEL_VERSION_CHANGED_SAME_SAMPLE)

        table = Table(title="导入结果")
        table.add_column("行号")
        table.add_column("样本编号")
        table.add_column("状态")
        table.add_column("冲突类型")
        table.add_column("校验状态")

        for r in results[:20]:
            table.add_row(
                str(r["row"]),
                r["sample_id"],
                r["status"],
                r.get("conflict_type", ""),
                r.get("verification_status", "")
            )

        console.print(table)
        console.print(f"总计: {len(results)} 条, 成功: {success_count} 条, 版本冲突: {conflict_count} 条")
        if len(results) > 20:
            console.print(f"... 仅显示前20条, 共 {len(results)} 条")

        rprint(Panel(
            f"[bold]批次ID:[/bold] {batch.batch_id}\n"
            f"下一步操作: 导入人工改判表\n"
            f"命令: python cli.py import-judgements {file_path} --batch-id {batch.batch_id}",
            title="导入完成",
            border_style="green"
        ))

    except Exception as e:
        console.print(f"[red]导入失败:[/red] {e}")
        raise


@cli.command()
@click.argument("file_path")
@click.option("--batch-id", "-b", required=True, help="批次ID")
@click.option("--operator", "-o", default="system", help="操作人")
def import_judgements(file_path, batch_id, operator):
    """第二步前：导入人工改判表"""
    try:
        results = importer.import_manual_judgements(file_path, batch_id, operator)

        success_count = sum(1 for r in results if r["status"] == "success")
        console.print(f"[green]人工改判表导入完成[/green]")

        table = Table(title="人工改判导入结果")
        table.add_column("行号")
        table.add_column("样本编号")
        table.add_column("状态")
        table.add_column("新状态")

        for r in results[:20]:
            table.add_row(
                str(r["row"]),
                r["sample_id"],
                r["status"],
                r.get("new_status", "")
            )

        console.print(table)
        console.print(f"总计: {len(results)} 条, 成功: {success_count} 条")

        rprint(Panel(
            f"[bold]批次ID:[/bold] {batch_id}\n"
            f"下一步操作: AI产品经理阿宁复核\n"
            f"查看待复核列表: python cli.py list --batch-id {batch_id} --status pending_ai_pm_review\n"
            f"复核命令: python cli.py ai-review <record_id> --approve",
            title="导入完成",
            border_style="green"
        ))

    except Exception as e:
        console.print(f"[red]导入失败:[/red] {e}")
        raise


@cli.command()
@click.argument("record_id")
@click.option("--approve/--reject", default=True, help="是否通过")
@click.option("--comment", "-c", default="", help="复核意见")
@click.option("--operator", "-o", default="阿宁", help="操作人（AI产品经理）")
def ai_review(record_id, approve, comment, operator):
    """第二步：AI产品经理复核"""
    try:
        record = engine.ai_pm_review(record_id, operator, comment, approve)
        console.print(f"[green]复核完成[/green]")
        console.print(f"  样本编号: {record.sample_id}")
        console.print(f"  新状态: {record.status}")
        console.print(f"  冲突类型: {record.conflict_type}")

        if record.status == VerificationStatus.PENDING_OPERATION_REVIEW:
            console.print(f"[yellow]  → 已提交运营复核[/yellow]")

        record_view = engine.get_record_for_review(record_id)
        if record_view["blocked_step"]:
            console.print(f"  卡在哪一步: {record_view['blocked_step']}")
            console.print(f"  阻塞原因: {record_view['blocked_reason']}")

    except Exception as e:
        console.print(f"[red]操作失败:[/red] {e}")


@cli.command()
@click.argument("record_id")
@click.option("--approve/--reject", required=True, help="是否通过")
@click.option("--comment", "-c", default="", help="复核意见")
@click.option("--operator", "-o", required=True, help="操作人（运营复核人）")
def operation_review(record_id, approve, comment, operator):
    """第二步后：运营复核人复核（模型版本冲突场景）"""
    try:
        record = engine.operation_review(record_id, operator, approve, comment)
        console.print(f"[green]运营复核完成[/green]")
        console.print(f"  样本编号: {record.sample_id}")
        console.print(f"  新状态: {record.status}")

        record_view = engine.get_record_for_review(record_id)
        if record_view["blocked_step"]:
            console.print(f"  卡在哪一步: {record_view['blocked_step']}")
            console.print(f"  阻塞原因: {record_view['blocked_reason']}")

    except Exception as e:
        console.print(f"[red]操作失败:[/red] {e}")


@cli.command()
@click.argument("record_id")
@click.option("--comment", "-c", default="", help="备注")
@click.option("--operator", "-o", default="system", help="操作人")
def mark_page_updated(record_id, comment, operator):
    """第三步：标记产品复盘页已更新"""
    try:
        record = engine.mark_review_page_updated(record_id, operator, comment)
        console.print(f"[green]复盘页更新已标记[/green]")
        console.print(f"  样本编号: {record.sample_id}")
        console.print(f"  新状态: {record.status}")
    except Exception as e:
        console.print(f"[red]操作失败:[/red] {e}")


@cli.command()
@click.argument("record_id")
@click.option("--reason", "-r", default="", help="回滚原因")
@click.option("--operator", "-o", default="system", help="操作人")
def rollback(record_id, reason, operator):
    """回滚一条记录"""
    try:
        record = engine.rollback_record(record_id, operator, reason)
        console.print(f"[green]已回滚[/green]")
        console.print(f"  样本编号: {record.sample_id}")
        console.print(f"  新状态: {record.status}")
    except Exception as e:
        console.print(f"[red]操作失败:[/red] {e}")


@cli.command()
@click.option("--batch-id", "-b", default=None, help="批次ID")
@click.option("--status", "-s", default=None, help="按状态过滤")
@click.option("--conflict", "-c", default=None, help="按冲突类型过滤")
@click.option("--limit", "-l", default=30, help="显示条数")
def list(batch_id, status, conflict, limit):
    """列出校验记录"""
    status_filter = VerificationStatus(status) if status else None
    conflict_filter = ConflictType(conflict) if conflict else None

    records = storage.list_verification_records(
        batch_id=batch_id,
        status=status_filter,
        conflict_type=conflict_filter
    )

    table = Table(title="校验记录列表")
    table.add_column("记录ID", overflow="fold")
    table.add_column("样本编号")
    table.add_column("批次")
    table.add_column("状态")
    table.add_column("冲突类型")
    table.add_column("卡在哪一步")
    table.add_column("最后更新")

    for r in records[:limit]:
        view = engine.get_record_for_review(r.id)
        table.add_row(
            r.id[:16] + "...",
            r.sample_id,
            r.batch_id,
            view["status_display"],
            view["conflict_display"],
            view["blocked_step"] or "-",
            str(r.updated_at)[:16]
        )

    console.print(table)
    console.print(f"共 {len(records)} 条记录")


@cli.command()
@click.argument("record_id")
def show(record_id):
    """查看单条记录详情（运营复核人视图）"""
    view = engine.get_record_for_review(record_id)
    if not view:
        console.print("[red]未找到记录[/red]")
        return

    console.print(Panel(
        f"[bold]样本编号:[/bold] {view['sample_id']}\n"
        f"[bold]记录ID:[/bold] {view['record_id']}\n"
        f"[bold]批次ID:[/bold] {view['batch_id']}\n"
        f"[bold]当前状态:[/bold] {view['status_display']}\n"
        f"[bold]冲突类型:[/bold] {view['conflict_display']}",
        title="基本信息",
        border_style="blue"
    ))

    if view["blocked_step"]:
        console.print(Panel(
            f"[bold yellow]卡在哪一步:[/bold yellow] {view['blocked_step']}\n"
            f"[bold yellow]阻塞原因:[/bold yellow] {view['blocked_reason']}",
            title="当前进度（运营复核人无需追问即可了解）",
            border_style="yellow"
        ))

    console.print(Panel(
        f"[bold]模型版本变更:[/bold] {view['previous_model_version'] or '-'} → {view['current_model_version']}\n"
        f"[bold]原始行号:[/bold] 第 {view['original_row_number']} 行\n"
        f"[bold]模型输出:[/bold] {view['model_output'][:100]}...\n"
        f"[bold]标准答案:[/bold] {view['expected_summary'][:100]}...\n"
        f"[bold]事实校验结果:[/bold] {view['fact_check_result']}",
        title="模型输出片段（证据）",
        border_style="cyan"
    ))

    if view["manual_judgement"]:
        mj = view["manual_judgement"]
        console.print(Panel(
            f"[bold]人工改判行号:[/bold] 第 {mj['judge_row_number']} 行\n"
            f"[bold]是否正确:[/bold] {'是' if mj['is_correct'] else '否'}\n"
            f"[bold]修正摘要:[/bold] {mj['corrected_summary'] or '-'}\n"
            f"[bold]改判说明:[/bold] {mj['judge_comment'] or '-'}\n"
            f"[bold]改判人:[/bold] {mj['judged_by']}",
            title="人工改判（证据）",
            border_style="magenta"
        ))

    if view["ai_pm_review"]["reviewed_by"]:
        ar = view["ai_pm_review"]
        console.print(Panel(
            f"[bold]复核意见:[/bold] {ar['comment'] or '-'}\n"
            f"[bold]复核人:[/bold] {ar['reviewed_by']}\n"
            f"[bold]复核时间:[/bold] {ar['reviewed_at']}",
            title="AI产品经理复核",
            border_style="green"
        ))

    if view["operation_review"]["reviewed_by"]:
        or_ = view["operation_review"]
        console.print(Panel(
            f"[bold]复核意见:[/bold] {or_['comment'] or '-'}\n"
            f"[bold]复核人:[/bold] {or_['reviewed_by']}\n"
            f"[bold]复核时间:[/bold] {or_['reviewed_at']}",
            title="运营复核",
            border_style="green"
        ))

    if view["status_history"]:
        table = Table(title="状态流转历史（可复盘）")
        table.add_column("#")
        table.add_column("从状态")
        table.add_column("到状态")
        table.add_column("操作人")
        table.add_column("备注")
        table.add_column("时间")
        for i, h in enumerate(view["status_history"]):
            table.add_row(
                str(i + 1),
                h["old_status"],
                h["new_status"],
                h["operator"],
                h["comment"][:50],
                h["timestamp"][:16]
            )
        console.print(table)


@cli.command()
@click.option("--batch-id", "-b", required=True, help="批次ID")
@click.option("--output", "-o", required=True, help="输出文件路径")
@click.option("--status", "-s", default=None, help="按状态过滤")
@click.option("--conflict", "-c", default=None, help="按冲突类型过滤")
def export(batch_id, output, status, conflict):
    """导出校验明细（与页面、接口同一份数据）"""
    status_filter = [VerificationStatus(status)] if status else None
    conflict_filter = [ConflictType(conflict)] if conflict else None

    try:
        out_path = result_reader.export_to_excel(batch_id, output, status_filter, conflict_filter)
        console.print(f"[green]导出成功:[/green] {out_path}")

        summary = result_reader.get_batch_summary(batch_id)
        console.print(f"\n批次汇总:")
        console.print(f"  总样本数: {summary['total_samples']}")
        for step, cnt in summary["by_step"].items():
            if cnt > 0:
                console.print(f"  {step}: {cnt}")
    except Exception as e:
        console.print(f"[red]导出失败:[/red] {e}")


@cli.command()
@click.option("--batch-id", "-b", required=True, help="批次ID")
def summary(batch_id):
    """查看批次汇总"""
    summary_data = result_reader.get_batch_summary(batch_id)
    if not summary_data:
        console.print("[red]未找到批次[/red]")
        return

    console.print(Panel(
        f"[bold]批次ID:[/bold] {summary_data['batch_id']}\n"
        f"[bold]批次名称:[/bold] {summary_data['batch_name']}\n"
        f"[bold]模型版本:[/bold] {summary_data['model_version']}\n"
        f"[bold]创建人:[/bold] {summary_data['created_by']}\n"
        f"[bold]描述:[/bold] {summary_data['description'] or '-'}",
        title="批次信息",
        border_style="blue"
    ))

    console.print(f"\n[bold]总样本数:[/bold] {summary_data['total_samples']}")

    table = Table(title="按流程步骤分布")
    table.add_column("步骤")
    table.add_column("数量")
    for step, cnt in summary_data["by_step"].items():
        table.add_row(step, str(cnt))
    console.print(table)

    if summary_data["by_conflict"]:
        table = Table(title="按冲突类型分布")
        table.add_column("冲突类型")
        table.add_column("数量")
        for ct, cnt in summary_data["by_conflict"].items():
            table.add_row(ct, str(cnt))
        console.print(table)


@cli.command()
@click.option("--batch-id", "-b", default=None, help="批次ID")
@click.option("--limit", "-l", default=50, help="显示条数")
def logs(batch_id, limit):
    """查看操作日志（可复盘）"""
    logs_data = result_reader.get_operation_log_view(batch_id, limit)
    table = Table(title="操作日志")
    table.add_column("时间")
    table.add_column("操作")
    table.add_column("操作人")
    table.add_column("样本编号")
    table.add_column("详情")
    for log in logs_data:
        table.add_row(
            log["时间"][:16],
            log["操作"],
            log["操作人"],
            log["样本编号"],
            str(log["详情"])[:80]
        )
    console.print(table)


@cli.command()
@click.option("--output-dir", "-o", default="./examples", help="输出目录")
def create_example(output_dir):
    """生成示例数据用于演示"""
    import os
    import pandas as pd
    from pathlib import Path

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    model_output_v1 = pd.DataFrame([
        {"样本编号": f"S{i:03d}", "模型输出": f"模型v1输出摘要{i}", "标准答案": f"标准答案{i}", "事实校验结果": "通过" if i % 3 != 0 else "不通过"}
        for i in range(1, 11)
    ])
    model_output_v1.to_excel(out_dir / "model_output_v1.xlsx", index=False)

    model_output_v2 = pd.DataFrame([
        {"样本编号": f"S{i:03d}", "模型输出": f"模型v2输出摘要{i}_updated", "标准答案": f"标准答案{i}", "事实校验结果": "通过" if i % 4 != 0 else "不通过"}
        for i in range(1, 16)
    ])
    model_output_v2.to_excel(out_dir / "model_output_v2.xlsx", index=False)

    manual_judgements = pd.DataFrame([
        {"样本编号": f"S{i:03d}", "是否正确": "否" if i % 3 == 0 else "是",
         "修正摘要": f"人工修正后的摘要{i}" if i % 3 == 0 else "",
         "改判说明": f"样本{i}事实不符" if i % 3 == 0 else "",
         "改判人": "张三"}
        for i in range(1, 16)
    ])
    manual_judgements.to_excel(out_dir / "manual_judgements.xlsx", index=False)

    console.print(f"[green]示例文件已生成到:[/green] {out_dir.absolute()}")
    console.print(f"  - model_output_v1.xlsx (10条样本, 版本v1)")
    console.print(f"  - model_output_v2.xlsx (15条样本, 版本v2, 前10条样本编号不变 → 触发版本冲突)")
    console.print(f"  - manual_judgements.xlsx (人工改判表)")
    console.print("")
    console.print("[bold]完整演示流程:[/bold]")
    console.print(f"  1. 导入v1: python cli.py import-model {out_dir}/model_output_v1.xlsx -n '测试批次v1' -v v1 -o 阿宁")
    console.print(f"  2. 导入v2: python cli.py import-model {out_dir}/model_output_v2.xlsx -n '测试批次v2' -v v2 -o 阿宁  # 前10条会检测到版本冲突")
    console.print(f"  3. 导入人工改判: python cli.py import-judgements {out_dir}/manual_judgements.xlsx -b <batch_id_v2>")
    console.print(f"  4. 查看冲突记录: python cli.py list -b <batch_id_v2> -c model_version_changed_same_sample")
    console.print(f"  5. AI产品经理复核: python cli.py ai-review <record_id> --approve -c '确认版本变更有效'")
    console.print(f"  6. 运营复核: python cli.py operation-review <record_id> --approve -o 运营李四 -c '确认通过'")
    console.print(f"  7. 标记复盘页更新: python cli.py mark-page-updated <record_id>")
    console.print(f"  8. 导出明细: python cli.py export -b <batch_id_v2> -o ./output/export.xlsx")
    console.print(f"  9. 查看单条记录: python cli.py show <record_id>")


if __name__ == "__main__":
    cli()
