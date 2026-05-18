import os
from datetime import datetime
from typing import List
import pandas as pd
from .validator import ValidationResult, ValidationStatus
from .config import config

class ReportGenerator:
    def __init__(self):
        pass
    
    def generate_summary_report(self, results: List[ValidationResult]) -> str:
        total_files = len(results)
        success_files = sum(1 for r in results if r.success)
        failed_files = total_files - success_files
        skipped_files = sum(1 for r in results if r.skipped_count > 0)
        
        total_rows = sum(r.total_rows for r in results)
        total_passed = sum(r.passed_count for r in results)
        total_failed = sum(r.failed_count for r in results)
        total_warnings = sum(r.warning_count for r in results)
        
        total_combos = sum(len(r.combination_products) for r in results)
        total_temps = sum(len(r.temp_replacements) for r in results)
        total_reruns = sum(len(r.rerun_items) for r in results)
        
        report = []
        report.append("=" * 70)
        report.append("           无人售货机货道校验汇总报告")
        report.append("=" * 70)
        report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        report.append("--- 文件处理概览 ---")
        report.append(f"总文件数: {total_files}")
        report.append(f"处理成功: {success_files}")
        report.append(f"处理失败: {failed_files}")
        report.append(f"跳过(已处理): {skipped_files}")
        report.append("")
        
        report.append("--- 数据校验概览 ---")
        report.append(f"总数据行数: {total_rows}")
        report.append(f"校验通过: {total_passed} ({(total_passed/total_rows*100):.1f}%)" if total_rows > 0 else "校验通过: 0")
        report.append(f"校验不通过: {total_failed}")
        report.append(f"警告提醒: {total_warnings}")
        report.append("")
        
        report.append("--- 特殊情况统计 ---")
        report.append(f"组合商品: {total_combos} 项")
        report.append(f"临时换品: {total_temps} 项")
        report.append(f"需复跑: {total_reruns} 项")
        report.append("")
        
        if failed_files > 0:
            report.append("--- 处理失败的文件 ---")
            for r in results:
                if not r.success:
                    report.append(f"  - {r.file_name}: {r.error_message}")
            report.append("")
        
        report.append("--- 各文件详情 ---")
        for r in results:
            status = "✓ 成功" if r.success else "✗ 失败"
            skip_note = " (跳过-已处理)" if r.skipped_count > 0 else ""
            report.append(f"{r.file_name}: {status}{skip_note}")
            if r.success and r.skipped_count == 0:
                report.append(f"  行数: {r.total_rows}, 通过: {r.passed_count}, 不通过: {r.failed_count}, 警告: {r.warning_count}")
            if r.error_message and r.skipped_count == 0:
                report.append(f"  错误: {r.error_message}")
        
        report.append("")
        report.append("=" * 70)
        report.append("  一线同事操作指引:")
        report.append("  1. 查看 '处理失败的文件' 列表，修复文件后重新运行")
        report.append("  2. 对于 '校验不通过' 的数据，按照详细问题清单逐行修正")
        report.append("  3. 组合商品请核对子商品配置清单，确认无误后标记")
        report.append("  4. 临时换品请登记换品记录表，跟进换回时间")
        report.append("  5. 需复跑项请人工确认后，可重新运行校验工具")
        report.append("  6. 同一文件内容不变时重复运行会自动跳过，不会重复追加")
        report.append("=" * 70)
        
        return "\n".join(report)
    
    def generate_detailed_issues(self, results: List[ValidationResult]) -> pd.DataFrame:
        issue_rows = []
        for result in results:
            if result.success and result.skipped_count == 0:
                for issue in result.issues:
                    issue_rows.append({
                        "文件名": result.file_name,
                        "行号": issue.row_index,
                        "售货机编号": issue.machine_id,
                        "货道编号": issue.channel_id,
                        "问题类型": issue.issue_type,
                        "问题描述": issue.description,
                        "严重程度": issue.severity.value
                    })
        return pd.DataFrame(issue_rows)
    
    def generate_special_cases_report(self, results: List[ValidationResult]) -> pd.DataFrame:
        rows = []
        
        for result in results:
            if result.success and result.skipped_count == 0:
                for item in result.combination_products:
                    rows.append({
                        "文件名": result.file_name,
                        "类型": "组合商品",
                        "行号": item["row_index"],
                        "售货机编号": item["machine_id"],
                        "货道编号": item["channel_id"],
                        "商品名称": item.get("product_name", ""),
                        "原因说明": item["reason"],
                        "后续操作": item["action_required"]
                    })
                
                for item in result.temp_replacements:
                    rows.append({
                        "文件名": result.file_name,
                        "类型": "临时换品",
                        "行号": item["row_index"],
                        "售货机编号": item["machine_id"],
                        "货道编号": item["channel_id"],
                        "商品名称": item.get("original_product", ""),
                        "原因说明": item["reason"],
                        "后续操作": item["action_required"]
                    })
                
                for item in result.rerun_items:
                    rows.append({
                        "文件名": result.file_name,
                        "类型": "需复跑",
                        "行号": item["row_index"],
                        "售货机编号": item["machine_id"],
                        "货道编号": item["channel_id"],
                        "商品名称": item.get("product_name", ""),
                        "原因说明": item["reason"],
                        "后续操作": item["action_required"]
                    })
        
        return pd.DataFrame(rows)
    
    def save_all_reports(self, results: List[ValidationResult]):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        summary_text = self.generate_summary_report(results)
        summary_path = os.path.join(config.OUTPUT_DIR, f"校验汇总报告_{timestamp}.txt")
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(summary_text)
        
        issues_df = self.generate_detailed_issues(results)
        if not issues_df.empty:
            issues_path = os.path.join(config.OUTPUT_DIR, f"问题明细_{timestamp}.xlsx")
            issues_df.to_excel(issues_path, index=False, engine='openpyxl')
        
        special_df = self.generate_special_cases_report(results)
        if not special_df.empty:
            special_path = os.path.join(config.OUTPUT_DIR, f"特殊情况处理_{timestamp}.xlsx")
            special_df.to_excel(special_path, index=False, engine='openpyxl')
        
        return summary_path, summary_text
