"""
报告导出模块
"""

import csv
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

from contract_inspector.config import DEFAULT_EXPORTS_DIR


class MarkdownExporter:
    """Markdown报告导出器"""
    
    def export(self, task: Dict[str, Any], output_dir: Path = None) -> Path:
        """
        导出Markdown格式报告
        
        Args:
            task: 任务数据
            output_dir: 输出目录，默认为配置的导出目录
            
        Returns:
            导出文件路径
        """
        output_dir = output_dir or DEFAULT_EXPORTS_DIR
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"contract_report_{task['id']}_{timestamp}.md"
        output_path = output_dir / filename
        
        content = self._generate_content(task)
        output_path.write_text(content, encoding='utf-8')
        
        return output_path
    
    def _generate_content(self, task: Dict[str, Any]) -> str:
        """生成Markdown内容"""
        lines = []
        
        lines.append(f"# 合同改稿巡检报告")
        lines.append(f"")
        lines.append(f"## 基本信息")
        lines.append(f"")
        lines.append(f"- **任务ID**: {task['id']}")
        lines.append(f"- **客户名称**: {task['client']}")
        lines.append(f"- **合同名称**: {task['contract_name']}")
        lines.append(f"- **巡检时间**: {task['created_at']}")
        lines.append(f"- **旧版文件**: {task['old_file']}")
        lines.append(f"- **新版文件**: {task['new_file']}")
        lines.append(f"")
        
        diff_result = task.get('diff_result', {})
        
        lines.append(f"## 差异统计")
        lines.append(f"")
        lines.append(f"| 类型 | 数量 |")
        lines.append(f"|------|------|")
        lines.append(f"| 新增章节 | {len(diff_result.get('added_sections', []))} |")
        lines.append(f"| 删除章节 | {len(diff_result.get('removed_sections', []))} |")
        lines.append(f"| 修改章节 | {len(diff_result.get('modified_sections', []))} |")
        lines.append(f"| 新增条款 | {len(diff_result.get('added_clauses', []))} |")
        lines.append(f"| 删除条款 | {len(diff_result.get('removed_clauses', []))} |")
        lines.append(f"| 修改条款 | {len(diff_result.get('modified_clauses', []))} |")
        lines.append(f"")
        
        risk_results = task.get('risk_results', {})
        if risk_results:
            lines.append(f"## 风险扫描结果")
            lines.append(f"")
            
            total_risks = sum(len(risks) for risks in risk_results.values())
            high_risks = sum(1 for risks in risk_results.values() for r in risks if r.get('level') == 'high')
            medium_risks = sum(1 for risks in risk_results.values() for r in risks if r.get('level') == 'medium')
            low_risks = sum(1 for risks in risk_results.values() for r in risks if r.get('level') == 'low')
            
            lines.append(f"**总计风险点**: {total_risks} 个")
            lines.append(f"")
            lines.append(f"- 🔴 高风险: {high_risks} 个")
            lines.append(f"- 🟡 中风险: {medium_risks} 个")
            lines.append(f"- 🟢 低风险: {low_risks} 个")
            lines.append(f"")
            
            for rule_id, risks in risk_results.items():
                for i, risk in enumerate(risks):
                    level = risk.get('level', 'medium')
                    level_icon = '🔴' if level == 'high' else '🟡' if level == 'medium' else '🟢'
                    
                    lines.append(f"### {level_icon} [{level.upper()}] {risk.get('rule_name', rule_id)}")
                    lines.append(f"")
                    
                    if risk.get('old_text'):
                        lines.append(f"**原文**:")
                        lines.append(f"```")
                        lines.append(risk['old_text'])
                        lines.append(f"```")
                    
                    if risk.get('new_text'):
                        lines.append(f"**新文**:")
                        lines.append(f"```")
                        lines.append(risk['new_text'])
                        lines.append(f"```")
                    
                    if risk.get('old_amount') or risk.get('new_amount'):
                        lines.append(f"- 原金额: {risk.get('old_amount', '-')} 元")
                        lines.append(f"- 新金额: {risk.get('new_amount', '-')} 元")
                        if risk.get('increase_rate'):
                            lines.append(f"- 涨幅: {risk['increase_rate']*100:.1f}%")
                    
                    if risk.get('old_days') or risk.get('new_days'):
                        lines.append(f"- 原周期: {risk.get('old_days', '-')} 天")
                        lines.append(f"- 新周期: {risk.get('new_days', '-')} 天")
                    
                    if risk.get('suggestion'):
                        lines.append(f"")
                        lines.append(f"💡 **建议**: {risk['suggestion']}")
                    
                    lines.append(f"")
        
        lines.append(f"## 详细变更")
        lines.append(f"")
        
        added_sections = diff_result.get('added_sections', [])
        if added_sections:
            lines.append(f"### 新增章节")
            lines.append(f"")
            for section in added_sections:
                lines.append(f"#### {section.get('title', '未命名章节')}")
                lines.append(f"")
                lines.append(f"```")
                lines.append(section.get('content', '')[:500])
                if len(section.get('content', '')) > 500:
                    lines.append("...")
                lines.append(f"```")
                lines.append(f"")
        
        removed_sections = diff_result.get('removed_sections', [])
        if removed_sections:
            lines.append(f"### 删除章节")
            lines.append(f"")
            for section in removed_sections:
                lines.append(f"#### {section.get('title', '未命名章节')}")
                lines.append(f"")
                lines.append(f"```")
                lines.append(section.get('content', '')[:500])
                if len(section.get('content', '')) > 500:
                    lines.append("...")
                lines.append(f"```")
                lines.append(f"")
        
        modified_sections = diff_result.get('modified_sections', [])
        if modified_sections:
            lines.append(f"### 修改章节")
            lines.append(f"")
            for mod in modified_sections:
                old_section = mod.get('old', {})
                new_section = mod.get('new', {})
                lines.append(f"#### {old_section.get('title', '未命名章节')}")
                lines.append(f"")
                lines.append(f"**原文**:")
                lines.append(f"```")
                lines.append(old_section.get('content', '')[:300])
                if len(old_section.get('content', '')) > 300:
                    lines.append("...")
                lines.append(f"```")
                lines.append(f"")
                lines.append(f"**新文**:")
                lines.append(f"```")
                lines.append(new_section.get('content', '')[:300])
                if len(new_section.get('content', '')) > 300:
                    lines.append("...")
                lines.append(f"```")
                lines.append(f"")
        
        lines.append(f"---")
        lines.append(f"*报告生成时间: {datetime.now().isoformat()}*")
        lines.append(f"")
        
        return '\n'.join(lines)


class CSVExporter:
    """CSV风险清单导出器"""
    
    def export(self, task: Dict[str, Any], output_dir: Path = None) -> Path:
        """
        导出CSV格式风险清单
        
        Args:
            task: 任务数据
            output_dir: 输出目录，默认为配置的导出目录
            
        Returns:
            导出文件路径
        """
        output_dir = output_dir or DEFAULT_EXPORTS_DIR
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"contract_risks_{task['id']}_{timestamp}.csv"
        output_path = output_dir / filename
        
        rows = self._generate_rows(task)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                '任务ID', '客户名称', '合同名称', '巡检时间',
                '风险等级', '规则名称', '原文', '新文', '建议'
            ])
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path
    
    def _generate_rows(self, task: Dict[str, Any]) -> List[Dict[str, Any]]:
        """生成CSV行数据"""
        rows = []
        
        risk_results = task.get('risk_results', {})
        task_id = task.get('id', '')
        client = task.get('client', '')
        contract_name = task.get('contract_name', '')
        created_at = task.get('created_at', '')
        
        for rule_id, risks in risk_results.items():
            for risk in risks:
                row = {
                    '任务ID': task_id,
                    '客户名称': client,
                    '合同名称': contract_name,
                    '巡检时间': created_at,
                    '风险等级': risk.get('level', 'medium'),
                    '规则名称': risk.get('rule_name', rule_id),
                    '原文': risk.get('old_text', '')[:200] if risk.get('old_text') else '',
                    '新文': risk.get('new_text', '')[:200] if risk.get('new_text') else '',
                    '建议': risk.get('suggestion', '')
                }
                rows.append(row)
        
        if not rows:
            rows.append({
                '任务ID': task_id,
                '客户名称': client,
                '合同名称': contract_name,
                '巡检时间': created_at,
                '风险等级': '-',
                '规则名称': '-',
                '原文': '-',
                '新文': '-',
                '建议': '本次巡检未发现风险点'
            })
        
        return rows
