"""证据缺失检查规则"""
import re
from typing import Any, Dict, List
from .base_rule import BaseRule, Issue, Severity


class EvidenceMissingRule(BaseRule):
    """检查庭审笔录中引用的证据是否在证据目录中存在"""
    
    def __init__(self):
        super().__init__(
            name="证据缺失检查",
            description="检查庭审笔录中引用的证据是否在证据目录中存在",
            severity=Severity.HIGH
        )
        self.evidence_pattern = re.compile(r'[Ee][0-9]+')
    
    def check(self, data: List[Dict[str, Any]]) -> List[Issue]:
        """
        执行证据缺失检查
        
        检查逻辑：
        1. 收集所有已存在的证据ID（来自证据目录CSV）
        2. 收集庭审笔录中引用的所有证据ID
        3. 比较两者，找出缺失的证据
        """
        issues = []
        
        evidence_ids = self._collect_evidence_ids(data)
        referenced_ids = self._collect_referenced_ids(data)
        
        for ref_id in referenced_ids:
            normalized_ref_id = ref_id.upper()
            if normalized_ref_id not in evidence_ids:
                issues.append(self._create_issue(
                    description=f"证据 {ref_id} 在庭审笔录中被引用，但在证据目录中不存在",
                    location="庭审笔录",
                    evidence_id=ref_id,
                    details={
                        "referenced_id": ref_id,
                        "available_evidence": list(evidence_ids)
                    }
                ))
        
        return issues
    
    def _collect_evidence_ids(self, data: List[Dict[str, Any]]) -> set:
        """
        收集所有已存在的证据ID
        
        Args:
            data: 解析后的数据列表
            
        Returns:
            证据ID集合（大写形式）
        """
        evidence_ids = set()
        
        for item in data:
            if item.get('type') == 'evidence':
                evidence_id = item.get('id', '')
                if evidence_id:
                    evidence_ids.add(evidence_id.upper())
        
        return evidence_ids
    
    def _collect_referenced_ids(self, data: List[Dict[str, Any]]) -> set:
        """
        收集庭审笔录中引用的所有证据ID
        
        Args:
            data: 解析后的数据列表
            
        Returns:
            引用的证据ID集合
        """
        referenced_ids = set()
        
        for item in data:
            if item.get('type') == 'transcript':
                content = item.get('content', '')
                matches = self.evidence_pattern.findall(content)
                for match in matches:
                    referenced_ids.add(match.upper())
            
            metadata = item.get('metadata', {})
            evidence_refs = metadata.get('evidence_refs', [])
            for ref in evidence_refs:
                referenced_ids.add(ref.upper())
        
        return referenced_ids
