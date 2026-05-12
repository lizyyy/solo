import os
import json
from typing import List, Dict, Any, Optional


def ensure_project_dir(project_dir: str) -> None:
    if not os.path.exists(project_dir):
        os.makedirs(project_dir, exist_ok=True)


def is_project_initialized(project_dir: str) -> bool:
    from .db import DB_FILENAME
    return os.path.exists(os.path.join(project_dir, DB_FILENAME))


def load_json_file(file_path: str) -> Any:
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def extract_context(messages: List[Dict], index: int, window: int = 2) -> Dict[str, Optional[str]]:
    context = {
        'before': None,
        'after': None
    }

    before_msgs = []
    for i in range(max(0, index - window), index):
        if 'sender' in messages[i] and 'content' in messages[i]:
            before_msgs.append(f"[{messages[i]['sender']}] {messages[i]['content']}")
    if before_msgs:
        context['before'] = '\n'.join(before_msgs)

    after_msgs = []
    for i in range(index + 1, min(len(messages), index + 1 + window)):
        if 'sender' in messages[i] and 'content' in messages[i]:
            after_msgs.append(f"[{messages[i]['sender']}] {messages[i]['content']}")
    if after_msgs:
        context['after'] = '\n'.join(after_msgs)

    return context


def find_user_quote(messages: List[Dict], agent_index: int, keywords: List[str]) -> Optional[str]:
    for i in range(max(0, agent_index - 5), agent_index):
        msg = messages[i]
        if msg.get('sender') == 'user':
            content = msg.get('content', '')
            for kw in keywords:
                if kw.lower() in content.lower():
                    return content
    return None


def check_transfer_to_agent(messages: List[Dict], agent_index: int) -> Optional[str]:
    for i in range(agent_index, min(len(messages), agent_index + 3)):
        msg = messages[i]
        if msg.get('sender') == 'system' and 'transfer' in msg.get('content', '').lower():
            return msg.get('to_agent')
        if msg.get('sender') != messages[agent_index].get('sender') and i > agent_index:
            return msg.get('agent_id')
    return None


def is_duplicate_hit(existing_hits: List[Dict], new_hit: Dict) -> bool:
    for existing in existing_hits:
        if (existing['session_id'] == new_hit['session_id'] and
            existing['rule_id'] == new_hit['rule_id'] and
            existing['message_index'] == new_hit['message_index']):
            return True
    return False
