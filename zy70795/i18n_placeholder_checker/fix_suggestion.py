from typing import List, Dict, Any
from .comparator import MismatchIssue

class FixSuggestionGenerator:
    def generate_suggestions(self, issue: MismatchIssue) -> List[Dict[str, str]]:
        suggestions = []
        
        if issue.missing_in_target:
            for ph in issue.missing_in_target:
                suggestions.append({
                    "type": "add_placeholder",
                    "placeholder": ph,
                    "suggestion": f"在译文中添加占位符 {{{ph}}}",
                    "context": f"源文案: {issue.source_text}",
                    "action": f"将 {{{ph}}} 添加到译文合适位置"
                })
        
        if issue.extra_in_target:
            for ph in issue.extra_in_target:
                suggestions.append({
                    "type": "remove_placeholder",
                    "placeholder": ph,
                    "suggestion": f"从译文中移除多余占位符 {{{ph}}}",
                    "context": f"译文: {issue.target_text}",
                    "action": f"检查 {{{ph}}} 是否确实多余，确认后删除"
                })
        
        return suggestions
    
    def generate_all_suggestions(self, issues: List[MismatchIssue]) -> Dict[str, List[Dict[str, Any]]]:
        all_suggestions = {}
        for issue in issues:
            all_suggestions[issue.key] = {
                "issue": issue,
                "suggestions": self.generate_suggestions(issue)
            }
        return all_suggestions
