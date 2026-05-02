import re
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime

from .data_parser import (
    Conversation, ConversationMessage, PolicyKnowledgeBase,
    PolicyClause, DataParser
)
from .text_features import TextFeatures


@dataclass
class RiskFinding:
    risk_id: str
    session_id: str
    risk_type: str
    risk_level: str
    description: str
    evidence: str
    suggested_fix: str = ""
    confidence: float = 0.0
    confirmed: bool = False
    inspector_notes: str = ""
    detected_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


class RiskDetector:
    RISK_TYPES = {
        'OLD_POLICY': {
            'name': '旧政策话术',
            'description': '客服使用了已过期或失效的政策条款',
            'default_level': 'high'
        },
        'IRRELEVANT_ANSWER': {
            'name': '答非所问',
            'description': '客服回复与用户问题不相关',
            'default_level': 'medium'
        },
        'FABRICATED_CLAUSE': {
            'name': '疑似编造条款引用',
            'description': '客服引用的条款号或政策在知识库中不存在',
            'default_level': 'high'
        },
        'VERSION_CONFLICT': {
            'name': '政策版本冲突',
            'description': '同一政策存在多个版本且生效时间重叠',
            'default_level': 'high'
        }
    }

    def __init__(
        self,
        knowledge_base: Optional[PolicyKnowledgeBase] = None,
        text_features: Optional[TextFeatures] = None,
        similarity_threshold: float = 0.3,
        old_policy_threshold_days: int = 0
    ):
        self.knowledge_base = knowledge_base
        self.text_features = text_features or TextFeatures()
        self.similarity_threshold = similarity_threshold
        self.old_policy_threshold_days = old_policy_threshold_days
        self.findings: List[RiskFinding] = []

        self.clause_patterns = [
            re.compile(r'第[零一二三四五六七八九十百千\d]+[条款]'),
            re.compile(r'条款[零一二三四五六七八九十百千\d]+'),
            re.compile(r'[条项款][：:]\s*[\d零一二三四五六七八九十百千]+'),
            re.compile(r'(?<![a-zA-Z\d])[A-Z]{2,}[-_]?\d{3,}(?![a-zA-Z\d])'),
            re.compile(r'政策[编号码]?[：:]\s*[\w\-_]+'),
            re.compile(r'根据[《「【]?([^》」】]+)[》」】]?的?规定'),
        ]

    def detect_all_risks(
        self,
        conversations: List[Conversation],
        knowledge_base: Optional[PolicyKnowledgeBase] = None
    ) -> List[RiskFinding]:
        if knowledge_base is not None:
            self.knowledge_base = knowledge_base

        self.findings = []

        if self.knowledge_base and self.knowledge_base.version_conflicts:
            for conflict in self.knowledge_base.version_conflicts:
                self._add_version_conflict_finding(conflict)

        for conv in conversations:
            self._detect_risks_for_conversation(conv)

        return self.findings

    def _detect_risks_for_conversation(self, conversation: Conversation) -> None:
        session_id = conversation.session_id

        user_messages = [m for m in conversation.messages if m.role.lower() in ['user', 'customer']]
        agent_messages = [m for m in conversation.messages if m.role.lower() in ['assistant', 'agent']]

        for msg in agent_messages:
            self._detect_fabricated_clause(msg, session_id)
            self._detect_old_policy(msg, session_id)

        self._detect_irrelevant_answer(user_messages, agent_messages, session_id)

    def _detect_fabricated_clause(self, message: ConversationMessage, session_id: str) -> None:
        content = message.content
        if not content:
            return

        clause_references = []
        for pattern in self.clause_patterns:
            matches = pattern.findall(content)
            clause_references.extend(matches)

        if not clause_references:
            return

        if self.knowledge_base is None:
            for ref in clause_references:
                if len(str(ref)) > 2:
                    self._add_finding(
                        session_id=session_id,
                        risk_type='FABRICATED_CLAUSE',
                        description=f"检测到未验证的条款引用",
                        evidence=f"引用内容: '{ref}'，上下文: {content[:100]}...",
                        confidence=0.5,
                        metadata={'clause_reference': ref}
                    )
            return

        active_policies = self.knowledge_base.get_active_policies()
        policy_texts = ' '.join([p.content for p in active_policies.values()])
        policy_ids = set([p.clause_id.split('_v')[0].lower() for p in active_policies.values()])

        for ref in clause_references:
            ref_str = str(ref).lower()

            found_in_text = ref_str in policy_texts.lower()
            found_in_ids = any(pid in ref_str or ref_str in pid for pid in policy_ids)

            if not found_in_text and not found_in_ids:
                self._add_finding(
                    session_id=session_id,
                    risk_type='FABRICATED_CLAUSE',
                    description=f"疑似编造的条款引用: '{ref}'",
                    evidence=f"客服回复中引用了 '{ref}'，但在当前政策知识库中未找到匹配项。原文: {content[:150]}",
                    confidence=0.8,
                    metadata={'clause_reference': ref, 'message_content': content}
                )

    def _detect_old_policy(self, message: ConversationMessage, session_id: str) -> None:
        if self.knowledge_base is None:
            return

        content = message.content
        if not content:
            return

        all_policies = self.knowledge_base.policies
        active_policies = self.knowledge_base.get_active_policies()

        active_ids = set(active_policies.keys())
        all_ids = set(all_policies.keys())
        inactive_ids = all_ids - active_ids

        for clause_id in inactive_ids:
            policy = all_policies[clause_id]
            base_id = clause_id.split('_v')[0]

            latest_version = self.knowledge_base.get_latest_version(clause_id)

            if latest_version and latest_version.version != policy.version:
                processed_content = self.text_features.preprocess(content)
                processed_policy = self.text_features.preprocess(policy.content)

                if not processed_policy or not processed_content:
                    continue

                keyword_match = any(
                    kw.lower() in content.lower()
                    for kw in policy.keywords
                ) if policy.keywords else False

                content_sim = self._simple_text_similarity(content, policy.content)

                if keyword_match or content_sim > self.similarity_threshold:
                    self._add_finding(
                        session_id=session_id,
                        risk_type='OLD_POLICY',
                        description=f"使用了旧版本政策条款",
                        evidence=f"客服可能使用了版本 {policy.version} 的 '{base_id}' 条款。"
                                f"当前最新版本为 {latest_version.version}。"
                                f"匹配关键词: {', '.join(policy.keywords[:3]) if policy.keywords else '文本相似度匹配'}",
                        confidence=content_sim if content_sim > 0 else 0.6,
                        metadata={
                            'old_version': policy.version,
                            'new_version': latest_version.version,
                            'clause_id': base_id,
                            'similarity': content_sim,
                            'old_content': policy.content[:200],
                            'new_content': latest_version.content[:200]
                        }
                    )

    def _simple_text_similarity(self, text1: str, text2: str) -> float:
        if not text1 or not text2:
            return 0.0

        words1 = set(self.text_features.preprocess(text1).split())
        words2 = set(self.text_features.preprocess(text2).split())

        if not words1 or not words2:
            return 0.0

        intersection = words1 & words2
        union = words1 | words2

        return len(intersection) / len(union) if union else 0.0

    def _detect_irrelevant_answer(
        self,
        user_messages: List[ConversationMessage],
        agent_messages: List[ConversationMessage],
        session_id: str
    ) -> None:
        if not user_messages or not agent_messages:
            return

        user_text = ' '.join([m.content for m in user_messages if m.content])
        agent_text = ' '.join([m.content for m in agent_messages if m.content])

        if not user_text.strip() or not agent_text.strip():
            return

        if self.text_features.vectorizer is not None:
            similarity = self.text_features.compute_similarity(user_text, agent_text)
        else:
            similarity = self._simple_text_similarity(user_text, agent_text)

        if similarity < self.similarity_threshold:
            user_keywords = self.text_features.get_top_keywords(user_text, top_n=5)
            agent_keywords = self.text_features.get_top_keywords(agent_text, top_n=5)

            common_keywords = set([k[0] for k in user_keywords]) & set([k[0] for k in agent_keywords])

            if not common_keywords or len(common_keywords) < 1:
                self._add_finding(
                    session_id=session_id,
                    risk_type='IRRELEVANT_ANSWER',
                    description=f"疑似答非所问，相似度: {similarity:.2f}",
                    evidence=f"用户问题关键词: {', '.join([k[0] for k in user_keywords[:3]])}\n"
                            f"客服回复关键词: {', '.join([k[0] for k in agent_keywords[:3]])}\n"
                            f"用户问题: {user_text[:100]}...\n"
                            f"客服回复: {agent_text[:100]}...",
                    confidence=1.0 - similarity,
                    metadata={
                        'similarity': similarity,
                        'user_keywords': user_keywords,
                        'agent_keywords': agent_keywords,
                        'user_text': user_text,
                        'agent_text': agent_text
                    }
                )

    def _add_version_conflict_finding(self, conflict: Dict[str, Any]) -> None:
        base_id = conflict.get('base_id', 'unknown')
        conflict_type = conflict.get('conflict_type', 'version_overlap')

        self._add_finding(
            session_id=f"SYSTEM_POLICY_{base_id}",
            risk_type='VERSION_CONFLICT',
            description=f"政策版本冲突: {base_id}",
            evidence=f"检测到政策 '{base_id}' 存在多个版本冲突\n"
                    f"现有版本: {conflict.get('existing_version', 'unknown')}, 生效时间: {conflict.get('existing_effective')}\n"
                    f"新添版本: {conflict.get('new_version', 'unknown')}, 生效时间: {conflict.get('new_effective')}\n"
                    f"冲突类型: {conflict_type}",
            confidence=1.0,
            metadata=conflict
        )

    def _add_finding(
        self,
        session_id: str,
        risk_type: str,
        description: str,
        evidence: str,
        confidence: float = 0.0,
        suggested_fix: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        risk_info = self.RISK_TYPES.get(risk_type, {})
        risk_level = risk_info.get('default_level', 'medium')

        finding = RiskFinding(
            risk_id=f"RISK_{datetime.now().strftime('%Y%m%d%H%M%S')}_{len(self.findings) + 1:04d}",
            session_id=session_id,
            risk_type=risk_type,
            risk_level=risk_level,
            description=description,
            evidence=evidence,
            suggested_fix=suggested_fix,
            confidence=min(max(confidence, 0.0), 1.0),
            confirmed=False,
            inspector_notes="",
            metadata=metadata or {}
        )

        self.findings.append(finding)

    def get_findings_by_session(self, session_id: str) -> List[RiskFinding]:
        return [f for f in self.findings if f.session_id == session_id]

    def get_findings_by_type(self, risk_type: str) -> List[RiskFinding]:
        return [f for f in self.findings if f.risk_type == risk_type]

    def get_findings_by_level(self, risk_level: str) -> List[RiskFinding]:
        return [f for f in self.findings if f.risk_level == risk_level]

    def get_statistics(self) -> Dict[str, Any]:
        stats = {
            'total_findings': len(self.findings),
            'by_type': {},
            'by_level': {},
            'confirmed_count': len([f for f in self.findings if f.confirmed]),
            'high_confidence_count': len([f for f in self.findings if f.confidence >= 0.7]),
        }

        for risk_type in self.RISK_TYPES.keys():
            stats['by_type'][risk_type] = len(self.get_findings_by_type(risk_type))

        for level in ['high', 'medium', 'low']:
            stats['by_level'][level] = len(self.get_findings_by_level(level))

        return stats

    def confirm_finding(self, risk_id: str, notes: str = "") -> bool:
        for finding in self.findings:
            if finding.risk_id == risk_id:
                finding.confirmed = True
                finding.inspector_notes = notes
                return True
        return False

    def dismiss_finding(self, risk_id: str, reason: str = "") -> bool:
        for i, finding in enumerate(self.findings):
            if finding.risk_id == risk_id:
                finding.metadata['dismissed'] = True
                finding.metadata['dismiss_reason'] = reason
                return True
        return False
