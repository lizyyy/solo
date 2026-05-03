#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
报告生成模块
生成 Markdown 巡检报告和 CSV 异常清单
"""

from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import csv

from models import (
    Reagent, Cabinet, ResponsiblePerson, UsageRecord,
    InspectionRecord, AlertType, ChemicalCategory
)
from logic.validation_rules import ValidationResult, ValidationRules


class ReportGenerator:
    """报告生成器"""
    
    @staticmethod
    def generate_inspection_report(
        inspection_date: date,
        inspector: ResponsiblePerson,
        reagents: List[Reagent],
        cabinets: List[Cabinet],
        usage_records: List[UsageRecord],
        validation_results: Dict[int, List[ValidationResult]],
        overdue_results: List[ValidationResult],
        output_dir: str
    ) -> Dict[str, str]:
        """
        生成巡检报告
        
        Args:
            inspection_date: 巡检日期
            inspector: 巡检人
            reagents: 所有试剂
            cabinets: 所有柜位
            usage_records: 领用记录
            validation_results: 校验结果（按柜位分组）
            overdue_results: 超期未归还校验结果
            output_dir: 输出目录
        
        Returns:
            报告文件路径字典 {'markdown': '...', 'csv': '...'}
        """
        # 确保输出目录存在
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # 生成文件名
        date_str = inspection_date.strftime("%Y%m%d")
        timestamp = datetime.now().strftime("%H%M%S")
        md_filename = f"巡检报告_{date_str}_{timestamp}.md"
        csv_filename = f"异常清单_{date_str}_{timestamp}.csv"
        
        md_path = str(output_path / md_filename)
        csv_path = str(output_path / csv_filename)
        
        # 生成 Markdown 报告
        ReportGenerator._generate_markdown_report(
            md_path, inspection_date, inspector,
            reagents, cabinets, usage_records,
            validation_results, overdue_results
        )
        
        # 生成 CSV 异常清单
        ReportGenerator._generate_csv_anomaly_list(
            csv_path, validation_results, overdue_results, cabinets
        )
        
        return {
            'markdown': md_path,
            'csv': csv_path
        }
    
    @staticmethod
    def _generate_markdown_report(
        file_path: str,
        inspection_date: date,
        inspector: ResponsiblePerson,
        reagents: List[Reagent],
        cabinets: List[Cabinet],
        usage_records: List[UsageRecord],
        validation_results: Dict[int, List[ValidationResult]],
        overdue_results: List[ValidationResult]
    ):
        """生成 Markdown 格式的巡检报告"""
        
        # 统计信息
        total_reagents = len(reagents)
        total_cabinets = len(cabinets)
        
        # 统计各类异常
        expired_count = 0
        expiring_soon_count = 0
        low_stock_count = 0
        incompatible_count = 0
        overdue_count = len(overdue_results)
        
        # 按柜位统计
        cabinet_stats: Dict[int, Dict[str, int]] = {}
        for cabinet in cabinets:
            cabinet_stats[cabinet.id] = {
                'total': 0,
                'expired': 0,
                'expiring_soon': 0,
                'low_stock': 0,
                'incompatible': 0
            }
        
        # 统计试剂分布
        for reagent in reagents:
            if reagent.cabinet_id and reagent.cabinet_id in cabinet_stats:
                cabinet_stats[reagent.cabinet_id]['total'] += 1
        
        # 统计各类异常
        for cabinet_id, results in validation_results.items():
            for result in results:
                if result.alert_type == AlertType.EXPIRED:
                    expired_count += 1
                    if cabinet_id in cabinet_stats:
                        cabinet_stats[cabinet_id]['expired'] += 1
                elif result.alert_type == AlertType.EXPIRING_SOON:
                    expiring_soon_count += 1
                    if cabinet_id in cabinet_stats:
                        cabinet_stats[cabinet_id]['expiring_soon'] += 1
                elif result.alert_type == AlertType.LOW_STOCK:
                    low_stock_count += 1
                    if cabinet_id in cabinet_stats:
                        cabinet_stats[cabinet_id]['low_stock'] += 1
                elif result.alert_type == AlertType.INCOMPATIBLE:
                    incompatible_count += 1
                    if cabinet_id in cabinet_stats:
                        cabinet_stats[cabinet_id]['incompatible'] += 1
        
        # 构建报告内容
        report_lines = []
        
        # 标题
        report_lines.append(f"# 危化品柜巡检报告\n")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        report_lines.append(f"**巡检日期**: {inspection_date.strftime('%Y-%m-%d')}\n")
        report_lines.append(f"**巡检人**: {inspector.name} (工号: {inspector.employee_id})\n")
        report_lines.append(f"**部门**: {inspector.department}\n")
        report_lines.append("\n---\n")
        
        # 巡检概览
        report_lines.append(f"## 巡检概览\n")
        report_lines.append(f"| 统计项 | 数量 |")
        report_lines.append(f"|--------|------|")
        report_lines.append(f"| 柜位总数 | {total_cabinets} |")
        report_lines.append(f"| 试剂总数 | {total_reagents} |")
        report_lines.append(f"| 过期试剂 | **{expired_count}** |")
        report_lines.append(f"| 即将过期（30天内） | **{expiring_soon_count}** |")
        report_lines.append(f"| 库存不足 | **{low_stock_count}** |")
        report_lines.append(f"| 禁配警告 | **{incompatible_count}** |")
        report_lines.append(f"| 超期未归还 | **{overdue_count}** |")
        report_lines.append("\n")
        
        # 按柜位统计
        report_lines.append(f"## 按柜位统计\n")
        report_lines.append(f"| 柜位名称 | 试剂总数 | 过期 | 即将过期 | 库存不足 | 禁配警告 |")
        report_lines.append(f"|----------|----------|------|----------|----------|----------|")
        
        for cabinet in cabinets:
            stats = cabinet_stats.get(cabinet.id, {'total': 0, 'expired': 0, 'expiring_soon': 0, 'low_stock': 0, 'incompatible': 0})
            report_lines.append(
                f"| {cabinet.name} | {stats['total']} | "
                f"{stats['expired']} | {stats['expiring_soon']} | "
                f"{stats['low_stock']} | {stats['incompatible']} |"
            )
        report_lines.append("\n")
        
        # 异常详情
        report_lines.append(f"## 异常详情\n")
        
        # 过期试剂
        if expired_count > 0 or expiring_soon_count > 0:
            report_lines.append(f"### 过期/即将过期试剂\n")
            report_lines.append(f"| 瓶号 | 试剂名称 | 类别 | 有效期至 | 状态 |")
            report_lines.append(f"|------|----------|------|----------|------|")
            
            for cabinet_id, results in validation_results.items():
                for result in results:
                    if result.alert_type in [AlertType.EXPIRED, AlertType.EXPIRING_SOON]:
                        status = "已过期" if result.alert_type == AlertType.EXPIRED else "即将过期"
                        report_lines.append(
                            f"| {result.bottle_number or '-'} | {result.reagent_name or '-'} | "
                            f"- | - | {status} |"
                        )
            report_lines.append("\n")
        
        # 库存不足
        if low_stock_count > 0:
            report_lines.append(f"### 库存不足试剂\n")
            report_lines.append(f"| 瓶号 | 试剂名称 | 当前数量 | 单位 | 最低预警值 |")
            report_lines.append(f"|------|----------|----------|------|------------|")
            
            for cabinet_id, results in validation_results.items():
                for result in results:
                    if result.alert_type == AlertType.LOW_STOCK:
                        report_lines.append(
                            f"| {result.bottle_number or '-'} | {result.reagent_name or '-'} | "
                            f"- | - | - |"
                        )
            report_lines.append("\n")
        
        # 禁配警告
        if incompatible_count > 0:
            report_lines.append(f"### 禁配警告\n")
            report_lines.append(f"| 柜位 | 试剂1 | 类别1 | 试剂2 | 类别2 | 问题描述 |")
            report_lines.append(f"|------|-------|-------|-------|-------|----------|")
            
            for cabinet_id, results in validation_results.items():
                cabinet = next((c for c in cabinets if c.id == cabinet_id), None)
                cabinet_name = cabinet.name if cabinet else "未知柜位"
                
                for result in results:
                    if result.alert_type == AlertType.INCOMPATIBLE:
                        report_lines.append(
                            f"| {cabinet_name} | {result.reagent_name or '-'} | "
                            f"- | - | - | {result.message} |"
                        )
            report_lines.append("\n")
        
        # 超期未归还
        if overdue_count > 0:
            report_lines.append(f"### 超期未归还\n")
            report_lines.append(f"| 瓶号 | 预计归还日期 | 超期天数 | 操作人 |")
            report_lines.append(f"|------|--------------|----------|--------|")
            
            for result in overdue_results:
                report_lines.append(
                    f"| {result.bottle_number or '-'} | - | - | - |"
                )
            report_lines.append("\n")
        
        # 禁配规则说明
        report_lines.append(f"## 禁配规则说明\n")
        report_lines.append(f"以下类别的试剂不能存放在同一柜位：\n")
        
        incompatible_pairs = ValidationRules.get_incompatible_pairs()
        for pair in incompatible_pairs:
            report_lines.append(f"- **{pair[0]}** 与 **{pair[1]}** 禁配")
        report_lines.append("\n")
        
        # 巡检确认
        report_lines.append(f"## 巡检确认\n")
        report_lines.append(f"```\n")
        report_lines.append(f"巡检人签字: _______________\n")
        report_lines.append(f"日期: _______________\n")
        report_lines.append(f"```\n")
        report_lines.append("\n---\n")
        report_lines.append(f"*报告生成系统: 危化品柜巡检签收台*\n")
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))
    
    @staticmethod
    def _generate_csv_anomaly_list(
        file_path: str,
        validation_results: Dict[int, List[ValidationResult]],
        overdue_results: List[ValidationResult],
        cabinets: List[Cabinet]
    ):
        """生成 CSV 格式的异常清单"""
        
        # 构建柜位ID到名称的映射
        cabinet_names: Dict[int, str] = {c.id: c.name for c in cabinets}
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '序号', '柜位', '瓶号', '试剂名称', '异常类型', '异常描述', '处理建议'
            ])
            
            row_num = 1
            
            # 写入试剂相关异常
            for cabinet_id, results in validation_results.items():
                cabinet_name = cabinet_names.get(cabinet_id, '未知柜位')
                
                for result in results:
                    if result.alert_type:
                        alert_type_str = result.alert_type.value
                        suggestion = ReportGenerator._get_suggestion(result.alert_type)
                        
                        writer.writerow([
                            row_num,
                            cabinet_name,
                            result.bottle_number or '-',
                            result.reagent_name or '-',
                            alert_type_str,
                            result.message,
                            suggestion
                        ])
                        row_num += 1
            
            # 写入超期未归还异常
            for result in overdue_results:
                if result.alert_type:
                    alert_type_str = result.alert_type.value
                    suggestion = ReportGenerator._get_suggestion(result.alert_type)
                    
                    writer.writerow([
                        row_num,
                        '-',
                        result.bottle_number or '-',
                        '-',
                        alert_type_str,
                        result.message,
                        suggestion
                    ])
                    row_num += 1
    
    @staticmethod
    def _get_suggestion(alert_type: AlertType) -> str:
        """根据预警类型获取处理建议"""
        suggestions = {
            AlertType.EXPIRED: "立即停止使用，按规定程序进行销毁处理，记录销毁过程。",
            AlertType.EXPIRING_SOON: "优先安排使用，如预计无法在有效期内用完，及时申请调拨或报废。",
            AlertType.LOW_STOCK: "及时补充库存，确保实验需求。",
            AlertType.INCOMPATIBLE: "立即调整存放位置，将禁配试剂分柜存放，避免安全风险。",
            AlertType.OVERDUE_RETURN: "立即联系领用人，督促归还，如已丢失按规定处理。"
        }
        return suggestions.get(alert_type, "请联系管理员处理。")
    
    @staticmethod
    def generate_inventory_report(
        check_date: date,
        checker: ResponsiblePerson,
        inventory_checks: List,
        output_dir: str
    ) -> str:
        """
        生成盘点报告
        
        Args:
            check_date: 盘点日期
            checker: 盘点人
            inventory_checks: 盘点记录列表
            output_dir: 输出目录
        
        Returns:
            报告文件路径
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        date_str = check_date.strftime("%Y%m%d")
        timestamp = datetime.now().strftime("%H%M%S")
        filename = f"盘点报告_{date_str}_{timestamp}.csv"
        file_path = str(output_path / filename)
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '瓶号', '试剂名称', '系统数量', '实际数量', '差异', '差异原因', '状态', '备注'
            ])
            
            # 写入数据
            for check in inventory_checks:
                writer.writerow([
                    check.bottle_number,
                    '-',  # 试剂名称需要从试剂表获取，这里简化
                    check.expected_quantity,
                    check.actual_quantity,
                    check.difference,
                    check.difference_reason or '',
                    check.status,
                    check.notes or ''
                ])
        
        return file_path
