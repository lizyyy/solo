"""聊天记录解析器"""

import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytz

from ..config import Event, EventSource, EventType, ProjectConfig


class ChatParser:
    """值班群消息解析器
    
    支持解析Markdown格式（如微信导出）和JSON格式（如Slack、钉钉导出）的聊天记录。
    """
    
    TIMESTAMP_PATTERNS = [
        r'\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?\s+\d{1,2}:\d{2}(:\d{2})?',
        r'\d{1,2}:\d{2}(:\d{2})?\s+\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?',
        r'\d{4}[-/]\d{1,2}[-/]\d{1,2}T\d{1,2}:\d{2}:\d{2}',
    ]
    
    CONFIRM_KEYWORDS = [
        '确认', '收到', '看到', '我来处理', '正在处理', '已接手',
        'confirm', 'acknowledge', 'ack', 'on it', 'taking over'
    ]
    
    CHANGE_KEYWORDS = [
        '发布', '部署', '升级', '回滚', '重启', '扩容', '缩容',
        '配置变更', '修改配置', '更新配置',
        'deploy', 'release', 'rollback', 'restart', 'scale',
        'config change', 'update config'
    ]
    
    RECOVERY_KEYWORDS = [
        '恢复', '好了', '正常了', '已恢复', '服务恢复',
        'recovery', 'restored', 'back to normal', 'fixed', 'resolved'
    ]
    
    TODO_KEYWORDS = [
        '待办', 'TODO', 'todo', '需要', '应该', '建议',
        '后续', '复盘', '改进', '优化',
        'need to', 'should', 'suggest', 'follow up', 'action item'
    ]
    
    def __init__(self, config: ProjectConfig):
        self.config = config
    
    def parse_markdown(self, md_path: Path, timezone: str = 'Asia/Shanghai') -> List[Event]:
        """解析Markdown格式的聊天记录
        
        常见格式（微信导出）:
        ```
        2024-01-15 10:30:00 张三
        服务告警了，帮忙看看
        
        2024-01-15 10:31:00 李四
        收到，我来处理
        ```
        """
        events: List[Event] = []
        tz = pytz.timezone(timezone)
        
        with open(md_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        messages = self._split_markdown_messages(content)
        
        for msg in messages:
            timestamp = self._extract_timestamp_from_text(msg.get('timestamp', ''), tz)
            if not timestamp:
                continue
            
            event = self._create_event_from_message(
                timestamp=timestamp,
                sender=msg.get('sender'),
                content=msg.get('content', ''),
                source_file=md_path.name,
                source=EventSource.CHAT_MARKDOWN,
            )
            if event:
                events.append(event)
        
        return events
    
    def parse_json(self, json_path: Path, timezone: str = 'Asia/Shanghai') -> List[Event]:
        """解析JSON格式的聊天记录
        
        支持常见格式:
        - Slack导出格式
        - 钉钉导出格式
        - 企业微信导出格式
        """
        events: List[Event] = []
        tz = pytz.timezone(timezone)
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        messages = self._extract_json_messages(data)
        
        for msg in messages:
            timestamp = self._parse_json_timestamp(msg, tz)
            if not timestamp:
                continue
            
            event = self._create_event_from_message(
                timestamp=timestamp,
                sender=msg.get('sender') or msg.get('user') or msg.get('name'),
                content=msg.get('content') or msg.get('text') or msg.get('message', ''),
                source_file=json_path.name,
                source=EventSource.CHAT_JSON,
            )
            if event:
                events.append(event)
        
        return events
    
    def _split_markdown_messages(self, content: str) -> List[Dict[str, str]]:
        """分割Markdown内容为多条消息"""
        messages: List[Dict[str, str]] = []
        
        lines = content.split('\n')
        current_msg: Optional[Dict[str, str]] = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            timestamp_match = self._match_timestamp_line(line)
            if timestamp_match:
                if current_msg:
                    messages.append(current_msg)
                
                current_msg = {
                    'timestamp': timestamp_match['timestamp'],
                    'sender': timestamp_match.get('sender', ''),
                    'content': ''
                }
            elif current_msg:
                if current_msg['content']:
                    current_msg['content'] += '\n' + line
                else:
                    current_msg['content'] = line
        
        if current_msg:
            messages.append(current_msg)
        
        return messages
    
    def _match_timestamp_line(self, line: str) -> Optional[Dict[str, str]]:
        """匹配时间戳行，提取时间和发送者"""
        for pattern in [
            r'^(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?\s+\d{1,2}:\d{2}(:\d{2})?)\s+(.+)$',
            r'^(\d{1,2}:\d{2}(:\d{2})?)\s+(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)\s+(.+)$',
        ]:
            match = re.match(pattern, line)
            if match:
                groups = match.groups()
                if len(groups) == 3:
                    timestamp = groups[0]
                    sender = groups[2]
                else:
                    timestamp = f"{groups[2]} {groups[0]}"
                    sender = groups[3]
                
                return {
                    'timestamp': timestamp,
                    'sender': sender.strip()
                }
        
        return None
    
    def _extract_timestamp_from_text(self, text: str, tz: pytz.BaseTzInfo) -> Optional[datetime]:
        """从文本中提取时间戳"""
        if not text:
            return None
        
        for pattern in self.TIMESTAMP_PATTERNS:
            match = re.search(pattern, text)
            if match:
                timestamp_str = match.group(0)
                dt = self._parse_timestamp_string(timestamp_str, tz)
                if dt:
                    return dt
        
        return None
    
    def _parse_timestamp_string(self, value: str, tz: pytz.BaseTzInfo) -> Optional[datetime]:
        """解析时间戳字符串"""
        value = value.replace('年', '-').replace('月', '-').replace('日', '').strip()
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%SZ',
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                
                if dt.tzinfo is None:
                    dt = tz.localize(dt)
                
                return dt.astimezone(pytz.UTC)
            except (ValueError, TypeError):
                continue
        
        try:
            from dateutil import parser as dateutil_parser
            dt = dateutil_parser.parse(value)
            
            if dt.tzinfo is None:
                dt = tz.localize(dt)
            
            return dt.astimezone(pytz.UTC)
        except (ValueError, TypeError):
            pass
        
        return None
    
    def _extract_json_messages(self, data: Any) -> List[Dict[str, Any]]:
        """从JSON数据中提取消息列表"""
        if isinstance(data, list):
            return data
        
        if isinstance(data, dict):
            if 'messages' in data:
                return data['messages']
            if 'items' in data:
                return data['items']
            if 'chat' in data:
                return self._extract_json_messages(data['chat'])
            
            return [data]
        
        return []
    
    def _parse_json_timestamp(self, msg: Dict[str, Any], tz: pytz.BaseTzInfo) -> Optional[datetime]:
        """从JSON消息中解析时间戳"""
        timestamp_fields = ['ts', 'timestamp', 'time', 'date', 'datetime', 'created_at', 'send_time']
        
        for field in timestamp_fields:
            if field in msg and msg[field]:
                value = msg[field]
                
                if isinstance(value, (int, float)):
                    try:
                        if value > 1e12:
                            dt = datetime.fromtimestamp(value / 1000, tz=pytz.UTC)
                        else:
                            dt = datetime.fromtimestamp(value, tz=pytz.UTC)
                        return dt
                    except (ValueError, TypeError):
                        continue
                
                if isinstance(value, str):
                    dt = self._parse_timestamp_string(value, tz)
                    if dt:
                        return dt
        
        return None
    
    def _create_event_from_message(
        self, 
        timestamp: datetime, 
        sender: Optional[str], 
        content: str, 
        source_file: str,
        source: str,
    ) -> Optional[Event]:
        """从消息创建事件"""
        if not content.strip():
            return None
        
        event_type = self._determine_event_type(content)
        title = self._generate_title(content, sender, event_type)
        
        event = Event(
            id=str(uuid.uuid4()),
            timestamp=timestamp,
            original_timestamp=timestamp.isoformat(),
            event_type=event_type,
            source=source,
            source_file=source_file,
            title=title,
            description=content,
            raw_content=content,
            tags=[sender] if sender else [],
            metadata={
                'sender': sender,
            },
        )
        
        return event
    
    def _determine_event_type(self, content: str) -> str:
        """根据消息内容确定事件类型"""
        content_lower = content.lower()
        
        if any(kw in content_lower for kw in [k.lower() for k in self.CONFIRM_KEYWORDS]):
            return EventType.HUMAN_CONFIRM
        
        if any(kw in content_lower for kw in [k.lower() for k in self.CHANGE_KEYWORDS]):
            return EventType.CHANGE_OPERATION
        
        if any(kw in content_lower for kw in [k.lower() for k in self.RECOVERY_KEYWORDS]):
            return EventType.RECOVERY_VERIFY
        
        if any(kw in content_lower for kw in [k.lower() for k in self.TODO_KEYWORDS]):
            return EventType.TODO_ITEM
        
        return EventType.UNKNOWN
    
    def _generate_title(self, content: str, sender: Optional[str], event_type: str) -> str:
        """生成事件标题"""
        max_length = 80
        first_line = content.strip().split('\n')[0][:max_length]
        
        if event_type == EventType.HUMAN_CONFIRM:
            prefix = f"{sender or '某人'}确认"
        elif event_type == EventType.CHANGE_OPERATION:
            prefix = f"{sender or '某人'}执行变更"
        elif event_type == EventType.RECOVERY_VERIFY:
            prefix = f"{sender or '某人'}确认恢复"
        elif event_type == EventType.TODO_ITEM:
            prefix = "待办事项"
        else:
            prefix = f"{sender or '某人'}的消息"
        
        return f"{prefix}: {first_line}"
