"""核心检查逻辑模块

实现以下检查功能：
1. 缺失引用检测：正文中引用的 key 在文献库中找不到
2. 未引用参考文献检测：文献库中有但正文没引用
3. 疑似重复文献检测：根据 DOI、标题相似度、作者年份
4. DOI 冲突检测：同一个 DOI 的年份、作者、标题是否冲突
5. 重复 key 检测
"""

import re
from collections import defaultdict
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import asdict

try:
    from fuzzywuzzy import fuzz
    HAS_FUZZYWUZZY = True
except ImportError:
    HAS_FUZZYWUZZY = False

from .models import (
    ReferenceEntry,
    Citation,
    CheckResult,
    ProjectAnalysis,
)


class ReferenceChecker:
    """参考文献检查器"""
    
    TITLE_SIMILARITY_THRESHOLD = 85
    
    def __init__(self, title_threshold: int = 85):
        self.title_threshold = title_threshold
    
    def _normalize_text(self, text: Optional[str]) -> str:
        if not text:
            return ""
        text = text.lower()
        text = re.sub(r'[^\w\s]', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def _titles_similar(self, title1: Optional[str], title2: Optional[str]) -> Tuple[bool, int]:
        if not title1 or not title2:
            return False, 0
        
        norm1 = self._normalize_text(title1)
        norm2 = self._normalize_text(title2)
        
        if not norm1 or not norm2:
            return False, 0
        
        if HAS_FUZZYWUZZY:
            ratio = fuzz.token_sort_ratio(norm1, norm2)
            return ratio >= self.title_threshold, ratio
        else:
            min_len = min(len(norm1), len(norm2))
            if min_len == 0:
                return False, 0
            matches = sum(1 for a, b in zip(norm1, norm2) if a == b)
            ratio = int((matches / min_len) * 100)
            return ratio >= self.title_threshold, ratio
    
    def check_missing_citations(
        self,
        citations: List[Citation],
        references: List[ReferenceEntry]
    ) -> List[Citation]:
        existing_keys: Set[str] = {r.key for r in references}
        missing = []
        seen: Set[Tuple[str, int]] = set()
        
        for cite in citations:
            key_lower = cite.key.lower()
            exists = any(r.key.lower() == key_lower for r in references)
            if not exists:
                identifier = (cite.key, cite.line_number or 0)
                if identifier not in seen:
                    seen.add(identifier)
                    missing.append(cite)
        
        return missing
    
    def check_unused_references(
        self,
        citations: List[Citation],
        references: List[ReferenceEntry]
    ) -> List[ReferenceEntry]:
        cited_keys: Set[str] = {c.key.lower() for c in citations}
        unused = []
        seen_keys: Set[str] = set()
        
        for ref in references:
            key_lower = ref.key.lower()
            if key_lower not in cited_keys:
                if key_lower not in seen_keys:
                    seen_keys.add(key_lower)
                    unused.append(ref)
        
        return unused
    
    def check_duplicate_keys(
        self,
        references: List[ReferenceEntry]
    ) -> List[Dict]:
        key_map: Dict[str, List[ReferenceEntry]] = defaultdict(list)
        
        for ref in references:
            key_lower = ref.key.lower()
            key_map[key_lower].append(ref)
        
        duplicates = []
        for key_lower, refs in key_map.items():
            if len(refs) > 1:
                duplicates.append({
                    "key": refs[0].key,
                    "entries": [
                        {
                            "key": r.key,
                            "source_file": r.source_file,
                            "title": r.title,
                            "author": r.author,
                            "year": r.year,
                        }
                        for r in refs
                    ]
                })
        
        return duplicates
    
    def check_duplicates_by_doi(
        self,
        references: List[ReferenceEntry]
    ) -> List[List[ReferenceEntry]]:
        doi_map: Dict[str, List[ReferenceEntry]] = defaultdict(list)
        
        for ref in references:
            doi = ref.get_normalized_doi()
            if doi:
                doi_map[doi].append(ref)
        
        duplicates = []
        for doi, refs in doi_map.items():
            if len(refs) > 1:
                duplicates.append(refs)
        
        return duplicates
    
    def check_duplicates_by_title_author(
        self,
        references: List[ReferenceEntry]
    ) -> List[List[ReferenceEntry]]:
        groups: List[List[ReferenceEntry]] = []
        processed: Set[int] = set()
        
        refs_with_title = [r for r in references if r.title]
        
        for i, ref1 in enumerate(refs_with_title):
            if i in processed:
                continue
            
            current_group = [ref1]
            processed.add(i)
            
            for j, ref2 in enumerate(refs_with_title):
                if j <= i or j in processed:
                    continue
                
                similar, ratio = self._titles_similar(ref1.title, ref2.title)
                
                if similar:
                    author1 = ref1.get_first_author_lastname()
                    author2 = ref2.get_first_author_lastname()
                    
                    if (author1 and author2 and author1 == author2) or ratio >= 90:
                        if ref1.year and ref2.year and ref1.year == ref2.year:
                            current_group.append(ref2)
                            processed.add(j)
                        elif not ref1.year or not ref2.year:
                            current_group.append(ref2)
                            processed.add(j)
            
            if len(current_group) > 1:
                groups.append(current_group)
        
        return groups
    
    def check_doi_conflicts(
        self,
        references: List[ReferenceEntry]
    ) -> List[Dict]:
        doi_map: Dict[str, List[ReferenceEntry]] = defaultdict(list)
        
        for ref in references:
            doi = ref.get_normalized_doi()
            if doi:
                doi_map[doi].append(ref)
        
        conflicts = []
        
        for doi, refs in doi_map.items():
            if len(refs) < 2:
                continue
            
            conflict_fields = []
            
            years = {r.year for r in refs if r.year}
            if len(years) > 1:
                conflict_fields.append({
                    "field": "year",
                    "values": sorted(list(years))
                })
            
            authors = {r.author for r in refs if r.author}
            if len(authors) > 1:
                norm_authors = set()
                for a in authors:
                    norm = self._normalize_text(a)
                    if len(norm) > 10:
                        norm_authors.add(norm)
                if len(norm_authors) > 1:
                    conflict_fields.append({
                        "field": "author",
                        "values": sorted(list(authors))
                    })
            
            titles = {r.title for r in refs if r.title}
            if len(titles) > 1:
                all_similar = True
                title_list = list(titles)
                for i in range(len(title_list)):
                    for j in range(i + 1, len(title_list)):
                        similar, _ = self._titles_similar(title_list[i], title_list[j])
                        if not similar:
                            all_similar = False
                            break
                    if not all_similar:
                        break
                
                if not all_similar:
                    conflict_fields.append({
                        "field": "title",
                        "values": sorted(list(titles))
                    })
            
            if conflict_fields:
                conflicts.append({
                    "doi": doi,
                    "entries": [
                        {
                            "key": r.key,
                            "source_file": r.source_file,
                            "title": r.title,
                            "author": r.author,
                            "year": r.year,
                        }
                        for r in refs
                    ],
                    "conflicts": conflict_fields
                })
        
        return conflicts
    
    def run_checks(
        self,
        analysis: ProjectAnalysis
    ) -> CheckResult:
        result = CheckResult()
        
        result.missing_citations = self.check_missing_citations(
            analysis.citations,
            analysis.references
        )
        
        result.unused_references = self.check_unused_references(
            analysis.citations,
            analysis.references
        )
        
        result.duplicate_keys = self.check_duplicate_keys(analysis.references)
        
        doi_duplicates = self.check_duplicates_by_doi(analysis.references)
        title_duplicates = self.check_duplicates_by_title_author(analysis.references)
        
        seen_groups: Set[frozenset] = set()
        all_duplicates: List[List[ReferenceEntry]] = []
        
        for group in doi_duplicates:
            group_keys = frozenset(r.key.lower() for r in group)
            if group_keys not in seen_groups:
                seen_groups.add(group_keys)
                all_duplicates.append(group)
        
        for group in title_duplicates:
            group_keys = frozenset(r.key.lower() for r in group)
            if group_keys not in seen_groups:
                seen_groups.add(group_keys)
                all_duplicates.append(group)
        
        result.duplicate_candidates = all_duplicates
        
        result.doi_conflicts = self.check_doi_conflicts(analysis.references)
        
        if not HAS_FUZZYWUZZY:
            result.warnings.append(
                "fuzzywuzzy 库未安装，标题相似度检测将使用简单匹配。"
                "建议安装: pip install fuzzywuzzy python-Levenshtein"
            )
        
        return result
