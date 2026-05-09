from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from collections import Counter

from .models import (
    CompensationMessage, MessageStatus, ErrorCategory,
    CleanupSuggestion, InspectionReport
)
from .database import QueueDatabase


class DeadLetterAnalyzer:
    def __init__(self, db: QueueDatabase):
        self.db = db
    
    def analyze_error_patterns(self, 
                                status: Optional[MessageStatus] = None,
                                topic: Optional[str] = None) -> Dict[str, Any]:
        messages = self.db.list_messages(status=status, topic=topic)
        
        error_counter = Counter()
        category_counter = Counter()
        topic_counter = Counter()
        
        for msg in messages:
            if msg.error_category:
                category_counter[msg.error_category.value] += 1
            if msg.last_error_message:
                error_pattern = self._extract_error_pattern(msg.last_error_message)
                error_counter[error_pattern] += 1
            topic_counter[msg.topic] += 1
        
        return {
            "total_messages": len(messages),
            "by_category": dict(category_counter),
            "by_error_pattern": error_counter.most_common(20),
            "by_topic": dict(topic_counter),
        }
    
    def _extract_error_pattern(self, error_msg: str) -> str:
        if "Connection" in error_msg or "connection" in error_msg:
            return "连接类错误"
        if "Timeout" in error_msg or "timeout" in error_msg:
            return "超时类错误"
        if "not found" in error_msg.lower() or "NotFound" in error_msg:
            return "资源不存在"
        if "already" in error_msg.lower() or "duplicate" in error_msg.lower():
            return "重复/已存在"
        if "permission" in error_msg.lower() or "unauthorized" in error_msg.lower():
            return "权限问题"
        if "parse" in error_msg.lower() or "format" in error_msg.lower():
            return "格式/解析错误"
        return error_msg[:50] + "..." if len(error_msg) > 50 else error_msg
    
    def analyze_message(self, message: CompensationMessage) -> Dict[str, Any]:
        age_hours = None
        if message.created_at:
            age_hours = (datetime.now() - message.created_at).total_seconds() / 3600
        
        since_last_fail = None
        if message.last_failed_at:
            since_last_fail = (datetime.now() - message.last_failed_at).total_seconds() / 3600
        
        retry_history = self.db.get_retry_history(message.id)
        
        return {
            "message_id": message.id,
            "topic": message.topic,
            "status": message.status.value,
            "retry_count": message.retry_count,
            "max_retries": message.max_retries,
            "age_hours": round(age_hours, 2) if age_hours else None,
            "hours_since_last_failure": round(since_last_fail, 2) if since_last_fail else None,
            "error_category": message.error_category.value if message.error_category else None,
            "last_error": message.last_error_message,
            "retry_attempts": len(retry_history),
            "success_rate": self._calculate_success_rate(retry_history),
        }
    
    def _calculate_success_rate(self, history: List[Any]) -> float:
        if not history:
            return 0.0
        successes = sum(1 for r in history if r.status == "success")
        return successes / len(history)
    
    def get_cleanup_suggestions(self, 
                                 min_age_hours: int = 168,
                                 include_success: bool = True) -> List[CleanupSuggestion]:
        suggestions: List[CleanupSuggestion] = []
        
        cutoff_time = datetime.now() - timedelta(hours=min_age_hours)
        
        if include_success:
            success_messages = self.db.list_messages(
                status=MessageStatus.SUCCESS,
                created_before=cutoff_time,
            )
            for msg in success_messages:
                suggestions.append(CleanupSuggestion(
                    message_id=msg.id,
                    topic=msg.topic,
                    reason=f"处理成功，已超过{min_age_hours}小时",
                    risk_level="low",
                    suggestion="可安全删除",
                    safe_to_delete=True,
                ))
        
        dead_letters = self.db.list_messages(
            status=MessageStatus.DEAD_LETTER,
            created_before=cutoff_time,
        )
        
        for msg in dead_letters:
            analysis = self._analyze_dead_letter_risk(msg)
            suggestions.append(CleanupSuggestion(
                message_id=msg.id,
                topic=msg.topic,
                reason=analysis["reason"],
                risk_level=analysis["risk_level"],
                suggestion=analysis["suggestion"],
                safe_to_delete=analysis["safe_to_delete"],
            ))
        
        return suggestions
    
    def _analyze_dead_letter_risk(self, message: CompensationMessage) -> Dict[str, Any]:
        age_hours = (datetime.now() - message.created_at).total_seconds() / 3600
        
        if message.error_category in [ErrorCategory.BUSINESS_ERROR, ErrorCategory.VALIDATION_ERROR]:
            return {
                "reason": f"业务/校验错误，重试{message.retry_count}次仍失败",
                "risk_level": "low",
                "suggestion": "业务逻辑问题，建议分析后删除",
                "safe_to_delete": True,
            }
        
        if message.error_category in [ErrorCategory.NETWORK_ERROR, ErrorCategory.TIMEOUT]:
            if age_hours > 720:
                return {
                    "reason": f"网络/超时错误，已存在{age_hours:.1f}小时，可能问题已恢复",
                    "risk_level": "medium",
                    "suggestion": "可尝试强制重试后再决定是否删除",
                    "safe_to_delete": False,
                }
            return {
                "reason": f"网络/超时错误，重试{message.retry_count}次失败",
                "risk_level": "high",
                "suggestion": "建议先检查服务状态，再决定是否重试或删除",
                "safe_to_delete": False,
            }
        
        if message.error_category == ErrorCategory.PERMISSION_ERROR:
            return {
                "reason": "权限错误，需要配置更新",
                "risk_level": "medium",
                "suggestion": "建议检查权限配置后再重试",
                "safe_to_delete": False,
            }
        
        return {
            "reason": f"未知错误类型，重试{message.retry_count}次失败",
            "risk_level": "medium",
            "suggestion": "建议分析错误日志后再处理",
            "safe_to_delete": False,
        }
    
    def generate_inspection_report(self) -> InspectionReport:
        all_messages = self.db.list_messages()
        
        if not all_messages:
            return InspectionReport()
        
        by_status = Counter(m.status for m in all_messages)
        by_topic = Counter(m.topic for m in all_messages)
        by_error = Counter(
            m.error_category.value for m in all_messages 
            if m.error_category
        )
        
        permanent_failures = sum(
            1 for m in all_messages 
            if m.retry_count >= m.max_retries and m.status == MessageStatus.DEAD_LETTER
        )
        
        duplicates = self.db.get_duplicate_idempotent_keys()
        duplicate_keys = [k for k, _ in duplicates]
        
        cleanup_suggestions = self.get_cleanup_suggestions()
        
        oldest = min(all_messages, key=lambda m: m.created_at)
        oldest_age = (datetime.now() - oldest.created_at).total_seconds() / 3600
        
        avg_retry = sum(m.retry_count for m in all_messages) / len(all_messages)
        
        return InspectionReport(
            total_messages=len(all_messages),
            by_status=dict(by_status),
            by_topic=dict(by_topic),
            by_error_category=dict(by_error),
            permanent_failures=permanent_failures,
            duplicate_keys=duplicate_keys,
            cleanup_suggestions=cleanup_suggestions,
            oldest_message_age_hours=round(oldest_age, 2),
            avg_retry_count=round(avg_retry, 2),
        )
