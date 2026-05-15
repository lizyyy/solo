import click
import json
import sys
import os
from pathlib import Path

from .processor import FinanceProcessor
from .storage import Storage
from .exceptions import FinanceCarrierException
from .constants import ExitCode, ProcessingStatus


@click.group()
@click.version_option(version="1.0.0")
def main():
    """财务结转表处理命令行工具 - Finance Carrier"""
    pass


@main.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--processor", "-p", default="system", help="处理人名称")
@click.option("--basis", "-b", default="自动处理", help="处理依据")
@click.option("--output-format", "-o", type=click.Choice(["json", "table"]), default="table")
def process(file_path, processor, basis, output_format):
    """处理财务结转表文件
    
    FILE_PATH: 财务数据文件路径 (支持 .xlsx 或 .csv)
    """
    try:
        click.echo(f"正在处理文件: {file_path}")
        click.echo(f"处理人: {processor}")
        click.echo(f"处理依据: {basis}")
        
        processor_obj = FinanceProcessor()
        success, failed = processor_obj.process_file(file_path, processor, basis)
        
        result = {
            "exit_code": ExitCode.SUCCESS,
            "success_count": len(success),
            "failed_count": len(failed),
            "success_records": success,
            "failed_records": failed,
        }

        if failed:
            result["exit_code"] = ExitCode.BATCH_CONFLICT if any(
                "批次号冲突" in f.get("error", "") for f in failed
            ) else ExitCode.VALIDATION_ERROR

        if output_format == "json":
            click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            click.echo("\n" + "=" * 60)
            click.echo(f"处理完成: 成功 {len(success)} 条, 失败 {len(failed)} 条")
            click.echo("=" * 60)
            
            if success:
                click.echo("\n成功记录:")
                for record in success:
                    click.echo(f"  ✓ {record['batch_no']}")
            
            if failed:
                click.echo("\n失败记录:")
                for record in failed:
                    click.echo(f"  ✗ {record['batch_no']}: {record['error']}")

        sys.exit(result["exit_code"])

    except FinanceCarrierException as e:
        click.echo(json.dumps(e.to_dict(), ensure_ascii=False, indent=2), err=True)
        sys.exit(e.exit_code)
    except Exception as e:
        error = {
            "error": "UnexpectedError",
            "message": str(e),
            "exit_code": ExitCode.GENERAL_ERROR,
        }
        click.echo(json.dumps(error, ensure_ascii=False, indent=2), err=True)
        sys.exit(ExitCode.GENERAL_ERROR)


@main.command()
@click.option("--status", "-s", type=click.Choice(["all", "success", "failed", "rollback", "conflict"]), default="all", help="按状态筛选")
@click.option("--processor", "-p", help="按处理人筛选")
@click.option("--batch-no", "-b", help="按批次号筛选")
@click.option("--show-input/--no-show-input", default=False, help="显示原始输入数据")
def query(status, processor, batch_no, show_input):
    """统一查询处理记录（成功/异常路径）"""
    try:
        processor_obj = FinanceProcessor()
        logs = processor_obj.query_records(status, processor, batch_no)

        if not logs:
            click.echo("未找到匹配的处理记录")
            sys.exit(ExitCode.SUCCESS)

        click.echo(f"\n找到 {len(logs)} 条处理记录:\n")
        for i, log in enumerate(logs, 1):
            click.echo(f"[{i}] 批次号: {log['batch_no']}")
            click.echo(f"    来源系统: {log['source_system']}")
            click.echo(f"    处理状态: {log['status']}")
            click.echo(f"    处理人: {log['processor']}")
            click.echo(f"    处理时间: {log['created_at']}")
            if log.get("error_message"):
                click.echo(f"    错误信息: {log['error_message']}")
            if show_input:
                click.echo(f"    原始输入: {json.dumps(log['input_data'], ensure_ascii=False)}")
            click.echo()

    except FinanceCarrierException as e:
        click.echo(json.dumps(e.to_dict(), ensure_ascii=False, indent=2), err=True)
        sys.exit(e.exit_code)


@main.command()
@click.option("--generate-candidates", "-g", is_flag=True, help="生成回滚候选清单")
@click.option("--date-cutoff", "-d", help="日期截止点 (YYYY-MM-DD)")
@click.option("--confirm", "-c", is_flag=True, help="确认执行回滚")
@click.option("--candidates-file", "-f", type=click.Path(exists=True), help="候选清单文件")
def rollback(generate_candidates, date_cutoff, confirm, candidates_file):
    """回滚处理 - 先生成候选清单，确认后执行"""
    try:
        processor_obj = FinanceProcessor()

        if generate_candidates:
            candidates = processor_obj.generate_candidates("rollback", date_cutoff)
            
            click.echo(f"\n生成回滚候选清单，共 {len(candidates)} 条记录:\n")
            for i, candidate in enumerate(candidates, 1):
                click.echo(f"[{i}] 批次号: {candidate['batch_no']}")
                click.echo(f"    来源系统: {candidate['source_system']}")
                click.echo(f"    操作: {candidate['action']}")
                click.echo(f"    原因: {candidate['reason']}\n")

            candidates_file_path = Path("./data/rollback_candidates.json")
            candidates_file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(candidates_file_path, "w", encoding="utf-8") as f:
                json.dump(candidates, f, ensure_ascii=False, indent=2)
            
            click.echo(f"候选清单已保存至: {candidates_file_path}")
            click.echo("请检查清单确认无误后，使用 --confirm 执行回滚")
            sys.exit(ExitCode.SUCCESS)

        if confirm:
            if candidates_file:
                with open(candidates_file, "r", encoding="utf-8") as f:
                    candidates = json.load(f)
            else:
                default_candidates = Path("./data/rollback_candidates.json")
                if not default_candidates.exists():
                    click.echo("错误: 请先生成候选清单 (--generate-candidates) 或指定候选文件 (--candidates-file)", err=True)
                    sys.exit(ExitCode.EMPTY_CANDIDATES)
                with open(default_candidates, "r", encoding="utf-8") as f:
                    candidates = json.load(f)

            click.echo(f"即将回滚 {len(candidates)} 条记录...")
            result = processor_obj.execute_rollback(candidates)
            
            click.echo(f"\n回滚完成: 成功 {len(result['success'])} 条, 失败 {len(result['failed'])} 条")
            
            if result["failed"]:
                click.echo("\n失败记录:")
                for f in result["failed"]:
                    click.echo(f"  {f['batch_no']}: {f['error']}")
            
            sys.exit(ExitCode.SUCCESS if not result["failed"] else ExitCode.GENERAL_ERROR)

        click.echo("请使用 --generate-candidates 生成候选清单，或 --confirm 执行回滚")
        sys.exit(ExitCode.SUCCESS)

    except FinanceCarrierException as e:
        click.echo(json.dumps(e.to_dict(), ensure_ascii=False, indent=2), err=True)
        sys.exit(e.exit_code)


@main.command()
@click.argument("processor_name")
@click.option("--show-receipt/--no-show-receipt", default=True, help="显示药房配送回执信息")
def trace(processor_name, show_receipt):
    """通过处理人追踪原始输入和处理依据"""
    try:
        processor_obj = FinanceProcessor()
        logs = processor_obj.find_by_processor(processor_name)

        click.echo(f"\n找到处理人 '{processor_name}' 的 {len(logs)} 条处理记录:\n")
        
        for i, log in enumerate(logs, 1):
            click.echo(f"[{i}] 批次号: {log['batch_no']}")
            click.echo(f"    来源系统: {log['source_system']}")
            click.echo(f"    处理状态: {log['status']}")
            click.echo(f"    处理依据: {log.get('processing_basis', 'N/A')}")
            click.echo(f"    处理时间: {log['created_at']}")
            
            if show_receipt and log.get("pharmacy_receipt_id"):
                click.echo(f"    药房配送回执ID: {log['pharmacy_receipt_id']}")
                receipt_trace = processor_obj.get_pharmacy_receipt_trace(log["pharmacy_receipt_id"])
                if receipt_trace["found"]:
                    click.echo(f"    原始输入数据: {json.dumps(receipt_trace['original_input'], ensure_ascii=False)}")
            
            if log.get("error_message"):
                click.echo(f"    错误信息: {log['error_message']}")
                click.echo(f"    错误详情: {json.dumps(log.get('error_details', {}), ensure_ascii=False)}")
            click.echo()

    except FinanceCarrierException as e:
        click.echo(json.dumps(e.to_dict(), ensure_ascii=False, indent=2), err=True)
        sys.exit(e.exit_code)


@main.command()
@click.argument("receipt_id")
def receipt(receipt_id):
    """查询药房配送回执的完整处理链路"""
    try:
        processor_obj = FinanceProcessor()
        trace_data = processor_obj.get_pharmacy_receipt_trace(receipt_id)

        click.echo(json.dumps(trace_data, ensure_ascii=False, indent=2))

    except FinanceCarrierException as e:
        click.echo(json.dumps(e.to_dict(), ensure_ascii=False, indent=2), err=True)
        sys.exit(e.exit_code)


if __name__ == "__main__":
    main()
