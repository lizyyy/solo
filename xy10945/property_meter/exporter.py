import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import pandas as pd
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .models import ProcessingResult, MeterRecord, ValidationError, ErrorType


class ResultExporter:
    def __init__(self, result: ProcessingResult, output_dir: str):
        self.result = result
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.console = Console()
    
    def export_all(self) -> Dict[str, str]:
        outputs = {}
        
        outputs["terminal"] = self._print_terminal_summary()
        outputs["json"] = self._export_json()
        outputs["report"] = self._export_excel_report()
        
        return outputs
    
    def _print_terminal_summary(self) -> str:
        self.console.print("\n")
        self.console.print(Panel.fit(
            "[bold blue]物业水电抄表数据处理结果[/bold blue]",
            border_style="blue"
        ))
        
        summary_table = Table(title="处理概览", show_header=True, header_style="bold magenta")
        summary_table.add_column("项目", style="cyan")
        summary_table.add_column("数量", justify="right")
        
        summary_table.add_row("总记录数", str(self.result.total_records))
        summary_table.add_row("有效记录", f"[green]{len(self.result.valid_records)}[/green]")
        summary_table.add_row("异常用量", f"[yellow]{len(self.result.abnormal_records)}[/yellow]")
        summary_table.add_row("错误记录", f"[red]{len(self.result.invalid_records) - len(self.result.abnormal_records)}[/red]")
        summary_table.add_row("缺表记录", f"[yellow]{len(self.result.missing_meters)}[/yellow]")
        summary_table.add_row("总用水量(吨)", f"{self.result.total_usage_water:.2f}")
        summary_table.add_row("总用电量(度)", f"{self.result.total_usage_electric:.2f}")
        
        self.console.print(summary_table)
        
        if self.result.invalid_records:
            error_table = Table(
                title="错误/异常明细 (保留原始行号)",
                show_header=True,
                header_style="bold red"
            )
            error_table.add_column("行号", justify="right")
            error_table.add_column("错误类型", style="yellow")
            error_table.add_column("字段", style="cyan")
            error_table.add_column("错误信息")
            
            for error in sorted(self.result.invalid_records, key=lambda x: x.row_number):
                style = "yellow" if error.error_type == ErrorType.ABNORMAL_USAGE else "red"
                error_table.add_row(
                    str(error.row_number),
                    f"[{style}]{error.error_type.value}[/{style}]",
                    error.field_name or "-",
                    error.message
                )
            
            self.console.print(error_table)
        
        if self.result.missing_meters:
            missing_table = Table(
                title="缺表记录",
                show_header=True,
                header_style="bold yellow"
            )
            missing_table.add_column("表号", style="cyan")
            missing_table.add_column("状态")
            
            for item in self.result.missing_meters:
                missing_table.add_row(item["表号"], item["状态"])
            
            self.console.print(missing_table)
        
        self.console.print(f"\n[dim]输入文件: {self.result.input_file}[/dim]")
        self.console.print(f"[dim]处理时间: {self.result.processed_at.strftime('%Y-%m-%d %H:%M:%S')}[/dim]")
        self.console.print(f"[dim]输出目录: {self.output_dir.resolve()}[/dim]\n")
        
        return "terminal_summary_printed"
    
    def _export_json(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"meter_results_{timestamp}.json"
        filepath = self.output_dir / filename
        
        data = {
            "metadata": {
                "input_file": self.result.input_file,
                "processed_at": self.result.processed_at.isoformat(),
                "total_records": self.result.total_records,
            },
            "summary": {
                "valid_count": len(self.result.valid_records),
                "invalid_count": len(self.result.invalid_records),
                "abnormal_count": len(self.result.abnormal_records),
                "missing_meter_count": len(self.result.missing_meters),
                "total_usage_water": self.result.total_usage_water,
                "total_usage_electric": self.result.total_usage_electric,
            },
            "valid_records": [
                self._record_to_dict(r)
                for r in sorted(self.result.valid_records, key=lambda x: x.row_number)
            ],
            "invalid_records": [
                self._error_to_dict(e)
                for e in sorted(self.result.invalid_records, key=lambda x: x.row_number)
            ],
            "missing_meters": self.result.missing_meters,
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
    
    def _export_excel_report(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"抄表处理报告_{timestamp}.xlsx"
        filepath = self.output_dir / filename
        
        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            self._write_summary_sheet(writer)
            self._write_valid_records_sheet(writer)
            self._write_abnormal_records_sheet(writer)
            self._write_errors_sheet(writer)
            if self.result.missing_meters:
                self._write_missing_meters_sheet(writer)
        
        return str(filepath)
    
    def _write_summary_sheet(self, writer):
        summary_data = {
            "项目": [
                "总记录数",
                "有效记录数",
                "异常用量记录",
                "错误记录数",
                "缺表记录数",
                "总用水量(吨)",
                "总用电量(度)",
                "输入文件",
                "处理时间",
            ],
            "数值": [
                self.result.total_records,
                len(self.result.valid_records),
                len(self.result.abnormal_records),
                len(self.result.invalid_records),
                len(self.result.missing_meters),
                round(self.result.total_usage_water, 2),
                round(self.result.total_usage_electric, 2),
                self.result.input_file,
                self.result.processed_at.strftime("%Y-%m-%d %H:%M:%S"),
            ],
        }
        df = pd.DataFrame(summary_data)
        df.to_excel(writer, sheet_name="汇总", index=False)
    
    def _write_valid_records_sheet(self, writer):
        data = []
        for r in sorted(self.result.valid_records, key=lambda x: x.row_number):
            data.append({
                "原始行号": r.row_number,
                "住户": r.household,
                "表号": r.meter_number,
                "表类型": r.meter_type.value,
                "上月读数": r.previous_reading,
                "本月读数": r.current_reading,
                "倍率": r.multiplier,
                "实际用量": round(r.usage, 2) if r.usage else None,
            })
        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="有效记录", index=False)
    
    def _write_abnormal_records_sheet(self, writer):
        data = []
        for r in sorted(self.result.abnormal_records, key=lambda x: x.row_number):
            data.append({
                "原始行号": r.row_number,
                "住户": r.household,
                "表号": r.meter_number,
                "上月读数": r.previous_reading,
                "本月读数": r.current_reading,
                "倍率": r.multiplier,
                "实际用量": round(r.usage, 2) if r.usage else None,
                "异常原因": "用量偏离平均值超过阈值",
            })
        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="异常用量", index=False)
    
    def _write_errors_sheet(self, writer):
        data = []
        for e in sorted(self.result.invalid_records, key=lambda x: x.row_number):
            data.append({
                "原始行号": e.row_number,
                "错误类型": e.error_type.value,
                "错误字段": e.field_name or "-",
                "错误信息": e.message,
                "原始数据": json.dumps(e.raw_data, ensure_ascii=False),
            })
        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="错误记录", index=False)
    
    def _write_missing_meters_sheet(self, writer):
        df = pd.DataFrame(self.result.missing_meters)
        df.to_excel(writer, sheet_name="缺表记录", index=False)
    
    def _record_to_dict(self, record: MeterRecord) -> Dict[str, Any]:
        return {
            "row_number": record.row_number,
            "household": record.household,
            "meter_number": record.meter_number,
            "meter_type": record.meter_type.value,
            "previous_reading": record.previous_reading,
            "current_reading": record.current_reading,
            "multiplier": record.multiplier,
            "usage": record.usage,
        }
    
    def _error_to_dict(self, error: ValidationError) -> Dict[str, Any]:
        return {
            "row_number": error.row_number,
            "error_type": error.error_type.value,
            "field_name": error.field_name,
            "message": error.message,
            "raw_data": error.raw_data,
        }
