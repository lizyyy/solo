"""
质检规则引擎
实现各种质检规则的检测逻辑
"""

import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field

from quality_inspector.models import (
    Conversation,
    Message,
    SpeakerType,
    Violation,
    ViolationType,
    Severity,
)


# 默认配置
DEFAULT_CONFIG = {
    "general": {
        "default_timeout_seconds": 300,
        "strict_mode": False,
        "output_dir": "./output"
    },
    "sensitive_words": {
        "level1": [
            "投诉", "举报", "退款", "赔偿", "起诉", "曝光", "媒体", "维权", "欺诈", "虚假"
        ],
        "level2": [
            "抱歉", "对不起", "不好意思", "失误", "错误", "遗漏", "延迟", "等待", "遗憾"
        ],
        "level3": [
            "可能", "大概", "也许", "不确定", "考虑", "研究", "稍后", "再看"
        ]
    },
    "promise_detection": {
        "promise_keywords": [
            "保证", "承诺", "一定会", "肯定会", "确保", "一定", "肯定", "将会", "会", "将", "要", "打算", "计划"
        ],
        "fulfillment_keywords": [
            "已经", "已完成", "完成了", "处理好了", "解决了", "搞定了", "做好了", "完成", "处理", "解决", "搞定", "做好"
        ],
        "unfulfilled_keywords": [
            "还没", "还没有", "尚未", "未完成", "没处理", "没解决", "没搞定", "没做好", "延迟", "推后", "延期"
        ]
    },
    "emotion_detection": {
        "negative_emotions": [
            "生气", "愤怒", "不满", "不高兴", "郁闷", "烦躁", "着急", "焦虑", "担心", "害怕",
            "失望", "绝望", "伤心", "难过", "委屈", "无奈"
        ],
        "escalation_keywords": [
            "越来越", "更加", "更", "越来越严重", "越来越差", "越来越不满意", "变本加厉", "愈演愈烈"
        ],
        "deescalation_keywords": [
            "理解", "明白", "知道了", "好的", "没问题", "可以", "行", "同意", "接受", "原谅", "谅解", "谢谢", "感谢"
        ]
    },
    "timeout_detection": {
        "default_timeout": 300,
        "agent_reply_timeout": 300,
        "customer_reply_timeout": 600,
        "severe_timeout": 600
    }
}


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    加载配置文件
    
    Args:
        config_path: 配置文件路径，如果为None则使用默认配置
        
    Returns:
        配置字典
    """
    if config_path and os.path.exists(config_path):
        try:
            import yaml
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            # 合并默认配置
            def deep_merge(default: Dict, override: Dict) -> Dict:
                result = default.copy()
                for key, value in override.items():
                    if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                        result[key] = deep_merge(result[key], value)
                    else:
                        result[key] = value
                return result
            return deep_merge(DEFAULT_CONFIG, config)
        except ImportError:
            # 如果没有yaml模块，使用默认配置
            return DEFAULT_CONFIG
        except Exception:
            return DEFAULT_CONFIG
    return DEFAULT_CONFIG


class QualityRule:
    """质检规则基类"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        初始化规则
        
        Args:
            config: 配置字典
        """
        self.config = config or DEFAULT_CONFIG
    
    def detect(self, conversation: Conversation) -> List[Violation]:
        """
        检测违规
        
        Args:
            conversation: 对话对象
            
        Returns:
            违规列表
        """
        raise NotImplementedError("子类必须实现detect方法")


class SensitiveWordRule(QualityRule):
    """敏感词检测规则"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self._compile_patterns()
    
    def _compile_patterns(self):
        """编译正则表达式模式"""
        sensitive_config = self.config.get("sensitive_words", {})
        
        # 为每个级别创建正则表达式
        self.patterns = {}
        for level in ["level1", "level2", "level3"]:
            words = sensitive_config.get(level, [])
            if words:
                # 使用词边界匹配，但考虑到中文没有词边界，直接匹配
                pattern = "|".join(re.escape(word) for word in words)
                self.patterns[level] = re.compile(pattern)
            else:
                self.patterns[level] = None
        
        # 严重程度映射
        self.severity_map = {
            "level1": Severity.CRITICAL,
            "level2": Severity.HIGH,
            "level3": Severity.MEDIUM
        }
    
    def detect(self, conversation: Conversation) -> List[Violation]:
        """
        检测敏感词
        
        Args:
            conversation: 对话对象
            
        Returns:
            违规列表
        """
        violations = []
        
        for message in conversation.messages:
            content = message.content.lower()
            
            for level, pattern in self.patterns.items():
                if pattern is None:
                    continue
                
                matches = pattern.findall(content)
                if matches:
                    # 去重
                    unique_matches = list(set(matches))
                    
                    violation = Violation(
                        violation_type=ViolationType.SENSITIVE_WORD,
                        severity=self.severity_map[level],
                        description=f"检测到{level}敏感词: {', '.join(unique_matches)}",
                        conversation_id=conversation.conversation_id,
                        agent_name=conversation.agent_name,
                        customer_name=conversation.customer_name,
                        conversation_time=conversation.conversation_time,
                        message_index=message.index,
                        message_content=message.content,
                        message_time=message.timestamp,
                        extra_data={
                            "sensitive_words": unique_matches,
                            "level": level,
                            "speaker": message.speaker.value
                        }
                    )
                    violations.append(violation)
        
        return violations


class BrokenPromiseRule(QualityRule):
    """承诺未兑现检测规则"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self._compile_patterns()
    
    def _compile_patterns(self):
        """编译正则表达式模式"""
        promise_config = self.config.get("promise_detection", {})
        
        # 承诺关键词
        promise_keywords = promise_config.get("promise_keywords", [])
        if promise_keywords:
            self.promise_pattern = re.compile("|".join(re.escape(word) for word in promise_keywords))
        else:
            self.promise_pattern = None
        
        # 兑现关键词
        fulfillment_keywords = promise_config.get("fulfillment_keywords", [])
        if fulfillment_keywords:
            self.fulfillment_pattern = re.compile("|".join(re.escape(word) for word in fulfillment_keywords))
        else:
            self.fulfillment_pattern = None
        
        # 未兑现关键词
        unfulfilled_keywords = promise_config.get("unfulfilled_keywords", [])
        if unfulfilled_keywords:
            self.unfulfilled_pattern = re.compile("|".join(re.escape(word) for word in unfulfilled_keywords))
        else:
            self.unfulfilled_pattern = None
    
    def detect(self, conversation: Conversation) -> List[Violation]:
        """
        检测承诺未兑现
        
        Args:
            conversation: 对话对象
            
        Returns:
            违规列表
        """
        violations = []
        
        # 只检测坐席的承诺
        agent_messages = [msg for msg in conversation.messages if msg.speaker == SpeakerType.AGENT]
        
        for i, message in enumerate(agent_messages):
            content = message.content.lower()
            
            # 检测承诺
            if self.promise_pattern and self.promise_pattern.search(content):
                # 检查后续是否有兑现或未兑现的表述
                has_fulfillment = False
                has_unfulfillment = False
                fulfillment_msg = None
                unfulfillment_msg = None
                
                # 检查后续消息
                for j in range(i + 1, len(agent_messages)):
                    future_content = agent_messages[j].content.lower()
                    
                    if self.fulfillment_pattern and self.fulfillment_pattern.search(future_content):
                        has_fulfillment = True
                        fulfillment_msg = agent_messages[j]
                    
                    if self.unfulfilled_pattern and self.unfulfilled_pattern.search(future_content):
                        has_unfulfillment = True
                        unfulfillment_msg = agent_messages[j]
                
                # 如果有未兑现的表述，或者既没有兑现也没有未兑现（假设未兑现）
                if has_unfulfillment or (not has_fulfillment and not has_unfulfillment):
                    violation_msg = unfulfillment_msg if has_unfulfillment else message
                    
                    description = "坐席作出承诺但未兑现"
                    if has_unfulfillment and unfulfillment_msg:
                        description = f"坐席作出承诺但后续表示未兑现: '{unfulfillment_msg.content}'"
                    elif not has_fulfillment:
                        description = "坐席作出承诺但后续未提及兑现情况"
                    
                    violation = Violation(
                        violation_type=ViolationType.BROKEN_PROMISE,
                        severity=Severity.HIGH,
                        description=description,
                        conversation_id=conversation.conversation_id,
                        agent_name=conversation.agent_name,
                        customer_name=conversation.customer_name,
                        conversation_time=conversation.conversation_time,
                        message_index=violation_msg.index,
                        message_content=violation_msg.content,
                        message_time=violation_msg.timestamp,
                        extra_data={
                            "promise_message": message.content,
                            "promise_index": message.index,
                            "has_fulfillment": has_fulfillment,
                            "has_unfulfillment": has_unfulfillment,
                            "fulfillment_message": fulfillment_msg.content if fulfillment_msg else None,
                            "unfulfillment_message": unfulfillment_msg.content if unfulfillment_msg else None
                        }
                    )
                    violations.append(violation)
        
        return violations


class EmotionEscalationRule(QualityRule):
    """情绪升级检测规则"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self._compile_patterns()
    
    def _compile_patterns(self):
        """编译正则表达式模式"""
        emotion_config = self.config.get("emotion_detection", {})
        
        # 负面情绪关键词
        negative_emotions = emotion_config.get("negative_emotions", [])
        if negative_emotions:
            self.negative_pattern = re.compile("|".join(re.escape(word) for word in negative_emotions))
        else:
            self.negative_pattern = None
        
        # 情绪升级关键词
        escalation_keywords = emotion_config.get("escalation_keywords", [])
        if escalation_keywords:
            self.escalation_pattern = re.compile("|".join(re.escape(word) for word in escalation_keywords))
        else:
            self.escalation_pattern = None
        
        # 情绪缓和关键词
        deescalation_keywords = emotion_config.get("deescalation_keywords", [])
        if deescalation_keywords:
            self.deescalation_pattern = re.compile("|".join(re.escape(word) for word in deescalation_keywords))
        else:
            self.deescalation_pattern = None
    
    def detect(self, conversation: Conversation) -> List[Violation]:
        """
        检测情绪升级
        
        Args:
            conversation: 对话对象
            
        Returns:
            违规列表
        """
        violations = []
        
        # 检测客户的情绪变化
        customer_messages = [msg for msg in conversation.messages if msg.speaker == SpeakerType.CUSTOMER]
        
        # 记录负面情绪出现的位置
        negative_indices = []
        for i, message in enumerate(customer_messages):
            content = message.content.lower()
            if self.negative_pattern and self.negative_pattern.search(content):
                negative_indices.append(i)
        
        # 检查是否有情绪升级的迹象
        # 1. 连续出现负面情绪
        # 2. 出现情绪升级关键词
        # 3. 负面情绪越来越强烈（通过升级关键词判断）
        
        for i, message in enumerate(customer_messages):
            content = message.content.lower()
            
            # 检查是否有情绪升级关键词
            if self.escalation_pattern and self.escalation_pattern.search(content):
                # 同时检查是否有负面情绪
                has_negative = self.negative_pattern and self.negative_pattern.search(content)
                
                severity = Severity.MEDIUM
                if has_negative:
                    severity = Severity.HIGH
                
                violation = Violation(
                    violation_type=ViolationType.EMOTION_ESCALATION,
                    severity=severity,
                    description=f"检测到客户情绪升级: '{message.content}'",
                    conversation_id=conversation.conversation_id,
                    agent_name=conversation.agent_name,
                    customer_name=conversation.customer_name,
                    conversation_time=conversation.conversation_time,
                    message_index=message.index,
                    message_content=message.content,
                    message_time=message.timestamp,
                    extra_data={
                        "has_negative_emotion": has_negative,
                        "speaker": message.speaker.value
                    }
                )
                violations.append(violation)
        
        # 检查连续负面情绪（3次及以上）
        if len(negative_indices) >= 3:
            # 检查是否是连续的
            for i in range(len(negative_indices) - 2):
                if (negative_indices[i + 1] == negative_indices[i] + 1 and 
                    negative_indices[i + 2] == negative_indices[i] + 2):
                    # 连续3次负面情绪
                    start_idx = negative_indices[i]
                    end_idx = negative_indices[i + 2]
                    
                    violation = Violation(
                        violation_type=ViolationType.EMOTION_ESCALATION,
                        severity=Severity.HIGH,
                        description=f"检测到客户连续负面情绪（第{start_idx+1}条到第{end_idx+1}条消息）",
                        conversation_id=conversation.conversation_id,
                        agent_name=conversation.agent_name,
                        customer_name=conversation.customer_name,
                        conversation_time=conversation.conversation_time,
                        message_index=customer_messages[end_idx].index,
                        message_content=customer_messages[end_idx].content,
                        message_time=customer_messages[end_idx].timestamp,
                        extra_data={
                            "consecutive_negative_count": 3,
                            "start_index": start_idx,
                            "end_index": end_idx
                        }
                    )
                    violations.append(violation)
        
        return violations


class TimeoutResponseRule(QualityRule):
    """超时回复检测规则"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        timeout_config = self.config.get("timeout_detection", {})
        self.default_timeout = timeout_config.get("default_timeout", 300)
        self.agent_reply_timeout = timeout_config.get("agent_reply_timeout", 300)
        self.customer_reply_timeout = timeout_config.get("customer_reply_timeout", 600)
        self.severe_timeout = timeout_config.get("severe_timeout", 600)
    
    def detect(self, conversation: Conversation) -> List[Violation]:
        """
        检测超时回复
        
        Args:
            conversation: 对话对象
            
        Returns:
            违规列表
        """
        violations = []
        
        if len(conversation.messages) < 2:
            return violations
        
        # 检查相邻消息之间的时间间隔
        for i in range(1, len(conversation.messages)):
            prev_msg = conversation.messages[i - 1]
            curr_msg = conversation.messages[i]
            
            # 检查是否都有时间戳
            if not prev_msg.timestamp or not curr_msg.timestamp:
                continue
            
            # 计算时间差（秒）
            time_diff = (curr_msg.timestamp - prev_msg.timestamp).total_seconds()
            
            # 根据说话者确定超时阈值
            # 如果前一条是客户说的，当前是坐席说的，检查坐席回复超时
            if prev_msg.speaker == SpeakerType.CUSTOMER and curr_msg.speaker == SpeakerType.AGENT:
                timeout = self.agent_reply_timeout
                timeout_type = "坐席回复超时"
            # 如果前一条是坐席说的，当前是客户说的，检查客户回复超时
            elif prev_msg.speaker == SpeakerType.AGENT and curr_msg.speaker == SpeakerType.CUSTOMER:
                timeout = self.customer_reply_timeout
                timeout_type = "客户回复超时"
            else:
                # 同一说话者连续说话，使用默认超时
                timeout = self.default_timeout
                timeout_type = "消息间隔超时"
            
            if time_diff > timeout:
                # 确定严重程度
                if time_diff > self.severe_timeout:
                    severity = Severity.CRITICAL
                elif time_diff > timeout * 1.5:
                    severity = Severity.HIGH
                else:
                    severity = Severity.MEDIUM
                
                # 格式化时间差
                if time_diff > 3600:
                    time_str = f"{time_diff / 3600:.1f}小时"
                elif time_diff > 60:
                    time_str = f"{time_diff / 60:.1f}分钟"
                else:
                    time_str = f"{time_diff:.0f}秒"
                
                violation = Violation(
                    violation_type=ViolationType.TIMEOUT_RESPONSE,
                    severity=severity,
                    description=f"{timeout_type}: 间隔{time_str}（阈值{timeout/60:.0f}分钟）",
                    conversation_id=conversation.conversation_id,
                    agent_name=conversation.agent_name,
                    customer_name=conversation.customer_name,
                    conversation_time=conversation.conversation_time,
                    message_index=curr_msg.index,
                    message_content=curr_msg.content,
                    message_time=curr_msg.timestamp,
                    extra_data={
                        "time_diff_seconds": time_diff,
                        "timeout_threshold_seconds": timeout,
                        "prev_message_index": prev_msg.index,
                        "prev_message_content": prev_msg.content,
                        "prev_speaker": prev_msg.speaker.value,
                        "curr_speaker": curr_msg.speaker.value
                    }
                )
                violations.append(violation)
        
        return violations


class RuleEngine:
    """规则引擎"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        初始化规则引擎
        
        Args:
            config: 配置字典
        """
        self.config = config or DEFAULT_CONFIG
        
        # 注册规则
        self.rules: List[QualityRule] = [
            SensitiveWordRule(self.config),
            BrokenPromiseRule(self.config),
            EmotionEscalationRule(self.config),
            TimeoutResponseRule(self.config),
        ]
    
    def add_rule(self, rule: QualityRule):
        """
        添加规则
        
        Args:
            rule: 规则对象
        """
        self.rules.append(rule)
    
    def analyze(self, conversation: Conversation) -> List[Violation]:
        """
        分析对话，检测所有违规
        
        Args:
            conversation: 对话对象
            
        Returns:
            违规列表
        """
        all_violations = []
        
        for rule in self.rules:
            violations = rule.detect(conversation)
            all_violations.extend(violations)
        
        return all_violations
    
    def analyze_multiple(self, conversations: List[Conversation]) -> Dict[str, List[Violation]]:
        """
        分析多个对话
        
        Args:
            conversations: 对话列表
            
        Returns:
            字典，键为对话ID，值为违规列表
        """
        results = {}
        
        for conversation in conversations:
            conv_id = conversation.conversation_id or f"conv_{len(results)}"
            results[conv_id] = self.analyze(conversation)
        
        return results


# 便捷函数
def detect_sensitive_words(
    conversation: Conversation,
    config: Optional[Dict[str, Any]] = None
) -> List[Violation]:
    """检测敏感词的便捷函数"""
    rule = SensitiveWordRule(config)
    return rule.detect(conversation)


def detect_broken_promises(
    conversation: Conversation,
    config: Optional[Dict[str, Any]] = None
) -> List[Violation]:
    """检测承诺未兑现的便捷函数"""
    rule = BrokenPromiseRule(config)
    return rule.detect(conversation)


def detect_emotion_escalation(
    conversation: Conversation,
    config: Optional[Dict[str, Any]] = None
) -> List[Violation]:
    """检测情绪升级的便捷函数"""
    rule = EmotionEscalationRule(config)
    return rule.detect(conversation)


def detect_timeout_responses(
    conversation: Conversation,
    config: Optional[Dict[str, Any]] = None
) -> List[Violation]:
    """检测超时回复的便捷函数"""
    rule = TimeoutResponseRule(config)
    return rule.detect(conversation)
