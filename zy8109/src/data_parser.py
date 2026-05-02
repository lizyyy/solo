import json
import yaml
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import re


@dataclass
class ConversationMessage:
    role: str
    content: str
    timestamp: Optional[datetime] = None


@dataclass
class Conversation:
    session_id: str
    messages: List[ConversationMessage] = field(default_factory=list)
    customer_id: Optional[str] = None
    agent_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PolicyClause:
    clause_id: str
    content: str
    category: Optional[str] = None
    version: str = "1.0"
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_active: bool = True
    keywords: List[str] = field(default_factory=list)


@dataclass
class PolicyKnowledgeBase:
    policies: Dict[str, PolicyClause] = field(default_factory=dict)
    version_conflicts: List[Dict[str, Any]] = field(default_factory=list)
    current_version: str = "1.0"

    def get_active_policies(self, as_of_date: Optional[datetime] = None) -> Dict[str, PolicyClause]:
        if as_of_date is None:
            as_of_date = datetime.now()

        active = {}
        for clause_id, policy in self.policies.items():
            if not policy.is_active:
                continue
            if policy.effective_date and policy.effective_date > as_of_date:
                continue
            if policy.expiry_date and policy.expiry_date < as_of_date:
                continue
            active[clause_id] = policy
        return active

    def get_latest_version(self, clause_id: str) -> Optional[PolicyClause]:
        versions = [p for p in self.policies.values() if p.clause_id.split('_v')[0] == clause_id.split('_v')[0]]
        if not versions:
            return None
        versions.sort(key=lambda x: x.version, reverse=True)
        return versions[0]


@dataclass
class InspectionRecord:
    record_id: str
    session_id: str
    inspector: Optional[str] = None
    inspection_time: Optional[datetime] = None
    risk_types: List[str] = field(default_factory=list)
    risk_level: str = "low"
    comments: str = ""
    confirmed: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


class DataParser:
    def __init__(self):
        self.conversations: List[Conversation] = []
        self.knowledge_base: PolicyKnowledgeBase = PolicyKnowledgeBase()
        self.inspection_records: List[InspectionRecord] = []

    def parse_conversations_jsonl(self, file_path: str) -> List[Conversation]:
        conversations = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    conv = self._parse_single_conversation(data, line_num)
                    if conv:
                        conversations.append(conv)
                except json.JSONDecodeError as e:
                    print(f"Warning: Invalid JSON at line {line_num}: {e}")
                    continue
        self.conversations.extend(conversations)
        return conversations

    def _parse_single_conversation(self, data: Dict[str, Any], line_num: int) -> Optional[Conversation]:
        session_id = data.get('session_id') or data.get('id') or f"session_line_{line_num}"
        messages_data = data.get('messages', [])

        if not messages_data and 'content' in data:
            messages_data = [{'role': 'assistant', 'content': data.get('content', '')}]

        messages = []
        for msg_data in messages_data:
            role = msg_data.get('role', 'unknown')
            content = msg_data.get('content', '')
            timestamp = self._parse_datetime(msg_data.get('timestamp'))
            messages.append(ConversationMessage(
                role=role,
                content=content,
                timestamp=timestamp
            ))

        return Conversation(
            session_id=session_id,
            messages=messages,
            customer_id=data.get('customer_id'),
            agent_id=data.get('agent_id'),
            start_time=self._parse_datetime(data.get('start_time')),
            end_time=self._parse_datetime(data.get('end_time')),
            metadata={k: v for k, v in data.items() if k not in ['session_id', 'messages', 'customer_id', 'agent_id', 'start_time', 'end_time']}
        )

    def parse_policy_yaml(self, file_path: str) -> PolicyKnowledgeBase:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        kb = PolicyKnowledgeBase()
        version_conflicts = []

        policies_data = data.get('policies', []) if isinstance(data, dict) else data

        for policy_data in policies_data:
            clause = self._parse_policy_clause(policy_data)
            if clause:
                base_id = clause.clause_id.split('_v')[0]
                if base_id in [p.clause_id.split('_v')[0] for p in kb.policies.values()]:
                    existing = [p for p in kb.policies.values() if p.clause_id.split('_v')[0] == base_id][0]
                    version_conflicts.append({
                        'base_id': base_id,
                        'existing_version': existing.version,
                        'existing_effective': existing.effective_date,
                        'new_version': clause.version,
                        'new_effective': clause.effective_date,
                        'conflict_type': 'version_overlap' if (existing.effective_date and clause.effective_date and existing.effective_date <= clause.effective_date <= (existing.expiry_date or datetime.max)) else 'multiple_versions'
                    })
                kb.policies[clause.clause_id] = clause

        kb.version_conflicts = version_conflicts
        self.knowledge_base = kb
        return kb

    def _parse_policy_clause(self, data: Dict[str, Any]) -> Optional[PolicyClause]:
        clause_id = data.get('clause_id') or data.get('id')
        if not clause_id:
            return None

        content = data.get('content', '')
        if '_v' not in clause_id:
            version = data.get('version', '1.0')
            clause_id = f"{clause_id}_v{version}"
        else:
            version = clause_id.split('_v')[-1]

        keywords = data.get('keywords', [])
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(',')]

        return PolicyClause(
            clause_id=clause_id,
            content=content,
            category=data.get('category'),
            version=version,
            effective_date=self._parse_datetime(data.get('effective_date')),
            expiry_date=self._parse_datetime(data.get('expiry_date')),
            is_active=data.get('is_active', True),
            keywords=keywords
        )

    def parse_inspection_csv(self, file_path: str) -> List[InspectionRecord]:
        df = pd.read_csv(file_path)
        records = []

        for _, row in df.iterrows():
            risk_types_str = str(row.get('risk_types', ''))
            risk_types = [rt.strip() for rt in risk_types_str.split(',')] if risk_types_str and risk_types_str != 'nan' else []

            record = InspectionRecord(
                record_id=str(row.get('record_id', row.get('id', f"record_{_}"))),
                session_id=str(row.get('session_id', '')),
                inspector=str(row.get('inspector', '')) if pd.notna(row.get('inspector')) else None,
                inspection_time=self._parse_datetime(row.get('inspection_time')),
                risk_types=risk_types,
                risk_level=str(row.get('risk_level', 'low')),
                comments=str(row.get('comments', '')) if pd.notna(row.get('comments')) else '',
                confirmed=bool(row.get('confirmed', False)),
                metadata={}
            )
            records.append(record)

        self.inspection_records.extend(records)
        return records

    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if value is None or pd.isna(value) if hasattr(pd, 'isna') else False:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(value)
            except:
                return None
        value_str = str(value).strip()
        if not value_str:
            return None

        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d',
            '%d-%m-%Y %H:%M:%S',
            '%d-%m-%Y',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt)
            except ValueError:
                continue

        try:
            from dateutil import parser
            return parser.parse(value_str)
        except:
            return None

    def get_conversation_text(self, conversation: Conversation, roles: Optional[List[str]] = None) -> str:
        if roles is None:
            roles = ['user', 'assistant', 'customer', 'agent']
        texts = []
        for msg in conversation.messages:
            if msg.role.lower() in [r.lower() for r in roles]:
                texts.append(msg.content)
        return ' '.join(texts)

    def get_all_conversation_texts(self, roles: Optional[List[str]] = None) -> List[Tuple[str, str]]:
        return [(conv.session_id, self.get_conversation_text(conv, roles)) for conv in self.conversations]
