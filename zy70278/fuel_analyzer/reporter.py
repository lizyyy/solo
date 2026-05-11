import pandas as pd
import os
from datetime import datetime
from typing import List, Dict, Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

console = Console()


class Reporter:
    """报告生成器"""
    
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def generate_console_report(
        self,
        df: pd.DataFrame,
        validation_result,
        fuel_analyses: List,
        anomalies: List,
        analysis_summary: Dict[str, Any]
    ):
        """生成控制台报告"""
        
        self._print_header()
        self._print_overview(df, validation_result, analysis_summary)
        self._print_validation_summary(validation_result)
        self._print_fuel_analysis_summary(fuel_analyses, analysis_summary)
        self._print_anomaly_summary(anomalies)
        self._print_detailed_anomalies(anomalies)
        self._print_calculation_methodology()
    
    def generate_excel_report(
        self,
        df: pd.DataFrame,
        validation_result,
        fuel_analyses: List,
        anomalies: List,
        analysis_summary: Dict[str, Any],
        filename: str = None
    ) -> str:
        """生成Excel报告"""
        
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"fuel_analysis_report_{timestamp}.xlsx"
        
        filepath = os.path.join(self.output_dir, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            self._write_overview_sheet(writer, df, validation_result, analysis_summary)
            self._write_validation_sheet(writer, validation_result)
            self._write_fuel_analysis_sheet(writer, fuel_analyses, df)
            self._write_anomalies_sheet(writer, anomalies)
            self._write_methodology_sheet(writer)
            self._write_raw_data_sheet(writer, df)
        
        console.print(f"\n[green]✓ Excel报告已生成: {filepath}[/green]")
        return filepath
    
    def generate_csv_reports(
        self,
        df: pd.DataFrame,
        validation_result,
        fuel_analyses: List,
        anomalies: List,
        prefix: str = None
    ) -> Dict[str, str]:
        """生成CSV报告文件"""
        
        if prefix is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            prefix = f"fuel_report_{timestamp}"
        
        files = {}
        
        analysis_df = self._fuel_analyses_to_df(fuel_analyses, df)
        analysis_path = os.path.join(self.output_dir, f"{prefix}_analysis.csv")
        analysis_df.to_csv(analysis_path, index=False, encoding='utf-8-sig')
        files['analysis'] = analysis_path
        
        anomalies_df = self._anomalies_to_df(anomalies)
        anomalies_path = os.path.join(self.output_dir, f"{prefix}_anomalies.csv")
        anomalies_df.to_csv(anomalies_path, index=False, encoding='utf-8-sig')
        files['anomalies'] = anomalies_path
        
        valid_path = os.path.join(self.output_dir, f"{prefix}_valid_data.csv")
        validation_result.valid_rows.to_csv(valid_path, index=False, encoding='utf-8-sig')
        files['valid_data'] = valid_path
        
        if not validation_result.invalid_rows.empty:
            invalid_path = os.path.join(self.output_dir, f"{prefix}_invalid_data.csv")
            validation_result.invalid_rows.to_csv(invalid_path, index=False, encoding='utf-8-sig')
            files['invalid_data'] = invalid_path
        
        console.print(f"\n[green]✓ CSV报告已生成到: {self.output_dir}[/green]")
        return files
    
    def _print_header(self):
        title = Text("环卫车辆油耗异常分析报告", style="bold blue", justify="center")
        subtitle = Text(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", 
                       style="dim", justify="center")
        console.print(Panel(Text.assemble(title, "\n", subtitle), 
                          border_style="blue"))
    
    def _print_overview(self, df: pd.DataFrame, validation_result, summary: Dict[str, Any]):
        table = Table(title="数据概览", border_style="cyan")
        table.add_column("指标", style="bold")
        table.add_column("数值", justify="right")
        table.add_column("说明", style="dim")
        
        table.add_row("总记录数", str(len(df)), "原始数据行数")
        table.add_row("有效记录数", str(len(validation_result.valid_rows)), 
                     f"剔除重复和无效数据后")
        table.add_row("重复记录", str(len(validation_result.duplicate_records)), 
                     "需要删除")
        table.add_row("缺失字段", str(len(validation_result.missing_column_records)), 
                     "需要补充")
        table.add_row("异常记录", str(summary.get('anomaly_count', 0)), 
                     "油耗相关异常")
        table.add_row("异常率", f"{summary.get('anomaly_rate', 0):.1f}%", 
                     "异常记录占比")
        
        console.print(table)
    
    def _print_validation_summary(self, validation_result):
        if validation_result.total_issues == 0:
            console.print("\n[green]✓ 数据校验通过，无数据质量问题[/green]")
            return
        
        table = Table(title="数据质量问题", border_style="yellow")
        table.add_column("问题类型", style="bold")
        table.add_column("数量", justify="right")
        table.add_column("严重程度", justify="center")
        
        if validation_result.duplicate_records:
            table.add_row("重复数据", str(len(validation_result.duplicate_records)), 
                         "[red]高[/red]")
        
        if validation_result.missing_column_records:
            table.add_row("缺失字段", str(len(validation_result.missing_column_records)), 
                         "[orange]中[/orange]")
        
        if validation_result.negative_value_records:
            table.add_row("异常负值", str(len(validation_result.negative_value_records)), 
                         "[red]高[/red]")
        
        console.print(table)
    
    def _print_fuel_analysis_summary(self, analyses: List, summary: Dict[str, Any]):
        table = Table(title="油耗分析统计", border_style="green")
        table.add_column("统计指标", style="bold")
        table.add_column("数值", justify="right")
        
        table.add_row("平均油耗偏差", f"{summary.get('avg_fuel_deviation_percent', 0):.2f}%")
        table.add_row("最大油耗偏差", f"{summary.get('max_fuel_deviation_percent', 0):.2f}%")
        table.add_row("最小油耗偏差", f"{summary.get('min_fuel_deviation_percent', 0):.2f}%")
        table.add_row("平均百公里油耗", f"{summary.get('avg_fuel_per_km', 0)*100:.2f} L/100km")
        
        console.print(table)
    
    def _print_anomaly_summary(self, anomalies: List):
        if not anomalies:
            console.print("\n[green]✓ 未检测到油耗异常[/green]")
            return
        
        from collections import Counter
        
        type_counter = Counter(a.anomaly_type.value for a in anomalies)
        severity_counter = Counter(a.severity.value for a in anomalies)
        
        table1 = Table(title="异常类型分布", border_style="magenta")
        table1.add_column("异常类型", style="bold")
        table1.add_column("数量", justify="right")
        
        for anomaly_type, count in type_counter.items():
            table1.add_row(anomaly_type, str(count))
        
        table2 = Table(title="异常严重程度", border_style="red")
        table2.add_column("严重程度", style="bold")
        table2.add_column("数量", justify="right")
        
        severity_order = ["严重", "高", "中", "低"]
        for sev in severity_order:
            if sev in severity_counter:
                color = {"严重": "red", "高": "yellow", "中": "cyan", "低": "green"}[sev]
                table2.add_row(f"[{color}]{sev}[/{color}]", str(severity_counter[sev]))
        
        console.print("\n")
        console.print(table1)
        console.print("\n")
        console.print(table2)
    
    def _print_detailed_anomalies(self, anomalies: List):
        if not anomalies:
            return
        
        console.print("\n[bold red]异常详情:[/bold red]")
        
        for i, anomaly in enumerate(anomalies[:10], 1):
            severity_color = {
                "严重": "red",
                "高": "yellow",
                "中": "cyan",
                "低": "green"
            }.get(anomaly.severity.value, "white")
            
            panel_title = Text.assemble(
                f"异常 #{i} - ",
                (anomaly.anomaly_type.value, "bold"),
                " [",
                (anomaly.severity.value, f"bold {severity_color}"),
                "]"
            )
            
            content = Text()
            content.append(f"记录ID: {anomaly.record_id}\n", style="dim")
            content.append(f"车牌号: {anomaly.plate_number}\n")
            content.append(f"司机: {anomaly.driver_name}\n")
            content.append(f"描述: {anomaly.description}\n\n")
            content.append("证据:\n", style="bold")
            for key, value in anomaly.evidence.items():
                content.append(f"  {key}: {value}\n")
            content.append(f"\n建议: {anomaly.suggestion}", style="italic")
            
            console.print(Panel(content, title=panel_title, border_style=severity_color))
        
        if len(anomalies) > 10:
            console.print(f"\n[dim]... 还有 {len(anomalies) - 10} 条异常记录，请查看Excel报告[/dim]")
    
    def _print_calculation_methodology(self):
        console.print("\n")
        title = Text("计算口径说明", style="bold cyan")
        console.print(Panel(title, border_style="cyan"))
        
        methodology = [
            ("百公里油耗", "实际油耗(L) ÷ 路线里程(km) × 100"),
            ("期望油耗", "基础油耗 + 载重影响 + 怠速影响"),
            ("基础油耗", "路线里程 × 车型基准油耗系数"),
            ("载重影响", "(载重÷1000) × 载重敏感系数 × 路线里程"),
            ("怠速影响", "怠速时间 × 怠速油耗系数"),
            ("油耗偏差", "(实际油耗 - 期望油耗) ÷ 期望油耗 × 100%"),
            ("载重系数", "实际载重 ÷ 车型基准载重"),
            ("怠速系数", "实际怠速时间 ÷ 车型基准怠速时间"),
            ("异常阈值", "油耗偏差 ±30% 或百公里油耗超出正常范围"),
        ]
        
        table = Table(show_header=False, border_style="dim")
        table.add_column(style="bold", width=15)
        table.add_column()
        
        for name, formula in methodology:
            table.add_row(name, formula)
        
        console.print(table)
        
        console.print("\n[dim]车型基准参数:[/dim]")
        params_table = Table(border_style="dim")
        params_table.add_column("车型", style="bold")
        params_table.add_column("基准油耗", justify="right")
        params_table.add_column("基准载重", justify="right")
        params_table.add_column("基准怠速", justify="right")
        
        params_table.add_row("垃圾清运车", "0.55 L/km", "6,000 kg", "45 min")
        params_table.add_row("道路清扫车", "0.58 L/km", "3,500 kg", "60 min")
        params_table.add_row("洒水车", "1.10 L/km", "9,000 kg", "30 min")
        
        console.print(params_table)
    
    def _write_overview_sheet(self, writer, df, validation_result, summary):
        data = [
            ["报告生成时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
            ["总记录数", len(df)],
            ["有效记录数", len(validation_result.valid_rows)],
            ["重复记录数", len(validation_result.duplicate_records)],
            ["缺失字段数", len(validation_result.missing_column_records)],
            ["异常记录数", summary.get('anomaly_count', 0)],
            ["异常率", f"{summary.get('anomaly_rate', 0):.1f}%"],
            ["平均油耗偏差", f"{summary.get('avg_fuel_deviation_percent', 0):.2f}%"],
            ["平均百公里油耗", f"{summary.get('avg_fuel_per_km', 0)*100:.2f} L/100km"],
        ]
        df_overview = pd.DataFrame(data, columns=['指标', '数值'])
        df_overview.to_excel(writer, sheet_name='概览', index=False)
    
    def _write_validation_sheet(self, writer, validation_result):
        issues = []
        for issue in validation_result.duplicate_records:
            issues.append({
                '问题类型': '重复数据',
                '记录ID': issue.get('record_id', ''),
                '详情': issue.get('description', ''),
                '原记录ID': issue.get('original_record_id', ''),
            })
        
        for issue in validation_result.missing_column_records:
            issues.append({
                '问题类型': '缺失字段',
                '记录ID': issue.get('record_id', ''),
                '详情': issue.get('description', ''),
                '缺失字段': issue.get('missing_field', ''),
            })
        
        if issues:
            pd.DataFrame(issues).to_excel(writer, sheet_name='数据质量问题', index=False)
    
    def _write_fuel_analysis_sheet(self, writer, analyses, df):
        analysis_df = self._fuel_analyses_to_df(analyses, df)
        analysis_df.to_excel(writer, sheet_name='油耗分析详情', index=False)
    
    def _write_anomalies_sheet(self, writer, anomalies):
        if not anomalies:
            return
        
        anomalies_df = self._anomalies_to_df(anomalies)
        anomalies_df.to_excel(writer, sheet_name='异常记录', index=False)
    
    def _write_methodology_sheet(self, writer):
        methodology = [
            {'计算项': '百公里油耗', '公式': '实际油耗(L) ÷ 路线里程(km) × 100'},
            {'计算项': '期望油耗', '公式': '基础油耗 + 载重影响 + 怠速影响'},
            {'计算项': '基础油耗', '公式': '路线里程 × 车型基准油耗系数'},
            {'计算项': '载重影响', '公式': '(载重÷1000) × 载重敏感系数 × 路线里程'},
            {'计算项': '怠速影响', '公式': '怠速时间 × 怠速油耗系数'},
            {'计算项': '油耗偏差', '公式': '(实际油耗 - 期望油耗) ÷ 期望油耗 × 100%'},
            {'计算项': '异常阈值', '公式': '油耗偏差 ±30% 或百公里油耗超出正常范围'},
        ]
        
        params = [
            {'车型': '垃圾清运车', '基准油耗': '0.55 L/km', '基准载重': '6,000 kg', '基准怠速': '45 min'},
            {'车型': '道路清扫车', '基准油耗': '0.58 L/km', '基准载重': '3,500 kg', '基准怠速': '60 min'},
            {'车型': '洒水车', '基准油耗': '1.10 L/km', '基准载重': '9,000 kg', '基准怠速': '30 min'},
        ]
        
        pd.DataFrame(methodology).to_excel(writer, sheet_name='计算口径', index=False, startrow=0)
        pd.DataFrame(params).to_excel(writer, sheet_name='计算口径', index=False, startrow=10)
    
    def _write_raw_data_sheet(self, writer, df):
        df.to_excel(writer, sheet_name='原始数据', index=False)
    
    def _fuel_analyses_to_df(self, analyses, df):
        records = []
        for analysis in analyses:
            row_mask = df['record_id'] == analysis.record_id
            if row_mask.any():
                row = df[row_mask].iloc[0]
            else:
                continue
            
            records.append({
                '记录ID': analysis.record_id,
                '车辆ID': analysis.vehicle_id,
                '车牌号': row.get('plate_number', ''),
                '司机': row.get('driver_name', ''),
                '路线': row.get('route_name', ''),
                '日期': row.get('date', ''),
                '实际油耗(L)': analysis.actual_fuel,
                '期望油耗(L)': analysis.expected_fuel,
                '油耗偏差(L)': analysis.fuel_deviation,
                '油耗偏差(%)': analysis.fuel_deviation_percent,
                '百公里油耗(L)': analysis.fuel_per_km * 100,
                '路线里程(km)': row.get('route_mileage', ''),
                '里程系数': analysis.mileage_factor,
                '载重(kg)': row.get('load_weight', ''),
                '载重系数': analysis.load_factor,
                '怠速时间(min)': row.get('idle_time', ''),
                '怠速系数': analysis.idle_factor,
                '是否异常': '是' if analysis.is_anomaly else '否',
                '异常原因': analysis.anomaly_cause,
            })
        return pd.DataFrame(records)
    
    def _anomalies_to_df(self, anomalies):
        records = []
        for anomaly in anomalies:
            evidence_str = "; ".join([f"{k}={v}" for k, v in anomaly.evidence.items()])
            records.append({
                '记录ID': anomaly.record_id,
                '车辆ID': anomaly.vehicle_id,
                '车牌号': anomaly.plate_number,
                '司机': anomaly.driver_name,
                '异常类型': anomaly.anomaly_type.value,
                '严重程度': anomaly.severity.value,
                '描述': anomaly.description,
                '证据': evidence_str,
                '建议': anomaly.suggestion,
            })
        return pd.DataFrame(records)