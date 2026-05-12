from __future__ import annotations

from typing import Dict, List

from .models import CheckResult, CheckStatus, Document, ProjectState


class Reporter:
    def __init__(self, state: ProjectState):
        self.state = state
    
    def get_summary(self) -> Dict:
        results = self.state.check_results
        
        pass_count = sum(1 for r in results if r.status == CheckStatus.PASS)
        warning_count = sum(1 for r in results if r.status == CheckStatus.WARNING)
        fail_count = sum(
            1
            for r in results
            if r.status == CheckStatus.FAIL and not r.is_overridden
        )
        overridden_count = sum(1 for r in results if r.is_overridden)
        
        blocking_failures = [
            r
            for r in results
            if r.status == CheckStatus.FAIL
            and r.is_blocking
            and not r.is_overridden
        ]
        
        can_send = len(blocking_failures) == 0
        
        return {
            "project_name": self.state.project_name,
            "current_version": self.state.current_version,
            "total_checks": len(results),
            "pass": pass_count,
            "warning": warning_count,
            "fail": fail_count,
            "overridden": overridden_count,
            "can_send": can_send,
            "blocking_failures": [r.message for r in blocking_failures],
            "documents": {
                "total": len(self.state.documents),
                "active": sum(1 for d in self.state.documents if d.is_active),
            },
            "reviews": {
                "total": len(self.state.review_items),
                "open": sum(
                    1 for r in self.state.review_items if r.status == "open"
                ),
                "closed": sum(
                    1 for r in self.state.review_items if r.status == "closed"
                ),
            },
        }
    
    def get_documents_by_type(self) -> Dict[str, List[Document]]:
        result = {}
        for doc in self.state.documents:
            doc_type = doc.type.value
            if doc_type not in result:
                result[doc_type] = []
            result[doc_type].append(doc)
        return result
    
    def get_version_history(self) -> List[Dict]:
        return self.state.version_history
    
    def get_audit_history(self, limit: int = 20) -> List[Dict]:
        logs = sorted(self.state.audit_logs, key=lambda x: x.timestamp, reverse=True)
        return logs[:limit]
    
    def get_failed_checks(self) -> List[CheckResult]:
        return [r for r in self.state.check_results if r.status == CheckStatus.FAIL and not r.is_overridden]
    
    def get_warning_checks(self) -> List[CheckResult]:
        return [r for r in self.state.check_results if r.status == CheckStatus.WARNING]
