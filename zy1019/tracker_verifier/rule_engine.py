"""
规则引擎模块
支持多种埋点规则类型的解析和验证
"""

import json
import re
from typing import List, Dict, Any, Optional, Tuple, Callable
from datetime import datetime, timedelta
from abc import ABC, abstractmethod
from enum import Enum


class RuleType(Enum):
    """规则类型枚举"""
    TIME_WINDOW = "time_window"  # 时间窗口规则：事件A后一段时间内应出现事件B
    SEQUENCE = "sequence"  # 顺序规则：事件B必须在事件A之后
    DUPLICATE = "duplicate"  # 重复规则：同一事件不能重复超过指定次数
    PRESENCE = "presence"  # 存在规则：指定事件必须存在或不存在
    CUSTOM = "custom"  # 自定义规则


class RuleResult:
    """规则验证结果"""
    
    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        rule_type: RuleType,
        passed: bool,
        session_id: str = "",
        details: Dict[str, Any] = None,
        related_events: List[Dict[str, Any]] = None
    ):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.rule_type = rule_type
        self.passed = passed
        self.session_id = session_id
        self.details = details or {}
        self.related_events = related_events or []
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "rule_type": self.rule_type.value,
            "passed": self.passed,
            "session_id": self.session_id,
            "details": self.details,
            "related_events": [
                {
                    "event": e.get("event"),
                    "timestamp": e.get("timestamp"),
                    "page": e.get("page"),
                    "line_number": e.get("_line_number")
                }
                for e in self.related_events
            ]
        }


class BaseRule(ABC):
    """规则基类"""
    
    def __init__(self, rule_config: Dict[str, Any]):
        self.rule_id = rule_config.get("rule_id", "")
        self.rule_name = rule_config.get("name", "")
        self.rule_type = self._get_rule_type()
        self.config = rule_config
        self.description = rule_config.get("description", "")
    
    @abstractmethod
    def _get_rule_type(self) -> RuleType:
        """获取规则类型"""
        pass
    
    @abstractmethod
    def validate_session(self, session_events: List[Dict[str, Any]], session_id: str) -> RuleResult:
        """
        验证单个session的事件序列
        返回 RuleResult 对象
        """
        pass
    
    def _extract_event_info(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """提取事件的关键信息用于报告"""
        return {
            "event": event.get("event"),
            "timestamp": event.get("timestamp"),
            "page": event.get("page"),
            "line_number": event.get("_line_number"),
            "_parsed_timestamp": event.get("_parsed_timestamp")
        }


class TimeWindowRule(BaseRule):
    """
    时间窗口规则
    示例："打开详情页之后 5 分钟内应该有 click_buy 或 add_to_cart"
    """
    
    def _get_rule_type(self) -> RuleType:
        return RuleType.TIME_WINDOW
    
    def validate_session(self, session_events: List[Dict[str, Any]], session_id: str) -> RuleResult:
        """验证时间窗口规则"""
        trigger_event = self.config.get("trigger_event")  # 触发事件
        target_events = self.config.get("target_events", [])  # 目标事件列表
        window_seconds = self.config.get("window_seconds", 300)  # 时间窗口（秒）
        must_have = self.config.get("must_have", True)  # 是必须有还是不能有
        
        # 查找所有触发事件
        trigger_indices = [
            i for i, e in enumerate(session_events) 
            if e.get("event") == trigger_event
        ]
        
        if not trigger_indices:
            # 没有触发事件，规则不适用，视为通过
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                session_id=session_id,
                details={
                    "message": "未找到触发事件，规则不适用",
                    "trigger_event": trigger_event
                }
            )
        
        all_passed = True
        failed_details = []
        related_events = []
        
        for trigger_idx in trigger_indices:
            trigger_event_data = session_events[trigger_idx]
            trigger_time = trigger_event_data.get("_parsed_timestamp")
            
            # 计算时间窗口结束时间
            window_end = trigger_time + timedelta(seconds=window_seconds)
            
            # 查找时间窗口内的目标事件
            found_target = False
            target_event_data = None
            
            for i in range(trigger_idx + 1, len(session_events)):
                event = session_events[i]
                event_time = event.get("_parsed_timestamp")
                
                if event_time > window_end:
                    break
                
                if event.get("event") in target_events:
                    found_target = True
                    target_event_data = event
                    break
            
            # 验证逻辑
            if must_have and not found_target:
                all_passed = False
                failed_details.append({
                    "trigger_line": trigger_event_data.get("_line_number"),
                    "trigger_event": trigger_event,
                    "trigger_time": str(trigger_time),
                    "window_seconds": window_seconds,
                    "message": f"在 {trigger_event} 后 {window_seconds} 秒内未找到目标事件: {target_events}"
                })
                related_events.append(self._extract_event_info(trigger_event_data))
            
            elif not must_have and found_target:
                all_passed = False
                failed_details.append({
                    "trigger_line": trigger_event_data.get("_line_number"),
                    "target_line": target_event_data.get("_line_number") if target_event_data else None,
                    "trigger_event": trigger_event,
                    "target_event": target_event_data.get("event") if target_event_data else None,
                    "message": f"在 {trigger_event} 后 {window_seconds} 秒内不应该出现 {target_event_data.get('event') if target_event_data else '目标事件'}"
                })
                related_events.append(self._extract_event_info(trigger_event_data))
                if target_event_data:
                    related_events.append(self._extract_event_info(target_event_data))
        
        if all_passed:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                session_id=session_id,
                details={
                    "message": "所有时间窗口规则验证通过",
                    "trigger_count": len(trigger_indices),
                    "trigger_event": trigger_event,
                    "target_events": target_events
                }
            )
        else:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                session_id=session_id,
                details={
                    "message": "存在时间窗口规则验证失败",
                    "failures": failed_details,
                    "trigger_event": trigger_event,
                    "target_events": target_events
                },
                related_events=related_events
            )


class SequenceRule(BaseRule):
    """
    顺序规则
    示例："支付成功前必须出现 submit_order"
    """
    
    def _get_rule_type(self) -> RuleType:
        return RuleType.SEQUENCE
    
    def validate_session(self, session_events: List[Dict[str, Any]], session_id: str) -> RuleResult:
        """验证顺序规则"""
        before_event = self.config.get("before_event")  # 必须先出现的事件
        after_event = self.config.get("after_event")  # 后出现的事件
        strict = self.config.get("strict", True)  # 是否严格模式（必须直接相邻）
        
        # 查找所有after_event的位置
        after_indices = [
            i for i, e in enumerate(session_events) 
            if e.get("event") == after_event
        ]
        
        if not after_indices:
            # 没有after事件，规则不适用
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                session_id=session_id,
                details={
                    "message": f"未找到事件 {after_event}，规则不适用",
                    "before_event": before_event,
                    "after_event": after_event
                }
            )
        
        all_passed = True
        failed_details = []
        related_events = []
        
        for after_idx in after_indices:
            after_event_data = session_events[after_idx]
            
            # 查找在after_event之前是否有before_event
            has_before = False
            before_event_data = None
            
            if strict:
                # 严格模式：检查前一个事件
                if after_idx > 0:
                    prev_event = session_events[after_idx - 1]
                    if prev_event.get("event") == before_event:
                        has_before = True
                        before_event_data = prev_event
            else:
                # 非严格模式：检查所有之前的事件
                for i in range(after_idx):
                    event = session_events[i]
                    if event.get("event") == before_event:
                        has_before = True
                        before_event_data = event
                        # 可以继续查找，但记录最后一个匹配的
                # 或者只需要找到至少一个，找到就可以停止
                # 这里选择找到所有中的至少一个就通过
            
            if not has_before:
                all_passed = False
                failed_details.append({
                    "after_line": after_event_data.get("_line_number"),
                    "after_event": after_event,
                    "after_time": str(after_event_data.get("_parsed_timestamp")),
                    "message": f"在 {after_event} 之前未找到必需的事件 {before_event}"
                })
                related_events.append(self._extract_event_info(after_event_data))
        
        if all_passed:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                session_id=session_id,
                details={
                    "message": "所有顺序规则验证通过",
                    "before_event": before_event,
                    "after_event": after_event,
                    "strict_mode": strict
                }
            )
        else:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                session_id=session_id,
                details={
                    "message": "存在顺序规则验证失败",
                    "failures": failed_details,
                    "before_event": before_event,
                    "after_event": after_event
                },
                related_events=related_events
            )


class DuplicateRule(BaseRule):
    """
    重复规则
    示例："同一个 session 里不能连续重复上报同一个曝光事件超过 3 次"
    """
    
    def _get_rule_type(self) -> RuleType:
        return RuleType.DUPLICATE
    
    def validate_session(self, session_events: List[Dict[str, Any]], session_id: str) -> RuleResult:
        """验证重复规则"""
        target_event = self.config.get("target_event")  # 要检查的目标事件
        max_count = self.config.get("max_count", 3)  # 最大允许重复次数
        consecutive = self.config.get("consecutive", True)  # 是连续重复还是总重复
        include_page = self.config.get("include_page", False)  # 是否考虑页面区分
        
        all_passed = True
        failed_details = []
        related_events = []
        
        if consecutive:
            # 检查连续重复
            current_streak = 0
            last_event = None
            last_page = None
            streak_events = []
            
            for event in session_events:
                event_name = event.get("event")
                event_page = event.get("page")
                
                is_match = (event_name == target_event)
                if include_page:
                    is_match = is_match and (event_page == last_page if last_page else True)
                
                if is_match:
                    current_streak += 1
                    streak_events.append(event)
                    
                    if current_streak > max_count:
                        all_passed = False
                        failed_details.append({
                            "start_line": streak_events[0].get("_line_number"),
                            "end_line": event.get("_line_number"),
                            "count": current_streak,
                            "max_count": max_count,
                            "event": target_event,
                            "page": event_page if include_page else None,
                            "message": f"连续重复 {target_event} 事件 {current_streak} 次，超过限制 {max_count} 次"
                        })
                        # 添加所有连续重复的事件到related_events
                        for e in streak_events:
                            related_events.append(self._extract_event_info(e))
                        
                        # 重置，但保留当前事件作为新 streak 的开始
                        streak_events = [event]
                        current_streak = 1
                else:
                    current_streak = 0
                    streak_events = []
                
                last_event = event_name
                if include_page:
                    last_page = event_page
        else:
            # 检查总重复次数（不连续）
            event_count = {}
            
            for event in session_events:
                event_name = event.get("event")
                event_page = event.get("page") if include_page else "all"
                
                key = (event_name, event_page)
                
                if event_name == target_event:
                    if key not in event_count:
                        event_count[key] = {
                            "count": 0,
                            "events": []
                        }
                    
                    event_count[key]["count"] += 1
                    event_count[key]["events"].append(event)
                    
                    if event_count[key]["count"] > max_count:
                        all_passed = False
                        failed_details.append({
                            "total_count": event_count[key]["count"],
                            "max_count": max_count,
                            "event": target_event,
                            "page": event_page if include_page else None,
                            "message": f"事件 {target_event} 总共出现 {event_count[key]['count']} 次，超过限制 {max_count} 次"
                        })
                        for e in event_count[key]["events"]:
                            related_events.append(self._extract_event_info(e))
        
        if all_passed:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                session_id=session_id,
                details={
                    "message": "所有重复规则验证通过",
                    "target_event": target_event,
                    "max_count": max_count,
                    "consecutive": consecutive
                }
            )
        else:
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                session_id=session_id,
                details={
                    "message": "存在重复规则验证失败",
                    "failures": failed_details,
                    "target_event": target_event,
                    "max_count": max_count
                },
                related_events=related_events
            )


class PresenceRule(BaseRule):
    """
    存在规则
    检查指定事件是否必须存在或必须不存在
    """
    
    def _get_rule_type(self) -> RuleType:
        return RuleType.PRESENCE
    
    def validate_session(self, session_events: List[Dict[str, Any]], session_id: str) -> RuleResult:
        """验证存在规则"""
        target_event = self.config.get("target_event")
        must_exist = self.config.get("must_exist", True)  # True: 必须存在, False: 必须不存在
        min_count = self.config.get("min_count", 1)  # 最小出现次数
        max_count = self.config.get("max_count", None)  # 最大出现次数
        
        # 统计目标事件出现次数
        event_occurrences = [
            e for e in session_events if e.get("event") == target_event
        ]
        count = len(event_occurrences)
        
        passed = True
        details = {}
        related_events = []
        
        if must_exist:
            # 必须存在
            if count < min_count:
                passed = False
                details = {
                    "message": f"事件 {target_event} 必须至少出现 {min_count} 次，但实际出现 {count} 次",
                    "expected_min": min_count,
                    "actual_count": count,
                    "event": target_event
                }
            elif max_count is not None and count > max_count:
                passed = False
                details = {
                    "message": f"事件 {target_event} 最多出现 {max_count} 次，但实际出现 {count} 次",
                    "expected_max": max_count,
                    "actual_count": count,
                    "event": target_event
                }
                for e in event_occurrences:
                    related_events.append(self._extract_event_info(e))
        else:
            # 必须不存在
            if count > 0:
                passed = False
                details = {
                    "message": f"事件 {target_event} 不应该出现，但实际出现 {count} 次",
                    "actual_count": count,
                    "event": target_event
                }
                for e in event_occurrences:
                    related_events.append(self._extract_event_info(e))
        
        if passed:
            if must_exist:
                details = {
                    "message": f"事件 {target_event} 存在规则验证通过，出现 {count} 次",
                    "count": count,
                    "event": target_event,
                    "must_exist": must_exist
                }
            else:
                details = {
                    "message": f"事件 {target_event} 不存在规则验证通过，未出现",
                    "event": target_event,
                    "must_exist": must_exist
                }
        
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            rule_type=self.rule_type,
            passed=passed,
            session_id=session_id,
            details=details,
            related_events=related_events
        )


class RuleEngine:
    """规则引擎"""
    
    RULE_CLASSES = {
        RuleType.TIME_WINDOW: TimeWindowRule,
        RuleType.SEQUENCE: SequenceRule,
        RuleType.DUPLICATE: DuplicateRule,
        RuleType.PRESENCE: PresenceRule,
    }
    
    def __init__(self):
        self.rules = []
    
    def load_rules_from_file(self, file_path: str) -> List[BaseRule]:
        """从文件加载规则"""
        with open(file_path, 'r', encoding='utf-8') as f:
            rules_config = json.load(f)
        
        return self.load_rules(rules_config)
    
    def load_rules(self, rules_config: List[Dict[str, Any]]) -> List[BaseRule]:
        """加载规则配置"""
        self.rules = []
        
        for rule_config in rules_config:
            rule_type_str = rule_config.get("type", "")
            
            try:
                rule_type = RuleType(rule_type_str)
            except ValueError:
                raise ValueError(f"不支持的规则类型: {rule_type_str}")
            
            if rule_type in self.RULE_CLASSES:
                rule_class = self.RULE_CLASSES[rule_type]
                rule = rule_class(rule_config)
                self.rules.append(rule)
            else:
                raise ValueError(f"规则类型 {rule_type} 未实现")
        
        return self.rules
    
    def validate_session(
        self, 
        session_events: List[Dict[str, Any]], 
        session_id: str
    ) -> List[RuleResult]:
        """验证单个session的所有规则"""
        results = []
        
        for rule in self.rules:
            result = rule.validate_session(session_events, session_id)
            results.append(result)
        
        return results
    
    def get_rules(self) -> List[BaseRule]:
        """获取所有已加载的规则"""
        return self.rules
