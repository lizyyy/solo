import csv
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from .rules import Violation, Severity
from .placement import PlacementItem, AlternativeLocation, calculate_storage_utilization


def export_violations(
    violations: List[Violation],
    output_path: str
) -> None:
    """
    导出违规详情到CSV文件
    """
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            '违规ID', '规则编号', '严重程度', '消息',
            '申请ID', '化学品ID', '库位ID', '详细信息'
        ])
        
        for i, v in enumerate(violations, 1):
            severity_display = {
                Severity.CRITICAL: '严重',
                Severity.HIGH: '高',
                Severity.MEDIUM: '中',
                Severity.LOW: '低'
            }.get(v.severity, '未知')
            
            writer.writerow([
                f'V-{i:04d}',
                v.rule_id,
                severity_display,
                v.message,
                v.request_id or '',
                v.chemical_id or '',
                v.location_id or '',
                json.dumps(v.details, ensure_ascii=False) if v.details else ''
            ])


def export_placement_plan(
    placement_items: List[PlacementItem],
    output_path: str
) -> None:
    """
    导出生成的放置计划到CSV文件
    """
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            '申请ID', '化学品ID', '化学品名称',
            '申请库位', '最终库位', '体积(L)',
            '状态', '违规数量', '推荐替代库位'
        ])
        
        for item in placement_items:
            status_display = {
                'approved': '通过',
                'needs_review': '需人工审核',
                'rejected': '拒绝'
            }.get(item.status, item.status)
            
            # 获取前3个推荐替代库位
            top_alternatives = item.alternative_locations[:3]
            alternative_str = '; '.join([
                f"{alt.location_id}({alt.suitability_score:.0f}分)"
                for alt in top_alternatives
            ]) if top_alternatives else '无'
            
            writer.writerow([
                item.request_id,
                item.chemical_id,
                item.chemical_name,
                item.requested_location or '未指定',
                item.final_location or '无',
                item.volume,
                status_display,
                len(item.violations),
                alternative_str
            ])


def generate_audit_report(
    violations: List[Violation],
    placement_items: List[PlacementItem],
    storage_before: Dict[str, Dict[str, Any]],
    storage_after: Dict[str, Dict[str, Any]],
    warnings: List[str],
    output_path: str
) -> None:
    """
    生成审计报告Markdown文件
    """
    # 统计信息
    total_requests = len(placement_items)
    approved = sum(1 for item in placement_items if item.status == 'approved')
    needs_review = sum(1 for item in placement_items if item.status == 'needs_review')
    rejected = sum(1 for item in placement_items if item.status == 'rejected')
    
    # 按严重程度统计违规
    severity_counts = {
        Severity.CRITICAL: 0,
        Severity.HIGH: 0,
        Severity.MEDIUM: 0,
        Severity.LOW: 0
    }
    for v in violations:
        if v.severity in severity_counts:
            severity_counts[v.severity] += 1
    
    # 计算库位利用率
    utilization_before = calculate_storage_utilization(storage_before)
    utilization_after = calculate_storage_utilization(storage_after)
    
    # 生成时间字符串
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # 计算百分比
    if total_requests > 0:
        approved_pct = (approved / total_requests * 100)
        needs_review_pct = (needs_review / total_requests * 100)
        rejected_pct = (rejected / total_requests * 100)
        approved_line = f'- **通过**: {approved} 项 ({approved_pct:.1f}%)'
        needs_review_line = f'- **需人工审核**: {needs_review} 项 ({needs_review_pct:.1f}%)'
        rejected_line = f'- **拒绝**: {rejected} 项 ({rejected_pct:.1f}%)'
    else:
        approved_line = ''
        needs_review_line = ''
        rejected_line = ''
    
    # 计算库位利用率变化值
    total_used_diff = utilization_after['total_used'] - utilization_before['total_used']
    total_remaining_diff = utilization_before['total_remaining'] - utilization_after['total_remaining']
    utilization_diff = utilization_after['overall_utilization_percent'] - utilization_before['overall_utilization_percent']
    
    # 生成报告内容
    report_lines = [
        '# 危化品库位相容性预检报告',
        '',
        f'**生成时间**: {timestamp}',
        '',
        '---',
        '',
        '## 一、执行摘要',
        '',
        '### 1.1 入库申请统计',
        '',
        f'- **总申请数**: {total_requests} 项',
    ]
    
    # 添加百分比行（如果有数据）
    if approved_line:
        report_lines.append(approved_line)
    if needs_review_line:
        report_lines.append(needs_review_line)
    if rejected_line:
        report_lines.append(rejected_line)
    
    report_lines.extend([
        '',
        '### 1.2 违规统计',
        '',
        f'- **严重违规**: {severity_counts[Severity.CRITICAL]} 项',
        f'- **高优先级违规**: {severity_counts[Severity.HIGH]} 项',
        f'- **中优先级违规**: {severity_counts[Severity.MEDIUM]} 项',
        f'- **低优先级违规**: {severity_counts[Severity.LOW]} 项',
        '',
        '### 1.3 库位利用率变化',
        '',
        '| 指标 | 预检前 | 预检后 | 变化 |',
        '|------|--------|--------|------|',
        f'| 总容量 | {utilization_before["total_capacity"]:.1f} L | {utilization_after["total_capacity"]:.1f} L | - |',
        f'| 已使用 | {utilization_before["total_used"]:.1f} L | {utilization_after["total_used"]:.1f} L | +{total_used_diff:.1f} L |',
        f'| 剩余容量 | {utilization_before["total_remaining"]:.1f} L | {utilization_after["total_remaining"]:.1f} L | -{total_remaining_diff:.1f} L |',
        f'| 整体利用率 | {utilization_before["overall_utilization_percent"]}% | {utilization_after["overall_utilization_percent"]}% | +{utilization_diff}% |',
        '',
        '---',
        '',
        '## 二、数据完整性警告',
        ''
    ])
    
    if warnings:
        report_lines.extend([
            '以下警告不影响预检流程，但建议检查数据准确性：',
            ''
        ])
        for i, warning in enumerate(warnings, 1):
            report_lines.append(f'{i}. {warning}')
    else:
        report_lines.append('无数据完整性警告。')
    
    report_lines.extend([
        '',
        '---',
        '',
        '## 三、违规详情',
        ''
    ])
    
    if violations:
        # 按严重程度分组
        grouped = {
            Severity.CRITICAL: [],
            Severity.HIGH: [],
            Severity.MEDIUM: [],
            Severity.LOW: []
        }
        for v in violations:
            if v.severity in grouped:
                grouped[v.severity].append(v)
        
        severity_names = {
            Severity.CRITICAL: '### 3.1 严重违规 (CRITICAL)',
            Severity.HIGH: '### 3.2 高优先级违规 (HIGH)',
            Severity.MEDIUM: '### 3.3 中优先级违规 (MEDIUM)',
            Severity.LOW: '### 3.4 低优先级违规 (LOW)'
        }
        
        for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            if grouped[severity]:
                report_lines.append(severity_names[severity])
                report_lines.append('')
                
                for i, v in enumerate(grouped[severity], 1):
                    report_lines.append(f'**{i}. 规则 {v.rule_id}: {v.message}')
                    if v.request_id:
                        report_lines.append(f'   - 申请ID: {v.request_id}')
                    if v.chemical_id:
                        report_lines.append(f'   - 化学品ID: {v.chemical_id}')
                    if v.location_id:
                        report_lines.append(f'   - 涉及库位: {v.location_id}')
                    if v.details:
                        report_lines.append(f'   - 详细信息:')
                        for key, value in v.details.items():
                            report_lines.append(f'     - {key}: {value}')
                    report_lines.append('')
    else:
        report_lines.append('未发现任何违规。')
    
    report_lines.extend([
        '---',
        '',
        '## 四、放置计划详情',
        ''
    ])
    
    for item in placement_items:
        status_icon = {
            'approved': '✅',
            'needs_review': '⚠️',
            'rejected': '❌'
        }.get(item.status, '❓')
        
        status_text = {
            'approved': '通过',
            'needs_review': '需人工审核',
            'rejected': '拒绝'
        }.get(item.status, item.status)
        
        report_lines.extend([
            f'### {status_icon} 申请 {item.request_id}',
            '',
            f'- **化学品**: {item.chemical_id} ({item.chemical_name})',
            f'- **申请库位**: {item.requested_location or "未指定"}',
            f'- **最终库位**: {item.final_location or "无"}',
            f'- **体积**: {item.volume} L',
            f'- **状态**: {status_text}',
            ''
        ])
        
        if item.violations:
            report_lines.append('**违规问题**:')
            for v in item.violations:
                severity_display = {
                    Severity.CRITICAL: '🔴 严重',
                    Severity.HIGH: '🟠 高',
                    Severity.MEDIUM: '🟡 中',
                    Severity.LOW: '🟢 低'
                }.get(v.severity, '未知')
                report_lines.append(f'- {severity_display} [{v.rule_id}] {v.message}')
            report_lines.append('')
        
        if item.alternative_locations:
            report_lines.append('**推荐替代库位**:')
            for alt in item.alternative_locations[:5]:  # 最多显示5个
                score_color = '🟢' if alt.suitability_score >= 70 else '🟡' if alt.suitability_score >= 40 else '🔴'
                report_lines.append(f'- {score_color} **{alt.location_id}** ({alt.location_name}) - 适配度: {alt.suitability_score:.0f}分')
                report_lines.append(f'  剩余容量: {alt.remaining_capacity:.1f} L')
                if alt.reasons:
                    report_lines.append(f'  推荐理由: {"; ".join(alt.reasons)}')
                if alt.warnings:
                    report_lines.append(f'  ⚠️ 注意事项: {"; ".join(alt.warnings)}')
            report_lines.append('')
    
    report_lines.extend([
        '---',
        '',
        '## 五、库位详情',
        '',
        '### 5.1 各库位利用率',
        '',
        '| 库位ID | 库位名称 | 总容量(L) | 已使用(L) | 剩余(L) | 利用率 |',
        '|--------|----------|-----------|-----------|---------|--------|'
    ])
    
    for loc_detail in utilization_after['location_details']:
        utilization_color = '🟢' if loc_detail['utilization_percent'] < 70 else '🟡' if loc_detail['utilization_percent'] < 90 else '🔴'
        report_lines.append(
            f"| {loc_detail['location_id']} | {loc_detail['location_name']} | "
            f"{loc_detail['capacity']:.1f} | {loc_detail['used']:.1f} | "
            f"{loc_detail['remaining']:.1f} | {utilization_color} {loc_detail['utilization_percent']}% |"
        )
    
    report_lines.extend([
        '',
        '---',
        '',
        '## 六、建议与注意事项',
        '',
        '1. **严重违规**的申请应直接拒绝，禁止入库',
        '2. **高优先级违规**的申请需人工审核确认风险',
        '3. 建议优先选择适配度分数高的替代库位',
        '4. 定期更新相容性规则和危险类别映射',
        '5. 入库后及时更新库位使用记录',
        '',
        '---',
        '',
        '*本报告由危化品库位相容性预检系统自动生成*'
    ])
    
    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(line for line in report_lines if line is not None))
