# -*- coding: utf-8 -*-
from decimal import Decimal
from typing import List, Dict, Any, Optional
from pathlib import Path
import csv
from .models import (
    CalculationResult, ComparisonResult, Bill, BillLineItem
)
from .comparator import ResultComparator


class ReportExporter:
    """报告导出器，支持导出 Markdown 和 CSV 格式"""
    
    @staticmethod
    def export_to_markdown(
        comparison_results: List[ComparisonResult],
        output_path: str,
        include_calculation_steps: bool = True
    ) -> None:
        """
        导出比较结果到 Markdown 格式
        
        Args:
            comparison_results: 比较结果列表
            output_path: 输出文件路径
            include_calculation_steps: 是否包含计算步骤
        """
        # 获取统计信息
        stats = ResultComparator.get_summary_statistics(comparison_results)
        
        # 生成 Markdown 内容
        lines = []
        
        # 标题
        lines.append("# 账单计算差异报告")
        lines.append("")
        lines.append(f"**生成时间**: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 统计摘要
        lines.append("## 统计摘要")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总账单数 | {stats['total_bills']} |")
        lines.append(f"| 通过数 | {stats['passed']} |")
        lines.append(f"| 失败数 | {stats['failed']} |")
        lines.append(f"| 通过率 | {stats['pass_rate']} |")
        lines.append(f"| 一分钱差异数 | {stats['penny_differences']} |")
        lines.append("")
        
        # 差异类型统计
        if stats['difference_types']:
            lines.append("### 差异类型统计")
            lines.append("")
            lines.append("| 差异类型 | 数量 |")
            lines.append("|----------|------|")
            for diff_type, count in stats['difference_types'].items():
                lines.append(f"| {diff_type} | {count} |")
            lines.append("")
        
        # 详细差异
        lines.append("## 详细差异")
        lines.append("")
        
        for result in comparison_results:
            if result.has_differences:
                lines.append(f"### 账单 {result.bill_id} (订单: {result.order_id})")
                lines.append("")
                lines.append("**状态**: ❌ 存在差异")
                lines.append("")
                
                # 汇总差异
                summary_diffs = [d for d in result.differences if d.get('type') == 'summary']
                if summary_diffs:
                    lines.append("#### 汇总差异")
                    lines.append("")
                    lines.append("| 字段 | 预期值 | 实际值 | 差异 |")
                    lines.append("|------|--------|--------|------|")
                    for diff in summary_diffs:
                        expected = diff.get('expected', '-')
                        actual = diff.get('actual', '-')
                        difference = diff.get('difference', '-')
                        field_desc = diff.get('field_description', diff.get('field', '-'))
                        lines.append(f"| {field_desc} | {expected} | {actual} | {difference} |")
                    lines.append("")
                
                # 行项目差异
                line_diffs = [d for d in result.differences if d.get('type') == 'line_detail']
                if line_diffs:
                    lines.append("#### 行项目差异")
                    lines.append("")
                    lines.append("| 行ID | 行名称 | 字段 | 预期值 | 实际值 | 差异 |")
                    lines.append("|------|--------|------|--------|--------|------|")
                    for diff in line_diffs:
                        line_id = diff.get('line_id', '-')
                        line_name = diff.get('line_name', '-')
                        field_desc = diff.get('field_description', diff.get('field', '-'))
                        expected = diff.get('expected', '-')
                        actual = diff.get('actual', '-')
                        difference = diff.get('difference', '-')
                        lines.append(f"| {line_id} | {line_name} | {field_desc} | {expected} | {actual} | {difference} |")
                    lines.append("")
                
                # 其他差异
                other_diffs = [d for d in result.differences 
                               if d.get('type') not in ['summary', 'line_detail']]
                if other_diffs:
                    lines.append("#### 其他差异")
                    lines.append("")
                    for diff in other_diffs:
                        desc = diff.get('description', str(diff))
                        lines.append(f"- {desc}")
                    lines.append("")
                
                # 计算步骤（如果需要）
                if include_calculation_steps and result.actual:
                    lines.append("#### 实际计算步骤")
                    lines.append("")
                    lines.append("```")
                    for step in result.actual.calculation_steps:
                        lines.append(f"步骤: {step.get('step', '未知')}")
                        details = step.get('details', [])
                        if isinstance(details, list):
                            for detail in details:
                                if isinstance(detail, dict):
                                    for key, value in detail.items():
                                        lines.append(f"  {key}: {value}")
                                else:
                                    lines.append(f"  {detail}")
                        lines.append("")
                    lines.append("```")
                    lines.append("")
            else:
                lines.append(f"### 账单 {result.bill_id} (订单: {result.order_id})")
                lines.append("")
                lines.append("**状态**: ✅ 完全一致")
                lines.append("")
        
        # 写入文件
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        print(f"Markdown 报告已导出到: {output_path}")
    
    @staticmethod
    def export_to_csv(
        comparison_results: List[ComparisonResult],
        output_path: str
    ) -> None:
        """
        导出比较结果到 CSV 格式
        
        Args:
            comparison_results: 比较结果列表
            output_path: 输出文件路径
        """
        rows = []
        
        # 表头
        header = [
            '账单ID', '订单ID', '差异类型', '行ID', '行名称', 
            '字段', '字段描述', '预期值', '实际值', '差异', '描述'
        ]
        rows.append(header)
        
        for result in comparison_results:
            for diff in result.differences:
                row = [
                    result.bill_id,
                    result.order_id,
                    diff.get('type', ''),
                    diff.get('line_id', ''),
                    diff.get('line_name', ''),
                    diff.get('field', ''),
                    diff.get('field_description', ''),
                    str(diff.get('expected', '')),
                    str(diff.get('actual', '')),
                    str(diff.get('difference', '')),
                    diff.get('description', '')
                ]
                rows.append(row)
        
        # 如果没有差异，添加一个说明行
        if len(rows) == 1:
            rows.append(['', '', '无差异', '', '', '', '', '', '', '', '所有账单计算结果完全一致'])
        
        # 写入文件
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        print(f"CSV 报告已导出到: {output_path}")
    
    @staticmethod
    def export_calculation_result(
        calculation_result: CalculationResult,
        output_path: str,
        format: str = 'markdown'
    ) -> None:
        """
        导出单个计算结果
        
        Args:
            calculation_result: 计算结果
            output_path: 输出文件路径
            format: 输出格式 ('markdown' 或 'csv')
        """
        bill = calculation_result.bill
        
        if format.lower() == 'csv':
            # CSV 格式
            rows = []
            rows.append(['账单ID', bill.id])
            rows.append(['订单ID', bill.order_id])
            rows.append(['货币', bill.currency])
            rows.append(['取整配置', bill.rounding_profile_id])
            rows.append([])
            rows.append(['总小计', str(bill.total_subtotal)])
            rows.append(['总折扣', str(bill.total_discount)])
            rows.append(['总税费', str(bill.total_tax)])
            rows.append(['总服务费', str(bill.total_service_fee)])
            rows.append(['最终总额', str(bill.grand_total)])
            rows.append([])
            rows.append(['行项目详情'])
            rows.append(['行ID', '名称', '数量', '单价', '小计', '折扣', '税费', '服务费', '行总额'])
            
            for line in bill.lines:
                rows.append([
                    line.id,
                    line.name,
                    str(line.quantity),
                    str(line.unit_price),
                    str(line.subtotal),
                    str(line.discount_amount),
                    str(line.tax_amount),
                    str(line.service_fee_amount),
                    str(line.line_total)
                ])
            
            if calculation_result.validation_errors:
                rows.append([])
                rows.append(['验证错误'])
                for error in calculation_result.validation_errors:
                    rows.append([error])
            
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            
            print(f"CSV 计算结果已导出到: {output_path}")
        
        else:
            # Markdown 格式
            lines = []
            lines.append(f"# 账单计算结果 - {bill.id}")
            lines.append("")
            lines.append("## 基本信息")
            lines.append("")
            lines.append(f"- **订单ID**: {bill.order_id}")
            lines.append(f"- **货币**: {bill.currency}")
            lines.append(f"- **取整配置**: {bill.rounding_profile_id}")
            lines.append("")
            
            lines.append("## 汇总信息")
            lines.append("")
            lines.append("| 项目 | 金额 |")
            lines.append("|------|------|")
            lines.append(f"| 总小计 | {bill.total_subtotal} |")
            lines.append(f"| 总折扣 | {bill.total_discount} |")
            lines.append(f"| 总税费 | {bill.total_tax} |")
            lines.append(f"| 总服务费 | {bill.total_service_fee} |")
            lines.append(f"| **最终总额** | **{bill.grand_total}** |")
            lines.append("")
            
            lines.append("## 行项目详情")
            lines.append("")
            lines.append("| 行ID | 名称 | 数量 | 单价 | 小计 | 折扣 | 税费 | 服务费 | 行总额 |")
            lines.append("|------|------|------|------|------|------|------|--------|--------|")
            
            for line in bill.lines:
                lines.append(
                    f"| {line.id} | {line.name} | {line.quantity} | {line.unit_price} | "
                    f"{line.subtotal} | {line.discount_amount} | {line.tax_amount} | "
                    f"{line.service_fee_amount} | {line.line_total} |"
                )
            lines.append("")
            
            if calculation_result.validation_errors:
                lines.append("## 验证信息")
                lines.append("")
                for error in calculation_result.validation_errors:
                    if error.startswith("错误:"):
                        lines.append(f"- ❌ {error}")
                    else:
                        lines.append(f"- ⚠️ {error}")
                lines.append("")
            
            lines.append("## 计算步骤")
            lines.append("")
            lines.append("```")
            for step in calculation_result.calculation_steps:
                lines.append(f"步骤: {step.get('step', '未知')}")
                details = step.get('details', [])
                if isinstance(details, list):
                    for detail in details:
                        if isinstance(detail, dict):
                            for key, value in detail.items():
                                lines.append(f"  {key}: {value}")
                        else:
                            lines.append(f"  {detail}")
                lines.append("")
            lines.append("```")
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            print(f"Markdown 计算结果已导出到: {output_path}")
