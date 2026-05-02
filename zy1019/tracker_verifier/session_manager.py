"""
Session回放管理器
负责按session分组、时序回放和规则验证
"""

from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime

from .rule_engine import RuleEngine, RuleResult


class Session:
    """单个Session的事件序列"""
    
    def __init__(self, session_id: str, user_id: str = ""):
        self.session_id = session_id
        self.user_id = user_id
        self.events = []  # 按时间排序的事件列表
        self._sorted = True
    
    def add_event(self, event: Dict[str, Any]):
        """添加事件到Session"""
        self.events.append(event)
        self._sorted = False
    
    def sort_events(self):
        """按时间戳排序事件"""
        if not self._sorted:
            self.events.sort(key=lambda x: x.get("_parsed_timestamp", datetime.min))
            self._sorted = True
    
    def get_event_count(self) -> int:
        """获取事件数量"""
        return len(self.events)
    
    def get_user_id(self) -> str:
        """获取用户ID（从第一个事件获取）"""
        if self.events:
            return self.events[0].get("user_id", self.user_id)
        return self.user_id
    
    def get_start_time(self) -> Optional[datetime]:
        """获取Session开始时间"""
        if self.events:
            self.sort_events()
            return self.events[0].get("_parsed_timestamp")
        return None
    
    def get_end_time(self) -> Optional[datetime]:
        """获取Session结束时间"""
        if self.events:
            self.sort_events()
            return self.events[-1].get("_parsed_timestamp")
        return None
    
    def get_duration_seconds(self) -> float:
        """获取Session持续时间（秒）"""
        start = self.get_start_time()
        end = self.get_end_time()
        if start and end:
            return (end - start).total_seconds()
        return 0.0
    
    def get_unique_pages(self) -> List[str]:
        """获取Session中访问的唯一页面列表"""
        pages = set()
        for event in self.events:
            page = event.get("page")
            if page:
                pages.add(page)
        return list(pages)
    
    def get_event_types(self) -> Dict[str, int]:
        """获取各类型事件的统计"""
        event_types = defaultdict(int)
        for event in self.events:
            event_type = event.get("event")
            if event_type:
                event_types[event_type] += 1
        return dict(event_types)


class SessionManager:
    """Session管理器"""
    
    def __init__(self):
        self.sessions: Dict[str, Session] = {}
        self._rule_engine: Optional[RuleEngine] = None
    
    def load_events(self, events: List[Dict[str, Any]]):
        """加载事件列表并按session分组"""
        self.sessions = {}
        
        for event in events:
            session_id = event.get("session_id", "")
            
            if not session_id:
                continue  # 跳过没有session_id的事件
            
            if session_id not in self.sessions:
                user_id = event.get("user_id", "")
                self.sessions[session_id] = Session(session_id, user_id)
            
            self.sessions[session_id].add_event(event)
        
        # 对所有session的事件进行排序
        for session in self.sessions.values():
            session.sort_events()
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """获取指定的Session"""
        return self.sessions.get(session_id)
    
    def get_all_sessions(self) -> List[Session]:
        """获取所有Session列表"""
        return list(self.sessions.values())
    
    def get_session_ids(self) -> List[str]:
        """获取所有Session ID列表"""
        return list(self.sessions.keys())
    
    def get_session_count(self) -> int:
        """获取Session总数"""
        return len(self.sessions)
    
    def get_total_event_count(self) -> int:
        """获取总事件数"""
        total = 0
        for session in self.sessions.values():
            total += session.get_event_count()
        return total
    
    def get_user_count(self) -> int:
        """获取独立用户数"""
        users = set()
        for session in self.sessions.values():
            user_id = session.get_user_id()
            if user_id:
                users.add(user_id)
        return len(users)
    
    def set_rule_engine(self, rule_engine: RuleEngine):
        """设置规则引擎"""
        self._rule_engine = rule_engine
    
    def validate_all_sessions(self) -> Dict[str, List[RuleResult]]:
        """
        验证所有Session的规则
        返回: {session_id: [RuleResult, ...]}
        """
        if not self._rule_engine:
            raise ValueError("规则引擎未设置，请先调用 set_rule_engine()")
        
        all_results = {}
        
        for session_id, session in self.sessions.items():
            results = self._rule_engine.validate_session(
                session.events, 
                session_id
            )
            all_results[session_id] = results
        
        return all_results
    
    def validate_single_session(self, session_id: str) -> Optional[List[RuleResult]]:
        """
        验证单个Session的规则
        返回规则结果列表，如果session不存在则返回None
        """
        if not self._rule_engine:
            raise ValueError("规则引擎未设置，请先调用 set_rule_engine()")
        
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        return self._rule_engine.validate_session(session.events, session_id)
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取Session统计信息"""
        if not self.sessions:
            return {
                "session_count": 0,
                "total_events": 0,
                "user_count": 0,
                "avg_events_per_session": 0,
                "avg_duration_seconds": 0,
                "max_events_session": None,
                "min_events_session": None
            }
        
        session_counts = []
        durations = []
        
        for session in self.sessions.values():
            session_counts.append(session.get_event_count())
            duration = session.get_duration_seconds()
            if duration > 0:
                durations.append(duration)
        
        max_count = max(session_counts) if session_counts else 0
        min_count = min(session_counts) if session_counts else 0
        
        # 找到具有最大和最小事件数的session
        max_session = None
        min_session = None
        
        for session in self.sessions.values():
            count = session.get_event_count()
            if count == max_count and max_session is None:
                max_session = session.session_id
            if count == min_count and min_session is None:
                min_session = session.session_id
        
        return {
            "session_count": self.get_session_count(),
            "total_events": self.get_total_event_count(),
            "user_count": self.get_user_count(),
            "avg_events_per_session": sum(session_counts) / len(session_counts) if session_counts else 0,
            "avg_duration_seconds": sum(durations) / len(durations) if durations else 0,
            "max_events_session": {
                "session_id": max_session,
                "event_count": max_count
            } if max_session else None,
            "min_events_session": {
                "session_id": min_session,
                "event_count": min_count
            } if min_session else None,
            "event_type_distribution": self._get_event_type_distribution()
        }
    
    def _get_event_type_distribution(self) -> Dict[str, int]:
        """获取所有事件类型的分布"""
        distribution = defaultdict(int)
        for session in self.sessions.values():
            event_types = session.get_event_types()
            for event_type, count in event_types.items():
                distribution[event_type] += count
        return dict(distribution)
