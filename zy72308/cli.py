#!/usr/bin/env python3
"""线性回归残差复盘 - 命令行工具 v2.0"""

import click
import os
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from residual_review.workflow import ReviewWorkflow
from residual_review.storage import StorageManager
from residual_review.exporter import UnifiedExporter
from residual_review.row_manager import RowManager
from residual_review.importer import DataImporter

console = Console()


@click.group()
def cli():
    """线性回归残差复盘系统 v2.0
    \b
    数据一致性承诺:
      - 页面展示 / 接口返回 / 导出明细 读同一份记录
      - 删除→补录→复核→重算 全链路保留证据
      - 待复核记录保留原始说法，不提前归入正常
    """
    pass


@cli.command("run")
@click.argument("file")
@click.option("--source-name", default=None, help="源文件名称")
@click.option("--delete-line", type=int, default=None, help="模拟人工删除指定行")
@click.option("--supplement-line", type=int, default=None, help="补录的行号")
@click.option("--supplement-x", type=float, default=None, help="补录X值")
@click.option("--supplement-y", type=float, default=None, help="补录Y值")
@click.option("--no-review", is_flag=True, help="补录后不自动执行教研组复核")
@click.option("--author", default="阿岚", help="操作人")
def run_full(file, source_name, delete_line, supplement_line, supplement_x, supplement_y, no_review, author):
    """运行完整复盘流程（推荐）"""
    if not os.path.exists(file):
        console.print(f"[red]错误: 文件 {file} 不存在[/red]")
        return

    workflow = ReviewWorkflow()
    result = workflow.simulate_alans_workflow(
        file,
        delete_line_no=delete_line,
        supplement_line=supplement_line,
        supplement_x=supplement_x,
        supplement_y=supplement_y,
        review_supplement=not no_review,
    )

    ok_count = sum(1 for _, ok in result["data_consistency_checks"].items() if ok)
    all_ok = ok_count == len(result["data_consistency_checks"])
    console.print(
        Panel.fit(
            f"导入ID: [bold cyan]{result['import_id']}[/bold cyan]\n"
            f"包含断档/待处理: [bold {'red' if result['has_gaps'] else 'green'}]"
            f"{'是' if result['has_gaps'] else '否'}[/bold {'red' if result['has_gaps'] else 'green'}]\n"
            f"一致性校验: {ok_count}/{len(result['data_consistency_checks'])} 通过",
            title="复盘完成 ✔" if all_ok else "复盘完成 ⚠",
            border_style="green" if all_ok else "yellow",
        )
    )


@cli.command("import")
@click.argument("file")
@click.option("--source-name", default=None)
@click.option("--author", default="阿岚")
def import_data_cmd(file, source_name, author):
    """步骤1: 导入CSV/Excel数据（多源字段自动归一）"""
    workflow = ReviewWorkflow()
    try:
        result = workflow.step1_import(file, source_name, author=author)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        return
    console.print(
        Panel.fit(
            f"导入ID: [bold]{result['import_id']}[/bold]\n"
            f"重复导入: {'✔是' if result['is_duplicate'] else '否'}\n"
            f"总行数: {result['total_rows']}\n"
            f"参数版本: v{result['params_version']}",
            title="导入完成",
            border_style="green",
        )
    )
    console.print(f"→ {result['message']}")


@cli.command("annotate")
@click.argument("import_id")
@click.argument("line_no", type=int)
@click.argument("annotation")
@click.option("--author", default="阿岚")
def annotate_cmd(import_id, line_no, annotation, author):
    """步骤2: 添加批注（老师批注/运营备注）"""
    workflow = ReviewWorkflow()
    result = workflow.step2_annotate(import_id, line_no, annotation, author)
    console.print(f"[green]批注已添加[/green]: {result['message']}")
    console.print(f"当前待复核: {result['待处理项']['待复核行数']} | 断档: {result['待处理项']['断档行数']}")


@cli.command("recalc")
@click.argument("import_id")
@click.option("--trigger", default="", help="重算触发原因")
@click.option("--author", default="阿岚")
def recalc_cmd(import_id, trigger, author):
    """步骤3: 参数版本页更新 → 触发残差重算"""
    workflow = ReviewWorkflow()
    result = workflow.step3_update_params(import_id, author=author, trigger=trigger)
    console.print(
        Panel.fit(
            f"参数版本: v{result['params_version']}\n"
            f"一致性校验: {result['一致性校验']}",
            title="参数已更新",
            border_style="green",
        )
    )


@cli.command("delete")
@click.argument("import_id")
@click.argument("line_no", type=int)
@click.option("--reason", default="", help="删除原因")
@click.option("--author", default="阿岚")
def delete_cmd(import_id, line_no, reason, author):
    """人工删除一行 → 标记断档待教研组复核"""
    workflow = ReviewWorkflow()
    result = workflow.action_delete_row(import_id, line_no, reason=reason, author=author)
    console.print(
        f"[yellow]⚠ 行{result['target_line']}已标记删除，"
        f"{result['gap_count']}处断档待[bold]{result['next_owner']}[/bold]复核[/yellow]"
    )


@cli.command("supplement")
@click.argument("import_id")
@click.argument("line_no", type=int)
@click.argument("x_val", type=float)
@click.argument("y_val", type=float)
@click.option("--reason", default="", help="补录说明")
@click.option("--author", default="阿岚")
@click.option("--skip-recalc", is_flag=True, help="不自动触发重算")
def supplement_cmd(import_id, line_no, x_val, y_val, reason, author, skip_recalc):
    """补录断档行 → 自动重算残差 → 状态pending_review待复核"""
    workflow = ReviewWorkflow()
    result = workflow.action_supplement_and_recalc(
        import_id, line_no, x_val, y_val,
        reason=reason, author=author,
        auto_recalc=not skip_recalc,
    )
    console.print(
        Panel.fit(
            f"行{result['target_line']}: ({x_val}, {y_val})\n"
            f"状态: {result['row_status_after']} → 待[bold]{result['next_owner']}[/bold]复核\n"
            f"自动重算: {'✔已触发' if result['auto_recalc_triggered'] else '未触发'}\n"
            f"参数版本: v{result['params_version']}\n"
            f"数据同步: {result['展示/导出/接口同步']}",
            title="补录完成",
            border_style="yellow",
        )
    )


@cli.command("review")
@click.argument("import_id")
@click.argument("line_no", type=int)
@click.option("--approve/--reject", default=True, help="通过=approve 退回=reject")
@click.option("--comment", default="", help="复核意见")
@click.option("--reviewer", default="教研组")
def review_cmd(import_id, line_no, approve, comment, reviewer):
    """教研组复核某一行 → 通过则supplemented, 否则gap退回"""
    workflow = ReviewWorkflow()
    result = workflow.action_review_row(
        import_id, line_no, approve, comment=comment, reviewer=reviewer
    )
    color = "green" if approve else "red"
    console.print(
        Panel.fit(
            f"行{result['target_line']}: [bold {color}]{'通过' if approve else '退回'}[/bold {color}]\n"
            f"复核人: {reviewer}\n"
            f"意见: {comment or '(无)'}\n"
            f"参数版本: v{result['params_version']}\n"
            f"数据同步: {result['展示/导出/接口同步']}",
            title="复核完成",
            border_style=color,
        )
    )


@cli.command("modify")
@click.argument("import_id")
@click.argument("line_no", type=int)
@click.option("--x", "new_x", type=float, default=None, help="新X值")
@click.option("--y", "new_y", type=float, default=None, help="新Y值")
@click.option("--reason", default="", help="修正原因")
@click.option("--author", default="阿岚")
def modify_cmd(import_id, line_no, new_x, new_y, reason, author):
    """修正某一行数据 → 转pending_review待复核"""
    row_mgr = RowManager(StorageManager())
    _, needs_recalc = row_mgr.modify_row(
        import_id, line_no, new_x=new_x, new_y=new_y, reason=reason, author=author
    )
    if needs_recalc:
        DataImporter(StorageManager()).recalculate_residuals(
            import_id, trigger=f"修正行{line_no}后重算", author=author
        )
    console.print(
        f"[yellow]行{line_no}已修正，转待复核；"
        f"已触发残差重算: {'✔是' if needs_recalc else '否'}[/yellow]"
    )


@cli.command("history")
@click.argument("import_id")
@click.option("--line", type=int, default=None, help="只看某行的变更历史")
def history_cmd(import_id, line):
    """查看某条记录的完整变更历史"""
    data = UnifiedExporter(StorageManager()).export_for_api(import_id)
    logs = data["变更历史"]
    if line:
        logs = [c for c in logs if c["original_line_no"] == line]

    if not logs:
        console.print("[yellow]暂无变更记录[/yellow]")
        return

    table = Table(title=f"变更历史 - {import_id}" + (f" (行{line})" if line else ""), box=box.SIMPLE)
    table.add_column("时间")
    table.add_column("类型")
    table.add_column("行号")
    table.add_column("操作人")
    table.add_column("原值→新值")
    table.add_column("状态变化")
    table.add_column("原因/下一步")

    for ch in logs:
        val_part = ""
        if ch["original_value_x"] is not None:
            val_part = f"({ch['original_value_x']},{ch['original_value_y']})"
        if ch["new_value_x"] is not None:
            val_part += f" → ({ch['new_value_x']},{ch['new_value_y']})"
        st_part = ""
        if ch["original_status"] or ch["new_status"]:
            st_part = f"{ch['original_status'] or '-'} → {ch['new_status'] or '-'}"
        reason_part = ch["reason"] or ""
        if ch["next_action"]:
            reason_part += f" → {ch['next_action']}"
        table.add_row(
            ch["timestamp"][:19].replace("T", " "),
            ch["change_type"],
            str(ch["original_line_no"]),
            ch["author"],
            val_part,
            st_part,
            reason_part,
        )
    console.print(table)


@cli.command("export")
@click.argument("import_id")
def export_cmd(import_id):
    """导出同一份结果的 4 种形式（JSON/CSV明细/CSV变更/TXT报告）"""
    files = UnifiedExporter(StorageManager()).export_all(import_id)
    console.print(Panel.fit(
        "\n".join([f"  [cyan]{k}[/cyan]: {v}" for k, v in files.items()]),
        title="导出完成 - 同源四份",
        border_style="green",
    ))


@cli.command("list")
def list_cmd():
    """列出所有复盘记录"""
    storage = StorageManager()
    exporter = UnifiedExporter(storage)
    records = storage.list_records()
    if not records:
        console.print("[yellow]暂无复盘记录[/yellow]")
        return

    table = Table(title="复盘记录列表")
    table.add_column("导入ID")
    table.add_column("状态")
    table.add_column("源文件")
    table.add_column("总数/有效/断档/待复")
    table.add_column("参数版本")

    for imp_id in records:
        d = exporter.export_for_api(imp_id)
        table.add_row(
            d["导入ID"],
            d["状态"],
            d["源文件"],
            f"{d['总行数']}/{d['有效行数']}/{d['断档行数']}/{d['待复核行数']}",
            f"v{d['参数版本']}",
        )
    console.print(table)


@cli.command("show")
@click.argument("import_id")
@click.option("--with-history", is_flag=True, help="同时显示变更历史")
def show_cmd(import_id, with_history):
    """显示复盘详情（列表/摘要/明细/待处理项全部同源）"""
    data = UnifiedExporter(StorageManager()).export_for_display(import_id)

    console.print(Panel(
        f"源文件: {data['源文件']} ({data['源格式']})\n"
        f"字段映射: {data['字段映射']}\n"
        f"导入时间: {data['导入时间']}\n"
        f"记录状态: [bold]{data['状态']}[/bold]\n"
        f"负责人: {data['数据负责人'] or '-'}\n"
        f"有效/待复核/断档/总数: "
        f"[green]{data['有效行数']}[/green]/"
        f"[yellow]{data['待复核行数']}[/yellow]/"
        f"[red]{data['断档行数']}[/red]/"
        f"{data['总行数']}\n"
        f"参数版本: v{data['参数版本']}\n"
        f"一致性校验: {data['数据一致性校验']}",
        title=f"复盘记录: {import_id}",
    ))

    if data["回归参数"]:
        console.print("\n[bold]当前回归参数:[/bold]")
        for k, v in data["回归参数"].items():
            console.print(f"  {k}: {v}")

    if data["参数历史快照"] and len(data["参数历史快照"]) > 1:
        console.print(f"\n[bold]参数历史 ({len(data['参数历史快照'])}个版本):[/bold]")
        for snap in data["参数历史快照"]:
            console.print(
                f"  v{snap['params_version']} @ {snap['snapshot_time'][:19].replace('T', ' ')} "
                f"| {snap.get('trigger', '')}"
            )

    if data["待处理摘要"]["gap"]:
        console.print("\n[bold red]编号断档（教研组复核）:[/bold red]")
        for g in data["待处理摘要"]["gap"]:
            console.print(
                f"  [行{g['原始行号']}] 状态={g['状态']} "
                f"原值={g['原始值']} → 下一步→{g['下一步处理人']}"
            )
    if data["待处理摘要"]["pending_review"]:
        console.print("\n[bold yellow]待复核补录/修正:[/bold yellow]")
        for g in data["待处理摘要"]["pending_review"]:
            console.print(
                f"  [行{g['原始行号']}] {g['状态']} 原值={g['原始值']} 当前={g['当前值']} → {g['下一步处理人']}"
            )

    if data["批注记录"]:
        console.print("\n[bold]批注记录:[/bold]")
        for ann in data["批注记录"]:
            console.print(
                f"  [{ann['author']} @行{ann['original_line_no']}] {ann['annotation']}"
            )

    console.print("\n[bold]行明细 (所有出口读同一份):[/bold]")
    table = Table()
    cols = ["原始行号", "当前行号", "原始X", "原始Y", "当前X", "当前Y", "残差", "状态", "下一步"]
    for c in cols:
        table.add_column(c)
    for row in data["行明细"]:
        color_map = {"normal": "green", "gap": "red", "pending_review": "yellow",
                     "supplemented": "green", "reviewed": "green", "modified": "green",
                     "deleted": "red"}
        st = row["状态"]
        styled = f"[{color_map.get(st, 'white')}]{st}[/{color_map.get(st, 'white')}]"
        table.add_row(
            str(row["原始行号"]),
            str(row["当前行号"]) if row["当前行号"] else "-",
            f"{row['原始X值']:.2f}" if row["原始X值"] is not None else "-",
            f"{row['原始Y值']:.2f}" if row["原始Y值"] is not None else "-",
            f"{row['当前X值']:.2f}",
            f"{row['当前Y值']:.2f}",
            f"{row['残差']:.4f}" if row["残差"] is not None else "-",
            styled,
            row["下一步处理人"] or "-",
        )
    console.print(table)

    if with_history:
        console.print()
        history_cmd.callback(import_id, None)


if __name__ == "__main__":
    cli()
