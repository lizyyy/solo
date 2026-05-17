from rich.console import Console as RichConsole
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from typing import List
from ..core.models import MappingResult, MatchType, HeaderMatch, BadRow


class ConsoleOutput:
    def __init__(self):
        self.console = RichConsole()
    
    def _get_match_color(self, match_type: MatchType) -> str:
        color_map = {
            MatchType.EXACT: "green",
            MatchType.SYNONYM: "cyan",
            MatchType.FUZZY: "yellow",
            MatchType.UNMATCHED: "red"
        }
        return color_map.get(match_type, "white")
    
    def _get_confidence_bar(self, confidence: float, width: int = 20) -> str:
        filled = int(confidence * width)
        bar = "█" * filled + "░" * (width - filled)
        return bar
    
    def print_summary(self, result: MappingResult) -> None:
        self.console.print()
        self.console.print(Panel.fit(
            f"[bold blue]表头映射报告[/bold blue]\n"
            f"文件: {result.file_path}\n"
            f"工作表: {result.sheet_name}\n"
            f"生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            title="电子表头映射CLI"
        ))
        self.console.print()
        
        stats_text = Text()
        stats_text.append(f"总列数: {result.total_columns}  |  ")
        stats_text.append(f"总行数: {result.total_rows}  |  ")
        stats_text.append(f"已匹配: ", style="white")
        stats_text.append(f"{result.matched_count}", style="green bold")
        stats_text.append(f"  |  未匹配: ", style="white")
        stats_text.append(f"{result.unmatched_count}", style="red bold")
        stats_text.append(f"  |  冲突: ", style="white")
        stats_text.append(f"{result.conflict_count}", style="yellow bold")
        self.console.print(stats_text)
        self.console.print()
        
        table = Table(title="表头映射详情")
        table.add_column("序号", justify="center", style="dim")
        table.add_column("原始表头", style="bold")
        table.add_column("标准字段", style="blue")
        table.add_column("匹配类型", style="bold")
        table.add_column("置信度")
        table.add_column("备注", style="red")
        
        for idx, match in enumerate(result.header_matches, 1):
            color = self._get_match_color(match.match_type)
            confidence_bar = self._get_confidence_bar(match.confidence)
            
            note = ""
            if match.conflict:
                note = f"⚠️  冲突: {', '.join(match.conflict_with)}"
            elif match.match_type == MatchType.UNMATCHED:
                note = "❌ 无法映射"
            
            table.add_row(
                str(idx),
                match.original_header,
                match.standard_field or "-",
                Text(match.match_type.value, style=color),
                f"{confidence_bar} {match.confidence:.1%}",
                note
            )
        
        self.console.print(table)
        self.console.print()
        
        if result.bad_rows:
            bad_table = Table(title=f"异常行检测 ({len(result.bad_rows)} 行)")
            bad_table.add_column("行号", justify="center", style="red bold")
            bad_table.add_column("原因", style="yellow")
            bad_table.add_column("样本数据", style="dim")
            
            for bad_row in result.bad_rows[:20]:
                sample = ", ".join(f"{k}:{v}" for k, v in list(bad_row.sample_data.items())[:3])
                bad_table.add_row(
                    str(bad_row.row_index),
                    bad_row.reason,
                    sample or "-"
                )
            
            if len(result.bad_rows) > 20:
                bad_table.add_row("...", f"还有 {len(result.bad_rows) - 20} 行未显示", "...")
            
            self.console.print(bad_table)
            self.console.print()
        
        self._print_conclusion(result)
    
    def _print_conclusion(self, result: MappingResult) -> None:
        if result.unmatched_count == 0 and result.conflict_count == 0 and len(result.bad_rows) == 0:
            self.console.print(Panel.fit(
                "[bold green]✅ 映射成功！所有表头都已匹配，无冲突。[/bold green]",
                border_style="green"
            ))
        elif result.conflict_count > 0:
            self.console.print(Panel.fit(
                "[bold yellow]⚠️  需要注意：存在映射冲突，请人工确认！[/bold yellow]",
                border_style="yellow"
            ))
        elif result.unmatched_count > 0:
            self.console.print(Panel.fit(
                f"[bold orange]⚠️  有 {result.unmatched_count} 列表头无法映射，需要人工处理[/bold orange]",
                border_style="orange1"
            ))
        self.console.print()
