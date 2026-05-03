"""
数据模型定义
定义对话、消息等核心数据结构
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class SpeakerType(Enum):
    """说话者类型枚举"""
    AGENT = "agent"  # 坐席
    CUSTOMER = "customer"  # 客户
    UNKNOWN = "unknown"  # 未知


class ViolationType(Enum):
    """违规类型枚举"""
    BROKEN_PROMISE = "broken_promise"  # 承诺未兑现
    EMOTION_ESCALATION = "emotion_escalation"  # 情绪升级
    SENSITIVE_WORD = "sensitive_word"  # 敏感词
    TIMEOUT_RESPONSE = "timeout_response"  # 超时回复
    MISSING_FIELD = "missing_field"  # 字段缺失
    INVALID_FORMAT = "invalid_format"  # 格式错误


class Severity(Enum):
    """严重程度枚举"""
    CRITICAL = "critical"  # 严重
    HIGH = "high"  # 高
    MEDIUM = "medium"  # 中
    LOW = "low"  # 低


@dataclass
class Message:
    """消息数据模型"""
    index: int  # 消息索引
    speaker: SpeakerType  # 说话者
    content: str  # 消息内容
    timestamp: datetime  # 时间戳
    raw_data: Dict[str, Any] = field(default_factory=dict)  # 原始数据

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "index": self.index,
            "speaker": self.speaker.value,
            "content": self.content,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "raw_data": self.raw_data
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Message":
        """从字典创建消息对象"""
        # 解析说话者
        speaker_str = data.get("speaker", "unknown").lower()
        if speaker_str in ["agent", "坐席", "客服", "坐席人员"]:
            speaker = SpeakerType.AGENT
        elif speaker_str in ["customer", "客户", "用户"]:
            speaker = SpeakerType.CUSTOMER
        else:
            speaker = SpeakerType.UNKNOWN
        
        # 解析时间戳
        timestamp_str = data.get("timestamp", data.get("time"))
        timestamp = None
        if timestamp_str:
            # 如果已经是 datetime 对象，直接使用
            if isinstance(timestamp_str, datetime):
                timestamp = timestamp_str
            else:
                # 尝试多种时间格式解析
                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S"]:
                    try:
                        timestamp = datetime.strptime(timestamp_str, fmt)
                        break
                    except ValueError:
                        continue
                # 如果以上都失败，尝试使用 dateutil
                if not timestamp:
                    try:
                        from dateutil import parser
                        timestamp = parser.parse(timestamp_str)
                    except (ImportError, ValueError):
                        pass
        
        return cls(
            index=data.get("index", 0),
            speaker=speaker,
            content=data.get("content", "").strip(),
            timestamp=timestamp,
            raw_data=data
        )


@dataclass
class Conversation:
    """对话数据模型"""
    conversation_id: str  # 对话ID
    agent_name: str  # 坐席姓名
    customer_name: str  # 客户姓名
    conversation_time: datetime  # 对话时间
    messages: List[Message]  # 消息列表
    raw_data: Dict[str, Any] = field(default_factory=dict)  # 原始数据
    source_file: str = ""  # 源文件路径

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "conversation_id": self.conversation_id,
            "agent_name": self.agent_name,
            "customer_name": self.customer_name,
            "conversation_time": self.conversation_time.isoformat() if self.conversation_time else None,
            "messages": [msg.to_dict() for msg in self.messages],
            "raw_data": self.raw_data,
            "source_file": self.source_file
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any], source_file: str = "") -> "Conversation":
        """从字典创建对话对象"""
        # 解析对话时间
        time_str = data.get("conversation_time", data.get("time", data.get("date")))
        conversation_time = None
        if time_str:
            # 如果已经是 datetime 对象，直接使用
            if isinstance(time_str, datetime):
                conversation_time = time_str
            else:
                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d"]:
                    try:
                        conversation_time = datetime.strptime(time_str, fmt)
                        break
                    except ValueError:
                        continue
                if not conversation_time:
                    try:
                        from dateutil import parser
                        conversation_time = parser.parse(time_str)
                    except (ImportError, ValueError):
                        pass
        
        # 解析消息列表
        messages_data = data.get("messages", data.get("dialogue", data.get("conversation", [])))
        messages = []
        for i, msg_data in enumerate(messages_data):
            if "index" not in msg_data:
                msg_data["index"] = i
            messages.append(Message.from_dict(msg_data))
        
        return cls(
            conversation_id=data.get("conversation_id", data.get("id", "")),
            agent_name=data.get("agent_name", data.get("agent", "")).strip(),
            customer_name=data.get("customer_name", data.get("customer", "")).strip(),
            conversation_time=conversation_time,
            messages=messages,
            raw_data=data,
            source_file=source_file
        )

    @classmethod
    def from_json(cls, json_str: str, source_file: str = "") -> "Conversation":
        """从JSON字符串创建对话对象"""
        data = json.loads(json_str)
        return cls.from_dict(data, source_file)

    @classmethod
    def from_markdown(cls, markdown_str: str, source_file: str = "") -> "Conversation":
        """从Markdown字符串创建对话对象"""
        # 简单的Markdown解析器，适用于常见的对话格式
        lines = markdown_str.strip().split('\n')
        data = {
            "messages": []
        }
        
        # 解析元数据（通常在开头的YAML front matter或表格中）
        in_front_matter = False
        front_matter_lines = []
        message_index = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 检查是否是YAML front matter
            if line == "---":
                if not in_front_matter:
                    in_front_matter = True
                else:
                    in_front_matter = False
                    # 解析front matter
                    front_matter = "\n".join(front_matter_lines)
                    try:
                        import yaml
                        front_matter_data = yaml.safe_load(front_matter)
                        if front_matter_data:
                            data.update(front_matter_data)
                    except ImportError:
                        # 如果没有yaml，尝试简单解析
                        for fl in front_matter_lines:
                            if ":" in fl:
                                key, value = fl.split(":", 1)
                                data[key.strip()] = value.strip()
                    continue
            
            if in_front_matter:
                front_matter_lines.append(line)
                continue
            
            # 解析对话内容
            # 常见格式: **坐席**: 你好，有什么可以帮助您的？
            # 或者: 坐席: 你好，有什么可以帮助您的？
            if ":" in line or "：" in line:
                # 替换中文冒号
                line = line.replace("：", ":")
                # 移除Markdown格式
                line = line.replace("**", "").replace("*", "").replace("`", "")
                
                speaker_part, content_part = line.split(":", 1)
                speaker_part = speaker_part.strip().lower()
                content_part = content_part.strip()
                
                # 确定说话者
                if any(keyword in speaker_part for keyword in ["坐席", "客服", "agent", "坐席人员"]):
                    speaker = "agent"
                elif any(keyword in speaker_part for keyword in ["客户", "用户", "customer"]):
                    speaker = "customer"
                else:
                    speaker = "unknown"
                
                # 尝试解析时间戳（如果有的话）
                timestamp = None
                import re
                time_match = re.search(r'\d{4}[-/年]\d{2}[-/月]\d{2}[日\s]*\d{1,2}:\d{2}(:\d{2})?', line)
                if time_match:
                    try:
                        from dateutil import parser
                        timestamp = parser.parse(time_match.group())
                    except (ImportError, ValueError):
                        pass
                
                data["messages"].append({
                    "index": message_index,
                    "speaker": speaker,
                    "content": content_part,
                    "timestamp": timestamp.isoformat() if timestamp else None
                })
                message_index += 1
        
        return cls.from_dict(data, source_file)


@dataclass
class Violation:
    """违规记录数据模型"""
    violation_type: ViolationType  # 违规类型
    severity: Severity  # 严重程度
    description: str  # 违规描述
    conversation_id: str = ""  # 对话ID
    agent_name: str = ""  # 坐席姓名
    customer_name: str = ""  # 客户姓名
    conversation_time: Optional[datetime] = None  # 对话时间
    message_index: Optional[int] = None  # 相关消息索引
    message_content: str = ""  # 相关消息内容
    message_time: Optional[datetime] = None  # 相关消息时间
    extra_data: Dict[str, Any] = field(default_factory=dict)  # 额外数据

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "violation_type": self.violation_type.value,
            "severity": self.severity.value,
            "description": self.description,
            "conversation_id": self.conversation_id,
            "agent_name": self.agent_name,
            "customer_name": self.customer_name,
            "conversation_time": self.conversation_time.isoformat() if self.conversation_time else None,
            "message_index": self.message_index,
            "message_content": self.message_content,
            "message_time": self.message_time.isoformat() if self.message_time else None,
            "extra_data": self.extra_data
        }


@dataclass
class QualityReport:
    """质检报告数据模型"""
    total_conversations: int = 0  # 总对话数
    valid_conversations: int = 0  # 有效对话数
    invalid_conversations: int = 0  # 无效对话数
    violations: List[Violation] = field(default_factory=list)  # 违规列表
    broken_promises: List[Violation] = field(default_factory=list)  # 承诺未兑现
    emotion_escalations: List[Violation] = field(default_factory=list)  # 情绪升级
    sensitive_words: List[Violation] = field(default_factory=list)  # 敏感词
    timeout_responses: List[Violation] = field(default_factory=list)  # 超时回复
    statistics: Dict[str, Any] = field(default_factory=dict)  # 统计信息
    generated_at: datetime = field(default_factory=datetime.now)  # 生成时间

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "total_conversations": self.total_conversations,
            "valid_conversations": self.valid_conversations,
            "invalid_conversations": self.invalid_conversations,
            "violations": [v.to_dict() for v in self.violations],
            "broken_promises": [v.to_dict() for v in self.broken_promises],
            "emotion_escalations": [v.to_dict() for v in self.emotion_escalations],
            "sensitive_words": [v.to_dict() for v in self.sensitive_words],
            "timeout_responses": [v.to_dict() for v in self.timeout_responses],
            "statistics": self.statistics,
            "generated_at": self.generated_at.isoformat()
        }
