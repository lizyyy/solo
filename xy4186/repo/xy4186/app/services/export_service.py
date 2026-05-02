import csv
import json
import os
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from io import StringIO

from app.models.models import (
    BroadcastEvent,
    Program,
    Contract,
    ValidationResult,
    HumanOpinion,
    AuditLog
)
from app.services.storage_service import StorageService
from app.services.rules_engine import RulesEngine


class ExportService:
    
    @staticmethod
    def export_validation_markdown(broadcast_date: date, 
                                    include_details: bool = True) -> str:
        validation_result = RulesEngine.validate_all(broadcast_date)
        events = StorageService.get_events_for_day_ordered(broadcast_date)
        programs = StorageService.list_programs(broadcast_date=broadcast_date)
        
        md_lines = []
        md_lines.append(f'# 广告串播合规核查报告')
        md_lines.append(f'')
        md_lines.append(f'**核查日期**: {broadcast_date}')
        md_lines.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        md_lines.append(f'')
        md_lines.append('---')
        md_lines.append('')
        
        md_lines.append('## 一、核查概览')
        md_lines.append('')
        md_lines.append('| 指标 | 数值 |')
        md_lines.append('|------|------|')
        md_lines.append(f'| 执行规则数 | {validation_result.get("validation_count", 0)} |')
        md_lines.append(f'| 错误数 | {validation_result.get("error_count", 0)} |')
        md_lines.append(f'| 警告数 | {validation_result.get("warning_count", 0)} |')
        md_lines.append(f'| 播出事件数 | {len(events)} |')
        md_lines.append(f'| 节目数 | {len(programs)} |')
        md_lines.append('')
        
        overall_status = '✅ 合规' if validation_result.get('error_count', 0) == 0 else '❌ 存在问题'
        md_lines.append(f'**总体状态**: {overall_status}')
        md_lines.append('')
        
        md_lines.append('---')
        md_lines.append('')
        
        md_lines.append('## 二、问题列表')
        md_lines.append('')
        
        results = validation_result.get('results', [])
        failed_results = [r for r in results if not r.get('passed', True)]
        
        if not failed_results:
            md_lines.append('✅ 当日无合规问题')
            md_lines.append('')
        else:
            errors = [r for r in failed_results if r.get('severity') == 'error']
            warnings = [r for r in failed_results if r.get('severity') == 'warning']
            
            if errors:
                md_lines.append('### ❌ 严重错误')
                md_lines.append('')
                for idx, r in enumerate(errors, 1):
                    md_lines.append(f'#### {idx}. {r.get("title")}')
                    md_lines.append('')
                    md_lines.append(f'- **规则代码**: {r.get("rule_code")}')
                    md_lines.append(f'- **描述**: {r.get("description")}')
                    if r.get('affected_time'):
                        md_lines.append(f'- **发生时间**: {r.get("affected_date")} {r.get("affected_time")}')
                    if r.get('related_brand'):
                        md_lines.append(f'- **相关品牌**: {r.get("related_brand")}')
                    if include_details and r.get('related_event_ids'):
                        md_lines.append(f'- **相关事件ID**: {r.get("related_event_ids")}')
                    md_lines.append('')
            
            if warnings:
                md_lines.append('### ⚠️ 警告')
                md_lines.append('')
                for idx, r in enumerate(warnings, 1):
                    md_lines.append(f'#### {idx}. {r.get("title")}')
                    md_lines.append('')
                    md_lines.append(f'- **规则代码**: {r.get("rule_code")}')
                    md_lines.append(f'- **描述**: {r.get("description")}')
                    if r.get('affected_time'):
                        md_lines.append(f'- **发生时间**: {r.get("affected_date")} {r.get("affected_time")}')
                    if r.get('related_brand'):
                        md_lines.append(f'- **相关品牌**: {r.get("related_brand")}')
                    md_lines.append('')
        
        md_lines.append('---')
        md_lines.append('')
        
        md_lines.append('## 三、当日播出清单')
        md_lines.append('')
        
        if events:
            md_lines.append('| 时间 | 品牌 | 广告名称 | 时长(秒) | 行业分类 | 状态 |')
            md_lines.append('|------|------|----------|----------|----------|------|')
            
            for event in events:
                time_str = event.broadcast_time.strftime('%H:%M:%S') if event.broadcast_time else ''
                duration = event.duration_seconds or '-'
                category = event.industry_category or '-'
                status = event.status or '-'
                
                md_lines.append(f'| {time_str} | {event.brand_name or "-"} | {event.ad_name or "-"} | {duration} | {category} | {status} |')
        else:
            md_lines.append('当日无播出事件')
        
        md_lines.append('')
        
        md_lines.append('---')
        md_lines.append('')
        
        md_lines.append('## 四、规则检查详情')
        md_lines.append('')
        
        for r in results:
            status_icon = '✅' if r.get('passed', False) else '❌'
            md_lines.append(f'### {status_icon} {r.get("title")}')
            md_lines.append('')
            md_lines.append(f'- **规则代码**: {r.get("rule_code")}')
            md_lines.append(f'- **结果**: {"通过" if r.get("passed") else "不通过"}')
            md_lines.append(f'- **严重程度**: {r.get("severity")}')
            md_lines.append(f'- **描述**: {r.get("description")}')
            md_lines.append('')
        
        return '\n'.join(md_lines)
    
    @staticmethod
    def export_problems_csv(broadcast_date: date) -> str:
        validation_result = RulesEngine.validate_all(broadcast_date)
        results = validation_result.get('results', [])
        failed_results = [r for r in results if not r.get('passed', True)]
        
        output = StringIO()
        fieldnames = [
            '序号', '规则代码', '问题标题', '问题描述', '严重程度',
            '发生日期', '发生时间', '相关品牌', '相关事件ID'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for idx, r in enumerate(failed_results, 1):
            writer.writerow({
                '序号': idx,
                '规则代码': r.get('rule_code', ''),
                '问题标题': r.get('title', ''),
                '问题描述': r.get('description', ''),
                '严重程度': r.get('severity', ''),
                '发生日期': r.get('affected_date', '') or '',
                '发生时间': r.get('affected_time', '') or '',
                '相关品牌': r.get('related_brand', '') or '',
                '相关事件ID': str(r.get('related_event_ids', [])) if r.get('related_event_ids') else ''
            })
        
        return output.getvalue()
    
    @staticmethod
    def export_audit_json(broadcast_date: date, 
                          include_events: bool = True,
                          include_programs: bool = True,
                          include_contracts: bool = True,
                          include_opinions: bool = True) -> str:
        
        validation_result = RulesEngine.validate_all(broadcast_date)
        
        schedule_log_compare = RulesEngine.compare_schedule_vs_log(broadcast_date)
        
        events = StorageService.get_events_for_day_ordered(broadcast_date)
        programs = StorageService.list_programs(broadcast_date=broadcast_date)
        contracts = StorageService.list_contracts(status='active')
        
        validation_results_db = StorageService.get_validation_results(status='open')
        
        audit_package = {
            'audit_metadata': {
                'export_date': datetime.now().isoformat(),
                'target_date': str(broadcast_date),
                'version': '1.0'
            },
            'validation_summary': {
                'rule_count': validation_result.get('validation_count', 0),
                'error_count': validation_result.get('error_count', 0),
                'warning_count': validation_result.get('warning_count', 0),
                'is_compliant': validation_result.get('error_count', 0) == 0
            },
            'schedule_log_alignment': schedule_log_compare,
            'validation_details': validation_result.get('results', [])
        }
        
        if include_events and events:
            audit_package['broadcast_events'] = [
                {
                    'id': e.id,
                    'brand_name': e.brand_name,
                    'ad_name': e.ad_name,
                    'duration_seconds': e.duration_seconds,
                    'industry_category': e.industry_category,
                    'broadcast_date': str(e.broadcast_date),
                    'broadcast_time': str(e.broadcast_time) if e.broadcast_time else None,
                    'source_type': e.source_type,
                    'status': e.status,
                    'is_rerun': e.is_rerun,
                    'log_verified': e.log_verified
                }
                for e in events
            ]
        
        if include_programs and programs:
            audit_package['programs'] = [
                {
                    'id': p.id,
                    'program_code': p.program_code,
                    'program_name': p.program_name,
                    'category': p.category,
                    'is_children_program': p.is_children_program,
                    'broadcast_date': str(p.broadcast_date),
                    'start_time': str(p.start_time) if p.start_time else None,
                    'end_time': str(p.end_time) if p.end_time else None,
                    'duration_seconds': p.duration_seconds
                }
                for p in programs
            ]
        
        if include_contracts and contracts:
            audit_package['active_contracts'] = [
                {
                    'id': c.id,
                    'contract_code': c.contract_code,
                    'contract_name': c.contract_name,
                    'advertiser_name': c.advertiser_name,
                    'brand_name': c.brand_name,
                    'industry_category': c.industry_category,
                    'total_duration_seconds': c.total_duration_seconds,
                    'used_duration_seconds': c.used_duration_seconds,
                    'remaining_duration_seconds': c.remaining_duration_seconds,
                    'start_date': str(c.start_date),
                    'end_date': str(c.end_date),
                    'status': c.status
                }
                for c in contracts
            ]
        
        if include_opinions:
            opinions = []
            for vr in validation_results_db:
                ops = StorageService.get_opinions_by_validation(vr.id)
                for op in ops:
                    opinions.append({
                        'id': op.id,
                        'validation_result_id': op.validation_result_id,
                        'opinion_type': op.opinion_type,
                        'content': op.content,
                        'reviewer_name': op.reviewer_name,
                        'decision': op.decision,
                        'is_overruled': op.is_overruled,
                        'created_at': op.created_at.isoformat() if op.created_at else None
                    })
            if opinions:
                audit_package['human_opinions'] = opinions
        
        return json.dumps(audit_package, ensure_ascii=False, indent=2)
    
    @staticmethod
    def export_events_csv(broadcast_date: date, 
                          source_type: Optional[str] = None) -> str:
        events = StorageService.list_events(
            broadcast_date=broadcast_date,
            source_type=source_type
        )
        
        output = StringIO()
        fieldnames = [
            'ID', '品牌', '广告名称', '时长(秒)', '行业分类',
            '播出日期', '播出时间', '来源类型', '状态', '是否补播', '日志已验证'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for e in events:
            writer.writerow({
                'ID': e.id,
                '品牌': e.brand_name or '',
                '广告名称': e.ad_name or '',
                '时长(秒)': e.duration_seconds or '',
                '行业分类': e.industry_category or '',
                '播出日期': str(e.broadcast_date),
                '播出时间': str(e.broadcast_time) if e.broadcast_time else '',
                '来源类型': e.source_type or '',
                '状态': e.status or '',
                '是否补播': '是' if e.is_rerun else '否',
                '日志已验证': '是' if e.log_verified else '否'
            })
        
        return output.getvalue()
    
    @staticmethod
    def export_contracts_csv() -> str:
        contracts = StorageService.list_contracts()
        
        output = StringIO()
        fieldnames = [
            '合同编码', '合同名称', '广告主', '品牌', '行业分类',
            '总时长(秒)', '已使用(秒)', '剩余(秒)', '开始日期', '结束日期', '状态'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for c in contracts:
            writer.writerow({
                '合同编码': c.contract_code,
                '合同名称': c.contract_name or '',
                '广告主': c.advertiser_name,
                '品牌': c.brand_name,
                '行业分类': c.industry_category or '',
                '总时长(秒)': c.total_duration_seconds,
                '已使用(秒)': c.used_duration_seconds,
                '剩余(秒)': c.remaining_duration_seconds,
                '开始日期': str(c.start_date),
                '结束日期': str(c.end_date),
                '状态': c.status
            })
        
        return output.getvalue()
    
    @staticmethod
    def export_daily_report_markdown(broadcast_date: date) -> str:
        md_lines = []
        md_lines.append(f'# 每日播出报告')
        md_lines.append(f'')
        md_lines.append(f'**日期**: {broadcast_date}')
        md_lines.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        md_lines.append('')
        md_lines.append('---')
        md_lines.append('')
        
        validation_result = RulesEngine.validate_all(broadcast_date)
        events = StorageService.get_events_for_day_ordered(broadcast_date)
        
        md_lines.append('## 1. 合规状态')
        md_lines.append('')
        
        error_count = validation_result.get('error_count', 0)
        warning_count = validation_result.get('warning_count', 0)
        
        if error_count == 0:
            md_lines.append('✅ **当日合规检查通过**')
        else:
            md_lines.append(f'❌ **存在{error_count}个严重问题，{warning_count}个警告**')
        md_lines.append('')
        
        schedule_events = StorageService.list_events(
            broadcast_date=broadcast_date, source_type='schedule'
        )
        log_events = StorageService.list_events(
            broadcast_date=broadcast_date, source_type='log'
        )
        
        md_lines.append('## 2. 排期与日志对齐')
        md_lines.append('')
        md_lines.append(f'- 排期事件数: {len(schedule_events)}')
        md_lines.append(f'- 日志事件数: {len(log_events)}')
        
        compare_result = RulesEngine.compare_schedule_vs_log(broadcast_date)
        md_lines.append(f'- 匹配数: {compare_result.get("matched_count", 0)}')
        
        missing_log = compare_result.get('missing_in_log', [])
        missing_schedule = compare_result.get('missing_in_schedule', [])
        
        if missing_log:
            md_lines.append(f'- ⚠️ 排期有但日志无: {len(missing_log)}个事件')
        if missing_schedule:
            md_lines.append(f'- ⚠️ 日志有但排期无: {len(missing_schedule)}个事件')
        md_lines.append('')
        
        md_lines.append('## 3. 品牌播出统计')
        md_lines.append('')
        
        brand_stats = {}
        for e in events:
            if e.brand_name:
                if e.brand_name not in brand_stats:
                    brand_stats[e.brand_name] = {'count': 0, 'total_seconds': 0}
                brand_stats[e.brand_name]['count'] += 1
                if e.duration_seconds:
                    brand_stats[e.brand_name]['total_seconds'] += e.duration_seconds
        
        if brand_stats:
            md_lines.append('| 品牌 | 播出次数 | 总时长(秒) | 平均时长(秒) |')
            md_lines.append('|------|----------|------------|--------------|')
            
            for brand, stats in sorted(brand_stats.items(), key=lambda x: x[1]['count'], reverse=True):
                avg_duration = stats['total_seconds'] / stats['count'] if stats['count'] > 0 else 0
                md_lines.append(f'| {brand} | {stats["count"]} | {stats["total_seconds"]} | {avg_duration:.1f} |')
        else:
            md_lines.append('当日无品牌播出记录')
        md_lines.append('')
        
        return '\n'.join(md_lines)
