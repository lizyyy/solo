import pandas as pd
import numpy as np
from datetime import datetime, date
from typing import Dict, List, Optional, Any, Tuple
from io import StringIO
import os


def export_markdown_report(
    complaints_df: pd.DataFrame,
    decibel_df: pd.DataFrame,
    enforcement_df: pd.DataFrame,
    permits_df: pd.DataFrame,
    violations_df: pd.DataFrame,
    stats: Dict[str, Any],
    report_date: Optional[date] = None,
    title: str = "社区夜间噪声治理周报",
    include_details: bool = True
) -> str:
    """
    生成Markdown格式的周报
    
    参数:
    - complaints_df: 投诉数据
    - decibel_df: 分贝仪数据
    - enforcement_df: 执法记录
    - permits_df: 施工许可
    - violations_df: 违规记录
    - stats: 统计信息
    - report_date: 报告日期
    - title: 报告标题
    - include_details: 是否包含详细列表
    
    返回:
    - Markdown字符串
    """
    report_date = report_date or datetime.now().date()
    
    # 构建Markdown内容
    md = []
    
    # 标题
    md.append(f"# {title}")
    md.append(f"**报告日期**: {report_date.strftime('%Y年%m月%d日')}")
    md.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    md.append("")
    
    # 概览
    md.append("## 1. 本周概览")
    md.append("")
    
    # 统计卡片
    total_complaints = len(complaints_df) if not complaints_df.empty else 0
    night_complaints = complaints_df[complaints_df['is_night'] == True].shape[0] if not complaints_df.empty and 'is_night' in complaints_df.columns else 0
    total_violations = len(violations_df) if not violations_df.empty else 0
    high_severity = violations_df[violations_df['severity'] == 'high'].shape[0] if not violations_df.empty and 'severity' in violations_df.columns else 0
    
    md.append("| 指标 | 数值 |")
    md.append("|------|------|")
    md.append(f"| 总投诉数 | {total_complaints} 起 |")
    md.append(f"| 夜间投诉数 | {night_complaints} 起 |")
    md.append(f"| 检测到的违规数 | {total_violations} 起 |")
    md.append(f"| 高优先级违规 | {high_severity} 起 |")
    md.append("")
    
    # 关键统计
    if stats:
        md.append("### 1.1 关键指标")
        md.append("")
        
        # 噪声超标统计
        if 'exceedance' in stats:
            exc = stats['exceedance']
            md.append(f"- **噪声超标率**: {exc.get('exceedance_ratio', 0):.1%}")
            md.append(f"- **夜间超标率**: {exc.get('night_exceedance_ratio', 0):.1%}")
            md.append(f"- **昼间超标率**: {exc.get('day_exceedance_ratio', 0):.1%}")
            md.append("")
        
        # 重复投诉统计
        if 'duplicates' in stats:
            dup = stats['duplicates']
            md.append(f"- **重复投诉组数**: {dup.get('duplicate_groups', 0)} 组")
            md.append(f"- **重复投诉总数**: {dup.get('duplicate_complaints', 0)} 起")
            md.append(f"- **去重后有效投诉**: {dup.get('unique_complaints', 0)} 起")
            md.append("")
        
        # 响应时间统计
        if 'response' in stats:
            resp = stats['response']
            md.append(f"- **执法响应率**: {resp.get('response_rate', 0):.1%}")
            md.append(f"- **平均响应时间**: {resp.get('avg_response_time_minutes', 0):.1f} 分钟")
            md.append(f"- **中位响应时间**: {resp.get('median_response_time_minutes', 0):.1f} 分钟")
            md.append("")
    
    # 投诉分析
    md.append("## 2. 投诉分析")
    md.append("")
    
    if not complaints_df.empty:
        # 按小区分布
        if 'community' in complaints_df.columns:
            md.append("### 2.1 投诉小区分布")
            md.append("")
            
            community_counts = complaints_df['community'].value_counts()
            if len(community_counts) > 0:
                md.append("| 小区 | 投诉数 | 占比 |")
                md.append("|------|--------|------|")
                total = community_counts.sum()
                for comm, count in community_counts.head(10).items():
                    percentage = count / total * 100
                    md.append(f"| {comm} | {count} | {percentage:.1f}% |")
                md.append("")
        
        # 按噪声源分布
        if 'noise_source' in complaints_df.columns:
            md.append("### 2.2 噪声源分布")
            md.append("")
            
            source_counts = complaints_df['noise_source'].value_counts()
            if len(source_counts) > 0:
                md.append("| 噪声源类型 | 投诉数 | 占比 |")
                md.append("|------------|--------|------|")
                total = source_counts.sum()
                for source, count in source_counts.head(10).items():
                    percentage = count / total * 100
                    md.append(f"| {source} | {count} | {percentage:.1f}% |")
                md.append("")
        
        # 投诉时间分布
        if 'hour' in complaints_df.columns:
            md.append("### 2.3 投诉时间分布")
            md.append("")
            
            hour_counts = complaints_df['hour'].value_counts().sort_index()
            peak_hour = hour_counts.idxmax() if len(hour_counts) > 0 else None
            
            md.append(f"- **投诉高峰时段**: {peak_hour}:00 时" if peak_hour else "")
            md.append("- **24小时分布**:")
            md.append("")
            md.append("```")
            for hour in range(24):
                count = hour_counts.get(hour, 0)
                bar = '█' * min(count, 20) if count > 0 else '░'
                md.append(f"{hour:02d}:00 {bar} ({count})")
            md.append("```")
            md.append("")
    else:
        md.append("*本周无投诉数据*")
        md.append("")
    
    # 噪声监测
    md.append("## 3. 噪声监测分析")
    md.append("")
    
    if not decibel_df.empty:
        # 整体统计
        if 'db_value' in decibel_df.columns:
            avg_db = decibel_df['db_value'].mean()
            max_db = decibel_df['db_value'].max()
            min_db = decibel_df['db_value'].min()
            
            md.append(f"- **平均噪声水平**: {avg_db:.1f} dB")
            md.append(f"- **最高噪声水平**: {max_db:.1f} dB")
            md.append(f"- **最低噪声水平**: {min_db:.1f} dB")
            md.append("")
        
        # 夜间vs昼间
        if 'is_night' in decibel_df.columns:
            night_df = decibel_df[decibel_df['is_night'] == True]
            day_df = decibel_df[decibel_df['is_night'] == False]
            
            md.append("### 3.1 昼夜对比")
            md.append("")
            
            md.append("| 时段 | 测量次数 | 平均分贝 | 超标次数 | 超标率 |")
            md.append("|------|----------|----------|----------|--------|")
            
            for name, df in [("夜间 (22:00-06:00)", night_df), ("昼间 (06:00-22:00)", day_df)]:
                if not df.empty:
                    avg = df['db_value'].mean() if 'db_value' in df.columns else 0
                    exceed_count = df['exceeds_standard'].sum() if 'exceeds_standard' in df.columns else 0
                    exceed_ratio = exceed_count / len(df) if len(df) > 0 else 0
                    md.append(f"| {name} | {len(df)} | {avg:.1f} | {exceed_count} | {exceed_ratio:.1%} |")
                else:
                    md.append(f"| {name} | 0 | - | 0 | 0% |")
            md.append("")
    else:
        md.append("*本周无噪声监测数据*")
        md.append("")
    
    # 违规记录
    md.append("## 4. 违规记录")
    md.append("")
    
    if not violations_df.empty:
        md.append("### 4.1 违规类型分布")
        md.append("")
        
        if 'violation_type' in violations_df.columns:
            type_counts = violations_df['violation_type'].value_counts()
            md.append("| 违规类型 | 数量 |")
            md.append("|----------|------|")
            for vtype, count in type_counts.items():
                md.append(f"| {vtype} | {count} |")
            md.append("")
        
        if 'severity' in violations_df.columns:
            md.append("### 4.2 严重程度分布")
            md.append("")
            
            severity_counts = violations_df['severity'].value_counts()
            severity_colors = {
                'high': '🔴',
                'medium': '🟡',
                'low': '🟢'
            }
            
            for severity, count in severity_counts.items():
                emoji = severity_colors.get(severity, '⚪')
                name_map = {'high': '高', 'medium': '中', 'low': '低'}
                name = name_map.get(severity, severity)
                md.append(f"- {emoji} **{name}优先级**: {count} 起")
            md.append("")
        
        if include_details:
            md.append("### 4.3 违规详情列表")
            md.append("")
            
            # 按优先级排序显示
            priority_order = {'high': 0, 'medium': 1, 'low': 2}
            if 'severity' in violations_df.columns:
                violations_df = violations_df.sort_values(by='severity', key=lambda x: x.map(priority_order))
            
            display_cols = ['violation_id', 'violation_type', 'severity', 'description', 'is_verified']
            available_cols = [c for c in display_cols if c in violations_df.columns]
            
            if available_cols:
                # 显示前20条
                for idx, row in violations_df.head(20).iterrows():
                    vid = row.get('violation_id', 'N/A')
                    vtype = row.get('violation_type', 'N/A')
                    severity = row.get('severity', 'N/A')
                    desc = row.get('description', 'N/A')
                    verified = "✅ 已核实" if row.get('is_verified', False) else "⏳ 未核实"
                    
                    severity_emoji = severity_colors.get(severity, '⚪')
                    md.append(f"#### {severity_emoji} {vid} - {vtype}")
                    md.append(f"")
                    md.append(f"**严重程度**: {severity}")
                    md.append(f"**核实状态**: {verified}")
                    md.append(f"**描述**: {desc}")
                    md.append("")
    else:
        md.append("*本周未检测到违规记录*")
        md.append("")
    
    # 执法响应
    md.append("## 5. 执法响应情况")
    md.append("")
    
    if not enforcement_df.empty:
        total_enforcement = len(enforcement_df)
        md.append(f"- **总执法次数**: {total_enforcement} 次")
        
        if 'is_night_enforcement' in enforcement_df.columns:
            night_enforcement = enforcement_df[enforcement_df['is_night_enforcement'] == True].shape[0]
            md.append(f"- **夜间执法次数**: {night_enforcement} 次")
        md.append("")
        
        # 处理结果分布
        if 'result' in enforcement_df.columns:
            md.append("### 5.1 处理结果分布")
            md.append("")
            
            result_counts = enforcement_df['result'].value_counts()
            if len(result_counts) > 0:
                md.append("| 处理结果 | 数量 | 占比 |")
                md.append("|----------|------|------|")
                total = result_counts.sum()
                for result, count in result_counts.items():
                    percentage = count / total * 100
                    md.append(f"| {result} | {count} | {percentage:.1f}% |")
                md.append("")
    else:
        md.append("*本周无执法记录数据*")
        md.append("")
    
    # 施工许可
    md.append("## 6. 施工许可情况")
    md.append("")
    
    if not permits_df.empty:
        total_permits = len(permits_df)
        md.append(f"- **有效施工许可**: {total_permits} 项")
        
        if 'permitted_night_work' in permits_df.columns:
            night_permits = permits_df[permits_df['permitted_night_work'] == True].shape[0]
            md.append(f"- **含夜间施工许可**: {night_permits} 项")
        md.append("")
        
        if include_details:
            md.append("### 6.1 许可项目列表")
            md.append("")
            
            display_cols = ['permit_id', 'project_name', 'location', 'permit_start_date', 'permit_end_date', 'permitted_night_work']
            available_cols = [c for c in display_cols if c in permits_df.columns]
            
            if available_cols:
                md.append("| " + " | ".join(available_cols) + " |")
                md.append("| " + " | ".join(["---"] * len(available_cols)) + " |")
                
                for _, row in permits_df.head(10).iterrows():
                    values = []
                    for col in available_cols:
                        val = row.get(col, '')
                        if col == 'permitted_night_work':
                            val = "是" if val else "否"
                        values.append(str(val))
                    md.append("| " + " | ".join(values) + " |")
                md.append("")
    else:
        md.append("*本周无施工许可数据*")
        md.append("")
    
    # 建议和措施
    md.append("## 7. 建议与措施")
    md.append("")
    
    suggestions = []
    
    if high_severity > 0:
        suggestions.append(f"- 🔴 优先处理 {high_severity} 起高优先级违规")
    
    if night_complaints > total_complaints * 0.5:
        suggestions.append("- 🌙 夜间投诉占比过高，建议加强夜间巡查")
    
    if stats and 'response' in stats:
        avg_resp = stats['response'].get('avg_response_time_minutes', 0)
        if avg_resp > 30:
            suggestions.append("- ⏰ 执法响应时间较长，建议优化调度流程")
    
    if suggestions:
        for s in suggestions:
            md.append(s)
    else:
        md.append("- 本周噪声治理情况良好，建议保持现有管控力度")
    
    md.append("")
    
    # 备注
    md.append("---")
    md.append("")
    md.append("**备注**:")
    md.append("- 夜间时段定义: 22:00 - 06:00")
    md.append("- 噪声标准: 夜间 ≤ 55dB, 昼间 ≤ 70dB")
    md.append("- 数据来源: 投诉热线、分贝仪监测、执法记录、施工许可")
    md.append("")
    
    return "\n".join(md)


def export_issue_csv(
    violations_df: pd.DataFrame,
    complaints_df: pd.DataFrame = None,
    state_store = None,
    include_verified: bool = True
) -> str:
    """
    导出问题清单为CSV格式
    
    参数:
    - violations_df: 违规记录DataFrame
    - complaints_df: 投诉数据DataFrame (可选，用于补充信息)
    - state_store: 状态存储对象 (可选，用于获取核实状态)
    - include_verified: 是否包含已核实的记录
    
    返回:
    - CSV字符串
    """
    if violations_df.empty:
        return ""
    
    result_df = violations_df.copy()
    
    # 过滤已核实记录
    if not include_verified and 'is_verified' in result_df.columns:
        result_df = result_df[result_df['is_verified'] == False]
    
    # 如果有状态存储，合并核实状态
    if state_store is not None and 'violation_id' in result_df.columns:
        result_df = state_store.merge_with_dataframe(
            result_df, 'violation_id', 'violation'
        )
    
    # 补充投诉信息
    if complaints_df is not None and not complaints_df.empty:
        if 'related_records' in result_df.columns and 'complaint_id' in complaints_df.columns:
            # 可以根据关联记录补充投诉信息
            pass
    
    # 选择导出的列
    export_cols = [
        'violation_id',
        'violation_type',
        'severity',
        'description',
        'is_verified',
        'verified_by',
        'verified_time',
        'verification_notes'
    ]
    
    # 只保留存在的列
    available_cols = [c for c in export_cols if c in result_df.columns]
    
    if not available_cols:
        return ""
    
    export_df = result_df[available_cols].copy()
    
    # 转换严重程度为中文
    if 'severity' in export_df.columns:
        severity_map = {'high': '高', 'medium': '中', 'low': '低'}
        export_df['severity'] = export_df['severity'].map(
            lambda x: severity_map.get(x, x)
        )
    
    # 转换核实状态
    if 'is_verified' in export_df.columns:
        export_df['is_verified'] = export_df['is_verified'].map(
            lambda x: '已核实' if x else '未核实'
        )
    
    # 转换为CSV
    csv_buffer = StringIO()
    export_df.to_csv(csv_buffer, index=False, encoding='utf-8-sig')
    return csv_buffer.getvalue()


def export_complaints_csv(
    complaints_df: pd.DataFrame,
    include_duplicates: bool = True,
    state_store = None
) -> str:
    """
    导出投诉清单为CSV格式
    
    参数:
    - complaints_df: 投诉数据DataFrame
    - include_duplicates: 是否包含重复投诉
    - state_store: 状态存储对象
    
    返回:
    - CSV字符串
    """
    if complaints_df.empty:
        return ""
    
    result_df = complaints_df.copy()
    
    # 过滤重复投诉
    if not include_duplicates and 'is_duplicate' in result_df.columns:
        result_df = result_df[result_df['is_duplicate'] == False]
    
    # 合并核实状态
    if state_store is not None and 'complaint_id' in result_df.columns:
        result_df = state_store.merge_with_dataframe(
            result_df, 'complaint_id', 'complaint'
        )
    
    # 选择导出列
    export_cols = [
        'complaint_id',
        'community',
        'noise_source',
        'complaint_time',
        'description',
        'reporter',
        'phone',
        'is_night',
        'is_duplicate',
        'duplicate_group_id',
        'verification_status',
        'verified_by',
        'verified_time'
    ]
    
    available_cols = [c for c in export_cols if c in result_df.columns]
    
    if not available_cols:
        return ""
    
    export_df = result_df[available_cols].copy()
    
    # 转换布尔值
    if 'is_night' in export_df.columns:
        export_df['is_night'] = export_df['is_night'].map(
            lambda x: '是' if x else '否'
        )
    
    if 'is_duplicate' in export_df.columns:
        export_df['is_duplicate'] = export_df['is_duplicate'].map(
            lambda x: '是' if x else '否'
        )
    
    # 转换为CSV
    csv_buffer = StringIO()
    export_df.to_csv(csv_buffer, index=False, encoding='utf-8-sig')
    return csv_buffer.getvalue()
