"""JSON解析器 - 用于解析聊天记录"""
import json
from typing import Any, Dict, List
from .base_parser import BaseParser


class JSONParser(BaseParser):
    """JSON文件解析器"""
    
    def __init__(self):
        self.supported_extensions = ['.json']
    
    def supports_file(self, file_path: str) -> bool:
        """检查是否支持该文件类型"""
        return any(file_path.lower().endswith(ext) for ext in self.supported_extensions)
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """
        解析聊天记录JSON文件
        
        预期的JSON格式：
        - messages: 消息列表，每个消息包含：
          - id: 消息ID
          - sender: 发送者
          - receiver: 接收者
          - content: 消息内容
          - timestamp: 时间戳
          - role: 角色（可选，用于时间线分组）
        或者是一个简单的消息列表
        """
        results = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        messages = []
        if isinstance(data, list):
            messages = data
        elif isinstance(data, dict):
            messages = data.get('messages', [data])
        
        for i, msg in enumerate(messages):
            msg_id = msg.get('id', str(i))
            
            timestamp = None
            timestamp_str = msg.get('timestamp', msg.get('time', ''))
            if timestamp_str:
                try:
                    timestamp = self._parse_timestamp(timestamp_str)
                except Exception:
                    pass
            
            results.append({
                'id': f'chat_{msg_id}',
                'type': 'chat',
                'content': msg.get('content', ''),
                'timestamp': timestamp,
                'metadata': {
                    'sender': msg.get('sender', ''),
                    'receiver': msg.get('receiver', ''),
                    'role': msg.get('role', msg.get('sender', '未知')),
                    'timestamp': timestamp_str,
                    'original_msg': msg
                }
            })
        
        return results
