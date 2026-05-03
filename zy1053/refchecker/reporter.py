"""报告生成模块

支持输出：
1. Markdown 格式报告
2. JSON 格式明细
3. 清洗后的 BibTeX 导出
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from dataclasses import asdict

from .models import (
    ProjectAnalysis,
    CheckResult,
    ReferenceEntry,
    Citation,
)


class Reporter:
    """报告生成器"""
    
    def __init__(self):
        self.generation_time = datetime.now().isoformat()
    
    def _citation_to_dict(self, citation: Citation) -> Dict[str, Any]:
        return {
            "key": citation.key,
            "raw_text": citation.raw_text,
            "source_type": citation.source_type,
            "line_number": citation.line_number,
            "context": citation.context,
        }
    
    def _reference_to_dict(self, ref: ReferenceEntry) -> Dict[str, Any]:
        return {
            "key": ref.key,
            "entry_type": ref.entry_type.value,
            "source_file": ref.source_file,
            "source_format": ref.source_format,
            "title": ref.title,
            "author": ref.author,
            "year": ref.year,
            "doi": ref.doi,
            "journal": ref.journal,
            "booktitle": ref.booktitle,
            "publisher": ref.publisher,
            "volume": ref.volume,
            "pages": ref.pages,
            "url": ref.url,
            "abstract": ref.abstract,
        }
    
    def _reference_to_summary(self, ref: ReferenceEntry) -> str:
        parts = []
        if ref.key:
            parts.append(f"**{ref.key}**")
        if ref.author:
            parts.append(f"作者: {ref.author}")
        if ref.title:
            parts.append(f"标题: {ref.title}")
        if ref.year:
            parts.append(f"年份: {ref.year}")
        if ref.doi:
            parts.append(f"DOI: {ref.doi}")
        parts.append(f"来源: {ref.source_file}")
        return " | ".join(parts)
    
    def generate_markdown(
        self,
        analysis: ProjectAnalysis,
        title: str = "参考文献检查报告"
    ) -> str:
        lines = [
            f"# {title}",
            "",
            f"> 生成时间: {self.generation_time}",
            "",
        ]
        
        result = analysis.check_result
        
        lines.append("## 检查概要")
        lines.append("")
        lines.append(f"- 正文引用数: **{len(analysis.citations)}** 处")
        lines.append(f"- 唯一引用键: **{len(analysis.get_unique_citation_keys())}** 个")
        lines.append(f"- 参考文献条目: **{len(analysis.references)}** 条")
        lines.append(f"- 唯一文献键: **{len(analysis.get_unique_reference_keys())}** 个")
        lines.append("")
        
        has_problems = (
            result.missing_citations
            or result.unused_references
            or result.duplicate_candidates
            or result.doi_conflicts
            or result.duplicate_keys
        )
        
        if not has_problems:
            lines.append("## ✅ 未发现问题")
            lines.append("")
            lines.append("所有引用和参考文献检查通过！")
        else:
            if result.missing_citations:
                lines.append("## ❌ 缺失引用 (找不到对应的文献条目)")
                lines.append("")
                lines.append("以下引用在参考文献库中找不到对应的条目：")
                lines.append("")
                
                for cite in result.missing_citations:
                    lines.append(f"### 引用: `{cite.key}`")
                    lines.append("")
                    lines.append(f"- 原始格式: `{cite.raw_text}`")
                    lines.append(f"- 位置类型: {cite.source_type}")
                    if cite.line_number:
                        lines.append(f"- 行号: {cite.line_number}")
                    if cite.context:
                        lines.append(f"- 上下文: `{cite.context}`")
                    lines.append("")
            
            if result.unused_references:
                lines.append("## ⚠️ 未引用的参考文献")
                lines.append("")
                lines.append("以下文献条目存在于库中但未被正文引用：")
                lines.append("")
                
                for ref in result.unused_references:
                    lines.append(f"- {self._reference_to_summary(ref)}")
                lines.append("")
            
            if result.duplicate_keys:
                lines.append("## ⚠️ 重复的引用键")
                lines.append("")
                lines.append("以下引用键在不同文献条目中重复使用：")
                lines.append("")
                
                for dup in result.duplicate_keys:
                    lines.append(f"### 键: `{dup['key']}`")
                    lines.append("")
                    lines.append("涉及条目:")
                    for entry in dup['entries']:
                        lines.append(f"- 来自 `{entry['source_file']}`: {entry.get('title', '无标题')}")
                    lines.append("")
            
            if result.duplicate_candidates:
                lines.append("## ⚠️ 疑似重复文献")
                lines.append("")
                lines.append("根据 DOI 或标题+作者+年份检测到疑似重复的文献：")
                lines.append("")
                
                for i, group in enumerate(result.duplicate_candidates, 1):
                    lines.append(f"### 第 {i} 组疑似重复")
                    lines.append("")
                    
                    dois = {r.get_normalized_doi() for r in group if r.get_normalized_doi()}
                    if len(dois) == 1:
                        lines.append(f"- 相同 DOI: `{list(dois)[0]}`")
                    
                    for j, ref in enumerate(group, 1):
                        lines.append(f"#### 条目 {j}")
                        lines.append("")
                        lines.append(f"- 键: `{ref.key}`")
                        if ref.title:
                            lines.append(f"- 标题: {ref.title}")
                        if ref.author:
                            lines.append(f"- 作者: {ref.author}")
                        if ref.year:
                            lines.append(f"- 年份: {ref.year}")
                        if ref.doi:
                            lines.append(f"- DOI: {ref.doi}")
                        lines.append(f"- 来源: `{ref.source_file}`")
                        lines.append("")
            
            if result.doi_conflicts:
                lines.append("## ❌ DOI 字段冲突")
                lines.append("")
                lines.append("同一个 DOI 对应了不同的作者/年份/标题信息：")
                lines.append("")
                
                for conflict in result.doi_conflicts:
                    lines.append(f"### DOI: `{conflict['doi']}`")
                    lines.append("")
                    
                    lines.append("冲突字段:")
                    for field_conflict in conflict['conflicts']:
                        lines.append(f"- **{field_conflict['field']}**: {', '.join(field_conflict['values'])}")
                    
                    lines.append("")
                    lines.append("涉及条目:")
                    for entry in conflict['entries']:
                        lines.append(f"- 键 `{entry['key']}` (来自 `{entry['source_file']}`)")
                    lines.append("")
        
        if result.warnings:
            lines.append("## ⚠️ 警告")
            lines.append("")
            for warning in result.warnings:
                lines.append(f"- {warning}")
            lines.append("")
        
        if result.errors:
            lines.append("## ❌ 错误")
            lines.append("")
            for error in result.errors:
                lines.append(f"- {error}")
            lines.append("")
        
        return "\n".join(lines)
    
    def generate_json(
        self,
        analysis: ProjectAnalysis,
        indent: int = 2
    ) -> str:
        result = analysis.check_result
        
        data = {
            "metadata": {
                "generated_at": self.generation_time,
                "version": "0.1.0",
            },
            "summary": {
                "total_citations": len(analysis.citations),
                "unique_citation_keys": len(analysis.get_unique_citation_keys()),
                "total_references": len(analysis.references),
                "unique_reference_keys": len(analysis.get_unique_reference_keys()),
            },
            "issues": {
                "missing_citations": [
                    self._citation_to_dict(c) for c in result.missing_citations
                ],
                "unused_references": [
                    self._reference_to_dict(r) for r in result.unused_references
                ],
                "duplicate_keys": result.duplicate_keys,
                "duplicate_candidates": [
                    [self._reference_to_dict(r) for r in group]
                    for group in result.duplicate_candidates
                ],
                "doi_conflicts": result.doi_conflicts,
            },
            "warnings": result.warnings,
            "errors": result.errors,
            "citations": [
                self._citation_to_dict(c) for c in analysis.citations
            ],
            "references": [
                self._reference_to_dict(r) for r in analysis.references
            ],
        }
        
        return json.dumps(data, ensure_ascii=False, indent=indent, default=str)
    
    def generate_clean_bibtex(
        self,
        analysis: ProjectAnalysis,
        include_unused: bool = False,
        deduplicate: bool = True
    ) -> str:
        references = analysis.references
        
        if not include_unused:
            cited_keys = {c.key.lower() for c in analysis.citations}
            references = [
                r for r in references
                if r.key.lower() in cited_keys
            ]
        
        if deduplicate:
            seen_dois: Set[str] = set()
            seen_keys: Set[str] = set()
            deduplicated: List[ReferenceEntry] = []
            
            for ref in references:
                doi = ref.get_normalized_doi()
                key_lower = ref.key.lower()
                
                if doi and doi in seen_dois:
                    continue
                if key_lower in seen_keys:
                    continue
                
                if doi:
                    seen_dois.add(doi)
                seen_keys.add(key_lower)
                deduplicated.append(ref)
            
            references = deduplicated
        
        lines = [
            "% 清洗后的 BibTeX 文件",
            f"% 生成时间: {self.generation_time}",
            f"% 条目数: {len(references)}",
            "",
        ]
        
        for ref in references:
            lines.append(ref.to_bibtex())
            lines.append("")
        
        return "\n".join(lines)
