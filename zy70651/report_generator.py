import json
from datetime import date, datetime
from typing import Dict, Any
from models import AnalysisResult, MedicineBatch, TransferSuggestion, ExpiryLevel, FreezeStatus
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text


class ReportGenerator:
    def __init__(self):
        self.console = Console()
    
    def generate_json_report(self, result: AnalysisResult, output_path: str) -> None:
        report_data = self._build_report_dict(result)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2, default=self._json_serializer)
    
    def generate_console_report(self, result: AnalysisResult) -> None:
        self._print_summary(result)
        self._print_expiry_stats(result)
        self._print_freeze_stats(result)
        self._print_problem_batches(result)
        self._print_transfer_suggestions(result)
    
    def generate_text_report(self, result: AnalysisResult, output_path: str) -> None:
        lines = []
        lines.append("=" * 80)
        lines.append("药品效期冻结批次调拨建议排查报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"输入文件: {result.input_file}")
        lines.append("")
        
        lines.append("【一、总体统计】")
        lines.append(f"  总批次数: {result.total_batches}")
        lines.append(f"  有效批次: {result.valid_batches}")
        lines.append(f"  无效批次: {result.invalid_batches}")
        lines.append("")
        
        lines.append("【二、效期分布】")
        lines.append(f"  正常: {result.normal_count}")
        lines.append(f"  近效期: {result.near_expiry_count}")
        lines.append(f"  危急: {result.critical_count}")
        lines.append(f"  已过期: {result.expired_count}")
        lines.append("")
        
        lines.append("【三、冻结状态】")
        lines.append(f"  已冻结: {result.frozen_count}")
        lines.append(f"  待审核: {result.pending_freeze_count}")
        lines.append("")
        
        lines.append("【四、问题批次明细】")
        if result.problem_batches:
            for i, batch in enumerate(result.problem_batches, 1):
                lines.append(f"  {i}. {batch.medicine_name} ({batch.batch_no})")
                lines.append(f"     门店: {batch.store_name}, 数量: {batch.quantity}")
                lines.append(f"     效期: {batch.expiry_date} ({batch.expiry_days}天)")
                lines.append(f"     状态: {batch.expiry_level.value} | {batch.freeze_status.value}")
                if batch.issues:
                    lines.append(f"     问题: {'; '.join(batch.issues)}")
                lines.append("")
        else:
            lines.append("  无问题批次")
            lines.append("")
        
        lines.append("【五、调拨建议】")
        if result.transfer_suggestions:
            for i, sugg in enumerate(result.transfer_suggestions, 1):
                lines.append(f"  {i}. {sugg.medicine_name} ({sugg.batch_no})")
                lines.append(f"     {sugg.source_store} → {sugg.target_store}")
                lines.append(f"     调拨数量: {sugg.quantity}")
                lines.append(f"     效期: {sugg.expiry_date} ({sugg.expiry_days}天)")
                lines.append(f"     原因: {sugg.reason}")
                lines.append("")
        else:
            lines.append("  无调拨建议")
            lines.append("")
        
        lines.append("【六、数据一致性校验】")
        total = result.normal_count + result.near_expiry_count + result.critical_count + result.expired_count
        lines.append(f"  效期统计校验: {'PASS' if total == result.valid_batches else 'FAIL'} ({total}/{result.valid_batches})")
        lines.append(f"  问题批次数量: {len(result.problem_batches)}")
        lines.append(f"  调拨建议数量: {len(result.transfer_suggestions)}")
        lines.append("")
        lines.append("=" * 80)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    
    def _build_report_dict(self, result: AnalysisResult) -> Dict[str, Any]:
        return {
            "report_info": {
                "generated_at": result.report_generated_at,
                "input_file": result.input_file,
                "generated_by": "药品效期排查CLI"
            },
            "summary": {
                "total_batches": result.total_batches,
                "valid_batches": result.valid_batches,
                "invalid_batches": result.invalid_batches
            },
            "expiry_distribution": {
                "normal": result.normal_count,
                "near_expiry": result.near_expiry_count,
                "critical": result.critical_count,
                "expired": result.expired_count
            },
            "freeze_distribution": {
                "frozen": result.frozen_count,
                "pending": result.pending_freeze_count,
                "not_frozen": result.valid_batches - result.frozen_count - result.pending_freeze_count
            },
            "problem_batches": [self._batch_to_dict(b) for b in result.problem_batches],
            "transfer_suggestions": [self._suggestion_to_dict(s) for s in result.transfer_suggestions],
            "validation": {
                "expiry_count_match": (result.normal_count + result.near_expiry_count + 
                                       result.critical_count + result.expired_count) == result.valid_batches
            }
        }
    
    def _batch_to_dict(self, batch: MedicineBatch) -> Dict[str, Any]:
        return {
            "batch_no": batch.batch_no,
            "medicine_name": batch.medicine_name,
            "store_name": batch.store_name,
            "quantity": batch.quantity,
            "expiry_date": batch.expiry_date,
            "expiry_days": batch.expiry_days,
            "expiry_level": batch.expiry_level.value if batch.expiry_level else None,
            "freeze_status": batch.freeze_status.value,
            "issues": batch.issues
        }
    
    def _suggestion_to_dict(self, sugg: TransferSuggestion) -> Dict[str, Any]:
        return {
            "source_store": sugg.source_store,
            "target_store": sugg.target_store,
            "medicine_name": sugg.medicine_name,
            "batch_no": sugg.batch_no,
            "quantity": sugg.quantity,
            "expiry_date": sugg.expiry_date,
            "expiry_days": sugg.expiry_days,
            "reason": sugg.reason
        }
    
    def _json_serializer(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")
    
    def _print_summary(self, result: AnalysisResult) -> None:
        title = Text("药品效期冻结批次调拨建议排查报告", style="bold blue")
        self.console.print(Panel(title))
        
        table = Table(title="总体统计")
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="magenta")
        table.add_row("总批次数", str(result.total_batches))
        table.add_row("有效批次", str(result.valid_batches))
        table.add_row("无效批次", str(result.invalid_batches))
        self.console.print(table)
    
    def _print_expiry_stats(self, result: AnalysisResult) -> None:
        table = Table(title="效期分布")
        table.add_column("等级", style="cyan")
        table.add_column("数量", style="magenta")
        table.add_column("说明", style="dim")
        table.add_row("正常", str(result.normal_count), ">90天")
        table.add_row("近效期", str(result.near_expiry_count), "31-90天")
        table.add_row("危急", str(result.critical_count), "≤30天", style="yellow")
        table.add_row("已过期", str(result.expired_count), "<0天", style="red")
        self.console.print(table)
    
    def _print_freeze_stats(self, result: AnalysisResult) -> None:
        table = Table(title="冻结状态")
        table.add_column("状态", style="cyan")
        table.add_column("数量", style="magenta")
        table.add_row("已冻结", str(result.frozen_count), style="red")
        table.add_row("待审核", str(result.pending_freeze_count), style="yellow")
        self.console.print(table)
    
    def _print_problem_batches(self, result: AnalysisResult) -> None:
        if not result.problem_batches:
            self.console.print(Panel("无问题批次", style="green"))
            return
        
        table = Table(title=f"问题批次明细 ({len(result.problem_batches)})")
        table.add_column("序号", style="dim")
        table.add_column("药品名称", style="cyan")
        table.add_column("批号", style="magenta")
        table.add_column("门店")
        table.add_column("数量", justify="right")
        table.add_column("效期天数", justify="right")
        table.add_column("状态")
        
        for i, batch in enumerate(result.problem_batches, 1):
            status_style = "red" if batch.expiry_level in [ExpiryLevel.EXPIRED, ExpiryLevel.CRITICAL] or \
                                     batch.freeze_status == FreezeStatus.FROZEN else "yellow"
            table.add_row(
                str(i),
                batch.medicine_name,
                batch.batch_no,
                batch.store_name,
                str(batch.quantity),
                str(batch.expiry_days),
                f"{batch.expiry_level.value}|{batch.freeze_status.value}",
                style=status_style
            )
        
        self.console.print(table)
    
    def _print_transfer_suggestions(self, result: AnalysisResult) -> None:
        if not result.transfer_suggestions:
            self.console.print(Panel("无调拨建议", style="green"))
            return
        
        table = Table(title=f"调拨建议 ({len(result.transfer_suggestions)})")
        table.add_column("序号", style="dim")
        table.add_column("药品名称", style="cyan")
        table.add_column("源门店", style="magenta")
        table.add_column("目标门店", style="green")
        table.add_column("数量", justify="right")
        table.add_column("效期天数", justify="right")
        table.add_column("原因")
        
        for i, sugg in enumerate(result.transfer_suggestions, 1):
            style = "red" if sugg.expiry_days <= 30 else "yellow"
            table.add_row(
                str(i),
                sugg.medicine_name,
                sugg.source_store,
                sugg.target_store,
                str(sugg.quantity),
                str(sugg.expiry_days),
                sugg.reason,
                style=style
            )
        
        self.console.print(table)
