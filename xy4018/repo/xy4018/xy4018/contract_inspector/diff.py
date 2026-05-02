"""
合同差异计算模块
"""

from typing import Dict, List, Any, Tuple
from deepdiff import DeepDiff
import re


class ContractDiffer:
    """合同差异计算器，对比两版合同的结构化差异"""
    
    def compare(self, old_doc: Dict[str, Any], new_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        对比两版合同，返回差异结果
        
        Args:
            old_doc: 旧版合同解析结果
            new_doc: 新版合同解析结果
            
        Returns:
            包含各类差异的字典
        """
        old_sections = {s['id']: s for s in old_doc.get('sections', [])}
        new_sections = {s['id']: s for s in new_doc.get('sections', [])}
        old_clauses = {c['id']: c for c in old_doc.get('clauses', [])}
        new_clauses = {c['id']: c for c in new_doc.get('clauses', [])}
        
        added_sections = []
        removed_sections = []
        modified_sections = []
        added_clauses = []
        removed_clauses = []
        modified_clauses = []
        
        for section_id, new_section in new_sections.items():
            if section_id not in old_sections:
                added_sections.append(new_section)
            else:
                old_section = old_sections[section_id]
                if self._has_content_diff(old_section, new_section):
                    modified_sections.append({
                        'old': old_section,
                        'new': new_section,
                        'diff': self._compute_content_diff(old_section['content'], new_section['content'])
                    })
        
        for section_id, old_section in old_sections.items():
            if section_id not in new_sections:
                removed_sections.append(old_section)
        
        for clause_id, new_clause in new_clauses.items():
            if clause_id not in old_clauses:
                added_clauses.append(new_clause)
            else:
                old_clause = old_clauses[clause_id]
                if self._has_content_diff(old_clause, new_clause):
                    modified_clauses.append({
                        'old': old_clause,
                        'new': new_clause,
                        'diff': self._compute_content_diff(old_clause['content'], new_clause['content'])
                    })
        
        for clause_id, old_clause in old_clauses.items():
            if clause_id not in new_clauses:
                removed_clauses.append(old_clause)
        
        return {
            'added_sections': added_sections,
            'removed_sections': removed_sections,
            'modified_sections': modified_sections,
            'added_clauses': added_clauses,
            'removed_clauses': removed_clauses,
            'modified_clauses': modified_clauses,
            'old_doc': old_doc,
            'new_doc': new_doc
        }
    
    def _has_content_diff(self, old_item: Dict, new_item: Dict) -> bool:
        """检查两个项是否有内容差异"""
        old_content = old_item.get('content', '')
        new_content = new_item.get('content', '')
        return old_content != new_content
    
    def _compute_content_diff(self, old_content: str, new_content: str) -> Dict[str, Any]:
        """计算两个文本内容的详细差异"""
        old_lines = old_content.split('\n')
        new_lines = new_content.split('\n')
        
        added_lines = []
        removed_lines = []
        modified_lines = []
        
        old_set = set(old_lines)
        new_set = set(new_lines)
        
        for i, line in enumerate(old_lines):
            if line not in new_set and line.strip():
                removed_lines.append({'line_number': i + 1, 'content': line})
        
        for i, line in enumerate(new_lines):
            if line not in old_set and line.strip():
                added_lines.append({'line_number': i + 1, 'content': line})
        
        return {
            'added_lines': added_lines,
            'removed_lines': removed_lines,
            'modified_lines': modified_lines,
            'old_content': old_content,
            'new_content': new_content
        }
    
    def extract_all_changes(self, diff_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        从差异结果中提取所有变更内容
        
        Args:
            diff_result: compare方法返回的差异结果
            
        Returns:
            所有变更的列表
        """
        changes = []
        
        for section in diff_result.get('added_sections', []):
            changes.append({
                'type': 'added_section',
                'title': section.get('title', ''),
                'content': section.get('content', ''),
                'old_text': None,
                'new_text': section.get('content', '')
            })
        
        for section in diff_result.get('removed_sections', []):
            changes.append({
                'type': 'removed_section',
                'title': section.get('title', ''),
                'content': section.get('content', ''),
                'old_text': section.get('content', ''),
                'new_text': None
            })
        
        for mod in diff_result.get('modified_sections', []):
            changes.append({
                'type': 'modified_section',
                'title': mod['old'].get('title', ''),
                'old_text': mod['old'].get('content', ''),
                'new_text': mod['new'].get('content', '')
            })
        
        for clause in diff_result.get('added_clauses', []):
            changes.append({
                'type': 'added_clause',
                'title': clause.get('title', ''),
                'content': clause.get('content', ''),
                'old_text': None,
                'new_text': clause.get('content', '')
            })
        
        for clause in diff_result.get('removed_clauses', []):
            changes.append({
                'type': 'removed_clause',
                'title': clause.get('title', ''),
                'content': clause.get('content', ''),
                'old_text': clause.get('content', ''),
                'new_text': None
            })
        
        for mod in diff_result.get('modified_clauses', []):
            changes.append({
                'type': 'modified_clause',
                'title': mod['old'].get('title', ''),
                'old_text': mod['old'].get('content', ''),
                'new_text': mod['new'].get('content', '')
            })
        
        return changes
