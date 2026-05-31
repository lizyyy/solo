import click
import sys
from pathlib import Path
from typing import Optional

from config import INPUT_DIR, OUTPUT_DIR, SAMPLES_DIR
from __init__ import __app_name__, __version__
from core import SupplementManager
from reconciliation_report import ReconciliationReportGenerator
from storage import get_or_create_manager, save_manager, clear_storage
from errors import (
    FriendlyError,
    show_success,
    show_info,
    show_warning
)

manager = get_or_create_manager()


@click.group(invoke_without_command=True)
@click.version_option(version=__version__, prog_name=__app_name__)
@click.pass_context
def cli(ctx: click.Context) -> None:
    """
    跨平台退款补单系统 - 帮助财务同事高效处理跨平台退款补单对账
    
    常用操作流程：
    1. 导入对账单   →  refund import-reconciliation <文件>
    2. 导入退款流水 →  refund import-refund <文件>
    3. 自动匹配补单 →  refund match
    4. 查看状态     →  refund status
    5. 确认/修改    →  refund confirm / modify
    6. 导出对账说明 →  refund report
    """
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@cli.command("import-reconciliation")
@click.argument("filepath", type=click.Path(exists=True, dir_okay=False))
def import_reconciliation(filepath: str) -> None:
    """导入对账单文件（Excel或CSV格式）"""
    try:
        new_count, dup_count = manager.import_reconciliation(filepath)
        save_manager(manager)
        show_success(
            f"成功导入对账单文件：{Path(filepath).name}",
            {
                "新增记录数": new_count,
                "跳过重复记录数": dup_count,
                "当前对账单总数": len(manager.reconciliation_records)
            }
        )
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("import-refund")
@click.argument("filepath", type=click.Path(exists=True, dir_okay=False))
def import_refund(filepath: str) -> None:
    """导入退款流水文件（Excel或CSV格式）"""
    try:
        new_count, dup_count = manager.import_refund_flow(filepath)
        save_manager(manager)
        show_success(
            f"成功导入退款流水文件：{Path(filepath).name}",
            {
                "新增记录数": new_count,
                "跳过重复记录数": dup_count,
                "当前退款流水总数": len(manager.refund_flow_records)
            }
        )
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("match")
@click.option("--no-strict", is_flag=True, help="不严格校验金额匹配")
def match_supplements(no_strict: bool) -> None:
    """自动匹配对账单和退款流水，生成补单记录"""
    try:
        matched, mismatch, mismatched_ids = manager.match_supplements(strict_match=not no_strict)
        total = matched + mismatch
        details = {
            "匹配成功（金额一致）": matched,
            "金额不匹配待核实": mismatch,
            "总计生成补单记录": total
        }
        if mismatched_ids:
            details["金额不匹配的退款流水号"] = ", ".join(mismatched_ids[:5])
            if len(mismatched_ids) > 5:
                details["金额不匹配的退款流水号"] += f" 等{len(mismatched_ids)}条"
        
        show_success(
            "自动匹配完成",
            details
        )
        
        save_manager(manager)
        if mismatch > 0:
            show_warning(
                f"有 {mismatch} 条记录金额不匹配，需要人工核实处理。",
                "可以使用 `refund list --status 待补录` 查看这些记录。"
            )
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("status")
def show_status() -> None:
    """查看当前补单处理进度和统计信息"""
    try:
        stats = manager.get_statistics()
        reporter = ReconciliationReportGenerator(manager)
        reporter.print_summary()
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("list")
@click.option("--status", "status_filter", help="按状态筛选：待补录/已确认/人工修改/已撤回")
@click.option("--platform", help="按支付平台筛选：支付宝/微信/银行卡 等")
@click.option("--filter", "custom_filter", help="自定义筛选条件，如：补单金额>100,对账单_支付平台=支付宝")
@click.option("--include-revoked", is_flag=True, help="包含已撤回的记录")
@click.option("--limit", type=int, default=20, help="显示记录数量，默认20条")
def list_records(status_filter: Optional[str], platform: Optional[str], 
                custom_filter: Optional[str], include_revoked: bool, limit: int) -> None:
    """查看补单记录列表，支持筛选"""
    try:
        filter_conditions = []
        
        if status_filter:
            filter_conditions.append(f"补单状态={status_filter}")
        
        if platform:
            filter_conditions.append(f"对账单_支付平台={platform}")
        
        if custom_filter:
            filter_conditions.append(custom_filter)
        
        final_filter = ",".join(filter_conditions)
        
        if final_filter:
            records = manager.filter_supplements(final_filter, include_revoked)
        else:
            from config import SUPPLEMENT_STATUS
            records = [r for r in manager.supplement_records.values() 
                      if include_revoked or r.补单状态 != SUPPLEMENT_STATUS["REVOKED"]]
        
        if not records:
            show_info("没有找到符合条件的记录。", "提示")
            return
        
        df = manager.get_supplements_dataframe(records, include_revoked)
        display_df = df.head(limit)
        
        from rich.console import Console
        from rich.table import Table
        
        console = Console()
        table = Table(title=f"补单记录（共{len(records)}条，显示前{limit}条）", 
                     show_lines=False, header_style="bold cyan")
        
        display_cols = ["补单编号", "补单状态", "原交易流水号", "补单金额", 
                       "对账单_支付平台", "处理口径"]
        for col in display_cols:
            if col in display_df.columns:
                table.add_column(col, overflow="fold")
        
        for _, row in display_df.iterrows():
            row_data = [str(row.get(col, "")) for col in display_cols if col in display_df.columns]
            table.add_row(*row_data)
        
        console.print(table)
        
        if len(records) > limit:
            show_info(f"仅显示前 {limit} 条，共 {len(records)} 条记录。", "提示")
            
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("confirm")
@click.argument("supplement_ids", nargs=-1, required=True)
@click.option("--operator", help="操作人姓名")
def confirm_supplement(supplement_ids: tuple, operator: Optional[str]) -> None:
    """确认一条或多条补单记录，多个编号用空格分隔"""
    try:
        if len(supplement_ids) == 1:
            manager.confirm_supplement(supplement_ids[0], operator)
            save_manager(manager)
            show_success(
                f"已确认补单：{supplement_ids[0]}",
                {"操作人": operator or "系统"}
            )
        else:
            success, failed = manager.batch_confirm(list(supplement_ids), operator)
            save_manager(manager)
            show_success(
                f"批量确认完成",
                {
                    "成功确认": success,
                    "确认失败": len(failed),
                    "失败的编号": ", ".join(failed) if failed else "无"
                }
            )
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("modify")
@click.argument("supplement_id")
@click.option("--amount", type=float, help="修改补单金额")
@click.option("--remark", "补单说明", help="修改补单说明")
@click.option("--criteria", "处理口径", help="修改处理口径")
@click.option("--operator", help="操作人姓名")
def modify_supplement(supplement_id: str, amount: Optional[float], 
                     补单说明: Optional[str], 处理口径: Optional[str], 
                     operator: Optional[str]) -> None:
    """人工修改补单记录的金额、说明或处理口径"""
    try:
        modifications = {}
        if amount is not None:
            modifications["补单金额"] = amount
        if 补单说明:
            modifications["补单说明"] = 补单说明
        if 处理口径:
            modifications["处理口径"] = 处理口径
        
        if not modifications:
            show_warning("没有指定要修改的内容。", 
                        "请使用 --amount、--remark 或 --criteria 指定要修改的字段。")
            return
        
        manager.modify_supplement(supplement_id, modifications, operator)
        save_manager(manager)
        show_success(
            f"已修改补单：{supplement_id}",
            {
                "修改字段": ", ".join(modifications.keys()),
                "操作人": operator or "系统"
            }
        )
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("revoke")
@click.argument("supplement_ids", nargs=-1, required=True)
@click.option("--operator", help="操作人姓名")
def revoke_supplement(supplement_ids: tuple, operator: Optional[str]) -> None:
    """撤回一条或多条补单记录，多个编号用空格分隔"""
    try:
        if len(supplement_ids) == 1:
            manager.revoke_supplement(supplement_ids[0], operator)
            save_manager(manager)
            show_success(
                f"已撤回补单：{supplement_ids[0]}",
                {"操作人": operator or "系统"}
            )
        else:
            success, failed = manager.batch_revoke(list(supplement_ids), operator)
            save_manager(manager)
            show_success(
                f"批量撤回完成",
                {
                    "成功撤回": success,
                    "撤回失败": len(failed),
                    "失败的编号": ", ".join(failed) if failed else "无"
                }
            )
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("export")
@click.option("--output", "output_path", help="导出文件路径，默认在 data/output/ 目录")
@click.option("--format", "export_format", type=click.Choice(["xlsx", "csv"]), 
              default="xlsx", help="导出格式，默认 xlsx")
@click.option("--filter", "custom_filter", help="筛选后导出，如：补单状态=已确认")
@click.option("--include-revoked", is_flag=True, help="包含已撤回的记录")
def export_supplements(output_path: Optional[str], export_format: str, 
                      custom_filter: Optional[str], include_revoked: bool) -> None:
    """导出补单记录为Excel或CSV文件"""
    try:
        records = None
        if custom_filter:
            records = manager.filter_supplements(custom_filter, include_revoked)
            if not records:
                show_warning("筛选后没有可导出的记录。")
                return
        
        if output_path is None:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = OUTPUT_DIR / f"补单记录_{timestamp}.{export_format}"
        
        result_path = manager.export_supplements(
            str(output_path), records, include_revoked, export_format
        )
        show_success(
            f"导出成功",
            {
                "文件路径": result_path,
                "文件格式": export_format,
                "记录数": len(records) if records else len(manager.supplement_records)
            }
        )
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("report")
@click.option("--output", "output_path", help="对账说明输出路径")
@click.option("--hanging-account", is_flag=True, help="只导出退款挂账明细")
def generate_report(output_path: Optional[str], hanging_account: bool) -> None:
    """生成财务对账说明Excel文件，给财务主管看"""
    try:
        reporter = ReconciliationReportGenerator(manager)
        
        if hanging_account:
            result_path = reporter.generate_hanging_account_report(output_path)
            if result_path:
                show_success(
                    "退款挂账明细已生成",
                    {"文件路径": result_path}
                )
        else:
            result_path = reporter.generate_detailed_report(output_path)
            show_success(
                "对账说明已生成",
                {
                    "文件路径": result_path,
                    "包含工作表": "汇总概览、已确认记录、待补录记录、人工修改记录、操作日志、工作表说明、复核清单"
                }
            )
            show_info(
                "导出前请务必完成复核清单中的检查项！",
                "复核提醒"
            )
    except FriendlyError as e:
        e.show()
        sys.exit(1)


@cli.command("generate-samples")
def generate_samples() -> None:
    """生成对账单和退款流水的样例文件，放在 data/samples/ 目录"""
    import pandas as pd
    from datetime import datetime, timedelta
    
    try:
        reconciliation_data = []
        for i in range(1, 11):
            reconciliation_data.append({
                "交易流水号": f"T202405{i:02d}{1000+i}",
                "交易时间": (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d %H:%M:%S"),
                "交易金额": round(100 + i * 50.5, 2),
                "支付平台": ["支付宝", "微信支付", "银行卡"][i % 3],
                "商户订单号": f"ORD202405{i:02d}{i}",
                "用户账号": f"user{i:03d}@example.com",
                "商品名称": f"商品{chr(64+i)}",
                "备注": f"正常交易{i}" if i != 5 else "客户申请退款"
            })
        
        pd.DataFrame(reconciliation_data).to_excel(
            SAMPLES_DIR / "对账单样例.xlsx", index=False
        )
        
        refund_data = []
        for i in range(1, 8):
            refund_data.append({
                "退款流水号": f"R202405{i:02d}{2000+i}",
                "原交易流水号": f"T202405{i:02d}{1000+i}",
                "退款金额": round(100 + i * 50.5, 2) if i != 3 else round(100 + i * 50.5 - 10, 2),
                "退款时间": (datetime.now() - timedelta(days=i-1)).strftime("%Y-%m-%d %H:%M:%S"),
                "退款状态": "退款成功",
                "退款原因": ["质量问题", "不想要了", "价格差异", "商品损坏", "其他", "重复下单", "超时发货"][i-1],
                "操作人": "张会计",
                "备注": ""
            })
        
        pd.DataFrame(refund_data).to_excel(
            SAMPLES_DIR / "退款流水样例.xlsx", index=False
        )
        
        show_success(
            "样例文件已生成",
            {
                "对账单样例": str(SAMPLES_DIR / "对账单样例.xlsx"),
                "退款流水样例": str(SAMPLES_DIR / "退款流水样例.xlsx"),
                "使用方法": "将实际的对账单和退款流水文件放入 data/input/ 目录，然后执行导入命令"
            }
        )
        show_info(
            "对账单必填列：交易流水号、交易时间、交易金额、支付平台\n"
            "退款流水必填列：退款流水号、原交易流水号、退款金额、退款时间、退款状态",
            "文件格式要求"
        )
    except Exception as e:
        show_warning(f"生成样例文件失败：{str(e)}")


@cli.command("checklist")
def show_checklist() -> None:
    """显示导出对账说明前的复核清单"""
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    
    console = Console()
    
    title = Text("✅ 导出对账说明前复核清单", style="bold green", justify="center")
    console.print(Panel(title, border_style="green"))
    
    checklist = [
        ("1", "核对对账单导入总数与银行/平台提供的原始文件数量是否一致"),
        ("2", "核对退款流水导入总数与银行/平台退款明细数量是否一致"),
        ("3", "检查「已确认记录」中是否存在金额异常的情况（单笔金额过大/过小）"),
        ("4", "检查「人工修改记录」的修改原因是否充分、修改后金额是否合理"),
        ("5", "检查「待补录记录」是否均已安排人员跟进处理"),
        ("6", "确认无重复补单（同一原交易流水号仅对应一条有效补单记录）"),
        ("7", "确认所有「已确认记录」的处理口径均清晰明确"),
        ("8", "核对已确认总金额与财务系统中退款挂账金额是否一致"),
        ("9", "操作日志是否完整，关键操作（修改、撤回）均有记录"),
        ("10", "本次对账期间内的所有交易是否均已覆盖，无遗漏")
    ]
    
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("步骤", style="cyan", width=6)
    table.add_column("复核内容", overflow="fold")
    table.add_column("完成", width=6, justify="center")
    
    for step, content in checklist:
        table.add_row(step, content, "□")
    
    console.print(table)
    
    console.print("\n📍 复核完成后执行：`refund report` 生成对账说明")


@cli.command("clear")
@click.option("--yes", is_flag=True, help="直接清除，无需确认")
def clear_data(yes: bool) -> None:
    """清除所有已导入的数据，重新开始"""
    if not yes:
        click.confirm("⚠️  确定要清除所有已导入的数据吗？此操作不可恢复！", abort=True)
    
    clear_storage()
    global manager
    manager = SupplementManager()
    
    show_success(
        "已清除所有数据",
        {"提示": "现在可以重新导入新的对账单和退款流水"}
    )


if __name__ == "__main__":
    cli()
