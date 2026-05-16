from typing import List, Dict, Any
from .module_finder import ModuleCandidate


class ConflictAnalyzer:
    def __init__(self):
        pass
    
    def analyze(self, candidates: List[ModuleCandidate], module_name: str,
                search_paths: List[Any]) -> Dict[str, Any]:
        has_conflicts = len(candidates) > 1
        
        primary = candidates[0] if candidates else None
        
        conflicts_detail = []
        if has_conflicts and primary:
            for idx, other in enumerate(candidates[1:], 1):
                conflict = {
                    "conflict_index": idx,
                    "primary_path": str(primary.path),
                    "primary_type": primary.module_type,
                    "shadowed_path": str(other.path),
                    "shadowed_type": other.module_type,
                    "priority_diff": other.priority - primary.priority,
                    "reason": self._explain_conflict(primary, other)
                }
                conflicts_detail.append(conflict)
        
        result = {
            "module_name": module_name,
            "has_conflicts": has_conflicts,
            "total_candidates": len(candidates),
            "primary_candidate": primary.to_dict() if primary else None,
            "all_candidates": [c.to_dict() for c in candidates],
            "conflicts_detail": conflicts_detail,
            "search_paths": [str(p) for p in search_paths],
            "import_explanation": self._explain_import(module_name, primary)
        }
        
        return result
    
    def _explain_conflict(self, primary: ModuleCandidate,
                          other: ModuleCandidate) -> str:
        reasons = []
        
        if other.priority > primary.priority:
            reasons.append(
                f"优先级 #{other.priority} 低于主模块 #{primary.priority}"
            )
        
        if primary.is_stdlib and not other.is_stdlib:
            reasons.append("项目内模块会遮蔽标准库模块")
        elif not primary.is_stdlib and other.is_stdlib:
            reasons.append("标准库模块被项目内模块遮蔽")
        
        if primary.module_type != other.module_type:
            reasons.append(
                f"类型不同: {primary.module_type} vs {other.module_type}"
            )
        
        return "; ".join(reasons) if reasons else "路径或搜索顺序不同"
    
    def _explain_import(self, module_name: str,
                        primary: ModuleCandidate) -> str:
        if not primary:
            return f"未找到模块 {module_name!r} 的任何候选"
        
        explanation = []
        explanation.append(f"实际导入: {primary.path}")
        explanation.append(f"类型: {primary.module_type}")
        explanation.append(f"搜索优先级: #{primary.priority}")
        
        if primary.is_builtin:
            explanation.append("这是 Python 内置模块")
        if primary.is_stdlib:
            explanation.append("这是 Python 标准库模块")
        
        return " | ".join(explanation)
