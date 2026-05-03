"""重复引用检查规则"""
import re
from typing import Any, Dict, List
from collections import defaultdict
from .base_rule import BaseRule, Issue, Severity


class DuplicateReferenceRule(BaseRule):
    """检查证据是否被重复引用"""
    
    def __init__(self):
        super().__init__(
            name="重复引用检查",
            description="检查证据是否被重复引用",
            severity=Severity.MEDIUM
        )
        self.evidence_pattern = re.compile(r'[Ee][0-9]+')
    
    def check(self, data: List[Dict[str, Any]]) -> List[Issue]:
        """
        执行重复引用检查
        
        检查逻辑：
        1. 收集所有证据引用
        2. 检查同一证据在同一上下文（如同一庭审段落）中是否被多次引用
        3. 检查同一证据在不同来源中的引用是否一致
        """
        issues = []
        
        reference_map = self._collect_references(data)
        
        issues.extend(self._check_duplicate_in_same_context(reference_map))
        
        issues.extend(self._check_inconsistent_references(reference_map))
        
        return issues
    
    def _collect_references(self, data: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        收集所有证据引用
        
        Args:
            data: 解析后的数据列表
            
        Returns:
            引用映射，键为证据ID，值为引用位置列表
        """
        reference_map = defaultdict(list)
        
        for item in data:
            item_id = item.get('id', '')
            item_type = item.get('type', '')
            content = item.get('content', '')
            metadata = item.get('metadata', {})
            
            references = set()
            
            matches = self.evidence_pattern.findall(content)
            for match in matches:
                references.add(match.upper())
            
            evidence_refs = metadata.get('evidence_refs', [])
            for ref in evidence_refs:
                references.add(ref.upper())
            
            for ref_id in references:
                reference_map[ref_id].append({
                    'item_id': item_id,
                    'item_type': item_type,
                    'content': content,
                    'context': self._get_context(content, ref_id)
                })
        
        return reference_map
    
    def _check_duplicate_in_same_context(
        self, 
        reference_map: Dict[str, List[Dict[str, Any]]]
    ) -> List[Issue]:
        """
        检查同一上下文中的重复引用
        
        Args:
            reference_map: 引用映射
            
        Returns:
            问题列表
        """
        issues = []
        
        for evidence_id, references in reference_map.items():
            context_map = defaultdict(list)
            
            for ref in references:
                context_key = f"{ref['item_type']}_{ref['item_id']}"
                context_map[context_key].append(ref)
            
            for context_key, context_refs in context_map.items():
                if len(context_refs) > 1:
                    issues.append(self._create_issue(
                        description=f"证据 {evidence_id} 在同一上下文中被重复引用 {len(context_refs)} 次",
                        location=f"{context_refs[0]['item_type']}: {context_refs[0]['item_id']}",
                        evidence_id=evidence_id,
                        details={
                            "evidence_id": evidence_id,
                            "reference_count": len(context_refs),
                            "contexts": [r['context'] for r in context_refs]
                        },
                        severity=Severity.LOW
                    ))
        
        return issues
    
    def _check_inconsistent_references(
        self, 
        reference_map: Dict[str, List[Dict[str, Any]]]
    ) -> List[Issue]:
        """
        检查不一致的引用（大小写不同但实际是同一个证据）
        
        Args:
            reference_map: 引用映射
            
        Returns:
            问题列表
        """
        issues = []
        
        normalized_map = defaultdict(list)
        for evidence_id, references in reference_map.items():
            normalized_map[evidence_id.upper()].append({
                'original_id': evidence_id,
                'references': references
            })
        
        for normalized_id, variants in normalized_map.items():
            if len(variants) > 1:
                original_ids = [v['original_id'] for v in variants]
                issues.append(self._create_issue(
                    description=f"发现不一致的证据引用格式：{', '.join(original_ids)}",
                    location="多来源数据",
                    evidence_id=normalized_id,
                    details={
                        "normalized_id": normalized_id,
                        "variants": original_ids,
                        "reference_locations": [
                            {
                                'variant': v['original_id'],
                                'locations': [f"{r['item_type']}: {r['item_id']}" for r in v['references']]
                            }
                            for v in variants
                        ]
                    },
                    severity=Severity.MEDIUM
                ))
        
        return issues
    
    def _get_context(self, content: str, evidence_id: str, context_length: int = 40) -> str:
        """
        获取引用的上下文
        
        Args:
            content: 完整内容
            evidence_id: 证据ID
            context_length: 上下文长度
            
        Returns:
            上下文字符串
        """
        pattern = re.compile(re.escape(evidence_id), re.IGNORECASE)
        match = pattern.search(content)
        
        if match:
            start = max(0, match.start() - context_length)
            end = min(len(content), match.end() + context_length)
            return content[start:end]
        
        return content[:context_length * 2] if len(content) > context_length * 2 else content
