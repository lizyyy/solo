#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导出模块
用于导出 issues.csv 和 review_report.md
"""

import csv
from datetime import datetime
from typing import Dict, Any, List, Optional

from models.data_models import PatientData, VisualFieldTest, ReliabilityRules
from services.data_processor import DataProcessor


class Exporter:
    """
    导出器
    负责导出检查结果为 CSV 和 Markdown 格式
    """
    
    @staticmethod
    def export_issues(file_path: str,
                      patient_data: PatientData,
                      data_processor: Optional[DataProcessor],
                      confirmation_states: Dict[int, Dict[str, Any]]):
        """
        导出 issues.csv
        
        Args:
            file_path: 输出文件路径
            patient_data: 患者数据
            data_processor: 数据处理器
            confirmation_states: 确认状态
        """
        # 收集所有问题
        issues = []
        
        # 1. 可靠性问题
        if data_processor:
            # 左眼可靠性问题
            if data_processor.left_eye_reliability:
                for issue in data_processor.left_eye_reliability.get('issues', []):
                    issues.append({
                        'type': 'reliability',
                        'eye': 'left',
                        'description': issue,
                        'severity': 'high',
                        'status': 'pending',
                        'note': '',
                        'confirm_time': ''
                    })
                
                for warning in data_processor.left_eye_reliability.get('warnings', []):
                    issues.append({
                        'type': 'reliability',
                        'eye': 'left',
                        'description': warning,
                        'severity': 'medium',
                        'status': 'pending',
                        'note': '',
                        'confirm_time': ''
                    })
            
            # 右眼可靠性问题
            if data_processor.right_eye_reliability:
                for issue in data_processor.right_eye_reliability.get('issues', []):
                    issues.append({
                        'type': 'reliability',
                        'eye': 'right',
                        'description': issue,
                        'severity': 'high',
                        'status': 'pending',
                        'note': '',
                        'confirm_time': ''
                    })
                
                for warning in data_processor.right_eye_reliability.get('warnings', []):
                    issues.append({
                        'type': 'reliability',
                        'eye': 'right',
                        'description': warning,
                        'severity': 'medium',
                        'status': 'pending',
                        'note': '',
                        'confirm_time': ''
                    })
            
            # 2. 数据质量问题
            for issue in data_processor.data_quality_issues:
                issues.append({
                    'type': 'data_quality',
                    'eye': '',
                    'description': issue,
                    'severity': 'medium',
                    'status': 'pending',
                    'note': '',
                    'confirm_time': ''
                })
            
            # 3. 进展问题
            # 左眼进展
            for point in data_processor.left_eye_progress:
                severity = point.get('severity', 'mild')
                severity_map = {
                    'severe': 'high',
                    'moderate': 'medium',
                    'mild': 'low'
                }
                issues.append({
                    'type': 'progress',
                    'eye': 'left',
                    'description': point.get('description', ''),
                    'location': point.get('location', ''),
                    'x': point.get('x', ''),
                    'y': point.get('y', ''),
                    'latest_value': point.get('latest_value', ''),
                    'change_from_previous': point.get('change_from_previous', ''),
                    'severity': severity_map.get(severity, 'low'),
                    'status': 'pending',
                    'note': '',
                    'confirm_time': ''
                })
            
            # 右眼进展
            for point in data_processor.right_eye_progress:
                severity = point.get('severity', 'mild')
                severity_map = {
                    'severe': 'high',
                    'moderate': 'medium',
                    'mild': 'low'
                }
                issues.append({
                    'type': 'progress',
                    'eye': 'right',
                    'description': point.get('description', ''),
                    'location': point.get('location', ''),
                    'x': point.get('x', ''),
                    'y': point.get('y', ''),
                    'latest_value': point.get('latest_value', ''),
                    'change_from_previous': point.get('change_from_previous', ''),
                    'severity': severity_map.get(severity, 'low'),
                    'status': 'pending',
                    'note': '',
                    'confirm_time': ''
                })
        
        # 应用确认状态
        for idx, state in confirmation_states.items():
            if idx < len(issues):
                issues[idx]['status'] = state.get('status', 'pending')
                issues[idx]['note'] = state.get('note', '')
                issues[idx]['confirm_time'] = state.get('confirm_time', '')
        
        # 写入CSV
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            # 定义字段
            fieldnames = [
                '序号', '类型', '眼别', '严重程度', '状态',
                '描述', '点位位置', 'X坐标', 'Y坐标',
                '当前阈值', '变化量',
                '备注', '确认时间'
            ]
            
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for idx, issue in enumerate(issues, 1):
                # 类型中文
                type_map = {
                    'reliability': '可靠性',
                    'progress': '进展',
                    'data_quality': '数据质量'
                }
                
                # 眼别中文
                eye_map = {
                    'left': '左眼',
                    'right': '右眼',
                    '': ''
                }
                
                # 严重程度中文
                severity_map = {
                    'high': '高',
                    'medium': '中',
                    'low': '低'
                }
                
                # 状态中文
                status_map = {
                    'pending': '待确认',
                    'confirmed': '已确认',
                    'abnormal': '标记异常',
                    'note_added': '有备注'
                }
                
                row = {
                    '序号': idx,
                    '类型': type_map.get(issue.get('type', ''), issue.get('type', '')),
                    '眼别': eye_map.get(issue.get('eye', ''), issue.get('eye', '')),
                    '严重程度': severity_map.get(issue.get('severity', ''), issue.get('severity', '')),
                    '状态': status_map.get(issue.get('status', ''), issue.get('status', '')),
                    '描述': issue.get('description', ''),
                    '点位位置': issue.get('location', ''),
                    'X坐标': issue.get('x', ''),
                    'Y坐标': issue.get('y', ''),
                    '当前阈值': issue.get('latest_value', ''),
                    '变化量': issue.get('change_from_previous', ''),
                    '备注': issue.get('note', ''),
                    '确认时间': issue.get('confirm_time', '')
                }
                
                writer.writerow(row)
                
    @staticmethod
    def export_report(file_path: str,
                      patient_data: PatientData,
                      data_processor: Optional[DataProcessor],
                      confirmation_states: Dict[int, Dict[str, Any]]):
        """
        导出 review_report.md
        
        Args:
            file_path: 输出文件路径
            patient_data: 患者数据
            data_processor: 数据处理器
            confirmation_states: 确认状态
        """
        lines = []
        
        # 标题
        lines.append("# 青光眼视野检查复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 患者信息
        lines.append("## 患者信息")
        lines.append("")
        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append(f"| 患者姓名 | {patient_data.patient_name or '未提供'} |")
        lines.append(f"| 患者ID | {patient_data.patient_id or '未提供'} |")
        
        if patient_data.date_of_birth:
            lines.append(f"| 出生日期 | {patient_data.date_of_birth.strftime('%Y-%m-%d')} |")
        
        if patient_data.gender:
            gender_map = {'male': '男', 'female': '女', 'M': '男', 'F': '女'}
            lines.append(f"| 性别 | {gender_map.get(patient_data.gender, patient_data.gender)} |")
        
        latest_date = patient_data.get_latest_test_date()
        if latest_date:
            lines.append(f"| 检查日期 | {latest_date} |")
        
        lines.append("")
        
        # 检查概览
        lines.append("## 检查概览")
        lines.append("")
        
        # 左眼检查
        if patient_data.left_eye:
            lines.append("### 左眼检查")
            lines.append("")
            
            test = patient_data.left_eye
            lines.append("| 项目 | 内容 |")
            lines.append("|------|------|")
            
            if test.strategy:
                lines.append(f"| 检查策略 | {test.strategy} |")
            if test.md is not None:
                lines.append(f"| 平均缺损 (MD) | {test.md:.2f} dB |")
            if test.psd is not None:
                lines.append(f"| 模式标准差 (PSD) | {test.psd:.2f} dB |")
            if test.vfi is not None:
                lines.append(f"| 视野指数 (VFI) | {test.vfi:.2f}% |")
            
            # 可靠性指标
            lines.append("")
            lines.append("#### 可靠性指标")
            lines.append("")
            lines.append("| 指标 | 数值 | 状态 |")
            lines.append("|------|------|------|")
            
            fixation_rate = test.get_fixation_loss_rate() * 100
            fp_rate = test.get_false_positive_rate() * 100
            fn_rate = test.get_false_negative_rate() * 100
            
            # 简单的状态判断
            fixation_status = "正常" if fixation_rate < 20 else "异常" if fixation_rate >= 30 else "注意"
            fp_status = "正常" if fp_rate < 15 else "异常" if fp_rate >= 20 else "注意"
            fn_status = "正常" if fn_rate < 20 else "异常" if fn_rate >= 30 else "注意"
            
            lines.append(f"| 固视丢失 | {fixation_rate:.1f}% ({test.fixation_losses}/{test.fixation_total}) | {fixation_status} |")
            lines.append(f"| 假阳性 | {fp_rate:.1f}% ({test.false_positives}/{test.false_positive_total}) | {fp_status} |")
            lines.append(f"| 假阴性 | {fn_rate:.1f}% ({test.false_negatives}/{test.false_negative_total}) | {fn_status} |")
            
            # 可靠性评分
            if data_processor and data_processor.left_eye_reliability:
                reliability = data_processor.left_eye_reliability
                lines.append("")
                lines.append(f"**综合可靠性评分**: {reliability.get('score', 0):.1f} 分")
                level = reliability.get('level', {})
                lines.append(f"**等级**: {level.get('label', '未知')}")
                lines.append(f"**描述**: {level.get('description', '')}")
                
                # 问题列表
                issues = reliability.get('issues', [])
                if issues:
                    lines.append("")
                    lines.append("##### 问题列表")
                    lines.append("")
                    for issue in issues:
                        lines.append(f"- ❌ {issue}")
                
                warnings = reliability.get('warnings', [])
                if warnings:
                    lines.append("")
                    lines.append("##### 警告列表")
                    lines.append("")
                    for warning in warnings:
                        lines.append(f"- ⚠️ {warning}")
            
            lines.append("")
        
        # 右眼检查
        if patient_data.right_eye:
            lines.append("### 右眼检查")
            lines.append("")
            
            test = patient_data.right_eye
            lines.append("| 项目 | 内容 |")
            lines.append("|------|------|")
            
            if test.strategy:
                lines.append(f"| 检查策略 | {test.strategy} |")
            if test.md is not None:
                lines.append(f"| 平均缺损 (MD) | {test.md:.2f} dB |")
            if test.psd is not None:
                lines.append(f"| 模式标准差 (PSD) | {test.psd:.2f} dB |")
            if test.vfi is not None:
                lines.append(f"| 视野指数 (VFI) | {test.vfi:.2f}% |")
            
            # 可靠性指标
            lines.append("")
            lines.append("#### 可靠性指标")
            lines.append("")
            lines.append("| 指标 | 数值 | 状态 |")
            lines.append("|------|------|------|")
            
            fixation_rate = test.get_fixation_loss_rate() * 100
            fp_rate = test.get_false_positive_rate() * 100
            fn_rate = test.get_false_negative_rate() * 100
            
            fixation_status = "正常" if fixation_rate < 20 else "异常" if fixation_rate >= 30 else "注意"
            fp_status = "正常" if fp_rate < 15 else "异常" if fp_rate >= 20 else "注意"
            fn_status = "正常" if fn_rate < 20 else "异常" if fn_rate >= 30 else "注意"
            
            lines.append(f"| 固视丢失 | {fixation_rate:.1f}% ({test.fixation_losses}/{test.fixation_total}) | {fixation_status} |")
            lines.append(f"| 假阳性 | {fp_rate:.1f}% ({test.false_positives}/{test.false_positive_total}) | {fp_status} |")
            lines.append(f"| 假阴性 | {fn_rate:.1f}% ({test.false_negatives}/{test.false_negative_total}) | {fn_status} |")
            
            # 可靠性评分
            if data_processor and data_processor.right_eye_reliability:
                reliability = data_processor.right_eye_reliability
                lines.append("")
                lines.append(f"**综合可靠性评分**: {reliability.get('score', 0):.1f} 分")
                level = reliability.get('level', {})
                lines.append(f"**等级**: {level.get('label', '未知')}")
                lines.append(f"**描述**: {level.get('description', '')}")
                
                issues = reliability.get('issues', [])
                if issues:
                    lines.append("")
                    lines.append("##### 问题列表")
                    lines.append("")
                    for issue in issues:
                        lines.append(f"- ❌ {issue}")
                
                warnings = reliability.get('warnings', [])
                if warnings:
                    lines.append("")
                    lines.append("##### 警告列表")
                    lines.append("")
                    for warning in warnings:
                        lines.append(f"- ⚠️ {warning}")
            
            lines.append("")
        
        # 进展分析
        if data_processor and (data_processor.left_eye_progress or data_processor.right_eye_progress):
            lines.append("## 进展分析")
            lines.append("")
            
            # 左眼进展
            if data_processor.left_eye_progress:
                lines.append("### 左眼疑似进展点位")
                lines.append("")
                
                lines.append("| 点位 | 位置 | 严重程度 | 描述 | 当前阈值 | 变化量 |")
                lines.append("|------|------|----------|------|----------|--------|")
                
                for point in data_processor.left_eye_progress:
                    location = point.get('location', '')
                    x = point.get('x', '')
                    y = point.get('y', '')
                    pos_str = f"({x}, {y})" if x and y else ""
                    
                    severity_label = point.get('severity_label', point.get('severity', ''))
                    description = point.get('description', '')
                    latest_value = point.get('latest_value', '')
                    change = point.get('change_from_previous', '')
                    
                    if isinstance(latest_value, (int, float)):
                        latest_value = f"{latest_value:.1f} dB"
                    if isinstance(change, (int, float)):
                        sign = "-" if change < 0 else "+"
                        change = f"{sign}{abs(change):.1f} dB"
                    
                    lines.append(f"| {location} | {pos_str} | {severity_label} | {description} | {latest_value} | {change} |")
                
                lines.append("")
            
            # 右眼进展
            if data_processor.right_eye_progress:
                lines.append("### 右眼疑似进展点位")
                lines.append("")
                
                lines.append("| 点位 | 位置 | 严重程度 | 描述 | 当前阈值 | 变化量 |")
                lines.append("|------|------|----------|------|----------|--------|")
                
                for point in data_processor.right_eye_progress:
                    location = point.get('location', '')
                    x = point.get('x', '')
                    y = point.get('y', '')
                    pos_str = f"({x}, {y})" if x and y else ""
                    
                    severity_label = point.get('severity_label', point.get('severity', ''))
                    description = point.get('description', '')
                    latest_value = point.get('latest_value', '')
                    change = point.get('change_from_previous', '')
                    
                    if isinstance(latest_value, (int, float)):
                        latest_value = f"{latest_value:.1f} dB"
                    if isinstance(change, (int, float)):
                        sign = "-" if change < 0 else "+"
                        change = f"{sign}{abs(change):.1f} dB"
                    
                    lines.append(f"| {location} | {pos_str} | {severity_label} | {description} | {latest_value} | {change} |")
                
                lines.append("")
        
        # 数据质量问题
        if data_processor and data_processor.data_quality_issues:
            lines.append("## 数据质量问题")
            lines.append("")
            
            for issue in data_processor.data_quality_issues:
                lines.append(f"- ⚠️ {issue}")
            
            lines.append("")
        
        # 复核状态
        lines.append("## 复核状态")
        lines.append("")
        
        # 统计确认状态
        pending_count = 0
        confirmed_count = 0
        abnormal_count = 0
        note_count = 0
        
        for state in confirmation_states.values():
            status = state.get('status', 'pending')
            if status == 'pending':
                pending_count += 1
            elif status == 'confirmed':
                confirmed_count += 1
            elif status == 'abnormal':
                abnormal_count += 1
            elif status == 'note_added':
                note_count += 1
        
        lines.append(f"- **待确认**: {pending_count} 项")
        lines.append(f"- **已确认**: {confirmed_count} 项")
        lines.append(f"- **标记异常**: {abnormal_count} 项")
        lines.append(f"- **有备注**: {note_count} 项")
        lines.append("")
        
        # 详细复核记录
        if confirmation_states:
            lines.append("### 详细复核记录")
            lines.append("")
            
            lines.append("| 序号 | 状态 | 备注 | 确认时间 |")
            lines.append("|------|------|------|----------|")
            
            status_map = {
                'pending': '待确认',
                'confirmed': '已确认',
                'abnormal': '标记异常',
                'note_added': '有备注'
            }
            
            for idx, state in sorted(confirmation_states.items()):
                status = state.get('status', 'pending')
                note = state.get('note', '')
                confirm_time = state.get('confirm_time', '')
                
                lines.append(f"| {idx + 1} | {status_map.get(status, status)} | {note} | {confirm_time} |")
            
            lines.append("")
        
        # 历史检查记录
        if patient_data.left_eye_history or patient_data.right_eye_history:
            lines.append("## 历史检查记录")
            lines.append("")
            
            # 左眼历史
            if patient_data.left_eye_history:
                lines.append("### 左眼历史检查")
                lines.append("")
                lines.append("| 序号 | 检查日期 | MD | PSD | VFI |")
                lines.append("|------|----------|-----|-----|-----|")
                
                for idx, test in enumerate(patient_data.left_eye_history, 1):
                    date_str = test.test_date.strftime('%Y-%m-%d') if test.test_date else '未知'
                    md = f"{test.md:.2f}" if test.md is not None else ''
                    psd = f"{test.psd:.2f}" if test.psd is not None else ''
                    vfi = f"{test.vfi:.2f}%" if test.vfi is not None else ''
                    
                    lines.append(f"| {idx} | {date_str} | {md} | {psd} | {vfi} |")
                
                lines.append("")
            
            # 右眼历史
            if patient_data.right_eye_history:
                lines.append("### 右眼历史检查")
                lines.append("")
                lines.append("| 序号 | 检查日期 | MD | PSD | VFI |")
                lines.append("|------|----------|-----|-----|-----|")
                
                for idx, test in enumerate(patient_data.right_eye_history, 1):
                    date_str = test.test_date.strftime('%Y-%m-%d') if test.test_date else '未知'
                    md = f"{test.md:.2f}" if test.md is not None else ''
                    psd = f"{test.psd:.2f}" if test.psd is not None else ''
                    vfi = f"{test.vfi:.2f}%" if test.vfi is not None else ''
                    
                    lines.append(f"| {idx} | {date_str} | {md} | {psd} | {vfi} |")
                
                lines.append("")
        
        # 备注
        lines.append("## 备注")
        lines.append("")
        lines.append("- 本报告由系统自动生成，仅供参考")
        lines.append("- 请结合临床实际情况进行判断")
        lines.append("- 如有疑问，请咨询专业医生")
        lines.append("")
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
