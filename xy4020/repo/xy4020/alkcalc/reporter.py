# -*- coding: utf-8 -*-
"""
报告导出模块
负责生成Markdown报告和CSV结果表
"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .storage import CalculationBatch, StoredSampleResult, DatabaseManager
from .quality_control import QCStatus, get_qc_status_icon


class MarkdownReporter:
    """Markdown报告生成器"""

    def __init__(self):
        self.report_lines: List[str] = []

    def add_header(self, text: str, level: int = 1) -> None:
        """添加标题"""
        prefix = "#" * level
        self.report_lines.append(f"\n{prefix} {text}\n")

    def add_paragraph(self, text: str) -> None:
        """添加段落"""
        self.report_lines.append(f"{text}\n")

    def add_table(self, headers: List[str], rows: List[List[Any]]) -> None:
        """添加表格"""
        if not headers:
            return
        
        # 表头
        header_line = "| " + " | ".join(str(h) for h in headers) + " |"
        self.report_lines.append(header_line)
        
        # 分隔线
        separator_line = "| " + " | ".join("---" for _ in headers) + " |"
        self.report_lines.append(separator_line)
        
        # 数据行
        for row in rows:
            row_line = "| " + " | ".join(str(cell) if cell is not None else "" for cell in row) + " |"
            self.report_lines.append(row_line)
        
        self.report_lines.append("")

    def add_code_block(self, code: str, language: str = "") -> None:
        """添加代码块"""
        self.report_lines.append(f"\n```{language}")
        self.report_lines.append(code)
        self.report_lines.append("```\n")

    def add_list(self, items: List[str], ordered: bool = False) -> None:
        """添加列表"""
        for i, item in enumerate(items):
            if ordered:
                self.report_lines.append(f"{i + 1}. {item}")
            else:
                self.report_lines.append(f"- {item}")
        self.report_lines.append("")

    def add_horizontal_rule(self) -> None:
        """添加分隔线"""
        self.report_lines.append("\n---\n")

    def generate_batch_report(
        self,
        batch: CalculationBatch,
        sample_results: List[StoredSampleResult],
        statistics: Dict[str, Any]
    ) -> str:
        """
        生成单个计算批次的详细报告
        
        Args:
            batch: 批次信息
            sample_results: 样品结果列表
            statistics: 统计信息
            
        Returns:
            Markdown格式的报告字符串
        """
        self.report_lines = []
        
        # 报告标题
        self.add_header("碱度滴定计算报告", 1)
        
        # 基本信息
        self.add_header("基本信息", 2)
        
        info_items = [
            f"**项目名称**: {batch.project_name}",
            f"**批次名称**: {batch.batch_name}",
            f"**计算时间**: {batch.created_at}",
            f"**标准液浓度**: {batch.standard_concentration_mol_l:.6f} mol/L",
            f"**样品体积**: {batch.sample_volume_used_ml} ml",
        ]
        if batch.notes:
            info_items.append(f"**备注**: {batch.notes}")
        
        self.add_list(info_items)
        
        # 整体质控状态
        overall_status = batch.metadata.get("overall_status", "UNKNOWN") if batch.metadata else "UNKNOWN"
        status_icon = get_qc_status_icon(QCStatus(overall_status)) if overall_status != "UNKNOWN" else "?"
        
        self.add_header(f"整体质控状态: {status_icon} {overall_status}", 2)
        
        # 统计摘要
        self.add_header("统计摘要", 2)
        
        qc_counts = statistics.get("qc_counts", {})
        summary_rows = [
            ["总样品数", statistics.get("total_samples", 0)],
            ["平均碱度", f"{statistics.get('avg_alkalinity', 0):.2f} mg/L as CaCO3"],
            ["最低碱度", f"{statistics.get('min_alkalinity', 0):.2f} mg/L as CaCO3"],
            ["最高碱度", f"{statistics.get('max_alkalinity', 0):.2f} mg/L as CaCO3"],
            ["质控通过", qc_counts.get("PASS", 0)],
            ["质控警告", qc_counts.get("WARNING", 0)],
            ["质控失败", qc_counts.get("FAIL", 0)],
            ["质控错误", qc_counts.get("ERROR", 0)],
        ]
        self.add_table(["指标", "数值"], summary_rows)
        
        self.add_horizontal_rule()
        
        # 详细结果表
        self.add_header("详细结果", 2)
        
        # 按质控状态分组
        pass_samples = [s for s in sample_results if s.qc_status == QCStatus.PASS.value]
        warn_samples = [s for s in sample_results if s.qc_status == QCStatus.WARNING.value]
        fail_samples = [s for s in sample_results if s.qc_status == QCStatus.FAIL.value]
        error_samples = [s for s in sample_results if s.qc_status == QCStatus.ERROR.value]
        
        # 详细结果表格
        detail_headers = [
            "状态", "样品ID", "采样点", "瓶号",
            "碱度 (mg/L CaCO3)", "端点体积 (ml)", "校正后体积 (ml)",
            "温度 (°C)", "稀释倍数", "备注"
        ]
        
        detail_rows = []
        for sample in sample_results:
            status_icon = get_qc_status_icon(QCStatus(sample.qc_status))
            issues_note = ""
            if sample.qc_issues:
                issue_codes = [i.get("rule_code", "") for i in sample.qc_issues]
                issues_note = f"问题: {', '.join(issue_codes)}"
            
            detail_rows.append([
                f"{status_icon} {sample.qc_status}",
                sample.sample_id,
                sample.sampling_point or "-",
                sample.bottle_number or "-",
                f"{sample.total_alkalinity_mg_l_caco3:.2f}",
                f"{sample.endpoint_volume_ml:.4f}",
                f"{sample.blank_corrected_volume_ml:.4f}",
                f"{sample.temperature_c:.1f}" if sample.temperature_c else "-",
                f"{sample.dilution_factor:.2f}",
                issues_note
            ])
        
        self.add_table(detail_headers, detail_rows)
        
        # 有问题的样品详细信息
        problematic_samples = warn_samples + fail_samples + error_samples
        if problematic_samples:
            self.add_horizontal_rule()
            self.add_header("问题样品详情", 2)
            
            for sample in problematic_samples:
                self.add_paragraph(f"### {sample.sample_id} - {get_qc_status_icon(QCStatus(sample.qc_status))} {sample.qc_status}")
                
                sample_info = [
                    f"采样点: {sample.sampling_point or '-'}",
                    f"瓶号: {sample.bottle_number or '-'}",
                    f"碱度: {sample.total_alkalinity_mg_l_caco3:.2f} mg/L as CaCO3",
                    f"端点体积: {sample.endpoint_volume_ml:.4f} ml",
                    f"校正后体积: {sample.blank_corrected_volume_ml:.4f} ml",
                ]
                self.add_list(sample_info)
                
                if sample.qc_issues:
                    self.add_paragraph("**质控问题:**")
                    issue_items = []
                    for issue in sample.qc_issues:
                        issue_str = f"- [{issue.get('rule_code', 'UNKNOWN')}] {issue.get('status', '')}: {issue.get('message', '')}"
                        if issue.get('details'):
                            issue_str += f" (详情: {issue['details']})"
                        issue_items.append(issue_str)
                    self.add_list(issue_items)
                
                self.add_paragraph("")
        
        # 报告底部
        self.add_horizontal_rule()
        self.add_paragraph(f"报告生成时间: {datetime.now().isoformat()}")
        self.add_paragraph("*由 alkcalc 碱度滴定计算工具生成*")
        
        return "\n".join(self.report_lines)

    def generate_history_report(
        self,
        query_results: Dict[int, Dict[str, Any]],
        title: str = "历史查询结果"
    ) -> str:
        """
        生成历史查询结果报告
        
        Args:
            query_results: 查询结果（按批次ID分组）
            title: 报告标题
            
        Returns:
            Markdown格式的报告字符串
        """
        self.report_lines = []
        
        self.add_header(title, 1)
        self.add_paragraph(f"查询时间: {datetime.now().isoformat()}")
        self.add_paragraph(f"共找到 {len(query_results)} 个批次")
        
        for batch_id, batch_data in sorted(query_results.items(), key=lambda x: x[0], reverse=True):
            batch_info = batch_data.get("batch_info", {})
            samples = batch_data.get("samples", [])
            
            self.add_horizontal_rule()
            self.add_header(f"批次 #{batch_id}: {batch_info.get('batch_name', '未命名')}", 2)
            
            batch_items = [
                f"创建时间: {batch_info.get('created_at', '-')}",
                f"项目: {batch_info.get('project_name', '-')}",
                f"标准液浓度: {batch_info.get('standard_concentration_mol_l', 0):.6f} mol/L",
                f"样品数: {len(samples)}",
            ]
            self.add_list(batch_items)
            
            # 批次内样品表
            if samples:
                sample_headers = ["样品ID", "采样点", "碱度 (mg/L CaCO3)", "质控状态"]
                sample_rows = []
                for sample in samples:
                    status_icon = get_qc_status_icon(QCStatus(sample.get("qc_status", "UNKNOWN")))
                    sample_rows.append([
                        sample.get("sample_id", "-"),
                        sample.get("sampling_point", "-"),
                        f"{sample.get('total_alkalinity_mg_l_caco3', 0):.2f}",
                        f"{status_icon} {sample.get('qc_status', 'UNKNOWN')}"
                    ])
                self.add_table(sample_headers, sample_rows)
        
        return "\n".join(self.report_lines)


class CSVExporter:
    """CSV结果导出器"""

    @staticmethod
    def export_batch_results(
        file_path: Path,
        sample_results: List[StoredSampleResult],
        include_issues: bool = True
    ) -> None:
        """
        导出批次结果到CSV
        
        Args:
            file_path: 输出文件路径
            sample_results: 样品结果列表
            include_issues: 是否包含质控问题详情
        """
        headers = [
            "sample_id",
            "sampling_point",
            "bottle_number",
            "total_alkalinity_mg_l_caco3",
            "endpoint_volume_ml",
            "blank_corrected_volume_ml",
            "temperature_c",
            "dilution_factor",
            "qc_status",
            "is_blank",
            "is_duplicate",
            "parent_sample_id",
        ]
        
        if include_issues:
            headers.extend(["qc_issue_count", "qc_issue_codes", "qc_issue_messages"])
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for sample in sample_results:
                row = [
                    sample.sample_id,
                    sample.sampling_point or "",
                    sample.bottle_number or "",
                    f"{sample.total_alkalinity_mg_l_caco3:.4f}",
                    f"{sample.endpoint_volume_ml:.6f}",
                    f"{sample.blank_corrected_volume_ml:.6f}",
                    f"{sample.temperature_c:.2f}" if sample.temperature_c else "",
                    f"{sample.dilution_factor:.4f}",
                    sample.qc_status,
                    "1" if sample.is_blank else "0",
                    "1" if sample.is_duplicate else "0",
                    sample.parent_sample_id or "",
                ]
                
                if include_issues:
                    issue_count = len(sample.qc_issues)
                    issue_codes = ";".join([i.get("rule_code", "") for i in sample.qc_issues])
                    issue_messages = ";".join([i.get("message", "") for i in sample.qc_issues])
                    row.extend([str(issue_count), issue_codes, issue_messages])
                
                writer.writerow(row)

    @staticmethod
    def export_history_results(
        file_path: Path,
        query_results: Dict[int, Dict[str, Any]]
    ) -> None:
        """
        导出历史查询结果到CSV
        
        Args:
            file_path: 输出文件路径
            query_results: 查询结果
        """
        headers = [
            "batch_id",
            "batch_name",
            "created_at",
            "project_name",
            "sample_id",
            "sampling_point",
            "total_alkalinity_mg_l_caco3",
            "qc_status",
        ]
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for batch_id, batch_data in sorted(query_results.items(), key=lambda x: x[0]):
                batch_info = batch_data.get("batch_info", {})
                samples = batch_data.get("samples", [])
                
                for sample in samples:
                    row = [
                        str(batch_id),
                        batch_info.get("batch_name", ""),
                        batch_info.get("created_at", ""),
                        batch_info.get("project_name", ""),
                        sample.get("sample_id", ""),
                        sample.get("sampling_point", ""),
                        f"{sample.get('total_alkalinity_mg_l_caco3', 0):.4f}",
                        sample.get("qc_status", ""),
                    ]
                    writer.writerow(row)

    @staticmethod
    def export_statistics(
        file_path: Path,
        statistics: Dict[str, Any],
        batch_info: Optional[CalculationBatch] = None
    ) -> None:
        """
        导出统计信息到CSV
        
        Args:
            file_path: 输出文件路径
            statistics: 统计信息
            batch_info: 批次信息（可选）
        """
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            # 批次信息
            if batch_info:
                writer.writerow(["统计类型", "项目", "数值"])
                writer.writerow(["批次信息", "批次ID", batch_info.id])
                writer.writerow(["批次信息", "批次名称", batch_info.batch_name])
                writer.writerow(["批次信息", "创建时间", batch_info.created_at])
                writer.writerow(["批次信息", "项目名称", batch_info.project_name])
                writer.writerow(["批次信息", "标准液浓度 (mol/L)", f"{batch_info.standard_concentration_mol_l:.6f}"])
                writer.writerow([])
            
            # 统计数据
            writer.writerow(["统计指标", "数值"])
            writer.writerow(["总样品数", statistics.get("total_samples", 0)])
            writer.writerow(["平均碱度 (mg/L CaCO3)", f"{statistics.get('avg_alkalinity', 0):.4f}"])
            writer.writerow(["最低碱度 (mg/L CaCO3)", f"{statistics.get('min_alkalinity', 0):.4f}"])
            writer.writerow(["最高碱度 (mg/L CaCO3)", f"{statistics.get('max_alkalinity', 0):.4f}"])
            writer.writerow([])
            
            # 质控统计
            qc_counts = statistics.get("qc_counts", {})
            writer.writerow(["质控状态", "数量"])
            writer.writerow(["PASS", qc_counts.get("PASS", 0)])
            writer.writerow(["WARNING", qc_counts.get("WARNING", 0)])
            writer.writerow(["FAIL", qc_counts.get("FAIL", 0)])
            writer.writerow(["ERROR", qc_counts.get("ERROR", 0)])


def generate_report_from_database(
    db_manager: DatabaseManager,
    batch_id: int,
    output_dir: Path
) -> Dict[str, Path]:
    """
    从数据库生成报告（Markdown + CSV）
    
    Args:
        db_manager: 数据库管理器
        batch_id: 批次ID
        output_dir: 输出目录
        
    Returns:
        生成的文件路径字典
    """
    batch = db_manager.get_batch(batch_id)
    if not batch:
        raise ValueError(f"批次 {batch_id} 不存在")
    
    sample_results = db_manager.get_sample_results(batch_id)
    statistics = db_manager.get_statistics(batch_id)
    
    # 生成Markdown报告
    reporter = MarkdownReporter()
    markdown_content = reporter.generate_batch_report(batch, sample_results, statistics)
    
    md_path = output_dir / f"batch_{batch_id}_report.md"
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    # 导出CSV
    csv_path = output_dir / f"batch_{batch_id}_results.csv"
    CSVExporter.export_batch_results(csv_path, sample_results)
    
    # 导出统计CSV
    stats_csv_path = output_dir / f"batch_{batch_id}_statistics.csv"
    CSVExporter.export_statistics(stats_csv_path, statistics, batch)
    
    return {
        "markdown": md_path,
        "results_csv": csv_path,
        "statistics_csv": stats_csv_path
    }
